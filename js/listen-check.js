/* A recording checked against its text (listen-zh-hant.html): the verse being
   read is lit, a verse plays from where it is tapped, and a listener marks a
   verse with a note. The marks stay on this device (localStorage, if it can)
   until they are sent by email or copied into a message. No server. */
(function () {
  var data = JSON.parse(document.getElementById("check-data").textContent);
  var KEY = "listen-zh-hant-john3";
  var state = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { marks: {}, form: {} }; }
    catch (e) { return { marks: {}, form: {} }; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window: kept in memory */ }
    count();
  }

  var panels = Array.prototype.slice.call(document.querySelectorAll(".check-panel"));
  var audios = [];

  panels.forEach(function (panel) {
    var bible = panel.dataset.bible;
    var verses = data[bible].verses;
    var audio = panel.querySelector("audio");
    var list = panel.querySelector(".check-verses");
    audios.push(audio);
    var rows = verses.map(function (v) {
      var li = document.createElement("li");
      var key = bible + ":" + v.v;
      var b = document.createElement("button");
      b.className = "check-verse";
      b.type = "button";
      b.innerHTML = "<sup>" + v.v + "</sup>";
      b.appendChild(document.createTextNode(v.t));
      b.setAttribute("aria-label", "第" + v.v + "節，從這裡播放：" + v.t);
      b.addEventListener("click", function () { audio.currentTime = v.s; audio.play(); });
      var m = document.createElement("button");
      m.className = "check-mark";
      m.type = "button";
      m.textContent = "標記";
      m.setAttribute("aria-label", "標記第" + v.v + "節");
      var note = document.createElement("textarea");
      note.rows = 2;
      note.placeholder = "哪個字？應該怎麼讀？（例如：「重生」的「重」應讀 chóng）";
      note.setAttribute("aria-label", "第" + v.v + "節的意見");
      function show(on) {
        li.classList.toggle("marked", on);
        m.setAttribute("aria-pressed", on ? "true" : "false");
        note.hidden = !on;
      }
      var mark = state.marks[key];
      show(!!mark);
      if (mark) note.value = mark.note || "";
      m.addEventListener("click", function () {
        var on = !state.marks[key];
        if (on) { state.marks[key] = { note: note.value }; } else { delete state.marks[key]; }
        show(on); save();
        if (on) note.focus();
      });
      note.addEventListener("input", function () {
        if (state.marks[key]) { state.marks[key].note = note.value; save(); }
      });
      li.appendChild(b); li.appendChild(m); li.appendChild(note);
      list.appendChild(li);
      return li;
    });

    var lit = -1;
    audio.addEventListener("timeupdate", function () {
      var t = audio.currentTime, i = -1;
      for (var k = 0; k < verses.length; k++) { if (verses[k].s <= t + 0.05) i = k; else break; }
      if (i === lit) return;
      if (lit >= 0) rows[lit].classList.remove("now");
      lit = i;
      if (i >= 0) {
        rows[i].classList.add("now");
        if (!audio.paused) rows[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    audio.addEventListener("play", function () {
      audios.forEach(function (a) { if (a !== audio) a.pause(); });
    });

    var speeds = panel.querySelectorAll(".check-speed button");
    Array.prototype.forEach.call(speeds, function (s) {
      s.addEventListener("click", function () {
        audio.playbackRate = parseFloat(s.dataset.rate);
        Array.prototype.forEach.call(speeds, function (o) { o.setAttribute("aria-pressed", o === s ? "true" : "false"); });
      });
    });
  });

  // Tabs: one Bible at a time; arrows move between them.
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".check-tabs [role=tab]"));
  function select(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    audios.forEach(function (a) { a.pause(); });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(t); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      var next = tabs[(i + d + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });

  // The questions at the end, kept like the marks.
  var form = document.getElementById("check-form");
  Array.prototype.forEach.call(form.elements, function (el) {
    if (!el.name) return;
    var saved = state.form[el.name];
    if (el.type === "radio") el.checked = saved === el.value; else if (saved) el.value = saved;
    el.addEventListener(el.type === "radio" ? "change" : "input", function () {
      state.form[el.name] = el.value; save();
    });
  });

  function report() {
    var lines = ["約翰福音第三章 · 繁體朗讀試聽（雲健）", ""];
    panels.forEach(function (panel) {
      var bible = panel.dataset.bible;
      var marked = data[bible].verses.filter(function (v) { return state.marks[bible + ":" + v.v]; });
      lines.push("【" + panel.dataset.name + "】" + (marked.length ? "" : "沒有標記"));
      marked.forEach(function (v) {
        lines.push("第" + v.v + "節：" + (state.marks[bible + ":" + v.v].note || "（未寫說明）"));
        lines.push("　經文：" + v.t);
      });
      lines.push("");
    });
    var f = state.form;
    lines.push("聲音：" + (f.natural || "—") + "　速度：" + (f.pace || "—") + "　平常讀：" + (f.bible || "—"));
    if (f.other) lines.push("其他意見：" + f.other);
    if (f.who) lines.push("名字：" + f.who);
    return lines.join("\n");
  }

  function count() {
    var n = Object.keys(state.marks).length;
    form.querySelector(".check-count").textContent = n ? "您已標記 " + n + " 節。" : "";
  }
  count();

  var status = form.querySelector(".check-status");
  document.getElementById("check-email").addEventListener("click", function () {
    var href = "mailto:" + form.dataset.email +
      "?subject=" + encodeURIComponent("繁體朗讀試聽意見：約翰福音第三章") +
      "&body=" + encodeURIComponent(report());
    window.location.href = href;
    status.textContent = "已開啟電子郵件。如果沒有出現，請改按「複製意見」，貼到訊息裡傳給我們。";
  });
  document.getElementById("check-copy").addEventListener("click", function () {
    var text = report();
    function done() { status.textContent = "已複製。請貼到訊息或電子郵件裡傳給我們。"; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { status.textContent = "無法自動複製，請手動選取。"; }
      ta.remove();
    }
  });
})();
