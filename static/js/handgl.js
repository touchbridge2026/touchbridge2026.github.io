/* TouchBridge · tiny WebGL renderer for the contact-graph scene.
   Loads articulated hand models (URDF-style joint tree + per-link meshes), runs forward kinematics,
   and renders hands, the light bulb and taxel point sprites into an offscreen canvas that
   tacviz.js composites under its 2-D overlay (graph edges, labels). No dependencies. */
(function () {
  'use strict';
  /* ---------------- 4x4 matrices (column-major) ---------------- */
  var M4 = {
    id: function () { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    mul: function (a, b) {
      var o = new Float32Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    },
    fromRT: function (R, t) {          // R: 3x3 row-major array of rows
      var m = M4.id();
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) m[c * 4 + r] = R[r][c];
      m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m;
    },
    rpy: function (r, p, y) {
      var cr = Math.cos(r), sr = Math.sin(r), cp = Math.cos(p), sp = Math.sin(p), cy = Math.cos(y), sy = Math.sin(y);
      return [[cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr], [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr], [-sp, cp * sr, cp * cr]];
    },
    axang: function (ax, a) {
      var l = Math.hypot(ax[0], ax[1], ax[2]) || 1, x = ax[0] / l, y = ax[1] / l, z = ax[2] / l, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
      return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
    },
    persp: function (fov, asp, n, f) {
      var t = 1 / Math.tan(fov / 2), m = new Float32Array(16);
      m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
    },
    lookAt: function (e, c, u) {
      var z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x), m = M4.id();
      m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
      m[12] = -dot(x, e); m[13] = -dot(y, e); m[14] = -dot(z, e); return m;
    },
    xf: function (m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
    xv: function (m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]; }
  };
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function b64(s, Ctor) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Ctor(u.buffer); }

  /* ---------------- model + forward kinematics ---------------- */
  function Model(json) {
    this.joints = json.joints; this.links = {}; this.root = json.root;
    var self = this;
    Object.keys(json.links).forEach(function (n) {
      var L = json.links[n]; if (!L) return;
      var p = b64(L.p, Int16Array), nr = b64(L.n, Int8Array), pos = new Float32Array(p.length), nrm = new Float32Array(nr.length);
      for (var i = 0; i < p.length; i++) { pos[i] = p[i] / 1e4; nrm[i] = nr[i] / 127; }
      self.links[n] = { pos: pos, nrm: nrm, idx: b64(L.i, Uint16Array), mat: L.mat || 0 };
    });
    this.extra = json;   // grasp poses, taxels, contact points, …
    if (json.skin) {     // one continuous surface + linear-blend skinning (MANO-style)
      var K = json.skin, p = b64(K.p, Int16Array), nr = b64(K.n, Int8Array), nv = p.length / 3;
      this.skin = { rp: new Float32Array(p.length), rn: new Float32Array(nr.length), bi: b64(K.bi, Uint8Array), bw: b64(K.bw, Uint8Array), bones: K.bones,
                    mesh: { pos: new Float32Array(p.length), nrm: new Float32Array(nr.length), idx: b64(K.i, Uint16Array), ver: 0, dyn: true } };
      for (var i = 0; i < p.length; i++) { this.skin.rp[i] = p[i] / 1e4; this.skin.rn[i] = nr[i] / 127; }
      if (K.o0) {         // MANO pose-corrective offsets at the open and the grasp pose
        var o0 = b64(K.o0, Int16Array), o1 = b64(K.o1, Int16Array); this.skin.o0 = new Float32Array(o0.length); this.skin.o1 = new Float32Array(o1.length);
        for (i = 0; i < o0.length; i++) { this.skin.o0[i] = o0[i] / 1e5; this.skin.o1[i] = o1[i] / 1e5; }
      }
      this.nails = {};
      for (var nn in (json.nails || {})) {
        var A = json.nails[nn], ap = b64(A.p, Int16Array), an = b64(A.n, Int8Array), pp = new Float32Array(ap.length), pn = new Float32Array(an.length);
        for (i = 0; i < ap.length; i++) { pp[i] = ap[i] / 1e4; pn[i] = an[i] / 127; }
        this.nails[nn] = { pos: pp, nrm: pn, idx: b64(A.i, Uint16Array) };
      }
    }
    this.jmat = this.joints.map(function (j) { return M4.fromRT(M4.rpy(j.rpy[0], j.rpy[1], j.rpy[2]), j.xyz); });
  }
  function rinv(m) {                // inverse of a rigid 4x4
    var o = M4.id();
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) o[c * 4 + r] = m[r * 4 + c];
    for (r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
    return o;
  }
  Model.prototype.skinned = function (W, blend) {
    var S = this.skin; if (!S) return null;
    if (!S.restInv) { var W0 = this.fk(this.extra.skin.restq || {}, M4.id()); S.restInv = S.bones.map(function (b) { return rinv(W0[b]); }); }
    var Ms = S.bones.map(function (b, i) { return M4.mul(W[b], S.restInv[i]); });
    var rp = S.rp, rn = S.rn, bi = S.bi, bw = S.bw, P = S.mesh.pos, N = S.mesh.nrm, n = rp.length / 3;
    for (var v = 0; v < n; v++) {
      var x = rp[3 * v], y = rp[3 * v + 1], z = rp[3 * v + 2], a = rn[3 * v], b = rn[3 * v + 1], c = rn[3 * v + 2];
      if (S.o0) { var bt = blend == null ? 1 : blend; x += S.o0[3 * v] + (S.o1[3 * v] - S.o0[3 * v]) * bt; y += S.o0[3 * v + 1] + (S.o1[3 * v + 1] - S.o0[3 * v + 1]) * bt; z += S.o0[3 * v + 2] + (S.o1[3 * v + 2] - S.o0[3 * v + 2]) * bt; }
      var px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
      for (var k = 0; k < 4; k++) {
        var w = bw[4 * v + k]; if (!w) continue; w /= 255; var m = Ms[bi[4 * v + k]];
        px += w * (m[0] * x + m[4] * y + m[8] * z + m[12]); py += w * (m[1] * x + m[5] * y + m[9] * z + m[13]); pz += w * (m[2] * x + m[6] * y + m[10] * z + m[14]);
        nx += w * (m[0] * a + m[4] * b + m[8] * c); ny += w * (m[1] * a + m[5] * b + m[9] * c); nz += w * (m[2] * a + m[6] * b + m[10] * c);
      }
      P[3 * v] = px; P[3 * v + 1] = py; P[3 * v + 2] = pz; N[3 * v] = nx; N[3 * v + 1] = ny; N[3 * v + 2] = nz;
    }
    if (S.o0) {          // smooth normals from the posed surface
      var I = S.mesh.idx; N.fill(0);
      for (var f = 0; f < I.length; f += 3) {
        var i0 = 3 * I[f], i1 = 3 * I[f + 1], i2 = 3 * I[f + 2];
        var ux = P[i1] - P[i0], uy = P[i1 + 1] - P[i0 + 1], uz = P[i1 + 2] - P[i0 + 2], vx = P[i2] - P[i0], vy = P[i2 + 1] - P[i0 + 1], vz = P[i2 + 2] - P[i0 + 2];
        var fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        N[i0] += fx; N[i0 + 1] += fy; N[i0 + 2] += fz; N[i1] += fx; N[i1 + 1] += fy; N[i1 + 2] += fz; N[i2] += fx; N[i2 + 1] += fy; N[i2 + 2] += fz;
      }
    }
    S.mesh.ver++; return S.mesh;
  };
  Model.prototype.fk = function (q, base) {
    var W = {}; W[this.root] = base;
    for (var i = 0; i < this.joints.length; i++) {
      var j = this.joints[i], P = W[j.parent]; if (!P) continue;
      var M = M4.mul(P, this.jmat[i]);
      if (j.type !== 'fixed') M = M4.mul(M, M4.fromRT(M4.axang(j.axis, q[j.name] || 0), [0, 0, 0]));
      W[j.child] = M;
    }
    return W;
  };

  /* ---------------- procedural bulb (world units: metres) ---------------- */
  function lathe(prof, n) {        // prof: [[r, y], …] bottom→top; returns pos/nrm/idx
    var pos = [], nrm = [], idx = [];
    for (var i = 0; i < prof.length; i++) {
      var a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)];
      var dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1, nr = dy / l, ny = -dr / l;
      for (var k = 0; k <= n; k++) {
        var t = k / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        pos.push(prof[i][0] * c, prof[i][1], prof[i][0] * s); nrm.push(nr * c, ny, nr * s);
      }
    }
    for (i = 0; i < prof.length - 1; i++) for (k = 0; k < n; k++) {
      var A = i * (n + 1) + k, B = A + 1, Cc = A + n + 1, D = Cc + 1; idx.push(A, Cc, B, B, Cc, D);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }
  function bulbParts(B) {
    var g = [], i, R = B.R;
    for (i = 0; i <= 40; i++) { var a = -Math.PI / 2 + Math.PI * i / 40; g.push([R * Math.cos(a) + 1e-6, B.gy + R * Math.sin(a)]); }
    var neck = [[B.baseR * 0.82, B.neckY0], [B.baseR * 0.84, B.neckY0 + 0.002], [B.neckR1, B.neckY1 - 0.003], [B.neckR1 * 0.96, B.neckY1]];
    var y0 = B.baseY0, y1 = B.baseY1, r = B.baseR, e = 0.0025;
    var holder = [[0.0001, y0], [r - e, y0], [r, y0 + e], [r, y1 - e], [r - e * 0.6, y1], [r * 0.86, y1], [r * 0.86, y1 - 0.001]];
    var band = [[r + 0.0004, y0 + (y1 - y0) * 0.22], [r + 0.0004, y0 + (y1 - y0) * 0.42]];
    return { globe: lathe(g, 72), neck: lathe(neck, 56), holder: lathe(holder, 64), band: lathe(band, 64) };
  }

  /* ---------------- GL ---------------- */
  var VS = 'attribute vec3 aP; attribute vec3 aN; uniform mat4 uM, uVP; varying vec3 vW, vN;' +
    'void main(){ vec4 w = uM*vec4(aP,1.0); vW = w.xyz; vN = mat3(uM)*aN; gl_Position = uVP*w; }';
  var FS = 'precision mediump float; varying vec3 vW, vN; uniform vec3 uEye, uCol, uKeyDir, uBulb; uniform vec4 uMat; uniform float uAlpha, uEmis;' +
    'void main(){ vec3 N = normalize(vN); vec3 V = normalize(uEye - vW); if (dot(N,V) < 0.0) N = -N;' +
    ' vec3 L = normalize(uKeyDir); float wrap = uMat.w;' +                                    // wrap > 0 → skin-like soft diffuse
    ' float d = max((dot(N,L) + wrap) / (1.0 + wrap), 0.0);' +
    ' vec3 Lb = uBulb - vW; float db = length(Lb); Lb /= db; float bl = max(dot(N,Lb),0.0) * 0.0009 / (db*db + 0.0004);' +   // warm light from the glowing bulb
    ' float fill = 0.5 + 0.5*N.y;' +
    ' vec3 H = normalize(L + V); float sp = pow(max(dot(N,H),0.0), uMat.y) * uMat.x;' +
    ' float rim = pow(1.0 - max(dot(N,V),0.0), 3.0) * uMat.z;' +
    ' vec3 c = uCol * (0.16*fill + 0.95*d) + uCol*vec3(1.0,0.72,0.32)*bl*1.6 + vec3(sp) + vec3(0.55,0.62,0.75)*rim;' +
    ' if (wrap > 0.0) c += uCol*vec3(0.32,0.08,0.04)*pow(1.0-abs(dot(N,L)),2.0)*0.6;' +          // subsurface tint at the terminator
    ' c = mix(c, uCol, uEmis);' +
    ' gl_FragColor = vec4(pow(c, vec3(0.9)) * uAlpha, uAlpha); }';
  var PVS = 'attribute vec3 aP; attribute vec4 aC; attribute float aS; uniform mat4 uVP; uniform float uPx; varying vec4 vC;' +
    'void main(){ gl_Position = uVP*vec4(aP,1.0); gl_PointSize = aS*uPx/gl_Position.w; vC = aC; }';
  var PFS = 'precision mediump float; varying vec4 vC; uniform float uGlow;' +
    'void main(){ vec2 q = gl_PointCoord*2.0-1.0; float r = dot(q,q); if (r > 1.0) discard;' +
    ' if (uGlow > 0.5) { float g = exp(-r*3.0); gl_FragColor = vec4(vC.rgb*g*vC.a, 0.0); return; }' +
    ' float sh = 0.55 + 0.45*sqrt(1.0-r) - 0.18*(q.x+q.y)*0.5; gl_FragColor = vec4(vC.rgb*sh*vC.a, vC.a); }';

  function Renderer() {
    this.cv = document.createElement('canvas');
    var gl = this.gl = this.cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) return;
    gl.getExtension('OES_element_index_uint');
    this.prog = prog(gl, VS, FS); this.pprog = prog(gl, PVS, PFS);
    this.cache = new Map(); this.pbuf = gl.createBuffer();
  }
  function prog(gl, v, f) {
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p);
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i;
    for (i = 0; i < n; i++) { var a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    var at = {}; n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (i = 0; i < n; i++) { var b = gl.getActiveAttrib(p, i); at[b.name] = gl.getAttribLocation(p, b.name); }
    return { p: p, u: u, a: at };
  }
  Renderer.prototype.buf = function (mesh) {
    var c = this.cache.get(mesh);
    if (c && mesh.dyn && c.ver !== mesh.ver) {
      var g = this.gl; g.bindBuffer(g.ARRAY_BUFFER, c.p); g.bufferData(g.ARRAY_BUFFER, mesh.pos, g.DYNAMIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, c.n); g.bufferData(g.ARRAY_BUFFER, mesh.nrm, g.DYNAMIC_DRAW); c.ver = mesh.ver;
    }
    if (c) return c;
    var gl = this.gl; c = { p: gl.createBuffer(), n: gl.createBuffer(), i: gl.createBuffer(), cnt: mesh.idx.length };
    gl.bindBuffer(gl.ARRAY_BUFFER, c.p); gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, c.n); gl.bufferData(gl.ARRAY_BUFFER, mesh.nrm, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    c.ver = mesh.ver; this.cache.set(mesh, c); return c;
  };
  /* scene: {w,h,dpr, VP, eye, key, bulbPos, draws:[{mesh, M, col, mat:[spec,shin,rim,wrap], alpha, emis}], pts:{pos,col,size} } */
  Renderer.prototype.render = function (S) {
    var gl = this.gl; if (!gl) return null;
    var W = Math.max(1, Math.round(S.w * S.dpr)), H = Math.max(1, Math.round(S.h * S.dpr));
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var P = this.prog; gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP, false, S.VP); gl.uniform3fv(P.u.uEye, S.eye); gl.uniform3fv(P.u.uKeyDir, S.key); gl.uniform3fv(P.u.uBulb, S.bulbPos);
    var self = this;
    S.draws.forEach(function (d) {
      var b = self.buf(d.mesh);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.enableVertexAttribArray(P.a.aN); gl.vertexAttribPointer(P.a.aN, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i);
      gl.uniformMatrix4fv(P.u.uM, false, d.M); gl.uniform3fv(P.u.uCol, d.col); gl.uniform4fv(P.u.uMat, d.mat);
      gl.uniform1f(P.u.uAlpha, d.alpha == null ? 1 : d.alpha); gl.uniform1f(P.u.uEmis, d.emis || 0);
      if (d.alpha != null && d.alpha < 1) gl.depthMask(false);
      gl.drawElements(gl.TRIANGLES, b.cnt, gl.UNSIGNED_SHORT, 0);
      gl.depthMask(true);
    });
    gl.disableVertexAttribArray(P.a.aN);
    if (S.dpts && S.dpts.n) {                    // inactive taxels: ordinary depth test
      var Q0 = this.pprog; gl.useProgram(Q0.p);
      gl.uniformMatrix4fv(Q0.u.uVP, false, S.VP); gl.uniform1f(Q0.u.uPx, H * S.proj5 * 0.5); gl.uniform1f(Q0.u.uGlow, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf); gl.bufferData(gl.ARRAY_BUFFER, S.dpts.data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(Q0.a.aP); gl.vertexAttribPointer(Q0.a.aP, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(Q0.a.aC); gl.vertexAttribPointer(Q0.a.aC, 4, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(Q0.a.aS); gl.vertexAttribPointer(Q0.a.aS, 1, gl.FLOAT, false, 32, 28);
      gl.drawArrays(gl.POINTS, 0, S.dpts.n);
      gl.disableVertexAttribArray(Q0.a.aC); gl.disableVertexAttribArray(Q0.a.aS);
      gl.useProgram(P.p); gl.enableVertexAttribArray(P.a.aP);
    }
    if (S.xray && S.occl) {                      // taxels see through the hand: depth = occluders (bulb) only
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.colorMask(false, false, false, false);
      S.occl.forEach(function (d) {
        var b = self.buf(d.mesh);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(P.a.aP, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.uniformMatrix4fv(P.u.uM, false, d.M);
        gl.drawElements(gl.TRIANGLES, b.cnt, gl.UNSIGNED_SHORT, 0);
      });
      gl.colorMask(true, true, true, true);
    }
    if (S.pts && S.pts.n) {
      var Q = this.pprog; gl.useProgram(Q.p);
      gl.uniformMatrix4fv(Q.u.uVP, false, S.VP); gl.uniform1f(Q.u.uPx, H * S.proj5 * 0.5);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf); gl.bufferData(gl.ARRAY_BUFFER, S.pts.data, gl.DYNAMIC_DRAW);
      var st = 8 * 4;
      gl.enableVertexAttribArray(Q.a.aP); gl.vertexAttribPointer(Q.a.aP, 3, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(Q.a.aC); gl.vertexAttribPointer(Q.a.aC, 4, gl.FLOAT, false, st, 12);
      gl.enableVertexAttribArray(Q.a.aS); gl.vertexAttribPointer(Q.a.aS, 1, gl.FLOAT, false, st, 28);
      gl.uniform1f(Q.u.uGlow, 0); gl.drawArrays(gl.POINTS, 0, S.pts.n);
      gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE); gl.uniform1f(Q.u.uGlow, 1);
      if (S.glow && S.glow.n) { gl.bufferData(gl.ARRAY_BUFFER, S.glow.data, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(Q.a.aP, 3, gl.FLOAT, false, st, 0); gl.vertexAttribPointer(Q.a.aC, 4, gl.FLOAT, false, st, 12); gl.vertexAttribPointer(Q.a.aS, 1, gl.FLOAT, false, st, 28);
        gl.drawArrays(gl.POINTS, 0, S.glow.n); }
      gl.depthMask(true); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disableVertexAttribArray(Q.a.aC); gl.disableVertexAttribArray(Q.a.aS);
    }
    return this.cv;
  };

  var cache = {};
  window.HandGL = {
    M4: M4, Model: Model, bulbParts: bulbParts, Renderer: Renderer,
    load: function (url) {
      if (!cache[url]) cache[url] = fetch(url).then(function (r) { return r.json(); }).then(function (j) { return new Model(j); });
      return cache[url];
    }
  };
})();
