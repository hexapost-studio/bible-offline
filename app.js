/* app.js — application (DOM). Logique pure dans lib.js (window.Lib). */
"use strict";
(function () {
const L = window.Lib;
const ORDER = ["ls1910", "darby", "martin", "kjv"];
const NAMES = { ls1910: "Louis Segond (1910)", darby: "Darby", martin: "Martin (1744)", kjv: "King James Version" };
const O = window.OnlineBibles || null; // module hybride (Bibles sous droits, en ligne)
const isOnline = (k) => !!(O && O.targets().some((t) => t.key === k));
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
let TOPICS = JSON.parse(localStorage.getItem("bible_topics") || "{}");   // "bi:ci:v" -> ["thème", …]
let STUDY = JSON.parse(localStorage.getItem("bible_study") || "{}");     // "bi.ci"   -> {o,i,a,p,u}
let TRAIL = JSON.parse(localStorage.getItem("bible_trail") || "[]");     // parcours : [[bi,ci,v], …]
let view = "read", popTarget = null;

const save = () => localStorage.setItem("bible_state", JSON.stringify({ v: st.v, cv: st.cv, b: st.b, c: st.c, cmp: st.cmp }));
const saveHL = () => localStorage.setItem("bible_highlights", JSON.stringify(HL));
const saveNotes = () => localStorage.setItem("bible_notes", JSON.stringify(NOTES));
const saveHist = () => localStorage.setItem("bible_history", JSON.stringify(HIST));
const savePlan = () => localStorage.setItem("bible_plan", JSON.stringify(PLAN));
const saveSet = () => localStorage.setItem("bible_settings", JSON.stringify(SET));
const saveTopics = () => localStorage.setItem("bible_topics", JSON.stringify(TOPICS));
const saveStudy = () => localStorage.setItem("bible_study", JSON.stringify(STUDY));
const saveTrail = () => localStorage.setItem("bible_trail", JSON.stringify(TRAIL));

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
  if (isOnline(st.v)) {
    await ensureVersion("ls1910");           // squelette de navigation (noms + nb de chapitres)
    await O.ensureChapter(st.v, st.b, st.c);  // texte récupéré à la demande (en ligne)
    return;
  }
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
function rebuildOnlineOptions() {
  [...selV.options].filter((o) => o.value === "__sep" || isOnline(o.value)).forEach((o) => o.remove());
  if (!O) return;
  const sep = new Option("— En ligne (API.Bible) —", "__sep"); sep.disabled = true; selV.add(sep);
  for (const t of O.targets()) {
    const opt = new Option(`${t.name} (${t.abbr})`, t.key);
    opt.disabled = !O.isEnabled(t.key);
    opt.title = O.isEnabled(t.key) ? "Version en ligne" : "Nécessite une clé API.Bible / autorisation de l'éditeur";
    selV.add(opt);
  }
  if ([...selV.options].some((o) => o.value === st.v && !o.disabled)) selV.value = st.v;
}
rebuildOnlineOptions();
if (isOnline(st.v) && !(O && O.isEnabled(st.v))) st.v = "ls1910";
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

/* ---------- attribution & notes des versions en ligne (conformité licence) ---------- */
function onlineAttribution(b) {
  const parts = [];
  const cr = (b.copyright || "").replace(/<[^>]+>/g, "").trim();
  if (cr) parts.push(esc(cr));
  if (b.publisher && b.publisherUrl)
    parts.push(`<a href="${esc(b.publisherUrl)}" target="_blank" rel="noopener">${esc(b.publisher)}</a>`);
  parts.push(`Texte fourni par <a href="https://api.bible" target="_blank" rel="noopener">API.Bible</a>`);
  return `<p class="lead small attribution">${parts.join(" · ")}</p>`;
}
// Notes de bas de page (versions en ligne) — conservées et rendues accessibles, repliées par défaut.
function verseNotes(vs) {
  if (!vs.notes || !vs.notes.length) return "";
  const items = vs.notes.map((n) => `<li>${esc(n)}</li>`).join("");
  return `<details class="vnote"><summary aria-label="Notes du verset ${vs.v}">note</summary><ul>${items}</ul></details>`;
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
  const online = bible().online;
  const tag = isKJV() ? '<span class="pill">interlinéaire Strong</span>'
    : `<span class="pill">${esc(bible().name)}${online ? " · 🌐 en ligne" : ""}</span>`;
  let h = `<h2 class="title">${esc(bk.n)} ${st.c + 1} ${tag}</h2>`;
  // Versions en ligne (sous droits) : attribution obligatoire ; lecture audio interdite (texte ≠ audio).
  if (online) h += onlineAttribution(bible());
  else h += `<div class="audio-bar"><button id="play" aria-label="Lire le chapitre à voix haute">🔊 Écouter</button></div>`;
  h += `<div class="chapter-body">`;
  for (const vs of ch)
    h += `<p class="verse${hlClass(st.b, st.c, vs.v)}" data-bi="${st.b}" data-ci="${st.c}" data-v="${vs.v}" id="v${vs.v}"><button class="vn" aria-label="Annoter le verset ${vs.v}">${vs.v}</button>${verseHTML(st.b, st.c, vs)}${verseNotes(vs)}${noteIcon(st.b, st.c, vs.v)}</p>`;
  h += `</div>` + navHtml();
  reader.innerHTML = h; reader.parentElement.scrollTop = 0;
  wireNav(); wireVerseInteractions(); const play = $("#play"); if (play) play.onclick = toggleAudio; save();
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
  if (isOnline(st.v)) return; // texte sous droits : lecture audio interdite par la licence
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
    else if (a === "topic") { tagVerse(t.bi, t.ci, t.v); }
    else if (a === "trail") { startTrail(t.bi, t.ci, t.v); }
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
    <div class="more"><button id="spopMore">📚 Dictionnaire</button> <button id="spopStudy">🔬 Étudier ce mot</button></div>`;
  placePop(wordEl, spop);
  $("#spopMore").onclick = (ev) => { ev.stopPropagation(); spop.classList.remove("show"); showDico(num); };
  $("#spopStudy").onclick = (ev) => { ev.stopPropagation(); spop.classList.remove("show"); showStudy("word", num); };
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

/* ======================================================================
   ÉTUDE BIBLIQUE EN PROFONDEUR (hub à onglets)
   1) Étude de mot (concordance Strong)   2) Fiche inductive O/I/A
   3) Étude thématique (tags)             4) Parcours de références croisées
   ====================================================================== */
const studyState = { tab: "word" };
let sheetTimer;

function studyTabs(active) {
  const tabs = [["word", "🔤 Étude de mot"], ["sheet", "📝 Fiche d'étude"], ["topics", "🏷 Thèmes"], ["trail", "🧭 Parcours"]];
  return `<div class="tabs" role="tablist" aria-label="Sections d'étude">` +
    tabs.map(([k, t]) => `<button role="tab" aria-selected="${k === active}" data-tab="${k}">${t}</button>`).join("") + `</div>`;
}
async function showStudy(tab, arg) {
  tab = tab || studyState.tab || "word"; studyState.tab = tab;
  view = "study"; pop.classList.remove("show"); spop.classList.remove("show"); stopAudio();
  reader.innerHTML = `<h2 class="title">🔬 Étude biblique en profondeur</h2>${studyTabs(tab)}<div id="studyBody"></div>`;
  reader.parentElement.scrollTop = 0; reader.focus();
  reader.querySelectorAll(".tabs [data-tab]").forEach((el) => el.onclick = () => showStudy(el.dataset.tab));
  if (tab === "word") await studyWord(arg);
  else if (tab === "sheet") studySheet(arg);
  else if (tab === "topics") studyTopics(arg);
  else if (tab === "trail") await studyTrail();
}

/* --- 1) Étude de mot : définition Strong + toutes les occurrences --- */
async function studyWord(num) {
  const body = $("#studyBody"); if (!body) return;
  body.innerHTML = `<div class="toolbar"><label class="visually-hidden" for="wq">Numéro Strong</label>
    <input id="wq" placeholder="Numéro Strong : G26, H157…" style="flex:1;min-width:180px" value="${num ? esc(num) : (studyState.lastWord || "")}">
    <button id="wgo">Étudier</button></div>
    <p class="lead small">Entre un numéro Strong (ou clique un mot en lecture <b>KJV</b>) : définition hébreu/grec + tous ses emplois dans l'Écriture.</p>
    <div id="wres"></div>`;
  const run = () => wordRun($("#wq").value);
  $("#wgo").onclick = run; $("#wq").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  const q = num || studyState.lastWord; if (q) wordRun(q); else $("#wq").focus();
}
function occHtml(key, num) {
  const segs = window.KJVI[key]; if (!segs) return "";
  return segs.map((seg) => { const t = esc(seg[0]); return seg[1] === num ? `<mark>${t}</mark> ` : t + " "; }).join("");
}
async function wordRun(q) {
  const box = $("#wres"); if (!box) return;
  const m = (q || "").trim().match(/^([GgHh])\s*0*(\d+)$/);
  if (!m) { box.innerHTML = `<p class="muted">Entre un numéro Strong valide, ex. <b>G26</b> ou <b>H157</b>.</p>`; return; }
  const num = m[1].toUpperCase() + m[2]; studyState.lastWord = num;
  box.innerHTML = `<p class="muted" role="status">Chargement de l'interlinéaire…</p>`;
  try { await ensureStrong(); await ensureVersion("kjv"); }
  catch (e) { box.innerHTML = `<p class="muted">⚠️ ${esc(e.message)}</p>`; return; }
  const e = window.STRONG[num];
  const occ = L.concordance(window.KJVI, num);
  const totalHits = occ.reduce((s, o) => s + o[1], 0);
  let h = "";
  if (e) { const lg = L.strongLang(num);
    h += `<section class="entry"><div><span class="num">${num}</span> <span class="lemma" lang="${lg.lang}" dir="${lg.dir}">${esc(e.l || "")}</span> <span class="translit">${esc(e.t || "")}</span></div>
      <div class="lbl">Définition</div><div>${esc(e.d || "—")}</div>
      <div class="lbl">Usage (KJV)</div><div class="muted">${esc(e.k || "—")}</div></section>`;
  } else h += `<p class="muted">Numéro « ${esc(num)} » absent du dictionnaire.</p>`;
  h += `<div class="section-label">Occurrences <span class="pill">${totalHits} dans ${occ.length} verset(s)</span></div>`;
  if (!occ.length) h += `<p class="muted">Aucune occurrence dans l'interlinéaire (versification KJV).</p>`;
  else {
    const max = 250, shown = occ.slice(0, max);
    h += `<div class="results">`;
    for (const [key, cnt] of shown) { const [bi, ci, v] = key.split(".").map(Number); const bk = bible().books[bi]; if (!bk) continue;
      h += `<button class="result" data-bi="${bi}" data-ci="${ci}" data-v="${v}"><span class="ref">${esc(bk.n)} ${ci + 1}:${v}${cnt > 1 ? ` ·×${cnt}` : ""}</span><span>${occHtml(key, num)}</span></button>`; }
    h += `</div>`;
    if (occ.length > max) h += `<p class="small muted">Les ${max} premières occurrences sur ${occ.length}.</p>`;
  }
  box.innerHTML = h; wireResultNav();
}

/* --- 2) Fiche d'étude inductive : Observation / Interprétation / Application / Prière --- */
function studySheet(arg) {
  const body = $("#studyBody"); if (!body) return;
  let bi = st.b, ci = st.c;
  if (arg && typeof arg === "object") { bi = arg.bi; ci = arg.ci; }
  const bk = bible().books[bi], key = bi + "." + ci, s = STUDY[key] || {};
  const fields = [["o", "👁 Observation", "Que dit le texte ? (faits, contexte, répétitions, mots-clés)"],
    ["i", "💡 Interprétation", "Que signifie-t-il ? (sens, message central, à qui, pourquoi)"],
    ["a", "🎯 Application", "Comment l'appliquer concrètement à ma vie ?"],
    ["p", "🙏 Prière", "Ma réponse à Dieu à partir de ce passage"]];
  let h = `<div class="toolbar"><span>Chapitre étudié :</span> <b>${esc(bk.n)} ${ci + 1}</b>
    <button id="sheetGo">📖 Ouvrir en lecture</button></div>
    <p class="lead small">Méthode inductive (O/I/A). Sauvegarde automatique dans ce navigateur.</p>`;
  for (const [k, label, ph] of fields)
    h += `<div class="study-field"><label for="sf_${k}" class="lbl">${label}</label>
      <textarea id="sf_${k}" data-k="${k}" rows="4" placeholder="${esc(ph)}">${esc(s[k] || "")}</textarea></div>`;
  h += `<p id="sheetSaved" class="small muted" aria-live="polite">${s.u ? "Enregistré le " + new Date(s.u).toLocaleString("fr-FR") : ""}</p>`;
  const saved = Object.keys(STUDY).filter((k) => ["o", "i", "a", "p"].some((f) => STUDY[k][f]));
  if (saved.length) {
    saved.sort((a, b) => { const A = a.split("."), B = b.split("."); return (A[0] - B[0]) || (A[1] - B[1]); });
    h += `<div class="section-label">Mes fiches <span class="pill">${saved.length}</span></div><div class="results">`;
    for (const k of saved) { const [b2, c2] = k.split(".").map(Number); const bb = bible().books[b2]; if (!bb) continue;
      h += `<button class="result" data-sheet="${b2}.${c2}"><span class="ref">${esc(bb.n)} ${c2 + 1}</span></button>`; }
    h += `</div>`;
  }
  body.innerHTML = h;
  $("#sheetGo").onclick = () => goTo(bi, ci, 1);
  body.querySelectorAll("textarea[data-k]").forEach((ta) => ta.addEventListener("input", () => {
    clearTimeout(sheetTimer); sheetTimer = setTimeout(() => {
      const cur = STUDY[key] || {}; cur[ta.dataset.k] = ta.value.trim();
      let any = false; for (const f of ["o", "i", "a", "p"]) { if (cur[f]) any = true; else delete cur[f]; }
      if (any) { cur.u = Date.now(); STUDY[key] = cur; } else delete STUDY[key];
      saveStudy(); const sv = $("#sheetSaved"); if (sv) sv.textContent = any ? "Enregistré le " + new Date().toLocaleString("fr-FR") : "";
    }, 400);
  }));
  body.querySelectorAll("[data-sheet]").forEach((el) => el.onclick = () => { const [b2, c2] = el.dataset.sheet.split(".").map(Number); showStudy("sheet", { bi: b2, ci: c2 }); });
}

/* --- 3) Étude thématique (tags libres) --- */
function tagVerse(bi, ci, v) {
  const key = keyOf(bi, ci, v);
  const input = prompt("Thèmes pour ce verset (séparés par des virgules) :", (TOPICS[key] || []).join(", "));
  if (input === null) return;
  const tags = L.parseTags(input);
  if (tags.length) TOPICS[key] = tags; else delete TOPICS[key];
  saveTopics(); refresh(); toast(tags.length ? "Classé : " + tags.join(", ") : "Thèmes retirés");
}
function untag(key, theme) {
  if (!TOPICS[key]) return;
  TOPICS[key] = TOPICS[key].filter((t) => t !== theme);
  if (!TOPICS[key].length) delete TOPICS[key];
  saveTopics();
}
function studyTopics(theme) {
  const body = $("#studyBody"); if (!body) return;
  const groups = L.topicGroups(TOPICS);
  const themes = Object.keys(groups).sort((a, b) => a.localeCompare(b, "fr"));
  if (!theme) {
    let h = `<p class="lead small">Classe un verset par thème via 🏷 (clic sur son n° en lecture). Clique un thème pour revoir ses versets.</p>`;
    if (!themes.length) h += `<p class="muted">Aucun thème pour l'instant.</p>`;
    else { h += `<div class="chips">`;
      for (const t of themes) h += `<button class="chip" data-theme="${esc(t)}">${esc(t)} <span class="pill">${groups[t].length}</span></button>`;
      h += `</div>`; }
    body.innerHTML = h;
    body.querySelectorAll("[data-theme]").forEach((el) => el.onclick = () => studyTopics(el.dataset.theme));
    return;
  }
  const verses = groups[theme] || [];
  let h = `<div class="toolbar"><button id="topicsBack">‹ Tous les thèmes</button> <b>🏷 ${esc(theme)}</b> <span class="pill">${verses.length}</span></div><div class="results">`;
  for (const key of verses) { const [bi, ci, v] = key.split(":").map(Number); const bk = bible().books[bi]; if (!bk) continue;
    const vs = (bk.c[ci] || []).find((x) => x.v === v);
    h += `<div class="result-row"><button class="result" data-bi="${bi}" data-ci="${ci}" data-v="${v}"><span class="ref">${esc(bk.n)} ${ci + 1}:${v}</span><span>${esc(vs ? vs.t : "")}</span></button><button class="untag" data-key="${key}" data-theme="${esc(theme)}" aria-label="Retirer du thème ${esc(theme)}">✕</button></div>`; }
  h += `</div>`;
  body.innerHTML = h;
  $("#topicsBack").onclick = () => studyTopics();
  wireResultNav();
  body.querySelectorAll(".untag").forEach((el) => el.onclick = (e) => { e.stopPropagation(); untag(el.dataset.key, el.dataset.theme); toast("Thème retiré"); studyTopics(theme); });
}

/* --- 4) Parcours de références croisées (chaîne d'étude guidée) --- */
function startTrail(bi, ci, v) { TRAIL = [[bi, ci, v]]; saveTrail(); showStudy("trail"); }
async function studyTrail() {
  const body = $("#studyBody"); if (!body) return;
  if (!TRAIL.length) {
    body.innerHTML = `<p class="lead small">Un parcours suit les <b>références croisées</b> de verset en verset, avec un fil d'Ariane.</p>
      <div class="toolbar"><button id="trailStart">🧭 Démarrer depuis ${esc(bible().books[st.b].n)} ${st.c + 1}:1</button></div>
      <p class="muted small">Astuce : sur n'importe quel verset (clic sur son n°), le bouton 🧭 démarre aussi un parcours.</p>`;
    $("#trailStart").onclick = () => startTrail(st.b, st.c, 1);
    return;
  }
  let h = `<nav class="breadcrumb" aria-label="Fil du parcours">`;
  TRAIL.forEach(([bi, ci, v], idx) => { const bk = bible().books[bi];
    h += `${idx ? '<span class="sep" aria-hidden="true">›</span>' : ""}<button class="crumb" data-idx="${idx}"${idx === TRAIL.length - 1 ? ' aria-current="step"' : ""}>${esc(bk ? bk.n : "?")} ${ci + 1}:${v}</button>`; });
  h += `</nav>`;
  const [bi, ci, v] = TRAIL[TRAIL.length - 1], bk = bible().books[bi];
  const vs = (bk.c[ci] || []).find((x) => x.v === v);
  h += `<section class="entry"><div class="lbl">Verset courant — ${esc(bk.n)} ${ci + 1}:${v}</div>
    <p class="votd" style="font-size:1.05em">${vs ? esc(vs.t) : "(texte indisponible hors-ligne)"}</p>
    <div class="toolbar"><button id="trailRead">📖 Lire</button><button id="trailBack"${TRAIL.length < 2 ? " disabled" : ""}>‹ Reculer</button><button id="trailClear">Effacer</button></div></section>
    <div class="section-label">Continuer vers…</div><div id="trailXref"><p class="muted" role="status">Chargement des références…</p></div>`;
  body.innerHTML = h;
  body.querySelectorAll(".crumb").forEach((el) => el.onclick = () => { TRAIL = TRAIL.slice(0, +el.dataset.idx + 1); saveTrail(); studyTrail(); });
  $("#trailRead").onclick = () => goTo(bi, ci, v);
  $("#trailBack").onclick = () => { if (TRAIL.length > 1) { TRAIL.pop(); saveTrail(); studyTrail(); } };
  $("#trailClear").onclick = () => { TRAIL = []; saveTrail(); studyTrail(); };
  try { await ensureXref(); } catch (e) {}
  const box = $("#trailXref"); if (!box) return;
  const refs = (window.XREF && window.XREF[`${bi}.${ci}.${v}`]) || [];
  if (!refs.length) { box.innerHTML = `<p class="muted">Aucune référence croisée depuis ce verset. Recule ou efface le parcours.</p>`; return; }
  let r = `<div class="results">`;
  for (const [rb, rc, rv] of refs) { const tb = bible().books[rb]; if (!tb) continue;
    const tv = (tb.c[rc] || []).find((x) => x.v === rv);
    r += `<button class="result trail-step" data-bi="${rb}" data-ci="${rc}" data-v="${rv}"><span class="ref">${esc(tb.n)} ${rc + 1}:${rv}</span><span>${esc(tv ? tv.t : "")}</span></button>`; }
  r += `</div>`; box.innerHTML = r;
  box.querySelectorAll(".trail-step").forEach((el) => el.onclick = () => { TRAIL.push([+el.dataset.bi, +el.dataset.ci, +el.dataset.v]); saveTrail(); studyTrail(); });
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
  if (O) h += `<div class="section-label">Versions en ligne (API.Bible)</div>
    <p class="small muted">Active S21 / Semeur / Jérusalem (sous droits, <b>en ligne uniquement</b>, non stockées). <a href="https://scripture.api.bible" target="_blank" rel="noopener">Obtenir une clé</a>. Les versions indisponibles restent grisées.</p>
    <div class="toolbar"><label class="visually-hidden" for="apiKey">Clé API.Bible</label>
      <input id="apiKey" type="password" autocomplete="off" placeholder="Clé API.Bible (ou via proxy)" style="flex:1;min-width:160px" value="${O.getKey() ? "••••••••••" : ""}">
      <button id="apiSave">Activer</button><button id="apiClear">Retirer</button></div>
    <div class="toolbar"><label class="visually-hidden" for="apiProxy">URL du proxy</label>
      <input id="apiProxy" type="url" autocomplete="off" placeholder="Proxy (recommandé) : https://…/api/bible" style="flex:1;min-width:160px" value="${esc(O.getProxy() || "")}"></div>
    <p class="small muted">Le <b>proxy</b> (dossier <code>proxy/</code>, déployable sur Vercel) garde la clé côté serveur et règle le CORS — recommandé pour un usage public.</p>
    <div id="apiStatus" class="small muted" aria-live="polite"></div>`;
  h += `<div class="section-label">Mes données</div><div class="toolbar"><button id="exp">⬇️ Exporter (.json)</button><button id="imp">⬆️ Importer</button></div>
    <p class="small muted">${Object.keys(HL).length} surlignage(s) · ${Object.keys(NOTES).length} note(s) · ${Object.keys(TOPICS).length} verset(s) classé(s) · ${Object.keys(STUDY).length} fiche(s) d'étude, stockés dans ce navigateur.</p>`;
  reader.innerHTML = h; reader.parentElement.scrollTop = 0; reader.focus();
  reader.querySelectorAll("[data-set]").forEach((el) => el.onclick = () => {
    let val = el.dataset.val; if (el.dataset.set === "size" || el.dataset.set === "leading") val = parseFloat(val);
    SET[el.dataset.set] = val; saveSet(); applySettings(); showSettings();
  });
  if (O) {
    const status = () => { $("#apiStatus").textContent = (O.getKey() || O.getProxy())
      ? "Disponibles → " + O.targets().map((t) => `${t.abbr}: ${O.isEnabled(t.key) ? "✅" : "⛔"}`).join(" · ")
      : "Aucune clé ni proxy configuré."; };
    status();
    $("#apiSave").onclick = async () => {
      const val = $("#apiKey").value.trim();
      if (val && !/^•+$/.test(val)) O.setKey(val);
      O.setProxy($("#apiProxy").value.trim());
      $("#apiStatus").textContent = "Vérification…";
      try { await O.init(); rebuildOnlineOptions(); status(); toast("Versions en ligne mises à jour ✅"); }
      catch (e) { $("#apiStatus").textContent = "⚠️ " + e.message; }
    };
    $("#apiClear").onclick = () => { O.clearKey(); O.setProxy(""); rebuildOnlineOptions(); status(); toast("Clé et proxy retirés"); };
  }
  $("#exp").onclick = exportData; $("#imp").onclick = () => $("#importFile").click();
}
function exportData() {
  const data = { highlights: HL, notes: NOTES, topics: TOPICS, study: STUDY, plan: PLAN, settings: SET, exported: new Date().toISOString() };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "bible-mes-donnees.json"; a.click(); URL.revokeObjectURL(a.href);
}
$("#importFile").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => { try { const d = JSON.parse(rd.result);
      if (d.highlights) HL = Object.assign(HL, d.highlights);
      if (d.notes) NOTES = Object.assign(NOTES, d.notes);
      if (d.topics) TOPICS = Object.assign(TOPICS, d.topics);
      if (d.study) STUDY = Object.assign(STUDY, d.study);
      if (d.plan) PLAN = Object.assign(PLAN, d.plan);
      if (d.settings) { SET = Object.assign(SET, d.settings); applySettings(); }
      saveHL(); saveNotes(); saveTopics(); saveStudy(); savePlan(); saveSet(); toast("Import réussi ✅"); showSettings();
    } catch (err) { toast("Fichier invalide"); } };
  rd.readAsText(f); e.target.value = "";
});

