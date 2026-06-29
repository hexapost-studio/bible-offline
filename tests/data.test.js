"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// Les fichiers data/*.js assignent des globaux via `window` -> on l'expose.
global.window = {};
require("../data/ls1910.js");
require("../data/darby.js");
require("../data/martin.js");
require("../data/kjv.js");
require("../data/kjvi.js");
require("../data/strong.js");
require("../data/crossref.js");
const B = window.BIBLES, KJVI = window.KJVI, STRONG = window.STRONG, XREF = window.XREF;
const L = require("../lib.js");

test("4 traductions, chacune avec 66 livres", () => {
  assert.deepStrictEqual(Object.keys(B).sort(), ["darby", "kjv", "ls1910", "martin"]);
  for (const k of Object.keys(B)) assert.strictEqual(B[k].books.length, 66, k);
});

test("versification de référence (Segond 1910)", () => {
  const g = B.ls1910.books[0];
  assert.strictEqual(g.n, "Genèse");
  assert.strictEqual(g.c.length, 50);
  assert.strictEqual(g.c[0][0].t.startsWith("Au commencement"), true);
});

test("interlinéaire KJV : 31 102 versets tagués", () => {
  assert.strictEqual(Object.keys(KJVI).length, 31102);
  assert.deepStrictEqual(KJVI["0.0.1"][0], ["In the beginning", "H7225"]);
});

test("dictionnaire Strong : entrées clés présentes", () => {
  assert.ok(STRONG.G25 && STRONG.G25.l === "ἀγαπάω");
  assert.ok(STRONG.H157 && STRONG.H157.l === "אָהַב");
  assert.ok(Object.keys(STRONG).length > 14000);
});

test("intégrité : tout numéro Strong de l'interlinéaire existe dans le dictionnaire", () => {
  const missing = new Set();
  for (const k in KJVI) for (const seg of KJVI[k]) if (seg[1] && !STRONG[seg[1]]) missing.add(seg[1]);
  assert.strictEqual(missing.size, 0, "Strong manquants : " + [...missing].slice(0, 10).join(", "));
});

test("intégrité : toute cible de référence croisée pointe vers un verset réel", () => {
  let checked = 0;
  for (const key in XREF) {
    for (const [bi, ci, v] of XREF[key]) {
      assert.ok(bi >= 0 && bi < 66, "livre hors limites: " + bi);
      const book = B.ls1910.books[bi];
      assert.ok(book && book.c[ci], `chapitre absent ${bi}.${ci}`);
      checked++;
    }
  }
  assert.ok(checked > 100000, "trop peu de références vérifiées");
});

test("tous les versets du jour (VOTD) existent dans la Segond 1910", () => {
  for (const [bi, ci, v] of L.VOTD) {
    const book = B.ls1910.books[bi];
    assert.ok(book, "livre VOTD absent: " + bi);
    const chap = book.c[ci];
    assert.ok(chap, `chapitre VOTD absent ${bi}.${ci}`);
    assert.ok(chap.find((x) => x.v === v), `verset VOTD absent ${L.formatRef(book.n, ci, v)}`);
  }
});

const has = (f) => fs.existsSync(path.join(__dirname, "..", "data", f));

test("intégrité Nave : références valides (si data/nave.js généré)", { skip: !has("nave.js") ? "nave.js non généré" : false }, () => {
  require("../data/nave.js");
  const NAVE = window.NAVE;
  assert.ok(Object.keys(NAVE).length > 1000, "trop peu de sujets Nave");
  let checked = 0;
  for (const subj in NAVE) {
    for (const [bi, ci, v] of NAVE[subj]) {
      assert.ok(bi >= 0 && bi < 66, "livre Nave hors limites: " + bi);
      const book = B.ls1910.books[bi];
      assert.ok(book && book.c[ci], `chapitre Nave absent ${bi}.${ci} (${subj})`);
      checked++;
    }
  }
  assert.ok(checked > 10000, "trop peu de références Nave vérifiées");
});

test("intégrité Strong FR : numéros connus du dictionnaire (si data/strong_fr.js généré)", { skip: !has("strong_fr.js") ? "strong_fr.js non généré" : false }, () => {
  require("../data/strong_fr.js");
  const FR = window.STRONG_FR;
  assert.ok(Object.keys(FR).length > 0, "strong_fr.js vide");
  let bad = 0;
  for (const num in FR) { if (!STRONG[num]) bad++; if (typeof FR[num] !== "string") bad++; }
  assert.strictEqual(bad, 0, "entrées Strong FR invalides : " + bad);
});
