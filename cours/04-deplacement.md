# Leçon 4 : le déplacement

## Ce qu'on va apprendre

Représenter un plateau par des tableaux à une dimension, ranger les murs sans les écrire deux fois, et chercher un chemin dans une grille par une recherche en profondeur avec coupes.

## Ce que fait le jeu

Le héros lance ses dés de déplacement, puis avance case par case, avec les flèches du panneau ou en cliquant une case du plateau. Un clic fait marcher le héros tout seul jusqu'à la case, par le plus court chemin qui tient dans les cases restantes. Il ne passe pas les murs, ni les portes secrètes qu'il n'a pas trouvées, ni les meubles.

Dans l'inspecteur, la grille du milieu montre les murs (en blanc) et les portes (orange : fermée, vert : ouverte, violet : secrète, pas encore trouvée). Le survol d'une case donne ses quatre bords.

## Le code

### Trois grilles

Le plateau fait 26 × 19 cases. Le jeu le range dans trois tableaux d'octets, l'un après l'autre en mémoire, à 512 octets d'écart. Une case `(x, y)` a l'index `y × 26 + x` dans chacun ([deplacement.js](../web/jeu/lisible/deplacement.js)) :

```js
case(x, y) { return y * LARGEUR + x; }
murs(caseMurs) { return this.donnees.octet(caseMurs); }
zoneDe(caseMurs) { return this.donnees.octet(caseMurs + DE_LA_GRILLE_DES_MURS.zones) & 0x3f; }
occupantDe(caseMurs) { return this.donnees.octet(caseMurs + DE_LA_GRILLE_DES_MURS.occupants); }
```

- **zones** : le numéro de la pièce ou du couloir (0 = hors du plateau) ;
- **murs** : les murs et les portes de la case ;
- **occupants** : un monstre (1 à 32), un éboulis, un piège, un escalier, un meuble.

Avec un tableau à une dimension, les voisines d'une case sont à `+1`, `-1`, `+26` et `-26`. Et comme les trois grilles sont à distance fixe, on passe de l'octet de murs d'une case à son occupant en ajoutant 512.

### Les murs sans doublon

Un mur entre deux cases est à la fois le mur droit de l'une et le mur gauche de l'autre. Pour ne pas le ranger deux fois, chaque case ne garde que son bord gauche et son bord haut :

```js
export const MUR = { gauche: 0x40, haut: 0x80 };
export const PORTE = { gauche: 0x10, haut: 0x20, ouverte: 0x04, secrete: 0x08 };
```

Pour aller à droite, il faut donc lire le bord gauche de la case d'arrivée ; pour aller à gauche, celui de la case de départ. C'est le champ `surArrivee` de la table des 4 pas :

```js
gauche: { dx: -1, dy: 0, mur: MUR.gauche, porte: PORTE.gauche, surArrivee: false, /* ... */ },
droite: { dx: 1, dy: 0, mur: MUR.gauche, porte: PORTE.gauche, surArrivee: true, /* ... */ },
```

Une seule fonction `pas` sert pour les 4 directions : tout ce qui change d'une direction à l'autre est dans la table.

### Chercher un chemin

Au clic sur une case, `chercherChemin` essaie, depuis la case du héros, les 4 directions dans l'ordre haut, droite, bas, gauche, puis recommence depuis chaque case atteinte : c'est une recherche en profondeur.

```js
essayerLesQuatreDirections() {
  const d = this.donnees;
  d.cheminDirection = 0; d.cheminCaseY -= 1; this.essayerCase(); d.cheminCaseY += 1;
  d.cheminDirection = 1; d.cheminCaseX += 1; this.essayerCase(); d.cheminCaseX -= 1;
  d.cheminDirection = 2; d.cheminCaseY += 1; this.essayerCase(); d.cheminCaseY -= 1;
  d.cheminDirection = 3; d.cheminCaseX -= 1; this.essayerCase(); d.cheminCaseX += 1;
}
```

Explorer tous les chemins serait trop long. Trois coupes limitent la recherche, dans `essayerCase` et `casePermise` :

1. on ne va pas plus loin que le nombre de cases restantes, puis, dès qu'un chemin est trouvé, que sa longueur : les chemins suivants doivent être au moins aussi courts ;
2. on abandonne si la cible est trop loin sur un axe pour les pas qui restent ;
3. une grille des profondeurs garde, pour chaque case, le plus petit nombre de pas avec lequel on l'a atteinte ; on n'y revient qu'avec moins de pas.

```js
if ((d.cheminProfondeur & 0xff) >= d.octet(adresseProfondeur)) return false;
```

Les directions du meilleur chemin sont recopiées dans une liste, et le héros joue un pas de cette liste à chaque passage de la boucle du tour (`pasAutomatique`).

## Ce qu'en faisait la machine de 1991

La grille des profondeurs occupe 512 octets. Plutôt que de lui réserver de la mémoire, le jeu l'écrit par-dessus le texte du briefing de la quête, qui ne sert plus une fois la partie commencée. Sur un PC de 640 Ko, réutiliser une zone devenue inutile était courant.

La recherche est récursive : chaque case essayée est un appel de plus, qui prend de la place sur la pile du processeur. La profondeur reste bornée par le nombre de cases du lancer, au plus 24 (un résultat plus grand est ramené à 5).

## Le bogue

Un pas joué à la flèche refuse une case occupée par un autre héros. Le pas automatique, lui, entre au milieu de la routine de pas et saute ce test, et la recherche de chemin ne regarde pas les autres héros non plus :

```js
// Le pas automatique saute le premier test de bord et le test des personnages : il peut
// traverser un autre héros.
if (!automatique) {
  if (sens.bordAvant(fiche)) return this.refuserPas();
  if (this.personnageEn((fiche.x + sens.dx) & 0xff, (fiche.y + sens.dy) & 0xff)) return this.refuserPas();
}
```

En cliquant une case derrière un autre héros, on passe à travers lui. Le clic refuse seulement une case d'arrivée occupée.

## Exercices

1. **Observer.** Dans l'inspecteur, survoler une case à côté d'une porte et lire ses quatre bords. Puis survoler la voisine de droite : le bord droit de la première est-il bien le bord gauche de la seconde ?

2. **Lire l'état.** Écrire `etat.json` avec la commande `essai.mjs` du [README](README.md). Écrire une fonction `peutAller(etat, x, y, direction)` qui dit si un pas est possible, en ne lisant que les champs de `plateau.cases` (bords, zone, occupant). La vérifier sur la case de départ du héros, comparée à la capture `plateau.png`.

3. **Programmer un parcours en largeur.** Avec `peutAller`, écrire un parcours en largeur (une file au lieu de la récursion) qui donne le nombre minimal de pas pour aller du héros à chaque case. Afficher la grille des distances en texte. Pourquoi le parcours en largeur trouve-t-il directement le plus court chemin, sans avoir besoin des coupes ?

4. **Modifier.** Dans une copie, changer l'ordre des 4 directions dans `essayerLesQuatreDirections`. Le héros prend-il un autre chemin, à longueur égale ? `node outils/lisible.mjs 40 chemin_heros` signale un écart : à quoi le voit-on ?

## Pour aller plus loin

- Les règles du déplacement et les cas particuliers des quêtes : [original/notes/03-regles.md](../original/notes/03-regles.md#déplacement).
- Le format des grilles : [docs/FORMATS.md](../docs/FORMATS.md#quêtes--questnbin).
- Les autres bogues du déplacement : [bogues-reecriture.md](../original/notes/bogues-reecriture.md#déplacement).
- « Parcours en largeur » et « parcours en profondeur » : les deux recherches de base dans un graphe.
