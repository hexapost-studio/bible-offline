/* app.js — application (DOM). Logique pure dans lib.js (window.Lib). */
"use strict";
(function () {
const L = window.Lib;
const ORDER = ["ls1910", "darby", "martin", "kjv"];
const NAMES = { ls1910: "Louis Segond (1910)", darby: "Darby", martin: "Martin (1744)", kjv: "King James Version" };
const $ = (s) => document.querySelector(s);
const reader = $("#reader"), selV = $("#version"), selCV = $("#cmpVersion"),
      selB = $("#book"), selC = $("#chapter"), search = $("#search"), pop = $("#pop"), spop = $("#spop");

/* ---------- état persistant ---------- */
let st = JSON.parse(localStorage.getItem("bible_state") || "{}");
st.v = ORDER.includes(st.v) ? st.v : "ls1910";
st.cv = ORDER.includes(st.cv) && st.cv !== st.v ? st.cv : ORDER.find((k) => k !== st.v);
st.b = Number.isInteger(st.b) ? st.b : 0;
st.c = Number.isInteger(st.c) ? st.c : 0;
st.cmp = !!st.cmp;
let HL = JSON.parse(localStorage.getItem("bible_highlights") || "{}");
let NOTES = JSON.parse(localStorage.getItem("bible_notes") || "{}");
let HIST = JSON.parse(localStorage.getItem("bible_history") || "[]");
let PLAN = JSON.parse(localStorage.getItem("bible_plan") || "{}");
let SET = JSON.parse(localStorage.getItem("bible_settings") || "{}");
let view = "read", popTarget = null;

const save = () => localStorage.setItem("bible_state", JSON.stringify({ v: st.v, cv: st.cv, b: st.b, c: st.c, cmp: st.cmp }));
const saveHL = () => localStorage.setItem("bible_highlights", JSON.stringify(HL));
const saveNotes = () => localStorage.setItem("bible_notes", JSON.stringify(NOTES));
const saveHist = () => localStorage.setItem("bible_history", JSON.stringify(HIST));
const savePlan = () => localStorage.setItem("bible_plan", JSON.stringify(PLAN));
const saveSet = () => localStorage.setItem("bible_settings", JSON.stringify(SET));

const esc = L.esc;
const keyOf = (bi, ci, v) => bi + ":" + ci + ":" + v;
const isKJV = () => st.v === "kjv";
const bible = () => window.BIBLES[st.v];
const setBusy = (b) => reader.setAttribute("aria-busy", b ? "true" : "false");

/* ---------- chargement des données à la demande (perf) ---------- */
const loaded = {};
function loadScript(src) {
  if (loaded[src]) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = false;
    s.onload = () => { loaded[src] = true; res(); };
    s.onerror = () => rej(new Error("Échec de chargement : " + src));
    document.head.appendChild(s);
  });
}
async function ensureVersion(key) {
  await loadScript(`data/${key}.js`);
  if (key === "kjv") await loadScript("data/kjvi.js");
}
const ensureStrong = () => loadScript("data/strong.js");
const ensureXref = () => loadScript("data/crossref.js");
async function ensureRead() {
  await ensureVersion(st.v);
  if (isKJV()) await ensureStrong();
}
function loading(msg) { reader.innerHTML = `<p class="muted" role="status">${esc(msg || "Chargement…")}</p>`; setBusy(true); }
async function guard(promise, msg) {
  loading(msg);
  try { await promise; setBusy(false); return true; }
  catch (e) { reader.innerHTML = `<p class="muted">⚠️ ${esc(e.message)}</p>`; setBusy(false); return false; }
}

/* ---------- réglages de lecture ---------- */
function applySettings() {
  document.body.classList.toggle("light", SET.theme === "light");
  document.body.classList.toggle("sepia", SET.theme === "sepia");
  const root = document.documentElement.style;
  root.setProperty("--reading-size", (SET.size || 19) + "px");
  root.setProperty("--reading-leading", String(SET.leading || 1.75));
  root.setProperty("--reading-font", SET.font === "sans" ? "var(--ui-font)" : '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif');
}

