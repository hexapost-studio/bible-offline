#!/usr/bin/env python3
"""
catalog.py — Liste les Bibles françaises accessibles avec ta clé API.Bible
et indique lesquelles des versions cibles (S21, Semeur, Jérusalem) sont
réellement disponibles (le reste nécessite une autorisation de l'éditeur).

Usage :
    API_BIBLE_KEY=ta_cle  python3 tools/catalog.py
    python3 tools/catalog.py ta_cle
    python3 tools/catalog.py ta_cle --lang fra   # défaut : fra

S'inscrire (offre Starter, non commerciale) : https://scripture.api.bible
"""
import json, os, sys, urllib.request, urllib.error

BASE = "https://api.scripture.api.bible/v1"

# Mêmes cibles que data-online.js (mots-clés de correspondance, en minuscules)
TARGETS = {
    "Segond 21 (S21)":          ["s21", "segond 21", "segond21"],
    "Bible du Semeur (BDS)":    ["semeur", "bds"],
    "Bible de Jérusalem (BJ)":  ["jérusalem", "jerusalem", "bdj", "bjc"],
}


def get(path, key):
    req = urllib.request.Request(BASE + path, headers={"api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Erreur HTTP {e.code} : {e.read().decode('utf-8', 'ignore')[:200]}")
    except urllib.error.URLError as e:
        sys.exit(f"Erreur réseau : {e}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    lang = "fra"
    if "--lang" in sys.argv:
        lang = sys.argv[sys.argv.index("--lang") + 1]
    key = (args[0] if args else "") or os.environ.get("API_BIBLE_KEY", "")
    if not key:
        sys.exit("Clé manquante. Donne-la en argument ou via API_BIBLE_KEY. (https://scripture.api.bible)")

    data = get(f"/bibles?language={lang}", key).get("data", [])
    print(f"\n{len(data)} Bible(s) « {lang} » accessibles avec cette clé :\n")
    print(f"{'ABRÉV.':<10} {'NOM':<42} ID")
    print("-" * 90)
    for b in sorted(data, key=lambda x: (x.get("abbreviationLocal") or x.get("abbreviation") or "")):
        ab = (b.get("abbreviationLocal") or b.get("abbreviation") or "")[:9]
        nm = (b.get("nameLocal") or b.get("name") or "")[:41]
        print(f"{ab:<10} {nm:<42} {b.get('id')}")

    print("\nVersions cibles :")
    def hay(b):
        return " ".join(filter(None, [b.get("abbreviation"), b.get("abbreviationLocal"),
                                       b.get("name"), b.get("nameLocal")])).lower()
    for label, kws in TARGETS.items():
        hit = next((b for b in data if any(k in hay(b) for k in kws)), None)
        if hit:
            print(f"  ✅ {label:<28} → id={hit.get('id')}")
        else:
            print(f"  ⛔ {label:<28} → non disponible (autorisation éditeur à demander)")
    print()


if __name__ == "__main__":
    main()
