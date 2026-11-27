# Leçon 5 : le tour de jeu

## Ce qu'on va apprendre

La boucle de jeu : lire les entrées, mettre à jour, dessiner, recommencer. Le dessin dans un tampon hors de l'écran. Et une interface pilotée par une table de zones cliquables, avec la routine à appeler rangée dans la table.

## Ce que fait le jeu

Une partie répète : le tour de chacun des héros, dans l'ordre des fiches, puis celui de Morcar, qui fait jouer les monstres. Le tour d'un héros commence par le lancer des dés de déplacement, puis le joueur bouge, attaque, fouille ou lance un sort, jusqu'à l'icône de fin de tour ou au bouton droit.

Dans l'inspecteur, la ligne du héros qui joue est en jaune. Pendant son tour, la routine en cours change sans arrêt : c'est la boucle qui tourne, une fois par image.

## Le code

### Le début du tour

[tour.js](../web/jeu/lisible/tour.js), simplifié :

```js
*tourPersonnage(numero, adresseFiche, adresseSprite, commandeType) {
  // ... remise à zéro de l'état du tour
  if (d.ficheCourante.present === 0) return;           // fiche vide : pas de tour
  // ... panneau, portrait, vue du plateau
  if (fiche.porte('effetsSorts', EFFET_SORT.tempete)) {
    fiche.retire('effetsSorts', EFFET_SORT.tempete);
    if (!fiche.porte('effetsSorts', EFFET_SORT.endormi)) return;   // la tempête fait passer ce tour
  }
  if (fiche.porte('effetsSorts', EFFET_SORT.endormi)) {
    const reveille = yield* this.tenterReveil();
    if (!reveille) return;
  }
  yield* this.appeler(QUEST.tirage_deplacement);
  // ...
  for (;;) {
    yield* this.passageDeLaBoucle();
    if (d.finDuTour !== 0) return;
    // ...
  }
}
```

Les cas particuliers (fiche vide, tempête, sommeil) sont réglés tôt, chacun par un `return` : le reste de la méthode n'a plus à s'en soucier.

### La boucle

Chaque passage de la boucle produit une image :

```js
*passageDeLaBoucle() {
  yield* this.appeler(QUEST.commandes_tour);          // 1. entrées : un clic ?
  if (d.commandes & COMMANDE.boutonDroit) yield* this.appeler(QUEST.fin_tour);
  yield* this.appeler(QUEST.pas_automatique);         // 2. mise à jour : un pas du chemin
  yield* this.appeler(QUEST.evenements_et_piege);
  yield* this.appeler(QUEST.anime_sprites);
  yield* this.appeler(QUEST.dessine_icones);          // 3. dessin, dans le tampon
  yield* this.appeler(QUEST.dessine_sprites);
  // ...
  yield* this.appeler(QUEST.affiche_tampon);          // 4. le tampon passe à l'écran
  yield* this.appeler(QUEST.restaure_tampon);
  yield* this.appeler(QUEST.evenements_quete);        // 5. règles de la quête
  yield* this.appeler(QUEST.fin_quete);
}
```

C'est la boucle de presque tous les jeux, d'hier et d'aujourd'hui. Le tour finit quand une action pose `finDuTour` : l'icône de fin de tour, le bouton droit, la mort du héros, un piège.

### Le tampon

Le jeu ne dessine pas directement à l'écran. Il dessine dans un tampon, une copie de l'écran en mémoire, puis copie le tout d'un coup (`affiche_tampon`). Sinon le joueur verrait les sprites s'effacer et se redessiner, et l'image clignoterait. `restaure_tampon` remet ensuite le fond sans les sprites, prêt pour l'image suivante.

### Les zones cliquables

Le panneau d'icônes n'est pas codé bouton par bouton. Une table en mémoire décrit chaque zone : un rectangle (x1, x2, y1, y2) et l'adresse de la routine à lancer. Le clic cherche la première zone qui contient le curseur :