/* ---------- sélecteurs ---------- */
for (const k of ORDER) { selV.add(new Option(NAMES[k], k)); selCV.add(new Option(NAMES[k], k)); }
selV.value = st.v; selCV.value = st.cv;
const fillBooks = () => { selB.innerHTML = ""; bible().books.forEach((bk, i) => selB.add(new Option(bk.n, i))); selB.value = st.b; };
const fillChapters = () => { selC.innerHTML = ""; const n = bible().books[st.b].c.length; for (let i = 0; i < n; i++) selC.add(new Option("Chapitre " + (i + 1), i)); selC.value = st.c; };

const hlClass = (bi, ci, v) => { const c = HL[keyOf(bi, ci, v)]; return c ? " hl" + c : ""; };
const noteIcon = (bi, ci, v) => NOTES[keyOf(bi, ci, v)] ? '<span class="note-i" title="Note" aria-hidden="true">📝</span>' : "";

/* ---------- rendu du texte d'un verset (interlinéaire si KJV) ---------- */
function verseHTML(bi, ci, vs) {
  if (isKJV() && window.KJVI) {
    const segs = window.KJVI[`${bi}.${ci}.${vs.v}`];
    if (segs) return segs.map((seg) => {
      const txt = esc(seg[0]), s = seg[1];
      return s && window.STRONG && window.STRONG[s]
        ? `<span class="w" data-s="${s}" role="button" tabindex="0">${txt}</span> `
        : `<span class="w plain">${txt}</span> `;
    }).join("");
  }
  return esc(vs.t);
}

/* ---------- historique ---------- */
function pushHistory(bi, ci) {
  HIST = HIST.filter((h) => !(h[0] === bi && h[1] === ci));
  HIST.unshift([bi, ci]); HIST = HIST.slice(0, 8); saveHist();
}

/* ---------- vue Lecture ---------- */
function navHtml() {
  return `<nav class="pager" aria-label="Navigation entre chapitres"><button id="prev">‹ Précédent</button><button id="top">↑ Haut</button><button id="next">Suivant ›</button></nav>`;
}
function render() {
  view = "read"; search.value = ""; stopAudio();
  if (st.cmp) { renderCompare(); save(); return; }
  pushHistory(st.b, st.c);
  const bk = bible().books[st.b], ch = bk.c[st.c];
  const tag = isKJV() ? '<span class="pill">interlinéaire Strong</span>' : `<span class="pill">${esc(bible().name)}</span>`;
  let h = `<h2 class="title">${esc(bk.n)} ${st.c + 1} ${tag}</h2>`;
  h += `<div class="audio-bar"><button id="play" aria-label="Lire le chapitre à voix haute">🔊 Écouter</button></div>`;
  h += `<div class="chapter-body">`;
  for (const vs of ch)
    h += `<p class="verse${hlClass(st.b, st.c, vs.v)}" data-bi="${st.b}" data-ci="${st.c}" data-v="${vs.v}" id="v${vs.v}"><button class="vn" aria-label="Annoter le verset ${vs.v}">${vs.v}</button>${verseHTML(st.b, st.c, vs)}${noteIcon(st.b, st.c, vs.v)}</p>`;
  h += `</div>` + navHtml();
  reader.innerHTML = h; reader.parentElement.scrollTop = 0;
  wireNav(); wireVerseInteractions(); $("#play").onclick = toggleAudio; save();
}
function renderCompare() {
  const bL = bible().books[st.b], chL = bL.c[st.c], Br = window.BIBLES[st.cv], bR = Br.books[st.b], chR = bR.c[st.c];
  const mL = {}, mR = {}; chL.forEach((v) => mL[v.v] = v.t); chR.forEach((v) => mR[v.v] = v.t);
  const nums = [...new Set([...chL.map((v) => v.v), ...chR.map((v) => v.v)])].sort((a, b) => a - b);
  let h = `<h2 class="title">${esc(bL.n)} ${st.c + 1} <span class="pill">comparaison</span></h2><div class="cmp"><div class="colhead">${esc(bible().name)}</div><div class="colhead">${esc(Br.name)}</div>`;
  for (const v of nums) {
    h += `<div class="cmpcell${hlClass(st.b, st.c, v)}"><sup class="vn" style="cursor:default">${v}</sup> ${esc(mL[v] || "—")}</div>`;
    h += `<div class="cmpcell${hlClass(st.b, st.c, v)}"><sup class="vn" style="cursor:default">${v}</sup> ${esc(mR[v] || "—")}</div>`;
  }
  h += `</div>` + navHtml(); reader.innerHTML = h; reader.parentElement.scrollTop = 0; wireNav();
}
function wireNav() {
  const p = $("#prev"), n = $("#next"), t = $("#top");
  if (p) p.onclick = () => step(-1); if (n) n.onclick = () => step(1);
  if (t) t.onclick = () => reader.parentElement.scrollTo({ top: 0, behavior: "smooth" });
}
function wireVerseInteractions() {
  reader.querySelectorAll(".vn").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); openPop(el.closest("[data-bi]")); }));
  reader.querySelectorAll(".w[data-s]").forEach((el) => {
    const act = (e) => { e.stopPropagation(); openStrong(el); };
    el.addEventListener("click", act);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(e); } });
  });
}
async function step(d) {
  const books = bible().books; let c = st.c + d;
  if (c < 0) { if (st.b > 0) { st.b--; c = books[st.b].c.length - 1; } else c = 0; }
  else if (c >= books[st.b].c.length) { if (st.b < books.length - 1) { st.b++; c = 0; } else c = st.c; }
  st.c = c; selB.value = st.b; fillChapters(); selC.value = st.c;
  if (await guard(ensureRead())) render(); reader.focus();
}

