#!/usr/bin/env python3
"""
build_data.py — Régénère tous les fichiers data/*.js du lecteur Bible hors-ligne
à partir de sources du domaine public / librement redistribuables.

Usage :
    python3 tools/build_data.py

Aucune dépendance externe (urllib + json de la stdlib). Une connexion internet
est requise UNIQUEMENT pour ce build ; l'application elle-même reste 100 % hors-ligne.

Sources :
  - Textes bibliques .................. https://api.getbible.net/v2/<key>.json
  - Références croisées ............... https://a.openbible.info/data/cross-references.zip  (CC-BY)
  - Dictionnaires Strong (héb./grec) . github.com/openscriptures/strongs                  (CC-BY-SA)
  - KJV taguée Strong (interlinéaire) . github.com/1John419/kjs (json/strong_pure.json)
"""
import io, json, re, sys, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

TRANSLATIONS = {            # clé getbible -> nom de fichier généré
    "ls1910": "Louis Segond (1910)",
    "darby":  "Darby",
    "martin": "Martin (1744)",
    "kjv":    "King James Version",
}

# Ordre canonique OSIS des 66 livres (= ordre getbible) pour mapper les réf. croisées
OSIS = ["Gen","Exod","Lev","Num","Deut","Josh","Judg","Ruth","1Sam","2Sam","1Kgs","2Kgs",
"1Chr","2Chr","Ezra","Neh","Esth","Job","Ps","Prov","Eccl","Song","Isa","Jer","Lam","Ezek",
"Dan","Hos","Joel","Amos","Obad","Jonah","Mic","Nah","Hab","Zeph","Hag","Zech","Mal","Matt",
"Mark","Luke","John","Acts","Rom","1Cor","2Cor","Gal","Eph","Phil","Col","1Thess","2Thess",
"1Tim","2Tim","Titus","Phlm","Heb","Jas","1Pet","2Pet","1John","2John","3John","Jude","Rev"]


def fetch(url: str) -> bytes:
    print(f"  ↓ {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "bible-offline-build"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def write_js(name: str, varname: str, obj) -> None:
    payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    (DATA / name).write_text(f"window.{varname}={payload};", encoding="utf-8")
    print(f"  ✓ data/{name}  ({len(payload)/1e6:.1f} Mo)")


def build_translations() -> dict:
    """Télécharge et compacte les traductions. Retourne le JSON brut de la KJV (réutilisé)."""
    kjv_raw = None
    for key, _ in TRANSLATIONS.items():
        d = json.loads(fetch(f"https://api.getbible.net/v2/{key}.json"))
        if key == "kjv":
            kjv_raw = d
        books = [{"n": b["name"],
                  "c": [[{"v": v["verse"], "t": v["text"].strip()} for v in c["verses"]]
                        for c in b["chapters"]]}
                 for b in d["books"]]
        write_js(f"{key}.js", f"BIBLES=window.BIBLES||{{}};window.BIBLES['{key}']",
                 {"abbr": d.get("abbreviation", key), "name": d["translation"], "books": books})
    return kjv_raw


def build_crossrefs() -> None:
    zf = zipfile.ZipFile(io.BytesIO(fetch("https://a.openbible.info/data/cross-references.zip")))
    raw = zf.read(zf.namelist()[0]).decode("utf-8")
    idx = {b: i for i, b in enumerate(OSIS)}

    def parse(ref):
        ref = ref.split("-")[0]
        m = re.match(r"^([0-9A-Za-z]+)\.(\d+)\.(\d+)$", ref)
        if not m or m.group(1) not in idx:
            return None
        return [idx[m.group(1)], int(m.group(2)) - 1, int(m.group(3))]

    xref = {}
    for line in raw.splitlines()[1:]:
        p = line.split("\t")
        if len(p) < 3:
            continue
        try:
            votes = int(p[2])
        except ValueError:
            continue
        if votes <= 0:
            continue
        a, b = parse(p[0]), parse(p[1])
        if not a or not b:
            continue
        xref.setdefault(f"{a[0]}.{a[1]}.{a[2]}", []).append((votes, b))

    comp = {k: [v for _, v in sorted(lst, key=lambda x: -x[0])[:8]] for k, lst in xref.items()}
    write_js("crossref.js", "XREF", comp)


def build_strong_dict() -> None:
    strong = {}
    for url in ("https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js",
                "https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js"):
        t = fetch(url).decode("utf-8")
        obj = json.loads(t[t.find("{"):t.rfind("}") + 1])
        for k, v in obj.items():
            strong[k] = {"l": v.get("lemma", ""), "t": v.get("translit", v.get("xlit", "")),
                         "d": (v.get("strongs_def") or "").strip(), "k": (v.get("kjv_def") or "").strip()}
    write_js("strong.js", "STRONG", strong)


def build_interlinear(kjv_raw: dict) -> None:
    sp = json.loads(fetch("https://raw.githubusercontent.com/1John419/kjs/master/json/strong_pure.json"))
    mi = {m["k"]: m["v"] for m in sp["maps"]}
    order = [(bi, ci, vs["verse"])
             for bi, b in enumerate(kjv_raw["books"])
             for ci, c in enumerate(b["chapters"])
             for vs in c["verses"]]
    assert len(order) == len(mi), f"versification KJV != maps ({len(order)} vs {len(mi)})"
    kjvi = {}
    for idx, (bi, ci, v) in enumerate(order):
        segs = mi.get(idx)
        if segs is None:
            continue
        out = []
        for seg in segs:
            strongs = [s for s in (seg[1] if len(seg) > 1 else []) if s and s != "*"]
            out.append([seg[0], strongs[0]] if strongs else [seg[0]])
        kjvi[f"{bi}.{ci}.{v}"] = out
    write_js("kjvi.js", "KJVI", kjvi)


def main():
    print("1/4 Traductions…");      kjv = build_translations()
    print("2/4 Références croisées…"); build_crossrefs()
    print("3/4 Dictionnaire Strong…"); build_strong_dict()
    print("4/4 Interlinéaire KJV…");  build_interlinear(kjv)
    print("Terminé. Ouvre index.html.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"ERREUR : {e}", file=sys.stderr)
        sys.exit(1)
