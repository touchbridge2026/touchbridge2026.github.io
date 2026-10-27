/* TouchBridge · Tac-Retarget schematic animations (canvas).
   <canvas data-tr="contact">  → Tactile Contact Alignment
   <canvas data-tr="graph">    → Contact-Graph Preservation
   Pure canvas, no dependencies. Pauses when off-screen; static frame for reduced motion. */
(function () {
  'use strict';
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a), 0, 1); };
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var SERIF = '"Newsreader", Georgia, serif';
  var C = {
    text: 'rgba(236,229,217,.92)', faint: 'rgba(236,229,217,.46)', dim: 'rgba(236,229,217,.22)',
    orange: [251, 141, 51], blue: [96, 172, 255], purple: [178, 140, 255], green: [72, 220, 140], red: [255, 104, 88]
  };
  var rgba = function (c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; };
  var mix = function (a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  /* taxel colormap, matched to the TouchBridge-Cap sensor visualisation (teal → green → yellow) */
  var CMAP = [[0, [12, 92, 104]], [0.3, [14, 150, 142]], [0.55, [44, 206, 104]], [0.8, [178, 238, 60]], [1, [248, 242, 86]]];
  function cmap(v) {
    v = clamp(v, 0, 1);
    for (var i = 1; i < CMAP.length; i++) if (v <= CMAP[i][0]) {
      var t = (v - CMAP[i - 1][0]) / (CMAP[i][0] - CMAP[i - 1][0]);
      return mix(CMAP[i - 1][1], CMAP[i][1], t);
    }
    return CMAP[CMAP.length - 1][1];
  }

  /* ------------------------------------------------------------ shared drawing helpers */
  function bg(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#1b1a18'); g.addColorStop(1, '#0e0d0c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function title(ctx, p, k, head, sub) {
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = '600 ' + (11 * k) + 'px ' + MONO; ctx.fillStyle = C.text;
    spaced(ctx, head, p.x + 20 * k, p.y + 28 * k, 1.6 * k);
    ctx.font = (11 * k) + 'px ' + MONO; ctx.fillStyle = C.faint;
    ctx.fillText(sub, p.x + 20 * k, p.y + 45 * k);
  }
  function spaced(ctx, s, x, y, sp) { for (var i = 0; i < s.length; i++) { ctx.fillText(s[i], x, y); x += ctx.measureText(s[i]).width + sp; } return x; }
  function pill(ctx, x, y, k, label, col, alignRight) {
    ctx.font = '600 ' + (10.5 * k) + 'px ' + MONO;
    var w = 0; for (var i = 0; i < label.length; i++) w += ctx.measureText(label[i]).width + 1.2 * k;
    w += 30 * k; var h = 22 * k; if (alignRight) x -= w;
    ctx.beginPath(); rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = rgba(col, 0.12); ctx.fill(); ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 12 * k, y + h / 2, 3.2 * k, 0, 7); ctx.fillStyle = rgba(col, 1); ctx.fill();
    ctx.fillStyle = rgba(col, 1); ctx.textBaseline = 'middle'; spaced(ctx, label, x + 21 * k, y + h / 2 + 0.5, 1.2 * k);
    ctx.textBaseline = 'alphabetic';
  }
  function rr(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function sym(ctx, x, y, k, base, sub, col, size, sup) {   // italic math symbol with sub- or superscript
    size = size || 17;
    ctx.fillStyle = col; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = 'italic ' + (size * k) + 'px ' + SERIF; ctx.fillText(base, x, y);
    var w = ctx.measureText(base).width;
    if (sub) { ctx.font = 'italic ' + (size * 0.62 * k) + 'px ' + SERIF; ctx.fillText(sub, x + w + 1, y + (sup ? -size * 0.42 : size * 0.22) * k); w += ctx.measureText(sub).width + 1; }
    return w;
  }
  function lossBar(ctx, cx, y, k, sub, val, col) {
    var bw = 150 * k, x0 = cx - bw / 2 + 26 * k;
    sym(ctx, cx - bw / 2 - 40 * k, y + 5 * k, k, 'ℒ', sub, C.text, 16);
    ctx.beginPath(); rr(ctx, x0, y - 3 * k, bw, 6 * k, 3 * k); ctx.fillStyle = C.dim; ctx.fill();
    var w = Math.max(6 * k, bw * clamp(val, 0, 1));
    ctx.beginPath(); rr(ctx, x0, y - 3 * k, w, 6 * k, 3 * k); ctx.fillStyle = rgba(col, 0.95); ctx.fill();
    ctx.font = (11 * k) + 'px ' + MONO; ctx.fillStyle = C.faint; ctx.textAlign = 'left';
    ctx.fillText(val.toFixed(2), x0 + bw + 10 * k, y + 4 * k);
  }
  function arrow(ctx, x0, y0, x1, y1, k, col, a) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 4) return;
    var ux = dx / L, uy = dy / L, hl = 8 * k;
    ctx.strokeStyle = rgba(col, a); ctx.fillStyle = rgba(col, a); ctx.lineWidth = 1.8 * k;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hl * 0.8, y1 - uy * hl * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * hl - uy * hl * 0.5, y1 - uy * hl + ux * hl * 0.5);
    ctx.lineTo(x1 - ux * hl + uy * hl * 0.5, y1 - uy * hl - ux * hl * 0.5); ctx.closePath(); ctx.fill();
  }
  function hull(P) {                                         // monotone-chain convex hull
    if (P.length < 3) return P.slice();
    P = P.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    var lo = [], up = [], i;
    for (i = 0; i < P.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 0) lo.pop(); lo.push(P[i]); }
    for (i = P.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], P[i]) <= 0) up.pop(); up.push(P[i]); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function smoothClosed(ctx, H) {
    var n = H.length; if (n < 3) return false;
    var m = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    var s = m(H[n - 1], H[0]); ctx.moveTo(s[0], s[1]);
    for (var i = 0; i < n; i++) { var q = m(H[i], H[(i + 1) % n]); ctx.quadraticCurveTo(H[i][0], H[i][1], q[0], q[1]); }
    ctx.closePath(); return true;
  }

  /* ============================================================ 1. Tactile contact alignment */
  function buildTip() {
    var R = 1, L = 2.0, s = 0.128, pts = [], Lm = L + Math.PI * R / 2, row = 0;
    for (var u = 0.04; u <= Lm + 1e-6; u += s, row++) {
      var y, r, ny;
      if (u <= L) { y = u; r = R; ny = 0; } else { var a = (u - L) / R; y = L + R * Math.sin(a); r = R * Math.cos(a); ny = Math.sin(a); }
      var n = Math.max(1, Math.round(2 * Math.PI * r / s)), off = (row % 2) * 0.5, nr = Math.sqrt(Math.max(0, 1 - ny * ny));
      for (var j = 0; j < n; j++) {
        var th = (j + off) / n * 2 * Math.PI - Math.PI;
        if (n > 1 && Math.abs(th) > 2.0) continue;
        if (n === 1) th = 0;
        pts.push({ x: r * Math.sin(th), y: y, z: r * Math.cos(th), nx: nr * Math.sin(th), ny: ny, nz: nr * Math.cos(th) });
      }
    }
    return { pts: pts, R: R, L: L, H: L + R };
  }
  function surf(T, th, u) {
    if (u <= T.L) return [Math.sin(th), u, Math.cos(th)];
    var a = (u - T.L) / T.R, r = Math.cos(a);
    return [r * Math.sin(th), T.L + Math.sin(a), r * Math.cos(th)];
  }
  function field(T, c, sig, amp) {
    var out = new Float32Array(T.pts.length), k = 1 / (2 * sig * sig);
    for (var i = 0; i < T.pts.length; i++) {
      var p = T.pts[i], dx = p.x - c[0], dy = p.y - c[1], dz = p.z - c[2];
      out[i] = amp * Math.exp(-(dx * dx + dy * dy + dz * dz) * k);
    }
    return out;
  }
  function centroid(T, v) {               // response-weighted contact centre (Eq. 3)
    var sx = 0, sy = 0, sz = 0, s = 1e-6;
    for (var i = 0; i < v.length; i++) if (v[i] > 0.04) { var p = T.pts[i]; sx += v[i] * p.x; sy += v[i] * p.y; sz += v[i] * p.z; s += v[i]; }
    return [sx / s, sy / s, sz / s];
  }
  function Projector(T, phi, psi) {
    var cp = Math.cos(phi), sp = Math.sin(phi), cs = Math.cos(psi), ss = Math.sin(psi), yc = T.H / 2;
    return function (x, y, z) {
      var x1 = x * cp + z * sp, z1 = -x * sp + z * cp, yy = y - yc;
      return [x1, yy * cs - z1 * ss, yy * ss + z1 * cs];
    };
  }

  function ContactScene(cv) {
    this.cv = cv; this.T = buildTip(); this.cycle = 7.8; this.still = 5.4;
    /* human contact (th, u, sigma) and where kinematic retargeting would put it on the robot pad (k*) */
    this.contacts = [
      { th: -0.05, u: 1.45, s: 0.42, kth: 0.9, ku: 0.55, ks: 0.28 },
      { th: -0.85, u: 0.85, s: 0.4, kth: 0.1, ku: 2.35, ks: 0.32 },
      { th: 0.8, u: 1.15, s: 0.38, kth: -0.55, ku: 0.45, ks: 0.27 }
    ];
  }
  ContactScene.prototype.draw = function (t) {
    var cv = this.cv, ctx = cv.ctx, W = cv.W, H = cv.H, st = cv.stacked, T = this.T;
    if (!W) return;
    bg(ctx, W, H);
    var k = st ? clamp(W / 420, 0.78, 1.1) : clamp(W / 1000, 0.75, 1.2);
    var cyc = this.cycle, idx = Math.floor(t / cyc) % this.contacts.length, tau = t % cyc, Cn = this.contacts[idx];
    var press = ease(seg(tau, 0.15, 1.0)) * (1 - ease(seg(tau, 6.9, 7.7)));
    var align = ease(seg(tau, 2.6, 4.5));
    var phi = 0.26 * Math.sin(t * 2 * Math.PI / 11), psi = 0.24;
    var pH = st ? { x: 0, y: 0, w: W, h: H / 2 } : { x: 0, y: 0, w: W / 2, h: H };
    var pR = st ? { x: 0, y: H / 2, w: W, h: H / 2 } : { x: W / 2, y: 0, w: W / 2, h: H };
    var S = st ? Math.min(pH.w * 0.2, pH.h * 0.18) : Math.min(pH.w * 0.2, pH.h * 0.215);
    var oy = st ? 0.52 : 0.54, oH = { x: pH.x + pH.w * 0.5, y: pH.y + pH.h * oy }, oR = { x: pR.x + pR.w * 0.5, y: pR.y + pR.h * oy };

    /* fields */
    var cH = surf(T, Cn.th, Cn.u);
    var thR = lerp(Cn.kth, Cn.th, align), uR = lerp(Cn.ku, Cn.u, align), sR = lerp(Cn.ks, Cn.s, align);
    var cR = surf(T, thR, uR);
    var vH = field(T, cH, Cn.s, press), vR = field(T, cR, sR, press);
    var uH1 = field(T, cH, Cn.s, 1), uR1 = field(T, cR, sR, 1), uK1 = field(T, surf(T, Cn.kth, Cn.ku), Cn.ks, 1);
    var muH = centroid(T, uH1), muR = centroid(T, uR1), muK = centroid(T, uK1);
    var d2 = function (a, b) { return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]); };
    var sq = function (a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]); return s; };
    var loss = 0.6 * d2(muR, muH) / (d2(muK, muH) + 1e-6) + 0.4 * sq(uR1, uH1) / (sq(uK1, uH1) + 1e-6);
    loss = clamp(loss, 0, 1) * 0.94 + 0.02;

    /* projection (same pose for both fingertips: matched sensors) */
    var pr = Projector(T, phi, psi), P = T.pts, n = P.length, proj = new Array(n);
    for (var i = 0; i < n; i++) {
      var a = pr(P[i].x, P[i].y, P[i].z), nn = pr(P[i].nx, P[i].ny + T.H / 2, P[i].nz);
      proj[i] = { x: a[0], y: a[1], z: a[2], f: nn[2] };
    }
    var order = proj.map(function (_, i) { return i; }).sort(function (a, b) { return proj[a].z - proj[b].z; });
    var r0 = S * 0.034;
    var toS = function (o, a) { return [o.x + a[0] * S, o.y - a[1] * S]; };

    function drawTip(o, v, ghost) {
      var i, q, s, f, c, rad;
      ctx.globalCompositeOperation = 'lighter';               // soft bloom under strong taxels
      for (i = 0; i < n; i++) {
        q = proj[i]; f = q.f; if (f < -0.05 || v[i] < 0.25) continue;
        s = toS(o, [q.x, q.y]); c = cmap(0.3 + 0.7 * v[i]);
        ctx.beginPath(); ctx.arc(s[0], s[1], r0 * (3.6 + 2 * v[i]), 0, 7); ctx.fillStyle = rgba(c, 0.07 * v[i] * (0.4 + 0.6 * f)); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (var j = 0; j < n; j++) {
        i = order[j]; q = proj[i]; f = q.f; if (f < -0.12) continue;
        var fa = clamp((f + 0.12) / 0.5, 0, 1), sh = 0.35 + 0.65 * clamp(f, 0, 1);
        s = toS(o, [q.x, q.y]); c = cmap(0.08 + 0.92 * v[i]);
        rad = r0 * (0.62 + 0.38 * sh) * (1 + 0.7 * v[i]);
        ctx.beginPath(); ctx.arc(s[0], s[1], rad, 0, 7);
        ctx.fillStyle = rgba([c[0] * (0.55 + 0.45 * sh), c[1] * (0.55 + 0.45 * sh), c[2] * (0.55 + 0.45 * sh)], fa * (0.55 + 0.45 * Math.max(sh, v[i])));
        ctx.fill();
        if (ghost && ghost[i] > 0.5 && f > 0.05) {                // target taxels X^H transferred to the robot pad
          ctx.beginPath(); ctx.arc(s[0], s[1], r0 * 1.9, 0, 7);
          ctx.strokeStyle = rgba(C.orange, 0.5 * press * (1 - 0.55 * align)); ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    function support(o, v, col, a) {
      var pts = [], cx = 0, cy = 0;
      for (var i = 0; i < n; i++) if (v[i] > 0.42 && proj[i].f > 0.1) { var s = toS(o, [proj[i].x, proj[i].y]); pts.push(s); cx += s[0]; cy += s[1]; }
      if (pts.length < 3) return;
      cx /= pts.length; cy /= pts.length;
      var Hh = hull(pts).map(function (p) { var dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * r0 * 2.6, p[1] + dy / L * r0 * 2.6]; });
      ctx.beginPath(); if (!smoothClosed(ctx, Hh)) return;
      ctx.setLineDash([5 * k, 4 * k]); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = 1.5 * k; ctx.stroke(); ctx.setLineDash([]);
      return Hh;
    }
    function muMark(o, mu, a, dashed, sub) {
      var q = pr(mu[0], mu[1], mu[2]), s = toS(o, [q[0], q[1]]), R = S * 0.16;
      ctx.lineWidth = 5 * k; ctx.strokeStyle = 'rgba(14,13,12,' + 0.55 * a + ')'; ctx.beginPath(); ctx.arc(s[0], s[1], R, 0, 7); ctx.stroke();
      ctx.lineWidth = 2 * k; ctx.strokeStyle = rgba(C.orange, a);
      if (dashed) ctx.setLineDash([3 * k, 3 * k]);
      ctx.beginPath(); ctx.arc(s[0], s[1], R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (!dashed) {
        ctx.lineWidth = 1.4 * k; ctx.beginPath();
        ctx.moveTo(s[0] - R * 1.35, s[1]); ctx.lineTo(s[0] - R * 0.6, s[1]); ctx.moveTo(s[0] + R * 0.6, s[1]); ctx.lineTo(s[0] + R * 1.35, s[1]);
        ctx.moveTo(s[0], s[1] - R * 1.35); ctx.lineTo(s[0], s[1] - R * 0.6); ctx.moveTo(s[0], s[1] + R * 0.6); ctx.lineTo(s[0], s[1] + R * 1.35); ctx.stroke();
        ctx.beginPath(); ctx.arc(s[0], s[1], 2.8 * k, 0, 7); ctx.fillStyle = rgba(C.orange, a); ctx.fill(); ctx.strokeStyle = 'rgba(14,13,12,' + 0.6 * a + ')'; ctx.lineWidth = 1.2 * k; ctx.stroke();
      }
      if (sub) { ctx.globalAlpha = a; halo(function () { sym(ctx, s[0] + R * 1.05, s[1] - R * 0.95, k, 'μ', sub, rgba(C.orange, 1), 19, true); }); ctx.globalAlpha = 1; }
      return s;
    }

    function halo(fn) { ctx.save(); ctx.shadowColor = 'rgba(10,9,8,.95)'; ctx.shadowBlur = 6 * k; fn(); fn(); ctx.restore(); }

    /* human fingertip */
    title(ctx, pH, k, 'HUMAN', 'TouchBridge-Cap fingertip sensor');
    drawTip(oH, vH, null);
    var hullH = press > 0.25 ? support(oH, vH, C.blue, 0.85 * press) : null;
    var sMuH = press > 0.2 ? muMark(oH, muH, press, false, 'H') : null;
    if (hullH && press > 0.4) {
      var hx = -1e9, hy = 0; hullH.forEach(function (p) { if (p[0] > hx) { hx = p[0]; hy = p[1]; } });
      ctx.globalAlpha = press; halo(function () { sym(ctx, hx + 6 * k, hy + 16 * k, k, 'X', 'H', rgba(C.blue, 1), 18, true); }); ctx.globalAlpha = 1;
    }

    /* robot fingertip */
    title(ctx, pR, k, 'ROBOT', 'matched taxel layout');
    drawTip(oR, vR, uH1);
    var target = press > 0.2 ? muMark(oR, muH, 0.75 * press, true, null) : null;
    if (press > 0.25) support(oR, vR, C.blue, 0.85 * press);
    var sMuR = press > 0.2 ? muMark(oR, muR, press, false, 'R') : null;
    if (target && sMuR) {
      var dd = Math.hypot(sMuR[0] - target[0], sMuR[1] - target[1]);
      if (dd > S * 0.12) arrow(ctx, sMuR[0], sMuR[1], target[0], target[1], k, C.orange, 0.9 * press * (1 - align * 0.7));
    }

    /* link: the same local contact centre is used on both fingertips */
    if (sMuH && target) {
      var a = 0.55 * press, mx, my;
      ctx.setLineDash([2 * k, 5 * k]); ctx.strokeStyle = rgba(C.orange, a); ctx.lineWidth = 1.3 * k; ctx.beginPath();
      if (!st) { mx = (sMuH[0] + target[0]) / 2; my = Math.min(sMuH[1], target[1]) - H * 0.3; ctx.moveTo(sMuH[0], sMuH[1] - S * 0.14); ctx.quadraticCurveTo(mx, my, target[0], target[1] - S * 0.14); }
      else { mx = W * 0.93; my = (sMuH[1] + target[1]) / 2; ctx.moveTo(sMuH[0] + S * 0.14, sMuH[1]); ctx.quadraticCurveTo(mx, my, target[0] + S * 0.14, target[1]); }
      ctx.stroke(); ctx.setLineDash([]);
      if (!st) {
        ctx.font = (10.5 * k) + 'px ' + MONO; ctx.fillStyle = rgba([236, 229, 217], 0.6 * press); ctx.textAlign = 'center';
        ctx.fillText('same local contact center', W / 2, (Math.min(sMuH[1], target[1]) + my) / 2 - 2 * k);
        ctx.textAlign = 'left';
      }
    }

    /* status + loss */
    var stLabel, stCol;
    if (tau < 1.0) { stLabel = 'CONTACT DETECTED'; stCol = C.blue; }
    else if (tau < 2.6) { stLabel = 'KINEMATIC RETARGET'; stCol = C.red; }
    else if (align < 0.97) { stLabel = 'TAC-RETARGET'; stCol = C.orange; }
    else { stLabel = 'CONTACT ALIGNED'; stCol = C.green; }
    pill(ctx, pR.x + pR.w - 18 * k, pR.y + 16 * k, k, stLabel, stCol, true);
    lossBar(ctx, oR.x + 6 * k, pR.y + pR.h - 26 * k, k, 'contact', press > 0.05 ? loss : 0, mix(C.orange, C.green, align));

    /* human legend */
    var ly = pH.y + pH.h - 22 * k, lx = pH.x + 20 * k;
    ctx.font = (11 * k) + 'px ' + MONO; ctx.fillStyle = C.faint; ctx.textAlign = 'left';
    ctx.beginPath(); ctx.arc(lx + 6 * k, ly - 4 * k, 5 * k, 0, 7); ctx.strokeStyle = rgba(C.orange, 1); ctx.lineWidth = 1.6 * k; ctx.stroke();
    ctx.fillText('patch center μ', lx + 18 * k, ly);
    var lx2 = lx + 18 * k + ctx.measureText('patch center μ').width + 18 * k;
    ctx.setLineDash([4 * k, 3 * k]); ctx.strokeStyle = rgba(C.blue, 1); ctx.beginPath(); ctx.moveTo(lx2, ly - 4 * k); ctx.lineTo(lx2 + 18 * k, ly - 4 * k); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillText('active-taxel support X', lx2 + 26 * k, ly);

    if (st) { ctx.strokeStyle = 'rgba(236,229,217,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18 * k, H / 2); ctx.lineTo(W - 18 * k, H / 2); ctx.stroke(); }
  };

  /* ============================================================ 2. Contact-graph preservation
     3-D scene: point-cloud object, taxel-cloud fingertip sensors, glowing contact-graph edges. */
  var V = {
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    mul: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; },
    norm: function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    len: function (a) { return Math.hypot(a[0], a[1], a[2]); }
  };
  /* compact fingertip sensor: full capsule ring so it reads from any view angle */
  var TIP2 = (function () {
    var R = 1, L = 1.6, s = 0.2, pts = [], Lm = L + Math.PI * R / 2, row = 0;
    for (var u = 0.0; u <= Lm + 1e-6; u += s, row++) {
      var y, r, ny;
      if (u <= L) { y = u; r = R; ny = 0; } else { var a = (u - L) / R; y = L + R * Math.sin(a); r = R * Math.cos(a); ny = Math.sin(a); }
      var n = Math.max(1, Math.round(2 * Math.PI * r / s)), off = (row % 2) * 0.5, nr = Math.sqrt(Math.max(0, 1 - ny * ny));
      for (var j = 0; j < n; j++) {
        var th = (j + off) / n * 2 * Math.PI;
        pts.push({ p: [r * Math.sin(th), y, r * Math.cos(th)], n: [nr * Math.sin(th), ny, nr * Math.cos(th)] });
      }
    }
    return { pts: pts, pad: [0, 1.35, 1] };     // pad = contact location on the fingertip (local frame)
  })();
  var OBJR = [0.6, 0.82, 0.6];
  var OBJPTS = (function () {                     // Fibonacci point cloud on an ellipsoid
    var N = 760, out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), th = ga * i;
      var p = [Math.cos(th) * r * OBJR[0], y * OBJR[1], Math.sin(th) * r * OBJR[2]];
      out.push({ p: p, n: V.norm([p[0] / (OBJR[0] * OBJR[0]), p[1] / (OBJR[1] * OBJR[1]), p[2] / (OBJR[2] * OBJR[2])]) });
    }
    return out;
  })();
  function objPoint(az, el) {
    var a = az * Math.PI / 180, e = el * Math.PI / 180;
    var p = [OBJR[0] * Math.cos(e) * Math.cos(a), OBJR[1] * Math.sin(e), OBJR[2] * Math.cos(e) * Math.sin(a)];
    return { p: p, n: V.norm([p[0] / (OBJR[0] * OBJR[0]), p[1] / (OBJR[1] * OBJR[1]), p[2] / (OBJR[2] * OBJR[2])]) };
  }
  /* tactile-activated contacts (az: around the vertical axis, 90° = toward the viewer) */
  var GC = [
    { h: 'L', az: 152, el: -30, up: [0.6, 1, 0.3] },     // left thumb
    { h: 'L', az: 196, el: 14, up: [0.2, 1, -0.3] },     // left index
    { h: 'R', az: 34, el: -32, up: [-0.6, 1, 0.3] },     // right thumb
    { h: 'R', az: -6, el: 6, up: [-0.2, 1, 0.1] },       // right index
    { h: 'R', az: -38, el: 40, up: [-0.4, 1, -0.4] }     // right middle
  ];
  /* kinematic-only robot error per contact: dn = along surface normal (+ off / − into), dt = slide along the finger */
  var KIN2 = [{ dn: 0, dt: 0 }, { dn: 0.2, dt: 0.02, lost: true }, { dn: 0.02, dt: -0.17 }, { dn: 0, dt: 0 }, { dn: -0.1, dt: 0.03, pen: true }];

  function GraphScene(cv) { this.cv = cv; this.cycle = 9.4; this.still = 6.2; }
  GraphScene.prototype.draw = function (t) {
    var cv = this.cv, ctx = cv.ctx, W = cv.W, H = cv.H, st = cv.stacked;
    if (!W) return;
    bg(ctx, W, H);
    var k = st ? clamp(W / 420, 0.78, 1.1) : clamp(W / 1000, 0.75, 1.2);
    var tau = t % this.cycle;
    var reach = ease(seg(tau, 0.15, 1.3)) * (1 - ease(seg(tau, 8.4, 9.2)));
    var align = ease(seg(tau, 3.7, 5.4));
    var yaw = 0.55 * Math.sin(t * 2 * Math.PI / 16) - 0.08, pitch = 0.3;
    var pH = st ? { x: 0, y: 0, w: W, h: H / 2 } : { x: 0, y: 0, w: W / 2, h: H };
    var pR = st ? { x: 0, y: H / 2, w: W, h: H / 2 } : { x: W / 2, y: 0, w: W / 2, h: H };
    var acts = GC.map(function (_, i) { return ease(seg(tau, 1.2 + 0.2 * i, 1.55 + 0.2 * i)) * (1 - ease(seg(tau, 8.0, 8.5))); });

    /* contact frames (world) for one embodiment */
    function contacts(robot) {
      return GC.map(function (c, i) {
        var o = objPoint(c.az, c.el), n = o.n;
        var up = V.norm(c.up), d = V.norm(V.sub(up, V.mul(n, V.dot(up, n))));      // finger axis, tangent to the surface
        var e = robot ? KIN2[i] : { dn: 0, dt: 0 }, f = robot ? 1 - align : 0;
        var dn = e.dn * f + 0.32 * (1 - reach), p = V.add(V.add(o.p, V.mul(n, dn)), V.mul(d, e.dt * f));
        return { p: p, n: n, d: d, lost: !!(robot && e.lost && f > 0.12), pen: !!(robot && e.pen && f > 0.12) };
      });
    }
    var CH = contacts(false), CR = contacts(true);
    var a0 = align; align = 0; var CK = contacts(true); align = a0;

    /* contact graph + distance-weighted Laplacian loss */
    var edges = [];
    for (var i = 0; i < GC.length; i++) for (var j = i + 1; j < GC.length; j++)
      edges.push({ u: i, v: j, cross: GC[i].h !== GC[j].h, t0: 1.55 + 0.2 * Math.max(i, j) + 0.08 * Math.min(i, j) });
    function delta(Cs) {
      return GC.map(function (_, u) {
        var d = [0, 0, 0], ws = 1e-6;
        edges.forEach(function (e) {
          if (e.u !== u && e.v !== u) return;
          var v = e.u === u ? e.v : e.u, w = 1 / (V.len(V.sub(CH[u].p, CH[v].p)) + 0.05); ws += w;
          d = V.add(d, V.mul(V.sub(Cs[u].p, Cs[v].p), w));
        });
        return V.mul(d, 1 / ws);
      });
    }
    var dH = delta(CH), dR = delta(CR), dK = delta(CK), L = 0, LK = 1e-6;
    for (i = 0; i < GC.length; i++) { L += Math.pow(V.len(V.sub(dR[i], dH[i])), 2); LK += Math.pow(V.len(V.sub(dK[i], dH[i])), 2); }
    var loss = clamp(L / LK, 0, 1) * 0.94 + 0.02;

    function panel(p, Cs, robot) {
      var F = Math.min(p.w * 0.9, p.h) * (st ? 0.4 : 0.37), cx = p.x + p.w / 2, cy = p.y + p.h * 0.5, D = 4.2;
      var cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      function rot(v) { var x1 = v[0] * cy_ + v[2] * sy_, z1 = -v[0] * sy_ + v[2] * cy_; return [x1, v[1] * cp - z1 * sp, v[1] * sp + z1 * cp]; }
      function proj(v) { var r = rot(v), s = D / (D - r[2]); return [cx + r[0] * F * s, cy - r[1] * F * s, r[2], s]; }
      /* soft volume behind the object point cloud */
      var vg = ctx.createRadialGradient(cx - F * 0.15, cy - F * 0.25, F * 0.05, cx, cy, F * 0.95);
      vg.addColorStop(0, 'rgba(236,212,176,.10)'); vg.addColorStop(0.7, 'rgba(236,212,176,.035)'); vg.addColorStop(1, 'rgba(236,212,176,0)');
      ctx.fillStyle = vg; ctx.beginPath(); ctx.ellipse(cx, cy, F * 0.72, F * 0.92, 0, 0, 7); ctx.fill();
      var dots = [];
      /* object point cloud */
      OBJPTS.forEach(function (o) {
        var q = proj(o.p), f = rot(o.n)[2];
        dots.push({ x: q[0], y: q[1], z: q[2], r: (0.9 + 0.7 * clamp(f, 0, 1)) * k * q[3], c: [236, 212, 176], a: 0.1 + 0.32 * clamp((f + 0.3) / 1.3, 0, 1), g: 0 });
      });
      /* fingertip sensors */
      var tipS = robot ? 0.142 : 0.125, nodes = [];
      Cs.forEach(function (c, ci) {
        var ez = V.mul(c.n, -1), ey = c.d, ex = V.cross(ey, ez), pad = TIP2.pad;
        var sig = 0.55, amp = acts[ci] * (c.lost ? 0 : 1);
        TIP2.pts.forEach(function (tp) {
          var l = V.sub(tp.p, pad), w = V.add(c.p, V.mul(V.add(V.add(V.mul(ex, l[0]), V.mul(ey, l[1])), V.mul(ez, l[2])), tipS));
          var nw = V.add(V.add(V.mul(ex, tp.n[0]), V.mul(ey, tp.n[1])), V.mul(ez, tp.n[2]));
          var q = proj(w), f = rot(nw)[2];
          if (f < -0.25) return;
          var dd = V.len(V.sub(tp.p, pad)), v = amp * Math.exp(-dd * dd / (2 * sig * sig));
          var sh = 0.35 + 0.65 * clamp(f, 0, 1), col = cmap(0.08 + 0.92 * v);
          if (c.pen) col = mix(col, C.red, 0.55 * v);
          dots.push({ x: q[0], y: q[1], z: q[2], r: k * q[3] * (robot ? 1.75 : 1.6) * (0.65 + 0.35 * sh) * (1 + 0.6 * v),
            c: [col[0] * (0.55 + 0.45 * sh), col[1] * (0.55 + 0.45 * sh), col[2] * (0.55 + 0.45 * sh)], a: clamp((f + 0.25) / 0.5, 0, 1) * (0.5 + 0.5 * Math.max(sh, v)), g: v });
        });
        var q = proj(c.p); nodes.push({ x: q[0], y: q[1], z: q[2], c: c });
      });
      dots.sort(function (a, b) { return a.z - b.z; });
      ctx.globalCompositeOperation = 'lighter';
      dots.forEach(function (d) { if (d.g > 0.25) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 4.2, 0, 7); ctx.fillStyle = rgba(d.c, 0.06 * d.g); ctx.fill(); } });
      ctx.globalCompositeOperation = 'source-over';
      dots.forEach(function (d) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fillStyle = rgba(d.c, d.a); ctx.fill(); });

      /* target (human) graph ghosted on the robot panel */
      if (robot) {
        var gh = CH.map(function (c) { return proj(c.p); });
        ctx.setLineDash([2 * k, 4 * k]); ctx.lineWidth = 1 * k;
        edges.forEach(function (e) {
          var a = Math.min(acts[e.u], acts[e.v]) * 0.3 * (1 - 0.7 * align); if (a < 0.02) return;
          ctx.strokeStyle = 'rgba(236,229,217,' + a + ')'; ctx.beginPath(); ctx.moveTo(gh[e.u][0], gh[e.u][1]); ctx.lineTo(gh[e.v][0], gh[e.v][1]); ctx.stroke();
        });
        ctx.setLineDash([]);
      }
      /* graph edges: draw themselves in, glow, colour = stretch vs. the human graph */
      edges.forEach(function (e) {
        var grow = ease(seg(tau, e.t0, e.t0 + 0.55)) * (1 - ease(seg(tau, 8.0, 8.5))); if (grow < 0.01) return;
        var A = nodes[e.u], B = nodes[e.v], bx = A.x + (B.x - A.x) * grow, by = A.y + (B.y - A.y) * grow, col = C.purple;
        if (robot) {
          var lh = V.len(V.sub(CH[e.u].p, CH[e.v].p)), lr = V.len(V.sub(Cs[e.u].p, Cs[e.v].p));
          col = mix(C.purple, C.red, clamp(Math.abs(lr - lh) / lh * 5, 0, 1));
        }
        var g = ctx.createLinearGradient(A.x, A.y, bx, by);
        g.addColorStop(0, rgba(mix(col, [255, 255, 255], 0.15), 1)); g.addColorStop(1, rgba(col, 1));
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(col, e.cross ? 0.05 : 0.1); ctx.lineWidth = (e.cross ? 6 : 9) * k;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(bx, by); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = e.cross ? 0.75 : 1;
        ctx.strokeStyle = g; ctx.lineWidth = (e.cross ? 1.2 : 2.2) * k;
        if (e.cross) ctx.setLineDash([1.5 * k, 5 * k]);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      });
      /* contact nodes */
      nodes.forEach(function (n, i) {
        var a = acts[i]; if (a < 0.02) return;
        var bad = n.c.lost || n.c.pen, col = bad ? C.red : C.orange;
        var pulse = 1 + 0.8 * Math.max(0, 1 - Math.abs(tau - (1.4 + 0.2 * i)) * 2.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.arc(n.x, n.y, 12 * k * pulse, 0, 7); ctx.fillStyle = rgba(col, 0.12 * a); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 4 * k; ctx.strokeStyle = 'rgba(14,13,12,' + 0.5 * a + ')'; ctx.beginPath(); ctx.arc(n.x, n.y, 5.5 * k, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(n.x, n.y, 5.5 * k, 0, 7);
        if (n.c.lost) { ctx.fillStyle = 'rgba(14,13,12,.9)'; ctx.fill(); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = 1.8 * k; ctx.stroke(); }
        else { ctx.fillStyle = rgba(col, a); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,' + 0.55 * a + ')'; ctx.lineWidth = 1 * k; ctx.stroke(); }
        if (robot && bad) {
          var la = a * clamp(1 - align * 1.5, 0, 1);
          if (la > 0.02) {
            ctx.save(); ctx.shadowColor = 'rgba(10,9,8,.95)'; ctx.shadowBlur = 6 * k;
            ctx.font = (10.5 * k) + 'px ' + MONO; ctx.fillStyle = rgba(C.red, la);
            var left = GC[i].h === 'L', txt = n.c.lost ? 'contact lost' : 'penetration', tw = ctx.measureText(txt).width;
            var tx = left ? Math.max(p.x + 10 * k, n.x - 14 * k - tw) : Math.min(p.x + p.w - 10 * k - tw, n.x + 14 * k);
            ctx.textAlign = 'left'; ctx.fillText(txt, tx, n.y - 11 * k);
            ctx.restore(); ctx.textAlign = 'left';
          }
        }
      });
      /* hand labels */
      var la = Math.max.apply(null, acts) * 0.9;
      if (la > 0.05 && !st) {
        ctx.font = (10 * k) + 'px ' + MONO; ctx.fillStyle = rgba([236, 229, 217], 0.4 * la);
        spacedC(ctx, 'LEFT HAND', cx - F * 0.95, cy + F * 1.02, 1.4 * k);
        spacedC(ctx, 'RIGHT HAND', cx + F * 0.95, cy + F * 1.02, 1.4 * k);
      }
    }
    function spacedC(ctx, s, x, y, sp) { ctx.textAlign = 'left'; var w = 0; for (var i = 0; i < s.length; i++) w += ctx.measureText(s[i]).width + sp; spaced(ctx, s, x - w / 2, y, sp); }

    title(ctx, pH, k, 'HUMAN', 'tactile-activated contact graph');
    panel(pH, CH, false);
    title(ctx, pR, k, 'ROBOT', 'different hand · same contact graph');
    panel(pR, CR, true);

    var stLabel, stCol;
    if (tau < 1.4 || tau > 8.4) { stLabel = 'APPROACH'; stCol = [180, 172, 160]; }
    else if (tau < 3.7) { stLabel = 'KINEMATIC ONLY'; stCol = C.red; }
    else if (align < 0.97) { stLabel = '+ CONTACT GRAPH'; stCol = C.purple; }
    else { stLabel = 'GRAPH PRESERVED'; stCol = C.green; }
    pill(ctx, pR.x + pR.w - 18 * k, pR.y + 16 * k, k, stLabel, stCol, true);
    var anyA = Math.max.apply(null, acts);
    lossBar(ctx, pR.x + pR.w / 2 + 6 * k, pR.y + pR.h - 26 * k, k, 'graph', anyA > 0.05 ? loss : 0, mix(C.purple, C.green, align));

    /* legend */
    var ly = pH.y + pH.h - 22 * k, lx = pH.x + 20 * k;
    ctx.font = (11 * k) + 'px ' + MONO; ctx.fillStyle = C.faint; ctx.textAlign = 'left';
    ctx.strokeStyle = rgba(C.purple, 1); ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx, ly - 4 * k); ctx.lineTo(lx + 18 * k, ly - 4 * k); ctx.stroke();
    ctx.fillText('intra-hand', lx + 24 * k, ly);
    var x2 = lx + 24 * k + ctx.measureText('intra-hand').width + 16 * k;
    ctx.lineWidth = 1.4 * k; ctx.setLineDash([1.5 * k, 4 * k]); ctx.beginPath(); ctx.moveTo(x2, ly - 4 * k); ctx.lineTo(x2 + 18 * k, ly - 4 * k); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillText('cross-hand', x2 + 24 * k, ly);
    var x3 = x2 + 24 * k + ctx.measureText('cross-hand').width + 16 * k;
    ctx.beginPath(); ctx.arc(x3 + 5 * k, ly - 4 * k, 4.6 * k, 0, 7); ctx.fillStyle = rgba(C.orange, 1); ctx.fill();
    ctx.fillStyle = C.faint; ctx.fillText('contact', x3 + 16 * k, ly);

    if (st) { ctx.strokeStyle = 'rgba(236,229,217,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18 * k, H / 2); ctx.lineTo(W - 18 * k, H / 2); ctx.stroke(); }
  };

  /* ------------------------------------------------------------ canvas plumbing */
  function mount(el) {
    var kind = el.getAttribute('data-tr');
    var cv = { el: el, ctx: el.getContext('2d'), W: 0, H: 0, stacked: false };
    var scene = kind === 'graph' ? new GraphScene(cv) : new ContactScene(cv);
    var aspD = kind === 'graph' ? 2.1 : 2.3, aspM = kind === 'graph' ? 1.75 : 1.62;
    var t = 0, last = null, raf = 0, vis = false;
    function resize() {
      var w = el.clientWidth; if (!w) return;
      cv.stacked = w < 620; cv.W = w; cv.H = Math.round(cv.stacked ? w * aspM : w / aspD);
      el.style.height = cv.H + 'px';
      var d = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(cv.W * d); el.height = Math.round(cv.H * d); cv.ctx.setTransform(d, 0, 0, d, 0, 0);
      scene.draw(REDUCE ? scene.still : t);
    }
    function loop(now) {
      if (last !== null) t += Math.min(0.05, (now - last) / 1000);
      last = now; scene.draw(t);
      if (vis) raf = requestAnimationFrame(loop); else { raf = 0; last = null; }
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el); else window.addEventListener('resize', resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    if (REDUCE) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '80px' }).observe(el);
    } else { vis = true; raf = requestAnimationFrame(loop); }
    el.__tr = { seek: function (s) { t = s; scene.draw(t); } };   // for screenshots / debugging
  }
  function init() { Array.prototype.forEach.call(document.querySelectorAll('canvas[data-tr]'), mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