/* ---------- lecture audio (Web Speech API, hors-ligne) ---------- */
let speaking = false, queue = [], qi = 0;
function stopAudio() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  speaking = false; const b = $("#play"); if (b) b.textContent = "🔊 Écouter";
  document.querySelectorAll(".verse.speaking").forEach((e) => e.classList.remove("speaking"));
}
function toggleAudio() {
  if (!("speechSynthesis" in window)) { alert("La lecture vocale n'est pas disponible sur ce navigateur."); return; }
  if (speaking) { stopAudio(); return; }
  const ch = bible().books[st.b].c[st.c];
  queue = ch.map((vs) => ({ v: vs.v, t: vs.t })); qi = 0; speaking = true;
  $("#play").textContent = "⏹ Arrêter"; speakNext();
}
function speakNext() {
  if (!speaking || qi >= queue.length) { stopAudio(); return; }
  const item = queue[qi];
  document.querySelectorAll(".verse.speaking").forEach((e) => e.classList.remove("speaking"));
  const el = document.getElementById("v" + item.v);
  if (el) { el.classList.add("speaking"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  const u = new SpeechSynthesisUtterance(item.t);
  u.lang = L.ttsLang(st.v); u.rate = 0.95;
  u.onend = () => { qi++; speakNext(); };
  u.onerror = () => { qi++; speakNext(); };
  window.speechSynthesis.speak(u);
}

/* ---------- popovers ---------- */
function placePop(el, node) {
  node.classList.add("show");
  const r = el.getBoundingClientRect();
  let x = Math.min(r.left, window.innerWidth - node.offsetWidth - 10), y = r.bottom + 6;
  if (y + node.offsetHeight > window.innerHeight) y = r.top - node.offsetHeight - 6;
  node.style.left = Math.max(8, x) + "px"; node.style.top = Math.max(8, y) + "px";
}
function openPop(verseEl) {
  popTarget = { bi: +verseEl.dataset.bi, ci: +verseEl.dataset.ci, v: +verseEl.dataset.v };
  spop.classList.remove("show"); placePop(verseEl, pop);
  const f = pop.querySelector("button"); if (f) f.focus();
}
pop.querySelectorAll("button").forEach((b) => {
  b.addEventListener("click", async (e) => {
    e.stopPropagation(); if (!popTarget) return;
    const t = popTarget, k = keyOf(t.bi, t.ci, t.v), a = b.dataset.a; pop.classList.remove("show");
    if (a === "hl") { const c = +b.dataset.c; if (c === 0) delete HL[k]; else HL[k] = c; saveHL(); refresh(); }
    else if (a === "note") { const cur = NOTES[k] || ""; const txt = prompt("Note pour ce verset :", cur);
      if (txt !== null) { if (txt.trim()) NOTES[k] = txt.trim(); else delete NOTES[k]; saveNotes(); refresh(); } }
    else if (a === "copy") { copyVerse(t.bi, t.ci, t.v); }
    else if (a === "xref") { if (await guard(ensureXref())) showXref(t.bi, t.ci, t.v); }
  });
});
function refresh() { view === "favs" ? showFavs() : (st.cmp ? renderCompare() : render()); }

async function copyVerse(bi, ci, v) {
  const bk = bible().books[bi]; const vs = (bk.c[ci] || []).find((x) => x.v === v); if (!vs) return;
  const txt = `« ${vs.t} »\n— ${L.formatRef(bk.n, ci, v)} (${bible().name})`;
  try {
    if (navigator.share) { await navigator.share({ text: txt }); return; }
    await navigator.clipboard.writeText(txt); toast("Verset copié ✅");
  } catch (e) { toast("Copie impossible"); }
}
let toastTimer;
function toast(msg) {
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t);
    t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 16px;box-shadow:0 8px 30px var(--shadow);z-index:80"; }
  t.textContent = msg; t.style.display = "block"; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = "none"; }, 1800);
}

