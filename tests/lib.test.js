"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const L = require("../lib.js");

test("esc échappe les caractères HTML dangereux", () => {
  assert.strictEqual(L.esc('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
});

test("testament classe AT (0..38) et NT (39..65)", () => {
  assert.strictEqual(L.testament(0), "AT");   // Genèse
  assert.strictEqual(L.testament(38), "AT");  // Malachie
  assert.strictEqual(L.testament(39), "NT");  // Matthieu
  assert.strictEqual(L.testament(65), "NT");  // Apocalypse
});

test("strongLang : H = hébreu RTL, G = grec LTR", () => {
  assert.deepStrictEqual(L.strongLang("H157"), { lang: "he", dir: "rtl" });
  assert.deepStrictEqual(L.strongLang("G26"), { lang: "grc", dir: "ltr" });
});

test("formatRef formate une référence lisible", () => {
  assert.strictEqual(L.formatRef("Jean", 2, 16), "Jean 3:16");
});

test("buildPlan couvre tous les chapitres en exactement N jours", () => {
  const counts = [50, 40, 27];            // 117 chapitres
  const plan = L.buildPlan(counts, 365);
  assert.strictEqual(plan.length, 365);
  const flat = plan.flat();
  assert.strictEqual(flat.length, 117);   // aucun chapitre perdu ni dupliqué
  assert.deepStrictEqual(flat[0], [0, 0]);
  assert.deepStrictEqual(flat[flat.length - 1], [2, 26]);
});

test("dayOfYear est déterministe", () => {
  assert.strictEqual(L.dayOfYear(new Date(Date.UTC(2026, 0, 1))), 1);
  assert.strictEqual(L.dayOfYear(new Date(Date.UTC(2026, 11, 31))), 365);
});

test("verseOfDay reste dans la liste et est stable par date", () => {
  const d = new Date(Date.UTC(2026, 5, 26));
  const a = L.verseOfDay(d, L.VOTD);
  assert.ok(L.VOTD.includes(a));
  assert.deepStrictEqual(L.verseOfDay(d, L.VOTD), a);
});

test("ttsLang : KJV en anglais, sinon français", () => {
  assert.strictEqual(L.ttsLang("kjv"), "en-US");
  assert.strictEqual(L.ttsLang("ls1910"), "fr-FR");
});

test("concordance : trouve les versets d'un numéro Strong, compte et trie", () => {
  const KJVI = {
    "43.2.15": [["God", "G2316"], ["so", null], ["loved", "G25"]],
    "0.0.0":   [["In", null], ["God", "G2316"]],
    "44.4.31": [["love", "G25"], ["love", "G25"]],
  };
  const c = L.concordance(KJVI, "G25");
  assert.deepStrictEqual(c, [["43.2.15", 1], ["44.4.31", 2]]); // trié canonique, comptage correct
  assert.deepStrictEqual(L.concordance(KJVI, "G2316"), [["0.0.0", 1], ["43.2.15", 1]]);
  assert.deepStrictEqual(L.concordance(KJVI, "G404"), []);     // absent
  assert.deepStrictEqual(L.concordance(null, "G25"), []);      // robustesse
});

test("topicGroups : regroupe les versets par thème, triés", () => {
  // clés au format des notes/surlignages : "bi:ci:v" (deux-points)
  const TOPICS = { "43:2:15": ["amour", "foi"], "44:4:31": ["amour"], "0:0:0": ["foi"] };
  const g = L.topicGroups(TOPICS);
  assert.deepStrictEqual(g.amour, ["43:2:15", "44:4:31"]);
  assert.deepStrictEqual(g.foi, ["0:0:0", "43:2:15"]);
  assert.deepStrictEqual(L.topicGroups(null), {});
});

test("parseTags : minuscule, trim, déduplique, ignore le vide", () => {
  assert.deepStrictEqual(L.parseTags("Foi, Grâce ,foi,"), ["foi", "grâce"]);
  assert.deepStrictEqual(L.parseTags("  "), []);
  assert.deepStrictEqual(L.parseTags(null), []);
});
