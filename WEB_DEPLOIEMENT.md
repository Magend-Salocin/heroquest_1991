# Version web, iPhone et clés d'activation

Comment Bestiora Azur est publié sur le web, jouable sur iPhone (tactile, hors ligne) et réservé aux testeurs munis d'une clé liée à leur appareil. Le document sert aussi de recette pour reproduire le dispositif dans un autre jeu.

## Vue d'ensemble

```
PC (organisateur)                      GitHub                                 iPhone (testeur)
-----------------                      ------                                 ----------------
npm run key -- init  (une fois)
  clé privée -> access-private-key.local.pem (jamais publiée)
  clé publique -> src/data/access-public-key.js
git push ------------------------------> Actions « Pages »
                                          node tools/build-web.js -> _site/
                                          déploiement GitHub Pages --------->  Safari : https://<compte>.github.io/<dépôt>/
                                                                               « Sur l'écran d'accueil »
                                                                               écran « Test en cours » : identifiant XXXX-XXXX
                         <------------------------------------- identifiant envoyé par message
npm run key -- new XXXX-XXXX "Prénom"
  clé (86 caractères) ------------------------------------------------------>  collée dans le jeu, mémorisée
                                                                               jeu gardé en cache : marche hors ligne
```

Prérequis du jeu : il tourne entièrement dans une page web (canvas, Web Audio, modules ES, aucune dépendance au runtime). Electron n'est qu'une coquille pour la version PC : la version iPhone n'en a pas besoin.

## Utilisation au quotidien

| Besoin | Commande ou action |
|---|---|
| Jouer sur PC | `npm start` |
| Tester sur iPhone sans publier (même Wi-Fi, HTTP, pas de clé, pas de hors ligne) | `npm run web` puis ouvrir l'adresse affichée dans Safari |
| Publier une nouvelle version | `git push` sur `main` (le workflow Pages déploie seul) |
| Donner l'accès à quelqu'un | `npm run key -- new XXXX-XXXX "Prénom"`, envoyer la clé affichée (pas de push) |
| Revoir les clés données | `npm run key -- list` |
| Retirer l'accès | `npm run key -- revoke "Prénom"`, puis commit et push |
| Repartir de zéro sur un appareil | Écran titre > TOUT EFFACER (sauvegarde, options, clé, cache) : un nouvel identifiant apparaît |

Installer sur iPhone : Safari > adresse du site > Partager > « Sur l'écran d'accueil ». Demander l'identifiant depuis l'icône, pas depuis Safari : les deux ont des données séparées.

## Les briques

### 1. Contrôles tactiles

| Fichier | Rôle |
|---|---|
| `src/ui/touch-controls.js` | Croix (on glisse le doigt d'une direction à l'autre), A, B, START, SELECT en HTML par-dessus le canvas |
| `src/engine/input.js` | `setVirtualButton(button, down)` : les boutons tactiles alimentent l'entrée comme des touches |
| `src/styles.css` | Disposition portrait (écran en haut, boutons dessous) et paysage (croix à gauche, A/B à droite), marges `safe-area` de l'iPhone |
| Option TACTILE | AUTO (écran tactile seulement, via `matchMedia('(pointer: coarse)')`), OUI, NON |

`src/index.html` porte les balises iPhone : `viewport` (sans zoom, `viewport-fit=cover`), `apple-mobile-web-app-capable`, `apple-touch-icon`, `manifest.webmanifest`.

### 2. Serveur local (`npm run web`)

`tools/web-server.js` sert seulement `src/`, `assets/` et l'icône, sur toutes les interfaces réseau, et affiche les adresses à ouvrir. Il refuse tout chemin hors de ces dossiers. Utile pour tester avant de publier ; le PC doit rester allumé.

### 3. Publication GitHub Pages

| Fichier | Rôle |
|---|---|
| `.github/workflows/pages.yml` | À chaque push sur `main` : `node tools/build-web.js`, puis déploiement Pages |
| `tools/build-web.js` | Construit `_site/` : `src/` sans `debug/`, `assets/`, icône, page racine qui redirige vers `src/index.html`, liste des fichiers à mettre en cache |
| `tools/pages-index.html` | Page racine du site (redirection) |

Réglage unique sur GitHub : Settings > Pages > Source : **GitHub Actions**. Un dépôt gratuit doit être public pour avoir Pages.

### 4. Mode hors ligne

| Fichier | Rôle |
|---|---|
| `src/sw.js` | Service worker : met en cache tous les fichiers listés, sert le cache d'abord, supprime les anciennes versions |
| `src/precache-manifest.js` | Généré par `build-web.js` (absent du dépôt) : version (empreinte du contenu) et liste des fichiers |
| `src/main.js` (`registerOfflineMode`) | Enregistre le service worker seulement en contexte sécurisé (`window.isSecureContext`) |

Une nouvelle version publiée est téléchargée au lancement suivant avec réseau, puis utilisée au lancement d'après. Safari n'autorise pas de service worker en HTTP : pas de hors ligne avec `npm run web`.

### 5. Clés d'activation liées à l'appareil

Principe : signature numérique. L'organisateur signe l'identifiant de l'appareil avec une clé privée ; le jeu vérifie la signature avec la clé publique. Le code peut être public : sans la clé privée, personne ne fabrique de clé valide, et une clé ne marche que pour l'identifiant signé.

