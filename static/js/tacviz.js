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
    loss = clamp(loss, 0, 1) * 0.69 + 0.12;     // shown range ≈ 0.81 → 0.12

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
     Real 3-D scene rendered with WebGL (handgl.js): a MANO-proportioned human hand and the Wuji dexterous hand
     (meshes + joint tree from its URDF) grasp a light bulb. Grasps were solved offline: the human grasp by
     optimisation, the robot grasp by retargeting the robot fingertip pads onto the human contacts. */
  var V = {
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    mul: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    len: function (a) { return Math.hypot(a[0], a[1], a[2]); }
  };
  var BULB = { R: 0.032, gy: 0, neckY0: -0.046, neckY1: -0.0255, neckR1: 0.0196, baseR: 0.0225, baseY0: -0.094, baseY1: -0.046 };
  var GREY_LINKS = /finger1_link4|finger[2-5]_link1$/;
  var MAT = {
    skin: { col: [0.88, 0.66, 0.55], mat: [0.12, 18, 0.18, 0.6] },
    nail: { col: [0.95, 0.80, 0.76], mat: [0.5, 60, 0.15, 0.2] },
    robot: { col: [0.10, 0.48, 0.30], mat: [0.5, 60, 0.35, 0] },
    robotGrey: { col: [0.07, 0.36, 0.22], mat: [0.45, 55, 0.3, 0] },
    globe: { col: [1.0, 0.76, 0.14], mat: [0.7, 90, 0.15, 0], emis: 0.32 },
    neck: { col: [0.9, 0.91, 0.92], mat: [0.35, 40, 0.2, 0] },
    holder: { col: [0.14, 0.56, 0.82], mat: [0.55, 60, 0.3, 0] },
    band: { col: [0.06, 0.3, 0.45], mat: [0.3, 30, 0.2, 0] }
  };
  var CAM = window.__CAM || { tgt: [-0.05, 0.03, 0.01], d: 0.6, dm: 0.6, el: 0.42, az: -1.75 };
  var GL = { r: null, human: null, robot: null, bulb: null, failed: false, req: false };
  function glInit() {
    if (GL.req || !window.HandGL) return; GL.req = true;
    try { GL.r = new HandGL.Renderer(); if (!GL.r.gl) throw 0; } catch (e) { GL.failed = true; return; }
    GL.bulb = HandGL.bulbParts(BULB);
    var base = (document.querySelector('script[src*="tacviz.js"]') || {}).src || '';
    var dir = base ? base.replace(/js\/tacviz\.js.*$/, 'data/') : 'static/data/';
    HandGL.load(dir + 'hand_human.json?v=3').then(function (m) { GL.human = m; });
    HandGL.load(dir + 'hand_wuji.json?v=3').then(function (m) { GL.robot = m; });
  }
  function lerpQ(a, b, t) { var o = {}; for (var n in a) o[n] = a[n] + ((b[n] == null ? a[n] : b[n]) - a[n]) * t; return o; }
  function scaleQ(a, s, lim) { var o = {}; for (var n in a) o[n] = a[n] * s; return o; }
  function toM(B) { var m = new Float32Array(16); for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) m[c * 4 + r] = B[r][c]; return m; }
  function shiftM(M, d) { var o = new Float32Array(M); o[12] += d[0]; o[13] += d[1]; o[14] += d[2]; return o; }
  function lerpM(A, B, t) { var o = new Float32Array(16); for (var i = 0; i < 16; i++) o[i] = A[i] + (B[i] - A[i]) * t; return o; }

  /* drag-to-orbit: horizontal drag = azimuth, vertical drag = elevation (both panels stay in sync).
     Auto-rotation pauses while dragging and resumes ~2 s after release, from the current angle. */
  var ORBIT_RATE = 0.45 * 2 * Math.PI / 18;          // rad/s of the automatic orbit
  function GraphScene(cv) {
    this.cv = cv; this.cycle = 9.4; this.still = 6.2; glInit();
    var o = this.orbit = { yaw: 0, pitch: 0, used: false, drag: false, release: -1e9, prevT: null, x: 0, y: 0, now: 0 };
    var el = cv.el; el.style.cursor = 'grab'; el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return; o.drag = true; o.used = true; o.x = e.clientX; o.y = e.clientY; o.hint = 0;
      try { el.setPointerCapture(e.pointerId); } catch (err) {} el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', function (e) {
      if (!o.drag) return;
      var dx = e.clientX - o.x, dy = e.clientY - o.y; o.x = e.clientX; o.y = e.clientY;
      o.yaw -= dx * 0.009;
      if (e.pointerType !== 'touch') o.pitch = clamp(o.pitch + dy * 0.006, -0.38, 0.75);
    });
    function up(e) { if (!o.drag) return; o.drag = false; o.release = o.now; el.style.cursor = 'grab'; try { el.releasePointerCapture(e.pointerId); } catch (err) {} }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
  GraphScene.prototype.draw = function (t) {
    var cv = this.cv, ctx = cv.ctx, W = cv.W, H = cv.H, st = cv.stacked;
    if (!W) return;
    glInit();
    bg(ctx, W, H);
    var k = st ? clamp(W / 420, 0.78, 1.1) : clamp(W / 1000, 0.75, 1.2);
    var tau = t % this.cycle;
    var reach = ease(seg(tau, 0.15, 1.3)) * (1 - ease(seg(tau, 8.4, 9.2)));
    var align = ease(seg(tau, 3.7, 5.4));
    var pH = st ? { x: 0, y: 0, w: W, h: H / 2 } : { x: 0, y: 0, w: W / 2, h: H };
    var pR = st ? { x: 0, y: H / 2, w: W, h: H / 2 } : { x: W / 2, y: 0, w: W / 2, h: H };
    var ready = GL.human && GL.robot && GL.r;
    var NT = 4;
    var acts = [0, 1, 2, 3].map(function (i) { return ease(seg(tau, 1.2 + 0.2 * i, 1.55 + 0.2 * i)) * (1 - ease(seg(tau, 8.0, 8.5))); });

    /* poses */
    function pose(m, robot, alignT) {
      var g = m.extra.grasp, Bg = toM(g.base), q = g.q;
      if (robot) {
        var kq = m.extra.kin.q, kB = toM(m.extra.kin.base);
        q = lerpQ(kq, g.q, alignT); Bg = lerpM(kB, Bg, alignT);
      }
      /* collision-free approach (checked offline): hand descends from 10 cm above while the fingers close late */
      var open = scaleQ(g.q, 0.6);
      var qq = lerpQ(open, q, reach * reach), lift = (1 - reach);
      var B = shiftM(Bg, [0, 0.1 * lift, 0]);
      return { W: m.fk(qq, B), q: qq, blend: reach * reach };
    }
    function pads(m, Wl) {
      return m.extra.tips.map(function (tn) {
        var M = Wl[tn], P = m.extra.pads[tn];
        return { p: HandGL.M4.xf(M, P.p), n: HandGL.M4.xv(M, P.n) };
      });
    }
    var sH, sR, sK, CH, CR, CK;
    if (ready) {
      sH = pose(GL.human, false, 1); sR = pose(GL.robot, true, align);
      var a0 = reach; reach = 1; sK = pose(GL.robot, true, 0); reach = a0;
      CH = pads(GL.human, sH.W); CR = pads(GL.robot, sR.W); CK = pads(GL.robot, sK.W);
    }
    function gap(c) { return V.len(V.sub(c.p, [0, BULB.gy, 0])) - BULB.R; }

    /* contact graph over the four contacting pads + distance-weighted Laplacian loss (Eq. graph) */
    var edges = [];
    for (var i = 0; i < NT; i++) for (var j = i + 1; j < NT; j++) edges.push({ u: i, v: j, t0: 1.55 + 0.2 * j + 0.08 * i });
    var loss = 0;
    if (ready) {
      var delta = function (Cs) {
        return [0, 1, 2, 3].map(function (u) {
          var d = [0, 0, 0], ws = 1e-9;
          edges.forEach(function (e) {
            if (e.u !== u && e.v !== u) return;
            var v = e.u === u ? e.v : e.u, w = 1 / (V.len(V.sub(CH[u].p, CH[v].p)) + 0.004); ws += w;
            d = V.add(d, V.mul(V.sub(Cs[u].p, Cs[v].p), w));
          });
          return V.mul(d, 1 / ws);
        });
      };
      var dH = delta(CH), dR = delta(CR), dK = delta(CK), L = 0, LK = 1e-12;
      for (i = 0; i < NT; i++) { L += Math.pow(V.len(V.sub(dR[i], dH[i])), 2); LK += Math.pow(V.len(V.sub(dK[i], dH[i])), 2); }
      loss = clamp(L / LK, 0, 1) * 0.95 + 0.03;
    }

    var O = this.orbit, dt = O.prevT == null ? 0 : clamp(t - O.prevT, 0, 0.1); O.prevT = t; O.now = t;
    if (!O.used) O.yaw = t * ORBIT_RATE;                       // untouched: same deterministic 360° orbit as before
    else if (!O.drag) O.yaw += ORBIT_RATE * dt * ease(seg(t - O.release, 2.0, 2.8));   // resume ~2 s after release, easing in
    var yaw = O.yaw, pitchOff = O.pitch;
    function panel(p, m, S, Cs, robot) {
      var M4 = HandGL.M4, asp = p.w / p.h;
      var tgt = CAM.tgt, dist = st ? CAM.dm : CAM.d, el = clamp(CAM.el + pitchOff, 0.04, 1.35), az = CAM.az + yaw;
      var eye = [tgt[0] + dist * Math.cos(el) * Math.sin(az), tgt[1] + dist * Math.sin(el), tgt[2] + dist * Math.cos(el) * Math.cos(az)];
      var proj = M4.persp(0.5, asp, 0.05, 2), view = M4.lookAt(eye, tgt, [0, 1, 0]), VP = M4.mul(proj, view);
      function toPx(w) {
        var x = VP[0] * w[0] + VP[4] * w[1] + VP[8] * w[2] + VP[12], y = VP[1] * w[0] + VP[5] * w[1] + VP[9] * w[2] + VP[13], ww = VP[3] * w[0] + VP[7] * w[1] + VP[11] * w[2] + VP[15];
        return [p.x + (x / ww + 1) / 2 * p.w, p.y + (1 - y / ww) / 2 * p.h, ww];
      }
      /* warm glow of the bulb (2-D, behind the WebGL layer) */
      var gq = toPx([0, BULB.gy, 0]), gR = BULB.R * proj[5] * p.h / 2 / gq[2];
      var gl2 = ctx.createRadialGradient(gq[0], gq[1], gR * 0.5, gq[0], gq[1], gR * 3.2);
      gl2.addColorStop(0, 'rgba(255,190,60,.22)'); gl2.addColorStop(1, 'rgba(255,190,60,0)');
      ctx.fillStyle = gl2; ctx.fillRect(p.x, p.y, p.w, p.h);
      if (!ready) return null;
      var draws = [], Id = M4.id(), B = GL.bulb;
      draws.push({ mesh: B.holder, M: Id, col: MAT.holder.col, mat: MAT.holder.mat });
      draws.push({ mesh: B.band, M: Id, col: MAT.band.col, mat: MAT.band.mat });
      draws.push({ mesh: B.neck, M: Id, col: MAT.neck.col, mat: MAT.neck.mat });
      draws.push({ mesh: B.globe, M: Id, col: MAT.globe.col, mat: MAT.globe.mat, emis: MAT.globe.emis });
      if (m.skin) {
        draws.push({ mesh: m.skinned(S.W, S.blend), M: Id, col: MAT.skin.col, mat: MAT.skin.mat });
        Object.keys(m.nails).forEach(function (n) { if (S.W[n]) draws.push({ mesh: m.nails[n], M: S.W[n], col: MAT.nail.col, mat: MAT.nail.mat }); });
      }
      Object.keys(m.links).forEach(function (n) {
        var Mw = S.W[n]; if (!Mw) return;
        var mt = robot ? (GREY_LINKS.test(n) ? MAT.robotGrey : MAT.robot) : MAT.skin;
        draws.push({ mesh: m.links[n], M: Mw, col: mt.col, mat: mt.mat });
      });
      /* taxels on every fingertip pad (response = Gaussian around the pad centre, gated by contact) */
      var pts = [], dpts = [], glow = [], tx = m.extra.taxels;
      m.extra.tips.forEach(function (tn, ti) {
        var Mw = S.W[tn], T = tx[tn], c = Cs[ti];
        var g = ti < NT ? gap(c) : 1, on = ti < NT && g < 0.003, pen = robot && g < -0.004;
        var amp = on ? acts[ti] : 0;
        for (var q = 0; q < T.p.length; q++) {
          var lp = T.p[q], w = M4.xf(Mw, lp), dx = lp[0] - T.pad[0], dy = lp[1] - T.pad[1], dz = lp[2] - T.pad[2];
          var v = amp * Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * 0.0055 * 0.0055));
          var col = cmap(0.1 + 0.9 * v); if (pen) col = mix(col, C.red, 0.6 * v);
          (amp > 0.02 ? pts : dpts).push(w[0], w[1], w[2], col[0] / 255, col[1] / 255, col[2] / 255, amp > 0.02 ? 0.35 + 0.65 * Math.min(1, v * 2 + 0.25) : 0.85, robot ? 0.0017 : 0.0016);
          if (v > 0.3) glow.push(w[0], w[1], w[2], col[0] / 255 * 0.5, col[1] / 255 * 0.5, col[2] / 255 * 0.5, v, 0.0075);
        }
      });
      var key = [-0.55, 1.0, 0.75];
      var img = GL.r.render({ xray: true, occl: draws.slice(0, 4), w: p.w, h: p.h, dpr: Math.min(window.devicePixelRatio || 1, 2), VP: VP, proj5: proj[5], eye: eye, key: key, bulbPos: [0, BULB.gy, 0], draws: draws,
        dpts: { data: new Float32Array(dpts), n: dpts.length / 8 }, pts: { data: new Float32Array(pts), n: pts.length / 8 }, glow: { data: new Float32Array(glow), n: glow.length / 8 } });
      if (img) ctx.drawImage(img, p.x, p.y, p.w, p.h);
      return Cs.slice(0, NT).map(function (c) { var q = toPx(c.p); return { x: q[0], y: q[1], c: c }; });
    }
    function overlay(p, nodes, Cs, robot, gh) {
      if (!nodes) return;
      if (robot && gh) {                                   // target (human) graph, ghosted
        ctx.setLineDash([2 * k, 4 * k]); ctx.lineWidth = 1 * k;
        edges.forEach(function (e) {
          var a = Math.min(acts[e.u], acts[e.v]) * 0.32 * (1 - 0.7 * align); if (a < 0.02) return;
          ctx.strokeStyle = 'rgba(236,229,217,' + a + ')'; ctx.beginPath(); ctx.moveTo(gh[e.u].x, gh[e.u].y); ctx.lineTo(gh[e.v].x, gh[e.v].y); ctx.stroke();
        });
        ctx.setLineDash([]);
      }
      edges.forEach(function (e) {
        var grow = ease(seg(tau, e.t0, e.t0 + 0.55)) * (1 - ease(seg(tau, 8.0, 8.5))); if (grow < 0.01) return;
        var A = nodes[e.u], B = nodes[e.v], bx = A.x + (B.x - A.x) * grow, by = A.y + (B.y - A.y) * grow, col = C.purple;
        if (robot) {
          var lh = V.len(V.sub(CH[e.u].p, CH[e.v].p)), lr = V.len(V.sub(Cs[e.u].p, Cs[e.v].p));
          col = mix(C.purple, C.red, clamp(Math.abs(lr - lh) / lh * 5, 0, 1));
        }
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(col, 0.12); ctx.lineWidth = 8 * k; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(bx, by); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = rgba(mix(col, [255, 255, 255], 0.1), 0.95); ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(bx, by); ctx.stroke();
      });
      nodes.forEach(function (n, i) {
        var a = acts[i]; if (a < 0.02) return;
        var g = gap(n.c), lost = robot && g > 0.003, pen = robot && g < -0.004, bad = lost || pen, col = bad ? C.red : C.orange;
        var pulse = 1 + 0.8 * Math.max(0, 1 - Math.abs(tau - (1.4 + 0.2 * i)) * 2.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.arc(n.x, n.y, 12 * k * pulse, 0, 7); ctx.fillStyle = rgba(col, 0.13 * a); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 4 * k; ctx.strokeStyle = 'rgba(14,13,12,' + 0.5 * a + ')'; ctx.beginPath(); ctx.arc(n.x, n.y, 5.5 * k, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(n.x, n.y, 5.5 * k, 0, 7);
        if (lost) { ctx.fillStyle = 'rgba(14,13,12,.9)'; ctx.fill(); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = 1.8 * k; ctx.stroke(); }
        else { ctx.fillStyle = rgba(col, a); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,' + 0.55 * a + ')'; ctx.lineWidth = 1 * k; ctx.stroke(); }
        if (bad) {
          var la = a * clamp(1 - align * 1.5, 0, 1);
          if (la > 0.02) {
            ctx.font = (10.5 * k) + 'px ' + MONO;
            var txt = lost ? 'contact lost' : 'penetration', tw = ctx.measureText(txt).width;
            var left = n.x < p.x + p.w / 2, tx = clamp(left ? n.x - 16 * k - tw : n.x + 16 * k, p.x + 12 * k, p.x + p.w - 12 * k - tw), ty = n.y + 4 * k;
            ctx.beginPath(); rr(ctx, tx - 6 * k, ty - 12 * k, tw + 12 * k, 17 * k, 8.5 * k);
            ctx.fillStyle = 'rgba(16,14,13,' + 0.82 * la + ')'; ctx.fill(); ctx.strokeStyle = rgba(C.red, 0.45 * la); ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = rgba(C.red, la); ctx.textAlign = 'left'; ctx.fillText(txt, tx, ty);
          }
        }
      });
    }

    var nH = panel(pH, GL.human, sH, CH, false);
    var nR = panel(pR, GL.robot, sR, CR, true);
    var ghost = null;
    if (ready) {       // human contact graph projected into the robot panel's camera (same world frame)
      ghost = CH.slice(0, NT).map(function (c, i) { var o = nR[i]; return o; });
      var M4 = HandGL.M4, asp = pR.w / pR.h, tgt = CAM.tgt, dist = st ? CAM.dm : CAM.d, el = clamp(CAM.el + pitchOff, 0.04, 1.35), az = CAM.az + yaw;
      var eye = [tgt[0] + dist * Math.cos(el) * Math.sin(az), tgt[1] + dist * Math.sin(el), tgt[2] + dist * Math.cos(el) * Math.cos(az)];
      var VP = M4.mul(M4.persp(0.5, asp, 0.05, 2), M4.lookAt(eye, tgt, [0, 1, 0]));
      ghost = CH.slice(0, NT).map(function (c) {
        var w = c.p, x = VP[0] * w[0] + VP[4] * w[1] + VP[8] * w[2] + VP[12], y = VP[1] * w[0] + VP[5] * w[1] + VP[9] * w[2] + VP[13], ww = VP[3] * w[0] + VP[7] * w[1] + VP[11] * w[2] + VP[15];
        return { x: pR.x + (x / ww + 1) / 2 * pR.w, y: pR.y + (1 - y / ww) / 2 * pR.h };
      });
    }
    overlay(pH, nH, CH, false, null);
    overlay(pR, nR, CR, true, ghost);

    title(ctx, pH, k, 'HUMAN', 'MANO hand · tactile-activated contact graph');
    title(ctx, pR, k, 'ROBOT', 'Wuji hand · same contact graph');
    /* drag hint */
    var ha = O.drag ? 0.25 : 0.55;
    ctx.save(); ctx.font = (10.5 * k) + 'px ' + MONO; ctx.fillStyle = 'rgba(236,229,217,' + ha + ')';
    var hint = '\u21bb drag to rotate', hw = ctx.measureText(hint).width;
    if (!st) { ctx.textAlign = 'center'; ctx.fillText(hint, W / 2, H - 22 * k); }
    else { ctx.textAlign = 'right'; ctx.fillText(hint, pH.x + pH.w - 18 * k, pH.y + 28 * k); }
    ctx.restore();
    if (!ready) {
      ctx.font = (11 * k) + 'px ' + MONO; ctx.fillStyle = C.faint; ctx.textAlign = 'center';
      ctx.fillText(GL.failed ? 'WebGL unavailable' : 'loading hand models…', W / 2, H / 2); ctx.textAlign = 'left';
    }

    var stLabel, stCol;
    if (tau < 1.4 || tau > 8.4) { stLabel = 'APPROACH'; stCol = [180, 172, 160]; }
    else if (tau < 3.7) { stLabel = 'KINEMATIC ONLY'; stCol = C.red; }
    else if (align < 0.97) { stLabel = '+ CONTACT GRAPH'; stCol = C.purple; }
    else { stLabel = 'GRAPH PRESERVED'; stCol = C.green; }
    pill(ctx, pR.x + pR.w - 18 * k, pR.y + 16 * k, k, stLabel, stCol, true);
    var anyA = Math.max.apply(null, acts);
    lossBar(ctx, pR.x + pR.w / 2 + 6 * k, pR.y + pR.h - 26 * k, k, 'graph', anyA > 0.05 && ready ? loss : 0, mix(C.purple, C.green, align));

    var ly = pH.y + pH.h - 22 * k, lx = pH.x + 20 * k;
    ctx.font = (11 * k) + 'px ' + MONO; ctx.fillStyle = C.faint; ctx.textAlign = 'left';
    ctx.strokeStyle = rgba(C.purple, 1); ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx, ly - 4 * k); ctx.lineTo(lx + 18 * k, ly - 4 * k); ctx.stroke();
    ctx.fillText('contact-graph edge', lx + 24 * k, ly);
    var x3 = lx + 24 * k + ctx.measureText('contact-graph edge').width + 16 * k;
    ctx.beginPath(); ctx.arc(x3 + 5 * k, ly - 4 * k, 4.6 * k, 0, 7); ctx.fillStyle = rgba(C.orange, 1); ctx.fill();
    ctx.fillStyle = C.faint; ctx.fillText('contact', x3 + 16 * k, ly);

    if (st) { ctx.strokeStyle = 'rgba(236,229,217,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18 * k, H / 2); ctx.lineTo(W - 18 * k, H / 2); ctx.stroke(); }
  };

  /* ============================================================ 3. Contact preservation: 4 tasks x 4 methods
     Objects are the SAM-3D task meshes, the hand is the Wuji URDF model. All four methods start from the same lifted
     hand pose, reach for the object, end at their own retargeting result, then lift back. Ring markers only on the
     fingers that fail (red) or, for correct results, on the contacting fingers (green). */
  var CMP = { data: null, req: false, objs: {} };
  var METHODS = [
    { key: 'ours', name: 'Tac-Retarget (Ours)' },
    { key: 'nocontact', name: 'Kinematic only' },
    { key: 'dexpilot', name: 'DexPilot' },
    { key: 'unidex', name: 'UniDex' }
  ];
  var TASKS = ['book', 'bulb', 'ketchup', 'eggroll'];
  var CMPVIEW = { book: [0, 0], bulb: [0, 0], ketchup: [0, 0], eggroll: [0, 0] };   // per-task camera offsets [azimuth, elevation] in degrees
  var VERDICT = {
    ours: { book: 'Correct', bulb: 'Correct', ketchup: 'Correct', eggroll: 'Correct' },
    nocontact: { book: 'No Contact', bulb: 'No Contact', ketchup: 'No Contact', eggroll: 'No Contact' },
    dexpilot: { book: 'Penetration', bulb: 'Misplaced', ketchup: 'Penetration', eggroll: 'Correct' },
    unidex: { book: 'Penetration', bulb: 'Penetration', ketchup: 'Penetration', eggroll: 'Penetration' }
  };
  function b64a(s, C) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new C(u.buffer); }
  function cmpInit() {
    glInit(); if (CMP.req) return; CMP.req = true;
    var base = (document.querySelector('script[src*="tacviz.js"]') || {}).src || '';
    var dir = base ? base.replace(/js\/tacviz\.js.*$/, 'data/') : 'static/data/';
    fetch(dir + 'retarget_compare.json?v=4').then(function (r) { return r.json(); }).then(function (j) {
      TASKS.forEach(function (t) {
        var o = j.tasks[t].obj, p = b64a(o.p, Int16Array), n = b64a(o.n, Int8Array), pos = new Float32Array(p.length), nrm = new Float32Array(n.length);
        for (var i = 0; i < p.length; i++) { pos[i] = p[i] / 1e4; nrm[i] = n[i] / 127; }
        CMP.objs[t] = { pos: pos, nrm: nrm, idx: b64a(o.i, o.i32 ? Uint32Array : Uint16Array), col: b64a(o.c, Uint8Array) };
      });
      CMP.data = j;
    });
  }
  function interpM(A, B, s) {        // lerp translation, lerp+orthonormalise rotation (row-major 4x4 arrays)
    var o = M4id(), r, c, R = [];
    for (r = 0; r < 3; r++) { R.push([]); for (c = 0; c < 3; c++) R[r].push(A[r][c] + (B[r][c] - A[r][c]) * s); }
    var x = [R[0][0], R[1][0], R[2][0]], y = [R[0][1], R[1][1], R[2][1]];
    var nx = Math.hypot(x[0], x[1], x[2]); x = [x[0] / nx, x[1] / nx, x[2] / nx];
    var d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2]; y = [y[0] - d * x[0], y[1] - d * x[1], y[2] - d * x[2]];
    var ny = Math.hypot(y[0], y[1], y[2]); y = [y[0] / ny, y[1] / ny, y[2] / ny];
    var z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
    for (r = 0; r < 3; r++) { o[r] = x[r]; o[4 + r] = y[r]; o[8 + r] = z[r]; o[12 + r] = A[r][3] + (B[r][3] - A[r][3]) * s; }
    return o;
  }
  function M4id() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function CompareScene(cv) { this.cv = cv; this.cycle = 7.6; this.still = 4; cmpInit(); }
  CompareScene.prototype.draw = function (t) {
    var cv = this.cv, ctx = cv.ctx, W = cv.W, H = cv.H, st = cv.stacked;
    if (!W) return;
    cmpInit(); bg(ctx, W, H);
    var k = st ? clamp(W / 420, 0.72, 1.0) : clamp(W / 1000, 0.72, 1.1);
    var tau = t % this.cycle;
    var go = ease(seg(tau, 0.7, 2.3)) * (1 - ease(seg(tau, 6.4, 7.4)));
    var show = ease(seg(tau, 2.4, 2.8)) * (1 - ease(seg(tau, 6.1, 6.4)));
    var ready = GL.robot && GL.r && CMP.data, m = GL.robot, M4 = window.HandGL && HandGL.M4;
    var sway = 0.32 * Math.sin(t * 2 * Math.PI / 16);
    /* layout */
    var cells = [], lab = st ? 0 : 118 * k, head = 30 * k;
    if (!st) {
      var cw = (W - lab) / 4, ch = (H - head) / 4;
      ctx.font = '600 ' + (11.5 * k) + 'px ' + MONO; ctx.textAlign = 'center';
      TASKS.forEach(function (tk, c) { ctx.fillStyle = C.text; ctx.fillText(CMP.data ? CMP.data.tasks[tk].label : '', lab + cw * (c + 0.5), 20 * k); });
      METHODS.forEach(function (me, r) {
        var y = head + ch * (r + 0.5); ctx.fillStyle = r === 0 ? rgba(C.orange, 1) : C.text; ctx.textAlign = 'center';
        var parts = me.name === 'Tac-Retarget (Ours)' ? ['Tac-Retarget', '(Ours)'] : me.name === 'Kinematic only' ? ['Kinematic', 'only'] : [me.name];
        parts.forEach(function (s, i) { ctx.fillText(s, lab / 2, y + (i - (parts.length - 1) / 2) * 15 * k + 4 * k); });
        TASKS.forEach(function (tk, c) { cells.push({ me: me, r: r, task: tk, x: lab + cw * c, y: head + ch * r, w: cw, h: ch }); });
      });
    } else {
      var bh = H / 4, cw2 = W / 2, th = 24 * k;
      TASKS.forEach(function (tk, b) {
        ctx.font = '600 ' + (12 * k) + 'px ' + MONO; ctx.textAlign = 'left'; ctx.fillStyle = C.text;
        ctx.fillText(CMP.data ? CMP.data.tasks[tk].label : '', 12 * k, bh * b + 17 * k);
        METHODS.forEach(function (me, r) { cells.push({ me: me, r: r, task: tk, x: cw2 * (r % 2), y: bh * b + th + (bh - th) / 2 * Math.floor(r / 2), w: cw2, h: (bh - th) / 2, small: true }); });
      });
    }
    ctx.textAlign = 'left';
    var dprC = Math.min(window.devicePixelRatio || 1, 2), overlays = [];
    if (ready) GL.r.begin(W, H, dprC);
    cells.forEach(function (cl) {
      var pad = 4 * k, ok = VERDICT[cl.me.key][cl.task] === 'Correct', ours = cl.r === 0;
      ctx.beginPath(); rr(ctx, cl.x + pad, cl.y + pad, cl.w - 2 * pad, cl.h - 2 * pad, 10 * k);
      ctx.fillStyle = ours ? 'rgba(251,141,51,.06)' : 'rgba(255,255,255,.022)'; ctx.fill();
      ctx.strokeStyle = ours ? 'rgba(251,141,51,.5)' : 'rgba(236,229,217,.07)'; ctx.lineWidth = 1; ctx.stroke();
      if (cl.small) { ctx.font = '600 ' + (10 * k) + 'px ' + MONO; ctx.fillStyle = ours ? rgba(C.orange, 1) : C.faint; ctx.fillText(cl.me.name, cl.x + pad + 8 * k, cl.y + pad + 15 * k); }
      if (!ready) return;
      var T = CMP.data.tasks[cl.task], R = T.methods[cl.me.key], S0 = T.start;
      var B = interpM(S0.base, R.base, go), q = {};
      for (var n in R.q) q[n] = S0.q[n] + (R.q[n] - S0.q[n]) * (go * go);
      var Wl = m.fk(q, B);
      var vp = { x: cl.x + pad, y: cl.y + pad + (cl.small ? 16 * k : 2 * k), w: cl.w - 2 * pad, h: cl.h - 2 * pad - (cl.small ? 16 * k : 2 * k) - 24 * k };
      var VO = (window.__CMPOFF || CMPVIEW)[cl.task] || [0, 0], dist = T.dist || 0.4, el = ((T.view ? T.view[1] : 10) + VO[1]) * Math.PI / 180 + 0.12, az = ((T.view ? T.view[0] : 0) + VO[0]) * Math.PI / 180 + sway;
      var tgt = [0, 0, 0], eye = [dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az)];
      var proj = M4.persp(0.5, vp.w / vp.h, 0.03, 3), VP = M4.mul(proj, M4.lookAt(eye, tgt, [0, 1, 0]));
      function toPx(w) {
        var x = VP[0] * w[0] + VP[4] * w[1] + VP[8] * w[2] + VP[12], y = VP[1] * w[0] + VP[5] * w[1] + VP[9] * w[2] + VP[13], ww = VP[3] * w[0] + VP[7] * w[1] + VP[11] * w[2] + VP[15];
        return [vp.x + (x / ww + 1) / 2 * vp.w, vp.y + (1 - y / ww) / 2 * vp.h];
      }
      var Id = M4.id(), draws = [{ mesh: CMP.objs[cl.task], M: Id, col: [1, 1, 1], mat: [0.18, 30, 0.12, 0] }];
      Object.keys(m.links).forEach(function (n) {
        var Mw = Wl[n]; if (!Mw) return; var mt = GREY_LINKS.test(n) ? MAT.robotGrey : MAT.robot;
        draws.push({ mesh: m.links[n], M: Mw, col: mt.col, mat: mt.mat });
      });
      var verdict = VERDICT[cl.me.key][cl.task], bad = R.bad, pts = [], dpts = [], glow = [], marks = [];
      m.extra.tips.forEach(function (tn, ti) {
        var Mw = Wl[tn], TX = m.extra.taxels[tn], pd = m.extra.pads[tn], pw3 = M4.xf(Mw, pd.p);
        var isC = T.contact.indexOf(ti) >= 0, isBad = bad.indexOf(ti) >= 0;
        var lit = isC && !(isBad && verdict === 'No Contact'), pen = isBad && verdict === 'Penetration';
        if (isBad) marks.push({ p: toPx(pw3), bad: true }); else if (ok && isC) marks.push({ p: toPx(pw3), bad: false });
        var amp = lit ? go * go : 0;
        for (var qq = 0; qq < TX.p.length; qq++) {
          var lp = TX.p[qq], w = M4.xf(Mw, lp), dx = lp[0] - TX.pad[0], dy = lp[1] - TX.pad[1], dz = lp[2] - TX.pad[2];
          var v = amp * Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * 0.0055 * 0.0055));
          var col = cmap(0.1 + 0.9 * v); if (pen) col = mix(col, C.red, 0.65 * v);
          (amp > 0 ? pts : dpts).push(w[0], w[1], w[2], col[0] / 255, col[1] / 255, col[2] / 255, amp > 0 ? 0.35 + 0.65 * Math.min(1, v * 2 + 0.25) : 0.85, 0.0017);
          if (v > 0.3) glow.push(w[0], w[1], w[2], col[0] / 255 * 0.5, col[1] / 255 * 0.5, col[2] / 255 * 0.5, v, 0.0075);
        }
      });
      GL.r.render({ region: vp, xray: true, occl: draws.slice(0, 1), w: vp.w, h: vp.h, dpr: dprC, VP: VP, proj5: proj[5], eye: eye,
        key: [-0.4, 1.0, 0.8], bulbPos: [0, 0.3, 0.4], draws: draws, dpts: { data: new Float32Array(dpts), n: dpts.length / 8 },
        pts: { data: new Float32Array(pts), n: pts.length / 8 }, glow: { data: new Float32Array(glow), n: glow.length / 8 } });
      overlays.push(function () {
      ctx.save(); ctx.beginPath(); rr(ctx, cl.x + pad, cl.y + pad, cl.w - 2 * pad, cl.h - 2 * pad, 10 * k); ctx.clip();
      if (show > 0.02) {
        if (verdict === 'Misplaced' && T.target) T.target.forEach(function (tw) {
          var a = toPx(tw); ctx.setLineDash([2 * k, 3 * k]); ctx.strokeStyle = 'rgba(236,229,217,' + 0.8 * show + ')'; ctx.lineWidth = 1.2 * k;
          ctx.beginPath(); ctx.arc(a[0], a[1], 5.5 * k, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        });
        marks.forEach(function (mk) {
          var col = mk.bad ? C.red : C.green;
          ctx.lineWidth = 4 * k; ctx.strokeStyle = 'rgba(14,13,12,' + 0.35 * show + ')'; var rr0 = cl.small ? 0.62 : 1; ctx.beginPath(); ctx.arc(mk.p[0], mk.p[1], 10 * k * rr0, 0, 7); ctx.stroke();
          ctx.lineWidth = 2.2 * k * rr0; ctx.strokeStyle = rgba(col, show); ctx.beginPath(); ctx.arc(mk.p[0], mk.p[1], 8 * k * rr0, 0, 7); ctx.stroke();
        });
      }
      ctx.restore();
      var a2 = 0.3 + 0.7 * show, vy = cl.y + cl.h - pad - 13 * k, colv = ok ? C.green : C.red;
      ctx.font = '600 ' + (10.5 * k) + 'px ' + MONO; var label = (ok ? '✓ ' : '✕ ') + verdict, tw2 = ctx.measureText(label).width;
      ctx.beginPath(); rr(ctx, cl.x + cl.w / 2 - tw2 / 2 - 8 * k, vy - 12 * k, tw2 + 16 * k, 19 * k, 9.5 * k);
      ctx.fillStyle = rgba(colv, 0.12 * a2); ctx.fill(); ctx.strokeStyle = rgba(colv, 0.5 * a2); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = rgba(colv, a2); ctx.textAlign = 'center'; ctx.fillText(label, cl.x + cl.w / 2, vy + 1 * k); ctx.textAlign = 'left';
      });
    });
    if (ready) { ctx.drawImage(GL.r.cv, 0, 0, W, H); overlays.forEach(function (f) { f(); }); }
    if (!ready) {
      ctx.font = (11 * k) + 'px ' + MONO; ctx.fillStyle = C.faint; ctx.textAlign = 'center';
      ctx.fillText(GL.failed ? 'WebGL unavailable' : 'loading hand and object models…', W / 2, H / 2); ctx.textAlign = 'left';
    }
  };

  /* ------------------------------------------------------------ canvas plumbing */
  function mount(el) {
    var kind = el.getAttribute('data-tr');
    var cv = { el: el, ctx: el.getContext('2d'), W: 0, H: 0, stacked: false };
    var scene = kind === 'graph' ? new GraphScene(cv) : kind === 'compare' ? new CompareScene(cv) : new ContactScene(cv);
    var aspD = kind === 'graph' ? 2.1 : kind === 'compare' ? 1.32 : 2.3, aspM = kind === 'graph' ? 1.75 : kind === 'compare' ? 2.6 : 1.62;
    var t = 0, last = null, raf = 0, vis = false, frozen = false;
    function resize() {
      var w = el.clientWidth; if (!w) return;
      cv.stacked = w < 620; cv.W = w; cv.H = Math.round(cv.stacked ? w * aspM : w / aspD);
      el.style.height = cv.H + 'px';
      var d = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(cv.W * d); el.height = Math.round(cv.H * d); cv.ctx.setTransform(d, 0, 0, d, 0, 0);
      scene.draw(REDUCE ? scene.still : t);
    }
    function loop(now) {
      if (last !== null && !frozen) t += Math.min(0.05, (now - last) / 1000);
      last = now; if (!frozen) scene.draw(t);
      if (vis) raf = requestAnimationFrame(loop); else { raf = 0; last = null; }
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el); else window.addEventListener('resize', resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    if (REDUCE) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '80px' }).observe(el);
    } else { vis = true; raf = requestAnimationFrame(loop); }
    el.__tr = { seek: function (s) { t = s; frozen = true; scene.draw(t); } };   // for screenshots / debugging
  }
  function init() { Array.prototype.forEach.call(document.querySelectorAll('canvas[data-tr]'), mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
