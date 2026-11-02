/* The Backrooms Update wiki. The site lives in a 2010 browser window on a desktop, and the window and desktop behave
   like the real thing: move, snap, resize, minimize, maximize, close, start menu, taskbar, tray, right-click, tooltips.
   No dependencies. Everything here is extra: without it the pages still read and every link still works. */
(function () {
  "use strict";

  var root = document.documentElement;
  var HOST = "http://www.thebackroomsupdate.net/";
  var WALLS = ["door-walked-out.jpg", "rem-high-floors.jpg", "style-long-halls.jpg", "works-hub.jpg", "rem-surface.jpg", "geo-gyroid.jpg"];
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function on(el, ev, f, opt) { if (el) el.addEventListener(ev, f, opt); }
  function store(kind, key, val) {
    try {
      var s = kind === "s" ? sessionStorage : localStorage;
      if (val === undefined) return s.getItem(key);
      if (val === null) s.removeItem(key); else s.setItem(key, val);
    } catch (e) { return null; }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function phone() { return window.matchMedia("(max-width: 760px)").matches; }
  function reduced() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function fake(href) {
    // the address a link shows: this site's pages under the old-style host, other sites as they are
    var a = document.createElement("a");
    a.href = href;
    if (a.origin !== location.origin) return a.href;
    return HOST + (a.pathname.replace(/^.*\//, "") || "index.html") + a.hash;
  }

  // ======================================================================================== search
  var index = null, waiting = [];
  function loadIndex(then) {
    if (index) return then();
    waiting.push(then);
    if (waiting.length > 1) return;
    fetch("assets/search-index.json").then(function (r) { return r.json(); })
      .then(function (d) { index = d; }).catch(function () { index = []; })
      .then(function () { var l = waiting; waiting = []; l.forEach(function (f) { f(); }); });
  }
  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) { if (t) out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
    return out;
  }
  function snippet(text, terms) {
    var low = text.toLowerCase(), at = -1;
    for (var i = 0; i < terms.length && at < 0; i++) at = low.indexOf(terms[i]);
    if (at < 0) return text.slice(0, 110) + (text.length > 110 ? "..." : "");
    var s = Math.max(0, at - 40);
    return (s > 0 ? "..." : "") + text.slice(s, s + 120) + (s + 120 < text.length ? "..." : "");
  }
  function search(q, max) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean), hits = [];
    if (!terms.length || !index) return { hits: [], terms: terms };
    index.forEach(function (sec) {
      var title = sec.title.toLowerCase(), page = sec.page.toLowerCase(), text = sec.text.toLowerCase(), score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i], s = 0;
        if (title.indexOf(t) >= 0) s += 10;
        if (page.indexOf(t) >= 0) s += 4;
        if (text.indexOf(t) >= 0) s += 2;
        if (!s) return;
        score += s;
      }
      hits.push({ sec: sec, score: score + (sec.anchor ? 0 : 1) });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return { hits: hits.slice(0, max || 12).map(function (h) { return h.sec; }), terms: terms };
  }
  function url(sec) { return sec.url + (sec.anchor ? "#" + sec.anchor : ""); }
  function keyNav(box, e) {
    var links = $$("a", box), cur = links.indexOf($("a.active", box));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!links.length) return;
      e.preventDefault();
      cur = (cur + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links.forEach(function (l, i) { l.classList.toggle("active", i === cur); });
      links[cur].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      var go = links[cur >= 0 ? cur : 0];
      if (go) { e.preventDefault(); go.click(); }
    }
  }

  // the search box in the page's side panel
  var sInput = $("#search-input"), sBox = $("#search-results");
  if (sInput && sBox) {
    var drawSearch = function () {
      var q = sInput.value, r = search(q);
      if (!q.trim()) { sBox.hidden = true; sBox.innerHTML = ""; return; }
      sBox.innerHTML = r.hits.length ? r.hits.map(function (s) {
        return '<a href="' + url(s) + '"><span class="r-title">' + mark(s.title, r.terms) + "</span>" +
          (s.anchor ? '<span class="r-page">' + esc(s.page) + "</span>" : "") +
          '<span class="r-text">' + mark(snippet(s.text, r.terms), r.terms) + "</span></a>";
      }).join("") : '<div class="r-none">Nothing found for "' + esc(q) + '".</div>';
      sBox.hidden = false;
    };
    on(sInput, "input", function () { loadIndex(drawSearch); });
    on(sInput, "focus", function () { loadIndex(function () { if (sInput.value) drawSearch(); }); });
    on(sInput, "keydown", function (e) { if (e.key === "Escape") { sBox.hidden = true; sInput.blur(); } else keyNav(sBox, e); });
    on(document, "click", function (e) { if (!sBox.contains(e.target) && e.target !== sInput) sBox.hidden = true; });
  }

  // ======================================================================================== sound
  // the mod's own sounds and a synthesised BIOS beep; the room tone needs a click or a key before a browser lets it play
  var actx = null, tone = null;
  var win = $("#win"), desk = $("#desktop"), bar = $("#taskbar"), app = $(".task.app"), snapEl = $(".snap");
  function ctx() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  function beep(freq, ms, vol) {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.value = freq; g.gain.value = vol || 0.05;
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + ms / 1000);
  }
  function sound(name, vol) {
    try { var a = new Audio("assets/sound/" + name + ".mp3"); a.volume = vol == null ? 0.6 : vol; a.play().catch(function () {}); } catch (e) {}
  }
  function toneVol() { var v = parseInt(store("l", "tonevol"), 10); return isNaN(v) ? 25 : v; }
  function toneMuted() { return store("l", "roomtone") === "off"; }
  var speaker = $(".speaker");
  function drawSpeaker() {
    var live = !toneMuted() && toneVol() > 0;
    if (speaker) { speaker.classList.toggle("on", live); speaker.setAttribute("data-tip", "Room tone: " + (live ? toneVol() + "%" : "Muted")); }
    var m = $(".vol-mute");
    if (m) { m.classList.toggle("muted", toneMuted()); m.setAttribute("aria-label", toneMuted() ? "Unmute" : "Mute"); m.setAttribute("data-tip", toneMuted() ? "Unmute" : "Mute"); }
    var r = $(".vol-range"); if (r) r.value = toneVol();
  }
  function playTone() {
    if (toneMuted() || toneVol() === 0 || $(".boot") || (win && win.classList.contains("closed"))) { if (tone) tone.pause(); return; }
    if (!tone) { tone = new Audio("assets/sound/roomtone.mp3"); tone.loop = true; }
    tone.volume = toneVol() / 100 * 0.8;
    tone.play().catch(function () {});
  }
  function firstTouch() {
    if ($(".boot")) return;
    document.removeEventListener("pointerdown", firstTouch, true);
    document.removeEventListener("keydown", firstTouch, true);
    playTone();
  }
  on(document, "pointerdown", firstTouch, true);
  on(document, "keydown", firstTouch, true);
  drawSpeaker();

  // ======================================================================================== tooltips
  var tip = $("#tip"), tipTimer = null, tipFor = null;
  function hideTip() { clearTimeout(tipTimer); tipFor = null; if (tip) tip.hidden = true; }
  on(document, "pointerover", function (e) {
    var el = e.target.closest && e.target.closest("[data-tip]");
    if (!tip || e.pointerType === "touch" || el === tipFor) return;
    hideTip();
    if (!el) return;
    tipFor = el;
    var x = e.clientX, y = e.clientY;
    tipTimer = setTimeout(function () {
      tip.textContent = el.getAttribute("data-tip");
      tip.hidden = false;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(4, Math.min(x + 2, innerWidth - w - 4)) + "px";
      tip.style.top = (y + 22 + h > innerHeight ? y - h - 6 : y + 20) + "px";
    }, 550);
  });
  on(document, "pointerdown", hideTip, true);
  on(document, "pointerout", function (e) { if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); });

  // ======================================================================================== the window
  function barH() { return bar ? bar.offsetHeight : 40; }
  function maxed() { return root.classList.contains("win-max"); }
  function setMax(m) {
    root.classList.toggle("win-max", m);
    store("l", "maxed", m ? "1" : "0");
    var b = $(".cb.max");
    if (b) { b.setAttribute("aria-label", m ? "Restore Down" : "Maximize"); b.setAttribute("data-tip", m ? "Restore Down" : "Maximize"); }
  }
  function geo() {
    var r = win.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  }
  function clampGeo(g) {
    var W = innerWidth, H = innerHeight - barH();
    g.w = Math.max(480, Math.min(g.w, W));
    g.h = Math.max(320, Math.min(g.h, H));
    g.x = Math.max(80 - g.w, Math.min(g.x, W - 80));
    g.y = Math.max(0, Math.min(g.y, H - 30));
    return g;
  }
  function place(g, save) {
    g = clampGeo(g);
    root.classList.add("win-placed");
    root.style.setProperty("--wx", g.x + "px");
    root.style.setProperty("--wy", g.y + "px");
    root.style.setProperty("--ww", g.w + "px");
    root.style.setProperty("--wh", g.h + "px");
    if (save !== false) store("s", "wingeo", JSON.stringify(g));
  }
  if (win && root.classList.contains("win-placed")) { try { place(JSON.parse(store("s", "wingeo")), false); } catch (e) {} }
  on(window, "resize", function () { if (win && root.classList.contains("win-placed") && !phone() && !maxed()) place(geo(), false); });
  if (maxed()) setMax(true);

  function active(a) { if (win) win.classList.toggle("inactive", !a); }
  function zoomTo(out, done) {
    // minimize and restore: the window shrinks into its taskbar button, and grows back out of it
    if (!win || !app || reduced() || !win.animate) return done();
    var w = win.getBoundingClientRect(), t = app.getBoundingClientRect();
    var dx = t.left + t.width / 2 - (w.left + w.width / 2), dy = t.top + t.height / 2 - (w.top + w.height / 2);
    var away = { transform: "translate(" + dx + "px, " + dy + "px) scale(.12)", opacity: 0 }, here = { transform: "none", opacity: 1 };
    win.animate(out ? [here, away] : [away, here], { duration: 230, easing: "cubic-bezier(.4, 0, .2, 1)" }).onfinish = done;
  }
  function minimize() {
    if (!win || win.classList.contains("min") || win.classList.contains("closed")) return;
    zoomTo(true, function () { win.classList.add("min"); if (app) app.classList.add("off"); });
  }
  function restore() {
    if (!win) return;
    var wasClosed = win.classList.contains("closed"), wasMin = win.classList.contains("min");
    win.classList.remove("min", "closed");
    if (app) { app.hidden = false; app.classList.remove("off"); }
    active(true);
    if (wasClosed) {
      if (win.animate && !reduced()) win.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });
      playTone();
    } else if (wasMin) zoomTo(false, function () {});
  }
  function closeWin() {
    if (!win) return;
    sound("shutdown", 0.45);
    var finish = function () { win.classList.add("closed"); if (app) app.hidden = true; playTone(); };
    if (win.animate && !reduced()) win.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.96)" }], { duration: 160, easing: "ease-in" }).onfinish = finish;
    else finish();
  }
  on($(".cb.min"), "click", minimize);
  on($(".cb.max"), "click", function () { setMax(!maxed()); });
  on($(".cb.close"), "click", closeWin);
  on($(".tab-x"), "click", closeWin);
  on($(".reopen"), "click", restore);
  on(app, "click", function () {
    if (peek) peek.hidden = true;
    if (win.classList.contains("min")) restore();
    else if (win.classList.contains("inactive")) active(true);
    else minimize();
  });
  on(win, "pointerdown", function () { active(true); });

  // move by the title bar; drag to the top edge to maximize, to a side to fill that half; double-click to maximize
  var titlebar = $("#titlebar");
  on(titlebar, "dblclick", function (e) { if (!e.target.closest("button") && !phone()) setMax(!maxed()); });
  on(titlebar, "pointerdown", function (e) {
    if (e.button !== 0 || e.target.closest("button") || phone()) return;
    var sx = e.clientX, sy = e.clientY, g0 = geo(), moved = false, snapTo = null;
    titlebar.setPointerCapture(e.pointerId);
    function move(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) {
        moved = true;
        win.classList.add("dragging");
        if (maxed()) {
          // pulling a maximized window down restores it under the pointer, where on the bar it was grabbed
          var saved = null; try { saved = JSON.parse(store("s", "wingeo")); } catch (x) {}
          var w = saved ? saved.w : Math.min(1120, innerWidth - 210), h = saved ? saved.h : innerHeight - barH() - 24;
          var frac = (sx - g0.x) / g0.w;
          setMax(false);
          g0 = { x: Math.round(sx - frac * w), y: 0, w: w, h: h };
          place(g0, false);
        }
      }
      place({ x: g0.x + dx, y: g0.y + dy, w: g0.w, h: g0.h }, false);
      var H = innerHeight - barH();
      snapTo = ev.clientY <= 2 ? { x: 0, y: 0, w: innerWidth, h: H, max: true }
        : ev.clientX <= 2 ? { x: 0, y: 0, w: Math.round(innerWidth / 2), h: H }
        : ev.clientX >= innerWidth - 3 ? { x: Math.round(innerWidth / 2), y: 0, w: Math.round(innerWidth / 2), h: H } : null;
      if (snapEl) {
        snapEl.classList.toggle("on", !!snapTo);
        if (snapTo) { snapEl.style.left = snapTo.x + 6 + "px"; snapEl.style.top = snapTo.y + 6 + "px"; snapEl.style.width = snapTo.w - 12 + "px"; snapEl.style.height = snapTo.h - 12 + "px"; }
      }
    }
    function up() {
      titlebar.removeEventListener("pointermove", move);
      titlebar.removeEventListener("pointerup", up);
      titlebar.removeEventListener("pointercancel", up);
      win.classList.remove("dragging");
      if (snapEl) snapEl.classList.remove("on");
      if (!moved) return;
      if (snapTo && snapTo.max) setMax(true);
      else if (snapTo) place(snapTo);
      else place(geo());
    }
    titlebar.addEventListener("pointermove", move);
    titlebar.addEventListener("pointerup", up);
    titlebar.addEventListener("pointercancel", up);
  });
  // resize from the right edge, the bottom edge, the corner, or the status bar's grip
  $$(".rs, .grip").forEach(function (h) {
    on(h, "pointerdown", function (e) {
      if (e.button !== 0 || maxed() || phone()) return;
      e.preventDefault();
      var g0 = geo(), sx = e.clientX, sy = e.clientY, ex = !h.classList.contains("rs-s"), ey = !h.classList.contains("rs-e");
      h.setPointerCapture(e.pointerId);
      function move(ev) { place({ x: g0.x, y: g0.y, w: ex ? g0.w + ev.clientX - sx : g0.w, h: ey ? g0.h + ev.clientY - sy : g0.h }, false); }
      function up() { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); place(geo()); }
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", up);
    });
  });

  // ======================================================================================== browser controls
  var back = $(".nav-back"), fwd = $(".nav-fwd");
  if (back && history.length <= 1) back.disabled = true;
  on(back, "click", function () { history.back(); });
  on(fwd, "click", function () { history.forward(); });
  on($(".reload"), "click", function () { location.reload(); });
  var addr = $("#address");
  function showAddr() { if (addr && document.activeElement !== addr) addr.value = fake(location.href); }
  showAddr();
  on(window, "hashchange", showAddr);
  on(addr, "focus", function () { setTimeout(function () { addr.select(); }, 0); });
  on(addr, "blur", showAddr);
  on($("form.address"), "submit", function (e) {
    // the address bar takes a page's file name or title; anything else is searched for in the start menu
    e.preventDefault();
    var v = addr.value.trim(), file = v.replace(/[#?].*$/, "").replace(/^.*\//, "").toLowerCase(), hash = (v.match(/#.*$/) || [""])[0];
    var pages = {};
    $$(".box.pages a[href$='.html']").forEach(function (a) { pages[a.getAttribute("href")] = a.getAttribute("href"); pages[a.textContent.trim().toLowerCase()] = a.getAttribute("href"); });
    var go = !file ? "index.html" : pages[file] || pages[file + ".html"] || pages[v.toLowerCase()];
    addr.blur();
    if (go) { loadingTo(go + hash); location.href = go + hash; return; }
    openStart(v);
  });

  // status bar: where a link goes while you point at it, and a loading bar while the next page comes
  var status = $("#status"), prog = $(".progress");
  function setStatus(t) { if (status) status.textContent = t || "Done"; }
  function loadingTo(href) {
    setStatus("Opening page " + fake(href) + "...");
    if (prog) { prog.hidden = false; prog.style.setProperty("--load", "20%"); setTimeout(function () { prog.style.setProperty("--load", "75%"); }, 60); }
  }
  on(document, "mouseover", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (a && !a.closest(".taskbar, .startmenu, .icons")) setStatus(fake(a.href));
  });
  on(document, "mouseout", function (e) { var a = e.target.closest && e.target.closest("a[href]"); if (a && !a.contains(e.relatedTarget)) setStatus(); });
  on(document, "click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
    if (a.origin === location.origin && a.pathname !== location.pathname) loadingTo(a.href);
  });
  on(window, "pageshow", function () { setStatus(); if (prog) prog.hidden = true; showAddr(); });

  // ======================================================================================== desktop
  // icons: one click selects, a double-click (or a tap, or Enter) opens
  var lastPointer = "mouse";
  on(document, "pointerdown", function (e) { lastPointer = e.pointerType || "mouse"; }, true);
  function homeIsOpenHere(a) {
    return a.getAttribute("href") === "index.html" && win && (win.classList.contains("closed") || win.classList.contains("min")) && /(^|\/)(index\.html)?$/.test(location.pathname);
  }
  $$(".dicon").forEach(function (a) {
    on(a, "click", function (e) {
      if (e.detail === 1 && lastPointer === "mouse") {
        e.preventDefault();
        $$(".dicon.sel").forEach(function (x) { x.classList.remove("sel"); });
        a.classList.add("sel");
        a.focus({ preventScroll: true });
        return;
      }
      if (homeIsOpenHere(a)) { e.preventDefault(); restore(); }
    });
    on(a, "dblclick", function (e) {
      e.preventDefault();
      if (homeIsOpenHere(a)) restore(); else location.href = a.href;
    });
  });
  on(desk, "pointerdown", function (e) {
    if (e.target === desk || (e.target.closest(".icons") && !e.target.closest(".dicon"))) {
      $$(".dicon.sel").forEach(function (x) { x.classList.remove("sel"); });
      active(false);
    }
  });

  // wallpapers
  function nextWall() {
    var cur = (store("l", "wall") || "assets/shots/" + WALLS[0]).replace("assets/shots/", ""), i = WALLS.indexOf(cur), tries = 0;
    (function tryNext() {
      i = (i + 1) % WALLS.length;
      var src = "assets/shots/" + WALLS[i], img = new Image();
      img.onload = function () { root.style.setProperty("--wall", 'url("' + src + '")'); store("l", "wall", src); };
      img.onerror = function () { if (++tries < WALLS.length) tryNext(); };
      img.src = src;
    })();
  }

  // show desktop
  var hidByDesk = false;
  function showDesktop() {
    if (!win) return;
    if (hidByDesk && win.classList.contains("min")) { hidByDesk = false; restore(); }
    else if (!win.classList.contains("min") && !win.classList.contains("closed")) { hidByDesk = true; minimize(); }
  }
  on($(".showdesk"), "click", showDesktop);

  // right-click on the desktop
  var ctxm = $("#ctxmenu"), start = $("#startmenu"), orb = $(".orb");
  function openStartMenu(o) {
    if (!start || start.hidden === !o) return;
    start.hidden = !o;
    orb.setAttribute("aria-expanded", o ? "true" : "false");
    active(!o && !(win && win.classList.contains("min")));
    if (!o) { if (smIn) smIn.value = ""; drawStart(); var pm = $(".sm-powermenu"); if (pm) pm.hidden = true; }
  }
  function closeMenus(except) {
    if (ctxm && except !== ctxm) ctxm.hidden = true;
    if (except !== "start") openStartMenu(false);
    $$(".flyout").forEach(function (f) { if (f !== except) f.hidden = true; });
    $$(".speaker, .clock").forEach(function (b) { if (!except || b.getAttribute("aria-controls") !== except.id) b.setAttribute("aria-expanded", "false"); });
  }
  on(desk, "contextmenu", function (e) {
    if (!ctxm || e.target.closest(".window, .taskbar, .startmenu, .flyout, .ctxmenu, .peek")) return;
    e.preventDefault();
    closeMenus(ctxm);
    ctxm.hidden = false;
    ctxm.style.left = Math.min(e.clientX, innerWidth - ctxm.offsetWidth - 4) + "px";
    ctxm.style.top = Math.min(e.clientY, innerHeight - ctxm.offsetHeight - 4) + "px";
    var first = $("button", ctxm); if (first) first.focus({ preventScroll: true });
  });
  on(ctxm, "click", function (e) {
    var b = e.target.closest("button[data-cmd]"); if (!b) return;
    ctxm.hidden = true;
    var c = b.getAttribute("data-cmd");
    if (c === "refresh") location.reload();
    else if (c === "wallpaper") nextWall();
    else if (c === "open") restore();
    else if (c === "desktop") showDesktop();
  });
  on(ctxm, "keydown", function (e) {
    var items = $$("button", ctxm), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus(); }
  });

  // ======================================================================================== start menu
  var smIn = $("#sm-search"), smRes = $(".sm-results"), smProg = $(".sm-programs");
  function openStart(q) {
    closeMenus("start");
    openStartMenu(true);
    if (smIn) { smIn.value = q || ""; if (!phone()) smIn.focus(); loadIndex(drawStart); }
  }
  function drawStart() {
    if (!smIn || !smRes || !smProg) return;
    var q = smIn.value.trim();
    if (!q) { smRes.hidden = true; smProg.hidden = false; return; }
    var low = q.toLowerCase(), pages = $$("a", smProg).filter(function (a) { return a.textContent.toLowerCase().indexOf(low) >= 0; });
    var r = search(q, 8), out = "";
    if (pages.length) out += '<li class="sm-head">Pages</li>' + pages.map(function (a) { return "<li>" + a.outerHTML + "</li>"; }).join("");
    if (r.hits.length) out += '<li class="sm-head">On the wiki</li>' + r.hits.map(function (s) {
      return '<li><a href="' + url(s) + '"><span>' + mark(s.title, r.terms) + "</span>" + (s.anchor ? '<span class="r-page">' + esc(s.page) + "</span>" : "") + "</a></li>";
    }).join("");
    smRes.innerHTML = out ? "<ul>" + out + "</ul>" : '<div class="none">No items match your search.</div>';
    smRes.hidden = false; smProg.hidden = true;
  }
  on(orb, "click", function (e) { e.stopPropagation(); if (start.hidden) openStart(); else openStartMenu(false); });
  on(smIn, "input", function () { loadIndex(drawStart); });
  on(smIn, "keydown", function (e) { keyNav(smRes, e); });
  on($(".sm-more"), "click", function (e) {
    e.stopPropagation();
    var pm = $(".sm-powermenu"); pm.hidden = !pm.hidden;
    this.setAttribute("aria-expanded", pm.hidden ? "false" : "true");
  });
  on($(".shutdown"), "click", function () { power("shutdown"); });
  $$(".sm-powermenu button").forEach(function (b) { on(b, "click", function () { power(b.getAttribute("data-power")); }); });
  function power(kind) {
    openStartMenu(false);
    if (tone) tone.pause();
    sound("shutdown", 0.6);
    var scr = document.createElement("div");
    scr.className = "off-screen closing";
    scr.innerHTML = '<div class="boot" style="position:static;background:none;cursor:default"><div class="who"><span class="spin"><span class="ring"></span>' +
      (kind === "restart" ? "Restarting..." : "Shutting down...") + "</span></div></div>";
    document.body.appendChild(scr);
    setTimeout(function () {
      store("s", "booted", null);
      if (kind === "restart") { location.reload(); return; }
      scr.className = "off-screen";
      scr.innerHTML = "<div>It&#x27;s now safe to turn off your computer.<small>Click anywhere to start it again</small></div>";
      on(scr, "click", function () { location.reload(); });
    }, 2200);
  }

  // ======================================================================================== taskbar and tray
  // hover the window's button for a preview, like the real taskbar
  var peek = $("#peek"), peekTimer = null;
  function peekShow() {
    if (!peek || !app || app.hidden || phone()) return;
    var el = $(".viewport video[poster], .viewport figure.shot img, .viewport img[src*='shots/']");
    var src = el ? (el.getAttribute("poster") || el.currentSrc || el.src) : "assets/video/walk.jpg";
    peek.innerHTML = '<div class="peek-t"><img src="assets/b-logo.png" alt="">' + esc(document.title) + '</div><img class="peek-img" src="' + esc(src) + '" alt="">';
    peek.hidden = false;
    var r = app.getBoundingClientRect();
    peek.style.left = Math.max(4, Math.min(r.left + r.width / 2 - peek.offsetWidth / 2, innerWidth - peek.offsetWidth - 4)) + "px";
  }
  on(app, "pointerenter", function (e) { if (e.pointerType === "mouse") { clearTimeout(peekTimer); peekTimer = setTimeout(peekShow, 450); } });
  on(app, "pointerleave", function () { clearTimeout(peekTimer); peekTimer = setTimeout(function () { if (peek && !peek.matches(":hover")) peek.hidden = true; }, 250); });
  on(peek, "pointerleave", function () { peek.hidden = true; });
  on(peek, "click", function () { peek.hidden = true; restore(); });

  function flyout(id, btn) {
    var f = $(id);
    if (!f) return;
    var open = f.hidden;
    closeMenus(f);
    f.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (speaker) speaker.setAttribute("aria-controls", "volume");
  on(speaker, "click", function (e) { e.stopPropagation(); flyout("#volume", speaker); });
  on($(".vol-range"), "input", function () { store("l", "tonevol", this.value); if (+this.value > 0) store("l", "roomtone", "on"); drawSpeaker(); playTone(); });
  on($(".vol-mute"), "click", function () { store("l", "roomtone", toneMuted() ? "on" : "off"); drawSpeaker(); playTone(); });

  // the clock and its calendar
  var clockBtn = $(".clock"), calMonth = null;
  if (clockBtn) clockBtn.setAttribute("aria-controls", "calendar");
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function hm(d) { var h = d.getHours(), m = d.getMinutes(); return ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + " " + (h < 12 ? "AM" : "PM"); }
  function drawCal() {
    var cal = $("#calendar"), now = new Date();
    if (!cal) return;
    var m = calMonth || new Date(now.getFullYear(), now.getMonth(), 1), first = new Date(m.getFullYear(), m.getMonth(), 1);
    var day = new Date(first); day.setDate(1 - first.getDay());
    var rows = "";
    for (var w = 0; w < 6; w++) {
      rows += "<tr>";
      for (var d = 0; d < 7; d++) {
        var cls = day.getMonth() !== m.getMonth() ? "other" : "";
        if (day.toDateString() === now.toDateString()) cls += " today";
        rows += '<td class="' + cls + '"><span>' + day.getDate() + "</span></td>";
        day.setDate(day.getDate() + 1);
      }
      rows += "</tr>";
    }
    cal.innerHTML = '<div class="cal-time">' + hm(now) + '</div><div class="cal-day">' + DAYS[now.getDay()] + ", " + MONTHS[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear() + "</div>" +
      '<div class="cal-head"><button type="button" data-m="-1" aria-label="Previous month">&#9664;</button><span>' + MONTHS[m.getMonth()] + " " + m.getFullYear() +
      '</span><button type="button" data-m="1" aria-label="Next month">&#9654;</button></div><table><thead><tr><th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }
  on(clockBtn, "click", function (e) { e.stopPropagation(); calMonth = null; drawCal(); flyout("#calendar", clockBtn); });
  on($("#calendar"), "click", function (e) {
    e.stopPropagation();
    var b = e.target.closest("button[data-m]"); if (!b) return;
    var now = new Date(), m = calMonth || new Date(now.getFullYear(), now.getMonth(), 1);
    calMonth = new Date(m.getFullYear(), m.getMonth() + (+b.getAttribute("data-m")), 1);
    drawCal();
  });
  on($("#volume"), "click", function (e) { e.stopPropagation(); });
  function tick() {
    var d = new Date(), c = $("#clock"), dt = $("#date");
    if (c) c.textContent = hm(d);
    if (dt) dt.textContent = (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
    if (clockBtn) clockBtn.setAttribute("data-tip", DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear());
  }
  tick(); setInterval(tick, 15000);

  // anything outside a menu closes it; Esc closes too; Ctrl+Esc opens the start menu
  on(document, "click", function (e) {
    if (!e.target.closest(".startmenu, .orb, .flyout, .speaker, .clock, .ctxmenu")) closeMenus();
  });
  on(document, "keydown", function (e) {
    if (e.key === "Escape" && e.ctrlKey) { e.preventDefault(); openStart(); return; }
    if (e.key === "Escape") { closeMenus(); hideTip(); }
  });

  // ======================================================================================== the picture viewer
  // a second window over the first, with back and next through the page's pictures
  var pics = $$(".viewport figure.shot img, .viewport .recipe img.gui"), dlg = null, cur = 0;
  function viewer() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.innerHTML = '<div class="lb-title"><img src="assets/b-logo.png" alt="" width="16" height="16"><span></span><button class="cb close" type="button" aria-label="Close" data-tip="Close"></button></div>' +
      '<img class="lb-img" alt=""><div class="lb-bar"><button class="lb-prev" type="button" aria-label="Previous picture" data-tip="Previous (Left arrow)">&#9664;</button>' +
      '<p></p><span class="lb-count"></span><button class="lb-next" type="button" aria-label="Next picture" data-tip="Next (Right arrow)">&#9654;</button></div>';
    document.body.appendChild(dlg);
    on($(".cb.close", dlg), "click", function () { dlg.close(); });
    on(dlg, "click", function (e) { if (e.target === dlg) dlg.close(); });
    on($(".lb-prev", dlg), "click", function () { showPic(cur - 1); });
    on($(".lb-next", dlg), "click", function () { showPic(cur + 1); });
    on(dlg, "keydown", function (e) { if (e.key === "ArrowLeft") showPic(cur - 1); if (e.key === "ArrowRight") showPic(cur + 1); });
    return dlg;
  }
  function showPic(i) {
    if (i < 0 || i >= pics.length) return;
    cur = i;
    var img = pics[i], big = $(".lb-img", dlg), fig = img.closest("figure, .recipe"), cap = fig ? fig.querySelector("figcaption, .legend, h4") : null;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    big.classList.toggle("px", img.classList.contains("gui"));
    $(".lb-title span", dlg).textContent = (img.getAttribute("src") || "").replace(/^.*\//, "") + " - Picture Viewer";
    $("p", dlg).textContent = cap ? cap.textContent : img.alt;
    $(".lb-count", dlg).textContent = (i + 1) + " of " + pics.length;
    $(".lb-prev", dlg).disabled = i === 0;
    $(".lb-next", dlg).disabled = i === pics.length - 1;
  }
  pics.forEach(function (img, i) {
    on(img, "click", function () {
      var d = viewer();
      if (typeof d.showModal !== "function") return;
      showPic(i);
      d.showModal();
    });
  });

  // ======================================================================================== the video on the home page
  var vid = $("#walk");
  if (vid) {
    var pl = $(".player .play"), tr = $(".player .track"), tm = $(".player .time"), vol = $(".player .vol"), full = $(".player .full");
    var fmt = function (t) { t = Math.floor(t || 0); return Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); };
    var drawVid = function () {
      var p = vid.duration ? vid.currentTime / vid.duration : 0;
      tr.value = Math.round(p * 1000); tr.style.setProperty("--p", (p * 100) + "%");
      tm.textContent = fmt(vid.currentTime) + " / " + fmt(vid.duration);
      pl.classList.toggle("on", !vid.paused); pl.setAttribute("aria-label", vid.paused ? "Play" : "Pause"); pl.setAttribute("data-tip", vid.paused ? "Play" : "Pause");
      vol.classList.toggle("on", !vid.muted); vol.setAttribute("aria-label", vid.muted ? "Unmute" : "Mute"); vol.setAttribute("data-tip", vid.muted ? "Unmute" : "Mute");
    };
    var toggle = function () { if (vid.paused) vid.play().catch(function () {}); else vid.pause(); };
    ["timeupdate", "play", "pause", "loadedmetadata", "volumechange"].forEach(function (ev) { on(vid, ev, drawVid); });
    on(pl, "click", toggle);
    on(vid, "click", toggle);
    on(tr, "input", function () { if (vid.duration) vid.currentTime = tr.value / 1000 * vid.duration; drawVid(); });
    on(vol, "click", function () { vid.muted = !vid.muted; if (!vid.muted && tone) tone.pause(); else playTone(); });
    on(full, "click", function () {
      var el = $(".player");
      if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
    });
    if (full) full.setAttribute("data-tip", "Full screen");
    drawVid();
  }

  // ======================================================================================== boot
  // once per visit the computer starts before the desktop shows; a click or any key skips it
  (function () {
    if (store("s", "booted") === "1" || !desk || reduced()) { root.classList.remove("booting"); return; }
    var lines = [
      '<span class="hi">Remembering BIOS v3.00.0</span>, An Energy Star Ally',
      "Copyright (C) 2010, The Builders",
      "",
      "Main Processor : Memarium Core @ 1.21.1",
      'Memory Testing : <span id="memtest">0</span>K',
      "",
      'Detecting floors ........ <span class="ok">' + (1392 / 6) + " found</span>",
      'Detecting doors ......... <span class="ok">Reinforced Iron, powered</span>',
      'Detecting Stand-In ...... <span class="ok">charged (4)</span>',
      'Detecting Keeper ........ <span class="ok">not looking</span>',
      "",
      "Booting from The Remembering..."
    ];
    var boot = document.createElement("div");
    boot.className = "boot";
    boot.setAttribute("aria-hidden", "true");
    boot.innerHTML =
      '<div class="stage bios on"><div class="txt"></div><div class="bar"><span>Press DEL to run Setup</span><span>Click to skip</span></div></div>' +
      '<div class="stage start"><div class="mark"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="blogo"></span></div>' +
      "<p>Starting The Remembering</p><small>The Backrooms Update 3.0.0</small></div>" +
      '<div class="stage welcome"><div class="who"><span class="tile"><img src="assets/b-logo.png" alt=""></span><span class="spin"><span class="ring"></span>Welcome</span></div></div>' +
      '<span class="skip-hint">Click or press any key to skip</span>';
    document.body.appendChild(boot);
    desk.classList.add("waking");
    var timers = [], done = false;
    function later(f, ms) { timers.push(setTimeout(f, ms)); }
    function stage(cls) { $$(".stage", boot).forEach(function (st) { st.classList.toggle("on", st.classList.contains(cls)); }); }
    function finish() {
      if (done) return;
      done = true;
      store("s", "booted", "1");
      timers.forEach(clearTimeout);
      desk.classList.remove("waking");
      root.classList.remove("booting");
      boot.classList.add("out");
      setTimeout(function () { boot.remove(); playTone(); }, 750);
      document.removeEventListener("keydown", finish);
    }
    on(document, "keydown", finish);
    on(boot, "click", finish);
    ctx();
    later(function () { beep(988, 160, 0.04); }, 300);
    var txt = $(".txt", boot), t = 500;
    lines.forEach(function (l, i) {
      later(function () { txt.innerHTML += l + "\n"; if (i === 6 || i === 9) sound("flicker", 0.35); }, t);
      t += l ? 180 : 90;
    });
    later(function () {
      var k = 0, el = $("#memtest");
      var run = setInterval(function () {
        k += 65536;
        if (el) el.textContent = Math.min(k, 1392 * 1024) + (k >= 1392 * 1024 ? " OK" : "");
        if (k >= 1392 * 1024 || done) clearInterval(run);
      }, 30);
    }, 1200);
    later(function () { stage("start"); sound("power", 0.45); }, t + 700);
    later(function () { sound("startup", 0.55); }, t + 2300);
    later(function () { stage("welcome"); sound("welcome", 0.5); }, t + 3700);
    later(finish, t + 5400);
  })();
})();
