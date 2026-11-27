# Cours : programmer avec un jeu de 1991

Des leçons de programmation qui s'appuient sur le code de HeroQuest PC (Gremlin, 1991), réécrit en JavaScript lisible dans [web/jeu/lisible/](../web/jeu/lisible/). Chaque leçon part d'un comportement que l'on voit en jouant, montre le code qui le produit, explique les contraintes de la machine de l'époque, puis propose des exercices.

Public visé : des débutants qui connaissent les bases de JavaScript (variables, fonctions, boucles, tableaux, classes). Les notions propres au jeu ou au PC de 1991 sont expliquées dans les leçons.

## Avant de commencer

Il faut une copie du jeu d'origine dans `jeu/` (elle n'est pas fournie), PHP 8 et Node 22. Depuis la racine du dépôt :

```bash
php -S 127.0.0.1:8765 -t web
```

Puis ouvrir `http://127.0.0.1:8765/?sans-intro&inspecteur`. L'inspecteur, à droite de l'écran, montre ce que le code voit pendant la partie : la routine en cours, les tirages du hasard, les fiches des héros et le plateau. Les leçons s'en servent tout le temps. Son fonctionnement est décrit dans [web/README.md](../web/README.md#inspecteur).

Pour jouer sans navigateur et écrire l'état de la partie en JSON, depuis `outils/` :

```bash
ETAT=etat.json node essai.mjs 5 plateau.png "clic:68:128,attendre:3,clic:160:44,attendre:4,clic:160:180,attendre:4"
```

Les exercices se font dans une copie de travail (une branche git). Après une modification de `web/jeu/lisible/`, `node outils/lisible.mjs 40 <routine>` dit si le code se comporte encore comme l'original : c'est attendu pour un exercice qui change une règle.

## Leçons

| N° | Leçon | Notions |
| --- | --- | --- |
| 1 | [Le hasard et les dés](01-hasard-et-des.md) | générateur pseudo-aléatoire, graine, registre à décalage, modulo et biais, opérations sur les bits |

Toutes les leçons suivent le même plan : [GABARIT.md](GABARIT.md).

## Règle du dépôt

Le dépôt est public. Les leçons citent uniquement le code lisible et les notes du projet, jamais le désassemblage (`original/asm/`) ni le code généré (`web/jeu/*.gen.js`), qui viennent du jeu d'origine.
