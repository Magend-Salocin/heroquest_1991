# Portage web

HeroQuest PC (Gremlin, 1991) dans un navigateur, à partir du code original traduit en JavaScript. Les fichiers du jeu ne sont pas copiés ici : en local, `fichiers.php` les lit dans `../jeu/` ; sur le site publié (GitHub Pages, téléphone), ils arrivent par un paquet de données importé sur l'appareil ([WEB_DEPLOIEMENT.md](../WEB_DEPLOIEMENT.md)).

## Lancer

```bash
php -S 127.0.0.1:8765 -t web       # depuis la racine du dépôt
```

Puis ouvrir `http://127.0.0.1:8765/`. La page enchaîne les programmes comme `HERO.EXE` : `INTRO.EXE`, puis `QUEST.EXE`.

Un seul affichage, le VGA, et un seul son, l'AdLib. La page fournit `QUEST.CFG` avec ces choix : l'intro ne pose donc pas ses questions de configuration, et la touche S (« Press S to change config ») est ignorée, car elle rouvrirait ces questions et l'écran des drapeaux, qui n'existe qu'en EGA. La langue se choisit dans l'adresse. Les commandes des joueurs restent celles du `QUEST.CFG` enregistré (souris par défaut).

| Adresse | Effet |
| --- | --- |
| `index.html?sans-intro` | lance directement le jeu ; pendant l'intro, Échap ou le bouton « Passer l'intro » font de même |
| `index.html?langue=en` | langue des textes : `fr` (par défaut), `en`, `es`, `de`, `it` |
| `index.html?genere` | code généré seul, sans les routines réécrites de `jeu/lisible/` (pour comparer) |
| `index.html?debug` | affiche sous l'écran le programme, le temps de jeu et l'IP ; expose `window.jeu` (son, machine) |
| `index.html?paquet`, `?paquet=URL`, `?importer` | ignore le serveur PHP et utilise le paquet de l'appareil ; l'importe depuis une adresse ; propose d'en importer un autre |
| `index.html?tactile`, `?sans-tactile` | force ou masque les commandes tactiles (affichées d'office sur un écran tactile) |
| `index.html?inspecteur` | panneau qui montre la partie telle que le code la voit (voir « Inspecteur ») |
| `index.html?vue=moderne`, `?vue=origine` | force la vue moderne du plateau ou l'écran d'origine, sans garder le choix ; sinon le choix gardé (bouton, F9), d'origine par défaut (voir « Vue moderne ») |

Le jeu dessine son propre curseur. Clavier : positions physiques du PC (voir `jeu/clavier.js`) ; Ctrl quitte.

Son : comme dans l'original, la musique joue au départ (dès l'intro) et les effets sont muets ; F10 coupe la musique et active les effets. Le navigateur n'ouvre le son qu'au premier clic ou à la première touche.

## Fichiers

| Chemin | Rôle |
| --- | --- |
| `jeu/quest.gen.js`, `jeu/intro.gen.js` | code traduit, généré par `outils/recompiler.py` : une fonction par routine, au nom de `original/symboles.txt` (ou `symboles-intro.txt`), chaque instruction d'origine en commentaire. Ne pas modifier à la main |
| `jeu/machine.js` | ce que le code attend autour de lui : registres et drapeaux du 8086, mémoire de 1 Mo, pile, DOS (fichiers, mémoire, vecteurs), BIOS (vidéo, clavier, zone de données), VGA 13h, mode texte, souris, ports, IRQ clavier, temps |
| `jeu/exepack.js` | décompression EXEPACK et relocations, comme DOS au chargement |
| `jeu/principal.js` | la page : source des fichiers (serveur PHP ou paquet), boucle au rythme du temps réel, affichage, entrées souris, tactiles et clavier |
| `jeu/paquet.js`, `jeu/archive.js` | paquet de données du site publié (IndexedDB, sauvegardes) ; format d'archive commun avec `fichiers.php` |
| `jeu/tactile.js` | commandes tactiles : clic droit, clavier de l'appareil, F10, vibration ; gestes sur l'écran (appui long, deux doigts) dans `principal.js` |
| `sw.js`, `manifest.webmanifest`, `icones/` | hors ligne et installation sur l'écran d'accueil (site publié) |
| `jeu/lisible/` | le code réécrit à la main, lisible (voir « Code lisible ») |
| `jeu/vue/` | lecture de l'état de la partie (voir « État de la partie ») et inspecteur (voir « Inspecteur ») |
| `jeu/clavier.js` | codes clavier du PC |
| `jeu/son.js` | joue les WAV (de `sons/` ou du paquet) quand le jeu appelle son pilote (int 60h : jouer, arrêter, silence) ; la musique en boucle |
| `sons/` | les morceaux du pilote AdLib en WAV (mono, 16 bits, 22 050 Hz), générés (voir « Son »), ignorés par git |
| `fichiers.php` | les fichiers d'origine en une archive, sans ceux des autres versions (`.EGA`, pilotes Tandy et MT-32) ; écrit `QUEST.SAV` et `QUEST.CFG` dans `sauvegardes/` (ignoré par git), jamais dans le jeu d'origine |

