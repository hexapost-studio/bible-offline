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
  const FUMS_FALLBACK = "https://api.scripture.api.bible/scripts/bapi.min.js";
  const TIMEOUT = 15000; // ms avant abandon d'une requête
  const RETRIES = 2;     // tentatives supplémentaires sur erreur réseau / 429 / 5xx

  // Versions cibles (désactivées tant qu'elles ne sont pas trouvées dans le catalogue de la clé).
  // publisher / publisherUrl : exigés par la licence — lien direct vers l'éditeur affiché à chaque lecture.
  const TARGETS = [
    { key: "s21",       name: "Segond 21",          abbr: "S21", match: ["s21", "segond 21", "segond21"],
      publisher: "Société Biblique de Genève", publisherUrl: "https://www.societebibliquedegeneve.ch" },
    { key: "semeur",    name: "Bible du Semeur",    abbr: "BDS", match: ["semeur", "bds"],
      publisher: "Biblica", publisherUrl: "https://www.biblica.com" },
    { key: "jerusalem", name: "Bible de Jérusalem", abbr: "BJ",  match: ["jérusalem", "jerusalem", "bdj", "bjc"],
      publisher: "Éditions du Cerf", publisherUrl: "https://www.editionsducerf.fr" },
  ];

  // Codes de livres USFM/Paratext (alignés sur l'index 0..65 du canon protestant)
  const BOOKCODES = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI",
    "1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN",
    "HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK",
    "JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM",
    "HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD","REV"];

  // Proxy par défaut : si l'app est servie depuis un déploiement avec fonction serverless
  // sur la MÊME origine (Vercel), on utilise automatiquement /api/bible. Sur GitHub Pages
  // (pas de serverless) ou en local, on laisse vide (l'utilisateur peut renseigner un proxy).
  function defaultProxy() {
    if (typeof location === "undefined" || !location.protocol.startsWith("http")) return "";
    const h = location.hostname || "";
    if (h.endsWith("github.io") || h === "localhost" || h === "127.0.0.1") return "";
    return location.origin + "/api/bible";
  }

  let KEY = localStorage.getItem("bible_apikey") || "";
  const storedProxy = localStorage.getItem("bible_apiproxy");
  let PROXY = storedProxy != null ? storedProxy : defaultProxy();
  let AVAIL = {}; // key -> { id, name, copyright }

  const setKey = (k) => { KEY = (k || "").trim(); localStorage.setItem("bible_apikey", KEY); };
  const getKey = () => KEY;
  const clearKey = () => { KEY = ""; AVAIL = {}; localStorage.removeItem("bible_apikey"); };
  const setProxy = (p) => { PROXY = (p || "").trim().replace(/\/$/, ""); localStorage.setItem("bible_apiproxy", PROXY); };
  const getProxy = () => PROXY;
  const targets = () => TARGETS.map((t) => ({ key: t.key, name: t.name, abbr: t.abbr }));
  const isEnabled = (key) => !!AVAIL[key];

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  // Backoff exponentiel + jitter (respecte Retry-After si fourni par le serveur).
  function backoff(attempt, res) {
    let ra = 0;
    try { const h = res && res.headers && parseInt(res.headers.get("retry-after"), 10); if (h > 0) ra = h * 1000; } catch (e) {}
    return Math.max(ra, Math.pow(2, attempt) * 600 + Math.random() * 300);
  }

  function fetchWithTimeout(url) {
    const opts = { headers: KEY ? { "api-key": KEY } : {} };
    let timer = null;
    if (typeof AbortController !== "undefined") {
      const ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    }
    return fetch(url, opts).finally(() => { if (timer) clearTimeout(timer); });
  }

  // Requête résiliente : timeout, nouvelles tentatives sur réseau/429/5xx, messages clairs.
  // Ne réessaie jamais sur 401/403/404 (inutile) ; n'avale jamais l'erreur finale.
  async function api(path) {
    if (!KEY && !PROXY) throw new Error("Aucune clé API.Bible configurée.");
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      throw new Error("Hors connexion : les versions en ligne nécessitent Internet.");
    const url = (PROXY || BASE) + path;
    let lastErr;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      let res;
      try {
        res = await fetchWithTimeout(url);
      } catch (e) {
        lastErr = (e && e.name === "AbortError")
          ? new Error("Délai dépassé en contactant API.Bible. Vérifie ta connexion.")
          : new Error("Connexion à API.Bible impossible (réseau ou CORS). Un proxy est recommandé.");
        if (attempt < RETRIES) { await delay(backoff(attempt)); continue; }
        throw lastErr;
      }
      if (res.status === 401 || res.status === 403)
        throw new Error("Clé refusée ou version non autorisée (autorisation éditeur requise).");
      if (res.status === 404)
        throw new Error("Passage introuvable dans cette version (livre/chapitre non disponible).");
      if (res.status === 429) {
        lastErr = new Error("Quota API.Bible atteint. Réessaie un peu plus tard.");
        if (attempt < RETRIES) { await delay(backoff(attempt, res)); continue; }
        throw lastErr;
      }
      if (res.status >= 500) {
        lastErr = new Error("Service API.Bible momentanément indisponible (" + res.status + ").");
        if (attempt < RETRIES) { await delay(backoff(attempt, res)); continue; }
        throw lastErr;
      }
      if (!res.ok) throw new Error("Erreur API.Bible (" + res.status + ").");
      try { return await res.json(); }
      catch (e) { throw new Error("Réponse API.Bible illisible."); }
    }
    throw lastErr || new Error("Erreur inconnue API.Bible.");
  }

  /* ---------- FUMS (Fair Use Management System) — OBLIGATOIRE pour toute webapp.
     Chaque réponse de chapitre renvoie meta.fumsId ; on charge le script de suivi
     d'API.Bible (une seule fois, paresseusement) puis on signale chaque consultation.
     Le suivi ne doit JAMAIS bloquer ni casser la lecture → tout est en try/catch. */
  let FUMS_READY = null;
  function loadFumsScript(src) {
    if (FUMS_READY) return FUMS_READY;
    FUMS_READY = new Promise((resolve) => {
      try {
        if (typeof document === "undefined") return resolve(false);
        const s = document.createElement("script");
        s.src = src; s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      } catch (e) { resolve(false); }
    });
    return FUMS_READY;
  }
  async function reportFums(meta) {
    try {
      if (!meta) return;
      const id = meta.fumsId || meta.fums;
      if (!id) return;
      let src = FUMS_FALLBACK;
      if (meta.fumsJsInclude) {
        const m = String(meta.fumsJsInclude).match(/src=["']([^"']+)["']/);
        if (m) src = m[1];
      }
      await loadFumsScript(src);
      if (typeof window !== "undefined" && window._BAPI && typeof window._BAPI.t === "function")
        window._BAPI.t(id);
    } catch (e) { /* le suivi FUMS ne doit jamais bloquer la lecture */ }
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
      if (found) AVAIL[t.key] = {
        id: found.id, name: found.name || t.name, copyright: found.copyright || "",
        publisher: t.publisher, publisherUrl: t.publisherUrl,
      };
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
      publisher: AVAIL[key].publisher,
      publisherUrl: AVAIL[key].publisherUrl,
      books: base.books.map((bk) => ({ n: bk.n, c: bk.c.map(() => []) })),
    };
  }

  // Extrait les versets du HTML USX renvoyé par API.Bible.
  // Les notes de bas de page / références (classes "note", "r", "rq") sont CONSERVÉES
  // (exigence éditeur : toutes les notes doivent rester accessibles à l'utilisateur).
  // Elles sont sorties du flux du verset et stockées dans v.notes[] pour un rendu dédié.
  const isNoteEl = (el) => el.classList && (el.classList.contains("note") ||
    el.classList.contains("r") || el.classList.contains("rq") || /(^|\s)note(\s|$)/.test(el.className || ""));
  function parseVerses(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const verses = [];
    let cur = null;
    (function walk(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) { if (cur) cur.t += child.nodeValue; }
        else if (child.nodeType === 1) {
          if (child.classList.contains("v") && child.hasAttribute("data-number")) {
            cur = { v: parseInt(child.getAttribute("data-number"), 10), t: "", notes: [] };
            verses.push(cur);
          } else if (isNoteEl(child)) {
            // joint les sous-parties (réf. + texte de la note) par une espace pour rester lisible
            const raw = child.children && child.children.length
              ? Array.from(child.childNodes).map((n) => n.textContent || "").join(" ")
              : (child.textContent || "");
            const txt = raw.replace(/\s+/g, " ").trim();
            if (cur && txt) cur.notes.push(txt);
          } else { walk(child); }
        }
      }
    })(doc.body);
    verses.forEach((v) => { v.t = v.t.replace(/\s+/g, " ").trim(); if (!v.notes.length) delete v.notes; });
    return verses.filter((v) => v.t || (v.notes && v.notes.length));
  }

  // Garantit que le chapitre (bi, ci) de la version `key` est en cache.
  async function ensureChapter(key, bi, ci) {
    if (!AVAIL[key]) throw new Error("Version « " + key + " » non disponible avec cette clé.");
    buildSkeleton(key);
    const b = window.BIBLES[key];
    if (b.books[bi].c[ci] && b.books[bi].c[ci].length) return; // déjà chargé
    const chapterId = BOOKCODES[bi] + "." + (ci + 1);
    const params = "?content-type=html&include-notes=true&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false";
    const res = await api(`/bibles/${AVAIL[key].id}/chapters/${chapterId}${params}`);
    b.books[bi].c[ci] = parseVerses((res.data && res.data.content) || "");
    if (res.data && res.data.copyright && !b.copyright) b.copyright = res.data.copyright;
    reportFums(res.meta); // suivi FUMS obligatoire (non bloquant)
  }

  root.OnlineBibles = { targets, setKey, getKey, clearKey, setProxy, getProxy, init, isEnabled, ensureChapter, available: () => AVAIL };
})(typeof window !== "undefined" ? window : globalThis);