```js
zoneSousLeCurseur() {
  // ...
  let adresse = d.adresseZonesActives;
  while (d.mot(adresse) !== FIN_DES_ZONES) {
    const dedans = x >= d.mot(adresse) && x <= d.mot(adresse + 2) && y >= d.mot(adresse + 4) && y <= d.mot(adresse + 6);
    if (dedans) return { adresse, /* ... */ trouvee: true };
    adresse += TAILLE_ZONE;
  }
  return { adresse: null, /* ... */ trouvee: false };
}
```

puis saute à la routine rangée dans la zone :

```js
const routine = d.mot(zone.adresse + 8);
return this.sauter(routine, { /* ... */ });
```

Pendant le tour, la table active (`adresseZonesActives`) est celle du panneau d'icônes. Les autres écrans ont leurs propres tables de zones, par exemple l'écran des héros et l'armurerie (`zones_heros`, `zones_armurerie` dans [symboles.txt](../original/symboles.txt)). Hors de toute zone, le clic va au plateau (`clic_plateau`, leçon 4).

## Ce qu'en faisait la machine de 1991

En mode VGA 13h, l'écran fait 320 × 200 pixels, un octet par pixel : 64 000 octets, un dixième de la mémoire du PC. Le tampon a la même taille, dans son propre segment, et le jeu en garde une seconde copie, le fond sans les sprites. Copier 64 000 octets à chaque image était une opération lourde pour les processeurs de l'époque. Aujourd'hui, c'est la carte graphique qui fait ce travail.

La table des zones est une forme ancienne de ce que les interfaces modernes appellent des gestionnaires d'événements : des données qui disent « ce rectangle, cette action ». Elle est rangée avec le reste des données du programme et ne coûte presque rien.

## Le bogue

Un héros à la fois endormi et pris dans la tempête : la tempête est consommée, mais au lieu de lui faire passer son tour, le code tombe sur le test du sommeil, et le héros tente de se réveiller au dé comme s'il était seulement endormi. Le code lisible fait de même, dans le premier extrait ci-dessus : `if (!fiche.porte(... endormi)) return;` ne fait passer le tour que si le héros ne dort pas.

Autre détail : `finDuTour` n'est pas remis à 0 par le tour, mais par le calcul des dés de déplacement (`des_deplacement_tour`), appelé au début. Les deux sont dans [bogues-reecriture.md](../original/notes/bogues-reecriture.md#tour-dun-personnage).

## Exercices

1. **Observer.** Dans l'inspecteur, regarder la colonne « personnage » de l'en-tête et la ligne jaune des héros pendant une partie à plusieurs héros. Que montre l'inspecteur pendant le tour de Morcar ? Aucune variable de la mémoire ne le dit : l'inspecteur le déduit de la pile d'appels ([vue/pile.js](../web/jeu/vue/pile.js), `phaseDuJeu`). Pourquoi cette méthode peut-elle se tromper sur une image isolée ?

2. **Écrire une recherche de zone.** Écrire `zoneSous(zones, x, y)` qui prend un tableau d'objets `{ x1, x2, y1, y2, action }` et rend l'action de la première zone qui contient le point, ou `null`. L'essayer avec deux zones qui se chevauchent : laquelle gagne ? Pourquoi l'ordre de la table compte-t-il ?

3. **Modifier.** Dans une copie, retirer la ligne qui appelle `fin_tour` au bouton droit dans `passageDeLaBoucle`. Le bouton droit termine-t-il encore le tour dans la page ? `node outils/lisible.mjs 20 tour_personnage` doit signaler un écart.

4. **Mesurer.** Dans une copie, compter les passages de `passageDeLaBoucle` et écrire le compte dans la console une fois par seconde (`performance.now()`). Combien d'images par seconde la boucle du tour produit-elle ? Comparer avec les 70 retours de trame par seconde du VGA.

## Pour aller plus loin

- Le tour d'un personnage et le panneau d'icônes : [original/notes/03-regles.md](../original/notes/03-regles.md#tour-dun-personnage).
- La boucle de la partie : [original/notes/02-ecrans.md](../original/notes/02-ecrans.md#une-partie).
- « Game loop » et « double buffering » : les deux notions de base de cette leçon, toujours utilisées.
