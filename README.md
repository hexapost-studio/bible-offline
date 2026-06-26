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
| 🔍 | **Recherche** plein-texte | Dans toute la traduction active |
| ⇄ | **Comparaison** | Deux traductions côte à côte, versets alignés |
| ★ | **Surlignages & notes** | 4 couleurs + notes par verset (stockés localement) |
| 💾 | **Export / Import** | Sauvegarde des annotations en `.json`, transférable |
| 📖 | **Dictionnaire Strong** | 14 197 entrées hébreu + grec, recherche par numéro ou mot |
| 🌓 | **Thème** clair / sombre | Préférence mémorisée |

## 🚀 Démarrage

```
Ouvrir index.html dans un navigateur.
```

C'est tout. Aucune installation, aucun build, aucune connexion. Le dossier `data/`
doit rester à côté de `index.html`.

## 📁 Structure

```
Bible-Offline/
├── index.html            # toute l'application (HTML + CSS + JS, sans dépendance)
├── data/                 # données générées (voir tools/build_data.py)
│   ├── ls1910.js darby.js martin.js kjv.js   # textes (window.BIBLES)
│   ├── kjvi.js           # interlinéaire KJV mot→Strong (window.KJVI)
│   ├── crossref.js       # références croisées (window.XREF)
│   └── strong.js         # dictionnaire Strong héb./grec (window.STRONG)
├── tools/build_data.py   # régénère data/ depuis les sources (reproductible)
├── README.md  NORMES.md  ATTRIBUTIONS.md  LISEZ-MOI.txt
└── LICENSE
```

## 🔧 Régénérer les données

```bash
python3 tools/build_data.py
```

Télécharge et recompacte les sources publiques. Voir [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)
pour les licences et [`NORMES.md`](NORMES.md) pour les conventions techniques.

## 🧱 Choix d'architecture

- **Zéro dépendance, zéro build côté client** : tout tient dans `index.html`.
  Les données sont des fichiers `.js` qui assignent un objet global (`window.BIBLES`…),
  ce qui permet l'ouverture en `file://` **sans serveur** (contrairement à `fetch()`
  qui serait bloqué par CORS en local).
- **Format compact** : clés courtes (`v`, `t`, `n`, `c`) pour limiter le poids (~31 Mo).
- **Persistance** : `localStorage` (`bible_state`, `bible_highlights`, `bible_notes`).

## ⚠️ Hors périmètre (raisons légales)

- **Segond 21** : sous droit d'auteur → non redistribuable. Pour l'avoir hors-ligne
  légalement, utiliser l'app **YouVersion** et télécharger la version S21.
- **Audio** et **commentaires récents** : sous droits.

## 📜 Licence

Code de l'application : voir [`LICENSE`](LICENSE).
Données : licences respectives détaillées dans [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).
