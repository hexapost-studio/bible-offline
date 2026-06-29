"use strict";
// Smoke test : tout fichier data/*.js chargé à la demande par l'app doit exister,
// se parser sans erreur et assigner son global attendu. Attrape un fichier manquant
// ou renommé AVANT déploiement (sans navigateur).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const DATA = path.join(__dirname, "..", "data");
const has = (f) => fs.existsSync(path.join(DATA, f));

// [fichier, global attendu, requis ?]
const FILES = [
  ["ls1910.js", "BIBLES", true],
  ["darby.js", "BIBLES", true],
  ["martin.js", "BIBLES", true],
  ["kjv.js", "BIBLES", true],
  ["kjvi.js", "KJVI", true],
  ["strong.js", "STRONG", true],
  ["crossref.js", "XREF", true],
  ["nave.js", "NAVE", false],        // généré par build_data.py
  ["intros.js", "INTROS", false],    // généré par build_data.py
  ["strong_fr.js", "STRONG_FR", false], // généré par translate_strong.py
];

test("smoke : les fichiers data requis existent, parsent et exposent leur global", () => {
  global.window = global.window || {};
  for (const [file, glob, required] of FILES) {
    if (!has(file)) {
      assert.ok(!required, `data/${file} manquant (requis)`);
      continue;
    }
    assert.doesNotThrow(() => require(path.join(DATA, file)), `data/${file} ne parse pas`);
    assert.ok(window[glob], `data/${file} n'expose pas window.${glob}`);
  }
});

test("smoke : les modules front se chargent (lib.js)", () => {
  const L = require("../lib.js");
  for (const fn of ["esc", "fold", "concordance", "topicGroups", "hasSheetContent"])
    assert.strictEqual(typeof L[fn], "function", `lib.${fn} absent`);
});
