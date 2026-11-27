# Plan : cours de programmation et vue moderne

Deux chantiers qui avancent ensemble :

- **Cours** : chaque sous-système réécrit en JS lisible devient une leçon, et un inspecteur montre le code au travail pendant la partie.
- **Vue moderne** : une seconde façon d'afficher la partie, avec des graphismes neufs. Elle lit l'état dans la mémoire du jeu émulé. Les règles et les dés restent ceux du code d'origine.

Chaque étape ci-dessous est un prompt autonome, à lancer dans une nouvelle session Claude Code ouverte à la racine du dépôt. Les étapes sont dans l'ordre conseillé. Le champ « Prérequis » indique celles qu'il faut avoir terminées avant.

Règles communes, déjà rappelées dans chaque prompt :

- Aucun fichier de Gremlin dans le dépôt : pas d'images, de sprites, de textes longs ni de désassemblage.
- La vue moderne n'utilise que des graphismes créés pour ce projet. Les atlas `iso/1991` et `iso/remake` de donjon-v2 sont exclus, parce qu'ils sont extraits ou redessinés d'après le jeu.
- La vue d'origine reste celle par défaut et ne change pas d'un pixel.

## Suivi

| Étape | Sujet | Fait |
| --- | --- | --- |
| 0 | Inscrire le plan dans ROADMAP.md | |
| 1 | Couche d'état lisible | |
| 2 | Inspecteur | |
| 3 | Dossier `cours/` et leçon 1 (hasard et dés) | |
| 4 | Leçons du code déjà réécrit | |
| 5 | Boucle : réécrire un sous-système, puis sa leçon | à répéter |
| 6 | Prompts des graphismes | |
| 7 | Script de découpe des planches | |
| 8 | Vue moderne : plateau en lecture seule | |
| 9 | Vue moderne : bascule et interface | |
| 10 | Vue moderne : commandes | |
| 11 | Vue moderne : graphismes définitifs | |

## Étape 0 : inscrire le plan dans ROADMAP.md

Prérequis : aucun.

```text
Lis .claude/CLAUDE.md, ROADMAP.md et docs/PLAN-cours-vue-moderne.md.

Ajoute à ROADMAP.md une « Phase 5 : cours et vue moderne » qui résume le plan en quelques lignes, renvoie à docs/PLAN-cours-vue-moderne.md, et liste les étapes 1 à 11 avec leur état.

Dans le tableau des décisions :
- D5 : tranchée, la vue moderne est un mode de heroquest_1991 ; donjon-v2 reste un projet séparé, et ses atlas iso ne sont pas repris.
- Ajoute D6 : la vue moderne n'est pas tenue au pixel près, mais les règles et les dés sont ceux du code d'origine, puisqu'elle ne fait que lire la mémoire et envoyer des commandes.

Mets à jour la date d'état. N'écris rien d'autre. Ne fais pas de commit.
```

## Étape 1 : couche d'état lisible

Prérequis : étape 0.

```text
Lis .claude/CLAUDE.md, web/README.md (section Code lisible), web/jeu/lisible/donnees.js et original/notes/03-regles.md (sections Fiche d'un personnage, Monstres, Plateau en mémoire).

Crée web/jeu/vue/etat.js : une fonction lireEtat(machine) qui renvoie un objet JavaScript simple, sans référence à la mémoire, décrivant la partie en cours :
- quête (numéro) et phase (héros ou monstres, personnage courant) ;
- plateau 26 × 19 : pour chaque case, la zone, les murs et portes de chaque côté, l'occupant (monstre, meuble, éboulis, piège, escalier) et si la case a été vue ;
- héros : type, position, points de corps et d'esprit, attaque, défense, or ;
- monstres : type, position, points de corps, vivant ou non.

Utilise exclusivement les accès de donnees.js (Donnees, TABLES, Fiche, Monstre). Pour un champ manquant, ajoute-le dans donnees.js, avec un commentaire qui renvoie à la note. Ne lis jamais la mémoire par des offsets écrits en dur dans etat.js.

Ajoute à outils/essai.mjs une option qui écrit lireEtat en JSON à la fin de l'essai. Vérifie sur un essai qui va jusqu'au plateau : positions des héros et cases vues cohérentes avec la capture.

Documente le module dans web/README.md. Pas de commit.
```

## Étape 2 : inspecteur

Prérequis : étape 1.

