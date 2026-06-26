# 📖 Bible hors-ligne

Lecteur de Bible **100 % hors-ligne**, sans serveur ni dépendance : un seul fichier
HTML qui s'ouvre dans n'importe quel navigateur. Pensé selon une philosophie de
**minimalisme (Kanso)** et conforme aux standards d'**accessibilité RGAA 4.1 / WCAG 2.2**.

## ✨ Fonctionnalités

| | Fonction | Détail |
|---|---|---|
| 📚 | **4 traductions** | Louis Segond 1910, Darby, Martin 1744, King James Version |
| 🔤 | **Interlinéaire Strong** | En KJV, chaque mot est cliquable → lemme hébreu/grec, translittération, définition |
| 🔗 | **Références croisées** | ~29 000 versets reliés (openbible.info), cliquables |
| 🔊 | **Lecture audio** | Lit le chapitre à voix haute (synthèse vocale du système, hors-ligne) |
| 🗓 | **Plan de lecture** | « Bible en 1 an », suivi de progression |
| 🏠 | **Accueil** | Verset du jour + reprise de lecture + sélecteur de livres AT/NT |
| 🔍 | **Recherche** plein-texte | Dans toute la traduction active |
| ⇄ | **Comparaison** | Deux traductions côte à côte, versets alignés |
| ★ | **Surlignages & notes** | 4 couleurs + notes par verset (stockés localement) |
| 📋 | **Copier / partager** | Un verset avec sa référence (Web Share API) |
| 📖 | **Dictionnaire Strong** | 14 197 entrées hébreu + grec, recherche par numéro ou mot |
| ⚙️ | **Réglages de lecture** | Thème sombre / clair / sépia, police serif ou sans, taille, interligne |
| 💾 | **Export / Import** | Sauvegarde des annotations en `.json`, transférable |
| 📲 | **Installable (PWA)** | « Ajouter à l'écran d'accueil », fonctionne hors-ligne (service worker) |

## 🚀 Démarrage

**En ligne (installable) :** 👉 https://hexapost-studio.github.io/bible-offline/
Sur mobile, « Ajouter à l'écran d'accueil » l'installe comme application ; après une
première visite, elle fonctionne **hors-ligne** (service worker).

**En local :** ouvrir `index.html` dans un navigateur. Aucune installation, aucun build,
aucune connexion. Le dossier `data/` doit rester à côté de `index.html`.

## 📁 Structure

```
Bible-Offline/
├── index.html            # coquille (sémantique, SEO, PWA) — sans dépendance
├── styles.css            # design system (3 thèmes, réglages de lecture)
├── lib.js                # logique pure, sans DOM (testée)
├── app.js                # application : vues, interactions, chargement à la demande
├── data-online.js        # module hybride : Bibles sous droits via API.Bible (optionnel)
├── sw.js  manifest.webmanifest  icon*.png  social.png   # PWA
├── data/                 # données générées (voir tools/build_data.py)
│   ├── ls1910.js darby.js martin.js kjv.js   # textes (window.BIBLES)
│   ├── kjvi.js           # interlinéaire KJV mot→Strong (window.KJVI)
│   ├── crossref.js       # références croisées (window.XREF)
│   └── strong.js         # dictionnaire Strong héb./grec (window.STRONG)
├── tools/build_data.py   # régénère data/ depuis les sources (reproductible)
├── tests/                # node --test (logique + intégrité des données)
├── README.md  NORMES.md  ATTRIBUTIONS.md  LISEZ-MOI.txt
└── package.json  LICENSE
```

## 🔧 Régénérer les données

```bash
python3 tools/build_data.py   # ou : npm run build
```

Télécharge et recompacte les sources publiques. Voir [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)
pour les licences et [`NORMES.md`](NORMES.md) pour les conventions techniques.

## ✅ Tests

```bash
npm test        # node --test : logique pure + intégrité des données
```

15 tests : fonctions pures (`lib.js`) et intégrité des données (66 livres par
traduction, 31 102 versets de l'interlinéaire, cohérence Strong ↔ interlinéaire,
cibles des références croisées valides, versets du jour vérifiés).

## 🧱 Choix d'architecture

- **Zéro dépendance, zéro build côté client** : HTML + CSS + JS classiques.
  Les données sont des fichiers `.js` qui assignent un objet global (`window.BIBLES`…),
  ce qui permet l'ouverture en `file://` **sans serveur** (contrairement à `fetch()`
  qui serait bloqué par CORS en local).
- **Chargement à la demande** : seule la traduction active est chargée au démarrage ;
  l'interlinéaire (9 Mo), le dictionnaire Strong et les références croisées ne sont
  téléchargés qu'à leur première utilisation → démarrage rapide malgré ~40 Mo de données.
- **Format compact** : clés courtes (`v`, `t`, `n`, `c`) pour limiter le poids.
- **Persistance** : `localStorage` (`bible_state`, `bible_highlights`, `bible_notes`,
  `bible_history`, `bible_plan`, `bible_settings`).

## 🌐 Versions en ligne (sous droits, optionnel)

En plus des 4 traductions libres (hors-ligne), l'app peut afficher des versions
**sous droits** via [API.Bible](https://scripture.api.bible) : **Segond 21**,
**Bible du Semeur**, **Bible de Jérusalem**. Elles apparaissent dans le menu mais
restent **grisées** tant qu'une clé valide n'est pas fournie.

- **En ligne uniquement** : le texte est récupéré à la demande et mis en cache
  **en mémoire pour la session** (jamais stocké) — conforme à la licence API.Bible.
- **Clé** : saisie dans ⚙️ Réglages, conservée en `localStorage` **uniquement**
  (jamais dans le dépôt).
- **Découvrir les versions accessibles avec ta clé** :
  ```bash
  python3 tools/catalog.py TA_CLE          # liste les Bibles fra + statut des cibles
  ```
- **CORS / sécurité** : API.Bible vise un usage serveur. Pour un déploiement public,
  renseigne un petit **proxy** (relais serverless qui ajoute l'en-tête `api-key`)
  via `OnlineBibles.setProxy(url)` — cela évite d'exposer la clé et règle le CORS.
- Limites : versions catholiques affichées sur les 66 livres protestants
  (deutérocanoniques non navigués) ; pas d'interlinéaire Strong sur ces versions.

## ⚠️ Hors périmètre (raisons légales)

- **Segond 21 & autres sous droits** : non redistribuables → fournies seulement via
  le mode en ligne ci-dessus (API.Bible) ou l'app **YouVersion**.
- **Audio narré** et **commentaires récents** : sous droits.

## 📜 Licence

Code de l'application : voir [`LICENSE`](LICENSE).
Données : licences respectives détaillées dans [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).
