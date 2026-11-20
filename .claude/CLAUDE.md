# HeroQuest PC (Gremlin, 1991) : portage navigateur

Projet personnel : rejouer le HeroQuest PC de 1991 dans un navigateur, à l'identique (au pixel près, mêmes dés), à partir du code original désassemblé. Langue du projet : français, pour le code (noms de fonctions, variables, fichiers), les commentaires, la doc et les commits.

Documents de référence, à lire selon la tâche :

- [README.md](../README.md) : structure, installation, désassembleur.
- [ROADMAP.md](../ROADMAP.md) : phases, état, décisions D1 à D5. À mettre à jour quand une étape avance.
- [web/README.md](../web/README.md) : portage, code lisible, son, vérifications.
- [docs/FORMATS.md](../docs/FORMATS.md) : formats des fichiers du jeu.
- [original/notes/](../original/notes/) : ce que fait le code, par sous-système (socle, écrans, règles, intro), et les bogues de l'original.
- [outils/DEBOGUER.md](../outils/DEBOGUER.md) : le jeu original sous DOSBox-X avec débogueur.

## Chaîne de production

```text
jeu/*.EXE ──desassembler.py──> original/asm/quest.asm (+ symboles.txt pour les noms)
          ──extraire.py──────> original/donnees/ (palettes, images, textes, quêtes)
          ──recompiler.py────> web/jeu/quest.gen.js, intro.gen.js (une fonction JS par routine)
web/jeu/lisible/*.js : réécriture à la main, routine par routine, branchée à la place du code généré
web/jeu/machine.js   : le PC autour du code (8086, mémoire 1 Mo, DOS, BIOS, VGA 13h, souris, clavier)
web/fichiers.php     : sert les fichiers de jeu/ et garde les sauvegardes dans web/sauvegardes/
```

## Règles

- Dépôt public. Ne jamais versionner ni publier les fichiers d'origine (`jeu/`) ni ce qui en est extrait ou généré (`original/asm`, `original/binaires`, `original/donnees`, `web/jeu/*.gen.js`, `web/sons`) : voir `.gitignore`. Pas d'images, de textes longs ou de code désassemblé de Gremlin dans les fichiers versionnés ; une courte citation de message en commentaire est acceptable.
- Ne jamais modifier à la main un fichier généré (`*.gen.js`, `original/asm/`, `original/donnees/`). Pour nommer une routine ou une variable : une ligne dans `original/symboles.txt` (ou `symboles-intro.txt`), puis régénérer (`desassembler.py`, `recompiler.py`, `adresses.py`).
- Le code lisible doit reproduire l'original, bogues compris. Un bogue trouvé en route va dans `original/notes/bogues-reecriture.md`, il n'est pas corrigé.
- Toute réécriture est vérifiée contre la version générée (`node lisible.mjs`) avant d'être considérée comme faite.
- Adresses en hexadécimal minuscule dans le code (`0x3613`), positions dans l'image décompressée ; variables du segment de données notées `DS:3FD2`.
- Mettre à jour la doc concernée (web/README.md, ROADMAP.md, notes) dans le même changement que le code.

## Commandes

Toutes depuis `outils/`, sauf le serveur. Prérequis : Python 3.10+ (`pillow capstone unicorn`), Node 22+, PHP 8.

| Besoin | Commande |
| --- | --- |
| Régénérer le désassemblage | `python desassembler.py QUEST` puis `INTRO` |
| Régénérer les données | `python extraire.py` |
| Régénérer le JS traduit | `python recompiler.py QUEST` puis `INTRO` |
| Régénérer les adresses du code lisible | `python adresses.py` |
| Traduction contre un vrai x86 | `python difference.py 10 QUEST` |
| Code lisible contre généré | `node lisible.mjs 100` ou `node lisible.mjs 40 nom_routine` |
| Jeu sans navigateur, capture | `node essai.mjs 5 menu.png "clic:68:128,attendre:3"` |
| Ce qu'une routine dessine et affiche | `python ecran.py 7717` (adresse en hexadécimal) |
| Servir la page | `php -S 127.0.0.1:8765 -t web` depuis la racine |
| Jeu original sous DOSBox-X | `.\lancer-dosbox.ps1` (`-Debug`, `-Neuf`) |

Sur Windows, la sortie console de Python est en cp1252 : les accents apparaissent mal dans le terminal, les fichiers écrits sont corrects.

## État (20 novembre 2026)

Phases 0 à 2 faites, le jeu se joue dans le navigateur (phase 3). En cours : réécriture lisible (30 routines de QUEST.EXE sur 379 : hasard, combat, déplacement, tour d'un personnage). Prochaines étapes dans [ROADMAP.md](../ROADMAP.md), section « Reste » des phases 3 et 4.

Skill du projet : `/reecrire-routine` pour la réécriture lisible d'une routine.
