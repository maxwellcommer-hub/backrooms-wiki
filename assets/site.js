/* The Backrooms Update wiki: phone menu, page search, picture viewer. No dependencies. */
(function () {
  "use strict";

  // ---------- phone menu ----------
  var btn = document.querySelector(".menu-btn");
  if (btn) {
    btn.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
        document.body.classList.remove("menu-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ---------- search ----------
  var input = document.getElementById("search-input");
  var box = document.getElementById("search-results");
  var index = null, loading = false, active = -1;

  function load(then) {
    if (index) return then();
    if (loading) return;
    loading = true;
    fetch("assets/search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; loading = false; then(); })
      .catch(function () { loading = false; index = []; then(); });
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  function snippet(text, terms) {
    var low = text.toLowerCase(), at = -1;
    for (var i = 0; i < terms.length && at < 0; i++) at = low.indexOf(terms[i]);
    if (at < 0) return text.slice(0, 110) + (text.length > 110 ? "..." : "");
    var start = Math.max(0, at - 40);
    return (start > 0 ? "..." : "") + text.slice(start, start + 120) + (start + 120 < text.length ? "..." : "");
  }

  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var hits = [];
    index.forEach(function (sec) {
      var title = sec.title.toLowerCase(), page = sec.page.toLowerCase(), text = sec.text.toLowerCase();
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i], s = 0;
        if (title.indexOf(t) >= 0) s += 10;
        if (page.indexOf(t) >= 0) s += 4;
        if (text.indexOf(t) >= 0) s += 2;
        if (!s) return;
        score += s;
      }
      if (!sec.anchor) score += 1;
      hits.push({ sec: sec, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 12).map(function (h) { return h.sec; }).concat([]).map(function (s) { return { s: s, terms: terms }; });
  }

  function render(q) {
    var res = search(q);
    active = -1;
    if (!q.trim()) { box.hidden = true; box.innerHTML = ""; return; }
    if (!res.length) {
      box.innerHTML = '<div class="r-none">Nothing found for "' + esc(q) + '".</div>';
      box.hidden = false;
      return;
    }
    box.innerHTML = res.map(function (r) {
      var s = r.s, url = s.url + (s.anchor ? "#" + s.anchor : "");
      return '<a href="' + url + '"><span class="r-title">' + mark(s.title, r.terms) + '</span>' +
        (s.anchor ? '<span class="r-page">' + esc(s.page) + "</span>" : "") +
        '<span class="r-text">' + mark(snippet(s.text, r.terms), r.terms) + "</span></a>";
    }).join("");
    box.hidden = false;
  }

  if (input && box) {
    input.addEventListener("input", function () { load(function () { render(input.value); }); });
    input.addEventListener("focus", function () { load(function () { if (input.value) render(input.value); }); });
    input.addEventListener("keydown", function (e) {
      var links = box.querySelectorAll("a");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!links.length) return;
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach(function (l, i) { l.classList.toggle("active", i === active); });
        links[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        var go = links[active >= 0 ? active : 0];
        if (go) { e.preventDefault(); window.location.href = go.getAttribute("href"); }
      } else if (e.key === "Escape") {
        box.hidden = true; input.blur();
      }
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // ---------- picture viewer ----------
  var dlg = null;
  function viewer() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.innerHTML = '<button type="button" aria-label="Close">Close</button><img alt=""><p></p>';
    document.body.appendChild(dlg);
    dlg.querySelector("button").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    return dlg;
  }
  document.querySelectorAll("figure.shot img, .recipe img.gui").forEach(function (img) {
    img.addEventListener("click", function () {
      var d = viewer();
      if (typeof d.showModal !== "function") return;
      var big = d.querySelector("img");
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      var fig = img.closest("figure"), cap = fig ? fig.querySelector("figcaption") : null;
      d.querySelector("p").textContent = cap ? cap.textContent : img.alt;
      d.showModal();
    });
  });

  // ---------- the dock slides away while you read down, and comes back when you scroll up ----------
  var dock = document.querySelector(".dock"), lastY = window.scrollY;
  if (dock) {
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (!document.body.classList.contains("menu-open")) dock.classList.toggle("away", y > lastY && y > 240);
      lastY = y;
    }, { passive: true });
  }

  // ---------- the home line misremembers itself: letters come up wrong, then settle ----------
  var line = document.querySelector(".misremember");
  if (line && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var real = line.getAttribute("data-text"), wrong = "ABCDEFGHJKLMNOPRSTUVWXYZ0123456789";
    var settled = real.split("").map(function () { return false; }), frame = 0;
    line.setAttribute("aria-label", real);
    var tick = setInterval(function () {
      frame++;
      var out = real.split("").map(function (c, i) {
        if (c === " ") return " ";
        if (!settled[i] && frame > 6 + i * 1.6 && Math.random() < 0.35) settled[i] = true;
        return settled[i] ? c : wrong.charAt(Math.floor(Math.random() * wrong.length));
      }).join("");
      line.textContent = out;
      if (settled.every(function (v, i) { return v || real.charAt(i) === " "; })) {
        clearInterval(tick);
        line.textContent = real;
        // now and then one letter slips, and comes back
        setInterval(function () {
          var i = Math.floor(Math.random() * real.length);
          if (real.charAt(i) === " ") return;
          line.textContent = real.slice(0, i) + wrong.charAt(Math.floor(Math.random() * wrong.length)) + real.slice(i + 1);
          setTimeout(function () { line.textContent = real; }, 140);
        }, 3800);
      }
    }, 55);
  }
})();
