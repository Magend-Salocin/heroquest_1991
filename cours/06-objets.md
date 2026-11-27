# Leçon 6 : les objets et l'inventaire

## Ce qu'on va apprendre

Passer d'un champ de bits à une liste et inversement, piloter un comportement par une table (« quel champ, quelle valeur »), écrire des règles d'exclusion (une seule arme en main, une seule armure de corps), et voir ce qui arrive quand deux morceaux de code partagent sans le savoir la même variable.

## Ce que fait le jeu

Pendant son tour, un héros ouvre l'inventaire (l'icône du sac). Trois cartes : armes et armures, potions, artefacts. Chaque page montre jusqu'à 12 objets ; ceux qui sont en service ont un cadre. Un clic sur un objet le prend, le pose, ou le boit.

L'inspecteur ne montre pas encore les objets. Pour les voir changer, ouvrir la page avec `?sans-intro&debug` et taper dans la console du navigateur, pour le premier héros :

```js
const m = jeu.machine();
const fiche = 0x4663;                                   // première fiche
m.rb(m.ds, fiche + 0x13).toString(2).padStart(8, '0'); // armures portées, un bit par pièce
```

Mettre le casque, retaper la ligne : un bit a changé.

## Le code

Le module est [web/jeu/lisible/inventaire.js](../web/jeu/lisible/inventaire.js).

### Des bits à la liste

La fiche range les potions possédées dans un octet, un bit par potion. Pour afficher la page, il faut une liste : « la case 1 montre la potion n°2, la case 2 la n°5… ». `listerBits` fait la conversion :

```js
listerBits(bits, nombre, numero, place) {
  const d = this.donnees;
  let n = nombre;
  do {
    if (bits & 1) { d.ecrireMot(place, numero); place = (place + 2) & 0xffff; }
    bits >>= 1;
    numero = (numero + 2) & 0xffff;
    n = (n - 1) & 0xffff;
  } while (n !== 0);
  return { place, numero, bits };
}
```

On regarde le bit le plus faible (`bits & 1`), puis on décale (`bits >>= 1`) pour amener le suivant. Le numéro d'objet avance à chaque bit, qu'il soit posé ou non : le bit 3 des potions est toujours la même potion. Les objets en service reçoivent ensuite le bit 0x80 dans la liste (`marquerEnService`), ce qui dessinera le cadre.

### Une table plutôt qu'une cascade de `if`

Au clic, le jeu ne teste pas « est-ce le casque ? est-ce la hache ? ». Une table de 36 entrées, `objets_champs`, donne pour chaque objet deux octets : le champ de la fiche qu'il modifie et sa valeur dans ce champ.

| Objets | Champ | Valeur |
| --- | --- | --- |
| potions (0 à 6) | +0x17, potions en cours | un bit : 1, 2, 4… 0x40 |
| artefacts (7 à 11) | +0x12, artefacts en service | un bit |
| armes (12 à 19) | +0x11, arme en main | un bit |
| armures (20 à 23) | +0x13, armures portées | un bit |
| sorts (24 à 35) | +0x16, sort choisi | le numéro du sort, 1 à 12 |

Le code n'a plus qu'à choisir la règle selon le champ :

```js
switch (champ) {
  case CHAMP.potionsActives: return yield* this.boirePotion(fiche, valeur);
  case CHAMP.armeEnMain: return yield* this.choisirArme(fiche, valeur);
  case CHAMP.armures: return yield* this.choisirArmure(fiche, valeur);
  case CHAMP.artefactsEnService: return this.choisirArtefact(fiche, valeur);
  case CHAMP.sortChoisi: /* ... */
}
```

Ajouter une armure ne demande qu'une ligne dans la table et un bit dans la fiche : la règle « une armure se porte ou s'enlève » est déjà écrite.

### Les règles d'exclusion

Les armures, simplifiées :

```js
if (fiche.armures & valeur) {
  fiche.armures ^= valeur;                       // portée : on l'enlève
} else if (valeur & (ARMURE.armureDePlates | ARMURE.cotteDeMailles)) {
  fiche.armures = (fiche.armures & (ARMURE.bouclier | ARMURE.casque)) | valeur;
  // ... et l'armure de Borin est retirée
} else if ((valeur & ARMURE.bouclier) && (fiche.armeEnMain & HACHE_ARMES)) {
  return yield* this.refuser(MESSAGE.bouclierEtHache);
} else {
  fiche.armures |= valeur;                       // on la met
}
```

