# Leçon 1 : le hasard et les dés

## Ce qu'on va apprendre

Un ordinateur ne sait pas tirer au hasard : il calcule une suite de nombres qui en a l'air, à partir d'une valeur de départ, la graine. On va lire le générateur du jeu, voir pourquoi la même graine redonne exactement les mêmes dés, et mesurer un petit défaut qui vient d'un modulo.

## Ce que fait le jeu

Chaque lancer de dés du jeu (déplacement, combat, réveil, pièges, trésors) appelle la même fonction, qui rend un nombre de 1 à `max`.

Pour le voir, ouvrir `?sans-intro&inspecteur`, choisir un héros, lancer la 1re quête et regarder la partie « Hasard » de l'inspecteur :

- au moment de lancer les dés de déplacement, le nombre de tirages grimpe sans arrêt : pendant que les dés tournent à l'écran, le jeu tire de nouveaux dés à chaque image ; ce sont ceux de l'image où l'on clique qui comptent ;
- le registre (8 chiffres hexadécimaux) change à chaque tirage ;
- « 1 à 6 → 3 » : le dernier tirage demandait un nombre de 1 à 6 et a donné 3.

La graine est posée une seule fois, au lancement de `QUEST.EXE`, à partir de l'heure de l'horloge du PC.

## Le code

Le générateur est dans [web/jeu/lisible/hasard.js](../web/jeu/lisible/hasard.js). Son état tient en 4 octets de la mémoire du jeu, à partir de l'adresse `DS:38FD` : un nombre de 32 bits.

```js
// Nombre de 1 à max (max de 1 à 255).
tirer(max) {
  this.decaler();
  const resultat = (this.donnees.octet(GRAINE) % max) + 1;
  return resultat;
}
```

(L'extrait omet les lignes qui préviennent l'inspecteur.) Un tirage fait deux choses : faire avancer l'état d'un pas (`decaler`), puis en tirer un nombre de 1 à `max` avec un modulo sur l'octet du haut.

```js
decaler() {
  const d = this.donnees;
  const a = d.octet(GRAINE);
  const bitEntrant = ((a >> 3) ^ (a >> 6)) & 1;
  const valeur = ((this.graine() << 1) | bitEntrant) >>> 0;
  d.ecrireOctet(GRAINE, valeur >>> 24);
  // ... puis les 3 autres octets
}
```

C'est un registre à décalage à rétroaction linéaire (en anglais LFSR) :

1. `(a >> 3) ^ (a >> 6)` : on prend les bits 3 et 6 de l'octet du haut et on les combine par un OU exclusif (`^` : 1 si les deux bits diffèrent) ; `& 1` garde le dernier bit ;
2. `<< 1` décale les 32 bits d'un cran vers la gauche : le bit du haut sort, un 0 entre en bas ;
3. `| bitEntrant` remplace ce 0 par le bit calculé ;
4. `>>> 0` ramène le résultat à un entier non signé de 32 bits (en JavaScript, `<<` produit un entier signé).

Le dé de combat ([combat.js](../web/jeu/lisible/combat.js)) tire une face de 0 à 5, puis lit ce qu'elle porte dans une table de 6 octets de la mémoire du jeu : crâne, bouclier blanc, bouclier noir, crâne, bouclier blanc, crâne.

```js
export const FACE = { crane: 0, bouclierBlanc: 1, bouclierNoir: 2 };

lancerDe() {
  return this.donnees.octet(TABLES.facesDe + this.jeu.hasard.de6());
}
```

Trois crânes, deux boucliers blancs, un bouclier noir : la répartition du dé du jeu de plateau. Changer cette table changerait le dé sans toucher au code.

### Même graine, mêmes dés

Rien dans `tirer` ne dépend d'autre chose que des 4 octets de l'état. Deux parties qui partent de la même graine, avec les mêmes clics aux mêmes moments, donnent donc les mêmes dés. C'est ce qui permet à `outils/essai.mjs` de rejouer une partie à l'identique : il fixe l'horloge du PC émulé.

```js
m.horloge = () => new Date(2026, 9, 27, 12, 0, 0, 0);    // même graine à chaque essai
```

### Combien de nombres avant de boucler ?

L'état a 32 bits, mais le bit qui sort à gauche ne sert jamais au calcul : tout se passe sur 31 bits, avec les bits 30 et 27 comme « prises ». Cette combinaison est choisie pour que le registre passe par tous les états non nuls de 31 bits avant de revenir au départ : 2³¹ − 1 = 2 147 483 647 tirages. On peut le vérifier en 10 secondes avec Node (exercice 3).

Un seul état ne marche pas : zéro. Tous les bits à 0 donnent un bit entrant à 0, et le registre reste à 0 pour toujours.

### Un dé presque équilibré

L'octet du haut prend 256 valeurs, et 256 n'est pas un multiple de 6 : 256 = 6 × 42 + 4. Avec `% 6`, les restes 0 à 3 sortent 43 fois sur 256, les restes 4 et 5 seulement 42 fois. Les faces 1 à 4 du dé de déplacement sont donc un peu plus fréquentes que 5 et 6 : 16,8 % contre 16,4 %, au lieu de 16,7 % pour chacune.