```text
Lis .claude/CLAUDE.md, web/README.md, web/jeu/principal.js, web/jeu/machine.js et web/jeu/vue/etat.js.

Ajoute un inspecteur activé par ?inspecteur=1 : un panneau à côté de l'écran du jeu (en dessous sur téléphone), rafraîchi à chaque image, qui montre :
1. le personnage courant et sa fiche, les monstres visibles avec leurs points de corps ;
2. les grilles zones, murs et occupants en petit, en couleurs, avec la case survolée détaillée ;
3. le dernier tirage du hasard (routine hasard de web/jeu/lisible/hasard.js : valeur, graine avant et après) ;
4. si c'est faisable sans ralentir le jeu, le nom de la routine en cours et la pile d'appels (noms de symboles.txt, déjà présents dans quest.gen.js). Sinon, explique pourquoi et propose une alternative.

Code dans web/jeu/vue/inspecteur.js et un fichier CSS séparé. Sans ?inspecteur=1, aucun coût et aucun changement. Vérifie dans le navigateur (php -S 127.0.0.1:8765 -t web). Documente-le dans web/README.md. Pas de commit.
```

## Étape 3 : dossier cours/ et leçon 1

Prérequis : étape 2.

```text
Lis .claude/CLAUDE.md, ROADMAP.md, web/README.md (Code lisible), web/jeu/lisible/hasard.js, combat.js (partie dés), original/notes/03-regles.md et original/notes/bogues-reecriture.md.

Crée cours/README.md : public visé (débutants qui connaissent les bases de JavaScript), comment lancer le jeu et l'inspecteur, liste des leçons. Crée cours/GABARIT.md, que toutes les leçons suivront :
1. Ce qu'on va apprendre (la notion de programmation, 2 à 3 lignes)
2. Ce que fait le jeu (le comportement observable, avec ce qu'il faut regarder dans l'inspecteur)
3. Le code (extraits du code lisible commentés, liens vers les fichiers)
4. Ce qu'en faisait la machine de 1991 (contraintes : 8086, mémoire, entiers 16 bits), sans citer le désassemblage
5. Le bogue (s'il y en a un, d'après bogues-reecriture.md)
6. Exercice (une modification à faire dans une copie, et comment voir le résultat)
7. Pour aller plus loin

Écris cours/01-hasard-et-des.md : générateur pseudo-aléatoire, graine, pourquoi la même graine donne les mêmes dés, tirage du dé de combat. Exercice : forcer la graine et rejouer la même attaque.

Règle du dépôt public : citer uniquement le code lisible, jamais original/asm ni *.gen.js. Pas de commit.
```

## Étape 4 : leçons du code déjà réécrit

Prérequis : étape 3.

```text
Lis .claude/CLAUDE.md, cours/README.md, cours/GABARIT.md, cours/01-hasard-et-des.md, puis web/jeu/lisible/ (routines.js, module.js, combat.js, deplacement.js, tour.js) et les notes correspondantes dans original/notes/.

Écris, en suivant le gabarit et le ton de la leçon 1 :
- cours/02-routines-par-etapes.md : comment une routine qui attend le joueur ou l'écran est découpée en étapes (machine à états) ;
- cours/03-combat.md : dés d'attaque et de défense, boucliers, crânes, points de corps ;
- cours/04-deplacement.md : grille, bits de murs et de portes, chemin vers la case cliquée ;
- cours/05-tour.md : déroulé d'un tour de héros puis des monstres.

Chaque exercice doit pouvoir se vérifier dans le jeu ou avec node outils/lisible.mjs. Mets à jour la liste dans cours/README.md. Pas de commit.
```

## Étape 5 : réécrire un sous-système, puis sa leçon (à répéter)

Prérequis : étape 4. Remplacer `<SOUS-SYSTÈME>` par le suivant dans cet ordre :

1. fiches et objets (armes, armures, potions, artefacts)
2. fouilles et cartes trésor
3. pièges et portes secrètes
4. ligne de vue
5. sorts
6. monstres : intelligence et recherche de chemin
7. événements scriptés et événements de zone
8. fin de quête, récompenses, mort d'un héros
9. écrans : menu, héros, armurerie, briefing, inventaire
10. socle : VGA 13h, palette, fondus, souris, clavier, minuterie