## Comment le code est traduit

`recompiler.py` part du désassemblage suivant le flot (`desassembler.py`) et traduit chaque instruction atteinte. Une routine devient une fonction `nom_adresse(m, ip)` : elle exécute ses instructions tant que IP reste chez elle, puis rend IP à `machine.executer`. Appels, retours et sauts passent par la vraie pile du programme, comme sur le processeur d'origine : les astuces de pile et les sauts entre routines du code d'origine marchent sans traitement particulier.

- Les segments relogés par DOS (table EXEPACK) deviennent `valeur + m.L`.
- Les octets de code que le programme réécrit (code automodifié, par exemple 0x26C9) sont relus en mémoire à chaque passage ; une écriture dans un autre octet du code traduit est signalée dans la console.
- Le temps est compté en instructions, 3000 par milliseconde, comme `cycles = fixed 3000` sous DOSBox-X : attentes, animations et retour de trame (70 Hz) durent comme sous DOSBox-X.

Le résultat est identique à l'original par construction : même mémoire, mêmes adresses, même générateur de hasard. On peut ensuite réécrire une routine à la main en gardant la version générée comme référence.

## Code lisible

`jeu/lisible/` réécrit les routines du jeu en classes et méthodes, avec des noms clairs, pour expliquer le fonctionnement du jeu de 1991. Chaque routine réécrite remplace sa version générée et travaille sur la même mémoire : le reste du jeu, encore généré, ne voit pas la différence.

| Fichier | Contenu |
| --- | --- |
| `donnees.js` | vue nommée du segment de données : variables communes (`numeroQuete`, `adresseCible`...), fiche d'un personnage (`Fiche`), monstre (`Monstre`), bits des objets et des sorts ; chaque module ajoute ses variables avec `definirVariables` |
| `module.js` | base des modules : `appeler` une routine d'origine et attendre son retour, `sauter` vers elle, `afficherMessage` |
| `hasard.js` | le générateur de hasard (registre à décalage de 32 bits) |
| `combat.js` | dés de combat, attaque d'un héros, attaque d'un monstre |
| `deplacement.js` | dés de déplacement, fin du déplacement, flèches, les 4 pas, pièges cachés, téléports des quêtes 10 et 16, clic sur le plateau, chemin automatique |
| `tour.js` | tour d'un personnage : préparation, tempête, réveil d'un héros endormi, boucle du tour ; clic sur une zone du panneau, fin du tour |
| `inventaire.js` | liste des objets d'une page (bits de la fiche vers la liste, objets en service), règles d'un clic sur un objet (armures, armes, artefacts, potions, eau bénite) |
| `messages.js` | numéros des messages utilisés, avec leur texte |
| `adresses.gen.js` | adresse de chaque routine nommée, générée par `outils/adresses.py` depuis `original/symboles.txt` |
| `routines.js` | branchement : adresse d'origine -> méthode, registres rendus aux appelants, temps compté |

Réécrites à ce jour (QUEST.EXE), 36 routines :

- hasard et combat : `hasard`, `de6_moins_un`, `de_combat`, `compte_cranes`, `calcule_des_monstre`, `bonus_attaque_heros`, `calcule_defense_heros`, `calcule_attaque_heros`, `attaque_heros`, `combat_monstre`, `attaque_contre_heros` ;
- déplacement : `des_deplacement_tour`, `tirage_deplacement` (avec `lancer_deplacement`), `fin_deplacement`, `arrete_deplacement`, `fleches_deplacement`, `pas_gauche`, `pas_droite`, `pas_haut`, `pas_bas` (avec `pas_fait`, `personnage_en_dx`, `porte_reveille`), `pas_automatique`, `clic_plateau`, `chemin_heros` (avec `chemin_essaie` et `pas_permis`), `tire_teleport`, `entre_piege` ;
- tour d'un personnage : `tour_personnage`, `commandes_tour`, `clic_tour`, `zone_panneau`, `fin_tour` ;
- inventaire : `numero_bit`, `liste_bits`, `marque_en_service`, `marque_objet`, `eau_benite_case`, `utilise_objet` (règles d'un clic sur un objet ; déclarée comme routine dans `symboles.txt` le 27 novembre 2026, c'était un bloc de `inventaire_sorts`). Reste de l'inventaire, encore généré : l'écran (`inventaire_sorts`, `dessine_objets`, `barre_texte`), le choix d'un sort et le génie, la trousse à outils (`piege_case`).

