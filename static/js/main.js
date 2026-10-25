// Render LaTeX blocks: <div class="math" data-tex="..."></div>
document.addEventListener("DOMContentLoaded", function () {
  if (window.katex) {
    document.querySelectorAll(".math[data-tex]").forEach(function (el) {
      try { katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: false }); }
      catch (e) { el.textContent = el.dataset.tex; }
    });
  }

  // Top navigation: highlight the section currently in view; "Menu" dropdown on phones
  var toc = document.getElementById("toc"), bar = document.getElementById("topbar");
  if (!toc || !bar) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  var toggle = bar.querySelector(".nav-toggle"), cur = bar.querySelector(".nav-toggle .cur");
  function onScroll() {
    var current = -1, line = Math.min(window.innerHeight * 0.35, 260);
    sections.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < line) current = i; });
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 2) current = sections.length - 1;
    links.forEach(function (a, i) { a.classList.toggle("active", i === current); if (i === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    if (cur) cur.textContent = current >= 0 ? "· " + links[current].textContent : "";
  }
  if (toggle) toggle.addEventListener("click", function () {
    var open = bar.classList.toggle("open"); toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links.forEach(function (a) { a.addEventListener("click", function () { bar.classList.remove("open"); if (toggle) toggle.setAttribute("aria-expanded", "false"); }); });
  document.addEventListener("click", function (e) { if (!bar.contains(e.target)) { bar.classList.remove("open"); if (toggle) toggle.setAttribute("aria-expanded", "false"); } });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
});

// Magnifier lens: rest the mouse on any <div class="zoom"><img></div> and, after a short delay,
// a round lens appears just above the cursor showing that spot enlarged. The image itself never moves.
// Per image: data-zoom="3" (magnification), data-lens="220" (lens diameter in px).
document.addEventListener("DOMContentLoaded", function () {
  if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var lens = document.createElement("div"); lens.className = "zoom-lens"; lens.setAttribute("aria-hidden", "true");
  document.body.appendChild(lens);
  var DELAY = 350, timer = null, active = null, last = null;
  function place(box, e) {
    var img = box.querySelector("img"), r = img.getBoundingClientRect();
    var z = parseFloat(box.getAttribute("data-zoom")) || 2.6, d = parseFloat(box.getAttribute("data-lens")) || 200;
    var x = Math.min(Math.max(e.clientX - r.left, 0), r.width), y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
    lens.style.width = lens.style.height = d + "px";
    lens.style.backgroundImage = 'url("' + (img.currentSrc || img.src) + '")';
    lens.style.backgroundSize = (r.width * z) + "px " + (r.height * z) + "px";
    lens.style.backgroundPosition = (d / 2 - x * z) + "px " + (d / 2 - y * z) + "px";
    var left = e.clientX - d / 2, top = e.clientY - d - 18;           // above the cursor
    if (top < 8) top = e.clientY + 22;                                  // not enough room: show below
    left = Math.min(Math.max(left, 8), window.innerWidth - d - 8);
    lens.style.left = left + "px"; lens.style.top = top + "px";
  }
  document.querySelectorAll(".zoom").forEach(function (box) {
    if (!box.querySelector("img")) return;
    box.addEventListener("mouseenter", function (e) {
      last = e; clearTimeout(timer);
      timer = setTimeout(function () { active = box; place(box, last); lens.classList.add("on"); }, DELAY);
    });
    box.addEventListener("mousemove", function (e) { last = e; if (active === box) place(box, e); });
    box.addEventListener("mouseleave", function () { clearTimeout(timer); active = null; lens.classList.remove("on"); });
  });
  window.addEventListener("scroll", function () { if (active) { active = null; lens.classList.remove("on"); } }, { passive: true });
});

// ---------------------------------------------------------------------
// Animated charts: grouped bars (data-chart) and ranked cards (data-rank).
// Data lives in the HTML as JSON; bars grow when scrolled into view.
// ---------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  var NAMES = ["Human-derived (ours)", "Teleoperated"];
  function fmt(v, unit) { return (Math.round(v * 10) / 10).toString() + (unit || ""); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // shared tooltip
  var tip = el("div", "viz-tip"); document.body.appendChild(tip);
  function showTip(e, html) { tip.innerHTML = html; tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; tip.classList.add("on"); }
  function hideTip() { tip.classList.remove("on"); }

  document.querySelectorAll(".bar-chart[data-chart]").forEach(function (box, ci) {
    var c; try { c = JSON.parse(box.getAttribute("data-chart")); } catch (err) { return; }
    box.appendChild(el("div", "bc-title", c.title));
    box.appendChild(el("div", "bc-sub", c.ylabel));
    var plot = el("div", "bc-plot");
    c.ticks.forEach(function (t) {
      var y = (1 - t / c.max) * 100;
      if (t > 0) { var g = el("div", "bc-grid"); g.style.top = y + "%"; plot.appendChild(g); }
      var tk = el("div", "bc-tick", String(t)); tk.style.top = y + "%"; plot.appendChild(tk);
    });
    var groups = el("div", "bc-groups");
    var n = c.groups.length, last = n - 1;
    c.groups.forEach(function (name, gi) {
      var g = el("div", "bc-group" + (c.series.length === 1 ? " single" : ""));
      var top = 0;
      c.series.forEach(function (s, si) {
        var v = s[gi], h = v / c.max * 100; top = Math.max(top, h);
        var b = el("div", "bc-bar s" + (si + 1));
        b.style.setProperty("--h", h + "%");
        b.style.setProperty("--d", (gi * 0.09 + si * 0.05) + "s");
        if (gi === last) {
          var lab = el("div", "bc-val", fmt(v)); lab.style.setProperty("--d2", (0.8 + gi * 0.09) + "s"); b.appendChild(lab);
        }
        var series = c.series.length === 1 ? "Human-derived" : NAMES[si];
        b.addEventListener("mousemove", function (e) { showTip(e, name + "<br><b>" + series + ": " + fmt(v, c.unit) + "</b>"); });
        b.addEventListener("mouseleave", hideTip);
        g.appendChild(b);
      });
      if (c.ann) {
        var a = el("div", "bc-ann", c.ann[gi]);
        a.style.top = "calc(" + (100 - top) + "% - " + (gi === last ? 18 : 4) + "px)";
        a.style.setProperty("--d2", (0.8 + gi * 0.09) + "s");
        g.appendChild(a);
      }
      groups.appendChild(g);
    });
    plot.appendChild(groups);
    box.appendChild(plot);
    var xl = el("div", "bc-xl");
    c.groups.forEach(function (name, gi) { xl.appendChild(el("span", gi === last ? "avg" : "", name)); });
    box.appendChild(xl);
  });

  document.querySelectorAll("[data-rank]").forEach(function (wrap) {
    var r; try { r = JSON.parse(wrap.getAttribute("data-rank")); } catch (err) { return; }
    r.tasks.forEach(function (t, ti) {
      var card = el("div", "rank-card" + (ti === 0 ? " main" : ""));
      var delta = t.values[0] - t.values[r.ref];
      var head = el("div", "rc-head");
      head.appendChild(el("div", "rc-title", t.name));
      head.appendChild(el("div", "rc-delta", (delta >= 0 ? "+" : "") + delta.toFixed(1) + " pts over " + r.refName));
      card.appendChild(head);
      if (t.frames && t.frames.length) {                       // task flowchart: frame -> frame -> ...
        var flow = el("div", "rc-flow");
        t.frames.forEach(function (src, k) {
          if (k) flow.appendChild(el("span", "rc-arrow", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'));
          var img = el("img"); img.src = src; img.alt = t.name + " – step " + (k + 1); img.loading = "lazy";
          flow.appendChild(img);
        });
        card.appendChild(flow);
      }
      r.methods.forEach(function (m, mi) {
        if (mi === r.split) card.appendChild(el("div", "rc-split"));
        var row = el("div", "rc-row" + (mi === 0 ? " ours" : ""));
        var label = mi === 0 ? m.replace("(Ours)", "(<b>Ours</b>)") : m;
        row.appendChild(el("div", "rc-label", label));
        var tr = el("div", "rc-track"), f = el("div", "rc-fill");
        f.style.setProperty("--w", t.values[mi] + "%");
        f.style.setProperty("--d", (mi * 0.07) + "s");
        tr.appendChild(f); row.appendChild(tr);
        row.appendChild(el("div", "rc-val", t.values[mi].toFixed(1) + "%"));
        card.appendChild(row);
      });
      wrap.appendChild(card);
    });
  });

  // grow when visible (immediately if IntersectionObserver is unavailable)
  var targets = document.querySelectorAll(".bar-chart[data-chart], .rank-card");
  if (!("IntersectionObserver" in window)) { targets.forEach(function (t) { t.classList.add("is-in"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { threshold: 0.25 });
  targets.forEach(function (t) { io.observe(t); });
});

// ---------------------------------------------------------------------
// Tracking video + synchronized fingertip tactile curves (.tac-sync).
// Playback time x speed = time in the original (real-speed) video = RGB frame -> recording time.
// ---------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".tac-sync[data-tactile]").forEach(function (fig) {
    var video = fig.querySelector("video");
    var plots = fig.querySelector(".tac-plots");
    var speed = parseFloat(fig.getAttribute("data-speed")) || 1;
    var NS = "http://www.w3.org/2000/svg";
    function svgEl(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

    fetch(fig.getAttribute("data-tactile")).then(function (r) { return r.json(); }).then(function (d) {
      var t = d.t, tMax = d.rgbTime[d.rgbTime.length - 1], W = 1000, H = 100;
      var yMax = 0; d.force.forEach(function (f) { f.forEach(function (v) { if (v > yMax) yMax = v; }); });
      yMax = Math.ceil(yMax * 2) / 2 || 1;                       // shared scale, e.g. 2.5 N
      var rows = [];
      d.fingers.forEach(function (name, fi) {
        var f = d.force[fi], flat = Math.max.apply(null, f) === 0;
        var row = document.createElement("div"); row.className = "tac-row";
        var lab = document.createElement("div"); lab.className = "tac-name"; lab.textContent = name;
        var svg = svgEl("svg", { "class": "tac-svg", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", role: "img",
                                 "aria-label": name + " fingertip force over time" });
        var clipId = "tacclip-" + Math.random().toString(36).slice(2);
        var defs = svgEl("defs", {}), clip = svgEl("clipPath", { id: clipId }), rect = svgEl("rect", { x: 0, y: -5, width: 0, height: H + 10 });
        clip.appendChild(rect); defs.appendChild(clip); svg.appendChild(defs);
        svg.appendChild(svgEl("rect", { "class": "bg", x: 0, y: 0, width: W, height: H, rx: 0 }));
        for (var g = 1; g < yMax; g++) { var gy = H - g / yMax * H; svg.appendChild(svgEl("line", { "class": "grid", x1: 0, x2: W, y1: gy, y2: gy })); }
        var pts = "";
        for (var i = 0; i < t.length; i++) { pts += (i ? "L" : "M") + (t[i] / tMax * W).toFixed(1) + " " + (H - f[i] / yMax * H).toFixed(1); }
        svg.appendChild(svgEl("path", { "class": "full", d: pts }));
        var grp = svgEl("g", { "clip-path": "url(#" + clipId + ")" });
        grp.appendChild(svgEl("path", { "class": "area", d: pts + "L" + W + " " + H + "L0 " + H + "Z" }));
        grp.appendChild(svgEl("path", { "class": "played", d: pts }));
        svg.appendChild(grp);
        var head = svgEl("line", { "class": "head", x1: 0, x2: 0, y1: 0, y2: H }); svg.appendChild(head);
        var val = document.createElement("div"); val.className = "tac-val"; val.textContent = "0.00 N";
        row.appendChild(lab); row.appendChild(svg); row.appendChild(val); plots.appendChild(row);
        rows.push({ f: f, flat: flat, rect: rect, head: head, val: val });
      });
      var ttl = fig.querySelector(".tac-title"); if (ttl) ttl.innerHTML += ' <span class="tac-scale">· ‖F‖, 0–' + yMax + ' N</span>';

      function recTime() {
        var orig = (video.currentTime || 0) * speed;              // time in the real-speed video
        var k = orig * d.videoFps, k0 = Math.floor(k), n = d.rgbTime.length;
        if (k0 >= n - 1) return d.rgbTime[n - 1];
        if (k0 < 0) return 0;
        return d.rgbTime[k0] + (d.rgbTime[k0 + 1] - d.rgbTime[k0]) * (k - k0);
      }
      function lastIdx(tr) { var lo = 0, hi = t.length - 1, ans = -1; while (lo <= hi) { var m = (lo + hi) >> 1; if (t[m] <= tr) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; }
      function draw() {
        var tr = recTime(), x = Math.min(W, tr / tMax * W), idx = lastIdx(tr);
        rows.forEach(function (r) {
          r.rect.setAttribute("width", x); r.head.setAttribute("x1", x); r.head.setAttribute("x2", x);
          r.val.textContent = (idx >= 0 ? r.f[idx] : 0).toFixed(2) + " N";
        });
      }
      var raf = null;
      function loop() { draw(); raf = video.paused ? null : requestAnimationFrame(loop); }
      video.addEventListener("play", function () { if (!raf) raf = requestAnimationFrame(loop); });
      ["seeked", "timeupdate", "loadedmetadata"].forEach(function (ev) { video.addEventListener(ev, draw); });
      draw(); if (!video.paused) raf = requestAnimationFrame(loop);
    }).catch(function () { plots.textContent = "Tactile data could not be loaded."; });
  });
});