async function openStrong(wordEl) {
  if (!window.STRONG) { try { await ensureStrong(); } catch (e) { return; } } // silencieux : ne pas toucher la zone de lecture
  const num = wordEl.dataset.s, e = window.STRONG[num]; if (!e) return;
  pop.classList.remove("show");
  const lg = L.strongLang(num);
  spop.innerHTML = `<div><span class="num">${num}</span> <span class="lemma" lang="${lg.lang}" dir="${lg.dir}">${esc(e.l || "")}</span> <span class="translit">${esc(e.t || "")}</span></div>
    <div style="margin-top:6px">${esc(e.d || "—")}</div>
    <div class="more"><button id="spopMore">📚 Voir dans le dictionnaire</button></div>`;
  placePop(wordEl, spop);
  $("#spopMore").onclick = (ev) => { ev.stopPropagation(); spop.classList.remove("show"); showDico(num); };
  $("#spopMore").focus();
}
document.addEventListener("click", () => { pop.classList.remove("show"); spop.classList.remove("show"); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { pop.classList.remove("show"); spop.classList.remove("show"); } });

/* ---------- accueil ---------- */
function showHome() {
  view = "home"; stopAudio();
  const ref = L.verseOfDay(new Date(), L.VOTD);
  const bk = bible().books[ref[0]]; const vs = (bk && bk.c[ref[1]] || []).find((x) => x.v === ref[2]);
  let h = `<div class="home-hero"><div class="k">Verset du jour</div>
    <p class="votd">${vs ? esc(vs.t) : ""}</p>
    <button class="result" id="votdGo" style="display:inline-block;width:auto"><span class="ref">${esc(bk.n)} ${ref[1] + 1}:${ref[2]}</span></button></div>`;
  if (HIST.length) {
    h += `<div class="section-label">Reprendre la lecture</div><div class="cards">`;
    for (const [bi, ci] of HIST.slice(0, 4)) { const b = bible().books[bi]; if (!b) continue;
      h += `<button class="card" data-bi="${bi}" data-ci="${ci}"><div class="t">${esc(b.n)} ${ci + 1}</div><div class="d">${esc(bible().name)}</div></button>`; }
    h += `</div>`;
  }
  h += `<div class="section-label">Ancien Testament</div><div class="grid">`;
  bible().books.forEach((b, i) => { if (L.testament(i) === "AT") h += `<button class="book" data-bi="${i}">${esc(b.n)}</button>`; });
  h += `</div><div class="section-label">Nouveau Testament</div><div class="grid">`;
  bible().books.forEach((b, i) => { if (L.testament(i) === "NT") h += `<button class="book" data-bi="${i}">${esc(b.n)}</button>`; });
  h += `</div>`;
  reader.innerHTML = h; reader.parentElement.scrollTop = 0; reader.focus();
  $("#votdGo").onclick = () => goTo(ref[0], ref[1], ref[2]);
  reader.querySelectorAll(".card").forEach((el) => el.onclick = () => goTo(+el.dataset.bi, +el.dataset.ci, 1));
  reader.querySelectorAll(".book").forEach((el) => el.onclick = () => showChapters(+el.dataset.bi));
}
function showChapters(bi) {
  view = "chapters"; const b = bible().books[bi];
  let h = `<h2 class="title">${esc(b.n)} <span class="pill">${b.c.length} chapitres</span></h2><div class="grid">`;
  for (let i = 0; i < b.c.length; i++) h += `<button class="ch" data-bi="${bi}" data-ci="${i}">${i + 1}</button>`;
  h += `</div>`; reader.innerHTML = h; reader.parentElement.scrollTop = 0;
  reader.querySelectorAll(".ch").forEach((el) => el.onclick = () => goTo(+el.dataset.bi, +el.dataset.ci, 1));
}