Les bogues de l'original rencontrés en route sont dans [bogues-reecriture.md](../original/notes/bogues-reecriture.md) : le code lisible les reproduit.

Deux sortes de routines :

- d'un seul tenant : une méthode qui ne fait que calculer (`Combat.calculerDefenseHeros`). Elle rend les registres que ses appelants lisent (champ `sortie`), pas les drapeaux du processeur ;
- par étapes : une méthode génératrice (`*attaqueHeros`), pour une routine qui attend le joueur, l'écran ou une animation. `yield* this.appeler(QUEST.charge_men)` pose sur la pile du programme une adresse de retour réservée (`RETOUR_LISIBLE`, 0xFFF0), exécute la routine d'origine au rythme du temps réel, et reprend la méthode quand elle revient. Une méthode qui finit par `return this.sauter(QUEST.fin_action)` continue par un saut, comme le `jmp` d'origine.

Le temps du jeu avance du nombre moyen d'instructions de la version générée (champ `cout`), à quelques instructions près selon le chemin suivi : le rythme reste celui de l'original, pas au cycle près.

Pour réécrire une routine : lire son listing dans `original/asm/quest.asm` (`python desassembler.py QUEST` s'il manque), écrire la méthode dans le module du sous-système, l'ajouter à `routines.js`, puis la comparer.

Vérifier, depuis `outils/` :

```bash
node lisible.mjs 100                         # chaque routine réécrite contre sa version générée, 100 états au hasard
node lisible.mjs 40 attaque_heros            # une seule routine
TEMOIN=e0e node lisible.mjs 60 attaque_heros # compte aussi les cas où DS:0E0E change (chemin rare couvert ?)
GENERE=1 node essai.mjs 5 gen.png "…"        # le même parcours avec le code généré seul, pour comparer les captures
```

`lisible.mjs` mène d'abord le jeu jusqu'au plateau de la 1re quête, puis tire au hasard la graine, les fiches, le monstre visé, l'état du tour et les alentours du héros (murs, portes, occupants, zones), avec des scénarios ciblés (voie libre, piège caché, téléport du château, pièce tournante). Il compare toute la mémoire (données, écran, images), sauf la pile. Les boîtes de message et les attentes de clic reçoivent des clics simulés (droit, ou gauche sur OUI), réglés sur le nombre de lectures de la souris et non sur le temps, qui diffère de quelques instructions entre les deux versions.

Le champ `fin` d'une routine peut être une liste d'adresses : `utilise_objet` finit vers la page d'objets, sa boucle, ou la fermeture de l'inventaire.

Au 27 novembre 2026 : les 6 routines de l'inventaire sont identiques sur 100 cas chacune, et `utilise_objet` sur 600 cas (toutes les règles couvertes : refus de Sir Ragnar, bouclier et hache, potion déjà bue, héroïque, curative, eau bénite qui tue ou gaspillée, trousse à outils, sorts). Au 18 novembre 2026 : les 25 routines sont identiques sur 100 cas chacune (seconde attaque du poison d'orc, pas réussis, portes, pièges cachés et téléport du château couverts), et un parcours avec lancer de dés, clics sur le plateau et sur les 4 flèches donne la même image qu'avec le code généré seul.

## État de la partie

`jeu/vue/etat.js` lit la partie en cours dans la mémoire du jeu et la rend sous forme d'objet JavaScript simple, sans référence à la mémoire et sans rien y écrire. C'est la base de l'inspecteur et de la vue moderne (phase 5 de la [roadmap](../ROADMAP.md)). Toutes les lectures passent par `jeu/lisible/donnees.js`.

La lecture se fait dans le segment de données du jeu (`machine.L + 0x97C`), pas avec le DS du moment : le code d'origine change DS par moments (décompression, copies d'images), et une image du navigateur peut tomber à cet instant.

