/* lib.js — logique pure, sans DOM (utilisable par app.js et par les tests Node).
   Exposée sur window.Lib (navigateur) et module.exports (Node). */
(function (root) {
  "use strict";

  // 66 livres : Ancien Testament = index 0..38, Nouveau Testament = 39..65
  const OT_COUNT = 39;
  const NT_COUNT = 27;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  }

  function testament(bookIndex) {
    return bookIndex < OT_COUNT ? "AT" : "NT";
  }

  function strongLang(num) {
    // H = hébreu (RTL), G = grec
    return num && num[0] === "H" ? { lang: "he", dir: "rtl" } : { lang: "grc", dir: "ltr" };
  }

  function formatRef(bookName, chapterIndex, verse) {
    return `${bookName} ${chapterIndex + 1}:${verse}`;
  }

  // Plan de lecture : répartit toutes les (bi,ci) chapitres en `days` tranches ~égales.
  // chapterCounts = [nbChap_livre0, nbChap_livre1, ...]
  function buildPlan(chapterCounts, days) {
    days = days || 365;
    const chapters = [];
    chapterCounts.forEach((n, bi) => {
      for (let ci = 0; ci < n; ci++) chapters.push([bi, ci]);
    });
    const total = chapters.length;
    const plan = [];
    let cursor = 0;
    for (let d = 0; d < days; d++) {
      const end = Math.round(((d + 1) * total) / days);
      plan.push(chapters.slice(cursor, end));
      cursor = end;
    }
    return plan;
  }

  // Jour de l'année 0..365 (déterministe à partir d'une Date)
  function dayOfYear(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.floor((now - start) / 86400000);
  }

  // Verset du jour : choisit une référence dans la liste, déterministe par date.
  function verseOfDay(date, refs) {
    if (!refs || !refs.length) return null;
    return refs[dayOfYear(date) % refs.length];
  }

  // Versets célèbres [bookIndex, chapterIndex, verse] — canon protestant, vérifiés (tests/data.test.js).
  const VOTD = [
    [42, 2, 16], [18, 22, 1], [19, 2, 5], [49, 3, 13], [44, 7, 28], [22, 39, 31],
    [23, 28, 11], [5, 0, 9], [45, 12, 4], [39, 5, 33], [18, 118, 105], [19, 15, 3],
    [49, 3, 6], [57, 10, 1], [54, 0, 7], [42, 13, 6], [42, 0, 1], [0, 0, 1],
    [24, 2, 22], [18, 26, 1], [18, 45, 1], [18, 90, 1], [22, 40, 10], [39, 10, 28],
    [39, 27, 19], [44, 11, 2], [44, 5, 23], [47, 4, 22], [48, 1, 8], [49, 3, 7],
    [50, 2, 23], [58, 0, 5], [59, 4, 7], [61, 3, 18], [61, 0, 9], [42, 15, 33],
    [4, 30, 6], [15, 7, 10], [18, 36, 4], [46, 4, 17], [65, 2, 20], [32, 5, 8],
    [35, 2, 17], [47, 1, 20],
  ];

  // Détection simple de langue de voix TTS selon la traduction
  function ttsLang(translationKey) {
    return translationKey === "kjv" ? "en-US" : "fr-FR";
  }

  /* ---------- étude approfondie (logique pure, testée) ---------- */

  // Concordance d'un numéro Strong : parcourt l'interlinéaire KJVI (clés "bi.ci.v",
  // valeurs = [[texte, "G##"?], ...]) et renvoie [["bi.ci.v", nbOccurrences], ...]
  // trié dans l'ordre canonique (livre, chapitre, verset).
  function concordance(KJVI, num) {
    const out = [];
    if (!KJVI || !num) return out;
    for (const key in KJVI) {
      const segs = KJVI[key];
      if (!segs) continue;
      let count = 0;
      for (let i = 0; i < segs.length; i++) if (segs[i][1] === num) count++;
      if (count) out.push([key, count]);
    }
    out.sort((a, b) => {
      const A = a[0].split("."), B = b[0].split(".");
      return (A[0] - B[0]) || (A[1] - B[1]) || (A[2] - B[2]);
    });
    return out;
  }

  // Regroupe les versets par thème : { "bi:ci:v": ["foi", "grâce"] } -> { "foi": ["bi:ci:v", ...] }.
  // Les listes de versets sont triées dans l'ordre canonique.
  function topicGroups(TOPICS) {
    const g = {};
    if (!TOPICS) return g;
    for (const key in TOPICS) {
      const tags = TOPICS[key] || [];
      for (let i = 0; i < tags.length; i++) {
        const t = tags[i];
        (g[t] = g[t] || []).push(key);
      }
    }
    for (const t in g) g[t].sort((a, b) => {
      const A = a.split(":"), B = b.split(":");
      return (A[0] - B[0]) || (A[1] - B[1]) || (A[2] - B[2]);
    });
    return g;
  }

  // Normalise une saisie de thèmes libres ("Foi, Grâce ,foi") -> ["foi", "grâce"] (minuscules, dédupliqués, non vides).
  function parseTags(input) {
    const seen = {};
    const out = [];
    String(input || "").split(",").forEach((raw) => {
      const t = raw.trim().toLowerCase();
      if (t && !seen[t]) { seen[t] = 1; out.push(t); }
    });
    return out;
  }

  const api = { esc, testament, strongLang, formatRef, buildPlan, dayOfYear, verseOfDay, VOTD, ttsLang,
    concordance, topicGroups, parseTags, OT_COUNT, NT_COUNT };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Lib = api;
})(typeof window !== "undefined" ? window : globalThis);
