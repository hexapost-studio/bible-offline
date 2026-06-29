#!/usr/bin/env python3
"""
serve.py — Petit serveur de développement local qui désactive le cache HTTP.

Pourquoi : un serveur statique classique laisse le navigateur mettre en cache
app.js/lib.js/styles.css ; en développement on se retrouve alors à tester une
ANCIENNE version (piège récurrent). Ce serveur renvoie « no-store » pour forcer
le rechargement à chaque fois.

Usage :
    python3 tools/serve.py          # http://127.0.0.1:8765
    python3 tools/serve.py 9000     # port personnalisé

Pour la production (GitHub Pages), c'est le service worker qui gère le cache —
ce serveur ne concerne QUE le développement local.
"""
import http.server, os, sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


def main() -> None:
    os.chdir(ROOT)
    print(f"Bible hors-ligne — dev (no-cache) sur http://127.0.0.1:{PORT}  (Ctrl+C pour arrêter)")
    try:
        http.server.test(HandlerClass=NoCacheHandler, port=PORT, bind="127.0.0.1")
    except KeyboardInterrupt:
        print("\nArrêté.")


if __name__ == "__main__":
    main()
