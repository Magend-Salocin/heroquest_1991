# Leçon 7 : la fouille et la pioche des trésors

## Ce qu'on va apprendre

Représenter un paquet de cartes par un tableau terminé par une sentinelle, tirer le dessus et remettre dessous (une file), choisir une action selon des plages de valeurs, et finir une fonction en « passant la main » à une autre (appel terminal).

## Ce que fait le jeu

Le héros clique l'icône de fouille du trésor. S'il reste un monstre actif dans la pièce, rien ne se passe. Sinon, selon la pièce : un événement prévu par la quête, « CETTE PIECE A DEJA ETE FOUILLEE », ou une carte trésor tirée d'une pioche de 25 cartes : de l'or, une potion, rien, un piège à arbalète, ou un monstre errant qui attaque aussitôt.

Dans l'inspecteur, une carte 8 (« vous perdez la notion du temps ») tire un dé : le nombre de tirages augmente d'un.

## Le code

Le module est [web/jeu/lisible/fouilles.js](../web/jeu/lisible/fouilles.js).

### La pioche : un tableau et une sentinelle

La pioche est une suite d'octets en mémoire : les numéros des cartes, puis `FFh`. Aucune carte ne vaut `FFh` : cette valeur marque la fin. C'est une **sentinelle**, comme le zéro final d'une chaîne de caractères en C. On n'a pas besoin de ranger la longueur à part.

Tirer la carte du dessus, c'est la lire, puis faire remonter toutes les suivantes d'un cran :

```js
tirerCarte() {
  const d = this.donnees;
  const carte = d.octet(PIOCHE);
  let place = PIOCHE;
  let lue = PIOCHE + 1;
  let reste = TAILLE_PIOCHE;
  for (;;) {
    const suivante = d.octet(lue++);
    d.ecrireOctet(place, suivante);
    if (suivante === FIN_PIOCHE) break;
    place++;
    if (--reste === 0) { d.ecrireOctet(place, FIN_PIOCHE); break; }
  }
  d.carteTresor = place;
  return { carte, place, lue, reste };
}
```

La boucle s'arrête sur la sentinelle, ou après 25 cartes au plus, au cas où elle manquerait. `carteTresor` garde l'adresse de la fin : c'est là qu'une carte remise ira.

```js
remettreCarte(carte) {
  const d = this.donnees;
  const place = d.carteTresor;
  d.ecrireOctet(place, carte);
  d.ecrireOctet(place + 1, FIN_PIOCHE);
  d.carteTresor = (place + 1) & 0xffff;
  return d.carteTresor;
}
```

On tire au début, on remet à la fin : c'est une **file** (premier entré, premier sorti). Les cartes d'or, d'arbalète et de monstre errant sont remises ; les potions et la carte « rien » sortent du jeu jusqu'à la quête suivante. La pioche s'appauvrit donc en potions au fil des fouilles.

### Des plages de valeurs

Le numéro de la carte dit ce qu'elle fait, par plages :

```js
const { carte } = this.tirerCarte();
if (carte < CARTE.premierePotion) return yield* this.carteOr(fiche, carte);      // 0 à 8
if (carte < CARTE.heroique) return this.cartePotion(fiche, carte);               // 9 à 13
if (carte < CARTE.rien) return this.carteHeroiqueOuEauBenite(fiche, carte);      // 14, 15
// ... 16 : rien ; 17 à 19 : arbalète ; 20 à 24 : monstre errant
```

À l'intérieur d'une plage, le rang de la carte indexe une table : l'or de chaque carte, la potion de chaque carte, le message de chaque carte (`MESSAGE.premierOr + 2 × carte`). Les cartes d'une même sorte partagent ainsi le même code.

### Finir en passant la main

Beaucoup de cartes se terminent par un message :

```js
return this.sauter(QUEST.affiche_message, { bx: MESSAGE.premierOr + 2 * carte });
```

Le code d'origine ne fait pas « appeler l'affichage, puis revenir, puis revenir encore » : il **saute** à la routine du message, qui reviendra directement chez celui qui avait lancé la fouille. C'est un appel terminal, qui économise un retour et un peu de pile. `sauter` le reproduit (leçon 2).

### Recommencer : le monstre errant

Un monstre errant cherche la première case libre à côté du héros (en haut, à droite, en bas, à gauche). S'il n'y en a pas, la pièce redevient fouillable, et tout recommence : nouvelle vérification des monstres, nouvelle carte. C'est le `for (;;)` de `fouillerTresor`. La boucle finit toujours, parce que la pioche contient toujours des cartes d'or, qui sont remises dessous.

## Ce qu'en faisait la machine de 1991

Faire remonter 25 octets à chaque tirage coûte une petite boucle, mais le 8086 a des instructions faites pour ça (`lodsb` lit un octet et avance, `loop` décompte). Un pointeur de début qui avance, sans rien recopier, aurait été plus rapide, mais aurait demandé de gérer le retour au début du tableau (une file circulaire). Avec 25 cartes, la simplicité l'emporte.

La sentinelle `FFh` évite aussi de garder une longueur à jour : moins de variables, moins d'oublis possibles.

## Le bogue

Avant de fouiller, le jeu vérifie qu'aucun monstre actif n'est dans la pièce (`monstreActifCase`). La grille des occupants donne le numéro du monstre sur la case, de 1 à 32. La routine qui donne l'adresse d'un monstre attend ce numéro et lui retire 1 elle-même. Mais l'appelant le retire aussi :

```js
yield* this.appeler(QUEST.adresse_monstre, { al: occupant - 1 });
if (d.octet(this.machine.bx + 6) & 0xfe) d.monstreDansZone = 1;
```

C'est donc l'état du monstre précédent qui est regardé. Un monstre réveillé peut laisser fouiller, et un monstre endormi l'empêcher, selon son voisin dans la liste. Pour le monstre 1, le jeu lit même un octet en dehors de la table des monstres. Ce bogue est décrit dans [03-regles.md](../original/notes/03-regles.md#plateau-en-mémoire), et le code lisible le garde.

## Exercices

1. **Observer.** Fouiller plusieurs pièces d'une même quête et noter les cartes obtenues. Les potions reviennent-elles ? Pourquoi ?

2. **Écrire la pioche.** Écrire une classe `Pioche` avec un tableau JavaScript ordinaire : `tirer()` (`shift`), `remettre(carte)` (`push`), et un mélange de Fisher-Yates. Tirer 1 000 cartes en remettant celles qui doivent l'être : combien de potions sort-on en moyenne avant qu'il n'en reste plus ?

3. **Sans recopier.** Réécrire `tirerCarte` avec un indice de début qui avance, sans faire remonter les cartes : une file circulaire de 26 places. Que faut-il changer dans `remettreCarte` ?

4. **Modifier, dans une copie.** Faire que la carte « rien » (16) soit remise sous la pioche. `node outils/lisible.mjs 300 fouille_tresor` doit signaler un écart : sur quelle adresse de la mémoire ?

## Pour aller plus loin

- La liste des cartes et les événements scriptés : [original/notes/03-regles.md](../original/notes/03-regles.md#fouilles).
- La leçon 6 pour les potions, la leçon 3 pour le combat qui suit le monstre errant.
- « Sentinel value », « queue » et « tail call » : les trois notions de cette leçon, sous leur nom anglais.
