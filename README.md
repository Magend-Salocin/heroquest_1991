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
| `original/binaires/` | QUEST.EXE et INTRO.EXE décompressés (image mémoire) | non, généré |
| `original/asm/` | désassemblage annoté (`quest.asm`, `intro.asm`), segment de données (`*-donnees.txt`), couverture (`*-rapport.txt`), résumé des routines (`*-routines.txt`) | non, généré |
| `original/donnees/` | palettes, écrans, sprites et images, textes des 5 langues, quêtes en JSON, morceaux de musique | non, généré |
| `outils/` | `desassembler.py`, `extraire.py`, `ecran.py` (images dessinées et messages affichés par une routine), le lancement du jeu original sous DOSBox-X avec débogueur ([DEBOGUER.md](outils/DEBOGUER.md)), et pour le portage `recompiler.py`, `difference.py`, `essai.mjs`, `navigateur.mjs`, `lisible.mjs` ([web/README.md](web/README.md#vérifier)) | oui |
| `outils/heroquest/` | décompresseurs EXEPACK et LZ, outil d'exploration, copiés de `donjon-v2/bin/` | oui |
| `travail/` | copie du jeu utilisée par DOSBox-X (sauvegardes, journal) | non |
| `web/` | le portage JavaScript et PHP : [web/README.md](web/README.md) ; `jeu/*.gen.js` et `sons/` sont générés | en partie |
| `WEB_DEPLOIEMENT.md` | recette de publication web (GitHub Pages, iPhone, clés) reprise de Bestiora Azur, pour plus tard | oui |

## Installer

Prérequis : Python 3.10+, `pip install pillow capstone unicorn`, Node 22+, PHP 8 (pour servir la page).

1. Copier les fichiers du jeu d'origine dans `jeu/`.
2. Régénérer, depuis `outils/` :

   ```bash
   python desassembler.py QUEST && python desassembler.py INTRO   # original/binaires, original/asm
   python extraire.py                                             # original/donnees
   python recompiler.py QUEST && python recompiler.py INTRO       # web/jeu/*.gen.js
   python son.py && node sons.mjs                                 # web/sons/*.wav
   ```

3. Lancer la page : `php -S 127.0.0.1:8765 -t web` depuis la racine, puis `http://127.0.0.1:8765/`.

## Régénérer

Les fichiers de `original/asm/` et `original/donnees/` sont générés : ne pas les modifier à la main. Pour nommer une routine ou une variable, ajouter une ligne à `original/symboles.txt` et relancer le désassembleur.

## Le désassembleur

`desassembler.py` décompresse l'exécutable (EXEPACK), puis suit le flot d'exécution depuis le point d'entrée : appels, sauts, tables de saut par mode vidéo (`mov bx, table ; add bx, [0x3190] ; jmp [bx]`), pointeurs de routine écrits en mémoire (`mov word ptr [x], routine`). Une seconde passe ajoute les zones qui suivent un `ret` et se décodent proprement jusqu'à un `ret` : ces routines sont marquées « probables » dans le listing, à confirmer. Les sauts indirects dont la table passe par un registre ou une variable (zone cliquée, sort choisi, scène de l'intro) sont déclarés dans `SAUTS_INDIRECTS`. Les tables de saut de taille connue, ou dont les entrées ne sont pas des mots consécutifs, sont déclarées dans `TABLES_ESPACEES` : lues au hasard, elles produisent de fausses cibles qui décodent des données comme du code.

Couverture actuelle (voir `original/asm/*-rapport.txt`) :

| Programme | Code atteint | Routines | Sauts indirects non résolus |
| --- | --- | --- | --- |
| QUEST.EXE | 98,7 % | 379, toutes nommées | 0 |
| INTRO.EXE | 97,9 % | 91, toutes nommées | 0 |