`lireEtat(machine)` renvoie :

| Champ | Contenu |
| --- | --- |
| `quete` | numéro de la quête (0 = la 1re) |
| `graine` | registre du hasard (DS:38FD, 4 octets, le premier en haut) |
| `personnageCourant` | personnage qui joue, ou qui a joué en dernier (0 à 4) ; le tour des monstres se lit dans la pile d'appels (`phaseDuJeu`, ci-dessous) |
| `desDeplacement`, `deplacementRestant` | dés de déplacement du tour, cases qu'il reste à parcourir |
| `combat` | `cranes`, `boucliers` du dernier combat |
| `plateau.cases` | 26 × 19 cases, rangées `y × 26 + x` : `zone`, `vue`, `bordVu`, les 4 bords (`haut`, `gauche`, `bas`, `droite` : `mur`, `porte` avec `ouverte` et `secrete`) et `occupant` |
| `heros` | fiches présentes : `numero`, `type` et `nomType`, `x`, `y`, `zone`, points de corps et d'esprit, dés d'attaque et de défense, `or` |
| `monstres` | enregistrements non vides : `numero`, `type` et `nomType`, `x`, `y`, `zone`, `vu`, `vivant`, `reveille`, `passeSonTour`, `endormi` |

Un occupant a une `sorte` : `monstre` (avec son `numero` dans `monstres`), `éboulis`, `piège` (avec `cache` pour une fosse non trouvée), `escalier`, `meuble` (`nom` ; `suite` pour les cases supplémentaires d'un meuble). Les pièges cachés et les portes secrètes sont présents dans l'état : c'est à la vue de ne pas montrer ce que les héros n'ont pas trouvé.

Pour l'écrire en JSON à la fin d'un essai (ici au début de la 1re quête) :

```bash
ETAT=etat.json node essai.mjs 5 plateau.png "clic:68:128,attendre:3,clic:160:44,attendre:4,clic:160:180,attendre:4"
```

`jeu/vue/pile.js` lit la pile d'appels du programme (`pileAppels`, estimée : les mots de la pile qui suivent un `call` dans le code) et en déduit `phaseDuJeu(machine)` : `ecran` vaut `plateau` pendant une partie (`tour_personnage` ou `tour_morcar` en cours), `inventaire` (`inventaire_sorts`), ou `autre` ; `tour` vaut `heros` ou `monstres`. Aucune variable du segment de données ne donne l'écran : `zones_actives` reste sur le panneau après la fin d'une quête.

`jeu/vue/messages.js` relit le texte d'un message dans le fichier de textes en mémoire (`lireMessage`) et peut noter chaque appel de `affiche_message` (`journaliserMessages`, qui remplace l'entrée de la routine dans la table).

## Inspecteur

`index.html?inspecteur` (ou `?inspecteur=1`) ajoute un panneau à droite de l'écran du jeu, en dessous sur un écran de moins de 900 px. Il est rafraîchi tous les dixièmes de seconde et ne fait que lire la mémoire. Sans le paramètre, `jeu/vue/inspecteur.js` n'est pas chargé.

| Partie | Contenu |
| --- | --- |
| En-tête | quête, personnage courant ou tour de Morcar, routine en cours (nom de `symboles.txt`) et IP |
| Pile d'appels | estimée : les mots de la pile du programme qui suivent un `call` proche (E8 ou FF /2) dans le code, de la plus récente à la plus ancienne, et les routines lisibles par étapes en cours, marquées « (lisible) ». Une donnée de la pile qui ressemble à une adresse de retour peut s'y glisser |
| Hasard | nombre de tirages depuis l'ouverture du panneau, dernier tirage (1 à max, résultat, registre avant et après) et registre actuel (DS:38FD). Le suivi passe par `Hasard.observateur` de `jeu/lisible/hasard.js` : avec `?genere`, seul le registre est montré |
| Héros, monstres vus | fiches présentes (personnage courant en jaune), monstres vus et vivants |
| Plateau | les trois grilles (zones, murs et portes, occupants), une case par 8 px ; le survol d'une case la détaille |

`machine.js` garde le fond de la pile au chargement (`spDepart`) pour que la lecture de la pile s'y arrête.

## Vue moderne

