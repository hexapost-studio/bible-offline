# Normes & bonnes pratiques

Conventions appliquées au projet, fondées sur trois piliers : **minimalisme (Kanso)**,
**Refactoring UI** et **accessibilité RGAA 4.1 / WCAG 2.2**.

## 1. Accessibilité (RGAA 4.1 / WCAG 2.2) — vérifié

| Critère | Mise en œuvre |
|---|---|
| **Structure sémantique** | `header`, `main`, `nav`, `article`, `section`, titres `h2`, vrais `button`/`select` (pas de `div` cliquable) |
| **Navigation clavier** (2.1.1) | Tout est focalisable ; mots interlinéaires : `role="button"` + `tabindex="0"` + gestion `Enter`/`Espace` ; flèches ←/→ pour changer de chapitre |
| **Focus visible** (2.4.7) | `:focus-visible` à fort contraste sur tous les éléments interactifs |
| **Lien d'évitement** (2.4.1) | « Aller au contenu » en tête de page |
| **Noms accessibles** (4.1.2) | `aria-label` sur les boutons-icônes ; `aria-pressed` sur les bascules ; `<label>` pour chaque champ |
| **Régions live** (4.1.3) | `aria-live="polite"` + `aria-busy` sur la zone de lecture |
| **Échap** | Ferme les popovers ; clic extérieur aussi |
| **Langue** (3.1.1 / 3.1.2) | `lang="fr"` global ; lemmes hébreux `lang="he" dir="rtl"`, grecs `lang="grc"` |
| **Contraste** (1.4.3) | Texte ≥ 4.5:1 dans les deux thèmes (couleurs `--muted`/`--txt`/`--accent` ajustées) |
| **Mouvement réduit** (2.3.3) | `@media (prefers-reduced-motion: reduce)` neutralise le défilement animé |
| **Cible tactile** (2.5.8) | Boutons ≥ 40 px de hauteur |

## 2. Refactoring UI

- **Palette restreinte** : un accent froid + un accent chaud, déclinés en tokens
  (`--accent`, `--accent2`) ; les surlignages sont les seules autres couleurs.
- **Échelle d'espacement** cohérente : `--sp1…--sp5` (4 → 24 px), pas de valeurs magiques.
- **Hiérarchie** par taille/graisse plutôt que par bordures ; bordures réduites au minimum.
- **Rayon unique** (`--radius`) pour l'uniformité visuelle.

## 3. Kanso (minimalisme)

- Une seule colonne de lecture, largeur limitée (`max-width` ~760 px) pour le confort.
- Pas d'élément décoratif : chaque pixel sert la lecture ou la navigation.
- Pas de framework, pas de dépendance, pas de build côté client.

## 4. Conventions de code

- **JavaScript** : `"use strict"`, `const`/`let`, pas de variable globale superflue,
  fonctions courtes à responsabilité unique, échappement HTML systématique (`esc()`).
- **Données** : format compact à clés courtes ; un fichier `.js` = un global assigné.
- **Reproductibilité** : toute donnée provient de `tools/build_data.py` (jamais éditée à la main).
  Le français des définitions Strong est généré séparément par `tools/translate_strong.py`
  (traduction auto, résumable via cache disque, non bloquant).
- **Données générées vs utilisateur** : `data/*.js` = données générées (régénérables) ;
  les données personnelles vivent en `localStorage` + sauvegarde miroir `bible_autosave`.
- **Licence des sources** : ne jamais embarquer de données sous copyright (ex. Strong FR
  Pétrakian/Helleme). Le FR est notre propre traduction de la source anglaise PD, étiquetée « auto ».
- **Sécurité** : aucune entrée utilisateur n'est injectée sans `esc()` ; aucun réseau à l'exécution
  (le réseau n'est utilisé qu'au *build* et, en option, pour les Bibles en ligne API.Bible).

## 5. Git

- `main` = branche stable et ouvrable.
- Messages de commit impératifs et descriptifs.
- `data/` est versionné pour livrer un dossier auto-suffisant (régénérable via le script).