/* ---------- contrôles ---------- */
selV.addEventListener("change", async () => {
  const prev = st.v;
  st.v = selV.value;
  if (st.v === st.cv) { st.cv = ORDER.find((k) => k !== st.v); selCV.value = st.cv; }
  if (!(await guard(ensureRead(), "Chargement de la traduction…"))) {
    // échec (réseau/quota sur une version en ligne) : revenir à la version précédente sans bloquer
    if (prev !== st.v) { st.v = prev; selV.value = prev; if (await guard(ensureRead())) { fillBooks(); fillChapters(); render(); } }
    return;
  }
  st.b = Math.min(st.b, bible().books.length - 1); fillBooks();
  st.c = Math.min(st.c, bible().books[st.b].c.length - 1); fillChapters(); render();
});
selCV.addEventListener("change", async () => { st.cv = selCV.value; if (st.cmp) { if (await guard(ensureVersion(st.cv))) renderCompare(); } save(); });
selB.addEventListener("change", async () => { st.b = +selB.value; st.c = 0; fillChapters(); if (await guard(ensureRead())) render(); });
selC.addEventListener("change", async () => { st.c = +selC.value; if (await guard(ensureRead())) render(); });
$("#home").addEventListener("click", () => view === "home" ? render() : showHome());
$("#compare").addEventListener("click", async (e) => {
  if (isOnline(st.v)) { toast("Comparaison indisponible pour une version en ligne."); return; }
  st.cmp = !st.cmp; e.currentTarget.setAttribute("aria-pressed", st.cmp); selCV.hidden = !st.cmp;
  if (st.cmp) { if (!(await guard(ensureVersion(st.cv)))) return; }
  render();
});
$("#favs").addEventListener("click", () => view === "favs" ? render() : showFavs());
$("#dico").addEventListener("click", () => view === "dico" ? render() : showDico());
$("#study").addEventListener("click", () => view === "study" ? render() : showStudy());
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
  if (O && (O.getKey() || O.getProxy())) { try { await O.init(); } catch (e) { /* réseau indispo : versions en ligne grisées */ } rebuildOnlineOptions(); }
  if (isOnline(st.v) && !(O && O.isEnabled(st.v))) { st.v = "ls1910"; selV.value = "ls1910"; }
  if (!(await guard(ensureRead(), "Chargement…"))) return;
  fillBooks(); fillChapters();
  if (st.cmp) { await guard(ensureVersion(st.cv)); }
  render();
})();
})();
