---
name: reecrire-routine
description: Réécrire à la main, en JavaScript lisible, une routine de QUEST.EXE (ou un sous-système) dans web/jeu/lisible/, la brancher à la place du code généré et la vérifier contre lui. À utiliser quand on demande de réécrire, rendre lisible ou porter à la main une routine ou un sous-système du jeu.
---

# Réécrire une routine en code lisible

Argument : un nom de routine de `original/symboles.txt` (par exemple `attaque_heros`) ou un sous-système (inventaire, sorts, monstres…). Pour un sous-système, lister ses routines dans `original/asm/quest-routines.txt` et la note de `original/notes/`, puis les traiter des feuilles vers les appelants.

## Étapes

1. Si `original/asm/` manque, le recréer : `python desassembler.py QUEST` depuis `outils/`. Lire la routine dans `original/asm/quest.asm` (chercher son nom), son résumé dans `original/asm/quest-routines.txt` (appelants, variables, interruptions) et la note du sous-système dans `original/notes/`.
2. Relever :
   - les registres d'entrée, et ceux que les appelants lisent au retour (champ `sortie`) ;
   - les variables du segment de données lues et écrites ;
   - si elle attend le joueur, l'écran ou une animation (routine par étapes, méthode génératrice) ou si elle ne fait que calculer (méthode ordinaire) ;
   - si elle se termine par un `jmp` vers une autre routine (champ `fin`, `return this.sauter(QUEST.x)`).
3. Nommer les variables manquantes dans `web/jeu/lisible/donnees.js` (`definirVariables` dans le module), avec l'adresse DS en commentaire.
4. Écrire la méthode dans le module du sous-système (`combat.js`, `deplacement.js`, `tour.js`, ou un nouveau module qui étend `Module` de `module.js`). Noms clairs en français, un commentaire d'en-tête qui explique la règle du jeu, pas les instructions.
5. La brancher dans `web/jeu/lisible/routines.js` (`ROUTINES_QUEST`) : adresse, `nom`, `cout` (moyenne d'instructions de la version générée), `sortie`, `etapes`, `fin`. Pour appeler une routine d'origine : `yield* this.appeler(QUEST.nom)` (adresses dans `adresses.gen.js`, régénérées par `python adresses.py`).
6. Vérifier depuis `outils/` :
   - `node lisible.mjs 100 nom_routine` : 0 écart exigé ;
   - si un chemin est rare, `TEMOIN=xxxx node lisible.mjs 60 nom_routine` pour prouver qu'il est couvert, et ajouter un scénario ciblé dans `lisible.mjs` si besoin ;
   - pour une routine visible à l'écran, comparer les captures `node essai.mjs …` et `GENERE=1 node essai.mjs …`.
7. Puis `node lisible.mjs 100` sur toutes les routines, pour s'assurer de ne rien avoir cassé.

## Règles

- Reproduire l'original, bogues compris. Chaque bogue relevé va dans `original/notes/bogues-reecriture.md` (routine, adresse, effet en jeu).
- Ne jamais modifier `quest.gen.js` ni `original/asm/` : corriger un nom dans `original/symboles.txt` puis régénérer.
- Les drapeaux du processeur ne sont pas rendus : vérifier dans le listing qu'aucun appelant ne les lit après l'appel. Sinon, garder la routine générée ou rendre le drapeau explicitement.

## Pour finir

Mettre à jour dans le même changement :

- `web/README.md`, section « Code lisible » : la liste et le nombre des routines réécrites, le résultat de `lisible.mjs` daté ;
- `ROADMAP.md`, phase 3, « Reste » point 3 ;
- `.claude/CLAUDE.md`, section « État ».
