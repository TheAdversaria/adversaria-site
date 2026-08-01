/* ============================================================
   THE MARGINALIA — reader.js
   Shared engine for themes, typography, highlighting, search,
   bookmarks, table of contents, focus mode, and read-aloud.
   Vanilla JS, no dependencies. Everything persists to
   localStorage so it survives a reload.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     0. Catalog data — mirrors index.html, used for global
        search from any page.
  --------------------------------------------------------- */
  const CATALOG = [
    {
      id: "ms014", num: "MS. 014", status: "Ch. 19 · ongoing",
      title: "The Correspondence of Vane & Ashworth",
      desc: "Two scholars, one dead language, and a translation neither of them will admit is also a love letter.",
      tags: ["Epistolary", "Dark academia", "Annotated"],
      url: "manuscript.html"
    },
    {
      id: "ms013", num: "MS. 013", status: "Complete · 32 chapters",
      title: "A Catalogue of Small Heresies",
      desc: "A librarian is asked to catalogue a collection that shouldn't exist.",
      tags: ["Gothic", "Novella"],
      url: "index.html#catalog"
    },
    {
      id: "ms009", num: "MS. 009", status: "Ch. 7 · ongoing",
      title: "Notes Toward a Drowned Library",
      desc: "The last reader of a flooding archive keeps a running log of what she saves.",
      tags: ["Literary", "Slow burn"],
      url: "index.html#catalog"
    },
    {
      id: "ms002", num: "MS. 002", status: "Complete · 41 chapters",
      title: "The Amanuensis",
      desc: "A scribe hired to copy a dying poet's final work begins, quietly, to change it.",
      tags: ["Historical", "Debut"],
      url: "index.html#catalog"
    }
  ];

  /* ---------------------------------------------------------
     1. Settings — themes, type, layout, brightness, focus
  --------------------------------------------------------- */
  const SETTINGS_KEY = "marg:settings";
  const DEFAULT_SETTINGS = {
    theme: "lamplit",
    font: "serif",
    fontSize: 18,
    lineHeight: 1.85,
    measure: 62,
    dimmer: 0,
    focus: false,
    dyslexic: false,
    ttsRate: 1
  };

  const FONT_STACKS = {
    serif:   '"Source Serif 4", Georgia, serif',
    classic: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
    sans:    '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono:    '"IBM Plex Mono", Menlo, Consolas, "Courier New", monospace'
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)) : Object.assign({}, DEFAULT_SETTINGS);
    } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  let settings = loadSettings();

  function applySettings() {
    const root = document.documentElement;
    root.setAttribute("data-theme", settings.theme);
    root.style.setProperty("--reading-font", FONT_STACKS[settings.font] || FONT_STACKS.serif);
    root.style.setProperty("--reading-font-size", settings.fontSize + "px");
    root.style.setProperty("--reading-line-height", settings.lineHeight);
    root.style.setProperty("--reading-measure", settings.measure + "ch");
    root.style.setProperty("--reading-letter-spacing", settings.dyslexic ? "0.035em" : "normal");
    root.style.setProperty("--reading-word-spacing", settings.dyslexic ? "0.16em" : "normal");

    const dim = document.getElementById("dimmerOverlay");
    if (dim) dim.style.opacity = (settings.dimmer / 100).toString();

    // Focus mode is only meaningful on the chapter-reading page, which is the
    // only place with a toolbar to turn it back off. If it somehow carried
    // over to any other page, switch it off here rather than let it hide
    // that page's header with no way back.
    if (settings.focus && !document.querySelector(".manuscript")) {
      settings.focus = false;
      saveSettings(settings);
    }
    document.body.classList.toggle("is-focus", !!settings.focus);

    // reflect state in controls if present
    document.querySelectorAll(".theme-swatch").forEach(el => {
      el.classList.toggle("is-active", el.dataset.theme === settings.theme);
    });
    const activeSwatch = document.querySelector('.theme-swatch[data-theme="' + settings.theme + '"]');
    const pickerDot = document.getElementById("themePickerDot");
    const pickerName = document.getElementById("themePickerName");
    if (activeSwatch && pickerDot && pickerName) {
      pickerDot.style.setProperty("--sw", activeSwatch.style.getPropertyValue("--sw"));
      const labelSpan = activeSwatch.querySelector("span");
      pickerName.textContent = labelSpan ? labelSpan.textContent : settings.theme;
    }
    document.querySelectorAll("#fontPills .pill").forEach(el => {
      el.classList.toggle("is-active", el.dataset.font === settings.font);
    });
    const fsRange = document.getElementById("fontSizeRange");
    const lhRange = document.getElementById("lineHeightRange");
    const mRange = document.getElementById("measureRange");
    const dRange = document.getElementById("dimmerRange");
    const dyToggle = document.getElementById("dyslexicToggle");
    const focusToggle = document.getElementById("focusToggle");
    if (fsRange) { fsRange.value = settings.fontSize; setRangeLabel(fsRange, settings.fontSize + "px"); }
    if (lhRange) { lhRange.value = settings.lineHeight; setRangeLabel(lhRange, settings.lineHeight.toFixed(2)); }
    if (mRange)  { mRange.value = settings.measure; setRangeLabel(mRange, settings.measure + "ch"); }
    if (dRange)  { dRange.value = settings.dimmer; setRangeLabel(dRange, settings.dimmer + "%"); }
    if (dyToggle) dyToggle.checked = !!settings.dyslexic;
    if (focusToggle) focusToggle.checked = !!settings.focus;

    document.querySelectorAll(".rt-btn[data-role='focus']").forEach(b => b.classList.toggle("is-active", !!settings.focus));
  }

  function setRangeLabel(rangeEl, text) {
    const label = rangeEl.parentElement && rangeEl.parentElement.querySelector(".range-value");
    if (label) label.textContent = text;
  }

  function updateSetting(key, value) {
    settings[key] = value;
    saveSettings(settings);
    applySettings();
  }

  /* ---------------------------------------------------------
     2. Modal / drawer plumbing
  --------------------------------------------------------- */
  function openEl(el) { if (el) el.hidden = false; }
  function closeEl(el) { if (el) el.hidden = true; }
  function toggleEl(el) { if (el) el.hidden = !el.hidden; }

  function wireDrawer(toggleIds, overlayId, panelId, closeIds) {
    const overlay = document.getElementById(overlayId);
    const panel = document.getElementById(panelId);
    toggleIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", () => {
        openEl(overlay); openEl(panel);
        const input = panel && panel.querySelector("input[type=text]");
        if (input) setTimeout(() => input.focus(), 30);
      });
    });
    closeIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", () => { closeEl(overlay); closeEl(panel); });
    });
    if (overlay) overlay.addEventListener("click", (e) => {
      if (e.target === overlay) { closeEl(overlay); closeEl(panel); }
    });
  }

  /* ---------------------------------------------------------
     3. Search — global catalog + in-page (chapter) search
  --------------------------------------------------------- */
  function initSearch() {
    const input = document.getElementById("searchInput");
    const results = document.getElementById("searchResults");
    if (!input || !results) return;

    function highlight(text, q) {
      if (!q) return text;
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      if (idx === -1) return text;
      return text.slice(0, idx) + "<mark>" + text.slice(idx, idx + q.length) + "</mark>" + text.slice(idx + q.length);
    }

    function paraSnippets(q) {
      const out = [];
      document.querySelectorAll(".column-text p[data-para]").forEach(p => {
        const t = p.textContent;
        const idx = t.toLowerCase().indexOf(q.toLowerCase());
        if (idx > -1) {
          const start = Math.max(0, idx - 40);
          const snippet = (start > 0 ? "…" : "") + t.slice(start, idx + q.length + 60) + "…";
          out.push({ para: p.dataset.para, snippet, text: t });
        }
      });
      return out;
    }

    function render(q) {
      results.innerHTML = "";
      if (!q.trim()) {
        results.innerHTML = '<div class="search-empty">Search titles, tags, or — on a chapter page — the text itself.</div>';
        return;
      }
      const ql = q.toLowerCase();
      let count = 0;

      // in-page chapter matches first, if on a manuscript page
      const inPage = paraSnippets(q);
      inPage.forEach(m => {
        count++;
        const div = document.createElement("div");
        div.className = "search-result";
        div.innerHTML = `<span class="search-result-title">In this chapter</span>
          <span class="search-result-meta">Paragraph ${parseInt(m.para, 10) + 1}</span>
          <span class="search-result-snippet">${highlight(m.snippet, q)}</span>`;
        div.addEventListener("click", () => {
          const p = document.querySelector(`.column-text p[data-para="${m.para}"]`);
          if (p) {
            closeEl(document.getElementById("searchOverlay"));
            closeEl(document.getElementById("searchModal") || document.getElementById("searchOverlay"));
            p.scrollIntoView({ behavior: "smooth", block: "center" });
            p.style.transition = "background .4s ease";
            p.style.background = "rgba(201,138,62,0.14)";
            setTimeout(() => { p.style.background = ""; }, 1400);
          }
          document.getElementById("searchOverlay").hidden = true;
        });
        results.appendChild(div);
      });

      // catalog matches
      CATALOG.forEach(entry => {
        const hay = (entry.title + " " + entry.desc + " " + entry.tags.join(" ")).toLowerCase();
        if (hay.indexOf(ql) > -1) {
          count++;
          const div = document.createElement("div");
          div.className = "search-result";
          div.innerHTML = `<span class="search-result-title">${highlight(entry.title, q)}</span>
            <span class="search-result-meta">${entry.num} · ${entry.status}</span>
            <span class="search-result-snippet">${highlight(entry.desc, q)}</span>`;
          div.addEventListener("click", () => { window.location.href = entry.url; });
          results.appendChild(div);
        }
      });

      if (count === 0) {
        results.innerHTML = '<div class="search-empty">Nothing in the archive matches that yet.</div>';
      }
    }

    input.addEventListener("input", () => render(input.value));
    render("");

    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        openEl(document.getElementById("searchOverlay"));
        input.focus();
      }
      if (e.key === "Escape") {
        closeEl(document.getElementById("searchOverlay"));
        closeEl(document.getElementById("settingsOverlay"));
        closeEl(document.getElementById("settingsDrawer"));
        closeEl(document.getElementById("tocDrawer"));
        closeEl(document.getElementById("hlToolbar"));
        closeEl(document.getElementById("hlPopover"));
        closeEl(document.getElementById("themeModalOverlay"));
        closeEl(document.getElementById("themeModal"));
        if (settings.focus) { updateSetting("focus", false); }
      }
    });
  }

  /* ---------------------------------------------------------
     4. Highlighter engine (manuscript pages only)
  --------------------------------------------------------- */
  const HL_COLORS = {
    amber:  "#C98A3E",
    sage:   "#7A8B5E",
    sky:    "#6C93B8",
    rose:   "#B25C5C",
    violet: "#8B6FA8"
  };

  function pageId() {
    return document.body.dataset.pageId || "page";
  }
  function hlKey() { return "marg:hl:" + pageId(); }

  function loadHighlights() {
    try { return JSON.parse(localStorage.getItem(hlKey()) || "[]"); } catch (e) { return []; }
  }
  function saveHighlights(list) {
    try { localStorage.setItem(hlKey(), JSON.stringify(list)); } catch (e) {}
  }

  function textOffsetInPara(range, para) {
    const pre = range.cloneRange();
    pre.selectNodeContents(para);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const end = start + range.toString().length;
    return { start, end };
  }

  function rangeFromOffsets(para, start, end) {
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT, null);
    let node, pos = 0;
    const range = document.createRange();
    let startSet = false;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (!startSet && pos + len >= start) {
        range.setStart(node, start - pos);
        startSet = true;
      }
      if (startSet && pos + len >= end) {
        range.setEnd(node, end - pos);
        return range;
      }
      pos += len;
    }
    return null;
  }

  function applyHighlightMark(range, id, color, style, note) {
    const mark = document.createElement("mark");
    mark.className = "hl hl-" + style + (note ? " has-note" : "");
    mark.style.setProperty("--hlc", HL_COLORS[color] || HL_COLORS.amber);
    mark.dataset.hlId = id;
    try {
      range.surroundContents(mark);
      return mark;
    } catch (e) {
      // selection spans multiple nodes/elements — wrap fragment instead
      const frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
      return mark;
    }
  }

  function restoreHighlights() {
    const list = loadHighlights();
    list.forEach(h => {
      const para = document.querySelector(`.column-text p[data-para="${h.para}"]`);
      if (!para) return;
      const range = rangeFromOffsets(para, h.start, h.end);
      if (range) applyHighlightMark(range, h.id, h.color, h.style, h.note);
    });
    renderReaderNotes();
    refreshMarkList();
  }

  function renderReaderNotes() {
    // remove previously injected reader notes, then re-add from current highlights with notes
    document.querySelectorAll(".marg-note.is-reader").forEach(n => n.remove());
    const margin = document.querySelector(".column-margin");
    if (!margin) return;
    const list = loadHighlights().filter(h => h.note);
    list.forEach(h => {
      const div = document.createElement("div");
      div.className = "marg-note is-reader";
      div.innerHTML = `<span class="marg-tag">your note</span>${escapeHtml(h.note)}`;
      margin.appendChild(div);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  let pendingRange = null;
  let activeHlToolbarColor = "amber";
  let activeHlToolbarStyle = "fill";

  function initHighlighter() {
    const columnText = document.querySelector(".column-text");
    if (!columnText) return;

    // tag paragraphs with data-para for offset addressing
    let i = 0;
    columnText.querySelectorAll("p").forEach(p => { p.dataset.para = i++; });

    restoreHighlights();

    const toolbar = document.getElementById("hlToolbar");
    const popover = document.getElementById("hlPopover");

    document.addEventListener("mouseup", (e) => {
      if (popover && !popover.hidden && !popover.contains(e.target)) closeEl(popover);
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { return; }
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const para = (container.nodeType === 1 ? container : container.parentElement) && (container.nodeType === 1 ? container : container.parentElement).closest("p[data-para]");
      if (!para || !columnText.contains(para) || !range.toString().trim()) { closeEl(toolbar); return; }
      pendingRange = { range, para };
      const rect = range.getBoundingClientRect();
      toolbar.style.top = Math.max(10, rect.top - 54) + "px";
      toolbar.style.left = Math.min(window.innerWidth - 260, Math.max(10, rect.left)) + "px";
      openEl(toolbar);
    });

    if (toolbar) {
      toolbar.querySelectorAll(".hl-swatch").forEach(sw => {
        sw.addEventListener("click", () => {
          activeHlToolbarColor = sw.dataset.color;
          toolbar.querySelectorAll(".hl-swatch").forEach(s => s.classList.remove("is-active"));
          sw.classList.add("is-active");
          commitHighlight();
        });
      });
      toolbar.querySelectorAll(".hl-style-btn").forEach(sb => {
        sb.addEventListener("click", () => {
          activeHlToolbarStyle = sb.dataset.style;
          toolbar.querySelectorAll(".hl-style-btn").forEach(s => s.classList.remove("is-active"));
          sb.classList.add("is-active");
          commitHighlight();
        });
      });
      const noteBtn = document.getElementById("hlAddNote");
      if (noteBtn) noteBtn.addEventListener("click", () => {
        const id = commitHighlight();
        if (id) openHlPopoverFor(id, true);
      });
    }

    function commitHighlight() {
      if (!pendingRange) return null;
      const { range, para } = pendingRange;
      const offs = textOffsetInPara(range, para);
      if (offs.end <= offs.start) return null;
      const id = "hl_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      const text = range.toString();
      applyHighlightMark(range.cloneRange(), id, activeHlToolbarColor, activeHlToolbarStyle, "");
      const list = loadHighlights();
      list.push({ id, para: para.dataset.para, start: offs.start, end: offs.end, color: activeHlToolbarColor, style: activeHlToolbarStyle, text, note: "" });
      saveHighlights(list);
      closeEl(toolbar);
      window.getSelection().removeAllRanges();
      refreshMarkList();
      return id;
    }

    // clicking an existing highlight -> popover to edit/remove
    columnText.addEventListener("click", (e) => {
      const mark = e.target.closest(".hl");
      if (!mark) return;
      openHlPopoverFor(mark.dataset.hlId, false, mark);
    });

    function openHlPopoverFor(id, focusNote, markEl) {
      if (!popover) return;
      const list = loadHighlights();
      const item = list.find(h => h.id === id);
      if (!item) return;
      const textarea = document.getElementById("hlNoteInput");
      textarea.value = item.note || "";
      const rect = (markEl || document.querySelector(`.hl[data-hl-id="${id}"]`) || {}).getBoundingClientRect
        ? (markEl || document.querySelector(`.hl[data-hl-id="${id}"]`)).getBoundingClientRect()
        : { top: 100, left: 100 };
      popover.style.top = Math.min(window.innerHeight - 160, rect.top + 24) + "px";
      popover.style.left = Math.min(window.innerWidth - 280, Math.max(10, rect.left)) + "px";
      openEl(popover);
      if (focusNote) setTimeout(() => textarea.focus(), 30);

      document.getElementById("hlSaveNote").onclick = () => {
        const list2 = loadHighlights();
        const it2 = list2.find(h => h.id === id);
        if (it2) {
          it2.note = textarea.value.trim();
          saveHighlights(list2);
          const el = document.querySelector(`.hl[data-hl-id="${id}"]`);
          if (el) el.classList.toggle("has-note", !!it2.note);
          renderReaderNotes();
          refreshMarkList();
        }
        closeEl(popover);
      };
      document.getElementById("hlRemove").onclick = () => {
        const list2 = loadHighlights().filter(h => h.id !== id);
        saveHighlights(list2);
        document.querySelectorAll(`.hl[data-hl-id="${id}"]`).forEach(el => {
          const parent = el.parentNode;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          parent.normalize();
        });
        renderReaderNotes();
        refreshMarkList();
        closeEl(popover);
      };
    }
  }

  /* ---------------------------------------------------------
     5. Bookmarks + "continue reading" + reading progress
  --------------------------------------------------------- */
  function bookmarksKey() { return "marg:bookmarks"; }
  function loadBookmarks() {
    try { return JSON.parse(localStorage.getItem(bookmarksKey()) || "[]"); } catch (e) { return []; }
  }
  function saveBookmarks(list) {
    try { localStorage.setItem(bookmarksKey(), JSON.stringify(list)); } catch (e) {}
  }

  function initProgressAndBookmarks() {
    const fill = document.getElementById("readingProgressFill");
    const manuscript = document.querySelector(".manuscript");
    if (!manuscript) return;

    function currentPct() {
      const rect = manuscript.getBoundingClientRect();
      const total = manuscript.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      return Math.max(0, Math.min(100, (scrolled / Math.max(1, total)) * 100));
    }

    function updateProgress() {
      const pct = currentPct();
      if (fill) fill.style.width = pct + "%";
      try {
        localStorage.setItem("marg:lastRead", JSON.stringify({
          pageId: pageId(),
          title: document.body.dataset.pageTitle || document.title,
          chapter: document.body.dataset.pageChapter || "",
          url: window.location.pathname.split("/").pop() || "manuscript.html",
          pct: pct,
          ts: Date.now()
        }));
      } catch (e) {}
    }
    window.addEventListener("scroll", throttle(updateProgress, 200));
    updateProgress();

    const bookmarkBtn = document.getElementById("bookmarkToggle");
    function isBookmarked() {
      return loadBookmarks().some(b => b.pageId === pageId());
    }
    function refreshBookmarkBtn() {
      if (bookmarkBtn) bookmarkBtn.classList.toggle("is-active", isBookmarked());
    }
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener("click", () => {
        let list = loadBookmarks();
        if (isBookmarked()) {
          list = list.filter(b => b.pageId !== pageId());
        } else {
          list.push({
            pageId: pageId(),
            title: document.body.dataset.pageTitle || document.title,
            chapter: document.body.dataset.pageChapter || "",
            url: window.location.pathname.split("/").pop() || "manuscript.html",
            pct: currentPct(),
            ts: Date.now()
          });
        }
        saveBookmarks(list);
        refreshBookmarkBtn();
        refreshMarkList();
      });
      refreshBookmarkBtn();
    }
  }

  function throttle(fn, wait) {
    let last = 0, timer = null;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) { last = now; fn.apply(this, args); }
      else {
        clearTimeout(timer);
        timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, wait - (now - last));
      }
    };
  }

  function initContinueStrip() {
    const strip = document.getElementById("continueStrip");
    if (!strip) return;
    let last;
    try { last = JSON.parse(localStorage.getItem("marg:lastRead") || "null"); } catch (e) { last = null; }
    if (!last || last.pct < 2) { strip.hidden = true; return; }
    document.getElementById("continueTitle").textContent = last.title || "Untitled";
    document.getElementById("continueMeta").textContent = (last.chapter ? last.chapter + " · " : "") + Math.round(last.pct) + "% read";
    document.getElementById("continueLink").href = last.url || "manuscript.html";
    const pf = document.getElementById("continueProgressFill");
    if (pf) pf.style.width = last.pct + "%";
    strip.hidden = false;
  }

  /* ---------------------------------------------------------
     6. Marks list — shown inside settings drawer
  --------------------------------------------------------- */
  function refreshMarkList() {
    const list = document.getElementById("markList");
    if (!list) return;
    list.innerHTML = "";
    const bookmarks = loadBookmarks();
    const highlights = loadHighlights();

    if (bookmarks.length === 0 && highlights.length === 0) {
      list.innerHTML = '<div class="mark-empty">Nothing marked yet — select text to highlight, or bookmark this page.</div>';
      return;
    }

    bookmarks.forEach(b => {
      const div = document.createElement("div");
      div.className = "mark-item";
      div.innerHTML = `<a href="${b.url}">☆ ${escapeHtml(b.title)} — ${Math.round(b.pct)}%</a><button title="Remove bookmark">✕</button>`;
      div.querySelector("button").addEventListener("click", () => {
        saveBookmarks(loadBookmarks().filter(x => x.pageId !== b.pageId));
        refreshMarkList();
        const btn = document.getElementById("bookmarkToggle");
        if (btn && b.pageId === pageId()) btn.classList.remove("is-active");
      });
      list.appendChild(div);
    });

    highlights.forEach(h => {
      const div = document.createElement("div");
      div.className = "mark-item";
      const snippet = h.text.length > 34 ? h.text.slice(0, 34) + "…" : h.text;
      div.innerHTML = `<a href="#" title="${escapeHtml(h.text)}">✎ "${escapeHtml(snippet)}"</a><button title="Remove highlight">✕</button>`;
      div.querySelector("a").addEventListener("click", (e) => {
        e.preventDefault();
        const el = document.querySelector(`.hl[data-hl-id="${h.id}"]`);
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      });
      div.querySelector("button").addEventListener("click", () => {
        saveHighlights(loadHighlights().filter(x => x.id !== h.id));
        document.querySelectorAll(`.hl[data-hl-id="${h.id}"]`).forEach(el => {
          const parent = el.parentNode;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          parent.normalize();
        });
        renderReaderNotes();
        refreshMarkList();
      });
      list.appendChild(div);
    });
  }

  /* ---------------------------------------------------------
     7. Table of contents drawer
  --------------------------------------------------------- */
  function initToc() {
    const list = document.getElementById("tocList");
    if (!list) return;
    const current = parseInt(document.body.dataset.pageChapterNum || "19", 10);
    list.innerHTML = "";
    for (let n = 1; n <= 19; n++) {
      const div = document.createElement("div");
      const isCurrent = n === current;
      div.className = "toc-item" + (isCurrent ? " is-current" : n < current ? "" : " is-disabled");
      div.innerHTML = `<span>Ch. ${toRoman(n)}</span><small>${isCurrent ? "reading now" : n < current ? "read" : "not yet transcribed"}</small>`;
      list.appendChild(div);
    }
  }
  function toRoman(num) {
    const map = [[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    let out = "", n = num;
    for (const [v, s] of map) { while (n >= v) { out += s; n -= v; } }
    return out;
  }

  /* ---------------------------------------------------------
     8. Read-aloud (Web Speech API)
  --------------------------------------------------------- */
  function initTts() {
    const playBtn = document.getElementById("ttsPlay");
    const rateRange = document.getElementById("ttsRate");
    const columnText = document.querySelector(".column-text");
    if (!playBtn || !columnText || !("speechSynthesis" in window)) {
      if (playBtn) playBtn.style.display = "none";
      return;
    }
    let utter = null, speaking = false;

    if (rateRange) {
      rateRange.value = settings.ttsRate;
      rateRange.addEventListener("input", () => updateSetting("ttsRate", parseFloat(rateRange.value)));
    }

    playBtn.addEventListener("click", () => {
      if (speaking) {
        window.speechSynthesis.cancel();
        speaking = false;
        playBtn.textContent = "▶ Read aloud";
        return;
      }
      const text = columnText.textContent.replace(/\s+/g, " ").trim();
      utter = new SpeechSynthesisUtterance(text);
      utter.rate = settings.ttsRate || 1;
      utter.onend = () => { speaking = false; playBtn.textContent = "▶ Read aloud"; };
      window.speechSynthesis.speak(utter);
      speaking = true;
      playBtn.textContent = "■ Stop reading";
    });
  }

  /* ---------------------------------------------------------
     9. Wire up all controls once DOM is ready
  --------------------------------------------------------- */
  function initSettingsControls() {
    document.querySelectorAll(".theme-swatch").forEach(sw => {
      sw.addEventListener("click", () => {
        updateSetting("theme", sw.dataset.theme);
        closeEl(document.getElementById("themeModalOverlay"));
        closeEl(document.getElementById("themeModal"));
      });
    });
    document.querySelectorAll("#fontPills .pill").forEach(p => {
      p.addEventListener("click", () => updateSetting("font", p.dataset.font));
    });
    const fsRange = document.getElementById("fontSizeRange");
    if (fsRange) fsRange.addEventListener("input", () => updateSetting("fontSize", parseInt(fsRange.value, 10)));
    const lhRange = document.getElementById("lineHeightRange");
    if (lhRange) lhRange.addEventListener("input", () => updateSetting("lineHeight", parseFloat(lhRange.value)));
    const mRange = document.getElementById("measureRange");
    if (mRange) mRange.addEventListener("input", () => updateSetting("measure", parseInt(mRange.value, 10)));
    const dRange = document.getElementById("dimmerRange");
    if (dRange) dRange.addEventListener("input", () => updateSetting("dimmer", parseInt(dRange.value, 10)));
    const dyToggle = document.getElementById("dyslexicToggle");
    if (dyToggle) dyToggle.addEventListener("change", () => updateSetting("dyslexic", dyToggle.checked));
    const focusToggle = document.getElementById("focusToggle");
    if (focusToggle) focusToggle.addEventListener("change", () => updateSetting("focus", focusToggle.checked));
    document.querySelectorAll("[data-role='focus']").forEach(btn => {
      btn.addEventListener("click", () => updateSetting("focus", !settings.focus));
    });
    const resetBtn = document.getElementById("settingsReset");
    if (resetBtn) resetBtn.addEventListener("click", () => {
      settings = Object.assign({}, DEFAULT_SETTINGS);
      saveSettings(settings);
      applySettings();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applySettings();
    initSettingsControls();

    wireDrawer(["searchToggle", "searchToggle2"], "searchOverlay", "searchOverlay", ["searchClose"]);
    wireDrawer(["settingsToggle", "settingsToggle2"], "settingsOverlay", "settingsDrawer", ["settingsClose"]);
    wireDrawer(["tocToggle"], "tocOverlay", "tocDrawer", ["tocClose"]);
    wireDrawer(["themePickerOpen"], "themeModalOverlay", "themeModal", ["themeModalClose"]);

    initSearch();
    initHighlighter();
    initProgressAndBookmarks();
    initContinueStrip();
    refreshMarkList();
    initToc();
    initTts();
  });
})();