# Leçon 2 : des routines qui attendent

## Ce qu'on va apprendre

Le jeu de 1991 est un seul programme qui tourne en boucle sans jamais rendre la main. La page web, elle, doit rendre la main au navigateur 60 fois par seconde. On va voir comment une fonction génératrice de JavaScript (`function*` et `yield`) permet de couper une routine en étapes, et pourquoi c'est une machine à états écrite sans en avoir l'air.

## Ce que fait le jeu

Au début du tour d'un héros, les dés de déplacement tournent jusqu'à ce que le joueur clique. Pendant ce temps, le jeu dessine une image, lit la souris, redessine, relit la souris… Le code de 1991 écrit ça comme une boucle ordinaire : « tant que pas de clic, dessiner et relire ».

Dans l'inspecteur (`?sans-intro&inspecteur`), pendant que les dés tournent, l'en-tête donne la routine en cours, `image_des`, et la pile d'appels montre qui l'a appelée :

```text
1. tirage_deplacement (lisible)
2. tour_personnage (lisible)
3. partie
4. demarrage
```

`tour_personnage` a appelé `tirage_deplacement`, qui appelle `image_des` à chaque image. Par moments, l'en-tête affiche `tirage_deplacement (lisible)` avec IP `fff0` : c'est l'instant où `image_des` vient de rendre la main et où la routine lisible reprend. Les deux premières sont réécrites en JavaScript (« lisible »), les autres sont encore du code traduit automatiquement. Les deux sortes s'appellent l'une l'autre sans différence visible.

## Le code

Une routine qui doit attendre l'écran, le joueur ou une animation est une méthode génératrice. Extrait de `tirageDeplacement`, dans [deplacement.js](../web/jeu/lisible/deplacement.js) :

```js
*tirageDeplacement() {
  // ...
  do {
    // ... le héros clignote, on tire de nouveaux dés
    yield* this.appeler(QUEST.image_des);        // dessine les dés
    yield* this.appeler(QUEST.restaure_tampon);
    yield* this.appeler(QUEST.lit_commandes);    // lit la souris
  } while ((d.commandes & 0x10) === 0);          // jusqu'au clic gauche
  // ...
}
```

Elle se lit comme la boucle de 1991. Toute l'astuce est dans `appeler`, dans [module.js](../web/jeu/lisible/module.js) :

```js
*appeler(adresse, registres = {}) {
  this.poserRegistres(registres);
  yield adresse;
}
```

`yield adresse` met la méthode en pause et rend l'adresse de la routine à exécuter. Celui qui fait avancer la méthode, dans [routines.js](../web/jeu/lisible/routines.js), s'en sert ainsi :

```js
function reprendre(m) {
  const enCours = m.lisibles.at(-1);
  const { value: adresse, done } = enCours.etapes.next();
  if (!done) {
    m.push(RETOUR_LISIBLE);       // la routine appelée reviendra ici
    return adresse;
  }
  m.lisibles.pop();
  return adresse === undefined ? m.pop() : adresse;   // ret, ou saut final
}
```

1. `etapes.next()` relance la méthode jusqu'au prochain `yield` ;
2. on pose sur la pile du programme une fausse adresse de retour, `RETOUR_LISIBLE` (0xFFF0), puis on continue à l'adresse demandée : c'est exactement ce que fait l'instruction `call` du processeur ;
3. la machine exécute la routine d'origine, à son rythme, pendant autant d'images qu'il faut ;
4. quand cette routine finit, son `ret` saute à 0xFFF0 ; la machine y trouve `reprendre`, qui relance la méthode juste après son `yield`.

La méthode garde ses variables locales et sa position entre deux étapes. Sans générateur, il faudrait les ranger à la main dans un objet, avec un numéro d'étape et un grand `switch` : une machine à états explicite. Le générateur l'écrit pour nous.

Les routines qui ne font que calculer, sans rien attendre, restent des méthodes ordinaires : `calculerDefenseHeros` dans [combat.js](../web/jeu/lisible/combat.js), par exemple. `routines.js` les distingue par `etapes: true`.

## Ce qu'en faisait la machine de 1991

Sous DOS, un programme a tout le PC pour lui. Il n'y a ni fils d'exécution, ni événements, ni rappel « quand l'utilisateur clique ». Le jeu interroge lui-même la souris à chaque tour de boucle (on appelle ça du *polling*), et il attend le bon moment pour dessiner en lisant en boucle un port de la carte VGA qui signale le retour du faisceau en haut de l'écran, 70 fois par seconde.

Dans le navigateur, une boucle qui ne rend jamais la main gèle la page. La page fait donc tourner la machine émulée par tranches, une par image (`requestAnimationFrame`, dans [principal.js](../web/jeu/principal.js)), et les routines lisibles doivent pouvoir s'arrêter en plein milieu, puis reprendre à la tranche suivante. C'est le rôle des générateurs.

## Le bogue

Dans la boucle du tour ([tour.js](../web/jeu/lisible/tour.js)), le jeu regarde si le joueur veut quitter la quête (Échap avec Ctrl) :

```js
// Le test d'origine compare l'octet entier à 0x40 (cmp), pas le seul bit 0x40 :
// quitter n'est vu que si aucun autre bit de commande n'est posé.
if (d.commandes === COMMANDE.quitter) return this.sauter(QUITTE_LA_QUETE);
```

L'octet `commandes` range plusieurs informations, un bit chacune : bouton gauche (0x10), bouton droit (0x20), quitter (0x40)… Pour savoir si un bit est posé, il faut l'isoler : `(commandes & 0x40) !== 0`. Le code de 1991 compare l'octet entier : si un autre bit est posé au même moment, la demande passe inaperçue. Ailleurs dans le jeu, le même test est écrit correctement. Le code lisible garde l'erreur, pour rester fidèle.

## Exercices

1. **Observer.** Dans l'inspecteur, regarder la pile d'appels à trois moments : dés qui tournent, héros qui marche après un clic sur le plateau, boîte de message ouverte. Quelles routines lisibles apparaissent à chaque fois ?

2. **Écrire un générateur.** Dans un fichier `etapes.mjs`, écrire une fonction génératrice `*compteARebours(n)` qui fait `yield` à chaque nombre, de n à 1, puis renvoie `'partez'`. Écrire ensuite une boucle qui l'avance d'une étape toutes les 500 ms avec `setInterval` et `next()`, et s'arrête quand `done` vaut `true`. Comparer avec une version sans générateur, qui garde `n` dans une variable extérieure.

3. **Modifier.** Dans une copie, compter les passages de la boucle `do … while` de `tirageDeplacement` et les écrire dans la console à la fin (`console.log`). Lancer les dés dans la page en attendant plus ou moins avant de cliquer : le nombre suit-il le temps d'attente ? `node outils/lisible.mjs 20 tirage_deplacement` doit rester identique : un `console.log` ne change pas la mémoire du jeu.

4. **Aller plus loin.** Réécrire `reprendre` sans générateur : chaque routine par étapes devient un objet avec un champ `etape` et une méthode `suivante()` qui fait un `switch` sur ce champ. Essayer sur `finTour` (dans [tour.js](../web/jeu/lisible/tour.js)), la plus courte.

## Pour aller plus loin

- La méthode de réécriture et les deux sortes de routines : [web/README.md](../web/README.md#code-lisible).
- La boucle de la partie : [original/notes/02-ecrans.md](../original/notes/02-ecrans.md#une-partie).
- Les générateurs sur MDN : « function* » et « Itérateurs et générateurs ».