/* ---------- références croisées ---------- */
function showXref(bi, ci, v) {
  view = "xref"; pop.classList.remove("show");
  const bk = bible().books[bi], refs = (window.XREF && window.XREF[`${bi}.${ci}.${v}`]) || [];
  let h = `<h2 class="title">🔗 Références croisées <span class="pill">${esc(bk.n)} ${ci + 1}:${v}</span></h2>`;
  const src = (bk.c[ci] || []).find((x) => x.v === v); if (src) h += `<p class="lead small">« ${esc(src.t)} »</p>`;
  if (!refs.length) h += `<p class="muted">Aucune référence croisée pour ce verset.</p>`;
  else { h += `<div class="results">`;
    for (const [rb, rc, rv] of refs) { const tb = bible().books[rb]; if (!tb) continue;
      const tv = (tb.c[rc] || []).find((x) => x.v === rv);
      h += `<button class="result" data-bi="${rb}" data-ci="${rc}" data-v="${rv}"><span class="ref">${esc(tb.n)} ${rc + 1}:${rv}</span><span>${esc(tv ? tv.t : "")}</span></button>`; }
    h += `</div>`; }
  reader.innerHTML = h; reader.parentElement.scrollTop = 0; reader.focus(); wireResultNav();
}

/* ---------- favoris / notes ---------- */
function showFavs() {
  view = "favs"; pop.classList.remove("show"); stopAudio();
  const keys = [...new Set([...Object.keys(HL), ...Object.keys(NOTES)])];
  let h = `<h2 class="title">★ Favoris, surlignages &amp; notes <span class="pill">${keys.length}</span></h2>`;
  if (!keys.length) { h += `<p class="muted">Rien pour l'instant. Clique le n° d'un verset → couleur ou 📝.</p>`; reader.innerHTML = h; return; }
  const items = keys.map((k) => { const [bi, ci, v] = k.split(":").map(Number); return { bi, ci, v, c: HL[k], note: NOTES[k] }; })
    .sort((a, b) => a.bi - b.bi || a.ci - b.ci || a.v - b.v);
  h += `<div class="results">`;
  for (const it of items) { const bk = bible().books[it.bi]; if (!bk) continue;
    const vs = (bk.c[it.ci] || []).find((x) => x.v === it.v); const txt = vs ? vs.t : "(introuvable)";
    h += `<button class="result ${it.c ? "hl" + it.c : ""}" data-bi="${it.bi}" data-ci="${it.ci}" data-v="${it.v}"><span class="ref">${esc(bk.n)} ${it.ci + 1}:${it.v}</span><span>${esc(txt)}</span>${it.note ? `<span class="note-box">📝 ${esc(it.note)}</span>` : ""}</button>`; }
  h += `</div>`; reader.innerHTML = h; reader.parentElement.scrollTop = 0; reader.focus(); wireResultNav();
}
function wireResultNav() { reader.querySelectorAll(".result[data-bi]").forEach((el) => el.addEventListener("click", () => goTo(+el.dataset.bi, +el.dataset.ci, +el.dataset.v))); }
async function goTo(bi, ci, v) {
  st.cmp = false; $("#compare").setAttribute("aria-pressed", "false"); selCV.hidden = true;
  st.b = bi; st.c = ci; selB.value = bi; fillChapters(); selC.value = ci;
  if (await guard(ensureRead())) render();
  const t = document.getElementById("v" + v); if (t) { t.classList.add("active"); t.scrollIntoView({ block: "center" }); }
}

