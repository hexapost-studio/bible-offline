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
| 🔊 | **Lecture audio** | Lit le chapitre à voix haute (synthèse vocale, hors-ligne), **vitesse réglable** et **départ depuis un verset choisi** — *traductions libres uniquement* |
| ℹ️ | **Introduction par livre** | Repères de contexte en tête de livre : genre littéraire, auteur et datation (traditionnels) |
| 🗓 | **Plan de lecture** | « Bible en 1 an », suivi de progression |
| 🏠 | **Accueil** | Verset du jour + reprise de lecture + sélecteur de livres AT/NT |
| 🔍 | **Recherche** plein-texte | Dans toute la traduction active, **insensible aux accents** (« esaie » trouve « Ésaïe ») |
| ⇄ | **Comparaison** | Deux traductions côte à côte, versets alignés |
| ★ | **Surlignages & notes** | 4 couleurs + notes par verset (stockés localement) |
| 📋 | **Copier / partager** | Un verset avec sa référence (Web Share API) |
| 📖 | **Dictionnaire Strong** | 14 197 entrées hébreu + grec, recherche par numéro ou mot ; **définitions en français** (traduction auto) avec repli anglais |
| 🔬 | **Étude en profondeur** | Hub à 4 onglets : étude de mot, fiche (O/I/A · 3C · 7 étapes + check-list des biais), thèmes (+ **index Nave**), parcours |
| 💾 | **Sauvegarde auto** | Miroir local horodaté de tes annotations + rappel d'export + restauration |
| ⚙️ | **Réglages de lecture** | Thème sombre / clair / sépia, police serif ou sans, taille, interligne |
| 💾 | **Export / Import** | Sauvegarde des annotations en `.json`, transférable |
| 📲 | **Installable (PWA)** | « Ajouter à l'écran d'accueil », fonctionne hors-ligne (service worker) |

## 🔬 Étude biblique en profondeur

Le bouton 🔬 ouvre un **hub d'étude** à quatre onglets :

- **🔤 Étude de mot (concordance Strong)** — saisis un numéro Strong (ou clique un mot en
  lecture KJV → « Étudier ce mot ») : définition hébreu/grec **+ toutes ses occurrences** dans
  l'Écriture, avec le mot surligné dans chaque verset (s'appuie sur l'interlinéaire `KJVI`).
- **📝 Fiche d'étude (plusieurs méthodes)** — par chapitre, au choix : **inductive O/I/A**,
  **3C** (Contexte / Contenu / Connexion, express) ou **7 étapes** (approfondi : contexte
  historique, exégèse linguistique, narratif, intertextualité, réception, silences, synthèse).
  **Sauvegarde automatique** + **check-list des biais** (6 angles morts à surveiller).
- **🏷 Étude thématique (tags + Nave)** — classe un verset par thème libre via 🏷 (popover du n° de
  verset) ; revois tous les versets d'un thème. Inclut aussi l'**index thématique Nave**
  (Nave's Topical Bible, domaine public, ~4 600 sujets) : cherche un sujet → liste de versets.
- **🧭 Parcours de références croisées** — chaîne d'étude guidée : démarre depuis un verset (🧭),
  suis ses renvois de verset en verset avec un **fil d'Ariane** (avancer / reculer / effacer).

Tout est **hors-ligne** et **stocké localement** (`bible_topics`, `bible_study`, `bible_trail`),
inclus dans l'export/import `.json`.

> 💾 **Sécurité des données** : tes annotations vivent dans le navigateur (`localStorage`). L'app
> en garde une **sauvegarde miroir horodatée** (`bible_autosave`), te **rappelle d'exporter**
> régulièrement, et propose de **restaurer** la dernière sauvegarde (⚙️ Réglages → Mes données).
> Une vraie synchro multi-appareils nécessiterait un serveur (hors périmètre 100 % hors-ligne).

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
│   ├── strong.js         # dictionnaire Strong héb./grec (window.STRONG)
│   ├── strong_fr.js      # définitions Strong en français, auto (window.STRONG_FR) — optionnel
│   ├── nave.js           # index thématique Nave (window.NAVE)
│   └── intros.js         # introductions par livre : genre, auteur, datation (window.INTROS)
├── tools/build_data.py        # régénère data/ depuis les sources (reproductible)
├── tools/translate_strong.py  # génère strong_fr.js (traduction auto, résumable)
├── tools/catalog.py      # liste les Bibles fr accessibles avec ta clé API.Bible
├── proxy/                # proxy serverless Vercel pour API.Bible (clé cachée + CORS)
├── tests/                # node --test (logique + intégrité des données)
├── README.md  NORMES.md  ATTRIBUTIONS.md  LISEZ-MOI.txt
└── package.json  LICENSE
```

## 🔧 Régénérer les données

```bash
python3 tools/build_data.py        # textes, réf. croisées, Strong, interlinéaire, index Nave
python3 tools/translate_strong.py  # (optionnel) définitions Strong en français (traduction auto)
```

`build_data.py` télécharge et recompacte les sources publiques (dont l'index Nave).
`translate_strong.py` génère `data/strong_fr.js` en traduisant les définitions anglaises
(domaine public) — **résumable** (cache disque) et **non bloquant** : si absent, l'app affiche
l'anglais. Voir [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) pour les licences et
[`NORMES.md`](NORMES.md) pour les conventions techniques.

## 🛠 Développement local

```bash
npm run serve   # serveur local SANS cache (http://127.0.0.1:8765) — évite de tester un ancien build
```

En production (GitHub Pages), c'est le **service worker** qui gère le cache hors-ligne
(pense à bumper `CACHE` dans `sw.js` à chaque déploiement).

## ✅ Tests

```bash
npm test        # node --test : logique pure + intégrité des données + smoke
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
  `bible_history`, `bible_plan`, `bible_settings`, `bible_topics`, `bible_study`, `bible_trail`).

