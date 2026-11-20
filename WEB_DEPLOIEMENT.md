# Version web publiée et mobile

Comment le portage est publié sur GitHub Pages et se joue sur téléphone (tactile, hors ligne), sans publier quoi que ce soit du jeu d'origine.

## Principe

Le site publié ne contient que le moteur : `web/` sans le service PHP, sans le code traduit (`*.gen.js`) ni les sons. Tout ce qui vient du jeu de 1991 arrive dans un paquet de données, fabriqué sur le PC depuis sa propre copie du jeu, importé une fois sur le téléphone et gardé sur l'appareil.

```text
PC                                          GitHub                          Téléphone
--                                          ------                          ---------
git push (web/ modifié) ------------------> Actions « Pages »
                                              construire-site.mjs -> _site/
                                              déploiement Pages ----------> https://magend-salocin.github.io/heroquest_1991/
                                                                            « Sur l'écran d'accueil »
node outils/paquet.mjs
  -> paquet/heroquest-donnees.bin (16 Mo) --- iCloud Drive, AirDrop… ---->  import dans la page (une fois)
                                                                            jeu en cache : marche hors ligne
```

## Mise en route (une fois)

1. Pousser le dépôt sur GitHub (branche `main`).
2. Sur GitHub : Settings > Pages > Source : **GitHub Actions**. Le dépôt doit être public pour avoir Pages gratuitement.
3. Onglet Actions > Pages > Run workflow (ou pousser une modification de `web/`). L'adresse du site s'affiche à la fin du workflow.
4. Sur le PC, depuis `outils/` : `node paquet.mjs` (prérequis : `jeu/` rempli, `recompiler.py QUEST` et `INTRO`, et pour le son `son.py` puis `node sons.mjs`).
5. Envoyer `paquet/heroquest-donnees.bin` sur le téléphone (iCloud Drive, AirDrop, câble).
6. Sur le téléphone : ouvrir le site dans Safari, Partager > « Sur l'écran d'accueil », puis lancer depuis l'icône et choisir le paquet. Faire l'import depuis l'icône, pas depuis Safari : les deux ont des données séparées.

## Au quotidien