/* ---------- plan de lecture ---------- */
function planArray() { return L.buildPlan(bible().books.map((b) => b.c.length), 365); }
function showPlan() {
  view = "plan"; stopAudio();
  const plan = planArray();
  const today = Math.min(L.dayOfYear(new Date()), plan.length - 1);
  const done = PLAN.done || {};
  const nbDone = Object.keys(done).length;
  const pct = Math.round((nbDone / plan.length) * 100);
  let h = `<h2 class="title">🗓 Plan de lecture <span class="pill">Bible en 1 an</span></h2>
    <p class="lead">Progression : <b>${nbDone}/${plan.length}</b> jours (${pct} %).</p>
    <div class="section-label">Aujourd'hui — jour ${today + 1}</div><div class="results">`;
  for (const [bi, ci] of plan[today]) { const b = bible().books[bi];
    h += `<button class="result" data-bi="${bi}" data-ci="${ci}"><span class="ref">${esc(b.n)} ${ci + 1}</span></button>`; }
  h += `</div><div class="toolbar" style="margin-top:16px"><button id="planDone" aria-pressed="${!!done[today]}">${done[today] ? "✅ Jour lu" : "Marquer le jour comme lu"}</button></div>`;
  reader.innerHTML = h; reader.parentElement.scrollTop = 0; reader.focus(); wireResultNav();
  $("#planDone").onclick = () => { PLAN.done = PLAN.done || {}; if (PLAN.done[today]) delete PLAN.done[today]; else PLAN.done[today] = 1; savePlan(); showPlan(); };
}

