/* Song Library — list-first gig repertoire app. Vanilla JS, no build step. */
(function () {
  'use strict';

  // ---------- storage ----------
  const DB_KEY = 'songlib.db.v1', SET_KEY = 'songlib.settings.v1';
  let DB = null;
  let SET = Object.assign({ look: 'A', lyricSize: 22, hideControls: false, lastBackup: null }, safeJSON(localStorage.getItem(SET_KEY)) || {});
  function safeJSON(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function saveDB() { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) { toast('Could not save on this device — download a backup'); } }
  function saveSet() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) {} }

  function fromSeed(seed) {
    const db = { v: 1, lists: [], songs: {}, events: [], currentEvent: null, favs: [], nextId: 1 };
    let max = 0;
    seed.lists.forEach(L => {
      const list = { name: L.name, sections: [] };
      L.sections.forEach(S => {
        const sec = { name: S.name || '', ids: [] };
        S.songs.forEach(x => {
          db.songs[x.id] = {
            id: x.id, title: x.title || '', tune: x.tune || '', composers: x.composers || '', singers: x.singers || '',
            key: x.key || '', keyAsWritten: x.keyAsWritten || '', meter: x.meter || '', known: !!x.known,
            youtube: x.youtube || '', youtubeIsSearch: !!x.youtubeIsSearch, aliases: x.aliases || '', lyrics: x.lyrics || ''
          };
          sec.ids.push(x.id); if (x.id > max) max = x.id;
        });
        list.sections.push(sec);
      });
      db.lists.push(list);
    });
    (seed.selections || []).forEach((s, i) => {
      db.events.push({ id: 'e' + (i + 1), title: s.title.replace(/\s*[–-]\s*[A-Z][a-z]{2} \d+$/, '') || s.title, date: s.date || '', calendar: '', playlist: s.youtubePlaylist || '', ids: s.songIds.slice() });
    });
    if (!db.events.length) db.events.push({ id: 'e1', title: 'Tonight', date: today(), calendar: '', playlist: '', ids: [] });
    db.currentEvent = db.events[db.events.length - 1].id;
    db.nextId = max + 1;
    return db;
  }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------- helpers ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = () => $('#app');
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; app().appendChild(t); setTimeout(() => t.remove(), 2200); }
  function ev() { return DB.events.find(e => e.id === DB.currentEvent) || DB.events[0]; }
  function locate(id) {
    for (let li = 0; li < DB.lists.length; li++) for (let si = 0; si < DB.lists[li].sections.length; si++) {
      const i = DB.lists[li].sections[si].ids.indexOf(id); if (i >= 0) return { li, si, i };
    }
    return null;
  }
  function listTotal(L) { return L.sections.reduce((a, s) => a + s.ids.length, 0); }
  function fmtDate(d) { if (!d) return ''; const x = new Date(d + 'T12:00:00'); if (isNaN(x)) return d; return x.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function fmtTime(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

  // keys
  const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const ALIAS = { 'Db': 'C#', 'D#': 'Eb', 'Gb': 'F#', 'G#': 'Ab', 'A#': 'Bb' };
  function keyParts(k) {
    if (!k) return [];
    return k.split('/').map(p => p.trim()).filter(Boolean).map(p => { const m = p.match(/^([A-G][#b]?)(m?)$/); if (!m) return null; return (ALIAS[m[1]] || m[1]) + m[2]; }).filter(Boolean);
  }
  function neighbors(k) { const m = k.match(/^([A-G][#b]?)(m?)$/); const i = ROOTS.indexOf(m[1]); return [ROOTS[(i + 11) % 12] + m[2], ROOTS[(i + 1) % 12] + m[2]]; }

  // lyrics
  function parseLyrics(text) {
    const parts = []; let cur = null;
    (text || '').split('\n').forEach(raw => {
      const t = raw.trim();
      if (!t) return;
      if (/^\(?\s*(x\s*\d+|\d+\s*x)\s*\)?$/i.test(t)) { if (cur) cur.rep = t.replace(/[()\s]/g, '').toLowerCase().replace(/^x(\d+)$/, '$1x'); else (cur = { label: '', rep: t, lines: [] }, parts.push(cur)); return; }
      if (/^[A-Z0-9][A-Z0-9 .'’#&\-]{0,24}:?$/.test(t) && /[A-Z]/.test(t)) { cur = { label: t.replace(/:$/, ''), rep: '', lines: [] }; parts.push(cur); return; }
      if (!cur) { cur = { label: '', rep: '', lines: [] }; parts.push(cur); }
      cur.lines.push(t);
    });
    return parts.filter(p => p.lines.length || p.label);
  }
  function previewLines(text, n) { const out = []; parseLyrics(text).forEach(p => p.lines.forEach(l => out.push(l))); return out.slice(0, n); }

  // links
  function linkInfo(url) {
    if (!url) return { kind: '' };
    const u = url.trim();
    let m;
    if (/youtu/.test(u)) {
      if ((m = u.match(/[?&]v=([\w-]{11})/)) || (m = u.match(/youtu\.be\/([\w-]{11})/)) || (m = u.match(/\/(?:embed|shorts|live)\/([\w-]{11})/))) return { kind: /music\.youtube/.test(u) ? 'YouTube Music' : 'YouTube', vid: m[1], url: u };
      return { kind: 'YouTube search', url: u };
    }
    if (/open\.spotify\.com\/(track|album|playlist)\/(\w+)/.test(u)) { m = u.match(/open\.spotify\.com\/(track|album|playlist)\/(\w+)/); return { kind: 'Spotify', url: u, embed: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] }; }
    if (/music\.apple\.com/.test(u)) return { kind: 'Apple Music', url: u, embed: u.replace('music.apple.com', 'embed.music.apple.com') };
    return { kind: 'Link', url: u };
  }
  function ytSearchUrl(s) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent((s.title + ' ' + (s.tune || '')).trim()); }

  // ---------- icons ----------
  const I = {
    star: (on) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${on ? 'var(--accent)' : 'none'}" stroke="${on ? 'var(--accent)' : '#9A8F80'}" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>`,
    heart: (on) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="${on ? 'var(--heart)' : 'none'}" stroke="${on ? 'var(--heart)' : '#9A8F80'}" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
    lines: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
    search: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`,
    plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFDF8" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    cols: (c) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><rect x="16" y="4" width="5" height="16" rx="1"/></svg>`,
    down: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
    back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`,
    up: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`,
    check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`,
    play: (c) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
    pause: (c) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
    rw: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg>`,
    ff: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v4h-4"/></svg>`,
    edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`,
    cal: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1F5FBF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`
  };

  // ---------- UI state ----------
  const UI = { view: 'board', idx: 0, sec: {}, zoom: false, keyFilter: null, near: true, overlay: null, songId: null, ctx: null, edit: null, search: { q: '', scope: 'all' }, reorder: false, clearArm: false, gigI: 0, player: null, scroll: {} };
  const stack = [];

  function go(view, opts) { stopPlayer(); stack.push({ view: UI.view, songId: UI.songId, ctx: UI.ctx, gigI: UI.gigI }); Object.assign(UI, { view, overlay: null }, opts || {}); render(); }
  function back() { stopPlayer(); UI.queue = false; const p = stack.pop(); if (!p) { UI.view = 'board'; } else Object.assign(UI, p); UI.overlay = null; render(); }

  // ---------- render root ----------
  function render() {
    document.body.classList.toggle('lookB', SET.look === 'B');
    document.documentElement.style.setProperty('--lyric-size', SET.lyricSize + 'px');
    const v = UI.view;
    let html = '';
    if (v === 'board') html = boardHTML();
    else if (v === 'song') html = songHTML();
    else if (v === 'edit') html = editHTML();
    else if (v === 'search') html = searchHTML();
    else if (v === 'tonight') html = tonightHTML();
    else if (v === 'gig') html = gigHTML();
    else if (v === 'settings') html = settingsHTML();
    app().innerHTML = html + overlayHTML();
    after();
  }

  // ---------- board ----------
  function matchesKey(s) {
    if (!UI.keyFilter) return true;
    const parts = keyParts(s.key); const want = [UI.keyFilter].concat(UI.near ? neighbors(UI.keyFilter) : []);
    return parts.some(p => want.includes(p));
  }
  function rowHTML(s) {
    const t = ev(); const on = t.ids.includes(s.id); const fav = DB.favs.includes(s.id);
    return `<div class="row" data-id="${s.id}">
      <button class="star" data-act="star" data-id="${s.id}" aria-label="Add to tonight">${I.star(on)}</button>
      <button class="heart" data-act="fav" data-id="${s.id}" aria-label="Favorite">${I.heart(fav)}</button>
      <button class="open" data-act="open" data-id="${s.id}">
        <span class="key${s.key ? '' : ' none'}">${esc(s.key || '—')}</span>
        ${s.meter ? `<span class="meter">${esc(s.meter)}</span>` : ''}
        <span class="ttl">${s.known ? '<span class="known">✓ </span>' : ''}${esc(s.title)}${s.tune ? `<span class="tune">  · ${esc(s.tune)}</span>` : ''}</span>
      </button>
      ${s.lyrics ? `<button class="heart" data-act="peek" data-id="${s.id}" aria-label="Preview lyrics" style="color:var(--muted)">${I.lines}</button>` : '<span style="width:22px;flex:none"></span>'}
    </div>`;
  }
  function colHTML(L, li) {
    const f = UI.sec[li] || null;
    let html = `<div class="colhead"><span>${esc(L.name)}</span><span style="opacity:.75;font-weight:500">${listTotal(L)}</span></div>`;
    let shown = 0;
    L.sections.forEach(S => {
      if (f && f !== '__fav' && S.name !== f) return;
      let ids = S.ids;
      if (f === '__fav') ids = ids.filter(id => DB.favs.includes(id));
      const songs = ids.map(id => DB.songs[id]).filter(s => s && matchesKey(s));
      if (!songs.length && (f === '__fav' || UI.keyFilter)) return;
      const known = songs.filter(s => s.known).length;
      if (S.name || L.sections.length > 1) html += `<div class="sechead"><span class="n">${songs.length}${known ? ` · <b>${known} ✓</b>` : ''}</span><span class="nm" dir="auto">${esc(S.name || 'Songs')}</span></div>`;
      html += songs.map(rowHTML).join('');
      if (!songs.length) html += '<div class="empty">No songs yet</div>';
      shown += songs.length;
    });
    if (!shown && (f || UI.keyFilter)) html += `<div class="empty">${f === '__fav' ? 'No favorites in this list yet — tap ♡ on a song.' : 'No songs match.'}</div>`;
    return `<div class="col${li === UI.idx ? ' cur' : ''}" data-li="${li}">${html}</div>`;
  }
  function headerHTML() {
    const L = DB.lists[UI.idx]; const f = UI.sec[UI.idx] || null;
    if (SET.hideControls && !UI.zoom) return `<div class="minihdr" id="hdr"><button class="link" style="text-decoration:none;font-size:15px;font-weight:800" data-act="totop">${esc(L.name)}</button><button class="btn small" data-act="hidectl">Show controls</button></div>`;
    const favN = L.sections.reduce((a, S) => a + S.ids.filter(id => DB.favs.includes(id)).length, 0);
    const secLabel = f === '__fav' ? '♡ Favorites' : (f || 'All sections');
    const secN = f === '__fav' ? favN : (f ? (L.sections.find(S => S.name === f) || { ids: [] }).ids.length : listTotal(L));
    const kf = UI.keyFilter ? `Key: ${UI.keyFilter}${UI.near ? ' ±' : ''}` : 'Key';
    return `<div class="hdr" id="hdr">
      <div class="hrow">
        <button class="title-btn" data-act="listmenu"><span class="t">${UI.zoom ? 'All lists' : esc(L.name)}</span><span class="s">${UI.zoom ? Object.keys(DB.songs).length + ' songs in ' + DB.lists.length + ' lists' : listTotal(L) + ' songs · ' + (UI.idx + 1) + ' of ' + DB.lists.length + ' · swipe ‹ ›'}</span></button>
        <button class="ibtn${UI.zoom ? ' on' : ''}" data-act="zoom" aria-label="${UI.zoom ? 'Back to one list' : 'See all lists'}">${I.cols(UI.zoom ? (SET.look === 'B' ? 'var(--ink)' : '#F6F1E7') : 'var(--ink)')}</button>
        <button class="ibtn" data-act="search" aria-label="Search">${I.search}</button>
        <button class="btn" style="min-height:40px;padding:0 10px;font-size:14px${UI.keyFilter ? ';background:var(--accent);border-color:var(--accent);color:#fff' : ''}" data-act="keys">${esc(kf)}</button>
        <button class="ibtn accent" data-act="add" aria-label="Add a song">${I.plus}</button>
      </div>
      <div class="dotsrow">
        <button class="left" data-act="hidectl">Hide controls</button>
        ${DB.lists.map((x, i) => `<button class="dot${i === UI.idx ? ' on' : ''}" data-act="golist" data-li="${i}" aria-label="Go to ${esc(x.name)}"></button>`).join('')}
        <button class="right" data-act="settings" style="color:${SET.lastBackup ? 'var(--ok)' : 'var(--danger)'}">${SET.lastBackup ? I.check + 'Backed up' : 'Backup'}</button>
      </div>
      ${UI.zoom ? '<div style="min-height:36px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted)">Pinch out or tap a list to open it</div>' :
      `<button class="secbtn" data-act="secmenu"><span style="display:flex;align-items:center;gap:6px">${I.down}<span style="font-size:12px;color:var(--muted)">${secN} songs</span></span><span style="display:flex;align-items:center;gap:6px"><span class="val" dir="auto">${esc(secLabel)}</span><span class="lbl">SECTION</span></span></button>`}
    </div>`;
  }
  function tonightBarHTML() {
    const t = ev(); const last = t.ids.length ? DB.songs[t.ids[t.ids.length - 1]] : null;
    return `<button class="tonightbar" data-act="tonight" id="tbar"><span class="a"><small>TONIGHT · ${last ? 'LAST ADDED ' + esc(last.title) : 'TAP ★ TO ADD'}</small><span>${esc(t.title)}${t.date ? ' – ' + esc(fmtDate(t.date)) : ''}</span></span><span class="c">${t.ids.length} songs</span></button>`;
  }
  function boardHTML() {
    return `${headerHTML()}
      <div class="board${UI.zoom ? ' zoomed' : ''}" id="board">${DB.lists.map(colHTML).join('')}</div>
      <button class="totop hidden" id="totop" data-act="totop">${I.up}Top</button>
      ${tonightBarHTML()}`;
  }
  function refreshHeader() { const h = $('#hdr'); if (h) h.outerHTML = headerHTML(); }
  function refreshBar() { const b = $('#tbar'); if (b) b.outerHTML = tonightBarHTML(); }
  function refreshRows(id) { $$(`.row[data-id="${id}"]`).forEach(r => { r.outerHTML = rowHTML(DB.songs[id]); }); }
  function refreshBoardBody() {
    const b = $('#board'); if (!b) return render();
    const left = b.scrollLeft; const tops = $$('.col', b).map(c => c.scrollTop);
    b.innerHTML = DB.lists.map(colHTML).join('');
    b.scrollLeft = left; $$('.col', b).forEach((c, i) => c.scrollTop = tops[i] || 0);
    refreshHeader();
  }

  // ---------- song ----------
  function navTargets() {
    const id = UI.songId;
    if (UI.ctx && UI.ctx.type === 'tonight') { const ids = ev().ids; const i = ids.indexOf(id); return { prev: ids[i - 1], next: ids[i + 1], label: 'TONIGHT' }; }
    const loc = locate(id); if (!loc) return {};
    const ids = DB.lists[loc.li].sections[loc.si].ids; return { prev: ids[loc.i - 1], next: ids[loc.i + 1] };
  }
  function songHTML() {
    const s = DB.songs[UI.songId]; if (!s) return '<div class="empty">Song not found</div>';
    const loc = locate(s.id); const L = loc ? DB.lists[loc.li] : null; const S = loc ? L.sections[loc.si] : null;
    const backLabel = UI.ctx && UI.ctx.type === 'tonight' ? 'Tonight' : (UI.ctx && UI.ctx.type === 'search' ? 'Search' : (L ? L.name : 'Back'));
    const on = ev().ids.includes(s.id); const fav = DB.favs.includes(s.id);
    const li = linkInfo(s.youtube); const nav = navTargets();
    const parts = parseLyrics(s.lyrics);
    const canPlay = li.vid || li.embed;
    return `<div class="page">
      <div class="songhead">
        <div class="hrow">
          <button class="back" data-act="back" style="flex:1">${I.back}${esc(backLabel)}</button>
          <button class="ibtn" data-act="size" data-d="-2" aria-label="Smaller text" style="font-weight:800">A−</button>
          <button class="ibtn" data-act="size" data-d="2" aria-label="Bigger text" style="font-weight:800;font-size:17px">A+</button>
          <button class="btn" style="min-height:40px" data-act="editsong" data-id="${s.id}">${I.edit}Edit</button>
        </div>
        <div class="rtl" style="display:flex;flex-direction:column;gap:4px">
          <span class="songtitle">${esc(s.title)}${s.known ? ' <span style="color:var(--ok);font-size:20px">✓</span>' : ''}</span>
          <span class="meta"><span class="key${s.key ? '' : ' none'}" style="height:24px;font-size:12px">${esc(s.key || 'No key')}</span>${s.tune ? `<span>${esc(s.tune)}</span>` : ''}${S && S.name ? `<span>· ${esc(S.name)}</span>` : ''}${s.meter ? `<span>· ${esc(s.meter)}</span>` : ''}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ${on ? '' : 'primary'}" style="flex:1${on ? ';background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink)' : ''}" data-act="star" data-id="${s.id}" data-re="1">${I.star(on).replace(/var\(--accent\)/g, on ? 'var(--accent)' : '#FFFDF8').replace('#9A8F80', '#FFFDF8')}${on ? 'In tonight · #' + (ev().ids.indexOf(s.id) + 1) : 'Add to tonight'}</button>
          ${canPlay ? `<button class="btn" style="flex:1" data-act="listen">${I.play('var(--ink)')}Listen</button>` :
          `<a class="btn" style="flex:1" href="${esc(li.url || ytSearchUrl(s))}" target="_blank" rel="noopener">Find on YouTube</a>`}
          <button class="ibtn" data-act="fav" data-id="${s.id}" data-re="1" aria-label="Favorite">${I.heart(fav)}</button>
        </div>
        ${li.kind === 'Spotify' ? `<a class="link" style="color:#1F5FBF" href="${esc(li.url)}" target="_blank" rel="noopener">Open in Spotify app ›</a>` : ''}
      </div>
      <div id="playerslot"></div>
      <div class="scroll">${parts.length ? `<div class="lyrics">${parts.map(p => `
        ${p.label || p.rep ? `<div class="part"><span class="pl">${esc(p.label)}</span><span class="ln"></span>${p.rep ? `<span class="rep">${esc(p.rep)}</span>` : ''}</div>` : '<div style="height:10px"></div>'}
        <div class="ltext">${esc(p.lines.join('\n'))}</div>`).join('')}</div>` : `<div class="nolyrics">No lyrics yet. <button class="link" data-act="editsong" data-id="${s.id}">Add lyrics</button></div>`}</div>
      <div class="footnav">
        <button class="navbtn" data-act="nav" data-id="${nav.prev || ''}" ${nav.prev ? '' : 'disabled style="opacity:.35"'}><small>‹ PREVIOUS</small><span>${nav.prev ? esc(DB.songs[nav.prev].title) : '—'}</span></button>
        <button class="navbtn next" data-act="nav" data-id="${nav.next || ''}" ${nav.next ? '' : 'disabled style="opacity:.35"'}><small>${nav.label ? 'NEXT IN TONIGHT ›' : 'NEXT ›'}</small><span>${nav.next ? esc(DB.songs[nav.next].title) : '—'}</span></button>
      </div>
    </div>`;
  }

  // ---------- player ----------
  let YTready = null, ytPlayer = null, tick = null;
  function loadYT() {
    if (YTready) return YTready;
    YTready = new Promise((res, rej) => {
      if (window.YT && window.YT.Player) return res();
      window.onYouTubeIframeAPIReady = () => res();
      const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.onerror = () => { YTready = null; rej(); };
      document.head.appendChild(sc);
    });
    return YTready;
  }
  function stopPlayer() {
    if (tick) { clearInterval(tick); tick = null; }
    if (ytPlayer && ytPlayer.destroy) { try { ytPlayer.destroy(); } catch (e) {} }
    ytPlayer = null; UI.player = null;
  }
  function openPlayer(autoplay) {
    const s = DB.songs[UI.songId]; const li = linkInfo(s.youtube); const slot = $('#playerslot'); if (!slot) return;
    UI.player = { a: null, b: null, speed: 1, speedOpen: false, queue: UI.player && UI.player.queue };
    if (li.vid) {
      slot.innerHTML = playerHTML(li);
      loadYT().then(() => {
        ytPlayer = new YT.Player('ytp', { videoId: li.vid, playerVars: { playsinline: 1, rel: 0, autoplay: autoplay ? 1 : 0 },
          events: {
            onReady: e => { if (autoplay) e.target.playVideo(); },
            onStateChange: e => { updateTransport(); if (e.data === 0 && UI.queue) nextInQueue(); }
          } });
        tick = setInterval(updateProgress, 250);
      }).catch(() => { slot.innerHTML = `<div class="player"><div class="note" style="color:var(--danger)">Couldn't reach YouTube — check the connection.</div><a class="btn" href="${esc(li.url)}" target="_blank" rel="noopener">Open in YouTube</a></div>`; });
    } else if (li.embed) {
      slot.innerHTML = `<div class="player"><iframe src="${esc(li.embed)}" style="width:100%;height:${li.kind === 'Spotify' ? 152 : 175}px;border:0;border-radius:12px" allow="autoplay *; encrypted-media *; clipboard-write" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"></iframe>
        <span class="note muted">${li.kind === 'Spotify' ? 'Inside the app Spotify often plays only a 30-second preview — use "Open in Spotify app" for the full song.' : 'Full song for Apple Music subscribers (sign in inside the player); others hear a preview.'} Speed and loop work with YouTube links.</span>
        <button class="btn small" data-act="closeplayer">Close player</button></div>`;
    }
  }
  function playerHTML(li) {
    const p = UI.player;
    return `<div class="player">
      <div class="vbox"><div id="ytp"></div></div>
      <div><div class="prog" data-act="seek" id="prog"><div class="f" id="pf" style="width:0"></div><div class="lp hidden" id="plp"></div></div>
        <div class="ptimes"><span id="pt">0:00</span><span id="pst">${esc(li.kind)}</span><span id="pd">0:00</span></div></div>
      <div class="transport">
        <button class="tbtn" data-act="skip" data-d="-10" aria-label="Back 10 seconds">${I.rw}10s</button>
        <button class="playbig" data-act="pp" id="ppbtn" aria-label="Play or pause">${I.play('#FFFDF8').replace('16', '26').replace('16', '26')}</button>
        <button class="tbtn" data-act="skip" data-d="10" aria-label="Forward 10 seconds">${I.ff}10s</button>
      </div>
      <div class="practice">
        <button class="btn" style="flex:1.3;min-height:40px;font-size:13px" data-act="speedmenu">Speed <b id="spd">${p.speed}×</b></button>
        <button class="ab" data-act="setA" id="ba">Set A</button>
        <button class="ab" data-act="setB" id="bb">Set B</button>
        <button class="ibtn" data-act="clearab" aria-label="Clear loop" style="border-color:#C9BEAB">✕</button>
        <div class="speedmenu hidden" id="speedmenu"><div class="menu" style="margin:0">${[0.5, 0.75, 0.9, 1, 1.25].map(v => `<button class="opt" data-act="speed" data-v="${v}">${v}×${v === 1 ? ' normal' : ''}</button>`).join('')}</div></div>
      </div>
      <button class="link" data-act="closeplayer" style="align-self:center">Close player</button>
    </div>`;
  }
  function updateProgress() {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;
    const t = ytPlayer.getCurrentTime() || 0, d = ytPlayer.getDuration() || 0, p = UI.player;
    if (p && p.a != null && p.b != null && t >= p.b) ytPlayer.seekTo(p.a, true);
    const pf = $('#pf'); if (pf && d) pf.style.width = (t / d * 100) + '%';
    const pt = $('#pt'); if (pt) pt.textContent = fmtTime(t);
    const pd = $('#pd'); if (pd) pd.textContent = fmtTime(d);
    const lp = $('#plp');
    if (lp && p && d) { if (p.a != null && p.b != null) { lp.classList.remove('hidden'); lp.style.left = (p.a / d * 100) + '%'; lp.style.width = ((p.b - p.a) / d * 100) + '%'; } else lp.classList.add('hidden'); }
  }
  function updateTransport() {
    const b = $('#ppbtn'); if (!b || !ytPlayer || !ytPlayer.getPlayerState) return;
    b.innerHTML = ytPlayer.getPlayerState() === 1 ? I.pause('#FFFDF8') : I.play('#FFFDF8').replace('16', '26').replace('16', '26');
  }
  function nextInQueue() {
    const ids = ev().ids; let i = ids.indexOf(UI.songId) + 1;
    while (i < ids.length && !linkInfo(DB.songs[ids[i]].youtube).vid) i++;
    if (i >= ids.length) { toast('End of Tonight'); UI.queue = false; return; }
    stopPlayer(); UI.songId = ids[i]; render(); openPlayer(true);
  }

  // ---------- edit / add ----------
  function editHTML() {
    const e = UI.edit; const s = e.song;
    const L = DB.lists[e.li]; const S = L.sections[e.si] || L.sections[0];
    const m = (s.key || '').match(/^([A-G][#b]?)(m?)$/); const root = m ? (ALIAS[m[1]] || m[1]) : null; const minor = m ? !!m[2] : e.minor !== false;
    const li = linkInfo(s.youtube);
    const posIds = S.ids.filter(id => id !== s.id);
    const notes = { 'YouTube': ['Plays inside the app, with speed and loop.', 'var(--ok)'], 'YouTube Music': ['Plays inside the app (same player as YouTube), with speed and loop.', 'var(--ok)'], 'Apple Music': ['Plays inside the app for Apple Music subscribers; others hear a 30-second preview.', '#8A5A00'], 'Spotify': ['Opens in Spotify. Inside the app it is often only a 30-second preview.', '#8A5A00'], 'YouTube search': ['This is a search link — opens YouTube to pick the right recording.', '#8A5A00'], 'Link': ['Opens in the browser.', 'var(--muted)'], '': ['Paste a YouTube, YouTube Music, Apple Music or Spotify link.', 'var(--muted)'] };
    const nt = notes[li.kind] || notes[''];
    return `<div class="page">
      <div class="hrow" style="justify-content:space-between;padding:10px 16px;border-bottom:var(--bw) solid var(--ink)">
        <button class="back" data-act="back">Cancel</button>
        <b style="font-size:16px">${e.isNew ? 'New song' : 'Edit song'}</b>
        <button class="btn primary" style="min-height:40px" data-act="save">Save</button>
      </div>
      <div class="scroll"><div class="form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label class="field"><span class="lbl">TITLE</span><input class="inp" dir="rtl" data-f="title" value="${esc(s.title)}" placeholder="Song title"></label>
          <label class="field"><span class="lbl">TUNE / COMPOSER</span><input class="inp" dir="rtl" data-f="tune" value="${esc(s.tune)}" placeholder="Optional"></label>
        </div>
        <div class="field">
          <div style="display:flex;align-items:center;justify-content:space-between"><span class="lbl">KEY · <span style="color:var(--accent)">${esc(s.key || 'none')}</span>${s.keyAsWritten && s.keyAsWritten !== s.key ? ` <span class="muted" style="font-weight:400;letter-spacing:0">(written as “${esc(s.keyAsWritten)}”)</span>` : ''}</span>
            <div class="seg" style="width:150px"><button class="${!minor ? 'on' : ''}" data-act="kmode" data-v="maj">Major</button><button class="${minor ? 'on' : ''}" data-act="kmode" data-v="min">Minor</button></div></div>
          <div class="grid6">${ROOTS.map(r => `<button class="kbtn" style="min-height:36px;font-size:14px${r === root ? ';background:var(--accent);border-color:var(--accent);color:#fff' : ''}" data-act="kroot" data-v="${r}">${r}${minor ? 'm' : ''}</button>`).join('')}</div>
          <div style="display:flex;gap:8px;align-items:center"><button class="link" data-act="knone">No key</button><span class="muted" style="font-size:12px">Two keys? Type them: </span><input class="inp" style="height:34px;width:110px;font-size:14px" data-f="key" value="${esc(s.key)}" placeholder="Gm / Em"></div>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end">
          <div class="field" style="flex:1"><span class="lbl">METER</span><div class="seg">${['', '4/4', '3/4', '6/8'].map(v => `<button class="${(s.meter || '') === v ? 'on' : ''}" data-act="meter" data-v="${v}">${v || '—'}</button>`).join('')}</div></div>
          <button class="btn" style="min-height:38px;font-size:13px${s.known ? ';background:var(--ok-soft);color:var(--ok);border-color:var(--ok)' : ''}" data-act="known">${s.known ? '✓ I know it' : 'Mark as known'}</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label class="field"><span class="lbl">LIST</span><select class="inp" data-act="elist">${DB.lists.map((x, i) => `<option value="${i}" ${i === e.li ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">SECTION</span><select class="inp" dir="auto" data-act="esec">${L.sections.map((x, i) => `<option value="${i}" ${i === e.si ? 'selected' : ''}>${esc(x.name || 'Songs')}</option>`).join('')}</select></label>
        </div>
        <div class="field"><span class="lbl">WHERE IN ${esc(S.name || L.name)} — <span style="color:var(--accent)">TAP THE SONG IT COMES AFTER</span></span>
          <div class="posbox" id="posbox">
            <button class="posrow${e.after === -1 ? ' new' : ''}" data-act="pos" data-v="-1"><span class="n"></span><span class="t">${e.after === -1 ? '＋ ' + esc(s.title || 'This song') + ' — at the top' : '↑ Put it at the top'}</span></button>
            ${posIds.map((id, i) => `<button class="posrow" data-act="pos" data-v="${i}"><span class="n">${i + 1}</span><span class="t">${esc(DB.songs[id].title)}</span></button>${e.after === i ? `<div class="posrow new"><span class="n">${i + 2}</span><span class="t">＋ ${esc(s.title || 'This song')} — goes here</span></div>` : ''}`).join('')}
          </div></div>
        <div class="field"><span class="lbl">TRACK LINK</span>
          <div style="display:flex;gap:6px"><input class="inp" style="font-size:13px" data-f="youtube" value="${esc(s.youtube)}" placeholder="Paste a link"><a class="btn dark small" style="white-space:nowrap" href="${esc(ytSearchUrl(s))}" target="_blank" rel="noopener">Find on YouTube</a></div>
          <span class="note" style="color:${nt[1]}" id="linknote">${li.kind ? '✓ ' + esc(li.kind) + ' — ' : ''}${nt[0]}</span></div>
        <label class="field"><span class="lbl">LYRICS</span><textarea class="inp" dir="rtl" data-f="lyrics" placeholder="Type or paste the lyrics">${esc(s.lyrics)}</textarea>
          <span class="muted" style="font-size:12px">Write VERSE: or CHORUS: on its own line for a heading, and 2x for a repeat — they turn into labels.</span></label>
        ${e.isNew ? '' : `<button class="btn" style="color:var(--danger);border-color:var(--danger)" data-act="delsong">${e.delArm ? 'Tap again to delete this song' : 'Delete song'}</button>`}
      </div></div></div>`;
  }
  function startEdit(id) {
    const isNew = id == null;
    let li = UI.idx, si = 0, after;
    let song;
    if (isNew) {
      const f = UI.sec[UI.idx]; si = Math.max(0, DB.lists[li].sections.findIndex(S => S.name === f)); if (si < 0) si = 0;
      song = { id: null, title: '', tune: '', key: '', keyAsWritten: '', meter: '', known: false, youtube: '', youtubeIsSearch: false, aliases: '', lyrics: '', composers: '', singers: '' };
      after = DB.lists[li].sections[si].ids.length - 1;
    } else {
      const loc = locate(id); li = loc.li; si = loc.si; after = loc.i - 1; song = Object.assign({}, DB.songs[id]);
    }
    go('edit', { edit: { isNew, song, li, si, after, delArm: false } });
  }
  function readForm() {
    const e = UI.edit; $$('[data-f]').forEach(inp => { e.song[inp.dataset.f] = inp.value; });
  }
  function saveEdit() {
    readForm(); const e = UI.edit; const s = e.song;
    s.title = s.title.trim(); if (!s.title) { toast('Give the song a title'); return; }
    s.key = s.key.trim(); const li = linkInfo(s.youtube); s.youtubeIsSearch = li.kind === 'YouTube search';
    if (e.isNew) { s.id = DB.nextId++; }
    else { const loc = locate(s.id); DB.lists[loc.li].sections[loc.si].ids.splice(loc.i, 1); }
    DB.songs[s.id] = s;
    const ids = DB.lists[e.li].sections[e.si].ids; const others = ids; others.splice(Math.min(e.after + 1, others.length), 0, s.id);
    saveDB();
    stack.pop();
    if (e.isNew) { UI.view = 'board'; UI.idx = e.li; render(); toast('Added to ' + DB.lists[e.li].name); setTimeout(() => scrollToSong(s.id), 50); }
    else { UI.view = 'song'; UI.songId = s.id; render(); toast('Saved'); }
  }
  function scrollToSong(id) { const el = $(`.col[data-li="${UI.idx}"] .row[data-id="${id}"]`); const b = $('#board'); if (b) b.scrollLeft = UI.idx * b.clientWidth; if (el) { el.scrollIntoView({ block: 'center' }); el.style.background = 'var(--accent-soft)'; setTimeout(() => el.style.background = '', 1500); } }

  // ---------- search ----------
  function searchHTML() {
    return `<div class="page">
      <div style="padding:12px 14px 10px;display:flex;flex-direction:column;gap:8px;border-bottom:var(--bw) solid var(--ink)">
        <div class="hrow"><label class="sbar">${I.search}<input id="sq" dir="auto" value="${esc(UI.search.q)}" placeholder="Title, tune, or a line of lyrics" autocomplete="off"></label><button class="back" data-act="back" style="color:var(--accent)">Cancel</button></div>
        <div class="seg"><button class="${UI.search.scope === 'all' ? 'on' : ''}" data-act="scope" data-v="all">All ${DB.lists.length} lists</button><button class="${UI.search.scope === 'this' ? 'on' : ''}" data-act="scope" data-v="this">Only ${esc(DB.lists[UI.idx].name)}</button></div>
      </div>
      <div class="scroll" id="sres" style="padding:0 14px 40px">${searchResults()}</div></div>`;
  }
  function norm(t) { return (t || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[׳'"״]/g, ''); }
  function searchResults() {
    const q = norm(UI.search.q.trim()); if (!q) return '<div class="empty">Type to search every list at once.</div>';
    const titles = [], lyr = [];
    DB.lists.forEach((L, li) => {
      if (UI.search.scope === 'this' && li !== UI.idx) return;
      L.sections.forEach(S => S.ids.forEach(id => {
        const s = DB.songs[id];
        if (norm(s.title + ' ' + s.tune + ' ' + s.aliases + ' ' + s.composers + ' ' + s.singers).includes(q)) titles.push({ s, L, S });
        else if (s.lyrics && norm(s.lyrics).includes(q)) {
          const line = s.lyrics.split('\n').find(l => norm(l).includes(q)) || '';
          lyr.push({ s, L, S, line: line.trim() });
        }
      }));
    });
    const t = ev();
    const row = (r, sub) => `<div class="srow"><button class="row star" style="height:46px;border:none" data-act="star" data-id="${r.s.id}" aria-label="Add to tonight">${I.star(t.ids.includes(r.s.id))}</button>
      <button class="open" data-act="opensearch" data-id="${r.s.id}"><span class="key${r.s.key ? '' : ' none'}">${esc(r.s.key || '—')}</span><span class="two"><b>${esc(r.s.title)}${r.s.tune ? ` <span class="muted" style="font-weight:400;font-size:13px">· ${esc(r.s.tune)}</span>` : ''}</b><small>${sub}</small></span></button></div>`;
    const hl = (line) => { const n = norm(line); const i = n.indexOf(q); if (i < 0) return esc(line); return esc(line.slice(0, i)) + '<mark>' + esc(line.slice(i, i + q.length)) + '</mark>' + esc(line.slice(i + q.length)); };
    return `<div class="shead"><span class="muted">${titles.length} songs</span><b>IN THE TITLE</b></div>${titles.slice(0, 200).map(r => row(r, `<span dir="ltr">${esc(r.L.name)}</span> · ${esc(r.S.name)}`)).join('') || '<div class="empty">None</div>'}
      <div class="shead" style="margin-top:8px"><span class="muted">${lyr.length} songs</span><b>IN THE LYRICS</b></div>${lyr.slice(0, 100).map(r => row(r, '“' + hl(r.line) + '” · <span dir="ltr">' + esc(r.L.name) + '</span>')).join('') || '<div class="empty">None</div>'}`;
  }

  // ---------- tonight ----------
  function tonightHTML() {
    const t = ev(); const withRec = t.ids.filter(id => linkInfo(DB.songs[id].youtube).vid).length;
    return `<div class="page">
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;border-bottom:var(--bw) solid var(--ink)">
        <button class="back" data-act="back">${I.back}Board</button>
        <button data-act="evmenu" style="display:flex;align-items:flex-end;justify-content:space-between;border:none;background:none;padding:0;text-align:left">
          <span style="display:flex;flex-direction:column;line-height:1.15"><span class="lbl" style="color:var(--accent)">EVENT${t.date ? ' · ' + esc(fmtDate(t.date)).toUpperCase() : ''}</span>
            <span style="font-size:26px;font-weight:800;display:flex;align-items:center;gap:6px">${esc(t.title)}${I.down}</span>
            <span class="muted" style="font-size:13px">${t.ids.length} songs · ${withRec} with recordings</span></span>
          <span class="muted" style="font-size:12px;font-weight:700">All events</span></button>
        ${t.calendar ? `<a href="${esc(t.calendar)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:#1F5FBF">${I.cal}Open in Google Calendar</a>` : `<button class="link" style="align-self:flex-start;color:#1F5FBF;text-decoration:none;display:flex;gap:5px;align-items:center" data-act="evdetails">${I.cal}Add date / calendar link</button>`}
        <div style="display:flex;gap:8px">
          <button class="btn primary" style="flex:1.3" data-act="startgig" ${t.ids.length ? '' : 'disabled'}>Start gig</button>
          <button class="btn" style="flex:1.3" data-act="playall" ${withRec ? '' : 'disabled'}>${I.play('var(--ink)')}Play all</button>
          <button class="btn${UI.reorder ? ' dark' : ''}" style="flex:1" data-act="reorder">${UI.reorder ? 'Done' : 'Reorder'}</button>
        </div>
        <div style="display:flex;gap:16px;align-items:center">
          <button class="link" data-act="copylist">Copy list as text</button>
          <button class="link" data-act="share">Share</button>
          <button class="link" style="color:var(--danger);margin-left:auto" data-act="clear">${UI.clearArm ? 'Tap again to clear all ' + t.ids.length : 'Clear'}</button>
        </div>
      </div>
      <div class="scroll" style="padding:0 16px 40px">${t.ids.length ? t.ids.map((id, i) => { const s = DB.songs[id]; const loc = locate(id); const L = loc ? DB.lists[loc.li] : null;
        return `<div class="trow"><span class="num">${i + 1}</span>
          ${UI.reorder ? `<button class="mv" data-act="mv" data-i="${i}" data-d="-1" aria-label="Move up" ${i ? '' : 'disabled style="opacity:.3"'}>↑</button><button class="mv" data-act="mv" data-i="${i}" data-d="1" aria-label="Move down" ${i < t.ids.length - 1 ? '' : 'disabled style="opacity:.3"'}>↓</button>` : ''}
          <button class="open" style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:none;background:none;padding:4px 0;text-align:right" data-act="opentonight" data-id="${id}">
            <span class="key${s.key ? '' : ' none'}">${esc(s.key || '—')}</span>
            <span class="two" style="flex:1;min-width:0;display:flex;flex-direction:column;direction:rtl;line-height:1.2"><b style="font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.title)}</b><small class="muted" style="font-size:12px"><span dir="ltr">${L ? esc(L.name) : ''}</span>${loc && L.sections[loc.si].name ? ' · ' + esc(L.sections[loc.si].name) : ''}</small></span></button>
          ${UI.reorder ? `<button class="mv" data-act="unstar" data-id="${id}" aria-label="Remove" style="color:var(--danger);border-color:var(--danger)">✕</button>` : ''}</div>`; }).join('') : '<div class="empty">Nothing yet. Tap ★ on any song to add it here.</div>'}</div></div>`;
  }
  function tonightText() { const t = ev(); return t.title + (t.date ? ' – ' + fmtDate(t.date) : '') + '\n' + t.ids.map((id, i) => { const s = DB.songs[id]; return (i + 1) + '. ' + s.title + (s.tune ? ' - ' + s.tune : '') + (s.key ? ' (' + s.key + ')' : ''); }).join('\n'); }

  // ---------- gig ----------
  let wakeLock = null;
  async function keepAwake(on) {
    try { if (on && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {}
  }
  function gigHTML() {
    const ids = ev().ids; const i = Math.min(UI.gigI, ids.length - 1); const s = DB.songs[ids[i]]; const nx = DB.songs[ids[i + 1]];
    const parts = parseLyrics(s.lyrics);
    return `<div class="page gig">
      <div class="gigtop"><span style="font-size:12px;font-weight:800;letter-spacing:1.2px">GIG · ${i + 1} OF ${ids.length}</span>
        <span style="flex:1;display:flex;gap:6px;justify-content:center"><span class="pill">Screen stays on</span><span class="pill" style="color:#A8D5B2">✓ Saved on phone</span></span>
        <button class="back" style="color:#F6F1E7;font-size:13px;font-weight:800;min-height:36px" data-act="endgig">End</button></div>
      <div class="rtl" style="padding:12px 18px 6px;display:flex;align-items:center;gap:10px;border-bottom:var(--bw) solid var(--ink)">
        <span style="flex:1;font-size:30px;font-weight:800;line-height:1.1">${esc(s.title)}</span>
        <span class="key" style="height:32px;font-size:17px;padding:0 8px">${esc(s.key || '—')}</span></div>
      <div class="scroll">${parts.length ? `<div class="lyrics">${parts.map(p => `${p.label || p.rep ? `<div class="part"><span class="pl">${esc(p.label)}</span><span class="ln"></span>${p.rep ? `<span class="rep">${esc(p.rep)}</span>` : ''}</div>` : '<div style="height:10px"></div>'}<div class="ltext">${esc(p.lines.join('\n'))}</div>`).join('')}</div>` : `<div class="nolyrics">No lyrics for this song.${s.tune ? ' Tune: ' + esc(s.tune) : ''}</div>`}</div>
      <div class="footnav">
        <button class="ibtn" style="width:64px;height:64px" data-act="gigprev" aria-label="Previous song" ${i ? '' : 'disabled style="width:64px;height:64px;opacity:.3"'}>${I.back}</button>
        <button class="gignext" data-act="gignext" ${nx ? '' : 'disabled'}><span style="font-size:12px;font-weight:800;letter-spacing:1px;opacity:.8">NEXT ›</span><span dir="rtl" style="display:flex;align-items:center;gap:8px"><span style="font-size:18px;font-weight:800">${nx ? esc(nx.title) : 'End of list'}</span>${nx ? `<span style="font-size:13px;font-weight:800;padding:1px 6px;border:1.5px solid currentColor;border-radius:4px;direction:ltr">${esc(nx.key || '—')}</span>` : ''}</span></button>
      </div></div>`;
  }

  // ---------- settings / backup ----------
  function settingsHTML() {
    const n = Object.keys(DB.songs).length, ly = Object.values(DB.songs).filter(s => s.lyrics).length;
    return `<div class="page"><div class="hrow" style="padding:10px 16px;border-bottom:var(--bw) solid var(--ink)"><button class="back" data-act="back">${I.back}Board</button><b style="flex:1;text-align:center;margin-right:60px">Backup & settings</b></div>
      <div class="scroll"><div class="form">
        <div class="card" style="${SET.lastBackup ? '' : 'border-color:var(--danger);background:#FBEAE8'}"><b style="font-size:17px;color:${SET.lastBackup ? 'var(--ok)' : 'var(--danger)'}">${SET.lastBackup ? '✓ Last backup ' + esc(new Date(SET.lastBackup).toLocaleString()) : 'Not backed up yet'}</b>
          <span style="font-size:13px">${n} songs · ${ly} with lyrics · ${DB.lists.length} lists · ${DB.events.length} event${DB.events.length === 1 ? '' : 's'}</span>
          <span class="muted" style="font-size:13px">Everything is saved on this phone. A backup file keeps it safe if the phone is lost — save it to iCloud Drive, Google Drive or Dropbox.</span></div>
        <button class="btn primary" style="min-height:50px;font-size:16px" data-act="backup">Back up now (download file)</button>
        <button class="btn" data-act="restore">Restore from a backup file</button>
        <button class="btn" data-act="csv">Download as a spreadsheet (.csv)</button>
        <input type="file" id="restorefile" accept=".json,application/json" class="hidden">
        <div style="height:1px;background:var(--line2);margin:4px 0"></div>
        <div class="field"><span class="lbl">LOOK</span><div class="seg"><button class="${SET.look === 'A' ? 'on' : ''}" data-act="look" data-v="A">Look A · Linen</button><button class="${SET.look === 'B' ? 'on' : ''}" data-act="look" data-v="B">Look B · Quiet</button></div></div>
        <div class="field"><span class="lbl">LYRICS SIZE · ${SET.lyricSize}px</span><div class="seg">${[18, 20, 22, 26, 30].map(v => `<button class="${SET.lyricSize === v ? 'on' : ''}" data-act="lsize" data-v="${v}">${v}</button>`).join('')}</div></div>
        <span class="muted" style="font-size:12px;line-height:1.4">Automatic cloud backup and the same library on two phones (sync) come in a later version.</span>
        <button class="link" style="color:var(--danger);align-self:flex-start" data-act="reset">${UI.resetArm ? 'Tap again — this erases your changes and reloads the original list' : 'Reset to the original song list'}</button>
      </div></div></div>`;
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function csv() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['List', 'Section', '#', 'Title', 'Tune / Composer', 'Key', 'Meter', 'Known', 'Favorite', 'Link', 'Lyrics']];
    DB.lists.forEach(L => L.sections.forEach(S => S.ids.forEach((id, i) => { const s = DB.songs[id]; rows.push([L.name, S.name, i + 1, s.title, s.tune, s.key, s.meter, s.known ? 'yes' : '', DB.favs.includes(id) ? 'yes' : '', s.youtube, s.lyrics]); })));
    return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
  }

  // ---------- overlays ----------
  function overlayHTML() {
    const o = UI.overlay; if (!o) return '';
    if (o.type === 'sec') {
      const L = DB.lists[UI.idx]; const f = UI.sec[UI.idx] || null;
      const favN = L.sections.reduce((a, S) => a + S.ids.filter(id => DB.favs.includes(id)).length, 0);
      const opts = [{ k: '', n: 'All sections', c: listTotal(L) }, { k: '__fav', n: '♡ Favorites', c: favN }].concat(L.sections.map(S => ({ k: S.name, n: S.name || 'Songs', c: S.ids.length })));
      return `<div class="scrim top" data-act="close"><div class="menu">${opts.map(x => `<button class="opt${(x.k || null) === f ? ' on' : ''}" data-act="pick-sec" data-v="${esc(x.k)}"><small>${x.c}</small><span dir="auto">${esc(x.n)}</span></button>`).join('')}</div></div>`;
    }
    if (o.type === 'lists') {
      return `<div class="scrim top" data-act="close"><div class="menu"><div class="mh">JUMP TO A LIST</div>${DB.lists.map((L, i) => `<button class="opt${i === UI.idx ? ' on' : ''}" data-act="golist" data-li="${i}"><span>${esc(L.name)}</span><small>${listTotal(L)}</small></button>`).join('')}</div></div>`;
    }
    if (o.type === 'keys') {
      const counts = {}; Object.values(DB.songs).forEach(s => keyParts(s.key).forEach(k => counts[k] = (counts[k] || 0) + 1));
      const sel = o.key !== undefined ? o.key : UI.keyFilter; const near = o.near !== undefined ? o.near : UI.near;
      const nb = sel ? neighbors(sel) : [];
      const kb = k => `<button class="kbtn${k === sel ? ' on' : (near && nb.includes(k) ? ' near' : '')}" data-act="kpick" data-v="${k}">${k}<small>${counts[k] || 0}</small></button>`;
      let total = 0; if (sel) Object.values(DB.songs).forEach(s => { const p = keyParts(s.key); if (p.includes(sel) || (near && p.some(x => nb.includes(x)))) total++; });
      return `<div class="scrim" data-act="close"><div class="sheet" data-stop="1"><span class="grab"></span>
        <div style="display:flex;align-items:center;justify-content:space-between"><b style="font-size:20px">Pick a key</b><button class="link" style="color:var(--accent);text-decoration:none;font-size:15px" data-act="kclear">Show all</button></div>
        <span class="lbl">MINOR</span><div class="grid4">${ROOTS.map(r => r + 'm').map(kb).join('')}</div>
        <span class="lbl">MAJOR</span><div class="grid4">${ROOTS.map(kb).join('')}</div>
        <button class="toggle" data-act="knear"><span><b>Include neighbouring keys</b><small>${sel ? 'Also show ' + nb.join(' and ') : 'Pick a key first'}</small></span><span class="switch${near ? ' on' : ''}"><i></i></span></button>
        <button class="btn dark" style="min-height:52px;font-size:16px" data-act="kapply">${sel ? 'Show ' + total + ' songs' : 'Show all songs'}</button></div></div>`;
    }
    if (o.type === 'peek') {
      const s = DB.songs[o.id]; const lines = previewLines(s.lyrics, 6);
      return `<div class="scrim" data-act="close" style="justify-content:center;padding:20px"><div class="menu" data-stop="1" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;margin:0">
        <div class="rtl" style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:20px">${esc(s.title)}</b><span class="key">${esc(s.key || '—')}</span></div>
        <div class="rtl" style="font-size:18px;line-height:1.5;white-space:pre-line;color:var(--ink)">${esc(lines.join('\n'))}…</div>
        <div style="display:flex;gap:8px"><button class="btn" style="flex:1" data-act="close">Close</button><button class="btn primary" style="flex:1" data-act="open" data-id="${s.id}">Open song</button></div></div></div>`;
    }
    if (o.type === 'events') {
      return `<div class="scrim top" data-act="close"><div class="menu"><div class="mh">EVENTS</div>
        ${DB.events.slice().reverse().map(e => `<button class="opt${e.id === DB.currentEvent ? ' on' : ''}" data-act="pickev" data-v="${e.id}" style="flex-direction:column;align-items:flex-start;justify-content:center;min-height:50px"><span>${esc(e.title)}${e.date ? ' – ' + esc(fmtDate(e.date)) : ''}</span><small>${e.ids.length} songs${e.id === DB.currentEvent ? ' · open now' : ''}</small></button>`).join('')}
        <button class="opt" data-act="newev" data-v="empty">+ New empty event</button>
        <button class="opt" data-act="newev" data-v="copy" style="color:var(--accent)">+ New event, copy these ${ev().ids.length} songs</button>
        <button class="opt" data-act="evdetails">Rename / date / calendar link…</button></div></div>`;
    }
    if (o.type === 'evdetails') {
      const t = ev();
      return `<div class="scrim" data-act="close"><div class="sheet" data-stop="1"><span class="grab"></span><b style="font-size:18px">Event details</b>
        <label class="field"><span class="lbl">NAME</span><input class="inp" id="evt" value="${esc(t.title)}"></label>
        <label class="field"><span class="lbl">DATE</span><input class="inp" id="evd" type="date" value="${esc(t.date)}"></label>
        <label class="field"><span class="lbl">GOOGLE CALENDAR LINK (OPTIONAL)</span><input class="inp" id="evc" value="${esc(t.calendar)}" placeholder="Paste the event link"></label>
        <div style="display:flex;gap:8px"><button class="btn" style="flex:1;color:var(--danger);border-color:var(--danger)" data-act="delev">${o.delArm ? 'Tap again to delete' : 'Delete event'}</button><button class="btn primary" style="flex:1" data-act="saveev">Save</button></div></div></div>`;
    }
    return '';
  }

  // ---------- after render: bind non-click events ----------
  function after() {
    const b = $('#board');
    if (b) {
      b.scrollLeft = UI.idx * b.clientWidth * (UI.zoom ? 0.46 : 1);
      $$('.col', b).forEach(c => { const li = +c.dataset.li; if (UI.scroll[li]) c.scrollTop = UI.scroll[li]; });
      let t;
      b.addEventListener('scroll', () => {
        if (UI.zoom) return;
        clearTimeout(t); t = setTimeout(() => {
          const i = Math.round(b.scrollLeft / b.clientWidth);
          if (i !== UI.idx && i >= 0 && i < DB.lists.length) { UI.idx = i; refreshHeader(); $$('.col', b).forEach(c => c.classList.toggle('cur', +c.dataset.li === i)); updateTop(); }
        }, 60);
      }, { passive: true });
      $$('.col', b).forEach(c => c.addEventListener('scroll', () => { UI.scroll[+c.dataset.li] = c.scrollTop; if (+c.dataset.li === UI.idx) updateTop(); }, { passive: true }));
      // pinch
      let d0 = null;
      b.addEventListener('touchstart', e => { if (e.touches.length === 2) d0 = dist(e.touches); }, { passive: true });
      b.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && d0) { const r = dist(e.touches) / d0; if (r < 0.75 && !UI.zoom) { d0 = null; setZoom(true); } else if (r > 1.33 && UI.zoom) { d0 = null; setZoom(false); } }
      }, { passive: true });
      b.addEventListener('touchend', () => { d0 = null; }, { passive: true });
      b.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); if (e.deltaY > 3 && !UI.zoom) setZoom(true); else if (e.deltaY < -3 && UI.zoom) setZoom(false); }, { passive: false });
      // long-press to preview lyrics
      let lp = null;
      b.addEventListener('touchstart', e => { const r = e.target.closest('.row'); if (!r || e.touches.length > 1) return; const s = DB.songs[+r.dataset.id]; if (!s || !s.lyrics) return; lp = setTimeout(() => { lp = 'fired'; UI.overlay = { type: 'peek', id: s.id }; render(); }, 550); }, { passive: true });
      const cancel = () => { if (lp && lp !== 'fired') clearTimeout(lp); };
      b.addEventListener('touchmove', cancel, { passive: true }); b.addEventListener('touchend', e => { if (lp === 'fired') e.preventDefault(); cancel(); lp = null; });
      updateTop();
    }
    const sq = $('#sq');
    if (sq) { sq.focus(); sq.setSelectionRange(sq.value.length, sq.value.length); sq.addEventListener('input', () => { UI.search.q = sq.value; $('#sres').innerHTML = searchResults(); }); }
    const yt = $('[data-f="youtube"]');
    if (yt) yt.addEventListener('input', () => { readForm(); const keep = { start: yt.selectionStart }; render(); const n = $('[data-f="youtube"]'); n.focus(); n.setSelectionRange(keep.start, keep.start); });
    const tt = $('[data-f="title"]');
    if (tt) tt.addEventListener('change', () => { readForm(); render(); });
    const rf = $('#restorefile');
    if (rf) rf.addEventListener('change', () => {
      const f = rf.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { const d = safeJSON(r.result); if (d && d.songs && d.lists) { DB = d; saveDB(); toast('Restored ' + Object.keys(d.songs).length + ' songs'); render(); } else toast('That file is not a Song Library backup'); };
      r.readAsText(f);
    });
    if (UI.view === 'gig') keepAwake(true); else keepAwake(false);
  }
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  function setZoom(z) { UI.zoom = z; UI.overlay = null; render(); }
  function updateTop() { const btn = $('#totop'); if (!btn) return; btn.classList.toggle('hidden', UI.zoom || !(UI.scroll[UI.idx] > 400)); }

  // ---------- clicks ----------
  document.addEventListener('click', e => {
    if (UI.view === 'board' && UI.zoom && !UI.overlay) { const c = e.target.closest('.col'); if (c) { UI.idx = +c.dataset.li; setZoom(false); return; } }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, id = el.dataset.id ? +el.dataset.id : null;
    if (el.classList.contains('scrim') && e.target.closest('[data-stop]')) return; // tap inside a sheet's blank area
    switch (a) {
      case 'close': UI.overlay = null; render(); break;
      case 'star': {
        const t = ev(); const i = t.ids.indexOf(id);
        if (i >= 0) t.ids.splice(i, 1); else { t.ids.push(id); }
        saveDB();
        if (el.dataset.re || UI.view !== 'board') { if (UI.view === 'search') { $('#sres').innerHTML = searchResults(); } else render(); } else { refreshRows(id); refreshBar(); }
        if (i < 0) toast('Added to tonight · #' + t.ids.length);
        break; }
      case 'unstar': { const t = ev(); t.ids = t.ids.filter(x => x !== id); saveDB(); render(); break; }
      case 'fav': { const i = DB.favs.indexOf(id); if (i >= 0) DB.favs.splice(i, 1); else DB.favs.push(id); saveDB(); if (UI.view === 'board') { if (UI.sec[UI.idx] === '__fav') refreshBoardBody(); else { refreshRows(id); refreshHeader(); } } else render(); break; }
      case 'open': if (UI.zoom) break; UI.overlay = null; go('song', { songId: id, ctx: { type: 'section' } }); break;
      case 'opensearch': go('song', { songId: id, ctx: { type: 'search' } }); break;
      case 'opentonight': go('song', { songId: id, ctx: { type: 'tonight' } }); break;
      case 'peek': UI.overlay = { type: 'peek', id }; render(); break;
      case 'back': back(); break;
      case 'nav': if (!id) break; stopPlayer(); UI.songId = id; render(); break;
      case 'zoom': setZoom(!UI.zoom); break;
      case 'search': go('search'); break;
      case 'keys': UI.overlay = { type: 'keys' }; render(); break;
      case 'kpick': UI.overlay.key = el.dataset.v; render(); break;
      case 'knear': UI.overlay.near = !(UI.overlay.near !== undefined ? UI.overlay.near : UI.near); render(); break;
      case 'kclear': UI.keyFilter = null; UI.overlay = null; render(); break;
      case 'kapply': { const o = UI.overlay; if (o.key !== undefined) UI.keyFilter = o.key; if (o.near !== undefined) UI.near = o.near; UI.overlay = null; render(); break; }
      case 'add': startEdit(null); break;
      case 'secmenu': UI.overlay = { type: 'sec' }; render(); break;
      case 'pick-sec': UI.sec[UI.idx] = el.dataset.v || null; UI.scroll[UI.idx] = 0; UI.overlay = null; render(); break;
      case 'listmenu': if (UI.zoom) { setZoom(false); break; } UI.overlay = { type: 'lists' }; render(); break;
      case 'golist': UI.idx = +el.dataset.li; UI.overlay = null; UI.zoom = false; render(); break;
      case 'hidectl': SET.hideControls = !SET.hideControls; saveSet(); render(); break;
      case 'totop': { const c = $(`.col[data-li="${UI.idx}"]`); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); UI.scroll[UI.idx] = 0; break; }
      case 'tonight': go('tonight'); break;
      case 'settings': go('settings'); break;
      case 'size': SET.lyricSize = Math.max(16, Math.min(40, SET.lyricSize + +el.dataset.d)); saveSet(); document.documentElement.style.setProperty('--lyric-size', SET.lyricSize + 'px'); break;
      case 'editsong': startEdit(id); break;
      case 'listen': openPlayer(true); break;
      case 'closeplayer': stopPlayer(); $('#playerslot').innerHTML = ''; break;
      case 'pp': if (ytPlayer && ytPlayer.getPlayerState) { ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo(); } break;
      case 'skip': if (ytPlayer && ytPlayer.getCurrentTime) ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() + +el.dataset.d), true); break;
      case 'seek': if (ytPlayer && ytPlayer.getDuration) { const r = el.getBoundingClientRect(); ytPlayer.seekTo((e.clientX - r.left) / r.width * ytPlayer.getDuration(), true); } break;
      case 'speedmenu': $('#speedmenu').classList.toggle('hidden'); break;
      case 'speed': { const v = +el.dataset.v; UI.player.speed = v; if (ytPlayer && ytPlayer.setPlaybackRate) ytPlayer.setPlaybackRate(v); $('#spd').textContent = v + '×'; $('#speedmenu').classList.add('hidden'); break; }
      case 'setA': if (ytPlayer && ytPlayer.getCurrentTime) { const t = ytPlayer.getCurrentTime(); UI.player.a = t; if (UI.player.b != null && UI.player.b <= t) UI.player.b = null; el.textContent = 'A ' + fmtTime(t); el.classList.add('on'); if (UI.player.b == null) { $('#bb').textContent = 'Set B'; $('#bb').classList.remove('on'); } } break;
      case 'setB': if (ytPlayer && ytPlayer.getCurrentTime) { const t = ytPlayer.getCurrentTime(); if (UI.player.a == null || t <= UI.player.a) { toast('Set A first, then B later in the song'); break; } UI.player.b = t; el.textContent = 'B ' + fmtTime(t); el.classList.add('on'); ytPlayer.seekTo(UI.player.a, true); } break;
      case 'clearab': if (UI.player) { UI.player.a = UI.player.b = null; $('#ba').textContent = 'Set A'; $('#bb').textContent = 'Set B'; $('#ba').classList.remove('on'); $('#bb').classList.remove('on'); } break;
      // edit
      case 'kmode': { readForm(); const s = UI.edit.song; const m = (s.key || '').match(/^([A-G][#b]?)(m?)$/); const minor = el.dataset.v === 'min'; UI.edit.minor = minor; if (m) s.key = m[1] + (minor ? 'm' : ''); render(); break; }
      case 'kroot': { readForm(); const minor = UI.edit.minor !== undefined ? UI.edit.minor : /m$/.test(UI.edit.song.key || 'm'); UI.edit.song.key = el.dataset.v + (minor ? 'm' : ''); render(); break; }
      case 'knone': readForm(); UI.edit.song.key = ''; render(); break;
      case 'meter': readForm(); UI.edit.song.meter = el.dataset.v; render(); break;
      case 'known': readForm(); UI.edit.song.known = !UI.edit.song.known; render(); break;
      case 'pos': readForm(); UI.edit.after = +el.dataset.v; render(); break;
      case 'save': saveEdit(); break;
      case 'delsong': {
        if (!UI.edit.delArm) { readForm(); UI.edit.delArm = true; render(); break; }
        const sid = UI.edit.song.id; const loc = locate(sid); if (loc) DB.lists[loc.li].sections[loc.si].ids.splice(loc.i, 1);
        delete DB.songs[sid]; DB.events.forEach(x => x.ids = x.ids.filter(i => i !== sid)); DB.favs = DB.favs.filter(i => i !== sid); saveDB();
        stack.length = 0; UI.view = 'board'; render(); toast('Song deleted'); break; }
      // search
      case 'scope': UI.search.scope = el.dataset.v; render(); break;
      // tonight
      case 'evmenu': UI.overlay = { type: 'events' }; render(); break;
      case 'pickev': DB.currentEvent = el.dataset.v; saveDB(); UI.overlay = null; render(); break;
      case 'newev': { const copy = el.dataset.v === 'copy'; const n = { id: 'e' + Date.now(), title: 'New event', date: today(), calendar: '', playlist: '', ids: copy ? ev().ids.slice() : [] }; DB.events.push(n); DB.currentEvent = n.id; saveDB(); UI.overlay = { type: 'evdetails' }; render(); break; }
      case 'evdetails': UI.overlay = { type: 'evdetails' }; render(); break;
      case 'saveev': { const t = ev(); t.title = $('#evt').value.trim() || t.title; t.date = $('#evd').value; t.calendar = $('#evc').value.trim(); saveDB(); UI.overlay = null; render(); break; }
      case 'delev': { if (!UI.overlay.delArm) { UI.overlay.delArm = true; render(); break; } if (DB.events.length === 1) { ev().ids = []; ev().title = 'Tonight'; } else { DB.events = DB.events.filter(x => x.id !== DB.currentEvent); DB.currentEvent = DB.events[DB.events.length - 1].id; } saveDB(); UI.overlay = null; render(); break; }
      case 'reorder': UI.reorder = !UI.reorder; render(); break;
      case 'mv': { const t = ev(); const i = +el.dataset.i, j = i + +el.dataset.d; [t.ids[i], t.ids[j]] = [t.ids[j], t.ids[i]]; saveDB(); render(); break; }
      case 'copylist': { const txt = tonightText(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copied — paste it in WhatsApp'), () => { download('tonight.txt', txt, 'text/plain'); }); break; }
      case 'share': { const txt = tonightText(); if (navigator.share) navigator.share({ title: ev().title, text: txt }).catch(() => {}); else navigator.clipboard && navigator.clipboard.writeText(txt).then(() => toast('Copied')); break; }
      case 'clear': if (!UI.clearArm) { UI.clearArm = true; render(); setTimeout(() => { UI.clearArm = false; if (UI.view === 'tonight') render(); }, 4000); break; } ev().ids = []; UI.clearArm = false; saveDB(); render(); break;
      case 'startgig': UI.gigI = 0; go('gig'); break;
      case 'playall': { const first = ev().ids.find(x => linkInfo(DB.songs[x].youtube).vid); if (!first) break; UI.queue = true; go('song', { songId: first, ctx: { type: 'tonight' } }); openPlayer(true); break; }
      case 'gignext': UI.gigI++; render(); $('.gig .scroll').scrollTop = 0; break;
      case 'gigprev': UI.gigI = Math.max(0, UI.gigI - 1); render(); break;
      case 'endgig': keepAwake(false); back(); break;
      // settings
      case 'backup': download('song-library-backup-' + today() + '.json', JSON.stringify(DB), 'application/json'); SET.lastBackup = Date.now(); saveSet(); setTimeout(render, 300); break;
      case 'restore': $('#restorefile').click(); break;
      case 'csv': download('song-library-' + today() + '.csv', csv(), 'text/csv'); break;
      case 'look': SET.look = el.dataset.v; saveSet(); render(); break;
      case 'lsize': SET.lyricSize = +el.dataset.v; saveSet(); render(); break;
      case 'reset': if (!UI.resetArm) { UI.resetArm = true; render(); break; } UI.resetArm = false; localStorage.removeItem(DB_KEY); boot(); break;
    }
  });
  document.addEventListener('change', e => {
    const a = e.target.dataset.act;
    if (a === 'elist') { readForm(); UI.edit.li = +e.target.value; UI.edit.si = 0; UI.edit.after = DB.lists[UI.edit.li].sections[0].ids.length - 1; render(); }
    if (a === 'esec') { readForm(); UI.edit.si = +e.target.value; UI.edit.after = DB.lists[UI.edit.li].sections[UI.edit.si].ids.filter(i => i !== UI.edit.song.id).length - 1; render(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.overlay) { UI.overlay = null; render(); } });
  window.addEventListener('resize', () => { const b = $('#board'); if (b && !UI.zoom) b.scrollLeft = UI.idx * b.clientWidth; });

  // ---------- boot ----------
  async function boot() {
    const saved = safeJSON(localStorage.getItem(DB_KEY));
    if (saved && saved.songs) DB = saved;
    else {
      let seed = window.SONG_LIBRARY_SEED;
      if (!seed) { try { seed = await (await fetch('song-library.json')).json(); } catch (e) { app().innerHTML = '<div class="empty">Could not load the song list.</div>'; return; } }
      DB = fromSeed(seed); saveDB();
    }
    UI.view = 'board'; stack.length = 0; render();
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.SONG_LIBRARY_SEED) navigator.serviceWorker.register('sw.js').catch(() => {});
  boot();
})();
