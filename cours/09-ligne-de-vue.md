# Leçon 9 : la ligne de vue

## Ce qu'on va apprendre

Tracer une ligne droite sur une grille avec seulement des additions et des comparaisons d'entiers (l'algorithme de Bresenham), et voir comment une seule variable utilisée pour deux rôles suffit à le casser.

## Ce que fait le jeu

Un héros qui tire (arbalète, hache de jet) ou lance un sort sur une cible lointaine doit la voir. Le jeu trace une ligne case par case, du héros à la cible. Un mur ou une porte fermée sur le chemin coupe la vue, comme certains meubles ou un autre personnage.

## Le code

Le module est [web/jeu/lisible/ligne-de-vue.js](../web/jeu/lisible/ligne-de-vue.js).

### Bresenham en entiers

Pour aller de (13, 14) à (9, 12), il faut 4 pas en x et 2 en y. On avance d'une case à chaque pas sur l'axe le plus long (x), et on change de rangée de temps en temps. Combien de fois ? 2 fois sur 4. L'idée de Bresenham : ajouter l'écart court (2) à une erreur à chaque pas, et dès que l'erreur atteint l'écart long (4), changer de rangée et retirer 4.

```js
let reste = enX.ecart;
for (;;) {
  d.traceErreur += enY.ecart;                  // + écart court
  if (d.traceErreur >= seuil) {                // seuil : l'écart long
    d.traceErreur -= seuil;
    d.traceY = (d.traceY + signe(sensY)) & 0xff;   // on change de rangée
  }
  d.traceX = (d.traceX + signe(sensX)) & 0xff;     // on avance sur l'axe long
  // ... la case (traceX, traceY) coupe-t-elle la vue ?
}
```

Pas de division, pas de nombre à virgule : seulement des additions et des comparaisons, ce que le processeur fait le plus vite. Avec seuil = 4, on obtient (12, 14), (11, 13), (10, 13), (9, 12) : une ligne régulière qui arrive sur la cible.

### Le mur qu'on franchit

À chaque case, `caseCoupeVue` regarde le bord par lequel on entre. La case ne range que ses bords haut et gauche (leçon 4) : le jeu teste le bord haut quand l'axe principal est y, le bord gauche quand c'est x. Une porte ne laisse voir que si elle est ouverte :

```js
const bord = murs & masque.mur;
if (bord !== 0 && (!(bord & masque.porte) || !(bord & PORTE_OUVERTE))) {
  d.resultatVise = 1;                            // mur, ou porte fermée
  return;
}
```

Puis, sauf pour la dernière case (la cible elle-même), un meuble ou un personnage peut couper la vue.

## Ce qu'en faisait la machine de 1991

Le 8086 a une instruction `loop` : elle retire 1 au registre CX et reboucle tant qu'il n'est pas nul. C'est la façon la plus courte d'écrire une boucle comptée, et elle impose son compteur : CX, ou sa moitié basse CL quand la haute vaut 0.

Avec si peu de registres, il est tentant de faire jouer deux rôles à une même valeur. Ici, au départ, l'écart long et le nombre de pas sont bien le même nombre (4 pas pour un écart de 4). Mais le compteur diminue, et l'écart, lui, ne devrait pas.

## Le bogue

Quand l'axe principal est x, le code d'origine met l'écart en x dans CL… qui est aussi le compteur de `loop`. Le seuil de Bresenham diminue donc à chaque pas. Le code lisible le reproduit, avec les cases restantes comme seuil :

```js
d.traceErreur += enY.ecart;
if (d.traceErreur >= reste) {                   // reste : 4, puis 3, 2, 1
  d.traceErreur -= reste;
```

Le tracé change de rangée de plus en plus souvent et n'arrive même pas sur la cible :

| De (13, 14) vers (9, 12) | Cases testées |
| --- | --- |
| Bresenham juste (seuil 4) | (12, 14), (11, 13), (10, 13), (9, 12) |
| Jeu de 1991 (seuil 4, 3, 2, 1) | (12, 14), (11, 13), (10, 12), (9, 11) |

Quand l'axe principal est y, l'écart (dans CL) et le compteur (dans CH) sont deux registres différents : le tracé est juste. Un tir vers une cible plutôt horizontale est donc vérifié le long d'une autre ligne : il peut traverser un mur, ou être bloqué par un mur qui n'est pas entre les deux. Ce bogue a été trouvé en écrivant ce code lisible : la première version, avec le bon seuil, donnait 10 écarts sur 300 cas avec l'original. Voir [bogues-reecriture.md](../original/notes/bogues-reecriture.md#ligne-de-vue), et les deux autres bogues de la ligne de vue dans [03-regles.md](../original/notes/03-regles.md#ligne-de-vue).

## Exercices

1. **Tracer à la main.** Sur une feuille quadrillée, tracer de (10, 0) vers (0, 3) avec Bresenham juste, puis avec le seuil qui diminue. Où finit chaque tracé ? (Le jeu finit en (0, 6).)

2. **Écrire Bresenham.** Écrire `tracer(x0, y0, x1, y1)` qui rend la liste des cases, pour les 8 directions. Vérifier qu'il arrive toujours sur (x1, y1), et que la ligne de A vers B passe par les mêmes cases que celle de B vers A… ou pas : pourquoi ?

3. **Voir le bogue en jeu.** Dans l'inspecteur, placer un héros armé d'une arbalète en face d'un monstre, presque à l'horizontale, avec un mur entre les deux mais pas sur la ligne réelle. Le tir est-il refusé ? Comparer avec le tableau ci-dessus.

4. **Corriger, dans une copie.** Remplacer `reste` par `enX.ecart` dans la branche x. `node outils/lisible.mjs 300 ligne_de_vue` doit retrouver des écarts : combien ?

## Pour aller plus loin

- La ligne de vue et les cases alignées : [original/notes/03-regles.md](../original/notes/03-regles.md#ligne-de-vue).
- « Bresenham's line algorithm » : l'algorithme original (1962), écrit pour une table traçante.
- La leçon 4 (bords des cases) et la leçon 6 (registres partagés).