```text
Sous-système : <SOUS-SYSTÈME>.

Lis .claude/CLAUDE.md, ROADMAP.md (phase 3, Reste) et la note de original/notes/ qui décrit ce sous-système.

1. Utilise le skill /reecrire-routine pour réécrire en JS lisible toutes les routines de ce sous-système, dans un module de web/jeu/lisible/. Bogues compris : chaque bogue trouvé va dans original/notes/bogues-reecriture.md, sans correction.
2. Vérifie avec node outils/lisible.mjs (100 parties, puis 40 par routine). La réécriture n'est faite que sans écart.
3. Si de nouvelles variables sont nommées, ajoute-les à donnees.js et, si c'est utile, à web/jeu/vue/etat.js et à l'inspecteur.
4. Écris la leçon suivante dans cours/, selon cours/GABARIT.md. Ne cite que le code lisible.
5. Mets à jour web/README.md, ROADMAP.md (compte de routines sur 379) et le suivi de docs/PLAN-cours-vue-moderne.md.

Si le sous-système est trop gros pour une session, arrête-toi à un ensemble cohérent de routines vérifiées et indique précisément ce qui reste. Pas de commit.
```

## Étape 6 : prompts des graphismes

Prérequis : étape 0. Peut se faire en parallèle des étapes 1 à 5.

```text
Lis .claude/CLAUDE.md, ce plan, et comme modèles de méthode : D:/VisualCode_Perso/HeroQuest/HeroQuest/Campagne01/01-regles/heros-prompt.md et 02-quetes/illustrations-prompt.md.

Écris docs/prompts-interface.md : les prompts de génération d'images pour la vue moderne. Contraintes :
- style original, propre au projet : ne pas imiter le jeu de 1991 ni la boîte du jeu de plateau, ne citer aucune marque, aucun nom de personnage ou de lieu du jeu ;
- planches en grille stricte, fond vert pur #00FF00 pour les éléments détourés, aucun texte dans l'image, prompts en anglais, explications en français ;
- un bloc de style commun à toutes les planches pour garder la cohérence ;
- pour chaque planche : usage dans le jeu, taille de la planche et des cases, ordre des cases, nom des fichiers produits après découpe, contraintes à respecter pour que la découpe marche.

Planches à prévoir :
1. sols isométriques (losange 2:1), plusieurs variantes de pierre ;
2. murs isométriques (côté haut et côté gauche), avec et sans torche ;
3. portes fermées et ouvertes, porte secrète, escalier, éboulis ;
4. meubles génériques (table, coffre, armoire, étagère, trône, tombeau, cheminée, établi, chevalet), sur une ou deux cases ;
5. monstres génériques de fantasy, une pose de repos par type (types : voir original/notes/03-regles.md, section Monstres) ;
6. interface : cadre, panneau d'actions, boutons, icônes d'action (déplacer, attaquer, fouiller, sort, inventaire, fin de tour) ;
7. dés de combat et de déplacement ;
8. parchemin des messages et boîte de dialogue.

Les héros réutilisent les portraits et pions déjà découpés dans D:/VisualCode_Perso/Donjon/Donjon/donjon-v2/public/assets/game/images/avatars/ ; prévois seulement une planche de pions isométriques en pied (4 types × 2 sexes, 4 directions) dans le même style.

Pas de commit.
```

## Étape 7 : script de découpe des planches

Prérequis : étape 6, et au moins une planche générée, déposée dans `graphismes/planches/`.

```text
Lis .claude/CLAUDE.md et docs/prompts-interface.md.

Écris outils/decouper-planches.py (Pillow) : pour chaque planche décrite dans docs/prompts-interface.md et présente dans graphismes/planches/, découpe la grille, retire le fond vert (avec une tolérance réglable et un adoucissement du bord), recadre, redimensionne à la taille cible et écrit web/vue/images/<nom>.png. Puis assemble un atlas web/vue/images/atlas.png et un index atlas.json (nom -> x, y, largeur, hauteur, point d'ancrage au sol).

La description des planches (grille, noms, tailles, ancrages) est dans un seul fichier outils/planches.json, pas en dur dans le script. Une planche absente est ignorée avec un message.

Ces images sont créées pour le projet : elles peuvent être versionnées. Vérifie que .gitignore ne les exclut pas. Documente la commande dans .claude/CLAUDE.md (tableau Commandes) et web/README.md. Pas de commit.
```

## Étape 8 : vue moderne, plateau en lecture seule

Prérequis : étape 1. Les graphismes ne sont pas nécessaires : à défaut, dessiner des formes simples (losanges et blocs colorés).

