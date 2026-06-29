#!/usr/bin/env python3
"""
translate_strong.py — Génère data/strong_fr.js : traduction FRANÇAISE des définitions
Strong (champ « d ») à partir de data/strong.js (définitions anglaises, domaine public,
source openscriptures). Le résultat est notre propre dérivé, librement redistribuable,
clairement étiqueté « traduction automatique ».

Pourquoi : les concordances Strong françaises courantes (Pétrakian, Helleme) sont SOUS
COPYRIGHT et ne sont pas redistribuables. On reste 100 % domaine public en traduisant
nous-mêmes la source anglaise libre.

Usage :
    python3 tools/translate_strong.py            # traduit tout (reprend là où on s'est arrêté)
    python3 tools/translate_strong.py --limit 50 # test rapide sur 50 entrées

Caractéristiques :
  - RÉSUMABLE : cache disque tools/.strong_fr_cache.json (les relances ne re-traduisent pas).
  - Service MT gratuit : endpoint Google non officiel, repli MyMemory. Aucune clé requise.
  - NON BLOQUANT : en cas d'échec réseau total, on n'écrit pas strong_fr.js (l'app garde l'EN).
  - Aucune dépendance externe (stdlib uniquement).
"""
import json, sys, threading, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

WORKERS = 8  # requêtes en parallèle (la latence réseau domine ; le cache reste résumable)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE_FILE = Path(__file__).resolve().parent / ".strong_fr_cache.json"


def load_strong() -> dict:
    src = (DATA / "strong.js").read_text(encoding="utf-8")
    payload = src[src.find("{"): src.rfind("}") + 1]
    return json.loads(payload)


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def _get(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "bible-offline-build"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def translate_google(text: str) -> str | None:
    """Endpoint Google non officiel (translate_a/single) — renvoie la concat des segments."""
    q = urllib.parse.quote(text)
    url = ("https://translate.googleapis.com/translate_a/single"
           f"?client=gtx&sl=en&tl=fr&dt=t&q={q}")
    try:
        data = json.loads(_get(url).decode("utf-8"))
        return "".join(seg[0] for seg in data[0] if seg and seg[0]).strip() or None
    except Exception:
        return None


def translate_mymemory(text: str) -> str | None:
    q = urllib.parse.quote(text)
    url = f"https://api.mymemory.translated.net/get?q={q}&langpair=en|fr"
    try:
        data = json.loads(_get(url).decode("utf-8"))
        t = (data.get("responseData") or {}).get("translatedText")
        return t.strip() if t else None
    except Exception:
        return None


def translate(text: str) -> str | None:
    return translate_google(text) or translate_mymemory(text)


def main() -> int:
    limit = None
    if "--limit" in sys.argv:
        try:
            limit = int(sys.argv[sys.argv.index("--limit") + 1])
        except (ValueError, IndexError):
            limit = None

    strong = load_strong()
    cache = load_cache()
    items = [(num, e.get("d", "").strip()) for num, e in strong.items() if e.get("d", "").strip()]
    if limit:
        items = items[:limit]
    total = len(items)
    print(f"À traduire : {total} définitions (cache : {len(cache)} déjà connues)")

    todo = [(num, d) for num, d in items if num not in cache]
    done, failed = total - len(todo), 0
    lock = threading.Lock()
    processed = 0

    def work(item):
        num, d = item
        return num, translate(d)

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = [ex.submit(work, it) for it in todo]
        for fut in as_completed(futures):
            num, fr = fut.result()
            with lock:
                if fr:
                    cache[num] = fr; done += 1
                else:
                    failed += 1
                processed += 1
                if processed % 200 == 0:
                    save_cache(cache)
                    print(f"  … {done}/{total} (échecs {failed})")

    save_cache(cache)

    # N'écrit strong_fr.js que si on a une couverture utile (évite un fichier vide/inutile)
    out = {num: cache[num] for num, _ in items if num in cache}
    if not out:
        print("Aucune traduction obtenue (réseau ?). strong_fr.js NON généré — l'app gardera l'anglais.",
              file=sys.stderr)
        return 1
    payload = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    (DATA / "strong_fr.js").write_text(f"window.STRONG_FR={payload};", encoding="utf-8")
    print(f"✓ data/strong_fr.js  ({len(payload)/1e6:.1f} Mo, {len(out)}/{total} définitions, échecs {failed})")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrompu — le cache est conservé, relance pour reprendre.", file=sys.stderr)
        sys.exit(130)
