# Leçon 3 : le combat

## Ce qu'on va apprendre

Ranger beaucoup d'informations dans peu d'octets avec des champs de bits, lire des règles dans des tables plutôt que de les écrire dans le code, et calculer des probabilités pour comprendre l'équilibre d'un jeu.

## Ce que fait le jeu

Un héros attaque un monstre : il lance ses dés d'attaque et compte les crânes ; le monstre lance ses dés de défense et compte les boucliers noirs. Plus de crânes que de boucliers : le monstre meurt, car il n'a pas de points de corps. Quand un monstre attaque, c'est l'inverse : le monstre compte ses crânes, le héros compte comme boucliers toutes les faces sauf le bouclier blanc, et perd la différence en points de corps.

Dans l'inspecteur, pendant une attaque, le nombre de tirages du hasard augmente d'un par dé lancé, et la fiche du héros perd des points de corps quand il est touché.

## Le code

Les dés de chaque camp se calculent avant le lancer. Les dés de défense du héros, dans [combat.js](../web/jeu/lisible/combat.js) :

```js
calculerDefenseHeros() {
  const d = this.donnees;
  const fiche = d.ficheCourante;
  // ...
  let des = fiche.desDefense;
  if (fiche.porte('artefactsEnService', ARTEFACT.armureBorin)) des = 4;
  else if (fiche.porte('armures', ARMURE.armureDePlates)) des = 4;
  else if (fiche.porte('armures', ARMURE.cotteDeMailles)) des = 3;
  if (fiche.porte('armures', ARMURE.bouclier)) des += 1;
  if (fiche.porte('armures', ARMURE.casque)) des += 1;
  // ... potion de ténacité, sort peau de pierre : +2, consommés
  d.desDefenseHeros = des;
}
```

Les armures ne remplacent pas, elles posent un plancher : l'armure de plates donne 4 dés, et le bouclier et le casque s'ajoutent par-dessus.

### Les champs de bits

`fiche.armures` est un seul octet. Chaque bit dit si le héros porte une pièce d'armure ([donnees.js](../web/jeu/lisible/donnees.js)) :

```js
export const ARMURE = { bouclier: 0x01, casque: 0x02, cotteDeMailles: 0x04, armureDePlates: 0x08 };

export class Fiche extends Enregistrement {
  porte(champ, bit) { return (this[champ] & bit) !== 0; }
  retire(champ, bit) { this[champ] &= ~bit; }
}
```

- `armures & 0x02` vaut 0x02 si le bit du casque est posé, 0 sinon ;
- `armures &= ~0x02` efface ce bit et garde les autres (`~` inverse tous les bits) ;
- `armures |= 0x02` le pose.

Toute la fiche d'un héros tient en 26 octets : position, points, or, sorts connus, équipement, armures, potions, effets en cours. Les sorts, les potions et les artefacts sont aussi des champs de bits.

### Les règles dans des tables

Les dés d'un monstre ne sont pas écrits dans le code : ils sont lus dans une table de la mémoire du jeu, 5 octets par type de monstre (déplacement, attaque, défense, routine appelée à sa mort).

```js
calculerDesMonstre() {
  const d = this.donnees;
  const type = TABLES.typesMonstres + ((5 * d.cible.type) & 0xff);
  d.desAttaqueMonstre = d.octet(type + 1);
  d.desDefenseMonstre = d.octet(type + 2);
}
```

Un orc : 3 dés d'attaque, 2 de défense. Une gargouille : 4 et 4. Pour rééquilibrer un monstre, on change la table, pas le code.

### L'attaque

L'attaque du héros, simplifiée :

```js
d.cranes = this.compterCranes(d.desAttaqueHeros);
d.boucliers = this.compterBoucliersMonstre(d.desDefenseMonstre);
// ... affichage des dés
if (d.cranes > d.boucliers) d.cible.vivant = 0;
```

Et celle du monstre, côté héros :

```js
for (let n = 0; n < d.desDefenseHeros; n++) if (this.lancerDe() !== FACE.bouclierBlanc) boucliers++;
d.cranes = this.compterCranes(d.desAttaqueMonstre);
// ...
if (d.cranes > d.boucliers) {
  const blessures = d.cranes - d.boucliers;
  heros.pointsCorps = blessures >= heros.pointsCorps ? 0 : heros.pointsCorps - blessures;
}
```

