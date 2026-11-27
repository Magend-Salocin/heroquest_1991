# Prompts des graphismes de la vue moderne

Les images de la vue moderne (phase 5, [plan](PLAN-cours-vue-moderne.md)) sont générées pour le projet, dans un style qui lui est propre. Elles n'imitent ni le jeu de 1991 ni aucun jeu de plateau, et ne reprennent aucun nom de personnage, de lieu ou de marque. Elles peuvent donc être versionnées, contrairement aux fichiers du jeu.

## Méthode

1. Générer chaque planche avec son prompt : le bloc de style commun, puis le texte propre à la planche.
2. Enregistrer l'image sous `graphismes/planches/<nom de la planche>.png` (par exemple `graphismes/planches/sols.png`).
3. Lancer `python decouper-planches.py` depuis `outils/` (description des planches : `outils/planches.json`) : il découpe la grille, retire le fond vert, recadre, redimensionne et écrit `web/vue/images/<nom>.png`, puis l'atlas.

Règles pour toutes les planches, sinon la découpe se passe mal :

- **Grille stricte.** Chaque élément est seul dans sa case, centré, sans déborder sur la voisine. Pas de séparation dessinée : la découpe se fait par les coordonnées.
- **Fond vert pur et uni** (`#00FF00`) pour tout ce qui est détouré : pas d'ombre portée au sol, pas de décor, pas de dégradé.
- **Pas de vert vif sur les éléments eux-mêmes.** Le script efface le vert proche du fond. La mousse, les potions ou les yeux verts doivent tirer vers l'olive, le vert-de-gris ou le turquoise sombre.
- **Aucun texte**, aucune lettre, aucun chiffre, aucune signature.
- Prompts en anglais : les modèles d'image les suivent mieux.

Si le générateur accepte une image de référence, joindre la première planche réussie (les sols) à toutes les suivantes, pour garder la même lumière et la même palette.

## Projection

Vue isométrique 2:1 : une case du plateau est un losange deux fois plus large que haut. Taille finale d'une case : 64 × 32 px. Les éléments posés sur une case (murs, meubles, personnages) dépassent vers le haut ; leur point d'ancrage est le sommet bas du losange de leur case.

Lumière : torche chaude venant du haut à gauche, ombres froides en bas à droite. Le jeu dessine seulement les murs du fond (côtés haut et gauche de chaque case) : il faut donc des murs vus de l'intérieur de la pièce, sur ces deux côtés.

## Bloc de style (commun à toutes les planches)

```
Original dark fantasy dungeon art for a turn-based tactics game, hand-painted digital illustration with crisp readable shapes, made to be viewed small. Isometric 2:1 projection (dimetric, 26.57 degree slope), camera looking down at about 30 degrees. Warm torchlight from the top-left, cool blue shadows on the bottom-right. Palette: blue-grey stone, weathered oak, dark iron, warm ochre and ember orange, muted olive. Strong silhouettes, subtle edge highlights, no outlines thicker than 2 pixels at final size. No text, no letters, no numbers, no logos, no signature, no watermark. Every element sits alone and centered in its own grid cell, never touching the cell borders, on a perfectly flat pure green background (#00FF00) with no cast shadow, no floor and no gradient. Do not use bright green anywhere on the objects.
```

## Planches

### 1. Sols : `sols`

Usage : le sol de chaque case vue. Variantes choisies de façon stable par case.

Planche 1536 × 1024, 6 colonnes × 4 rangées, cases de 256 × 256. Dans chaque case, un losange de 256 × 128 centré. Sortie : 64 × 32.

| Rangée | Contenu | Fichiers |
| --- | --- | --- |
| 1 | dalles de pierre de pièce, 6 variantes | `sol-piece-1` à `sol-piece-6` |
| 2 | dalles de couloir, plus usées, 6 variantes | `sol-couloir-1` à `sol-couloir-6` |
| 3 | dalles fissurées (3), dalles avec mousse olive (3) | `sol-fissure-1` à `3`, `sol-mousse-1` à `3` |
| 4 | terre battue (3), dalles avec ossements épars (3) | `sol-terre-1` à `3`, `sol-os-1` à `3` |

