# Leçon 8 : portes secrètes et pièges

## Ce qu'on va apprendre

Parcourir les voisines d'une case dans une grille, comprendre pourquoi l'ordre d'une pile (dernier entré, premier sorti) compte, et voir ce que coûte une variable « empruntée » à une autre partie du programme.

## Ce que fait le jeu

L'autre icône de fouille cherche les portes secrètes et les pièges de la pièce. Une porte trouvée s'ouvre (« UNE PORTE SECRETE S'OUVRE EN GRINÇANT DANS LE MUR ») et révèle la pièce d'à côté. Une fosse cachée devient visible, une lance cachée est désarmée. Si rien n'est trouvé, « MALGRE UNE RECHERCHE MINUTIEUSE VOUS NE DECOUVREZ RIEN ».

Dans l'inspecteur, la grille des murs montre les portes secrètes pas encore trouvées en violet. Après une fouille réussie, la porte passe à l'orange (fermée) ou au vert (ouverte).

## Le code

Toujours [web/jeu/lisible/fouilles.js](../web/jeu/lisible/fouilles.js).

### Fouiller une pièce, case par case

`chercherPortesEtPieges` passe sur les cases vues de la pièce et appelle `fouillerCase` pour chacune. Une case ne range que ses bords gauche et haut (leçon 4). Pour trouver toutes les portes, la fouille d'une case regarde donc trois bords : le sien, le bord gauche de la voisine de droite (son propre bord droit), et le bord haut de la voisine du dessous (son bord bas).

```js
for (const [voisine, bitPorte] of [[murs + 1, BIT_PORTE.gauche], [murs + LARGEUR, BIT_PORTE.haut]]) {
  const octet = d.octet(voisine);
  const fermee = (octet & BIT_PORTE.secrete) && (octet & bitPorte) && !(octet & BIT_PORTE.revelee);
  if (!fermee) continue;
  yield* this.appeler(QUEST.ouvre_porte_secrete, { bx: voisine });
  yield* this.appeler(QUEST.marque_zone_vue, { al: d.octet(voisine - 0x200), bx: voisine });
}
```

Une porte secrète est une porte (bit de porte gauche ou haute) avec le bit « secrète » (0x08). La trouver pose le bit « révélée » (0x04). On ne la retrouve pas deux fois.

### Les pièges

Sur la case elle-même, la grille des occupants dit s'il y a un piège :

```js
const code = d.octet(occupant);
if (code === PIEGE.fosseCachee || code === PIEGE.lance) {
  if (code === PIEGE.fosseCachee) d.ecrireOctet(occupant, code + 1); else d.ecrireOctet(occupant, 0);
  // ... message, plateau redessiné
}
```

La fosse cachée (0x32) devient la fosse connue (0x33) : le héros sait où elle est, mais elle est toujours là. La lance (0x36) disparaît (0).

## Ce qu'en faisait la machine de 1991

Le 8086 a peu de registres. Pour garder une valeur pendant l'appel d'une autre routine, on la pose sur la pile (`push`) et on la reprend ensuite (`pop`). La pile rend les valeurs dans l'ordre inverse : si l'on empile A puis B, il faut dépiler B, puis A.

Le jeu manque aussi de mémoire. Plutôt que de créer de nouvelles variables, il en emprunte : la fouille note « porte trouvée » et « piège trouvé » dans deux variables qui servent d'habitude à dessiner la carte du parchemin (`ligne_carte` et `position_tuile_carte`). Ça marche, à condition de bien les remettre à zéro.

## Le bogue

Les deux règles précédentes sont enfreintes, chacune une fois.

**L'ordre de la pile.** Quand la porte secrète est sur le bord de la case elle-même, le code d'origine empile l'adresse de la case (BX), puis le pas vers la voisine (CX), appelle `marque_zone_vue`, puis dépile… BX d'abord, puis CX. Les deux valeurs sont échangées. Le calcul suivant, qui devait retrouver la case, donne une adresse sans rapport :

```js
// Bogue de l'original : BX et CX sont empilés puis dépilés dans le désordre ; BX reçoit le
// pas (1 ou 26) et le calcul « BX - CX » donne pas - adresse.
occupant = (pas - murs + 0x200) & 0xffff;
```

Conséquence : le piège de cette case n'est pas cherché sur la case, mais à une adresse entre DS:A9A5 et DS:ABAB selon la case, au milieu des variables des boîtes de message et des écrans. Si l'octet qui s'y trouve vaut par hasard 0x32 ou 0x36, le jeu le modifie. Le code lisible fait le même calcul, avec les mêmes conséquences.

**La variable empruntée.** « Piège trouvé » (`position_tuile_carte`) n'est jamais remis à 0 avant la fouille. S'il vaut encore 1 depuis une fouille précédente, et que le dessin de la carte ne l'a pas changé entre-temps, une fouille qui ne trouve rien sort sans message et sans marquer la pièce.

Les deux sont décrits dans [bogues-reecriture.md](../original/notes/bogues-reecriture.md#fouilles).

## Exercices

1. **Observer.** Dans l'inspecteur, repérer une porte secrète (violet) au bord d'une pièce, puis fouiller depuis la pièce dont la case porte ce bord, et depuis l'autre. La porte est-elle trouvée dans les deux cas ? Le piège éventuel de la case aussi ?

2. **Écrire les voisines.** Écrire `bords(x, y)` qui rend les quatre bords d'une case sous la forme `[{ case, bit }]`, en ne lisant que les bords gauche et haut de chaque case (la case elle-même, sa voisine de droite, sa voisine du dessous). Vérifier sur `etat.json` (leçon 4) que l'on retrouve les mêmes murs que les champs `droite` et `bas` de `etat.js`.

3. **La pile.** Simuler la pile avec un tableau : `push(a)`, `push(b)`, puis deux `pop()`. Dans quel ordre sortent-elles ? Écrire la version correcte du passage du bogue, puis expliquer pourquoi `lisible.mjs` signalerait un écart si on la mettait dans `fouillerCase`.

4. **Aller plus loin.** Chercher dans [bogues-reecriture.md](../original/notes/bogues-reecriture.md) un autre bogue dû à un registre partagé ou réutilisé (indice : leçon 6).

## Pour aller plus loin

- Les règles des portes secrètes et des pièges : [original/notes/03-regles.md](../original/notes/03-regles.md#portes-secrètes-et-pièges) et [Pièges](../original/notes/03-regles.md#pièges).
- Les leçons 4 (murs sans doublon), 6 (registres partagés) et 7 (fouille du trésor).