### Ce que ça donne

Avec les fréquences des faces vues à la leçon 1 (crâne 128/256, bouclier blanc 85/256, bouclier noir 43/256) :

| Situation | Résultat |
| --- | --- |
| Barbare (3 dés) contre orc (2 dés de défense) | l'orc meurt 3 fois sur 4 (74,9 %) |
| Enchanteur (1 dé) contre orc | 34,6 % |
| Barbare contre gargouille (4 dés de défense) | 62,7 % |
| Orc (3 dés) contre un héros à 2 dés de défense | le héros est touché 37,4 % du temps, 0,5 point perdu en moyenne |

Les monstres se défendent mal : un bouclier noir sur six faces. Les héros se défendent bien : quatre faces sur six. Si le héros ne comptait que les boucliers blancs (deux faces sur six), l'orc le toucherait 62,6 % du temps au lieu de 37,4 %. Le jeu PC est donc plus clément que le jeu de plateau dont il s'inspire.

## Ce qu'en faisait la machine de 1991

Les sauvegardes tiennent 32 personnages dans `QUEST.SAV`, 1 376 octets : 17 octets pour chaque nom, 26 pour chaque fiche. Avec des disquettes de 720 Ko et des PC à 640 Ko de mémoire, un octet par information « oui ou non » aurait été un gaspillage : huit tiennent dans un octet.

Les opérations sur les bits (`and`, `or`, `not`, `test`) sont aussi parmi les plus rapides du 8086, bien plus qu'une multiplication. Le code de 1991 calcule beaucoup sur des octets, même quand le résultat pourrait dépasser 255 : `5 × type` tient sur un octet jusqu'au type 51, et le code lisible garde ce calcul (`& 0xff`) pour rester fidèle.

## Le bogue

Les boucliers du monstre sont comptés par une boucle dont le compteur est un mot de 16 bits, retiré de 1 avant d'être testé :

```js
// Boucliers noirs du monstre. Le compteur de dés est un mot décrémenté avant le test (loop) :
// 0 dé en lance 65 536.
compterBoucliersMonstre(des) {
  let boucliers = 0;
  for (let n = 0; n < (des || 0x10000); n++) if (this.lancerDe() === FACE.bouclierNoir) boucliers++;
  return boucliers & 0xff;
}
```

Un monstre sans dé de défense en lancerait 65 536. Le nombre de boucliers est ensuite gardé sur un octet (`& 0xff`) : environ 11 000 boucliers deviennent un nombre entre 0 et 255, à peu près au hasard. Les types de monstres décrits dans les notes ont tous au moins un dé de défense, si bien que le cas ne devrait pas se présenter en partie ; le code lisible le reproduit quand même.

## Exercices

1. **Observer.** Attaquer un orc avec le barbare. Noter, dans la partie « Hasard » de l'inspecteur, le nombre de tirages avant et après l'attaque, et le comparer aux 3 dés d'attaque et 2 de défense. S'il y en a plus, chercher dans le code de [combat.js](../web/jeu/lisible/combat.js) et dans la pile d'appels qui d'autre tire au hasard pendant une attaque.

2. **Calculer.** Écrire une fonction `probabiliteDeTuer(desAttaque, desDefense)` qui simule un million de combats avec `Math.random()` (crâne : probabilité 1/2, bouclier noir : 1/6) et rend la proportion de monstres tués. Retrouver les chiffres du tableau ci-dessus. Puis la refaire en calcul exact, avec la loi binomiale.

3. **Modifier.** Dans une copie, faire que le casque ne compte plus dans `calculerDefenseHeros`. `node outils/lisible.mjs 40 calcule_defense_heros` doit signaler un écart. Que faut-il tirer au hasard dans les fiches pour que l'écart apparaisse ? (Indice : lire comment `lisible.mjs` prépare les fiches.)

4. **Aller plus loin.** Avec le calcul de l'exercice 2, chercher combien de dés de défense il faudrait donner à un orc pour que le barbare ne le tue plus qu'une fois sur deux.

## Pour aller plus loin

- Les règles complètes du combat et la table des monstres : [original/notes/03-regles.md](../original/notes/03-regles.md#monstres).
- Le format de la fiche d'un personnage : même fichier, section « Fiche d'un personnage ».
- Les opérateurs binaires sur MDN : `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`.
