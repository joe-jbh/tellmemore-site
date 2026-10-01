/* Tell Me More — the video shorts player.
 *
 * One player for the home page's carousel, the tutorials page and a single
 * video on any page. The video is the iPad's screen and nothing else. This
 * script draws everything over it from shorts.json, by way of the JSON the
 * build writes into the page:
 *
 *   - the frame round the screen (an iPad, a plain screen, a cinema), by CSS
 *     from data-frame, so it can change without touching a video;
 *   - a title card that opens each short;
 *   - the callout for each cue (and a glow, where one asks for it), timed
 *     to the video;
 *   - a fingertip at each tap and drag, so a viewer sees what was touched;
 *   - the chapter cards between topics when the shorts play as one video.
 *
 * Nothing here is needed to read the page: without JavaScript the
 * descriptions stand on their own and the videos play with their controls.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TITLE_SECONDS = reduceMotion ? 1.4 : 2.2;   // the title card before a short
  var CHAPTER_SECONDS = 3.6;                        // a chapter card between topics
  var CALLOUT_LEAD = 1.0;                           // the ring first, the words a moment later

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------------------------------------------------------- player */

  function Player(root, data) {
    this.root = root;
    this.items = data.items;
    this.chapters = data.chapters || {};
    this.mode = root.getAttribute("data-mode") || "carousel";   // carousel | single | reel
    this.index = 0;
    this.muted = true;
    this.paused = false;
    this.timer = null;
    this.raf = null;

    this.screen = root.querySelector(".screen");
    this.video = root.querySelector("video");
    this.overlay = root.querySelector(".overlay");
    this.card = root.querySelector(".titlecard");
    this.hold = root.querySelector(".hold");
    this.text = root.querySelector(".showcase-text");
    this.tabs = Array.prototype.slice.call(root.querySelectorAll("[data-goto]"));
    this.btnPrev = root.querySelector("[data-act=prev]");
    this.btnNext = root.querySelector("[data-act=next]");
    this.btnPlay = root.querySelector("[data-act=play]");
    this.btnSound = root.querySelector("[data-act=sound]");

    var url = new URLSearchParams(location.search);
    if (url.get("frame")) root.querySelector(".device").setAttribute("data-frame", url.get("frame"));

    this.ring = el("div", "ring");
    this.callout = el("div", "callout");
    this.callout.setAttribute("aria-hidden", "true");
    this.overlay.appendChild(this.ring);
    this.overlay.appendChild(this.callout);
    this.touches = [];                                // fingertip dots, made as needed

    this.video.controls = false;
    this.video.muted = true;
    this.video.playsInline = true;
    this.bind();
  }

  Player.prototype.bind = function () {
    var self = this;
    this.video.addEventListener("ended", function () { self.onEnded(); });
    this.video.addEventListener("play", function () { self.tick(); self.sync(); });
    this.video.addEventListener("pause", function () { self.sync(); });
    this.tabs.forEach(function (t) {
      t.addEventListener("click", function () { self.go(+t.getAttribute("data-goto"), true); });
    });
    if (this.btnPrev) this.btnPrev.addEventListener("click", function () { self.step(-1); });
    if (this.btnNext) this.btnNext.addEventListener("click", function () { self.step(1); });
    if (this.btnPlay) this.btnPlay.addEventListener("click", function () { self.toggle(); });
    if (this.btnSound) this.btnSound.addEventListener("click", function () { self.toggleSound(); });
    // The whole screen is the biggest target on the page: a tap pauses and resumes.
    this.screen.addEventListener("click", function () { self.toggle(); });
    this.root.addEventListener("keydown", function (e) {
      if (e.target.closest("button, a")) {
        if (e.key === "ArrowRight") { self.step(1); e.preventDefault(); }
        if (e.key === "ArrowLeft") { self.step(-1); e.preventDefault(); }
      }
    });
  };

  Player.prototype.start = function (i) {
    this.go(i || 0, false);
  };

  Player.prototype.step = function (d) {
    var n = this.items.length;
    this.go((this.index + d + n) % n, true);
  };

  Player.prototype.go = function (i, user) {
    var self = this, item = this.items[i];
    clearTimeout(this.timer);
    this.index = i;
    if (user) this.paused = false;
    this.video.pause();
    this.clearCue();
    this.root.setAttribute("data-kind", item.kind);

    this.tabs.forEach(function (t) {
      var on = +t.getAttribute("data-goto") === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    if (this.text) {
      this.text.innerHTML =
        (item.glyph ? '<div class="glyph">' + esc(item.glyph) + "</div>" : "") +
        "<h3>" + esc(item.title) + "</h3>" +
        (item.text ? "<p>" + esc(item.text) + "</p>" : "") +
        (item.kind === "placeholder" ? '<p class="soon">Video coming soon.</p>' : "");
    }

    if (item.kind === "chapter") {
      this.showCard(item.eyebrow || "", item.title, item.line || "", true);
      this.video.removeAttribute("src");
      this.hold.style.backgroundImage = item.poster ? "url(" + item.poster + ")" : "";
      this.timer = setTimeout(function () { self.onEnded(); }, CHAPTER_SECONDS * 1000);
      this.sync();
      return;
    }
    if (item.kind === "placeholder") {
      this.video.removeAttribute("src");
      this.video.load();
      this.hold.style.backgroundImage = "";
      this.showCard(item.glyph || "", item.title, "Video coming soon", true);
      if (this.mode !== "single") {
        this.timer = setTimeout(function () { self.onEnded(); }, 5000);
      }
      this.sync();
      return;
    }

    // A short: its title card over its first frame, then the video.
    this.video.src = item.src;
    this.video.poster = item.poster || "";
    this.hold.style.backgroundImage = item.poster ? "url(" + item.poster + ")" : "";
    this.video.currentTime = 0;
    this.showCard(item.eyebrow || "", item.title, "", false);
    this.timer = setTimeout(function () {
      self.hideCard();
      if (!self.paused) self.play();
      self.sync();
    }, (user && this.mode === "carousel" ? TITLE_SECONDS * 0.8 : TITLE_SECONDS) * 1000);
    this.sync();
  };

  Player.prototype.play = function () {
    var self = this;
    this.video.muted = this.muted;
    var p = this.video.play();
    if (p && p.catch) p.catch(function () {
      // Autoplay refused: show the poster and wait for a tap.
      self.paused = true;
      self.sync();
    });
  };

  Player.prototype.toggle = function () {
    var item = this.items[this.index];
    if (item.kind !== "short") {
      this.paused = !this.paused;
      if (this.paused) clearTimeout(this.timer); else this.onEnded();
      this.sync();
      return;
    }
    if (this.card.classList.contains("on")) {        // during the title card
      this.paused = !this.paused;
      if (!this.paused) { clearTimeout(this.timer); this.hideCard(); this.play(); }
      this.sync();
      return;
    }
    if (this.video.paused) { this.paused = false; this.play(); }
    else { this.paused = true; this.video.pause(); }
    this.sync();
  };

  Player.prototype.toggleSound = function () {
    this.muted = !this.muted;
    this.video.muted = this.muted;
    this.sync();
  };

  Player.prototype.onEnded = function () {
    if (this.paused) return;
    if (this.mode === "single") { this.showCard("", this.items[0].title, "Tap to watch again", false); this.paused = true; this.sync(); return; }
    if (this.mode === "reel" && this.index === this.items.length - 1) { this.paused = true; this.sync(); return; }
    this.step(1);
    this.paused = false;
  };

  Player.prototype.sync = function () {
    var item = this.items[this.index];
    var playing = item.kind === "short" ? !this.video.paused || (this.card.classList.contains("on") && !this.paused) : !this.paused;
    if (this.btnPlay) {
      this.btnPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
      this.btnPlay.querySelector(".lbl").textContent = playing ? "Pause" : "Play";
      this.btnPlay.classList.toggle("is-playing", playing);
    }
    if (this.btnSound) {
      this.btnSound.setAttribute("aria-pressed", this.muted ? "false" : "true");
      this.btnSound.querySelector(".lbl").textContent = this.muted ? "Sound off" : "Sound on";
      this.btnSound.hidden = item.kind !== "short" || !!item.silent;
    }
    this.root.classList.toggle("is-paused", !playing);
  };

  /* ------------------------------------------------------- the title card */

  Player.prototype.showCard = function (eyebrow, title, line, solid) {
    var words = String(title).split(/\s+/).map(function (w, i) {
      return '<span class="w" style="--i:' + i + '">' + esc(w) + "</span>";
    }).join(" ");
    this.card.innerHTML =
      (eyebrow ? '<div class="eyebrow">' + esc(eyebrow) + "</div>" : "") +
      '<div class="rule"></div><div class="title">' + words + "</div>" +
      (line ? '<div class="line">' + esc(line) + "</div>" : "");
    this.card.classList.toggle("solid", !!solid);
    this.card.classList.remove("on");
    void this.card.offsetWidth;                       // restart the entrance
    this.card.classList.add("on");
    this.root.classList.add("carding");
  };

  Player.prototype.hideCard = function () {
    this.card.classList.remove("on");
    this.root.classList.remove("carding");
  };

  /* ------------------------------------------------- the ring and callout */

  Player.prototype.clearCue = function () {
    this.cue = null;
    this.ring.className = "ring";
    this.callout.className = "callout";
    this.touches.forEach(function (d) { d.style.opacity = 0; });
  };

  Player.prototype.tick = function () {
    var self = this;
    cancelAnimationFrame(this.raf);
    var loop = function () {
      self.drawCue();
      if (!self.video.paused) self.raf = requestAnimationFrame(loop);
    };
    loop();
  };

  Player.prototype.drawCue = function () {
    var item = this.items[this.index];
    if (!item || item.kind !== "short") return;
    var t = this.video.currentTime, cue = null;
    (item.cues || []).forEach(function (c) { if (t >= c.t && t < c.t + c.d) cue = c; });
    if (cue !== this.cue) {
      this.cue = cue;
      if (!cue) { this.ring.className = "ring"; this.callout.className = "callout"; }
      else {
        this.place(cue);
        // The callout says where to look; the screen shows the change.
        // A glow only where a cue asks for one ("glow": true) — round a tab,
        // a button or a panel it fought the shape it sat on (Joe, Oct 1).
        this.ring.className = cue.glow ? "ring on" + (cue.tap ? " tap" : "") : "ring";
        this.callout.className = "callout";
      }
    }
    if (cue) {
      // With a glow, the glow first and the words a moment later; without
      // one the words come at once, timed a second ahead of the tap they name.
      var lead = cue.glow ? Math.min(CALLOUT_LEAD, cue.d * 0.35) : 0;
      this.callout.classList.toggle("on", t >= cue.t + lead && t < cue.t + cue.d - 0.15);
      if (this.ring.classList.contains("on")) this.ring.classList.toggle("off", t >= cue.t + cue.d - 0.2);
    }
    this.drawTouches(item, t);
  };

  /* The fingertip: every tap in the short ("taps" in shorts.json) drawn
     where and when the finger touched. A tap comes down, presses and lifts
     with a ripple; a drag ("to", "d") comes down, travels and lifts. All
     worked out from the video's time, so it pauses and seeks with it. */
  var TOUCH_IN = 0.14, TOUCH_HOLD = 0.22, TOUCH_OUT = 0.28, RIPPLE = 0.6;
  function ease(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }

  Player.prototype.drawTouches = function (item, t) {
    var taps = item.taps || [], self = this, n = 0;
    taps.forEach(function (tp) {
      var p = t - tp.t, d = tp.d || 0, end = d + TOUCH_HOLD + TOUCH_OUT;
      if (p < -TOUCH_IN || p > Math.max(end, RIPPLE)) return;
      var dot = self.touches[n];
      if (!dot) {
        dot = self.touches[n] = el("div", "touch");
        dot.setAttribute("aria-hidden", "true");
        dot.appendChild(el("div", "ripple"));
        self.overlay.appendChild(dot);
      }
      n++;
      // Where: at the start, or along the drag.
      var x = tp.at[0], y = tp.at[1];
      if (tp.to && d > 0) {
        var k = ease(clamp((p - 0.08) / d, 0, 1));
        x += (tp.to[0] - x) * k; y += (tp.to[1] - y) * k;
      }
      // How: coming down, pressed, lifting.
      var op, sc;
      if (p < 0) { op = 1 + p / TOUCH_IN; sc = 1.25 + 0.25 * (-p / TOUCH_IN); }
      else if (p < d + TOUCH_HOLD) { op = 1; sc = 1 - 0.16 * Math.min(1, p / 0.1); }
      else { var q = (p - d - TOUCH_HOLD) / TOUCH_OUT; op = Math.max(0, 1 - q); sc = 0.84 + 0.3 * Math.min(1, q); }
      if (reduceMotion) sc = 1;
      dot.style.left = x + "%";
      dot.style.top = y + "%";
      dot.style.opacity = clamp(op, 0, 1);
      dot.style.transform = "scale(" + sc + ")";
      var r = dot.firstChild, rp = p / RIPPLE;
      if (!reduceMotion && rp > 0 && rp < 1) {
        r.style.opacity = 0.9 * (1 - rp);
        r.style.transform = "scale(" + (1 + 1.7 * ease(rp)) / sc + ")";
      } else {
        r.style.opacity = 0;
      }
    });
    for (var i = n; i < this.touches.length; i++) this.touches[i].style.opacity = 0;
  };

  /* Place the callout where it covers neither the thing it points at nor
     falls off the screen: below, above, right or left, nearest first. All
     in % of the screen, which is the video's own coordinate space. */
  Player.prototype.place = function (cue) {
    var b = cue.box, pad = 0.4;
    var bx = b[0] - pad, by = b[1] - pad, bw = b[2] + pad * 2, bh = b[3] + pad * 2;
    this.ring.style.left = bx + "%";
    this.ring.style.top = by + "%";
    this.ring.style.width = bw + "%";
    this.ring.style.height = bh + "%";

    this.callout.textContent = cue.text;
    var sw = this.screen.clientWidth || 1, sh = this.screen.clientHeight || 1;
    this.callout.style.left = "0"; this.callout.style.top = "0";
    var cw = this.callout.offsetWidth / sw * 100, ch = this.callout.offsetHeight / sh * 100;
    var gapY = 4.5, gapX = 3.2, cx = bx + bw / 2, cy = by + bh / 2;
    var tries = [
      ["below", cx - cw / 2, by + bh + gapY],
      ["above", cx - cw / 2, by - gapY - ch],
      ["right", bx + bw + gapX, cy - ch / 2],
      ["left", bx - gapX - cw, cy - ch / 2]
    ];
    var pick = null;
    for (var i = 0; i < tries.length && !pick; i++) {
      var x = tries[i][1], y = tries[i][2];
      if (y >= 1 && y + ch <= 99 && x + cw > 1 && x < 99) pick = tries[i];
    }
    if (!pick) pick = ["inside", cx - cw / 2, by + bh - ch - 2];   // a box that fills the screen
    var px = clamp(pick[1], 1.5, 98.5 - cw), py = clamp(pick[2], 1, 99 - ch);
    this.callout.style.left = px + "%";
    this.callout.style.top = py + "%";
    this.callout.setAttribute("data-side", pick[0]);
    // The tail points at the middle of the box, wherever the callout landed.
    var tail = pick[0] === "below" || pick[0] === "above"
      ? clamp((cx - px) / cw * 100, 12, 88)
      : clamp((cy - py) / ch * 100, 20, 80);
    this.callout.style.setProperty("--tail", tail + "%");
  };

  /* ------------------------------------------------------------- start-up */

  function init(root) {
    var json = root.querySelector("script[type='application/json']");
    if (!json) return;
    var player = new Player(root, JSON.parse(json.textContent));
    root.player = player;
    root.classList.add("js");
    var startAt = 0, hash = location.hash.slice(1);
    player.items.forEach(function (it, i) { if (it.id && it.id === hash) startAt = i; });
    if (root.getAttribute("data-mode") === "carousel" && "IntersectionObserver" in window) {
      // Start when it scrolls into view; pause when it scrolls away.
      var begun = false;
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !begun) { begun = true; player.start(startAt); }
          else if (!e.isIntersecting && begun && !player.video.paused) { player.video.pause(); player.sync(); }
        });
      }, { threshold: 0.4 }).observe(root);
    } else if (root.getAttribute("data-mode") === "single") {
      // A single video waits on its title card for a tap, with sound on.
      player.paused = true;
      player.muted = false;
      player.go(0, false);
    } else {
      player.start(startAt);
    }
  }

  /* The tutorials page: each tile opens the reel at its short. */
  function initTiles() {
    var dlg = document.getElementById("reel-dialog");
    if (!dlg) return;
    var root = dlg.querySelector("[data-shorts]");
    var opened = false;
    function open(id) {
      if (!opened) { init(root); opened = true; }
      var p = root.player, at = 0;
      p.items.forEach(function (it, i) { if (it.id === id) at = i; });
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      p.muted = false;
      p.paused = false;
      p.go(at, true);
    }
    document.querySelectorAll("[data-open]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); open(b.getAttribute("data-open")); });
    });
    dlg.addEventListener("close", function () { if (root.player) { root.player.paused = true; root.player.video.pause(); clearTimeout(root.player.timer); } });
    dlg.querySelector("[data-act=close]").addEventListener("click", function () { dlg.close(); });
    if (location.hash === "#play-all") open("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-shorts]").forEach(function (r) {
      if (!r.closest("dialog")) init(r);
    });
    initTiles();
  });
})();