```
[BLOC DE STYLE]

A tile sheet of 24 isometric floor tiles in a strict grid of 6 columns and 4 rows on a 1536x1024 canvas. Each cell is 256x256 and contains one single flat diamond-shaped floor tile, 256 pixels wide and 128 pixels tall, centered in the cell, seen from the isometric camera. The tiles must fit seamlessly edge to edge when placed side by side in an isometric grid: same stone size, same lighting, edges flat and clean.
Row 1: six variations of fitted square flagstones for a dungeon room, slightly uneven, blue-grey.
Row 2: six variations of worn corridor flagstones, darker and more chipped.
Row 3: three cracked flagstone tiles, then three flagstone tiles with patches of dark olive moss in the joints.
Row 4: three tiles of packed earth with a few loose pebbles, then three flagstone tiles with a few scattered old bones and a small skull.
```

### 2. Murs : `murs`

Usage : murs du fond de chaque case, côté haut et côté gauche, vus de l'intérieur de la pièce.

Planche 1536 × 1024, 4 colonnes × 2 rangées, cases de 384 × 512. Sortie : 64 × 96 par segment (une case de large, ancrage en bas).

| Rangée | Colonnes | Fichiers |
| --- | --- | --- |
| 1 : côté haut (le mur file vers le haut à droite) | nu, avec torche allumée, fissuré, avec chaînes | `mur-haut`, `mur-haut-torche`, `mur-haut-fissure`, `mur-haut-chaines` |
| 2 : côté gauche (le mur file vers le haut à gauche) | les mêmes | `mur-gauche`, `mur-gauche-torche`, `mur-gauche-fissure`, `mur-gauche-chaines` |

```
[BLOC DE STYLE]

A sprite sheet of 8 isometric dungeon wall segments in a strict grid of 4 columns and 2 rows on a 1536x1024 canvas, each cell 384x512. Each cell contains one single wall segment, exactly one floor tile long, standing on the bottom of the cell, seen from inside the room, about 1.5 times as tall as the tile is wide. Thick blue-grey stone blocks with a darker stone base course.
Row 1: the segment runs along the top-right edge of a floor diamond (rising toward the upper right). Columns: plain wall; wall with a burning iron torch sconce; cracked wall with a few fallen stone chips; wall with rusty hanging chains.
Row 2: the same four walls, mirrored, running along the top-left edge of a floor diamond (rising toward the upper left).
The ends of each segment are cut straight so that segments join seamlessly.
```

### 3. Portes et passages : `portes`

Usage : portes sur un bord de case, porte secrète trouvée, escalier de sortie, éboulis qui bloque une case.

Planche 1536 × 1024, 4 colonnes × 2 rangées, cases de 384 × 512. Sortie : 64 × 96, sauf l'escalier (128 × 96, deux cases de large) et les éboulis (64 × 64).

| Rangée | Colonnes | Fichiers |
| --- | --- | --- |
| 1 | porte fermée côté haut, porte ouverte côté haut, porte fermée côté gauche, porte ouverte côté gauche | `porte-haut-fermee`, `porte-haut-ouverte`, `porte-gauche-fermee`, `porte-gauche-ouverte` |
| 2 | passage secret ouvert côté haut, passage secret ouvert côté gauche, escalier descendant, tas d'éboulis | `secret-haut`, `secret-gauche`, `escalier`, `eboulis` |

```
[BLOC DE STYLE]

A sprite sheet of 8 isometric dungeon passage elements in a strict grid of 4 columns and 2 rows on a 1536x1024 canvas, each cell 384x512, each element standing on the bottom of its cell.
Row 1: a heavy wooden door with iron bands set in a one-tile stone wall segment rising toward the upper right, closed; the same door swung open inward showing darkness beyond; then the same two, mirrored, in a wall segment rising toward the upper left.
Row 2: a wall segment rising toward the upper right with a narrow pivoting stone panel turned open, revealing a dark gap; the same mirrored toward the upper left; a stone staircase going down into darkness, occupying a 2 by 2 tile square seen from above at the isometric angle; a low pile of fallen rubble and broken masonry filling one floor tile.
```

### 4. Mobilier : `meubles`

