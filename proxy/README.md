# Proxy API.Bible (Vercel)

Petit relais serverless qui ajoute l'en-tête `api-key` **côté serveur** (ta clé
n'est jamais exposée dans le navigateur) et renvoie les en-têtes **CORS**.
Indispensable pour utiliser les versions sous droits (S21, Semeur, Jérusalem)
depuis l'app publique sur GitHub Pages.

## Déploiement (≈ 2 min)

1. Installe Vercel CLI si besoin : `npm i -g vercel`
2. Dans ce dossier :
   ```bash
   cd proxy
   vercel            # suit les questions, crée le projet
   ```
3. Ajoute ta clé en variable d'environnement (Vercel → Project → Settings →
   Environment Variables), puis redéploie :
   - `API_BIBLE_KEY` = ta clé API.Bible **(obligatoire)**
   - `ALLOWED_ORIGIN` = `https://hexapost-studio.github.io` *(recommandé)*
   ```bash
   vercel --prod
   ```
4. Tu obtiens une URL, ex. `https://bible-offline-proxy.vercel.app`.

> Alternative sans CLI : importe ce dossier dans vercel.com (New Project),
> définis les variables d'environnement, déploie.

## Brancher l'app dessus

Dans le lecteur → ⚙️ **Réglages** → champ **Proxy**, colle :

```
https://TON-PROJET.vercel.app/api/bible
```

(ou, en console : `OnlineBibles.setProxy("https://TON-PROJET.vercel.app/api/bible")`)

Les versions en ligne s'activent alors **sans saisir de clé dans le navigateur**
(la clé reste sur le serveur). Vérifie d'abord les versions accessibles :

```bash
python3 ../tools/catalog.py TA_CLE
```

## Test rapide

```bash
curl "https://TON-PROJET.vercel.app/api/bible/bibles?language=fra"
```

Doit renvoyer la liste JSON des Bibles françaises.

## Sécurité / quota

- La clé vit uniquement dans `API_BIBLE_KEY` (jamais commitée, jamais côté client).
- `ALLOWED_ORIGIN` restreint qui peut appeler le proxy.
- Réponses mises en cache CDN ~1 h (`s-maxage`) pour ménager ton quota Starter.
