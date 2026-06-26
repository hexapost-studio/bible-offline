/* data-online.js — fournisseur de Bibles SOUS DROITS via API.Bible (scripture.api.bible).
   Mode EN LIGNE uniquement : le texte est récupéré à la demande et mis en cache
   en mémoire pour la session (jamais stocké durablement) — conforme à la licence.

   Sécurité / CORS :
   - La clé API est saisie par l'utilisateur et conservée en localStorage uniquement
     (jamais dans le dépôt). Elle n'est PAS distribuée avec l'app.
   - API.Bible n'autorise pas toujours les appels navigateur (CORS) et exposer une clé
     côté client est déconseillé en production. Pour un usage public, renseigne un
     PROXY (petit relais serverless qui ajoute l'en-tête api-key) via setProxy().
   Exposé sur window.OnlineBibles. */
(function (root) {
  "use strict";

  const BASE = "https://api.scripture.api.bible/v1";

  // Versions cibles (désactivées tant qu'elles ne sont pas trouvées dans le catalogue de la clé)
  const TARGETS = [
    { key: "s21",       name: "Segond 21",         abbr: "S21", match: ["s21", "segond 21", "segond21"] },
    { key: "semeur",    name: "Bible du Semeur",   abbr: "BDS", match: ["semeur", "bds"] },
    { key: "jerusalem", name: "Bible de Jérusalem", abbr: "BJ", match: ["jérusalem", "jerusalem", "bdj", "bjc"] },
  ];

  // Codes de livres USFM/Paratext (alignés sur l'index 0..65 du canon protestant)
  const BOOKCODES = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI",
    "1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN",
    "HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK",
    "JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM",
    "HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD","REV"];

  let KEY = localStorage.getItem("bible_apikey") || "";
  let PROXY = localStorage.getItem("bible_apiproxy") || "";
  let AVAIL = {}; // key -> { id, name, copyright }

  const setKey = (k) => { KEY = (k || "").trim(); localStorage.setItem("bible_apikey", KEY); };
  const getKey = () => KEY;
  const clearKey = () => { KEY = ""; AVAIL = {}; localStorage.removeItem("bible_apikey"); };
  const setProxy = (p) => { PROXY = (p || "").trim(); localStorage.setItem("bible_apiproxy", PROXY); };
  const targets = () => TARGETS.map((t) => ({ key: t.key, name: t.name, abbr: t.abbr }));
  const isEnabled = (key) => !!AVAIL[key];

  async function api(path) {
    if (!KEY && !PROXY) throw new Error("Aucune clé API.Bible configurée.");
    const url = (PROXY || BASE) + path;
    const res = await fetch(url, { headers: KEY ? { "api-key": KEY } : {} });
    if (res.status === 401 || res.status === 403) throw new Error("Clé refusée ou version non autorisée (autorisation éditeur requise).");
    if (!res.ok) throw new Error("Erreur réseau API.Bible (" + res.status + ").");
    return res.json();
  }

  function matches(target, b) {
    const hay = [b.abbreviation, b.abbreviationLocal, b.name, b.nameLocal].filter(Boolean).join(" ").toLowerCase();
    return target.match.some((m) => hay.includes(m));
  }

  // Découvre quelles versions cibles sont accessibles avec la clé courante.
  async function init() {
    AVAIL = {};
    if (!KEY && !PROXY) return AVAIL;
    const list = await api("/bibles?language=fra");
    for (const t of TARGETS) {
      const found = (list.data || []).find((b) => matches(t, b));
      if (found) AVAIL[t.key] = { id: found.id, name: found.name || t.name, copyright: found.copyright || "" };
    }
    return AVAIL;
  }

  // Construit le squelette de navigation (noms + nb de chapitres) à partir de la Segond 1910 déjà chargée.
  function buildSkeleton(key) {
    if (window.BIBLES[key]) return;
    const base = window.BIBLES && window.BIBLES.ls1910;
    if (!base) throw new Error("Squelette indisponible (Segond 1910 non chargée).");
    window.BIBLES[key] = {
      online: true,
      name: AVAIL[key].name,
      copyright: AVAIL[key].copyright,
      books: base.books.map((bk) => ({ n: bk.n, c: bk.c.map(() => []) })),
    };
  }

  // Extrait les versets du HTML USX renvoyé par API.Bible.
  function parseVerses(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll('.note, [class*="note"], .r, .rq').forEach((n) => n.remove());
    const verses = [];
    let cur = null;
    (function walk(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) { if (cur) cur.t += child.nodeValue; }
        else if (child.nodeType === 1) {
          if (child.classList.contains("v") && child.hasAttribute("data-number")) {
            cur = { v: parseInt(child.getAttribute("data-number"), 10), t: "" };
            verses.push(cur);
          } else { walk(child); }
        }
      }
    })(doc.body);
    verses.forEach((v) => { v.t = v.t.replace(/\s+/g, " ").trim(); });
    return verses.filter((v) => v.t);
  }

  // Garantit que le chapitre (bi, ci) de la version `key` est en cache.
  async function ensureChapter(key, bi, ci) {
    if (!AVAIL[key]) throw new Error("Version « " + key + " » non disponible avec cette clé.");
    buildSkeleton(key);
    const b = window.BIBLES[key];
    if (b.books[bi].c[ci] && b.books[bi].c[ci].length) return; // déjà chargé
    const chapterId = BOOKCODES[bi] + "." + (ci + 1);
    const params = "?content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false";
    const res = await api(`/bibles/${AVAIL[key].id}/chapters/${chapterId}${params}`);
    b.books[bi].c[ci] = parseVerses(res.data.content || "");
    if (res.data.copyright && !b.copyright) b.copyright = res.data.copyright;
  }

  root.OnlineBibles = { targets, setKey, getKey, clearKey, setProxy, init, isEnabled, ensureChapter, available: () => AVAIL };
})(typeof window !== "undefined" ? window : globalThis);
