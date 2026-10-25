// Render LaTeX blocks: <div class="math" data-tex="..."></div>
document.addEventListener("DOMContentLoaded", function () {
  if (window.katex) {
    document.querySelectorAll(".math[data-tex]").forEach(function (el) {
      try { katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: false }); }
      catch (e) { el.textContent = el.dataset.tex; }
    });
  }

  // Side table of contents: show after the cover, highlight current section
  var toc = document.getElementById("toc");
  if (!toc) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  var hero = document.querySelector(".hero");
  function onScroll() {
    var y = window.scrollY;
    toc.classList.toggle("show", y > hero.offsetHeight * 0.7);
    var current = 0;
    sections.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
    links.forEach(function (a, i) { a.classList.toggle("active", i === current); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
});

// Hover-to-zoom: magnify any <div class="zoom"><img></div> around the cursor
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".zoom").forEach(function (box) {
    var img = box.querySelector("img");
    if (!img) return;
    function move(e) {
      var r = box.getBoundingClientRect();
      img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%";
    }
    box.addEventListener("mouseenter", function (e) { move(e); box.classList.add("active"); });
    box.addEventListener("mousemove", move);
    box.addEventListener("mouseleave", function () { box.classList.remove("active"); });
  });
});
