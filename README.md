# HeroQuest (1991 Gremlin) - 2026

Reproduction à l'identique du HeroQuest PC de Gremlin (1991), d'abord en retrouvant le code original, puis en le portant en JavaScript (le jeu) et PHP (le service). La [roadmap](ROADMAP.md) donne les étapes et les décisions à prendre.

Les formats des fichiers du jeu sont décrits dans [docs/FORMATS.md](docs/FORMATS.md). Ce projet est indépendant de `donjon-v2`, dont il reprend les décompresseurs et l'outil d'exploration (`outils/heroquest/`).

Projet personnel, non commercial. Le dépôt est public : les données de Gremlin et Hasbro n'y sont pas publiées, ni les fichiers d'origine (`jeu/`) ni ce qui en est extrait ou généré (voir `.gitignore`). Chacun doit fournir sa propre copie du jeu.

## Structure

| Chemin | Contenu | Versionné |
| --- | --- | --- |
| `jeu/` | les fichiers du jeu de 1991 (`HERO.EXE`, `QUEST.EXE`, `.VGA`, `.BIN`…), à fournir | non |
| `docs/FORMATS.md` | formats des fichiers du jeu (compressions, palette, sprites, quêtes, sauvegarde) | oui |
| `original/symboles.txt` | noms des routines, variables et tables de QUEST.EXE, à enrichir au fil de l'étude ; `symboles-intro.txt` pour INTRO.EXE | oui |
| `original/notes/` | ce que fait le code, par sous-système | oui |
| `original/binaires/` | QUEST.EXE et INTRO.EXE décompressés, recréés par `desassembler.py` au besoin | non, généré |
| `original/asm/` | désassemblage annoté (`quest.asm`, `intro.asm`), segment de données (`*-donnees.txt`), couverture (`*-rapport.txt`), résumé des routines (`*-routines.txt`), recréé par `desassembler.py` au besoin (lecture du code pour la réécriture lisible) | non, généré |
| `original/donnees/` | palettes, écrans, sprites et images, textes des 5 langues, quêtes en JSON, morceaux de musique | non, généré |
| `outils/` | régénération (`desassembler.py`, `recompiler.py`, `extraire.py`, `adresses.py`, `son.py`, `sons.mjs`), vérification du code lisible (`lisible.mjs`, `essai.mjs`, `navigateur.mjs`), publication (`construire-site.mjs`, `paquet.mjs`), lancement d'Electron (`lancer-electron.mjs`) | oui |
| `outils/heroquest/` | décompresseurs EXEPACK et LZ, outil d'exploration, copiés de `donjon-v2/bin/` | oui |
| `electron/`, `package.json` | version PC : `npm start`, `.exe` portable par `npm run dist` (dans `dist/`, usage personnel) | oui |
| `web/` | le portage JavaScript et PHP : [web/README.md](web/README.md) ; `jeu/*.gen.js` et `sons/` sont générés | en partie |
| `WEB_DEPLOIEMENT.md` | publication sur GitHub Pages et jeu sur téléphone (paquet de données, tactile, hors ligne) | oui |
| `.github/workflows/pages.yml` | déploie `web/` (moteur seul) sur GitHub Pages | oui |
| `paquet/`, `_site/` | paquet de données pour le téléphone (`outils/paquet.mjs`), site construit (`outils/construire-site.mjs`) | non |

## Installer

Prérequis : Python 3.10+, `pip install pillow capstone unicorn`, Node 22+ ; PHP 8 pour servir la page dans un navigateur, ou `npm install` pour Electron.

1. Copier les fichiers du jeu d'origine dans `jeu/`.
2. Régénérer, depuis `outils/` :

   ```bash
   python desassembler.py QUEST && python desassembler.py INTRO   # original/binaires, original/asm
   python extraire.py                                             # original/donnees
   python recompiler.py QUEST && python recompiler.py INTRO       # web/jeu/*.gen.js
   python son.py && node sons.mjs                                 # web/sons/*.wav
   ```

3. Jouer, depuis la racine :
   - sur PC dans une fenêtre : `npm install` (une fois), puis `npm start` ; `npm run dist` fabrique `dist/HeroQuest 1991-1.0.0-portable.exe` ;
   - dans un navigateur : `php -S 127.0.0.1:8765 -t web`, puis `http://127.0.0.1:8765/` ;
   - sur téléphone : voir [WEB_DEPLOIEMENT.md](WEB_DEPLOIEMENT.md).

Le 20 novembre 2026, les outils d'étude du jeu original (DOSBox-X et son débogueur, test différentiel `difference.py`, `ecran.py`) ont été retirés : ils restent dans l'historique git (commit `df54dd0`).

## Régénérer

Les fichiers de `original/asm/` et `original/donnees/` sont générés : ne pas les modifier à la main. Pour nommer une routine ou une variable, ajouter une ligne à `original/symboles.txt` et relancer le désassembleur.

## Le désassembleur

`desassembler.py` décompresse l'exécutable (EXEPACK), puis suit le flot d'exécution depuis le point d'entrée : appels, sauts, tables de saut par mode vidéo (`mov bx, table ; add bx, [0x3190] ; jmp [bx]`), pointeurs de routine écrits en mémoire (`mov word ptr [x], routine`). Une seconde passe ajoute les zones qui suivent un `ret` et se décodent proprement jusqu'à un `ret` : ces routines sont marquées « probables » dans le listing, à confirmer. Les sauts indirects dont la table passe par un registre ou une variable (zone cliquée, sort choisi, scène de l'intro) sont déclarés dans `SAUTS_INDIRECTS`. Les tables de saut de taille connue, ou dont les entrées ne sont pas des mots consécutifs, sont déclarées dans `TABLES_ESPACEES` : lues au hasard, elles produisent de fausses cibles qui décodent des données comme du code.

Couverture actuelle (voir `original/asm/*-rapport.txt`) :

| Programme | Code atteint | Routines | Sauts indirects non résolus |
| --- | --- | --- | --- |
| QUEST.EXE | 98,7 % | 379, toutes nommées | 0 |
| INTRO.EXE | 97,9 % | 91, toutes nommées | 0 |