## 🌐 Versions en ligne (sous droits, optionnel)

En plus des 4 traductions libres (hors-ligne), l'app peut afficher des versions
**sous droits** via [API.Bible](https://scripture.api.bible) : **Segond 21**,
**Bible du Semeur**, **Bible de Jérusalem**. Elles apparaissent dans le menu mais
restent **grisées** tant qu'une clé valide n'est pas fournie.

- **En ligne uniquement** : le texte est récupéré à la demande et mis en cache
  **en mémoire pour la session** (jamais stocké) — conforme à la licence API.Bible.
- **Conformité licence** (versions sous droits) :
  - **Attribution affichée à chaque lecture** : copyright fourni par l'API + **lien vers
    l'éditeur** + mention **« Texte fourni par API.Bible »** (lien `https://api.bible`).
  - **Suivi FUMS** (Fair Use Management System) : obligatoire pour toute webapp ; le jeton
    `meta.fumsId` de chaque chapitre est signalé via le script de suivi d'API.Bible (non bloquant).
  - **Lecture audio (TTS) désactivée** sur ces versions : la licence interdit de transformer le
    texte sous droits en audio. Le TTS reste actif sur les 4 traductions du domaine public.
  - **Notes de bas de page conservées** et rendues accessibles (repliées par verset).
  - **Limites** : 1 chapitre affiché à la fois (≤ 2 chapitres / 25 versets imposés) ; pas de pub,
    d'abonnement ni de don (usage **non commercial**) ; chaque version peut exiger un **accord
    éditeur séparé** et n'est activée que si la clé y donne droit.
  - **Résilience réseau** : timeout, nouvelles tentatives (backoff) sur erreurs réseau/quota/5xx,
    messages clairs (hors-ligne, quota atteint, version refusée), repli sur Segond 1910 en cas d'échec.
- **Clé** : saisie dans ⚙️ Réglages, conservée en `localStorage` **uniquement**
  (jamais dans le dépôt).
- **Découvrir les versions accessibles avec ta clé** :
  ```bash
  python3 tools/catalog.py TA_CLE          # liste les Bibles fra + statut des cibles
  ```
- **CORS / sécurité** : API.Bible vise un usage serveur. Un **proxy serverless**
  prêt à déployer est fourni dans [`proxy/`](proxy/) (Vercel) : il garde la clé
  côté serveur et règle le CORS. Renseigne ensuite son URL dans ⚙️ Réglages → champ
  **Proxy** (ou `OnlineBibles.setProxy(url)`). Voir [`proxy/README.md`](proxy/README.md).
- Limites : versions catholiques affichées sur les 66 livres protestants
  (deutérocanoniques non navigués) ; pas d'interlinéaire Strong sur ces versions.

## ⚠️ Hors périmètre (raisons légales)

- **Segond 21 & autres sous droits** : non redistribuables → fournies seulement via
  le mode en ligne ci-dessus (API.Bible) ou l'app **YouVersion**.
- **Audio narré** et **commentaires récents** : sous droits.

## 📜 Licence

Code de l'application : voir [`LICENSE`](LICENSE).
Données : licences respectives détaillées dans [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).