Usage : meubles du plateau, sur une ou plusieurs cases. Une seule orientation est générée ; l'autre est obtenue par miroir horizontal.

Planche 1536 × 1024, 4 colonnes × 3 rangées, cases de 384 × 341. Sortie : largeur selon l'emprise (64 par case de large), ancrage au sommet bas de l'emprise.

| Case | Meuble | Emprise | Fichier |
| --- | --- | --- | --- |
| 1 | longue table en bois | 2 × 3 | `meuble-table` |
| 2 | coffre ferré | 1 × 1 | `meuble-coffre` |
| 3 | armoire haute | 1 × 2 | `meuble-armoire` |
| 4 | bibliothèque | 1 × 3 | `meuble-bibliotheque` |
| 5 | trône de pierre | 1 × 1 | `meuble-trone` |
| 6 | tombeau de pierre | 2 × 3 | `meuble-tombeau` |
| 7 | cheminée | 1 × 3 | `meuble-cheminee` |
| 8 | établi d'alchimiste avec fioles | 2 × 3 | `meuble-etabli` |
| 9 | chevalet de bois à cordes | 2 × 3 | `meuble-chevalet` |
| 10 | râtelier d'armes | 1 × 3 | `meuble-ratelier` |
| 11 | tonneaux | 1 × 1 | `meuble-tonneaux` |
| 12 | case vide (laisser entièrement verte) | | |

```
[BLOC DE STYLE]

A sprite sheet of 11 isometric dungeon furniture pieces in a strict grid of 4 columns and 3 rows on a 1536x1024 canvas, each cell 384x341, each piece centered and standing on the bottom of its cell, all at the same scale (one floor tile is 96 pixels wide on this sheet), all oriented the same way with their long side running toward the upper right.
1: a long heavy oak table, 2 by 3 tiles. 2: a small iron-banded wooden chest, 1 tile. 3: a tall dark wooden wardrobe, 1 by 2 tiles. 4: a tall bookcase full of old books and scrolls, 1 by 3 tiles. 5: a massive carved stone throne, 1 tile. 6: a closed stone sarcophagus on a plinth, 2 by 3 tiles. 7: a large stone fireplace with glowing embers, 1 by 3 tiles. 8: an alchemist's workbench cluttered with glass flasks in amber and blue, 2 by 3 tiles. 9: a sinister wooden frame with ropes and pulleys, 2 by 3 tiles. 10: a wall rack holding spears, swords and axes, 1 by 3 tiles. 11: a group of three wooden barrels, 1 tile. Cell 12: leave completely empty green.
```

### 5. Monstres : `monstres`