Pour le dé de combat, le hasard fait bien les choses : les crânes sont sur les faces 0, 3 et 5, soit 43 + 43 + 42 = 128 chances sur 256, exactement une sur deux.

## Ce qu'en faisait la machine de 1991

Le processeur 8086 travaille sur des registres de 16 bits. Un nombre de 32 bits ne tient pas dans un registre : le code d'origine décale les 4 octets un par un, en faisant passer le bit qui sort d'un octet dans le suivant par la retenue du processeur. En JavaScript, on assemble les 4 octets en un nombre, on le décale, puis on le redécoupe.

Pour combiner deux bits d'un même octet par OU exclusif, il faudrait d'abord les aligner par des décalages, et le 8086 ne décale que d'un cran à la fois (ou d'un nombre de crans rangé dans un registre). Le code d'origine prend un raccourci : il garde les bits 3 et 6 de l'octet, puis ajoute une constante qui met à 1 les bits 3, 4 et 5. Si le bit 3 valait 1, la retenue remonte jusqu'au bit 6 et l'inverse : le bit 6 devient le OU exclusif des deux. Deux rotations le font ensuite sortir dans la retenue du processeur, d'où il entre dans le registre. C'est typique de l'époque : chaque instruction compte.

Enfin, l'horloge comme graine est la solution simple de l'époque : il n'y a pas de source de hasard dans le PC. Le centième de seconde suffit pour que deux parties ne commencent pas pareil.

## Le bogue

Le dé de combat est appelé par une boucle qui compte les crânes (`compterCranes`, dans [combat.js](../web/jeu/lisible/combat.js)). Dans l'original, le nombre de dés est rangé dans un octet, et la boucle retire 1 au compteur avant de tester s'il vaut 0. Avec 0 dé, le compteur passe de 0 à 255 (un octet ne peut pas être négatif : il « fait le tour »), et la boucle lance 256 dés au lieu d'aucun.

```js
// Le compteur de dés est un octet décrémenté avant le test : 0 dé en lance 256.
compterCranes(des) {
  let cranes = 0;
  for (let n = 0; n < (des || 256); n++) if (this.lancerDe() === FACE.crane) cranes++;
  return cranes & 0xff;
}
```

Le code lisible garde ce comportement : il doit faire exactement ce que fait l'original (voir [bogues-reecriture.md](../original/notes/bogues-reecriture.md)). Un monstre qui attaquerait avec 0 dé lancerait donc 256 dés, avec environ 128 crânes.

## Exercices

1. **Observer.** Dans l'inspecteur, noter le nombre de tirages, lancer les dés de déplacement et attendre quelques secondes avant de cliquer. Combien de tirages pendant que les dés tournent ? Pourquoi l'instant du clic est-il, au fond, la vraie source de hasard du jeu ?

2. **Refaire un tirage à la main.** Recopier dans un fichier `tirage.mjs` la fonction suivante, puis l'appeler avec le « registre avant » et le `max` du dernier tirage montrés par l'inspecteur. Elle doit redonner le « registre après » et le résultat.

   ```js
   function tirer(registre, max) {
     const a = registre >>> 24;
     const bitEntrant = ((a >> 3) ^ (a >> 6)) & 1;
     const apres = ((registre << 1) | bitEntrant) >>> 0;
     return { apres: apres.toString(16), resultat: ((apres >>> 24) % max) + 1 };
   }
   console.log(tirer(0x3a59342b, 6));
   ```

3. **Mesurer.** Avec la même fonction, tirer un million de dés à 6 faces et compter chaque face. Retrouve-t-on 43/256 pour les faces 1 à 4 et 42/256 pour 5 et 6 ? Ensuite, compter les tirages jusqu'au retour à l'état de départ (une dizaine de secondes) : on doit trouver 2 147 483 647.

4. **Rejouer.** Lancer deux fois la commande `essai.mjs` du [README](README.md) avec `ETAT=etat1.json` puis `ETAT=etat2.json` : les deux fichiers sont identiques, champ `graine` (le registre du hasard) compris. Changer l'heure de `m.horloge` dans [outils/essai.mjs](../outils/essai.mjs) et recommencer : le champ `graine` change, et avec lui tous les dés de la partie.

5. **Truquer le dé.** Dans une copie, modifier `lancerDe` pour qu'il rende toujours `FACE.crane`, puis jouer une attaque. `node outils/lisible.mjs 40 de_combat` signale alors un écart avec l'original : c'est normal, et c'est exactement ce que ce contrôle est fait pour voir.

## Pour aller plus loin

- La description du générateur et des dés dans [docs/FORMATS.md](../docs/FORMATS.md#hasard).
- Les règles du combat : [original/notes/03-regles.md](../original/notes/03-regles.md#attaque-du-héros).
- « Linear-feedback shift register » sur Wikipédia (en anglais) : la théorie des prises et des polynômes primitifs, qui explique la période de 2³¹ − 1.
- `Math.floor(Math.random() * 6)` en JavaScript : un nombre à virgule multiplié puis arrondi, au lieu d'un reste. Son biais existe aussi, mais il est des milliards de fois plus petit, parce que le nombre de départ a 52 bits au lieu de 8.