| Besoin | Commande ou action |
| --- | --- |
| Jouer sur PC, en local | `php -S 127.0.0.1:8765 -t web` depuis la racine, puis `http://127.0.0.1:8765/` |
| Essayer le mode téléphone sur PC | `http://127.0.0.1:8765/?paquet=…&tactile` (voir « Essayer ») |
| Publier une nouvelle version | `git push` sur `main` avec des changements dans `web/` |
| Mettre à jour le paquet (code régénéré, sons) | `node paquet.mjs`, puis sur le téléphone `?importer` à la fin de l'adresse ou réinstaller l'icône |
| Repartir de zéro sur le téléphone | Réglages > Safari > Avancé > Données de sites : supprimer le site (ou supprimer l'icône) |

Une nouvelle version publiée est téléchargée au lancement suivant avec réseau, et utilisée au lancement d'après. Les sauvegardes (`QUEST.SAV`, `QUEST.CFG`) restent sur l'appareil, à côté du paquet.

## Les briques

| Fichier | Rôle |
| --- | --- |
| `web/jeu/principal.js` | Choisit la source : le serveur PHP s'il répond (local), sinon le paquet de l'appareil, sinon l'écran d'import ; entrées souris, tactiles et clavier ; enregistre le service worker |
| `web/jeu/paquet.js` | Import du paquet (gzip), vérification, stockage dans IndexedDB avec les sauvegardes ; charge le code traduit depuis le paquet (`import()` d'un blob) |
| `web/jeu/archive.js` | Format d'archive commun à `fichiers.php` et au paquet |
| `web/jeu/tactile.js` | Boutons Clic droit, Clavier (clavier de l'appareil pour le nom des héros), Son (F10) |
| `web/sw.js` | Service worker : cache des fichiers du site, cache d'abord, suppression des anciennes versions |
| `web/manifest.webmanifest`, `web/icones/` | Installation sur l'écran d'accueil (plein écran, icône) |
| `outils/construire-site.mjs` | Construit `_site/` : `web/` sans `fichiers.php`, `sauvegardes/`, `sons/`, `*.gen.js` ; écrit `precache-manifest.js` (version = empreinte du contenu). Refuse de construire si un fichier du jeu d'origine s'y trouve |
| `outils/paquet.mjs` | Fabrique `paquet/heroquest-donnees.bin` : fichiers VGA et AdLib de `jeu/`, `quest.gen.js`, `intro.gen.js`, `sons/*.wav` |
| `.github/workflows/pages.yml` | Construit et déploie à chaque push sur `main` qui touche `web/` ou la construction ; le reste du dépôt (notes, outils d'étude) ne déclenche rien |

## Commandes tactiles

Affichées sur un écran tactile (`pointer: coarse`), sous l'écran en portrait et à droite en paysage. Forcées par `?tactile`, masquées par `?sans-tactile`.

| Geste | Effet dans le jeu |
| --- | --- |
| Toucher l'écran | Le curseur va sous le doigt, puis clic gauche (appui tenu au moins 150 ms, car le jeu lit l'état des boutons sans mémoriser les clics) |
| Glisser sur l'écran | Le curseur suit le doigt, le bouton reste appuyé |
| Clic droit | Bouton droit tenu tant que le doigt reste sur le bouton |
| Clavier | Ouvre le clavier de l'appareil ; les lettres, chiffres, espace, effacement et Entrée sont envoyés au jeu |
| Son (F10) | Coupe la musique et active les effets, comme dans l'original |
| Passer l'intro | Comme Échap pendant l'intro |

Le son ne démarre qu'au premier toucher (règle des navigateurs).

## Essayer

Le site tel que publié, sans PHP, avec le paquet servi à côté (dossier temporaire hors du dépôt) :

```bash
node outils/construire-site.mjs && node outils/paquet.mjs
cp -r _site /tmp/site && cp paquet/heroquest-donnees.bin /tmp/site/
php -S 127.0.0.1:8777 -t /tmp/site
# http://127.0.0.1:8777/?paquet=heroquest-donnees.bin&tactile&sans-intro
```

`?paquet=adresse` importe le paquet depuis cette adresse au lieu de demander un fichier. Ne jamais mettre le paquet dans `web/` ni dans `_site/` du dépôt.

Le service worker ne s'enregistre ni sur `localhost` ni sur `127.0.0.1` (le cache masquerait les modifications) : le hors ligne ne se vérifie que sur le site publié, en mode avion.

## Dépôt public : précautions

- Rien de Gremlin ou Hasbro dans le dépôt ni sur le site : ni fichiers d'origine, ni code traduit, ni images, sons ou textes extraits. `.gitignore` et le garde-fou de `construire-site.mjs` y veillent ; vérifier `git status` avant chaque commit.
- Le paquet de données reste privé : ne pas le publier, ne pas le partager.
- Un fichier commité par erreur reste dans l'historique : le retirer avec `git filter-repo --path <chemin> --invert-paths`, puis `git push --force`, après avoir sauvegardé le dépôt (`git bundle create sauvegarde.bundle --all`).
- Sans licence, le code reste « tous droits réservés ».
- L'adresse e-mail des commits est publique : activer l'adresse masquée de GitHub (Settings > Emails).

## Problèmes connus

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Écran d'import à chaque lancement | Paquet importé dans Safari mais jeu lancé depuis l'icône (ou l'inverse) | Importer depuis l'icône |
| Données effacées après des semaines sans jouer | Safari peut vider le stockage des sites peu utilisés ; la page demande un stockage persistant, sans garantie | Réimporter le paquet ; garder une copie de `QUEST.SAV` si besoin |
| Site en 404 | Pages désactivé, ou workflow pas encore lancé | Settings > Pages > Source : GitHub Actions, puis relancer le workflow |
| Import refusé (« pas un paquet ») | Fichier décompressé ou renommé par l'appareil | Renvoyer `heroquest-donnees.bin` tel quel |
| Clés d'accès par appareil (comme Bestiora Azur) | Non reprises : le site ne contient rien à protéger, le paquet reste privé | À ajouter si le site doit un jour être réservé |