Usage : un sprite de repos par type de monstre, tourné vers le bas à droite ; miroir pour le bas à gauche. Types : voir [03-regles.md](../original/notes/03-regles.md#monstres). Les chefs et sorciers des quêtes reçoivent un sprite à part, décrit de façon générique.

Planche 1536 × 1024, 4 colonnes × 3 rangées, cases de 384 × 341. Sortie : 64 × 80, ancrage aux pieds.

| Case | Monstre (type du jeu) | Fichier |
| --- | --- | --- |
| 1 | petit gobelin (0) | `monstre-gobelin` |
| 2 | orc (1) | `monstre-orc` |
| 3 | brute des marais, un seul œil (2) | `monstre-brute` |
| 4 | guerrier en armure noire (3) | `monstre-guerrier-noir` |
| 5 | squelette (4) | `monstre-squelette` |
| 6 | zombi (5) | `monstre-zombi` |
| 7 | momie (6) | `monstre-momie` |
| 8 | gargouille de pierre (7) | `monstre-gargouille` |
| 9 | chef orc (8 à 10) | `monstre-chef-orc` |
| 10 | sorcier sur un trône (11) | `monstre-sorcier-trone` |
| 11 | sorcier debout (12 et suivants) | `monstre-sorcier` |
| 12 | case vide | |

```
[BLOC DE STYLE]

A sprite sheet of 11 original fantasy monsters in a strict grid of 4 columns and 3 rows on a 1536x1024 canvas, each cell 384x341, each monster standing alone, full body, feet on the bottom of its cell, all at the same scale (a human-sized creature is about 260 pixels tall), all in an idle combat-ready pose in three-quarter view facing the bottom-right. Original designs, not based on any existing game or franchise.
1: a small wiry goblin with a crude short blade. 2: a burly tusked orc with a cleaver and scraps of leather armor. 3: a hulking one-eyed swamp brute with grey-blue hide and a stone club. 4: a warrior in spiked blackened plate armor with a heavy sword. 5: a skeleton with a rusty sword and a cracked round shield. 6: a shambling zombie in rotten peasant clothes. 7: a mummy wrapped in yellowed bandages, arms forward. 8: a winged stone gargoyle crouching on its hind legs. 9: a towering orc chieftain with a horned helmet and a great axe. 10: a gaunt sorcerer in a dark hooded robe seated on a small bone throne. 11: the same sorcerer standing, holding a staff topped with a pale blue crystal. Cell 12: leave completely empty green.
```

### 6. Pions des héros : `pions-heros` et `pions-heroines`

Usage : les héros sur le plateau isométrique, en pied. Deux directions par héros (vers le bas à droite, vers le haut à droite) ; les deux autres par miroir. Mêmes personnages que les portraits déjà découpés dans `donjon-v2/public/assets/game/images/avatars/` (planche décrite dans `Campagne01/01-regles/heros-prompt.md`) : joindre la planche des portraits en référence.

Deux planches 1536 × 1024, 4 colonnes × 2 rangées, cases de 384 × 512. Sortie : 64 × 96, ancrage aux pieds.

| | Colonnes : barbare, nain, elfe, enchanteur |
| --- | --- |
| Rangée 1 | de trois quarts, tourné vers le bas à droite : `heros-<type>-<sexe>-bas` |
| Rangée 2 | de dos, tourné vers le haut à droite : `heros-<type>-<sexe>-haut` |

`<sexe>` : `h` pour la planche `pions-heros`, `f` pour `pions-heroines`.

```
[BLOC DE STYLE]

A sprite sheet of 8 full-body character sprites in a strict grid of 4 columns and 2 rows on a 1536x1024 canvas, each cell 384x512, each character standing alone, feet on the bottom of its cell, same scale (about 330 pixels tall), same characters, costumes and colors as the attached portrait sheet. Columns from left to right: the barbarian, the dwarf (shorter, about 250 pixels tall), the elf, the wizard. Row 1: each character in three-quarter front view facing the bottom-right, weapon ready. Row 2: the same characters in three-quarter back view facing the top-right, walking.
[Pour pions-heros : "All four characters are men."] [Pour pions-heroines : "All four characters are women."]
```

### 7. Interface : `interface-cadre` et `interface-icones`

Usage : le cadre autour du plateau, le fond du panneau d'actions, les boutons et les icônes d'action.

`interface-cadre` : une image 1536 × 1024, découpée en 9 morceaux (coins fixes, bords étirés) avec des marges de 128 px. Fichiers : `cadre-coin-hg`, `cadre-coin-hd`, `cadre-coin-bg`, `cadre-coin-bd`, `cadre-haut`, `cadre-bas`, `cadre-gauche`, `cadre-droite`, `cadre-fond`.

```
[BLOC DE STYLE, sans la phrase sur la grille et le fond vert]

A single ornamental frame for a game screen on a 1536x1024 canvas, seen straight on (not isometric). A border exactly 128 pixels thick on all four sides, made of dark carved oak with riveted iron corner plates and small engraved runic patterns (no readable letters). The border must be uniform along each side so it can be stretched, with all the detail concentrated in the four 128x128 corners. The inside area is a plain dark slate panel with a very subtle texture, no objects. Nothing outside the border.
```

`interface-icones` : planche 1536 × 1024, 6 colonnes × 4 rangées, cases de 256 × 256. Sortie : 48 × 48.

| Rangée | Contenu | Fichiers |
| --- | --- | --- |
| 1 | icônes : se déplacer, attaquer, chercher un trésor, chercher les pièges et portes secrètes, lancer un sort, inventaire | `icone-deplacer`, `icone-attaquer`, `icone-tresor`, `icone-chercher`, `icone-sort`, `icone-inventaire` |
| 2 | icônes : fin de tour, carte, ouvrir une porte, regarder, son, menu | `icone-fin-tour`, `icone-carte`, `icone-porte`, `icone-regarder`, `icone-son`, `icone-menu` |
| 3 | bouton carré vide : normal, survolé, enfoncé, désactivé ; flèche gauche ; flèche droite | `bouton-normal`, `bouton-survol`, `bouton-enfonce`, `bouton-inactif`, `fleche-gauche`, `fleche-droite` |
| 4 | jauges : cœur (corps), étoile (esprit), pièce d'or, bouclier, épée, sablier | `jauge-corps`, `jauge-esprit`, `jauge-or`, `jauge-defense`, `jauge-attaque`, `jauge-temps` |

```
[BLOC DE STYLE, en remplaçant « Isometric 2:1 projection... » par « Flat front view, not isometric. »]

A sheet of 24 game interface icons in a strict grid of 6 columns and 4 rows on a 1536x1024 canvas, each cell 256x256, each icon centered with a 24 pixel margin, bold simple shapes readable at 48x48, painted brass and iron with ember highlights, consistent stroke and lighting.
Row 1: a pair of boots with motion lines; a crossed sword and axe; an open chest with a glint of gold; a magnifying glass over a cracked stone; a glowing open hand with a small rune circle; a leather backpack.
Row 2: an hourglass with sand run out; a rolled parchment map; a wooden door ajar; an open eye; a small horn; three stacked horizontal bars.
Row 3: an empty square bronze button in normal state, the same lit with a warm glow, the same pressed in and darker, the same greyed out; a bold bronze arrow pointing left; the same pointing right.
Row 4: a red heart; a pale blue star; a gold coin; a round shield; a sword pointing up; a small hourglass.
```

### 8. Dés : `des`

Usage : les dés du dernier lancer, à côté du plateau. Le jeu montre des faces, pas une animation 3D.

Planche 1024 × 1024, 3 colonnes × 3 rangées, cases de 341 × 341. Sortie : 48 × 48.

| Rangée | Contenu | Fichiers |
| --- | --- | --- |
| 1 | dé à six faces, faces 1, 2, 3 | `de-1`, `de-2`, `de-3` |
| 2 | faces 4, 5, 6 | `de-4`, `de-5`, `de-6` |
| 3 | dé de combat : crâne, bouclier clair, bouclier sombre | `de-crane`, `de-bouclier-blanc`, `de-bouclier-noir` |

```
[BLOC DE STYLE, en remplaçant « Isometric 2:1 projection... » par « Flat front view, not isometric. »]

A sheet of 9 dice faces in a strict grid of 3 columns and 3 rows on a 1024x1024 canvas, each cell about 341x341, each face a rounded square of aged ivory seen straight on, centered with a 40 pixel margin, with carved and inked symbols. Rows 1 and 2: the six faces of a standard die with pips, from one pip to six pips, in order. Row 3: a carved skull; a pale round shield; a dark round shield. Pips and symbols only, no numbers.
```

### 9. Parchemin des messages : `parchemin`

Usage : boîtes de message et briefing. Découpé en trois bandes : rouleau du haut, milieu répétable en hauteur, rouleau du bas.

Image 1536 × 1024. Fichiers : `parchemin-haut` (192 px), `parchemin-milieu` (640 px, étiré), `parchemin-bas` (192 px).

```
[BLOC DE STYLE, en remplaçant « Isometric 2:1 projection... » par « Flat front view, not isometric. »]

A single wide parchment scroll on a 1536x1024 canvas, seen straight on, unrolled horizontally across the whole width: a wooden roller with iron caps at the top, occupying the top 192 pixels, the same roller at the bottom, occupying the bottom 192 pixels, and between them a plain sheet of aged cream parchment with faint stains and slightly darker edges. The middle 640 pixels must be uniform from top to bottom so it can be repeated vertically. Completely blank, no writing.
```

## Suivi

| Planche | Générée | Découpée | Remarques |
| --- | --- | --- | --- |
| sols | | | |
| murs | | | |
| portes | | | |
| meubles | | | |
| monstres | | | |
| pions-heros | | | |
| pions-heroines | | | |
| interface-cadre | | | |
| interface-icones | | | |
| des | | | |
| parchemin | | | |