/* ---------- dictionnaire Strong ---------- */
async function showDico(q) {
  view = "dico"; pop.classList.remove("show"); spop.classList.remove("show"); stopAudio();
  if (!(await guard(ensureStrong()))) return;
  reader.innerHTML = `<h2 class="title">📚 Dictionnaire Strong</h2>
    <div class="toolbar"><label class="visually-hidden" for="dq">Recherche Strong</label>
      <input id="dq" placeholder="Numéro (G26, H157) ou mot…" aria-label="Recherche Strong" style="flex:1;min-width:180px" value="${q ? esc(q) : ""}">
      <button id="dgo">Chercher</button></div>
    <p class="lead small">Concordance de James Strong (hébreu 1894 / grec 1890, domaine public). Tape un numéro <b>G####</b>/<b>H####</b> ou un mot.</p>
    <div id="dres"></div>`;
  reader.parentElement.scrollTop = 0;
  const run = () => dicoSearch($("#dq").value);
  $("#dgo").onclick = run; $("#dq").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); }); $("#dq").focus();
  if (q) dicoSearch(q);
}
function entryHtml(num, e) {
  const lg = L.strongLang(num);
  return `<section class="entry"><div><span class="num">${num}</span> <span class="lemma" lang="${lg.lang}" dir="${lg.dir}">${esc(e.l || "")}</span> <span class="translit">${esc(e.t || "")}</span></div>
    <div class="lbl">Définition</div><div>${esc(e.d || "—")}</div>
    <div class="lbl">Usage (KJV)</div><div class="muted">${esc(e.k || "—")}</div></section>`;
}
function dicoSearch(q) {
  q = (q || "").trim(); const box = $("#dres"); if (!box) return;
  if (!q) { box.innerHTML = ""; return; }
  const m = q.match(/^([GgHh])\s*0*(\d+)$/);
  if (m) { const num = m[1].toUpperCase() + m[2]; const e = window.STRONG[num];
    box.innerHTML = e ? entryHtml(num, e) : `<p class="muted">Aucune entrée « ${esc(num)} ».</p>`; return; }
  const ql = q.toLowerCase(), res = [], max = 60;
  for (const num in window.STRONG) { const e = window.STRONG[num];
    if ((e.t && e.t.toLowerCase().includes(ql)) || (e.l && e.l.includes(q)) || (e.d && e.d.toLowerCase().includes(ql)) || (e.k && e.k.toLowerCase().includes(ql))) { res.push([num, e]); if (res.length >= max) break; } }
  box.innerHTML = res.length ? `<p class="small muted">${res.length}${res.length >= max ? "+" : ""} résultat(s)</p>` + res.map(([n, e]) => entryHtml(n, e)).join("") : `<p class="muted">Aucun résultat pour « ${esc(q)} ».</p>`;
}

/* ---------- recherche plein-texte ---------- */
let stimer;
search.addEventListener("input", () => { clearTimeout(stimer); stimer = setTimeout(runSearch, 220); });
function runSearch() {
  const q = search.value.trim().toLowerCase(); if (q.length < 3) { if (view === "search") render(); return; }
  view = "search"; stopAudio();
  const books = bible().books, res = [], max = 300;
  outer: for (let bi = 0; bi < books.length; bi++) { const bk = books[bi];
    for (let ci = 0; ci < bk.c.length; ci++) for (const vs of bk.c[ci]) {
      if (vs.t.toLowerCase().includes(q)) { res.push({ bi, ci, v: vs.v, t: vs.t, ref: `${bk.n} ${ci + 1}:${vs.v}` }); if (res.length >= max) break outer; } } }
  const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
  let h = `<h2 class="title">Recherche : « ${esc(search.value.trim())} »</h2><p class="lead">${res.length}${res.length >= max ? "+" : ""} résultat(s) · ${esc(bible().name)}</p><div class="results">`;
  for (const r of res) h += `<button class="result" data-bi="${r.bi}" data-ci="${r.ci}" data-v="${r.v}"><span class="ref">${esc(r.ref)}</span><span>${esc(r.t).replace(re, "<mark>$1</mark>")}</span></button>`;
  h += "</div>"; reader.innerHTML = h; reader.parentElement.scrollTop = 0; wireResultNav();
}