| Fichier | Rôle |
|---|---|
| `src/access/access-keys.js` | Identifiant d'appareil (8 caractères sans 0/O ni 1/I), texte signé `bestiora-azur:device:<ID>`, vérification ECDSA P-256 / SHA-256 avec Web Crypto |
| `src/access/access-gate.js` | Écran blanc « Test en cours » en HTML : identifiant + bouton Copier, champ de clé, mémorisation, revérification à chaque lancement |
| `src/data/access-public-key.js` | Clé publique (JWK), générée par `init`, publiée |
| `src/data/revoked-devices.js` | Identifiants révoqués, générés par `revoke`, publiés |
| `tools/access-key.js` | `init`, `new`, `list`, `revoke` ; signe avec `crypto.sign(..., { dsaEncoding: 'ieee-p1363' })`, le format attendu par Web Crypto |
| `access-private-key.local.pem` | Clé privée : jamais versionnée (`*.local.pem` dans `.gitignore`), à sauvegarder |
| `access-devices.local.json` | Qui a quel appareil et quelle clé : jamais versionné, à sauvegarder |

Règles de l'écran : pas de clé dans Electron (`window.bestiora` présent) ni en HTTP sur le réseau local (pas de Web Crypto hors contexte sécurisé). La clé collée est nettoyée (espaces, retours à la ligne) ; elle est sensible à la casse.

Limites assumées : TOUT EFFACER ou l'effacement des données Safari change l'identifiant (nouvelle clé nécessaire) ; une révocation n'agit qu'après mise à jour du cache ; quelqu'un de déterminé peut copier le jeu et retirer le contrôle dans sa copie.

### 6. TOUT EFFACER (écran titre)

Double confirmation, puis `clearAllData()` (`src/save/save-system.js`) : `localStorage`, `sessionStorage`, caches, désinscription du service worker ; dans Electron, en plus, `save.json`, `save.bak.json`, `options.json` et le stockage de la session (IPC `data:clear`). Le jeu se relance ensuite.

## Transposer dans un autre jeu

1. Vérifier que le jeu tourne dans une page web servie en HTTP simple (pas de `file://` obligatoire, pas d'API Node dans le rendu). Les appels propres à Electron doivent être optionnels (`window.bestiora?.save?.()`), avec repli sur `localStorage`.
2. Copier : `src/access/`, `src/sw.js`, `src/ui/touch-controls.js`, `tools/access-key.js`, `tools/build-web.js`, `tools/pages-index.html`, `tools/web-server.js`, `.github/workflows/pages.yml`, les styles `.touch-*` et `.access-*` de `src/styles.css`.
3. Adapter :
   - le texte signé dans `signedMessage` (`bestiora-azur:` → nom du nouveau jeu), sinon une clé d'un jeu marcherait dans l'autre ;
   - les dossiers copiés par `build-web.js` et servis par `web-server.js` ;
   - les noms des clés de stockage (`bestiora-device-id`, `bestiora-access-key`) et le préfixe du cache (`bestiora-`) ;
   - l'entrée du jeu : brancher `setVirtualButton` sur son propre système d'entrées.
4. Dans le point d'entrée : en version web, `registerOfflineMode()` puis `requireAccessKey().then(boot)`.
5. Compléter `index.html` : balises iPhone, manifeste, et la CSP `manifest-src 'self'; worker-src 'self'`.
6. `.gitignore` : `*.local.json`, `*.local.pem`, `_site/`.
7. `npm run key -- init` (nouvelle paire propre à ce jeu), commit, push, Settings > Pages > Source : GitHub Actions.
8. Tester : `npm run web` sur iPhone (rendu, tactile), puis le site publié (clé, hors ligne en mode avion).

## Problèmes rencontrés et solutions

| Symptôme | Cause | Solution |
|---|---|---|
| Écran noir sur iPhone | `ResizeObserver.observe(..., { box: 'device-pixel-content-box' })` lève une erreur dans Safari | `try/catch` et repli sur `observe(canvas)` avec `devicePixelRatio` (`src/engine/renderer.js`) |
| Site en 404 | Pages désactivé (par exemple après un passage du dépôt en privé) ; le workflow échoue à `configure-pages` | Settings > Pages > Source : GitHub Actions, puis relancer le workflow (onglet Actions > Pages > Run workflow, ou un commit vide) |
| `EADDRINUSE` au lancement de `npm run web` | Un autre serveur occupe déjà le port 8080 | Arrêter l'autre, ou `npm run web -- --port 8081` |
| Electron se comporte comme Node depuis un terminal VS Code | Variable `ELECTRON_RUN_AS_NODE` héritée | La retirer de l'environnement avant de lancer Electron (`tools/run-electron.js`) |
| RECHARGER ne recharge pas dans Electron | `will-navigate` bloque les navigations, rechargement compris | Recharger depuis le processus principal (`webContents.reload()` via IPC) |
| Manifeste ou service worker bloqués | CSP `default-src 'none'` | Ajouter `manifest-src 'self'; worker-src 'self'` |
| Pas de hors ligne avec `npm run web` | Service worker et Web Crypto exigent HTTPS (ou `localhost`) | Normal : le hors ligne et les clés ne concernent que le site publié |
| Clé refusée sur iPhone | Identifiant lu dans Safari mais clé collée dans l'icône (ou l'inverse), ou clé retapée à la main | Tout faire depuis l'icône ; copier-coller la clé |

## Dépôt public : précautions

- Ne publier aucun contenu d'autrui : noms, logos, images ou textes d'une franchise. Les documents de travail qui en contiennent vont dans un dossier ignoré (`prive/`).
- Un fichier supprimé reste dans l'historique : le retirer avec `git filter-repo --path <dossier> --invert-paths`, puis `git push --force`, après avoir sauvegardé le dépôt (`git bundle create sauvegarde.bundle --all`).
- Sans licence, le code reste « tous droits réservés » : on peut le lire et le forker sur GitHub, pas le réutiliser.
- L'adresse e-mail des commits est publique : activer l'adresse masquée de GitHub (Settings > Emails).
- Mention dans le README et sur l'écran de clé : projet personnel, non commercial, à des fins de découverte.