Le bouton sous l'écran, ou la touche F9, passe de l'écran d'origine à la vue moderne (`jeu/vue/plateau.js`) ; le choix est gardé dans le navigateur, et `?vue=moderne` ou `?vue=origine` le forcent sans le garder. Pendant une partie, sur le plateau, un canvas dessine la partie en isométrique (cases de 64 × 32), avec à droite (en dessous en portrait) un panneau : tour en cours (héros ou Morcar), fiches des héros avec leur portrait (`vue/images/portraits/`), dés de déplacement et du dernier combat, journal des 6 derniers messages. L'écran d'origine passe en petit dans le coin du plateau, toujours jouable : pour l'instant, on joue sur lui. L'inventaire, les menus et les autres écrans restent ceux d'origine, en grand (`phaseDuJeu`, confirmée sur 3 images de suite). La vue moderne ne fait que lire `lireEtat` à chaque image ; les règles et les dés restent ceux du code d'origine (décision D6 de la roadmap).

- Seuls les murs du fond (bords haut et gauche de chaque case) sont dessinés ; une case dont seul le bord est connu n'a qu'un muret.
- On ne montre que ce que les héros ont vu : cases vues, monstres vus et vivants, pièges trouvés, portes secrètes ouvertes (une porte secrète cachée est dessinée comme un mur).
- La caméra suit le personnage courant.
- Images de l'atlas (`vue/images/atlas.json`) quand il existe ; sinon, ou pour une image absente, des formes simples (losanges, pans de mur, blocs, figurines).

## Graphismes de la vue moderne

La vue moderne (phase 5) utilise des images créées pour le projet, versionnées dans `vue/images/` : `atlas.png` et `atlas.json` (nom -> `x`, `y`, `l`, `h`, `ancrage` en pixels, point de pose de l'image sur sa case). Elles sont découpées dans les planches de `graphismes/planches/` par `outils/decouper-planches.py`, d'après `outils/planches.json` ; les prompts sont dans [docs/prompts-interface.md](../docs/prompts-interface.md).

## Son

Le pilote d'origine (`ADLIB.DRV`) n'est pas exécuté dans la page. Ses morceaux sont rendus une fois en WAV, depuis `outils/` :

```bash
python son.py        # fait jouer chaque morceau par ADLIB.DRV (Unicorn) et relève les écritures dans la puce
node sons.mjs        # les rend en WAV avec opl2.mjs, émulateur de la puce OPL2 écrit pour le projet
```

| Fichier | Contenu |
| --- | --- |
| `morceau00.wav` | la musique, 603 s ; elle n'a pas de boucle globale (chaque voix boucle à sa façon) : la page la rejoue depuis le début |
| `morceau02.wav`, `06`, `08`, `05`, `09` | pas, dés, clic, gros plan du combat, sort et piège |

Le morceau 3 (porte) ne fait qu'arrêter une note : avec l'AdLib, une porte qui s'ouvre est muette, comme dans l'original. Le rendu suit le fonctionnement de la puce décrit par Nuked-OPL3 (tables, enveloppes, vibrato, trémolo, mode rythmique) ; les hauteurs ont été vérifiées par analyse de fréquence, pas encore à l'oreille contre DOSBox-X. Le MP3 demanderait un encodeur (lame ou ffmpeg), absent pour l'instant.

## Vérifier

Depuis `outils/` (prérequis : `pip install capstone unicorn`, Node 22 ou plus) :

```bash
python recompiler.py QUEST        # puis INTRO : régénère jeu/*.gen.js
node essai.mjs 5 menu.png "clic:68:128,attendre:3,clic:160:44,attendre:4"   # le jeu sans navigateur
PROGRAMME=INTRO node essai.mjs 15 intro.png "espace,attendre:8"             # l'intro
node navigateur.mjs "http://127.0.0.1:8765/?sans-intro&debug" page.png "attendre:5,clic:163:130"  # dans Chrome
```

Le test différentiel de chaque instruction traduite contre un vrai x86 (`difference.py`, retiré le 20 novembre 2026, dans l'historique git) donnait au 18 novembre 2026 : QUEST 146 660 cas, INTRO 67 400 cas, 0 écart.

## Limites

- Son : morceaux préenregistrés ; un effet se mêle à la musique au lieu de lui prendre le canal 0 comme sur la vraie puce.
- Joystick non émulé (le port 201h répond « rien de branché »).
- Les modes EGA et Tandy du jeu ne sont pas émulés : un seul affichage, le VGA.
- Les écrans n'ont pas encore été comparés pixel à pixel avec des captures de DOSBox-X.
