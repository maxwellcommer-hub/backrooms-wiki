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

  // ---------- sound: the mod's own sounds, plus a synthesised BIOS beep. Nothing plays before a click. ----------
  var audioCtx = null, roomtone = null;
  function ctx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function beep(freq, ms, vol) {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.value = freq; g.gain.value = vol || 0.05;
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + ms / 1000);
  }
  function sound(name, vol) {
    try { var a = new Audio("assets/sound/" + name + ".mp3"); a.volume = vol == null ? 0.6 : vol; a.play().catch(function () {}); return a; } catch (e) { return null; }
  }
  function soundOn() { try { return localStorage.getItem("roomtone") !== "off"; } catch (e) { return true; } }
  var speaker = document.querySelector(".speaker");
  function setTone(on) {
    if (speaker) { speaker.classList.toggle("on", on); speaker.setAttribute("aria-pressed", on ? "true" : "false"); }
    if (on) {
      if (!roomtone) { roomtone = new Audio("assets/sound/roomtone.mp3"); roomtone.loop = true; }
      roomtone.volume = 0.25;
      roomtone.play().catch(function () {});
    } else if (roomtone) roomtone.pause();
  }
  if (speaker) {
    speaker.classList.toggle("on", soundOn());
    speaker.addEventListener("click", function () {
      var on = !speaker.classList.contains("on");
      try { localStorage.setItem("roomtone", on ? "on" : "off"); } catch (e) {}
      setTone(on);
    });
  }
  // a later page keeps the room tone going from the first click or key on it
  function resumeTone() {
    if (document.querySelector(".boot")) return;
    document.removeEventListener("pointerdown", resumeTone);
    document.removeEventListener("keydown", resumeTone);
    if (soundOn()) setTone(true);
  }
  document.addEventListener("pointerdown", resumeTone);
  document.addEventListener("keydown", resumeTone);
  var closeBtn = document.querySelector(".cb.close");
  if (closeBtn) closeBtn.addEventListener("click", function () {
    sound("shutdown", 0.5);
    var w = document.querySelector(".window");
    if (w) { w.style.transition = "opacity .12s"; w.style.opacity = "0.15"; setTimeout(function () { w.style.opacity = ""; }, 260); }
  });

  // ---------- boot: once per visit the computer starts before the desktop shows ----------
  (function () {
    var seen = false;
    try { seen = sessionStorage.getItem("booted") === "1"; } catch (e) {}
    var desk = document.querySelector(".desktop");
    if (seen || !desk || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { document.documentElement.classList.remove("booting"); return; }
    var lines = [
      '<span class="hi">Remembering BIOS v3.00.0</span>, An Energy Star Ally',
      'Copyright (C) 2010, The Builders',
      '',
      'Main Processor : Memarium Core @ 1.21.1',
      'Memory Testing : <span id="memtest">0</span>K',
      '',
      'Detecting floors ........ <span class="ok">' + (1392 / 6) + ' found</span>',
      'Detecting doors ......... <span class="ok">Reinforced Iron, powered</span>',
      'Detecting Stand-In ...... <span class="ok">charged (4)</span>',
      'Detecting Keeper ........ <span class="ok">not looking</span>',
      '',
      'Booting from The Remembering...'
    ];
    var boot = document.createElement("div");
    boot.className = "boot";
    boot.innerHTML =
      '<div class="stage power on"><button class="power-btn" type="button" aria-label="Turn on"></button><p>Press the power button</p><span class="led"></span></div>' +
      '<div class="stage bios"><div class="txt"></div><div class="bar"><span>Press DEL to run Setup</span><span>Click to skip</span></div></div>' +
      '<div class="stage start"><div class="mark"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="blogo"></span></div>' +
      '<p>Starting The Remembering</p><small>The Backrooms Update 3.0.0</small></div>' +
      '<div class="stage welcome"><div class="who"><span class="tile"><img src="assets/b-logo.png" alt=""></span>' +
      '<span class="spin"><span class="ring"></span>Welcome</span></div></div>' +
      '<span class="skip-hint">Esc to skip &middot; once started, click to skip</span>';
    document.body.appendChild(boot);
    desk.classList.add("waking");
    var timers = [], done = false, started = false;
    function later(f, ms) { timers.push(setTimeout(f, ms)); }
    function show(cls) { boot.querySelectorAll(".stage").forEach(function (st) { st.classList.toggle("on", st.classList.contains(cls)); }); }
    function finish() {
      if (done) return;
      done = true;
      try { sessionStorage.setItem("booted", "1"); } catch (e) {}
      timers.forEach(clearTimeout);
      desk.classList.remove("waking");
      document.documentElement.classList.remove("booting");
      boot.classList.add("out");
      setTimeout(function () { boot.remove(); }, 800);
      document.removeEventListener("keydown", onKey);
      if (started && soundOn()) setTone(true);
    }
    function onKey(e) { if (e.key === "Escape" || started) finish(); else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } }
    document.addEventListener("keydown", onKey);
    boot.addEventListener("click", function () { if (started) finish(); else start(); });
    boot.querySelector(".power-btn").addEventListener("click", function (e) { e.stopPropagation(); start(); });
    boot.querySelector(".power-btn").focus({ preventScroll: true });
    function start() {
      if (started) return;
      started = true;
      ctx();
      // start the room tone inside the click, silent, so the browser lets it play when the desktop comes up
      if (soundOn()) { roomtone = new Audio("assets/sound/roomtone.mp3"); roomtone.loop = true; roomtone.volume = 0; roomtone.play().catch(function () {}); }
      boot.querySelector(".led").style.background = "#e8c95a";
      later(function () { show("bios"); beep(988, 160, 0.04); }, 500);
      var txt = boot.querySelector(".txt"), t = 900;
      lines.forEach(function (l, i) {
        later(function () { txt.innerHTML += l + "\n"; if (i === 6 || i === 9) sound("flicker", 0.35); }, t);
        t += l ? 180 : 90;
      });
      later(function () {
        var k = 0, el = document.getElementById("memtest");
        var run = setInterval(function () {
          k += 65536;
          if (el) el.textContent = Math.min(k, 1392 * 1024) + (k >= 1392 * 1024 ? " OK" : "");
          if (k >= 1392 * 1024 || done) clearInterval(run);
        }, 30);
      }, 1600);
      later(function () { show("start"); sound("power", 0.45); }, t + 700);
      later(function () { sound("startup", 0.55); }, t + 2300);
      later(function () { show("welcome"); sound("welcome", 0.5); }, t + 3700);
      later(finish, t + 5400);
    }
  })();

  // ---------- the window: the address bar shows where you are, the taskbar keeps the time ----------
  var addr = document.getElementById("address");
  if (addr) addr.textContent = "http://www.thebackroomsupdate.net" + (location.pathname.replace(/^.*\//, "/") || "/") + location.hash;
  window.addEventListener("hashchange", function () { if (addr) addr.textContent = addr.textContent.replace(/#.*$/, "") + location.hash; });
  var clock = document.getElementById("clock"), date = document.getElementById("date");
  function tick() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    if (clock) clock.textContent = ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + " " + (h < 12 ? "AM" : "PM");
    if (date) date.textContent = (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
  }
  tick(); setInterval(tick, 20000);
})();
