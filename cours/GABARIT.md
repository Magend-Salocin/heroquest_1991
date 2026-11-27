# Gabarit d'une leçon

Chaque leçon suit ce plan. Fichier : `cours/NN-sujet.md`, puis une ligne dans le tableau de [README.md](README.md).

Règles :

- citer uniquement le code lisible (`web/jeu/lisible/`, `web/jeu/vue/`) et les notes du projet, jamais `original/asm/` ni `web/jeu/*.gen.js` ;
- des extraits courts, avec un lien vers le fichier complet ;
- chaque exercice dit comment vérifier le résultat (dans le jeu, l'inspecteur, `essai.mjs` ou `lisible.mjs`).

```markdown
# Leçon N : titre

## Ce qu'on va apprendre

La notion de programmation, en 2 ou 3 lignes.

## Ce que fait le jeu

Le comportement observable, et ce qu'il faut regarder dans l'inspecteur pour le voir.

## Le code

Extraits du code lisible, commentés, avec les liens vers les fichiers.

## Ce qu'en faisait la machine de 1991

Les contraintes de l'époque (processeur 8086, registres de 16 bits, mémoire, vitesse) et ce
qu'elles ont changé dans la façon d'écrire ce code. Expliqué en mots, sans citer le désassemblage.

## Le bogue

Un comportement de l'original relevé dans original/notes/bogues-reecriture.md, s'il y en a un
pour ce sujet : ce qui se passe, pourquoi, et pourquoi le code lisible le garde.

## Exercices

1. Observer : ce qu'il faut faire dans le jeu, et ce qu'on doit voir.
2. Modifier : une modification dans une copie, et comment voir le résultat.
3. Aller plus loin : un exercice plus ouvert.

## Pour aller plus loin

Liens vers les notes du projet et vers des ressources générales.
```