```text
Lis .claude/CLAUDE.md, ROADMAP.md (phase 5, D6), web/README.md, web/jeu/principal.js et web/jeu/vue/etat.js.

Pour la projection et la caméra, tu peux t'inspirer de D:/VisualCode_Perso/Donjon/Donjon/donjon-v2/public/assets/game/ModuleIso.js (le code de l'auteur, logique seulement) : case (x, y) dessinée en ((x - y) * L/2, (x + y) * L/4), seuls les murs du fond, ordre de dessin du fond vers l'avant. N'utilise aucun de ses atlas.

Crée web/jeu/vue/plateau.js : un rendu isométrique sur un canvas séparé, qui ne fait que lire lireEtat(machine) à chaque image. Il affiche les cases vues, les murs, les portes, les meubles, les héros et les monstres, avec une caméra qui suit le personnage courant. Il charge web/vue/images/atlas.json s'il existe, sinon il dessine des formes simples.

Activation provisoire par ?vue=moderne : le canvas moderne prend la place principale et l'écran d'origine reste visible en petit, jouable comme avant. Sans le paramètre, rien ne change. Vérifie dans le navigateur sur une quête complète : la vue suit fidèlement la partie. Documente-le dans web/README.md. Pas de commit.
```

## Étape 9 : vue moderne, bascule et interface

Prérequis : étape 8.

```text
Lis .claude/CLAUDE.md, web/README.md, web/jeu/vue/ et original/notes/02-ecrans.md (machine d'écrans, panneau d'icônes).

1. Bascule : un bouton (et une touche) pour passer de la vue d'origine à la vue moderne en cours de partie, avec le choix mémorisé dans localStorage (lecture et écriture dans un try/catch). ?vue=moderne et ?vue=origine forcent le choix.
2. La vue moderne ne s'applique qu'au plateau. Les autres écrans (intro, menu, héros, armurerie, briefing, inventaire) restent ceux d'origine en plein écran ; détecte l'écran courant à partir de la mémoire (variable à identifier dans les notes, puis à ajouter à donnees.js).
3. Autour du plateau moderne : fiches des héros (portraits de l'avatar, points de corps et d'esprit), panneau d'actions, journal des messages du jeu, dés du dernier lancer. Pour l'instant tout est en lecture seule : les actions se font encore sur l'écran d'origine en miniature.
4. Mise en page téléphone en paysage, cohérente avec web/jeu/tactile.js.

Vérifie au navigateur et avec outils/navigateur.mjs. Documente-le dans web/README.md. Pas de commit.
```

## Étape 10 : vue moderne, commandes

Prérequis : étape 9.

```text
Lis .claude/CLAUDE.md, web/README.md, web/jeu/vue/, web/jeu/tactile.js et original/notes/03-regles.md (Panneau d'icônes, Déplacement).

Rends la vue moderne jouable. Chaque action passe par l'entrée du jeu d'origine, jamais par une modification directe de la mémoire, pour que les règles et les dés restent ceux du code :
- bouton d'action -> clic souris simulé aux coordonnées du bouton correspondant du panneau d'origine (positions dans les notes) ;
- clic sur une case du plateau moderne -> conversion en case de la grille, puis clic simulé sur cette case dans la vue d'origine ; si la case n'est pas visible dans la vue d'origine, propose une solution et demande avant de l'implémenter ;
- clic droit et appui long comme dans tactile.js.

Ajoute à outils/essai.mjs un scénario joué entièrement par la vue moderne (lancer de dés, déplacement, attaque, fin de tour) et compare la mémoire à la fin avec le même scénario joué sur la vue d'origine : elle doit être identique. Documente-le dans web/README.md. Pas de commit.
```

## Étape 11 : vue moderne, graphismes définitifs

Prérequis : étapes 7 et 10, toutes les planches générées.

```text
Lis .claude/CLAUDE.md, docs/prompts-interface.md, outils/planches.json et web/jeu/vue/.

Lance outils/decouper-planches.py. Branche l'atlas dans la vue moderne :
- variantes de sol choisies de façon stable par case (pas de hasard du jeu : un hachage de la position) ;
- ancrages des meubles sur plusieurs cases ;
- pions des héros en 4 directions, d'après le dernier déplacement ;
- interface et dés.

Fais une capture de chaque écran de la vue moderne (outils/navigateur.mjs), relis-les, et liste les planches à regénérer avec la raison (découpe ratée, style incohérent, taille). Mets à jour docs/prompts-interface.md si un prompt doit être corrigé. Pas de commit.
```