/* ---------- réglages ---------- */
function seg(id, label, options, current) {
  let h = `<div class="settings-row"><span>${label}</span><span class="seg" role="group" aria-label="${label}">`;
  for (const o of options) h += `<button data-set="${id}" data-val="${o.v}" aria-pressed="${String(current) === String(o.v)}">${o.t}</button>`;
  return h + `</span></div>`;
}
function showSettings() {
  view = "settings"; stopAudio();
  let h = `<h2 class="title">⚙️ Réglages</h2>`;
  h += seg("theme", "Thème", [{ v: "dark", t: "Sombre" }, { v: "light", t: "Clair" }, { v: "sepia", t: "Sépia" }], SET.theme || "dark");
  h += seg("font", "Police de lecture", [{ v: "serif", t: "Serif" }, { v: "sans", t: "Sans" }], SET.font || "serif");
  h += seg("size", "Taille du texte", [{ v: 16, t: "A−" }, { v: 19, t: "A" }, { v: 22, t: "A+" }, { v: 26, t: "A++" }], SET.size || 19);
  h += seg("leading", "Interligne", [{ v: 1.5, t: "Serré" }, { v: 1.75, t: "Normal" }, { v: 2.1, t: "Aéré" }], SET.leading || 1.75);
  h += `<div class="section-label">Mes données</div><div class="toolbar"><button id="exp">⬇️ Exporter (.json)</button><button id="imp">⬆️ Importer</button></div>
    <p class="small muted">${Object.keys(HL).length} surlignage(s) · ${Object.keys(NOTES).length} note(s), stockés dans ce navigateur.</p>`;
  reader.innerHTML = h; reader.parentElement.scrollTop = 0; reader.focus();
  reader.querySelectorAll("[data-set]").forEach((el) => el.onclick = () => {
    let val = el.dataset.val; if (el.dataset.set === "size" || el.dataset.set === "leading") val = parseFloat(val);
    SET[el.dataset.set] = val; saveSet(); applySettings(); showSettings();
  });
  $("#exp").onclick = exportData; $("#imp").onclick = () => $("#importFile").click();
}
function exportData() {
  const data = { highlights: HL, notes: NOTES, plan: PLAN, settings: SET, exported: new Date().toISOString() };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "bible-mes-donnees.json"; a.click(); URL.revokeObjectURL(a.href);
}
$("#importFile").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => { try { const d = JSON.parse(rd.result);
      if (d.highlights) HL = Object.assign(HL, d.highlights);
      if (d.notes) NOTES = Object.assign(NOTES, d.notes);
      if (d.plan) PLAN = Object.assign(PLAN, d.plan);
      if (d.settings) { SET = Object.assign(SET, d.settings); applySettings(); }
      saveHL(); saveNotes(); savePlan(); saveSet(); toast("Import réussi ✅"); showSettings();
    } catch (err) { toast("Fichier invalide"); } };
  rd.readAsText(f); e.target.value = "";
});

/* ---------- contrôles ---------- */
selV.addEventListener("change", async () => {
  st.v = selV.value;
  if (st.v === st.cv) { st.cv = ORDER.find((k) => k !== st.v); selCV.value = st.cv; }
  if (!(await guard(ensureRead(), "Chargement de la traduction…"))) return;
  st.b = Math.min(st.b, bible().books.length - 1); fillBooks();
  st.c = Math.min(st.c, bible().books[st.b].c.length - 1); fillChapters(); render();
});
selCV.addEventListener("change", async () => { st.cv = selCV.value; if (st.cmp) { if (await guard(ensureVersion(st.cv))) renderCompare(); } save(); });
selB.addEventListener("change", () => { st.b = +selB.value; st.c = 0; fillChapters(); render(); });
selC.addEventListener("change", () => { st.c = +selC.value; render(); });
$("#home").addEventListener("click", () => view === "home" ? render() : showHome());
$("#compare").addEventListener("click", async (e) => {
  st.cmp = !st.cmp; e.currentTarget.setAttribute("aria-pressed", st.cmp); selCV.hidden = !st.cmp;
  if (st.cmp) { if (!(await guard(ensureVersion(st.cv)))) return; }
  render();
});
$("#favs").addEventListener("click", () => view === "favs" ? render() : showFavs());
$("#dico").addEventListener("click", () => view === "dico" ? render() : showDico());
$("#plan").addEventListener("click", () => view === "plan" ? render() : showPlan());
$("#settings").addEventListener("click", () => view === "settings" ? render() : showSettings());
document.addEventListener("keydown", (e) => {
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "SELECT" || a.tagName === "TEXTAREA")) return;
  if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1);
});

/* ---------- init ---------- */
(async function init() {
  applySettings();
  $("#compare").setAttribute("aria-pressed", String(st.cmp)); selCV.hidden = !st.cmp;
  if (!(await guard(ensureRead(), "Chargement…"))) return;
  fillBooks(); fillChapters();
  if (st.cmp) { await guard(ensureVersion(st.cv)); }
  render();
})();
})();