La ligne du milieu est le cœur de l'exclusion : on garde le bouclier et le casque (`& (bouclier | casque)`), on efface tout le reste, et on pose la nouvelle armure de corps (`| valeur`). La cotte de mailles et l'armure de plates ne peuvent donc jamais être portées ensemble, sans aucun test.

Pour les armes, `armeEnMain` ne garde qu'un bit à la fois : prendre une arme, c'est écrire sa valeur à la place de l'ancienne. Recliquer l'arme en main la lâche.

## Ce qu'en faisait la machine de 1991

Le 8086 a peu de registres (AX, BX, CX, DX, SI, DI, BP), et ils sont partagés par tout le programme. Par convention, CX sert de compteur de boucle : l'instruction `loop` le décrémente et reboucle tant qu'il n'est pas nul. Chaque routine doit sauvegarder (`push`) les registres qu'elle abîme, ou l'appelant doit savoir qu'ils seront abîmés. Rien ne le vérifie : c'est une discipline.

En JavaScript, chaque fonction a ses propres variables locales : le problème qui suit ne peut pas arriver par accident. Le code lisible doit pourtant le reproduire, et il le fait en rendant explicitement le compteur de l'une à l'autre.

## Le bogue

`marquerEnService` parcourt les bits des objets en service et, pour chacun, appelle `marquerObjet`, qui cherche l'objet dans la liste. Les deux routines d'origine comptent leurs tours dans le même registre, CX, et `marque_objet` ne le sauvegarde pas :

```js
if (marque) ({ place, reste: n } = this.marquerObjet(numero));
```

Ici, `n` est le compteur de la boucle extérieure, et il reçoit le compteur de la recherche. Si l'objet était à la dernière place de la liste, il ne reste plus qu'un tour : les objets en service des bits suivants ne sont pas marqués et n'auront pas de cadre. Si l'objet n'était pas dans la liste, le compteur vaut 0, et `loop` le fait passer à 65 535 : la boucle tourne pour rien pendant 65 535 tours.

Deux autres comportements, relevés dans [bogues-reecriture.md](../original/notes/bogues-reecriture.md#inventaire) :

- la potion héroïque inverse le bit « action faite » (`^=`) au lieu de l'effacer : bue avant d'avoir agi, elle marque l'action comme faite ;
- l'eau bénite ne regarde que les 30 premières cases vues de la pièce, et écrit le nombre de morts avec un seul chiffre.

## Exercices

1. **Observer.** Avec la commande de la console ci-dessus, regarder `+0x13` en mettant la cotte de mailles, puis l'armure de plates. Combien de bits sont posés après chaque clic ? Faire de même avec `+0x11` en changeant d'arme.

2. **Écrire la conversion inverse.** Écrire `versBits(liste)` qui, à partir d'une liste de numéros de potions (`[1, 4]`), rend l'octet correspondant (`0b00010010`). Puis `versListe(octet)`, l'inverse. Vérifier que `versBits(versListe(x)) === x` pour les 256 valeurs de `x`.

3. **Modifier une règle.** Dans une copie, permettre le bouclier avec la hache d'armes (retirer le refus dans `choisirArmure`, et le retrait du bouclier dans `choisirArme`). `node outils/lisible.mjs 200 utilise_objet` doit signaler un écart : sur quel octet ?

4. **Corriger le bogue, dans une copie seulement.** Faire que `marquerEnService` garde son propre compteur. Construire à la main une fiche où le bogue se voit (un objet en service en dernière place de la liste, et un autre après lui) : combien d'objets ont un cadre avant et après la correction ?

## Pour aller plus loin

- Les 36 objets et leurs règles : [original/notes/03-regles.md](../original/notes/03-regles.md#objets).
- L'écran de l'inventaire : [original/notes/02-ecrans.md](../original/notes/02-ecrans.md#inventaire).
- La leçon 3 pour les champs de bits de la fiche.
