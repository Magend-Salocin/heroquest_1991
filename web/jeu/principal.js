// Page du jeu : charge les fichiers d'origine, puis enchaîne les programmes comme HERO.EXE :
// INTRO.EXE, puis QUEST.EXE. La machine tourne au rythme du temps réel ; souris, écran tactile
// et clavier lui sont transmis.
// Deux sources pour les fichiers du jeu, le code traduit et les sons :
//   - en local, le serveur PHP (fichiers.php, jeu/*.gen.js, sons/) ;
//   - sur le site publié, qui n'en contient rien, le paquet de données importé sur l'appareil (paquet.js).
// Un seul affichage (VGA) et un seul son (AdLib) : la page fournit QUEST.CFG avec ces choix,
// si bien que l'intro ne pose pas ses questions de configuration.
//   index.html?sans-intro   lance directement QUEST.EXE (pendant l'intro : Échap ou le bouton)
//   index.html?langue=en    langue des textes : fr (par défaut), en, es, de, it
//   index.html?debug        affiche le temps de jeu et l'IP sous l'écran
//   index.html?genere       code généré seul, sans les routines réécrites de lisible/
//   index.html?paquet       ignore le serveur PHP et utilise le paquet de l'appareil (pour essayer)
//   index.html?paquet=URL   importe le paquet depuis cette adresse
//   index.html?importer     propose d'importer un autre paquet
//   index.html?tactile, ?sans-tactile   force ou masque les commandes tactiles

import { Machine, INSTRUCTIONS_PAR_MS } from './machine.js';
import { codeClavier, asciiDe } from './clavier.js';
import { Son } from './son.js';
import { brancherRoutines } from './lisible/routines.js';
import { lireArchive } from './archive.js';
import { chargerPaquet, importerPaquet } from './paquet.js';
import { commandesTactilesVoulues, brancherCommandesTactiles } from './tactile.js';

// VGA, AdLib, souris, français, souris pour les 4 joueurs (format : notes/01-socle.md)
const CONFIGURATION = Uint8Array.from([8, 0, 1, 0, 1, 0, 0, 0, 0]);
const VGA = 8;
const PILOTE_ADLIB = 1;
const LANGUES = { en: 0, fr: 1, es: 2, de: 3, it: 4 };   // ordre des fichiers de textes du jeu
// « Press S to change config » : S rouvrirait les questions (écran, carte son) et l'écran EGA des drapeaux.
const TOUCHE_S = 0x1f;
const RETARD_MAX_MS = 100;
// Le jeu lit l'état des boutons (int 33h AX=3) sans mémoriser les clics : un appui plus court
// qu'une image passerait inaperçu, et un doigt doit d'abord amener le curseur sur la cible.
const DUREE_MIN_APPUI_MS = 150;
const DELAI_APPUI_TACTILE_MS = 40;
const DUREE_TOUCHE_MS = 60;
const OPTIONS = new URLSearchParams(location.search);

const ecran = document.querySelector('#ecran');
const console_ = document.querySelector('#texte');
const etat = document.querySelector('#etat');
const contexte = ecran.getContext('2d');
const image = contexte.createImageData(320, 200);
let machine = null;                                  // programme en cours, pour les entrées
let programme = null;

// ---- Sources des données

async function chargerDepuisServeur() {
  let reponse;
  try {
    reponse = await fetch('fichiers.php');
  } catch {
    return null;                                     // hors ligne
  }
  if (!reponse.ok || !(reponse.headers.get('Content-Type') || '').startsWith('application/octet-stream')) return null;
  const fichiers = lireArchive(new Uint8Array(await reponse.arrayBuffer()));
  fichiers.sauver = (nom, octets) => {
    fetch(`fichiers.php?nom=${encodeURIComponent(nom)}`, { method: 'POST', body: octets })
      .catch((e) => console.error('sauvegarde impossible', e));
  };
  return {
    fichiers,
    programme: (nom) => (nom === 'INTRO' ? import('./intro.gen.js') : import('./quest.gen.js')),
    lireMorceau: (fichier) => fetch(`sons/${fichier}`).then((r) => (r.ok ? r.arrayBuffer() : null)),
  };
}

// Écran d'import : attend qu'un paquet valide soit choisi et gardé.
function demanderPaquet(message) {
  const section = document.querySelector('#import');
  const choix = document.querySelector('#fichier-paquet');
  const erreur = document.querySelector('#erreur-import');
  section.hidden = false;
  ecran.hidden = true;
  etat.textContent = '';
  erreur.textContent = message || '';
  return new Promise((fini) => {
    choix.addEventListener('change', async function importer() {
      const fichier = choix.files[0];
      if (!fichier) return;
      erreur.textContent = 'Import en cours…';
      try {
        await importerPaquet(await fichier.arrayBuffer());
        choix.removeEventListener('change', importer);
        section.hidden = true;
        ecran.hidden = false;
        fini();
      } catch (e) {
        erreur.textContent = `Import impossible : ${e.message}`;
        choix.value = '';
      }
    });
  });
}

async function chargerDonnees() {
  if (!OPTIONS.has('paquet') && !OPTIONS.has('importer')) {
    const serveur = await chargerDepuisServeur();
    if (serveur) return serveur;
  }
  const adresse = OPTIONS.get('paquet');
  if (adresse) {
    etat.textContent = 'Téléchargement du paquet de données…';
    await importerPaquet(await (await fetch(adresse)).arrayBuffer());
  } else if (OPTIONS.has('importer')) {
    await demanderPaquet();
  }
  let paquet = await chargerPaquet();
  if (!paquet) {
    await demanderPaquet();
    paquet = await chargerPaquet();
  }
  return paquet;
}

// ---- Entrées

const appuis = { 1: null, 2: null };                 // bouton -> { debut, relache }

function appuyerBouton(bit) {
  if (!machine) return;
  if (appuis[bit]) clearTimeout(appuis[bit].relache);
  appuis[bit] = { debut: performance.now(), relache: null };
  machine.souris.boutons |= bit;
}

function relacherBouton(bit) {
  const appui = appuis[bit];
  if (!appui || appui.relache !== null) return;
  const reste = DUREE_MIN_APPUI_MS - (performance.now() - appui.debut);
  appui.relache = setTimeout(() => {
    if (machine) machine.souris.boutons &= ~bit;
    if (appuis[bit] === appui) appuis[bit] = null;
  }, Math.max(0, reste));
}

// Une touche du PC appuyée puis relâchée (commandes tactiles).
function taper(touche, ascii) {
  const code = codeClavier(touche);
  if (!machine || code === undefined) return;
  if (programme === 'INTRO' && touche === 'Escape') { passerIntro(); return; }
  machine.appuyer(code);
  machine.toucheBios(ascii, code);
  setTimeout(() => machine && machine.relacher(code), DUREE_TOUCHE_MS);
}

function brancherEntrees() {
  const position = (e) => {
    const r = ecran.getBoundingClientRect();
    machine.souris.x = Math.max(0, Math.min(639, Math.floor(((e.clientX - r.left) / r.width) * 640)));
    machine.souris.y = Math.max(0, Math.min(199, Math.floor(((e.clientY - r.top) / r.height) * 200)));
  };
  let doigt = null;                                  // toucher en cours : { id, appui }

  ecran.addEventListener('pointerdown', (e) => {
    if (!machine) return;
    e.preventDefault();
    position(e);
    if (e.pointerType === 'mouse') {
      appuyerBouton(e.button === 2 ? 2 : 1);
      return;
    }
    try { ecran.setPointerCapture(e.pointerId); } catch { /* pointeur déjà levé */ }
    doigt = { id: e.pointerId, appui: setTimeout(() => appuyerBouton(1), DELAI_APPUI_TACTILE_MS) };
  });
  ecran.addEventListener('pointermove', (e) => {
    if (machine && (e.pointerType === 'mouse' || (doigt && doigt.id === e.pointerId))) position(e);
  });
  const fin = (e) => {
    if (!doigt || doigt.id !== e.pointerId) return;
    clearTimeout(doigt.appui);
    if (!appuis[1]) appuyerBouton(1);                // toucher plus court que le délai : clic quand même
    relacherBouton(1);
    doigt = null;
  };
  ecran.addEventListener('pointerup', fin);
  ecran.addEventListener('pointercancel', fin);
  window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') relacherBouton(e.button === 2 ? 2 : 1); });
  ecran.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.target.id === 'saisie') return;            // clavier de l'appareil : voir tactile.js
    const code = codeClavier(e.code);
    if (!machine || code === undefined) return;
    e.preventDefault();
    if (programme === 'INTRO' && code === TOUCHE_S) return;
    if (programme === 'INTRO' && e.code === 'Escape') { passerIntro(); return; }
    if (!e.repeat) machine.appuyer(code);
    machine.toucheBios(asciiDe(e), code);
  });
  window.addEventListener('keyup', (e) => {
    if (e.target.id === 'saisie') return;
    const code = codeClavier(e.code);
    if (machine && code !== undefined) machine.relacher(code);
  });

  if (commandesTactilesVoulues(OPTIONS)) {
    brancherCommandesTactiles({ appuyerBouton, relacherBouton, taper });
  }
}

// Termine INTRO.EXE comme s'il rendait la main (int 21h AH=4Ch) : la page lance QUEST.EXE.
function passerIntro() {
  if (programme === 'INTRO' && machine.arret === null) machine.arret = 0;
}

// ---- Exécution

// Fait tourner un programme jusqu'à sa fin (int 21h AH=4Ch) ; rend son code de sortie.
async function executer(nom, donnees, son) {
  const { routines, CODE_REECRIT } = await donnees.programme(nom);
  const m = new Machine({ fichiers: donnees.fichiers, routines, codeReecrit: CODE_REECRIT });
  if (nom === 'QUEST' && !OPTIONS.has('genere')) brancherRoutines(m.table);
  m.charger(`${nom}.EXE`);
  machine = m;
  programme = nom;
  m.son = son;
  return new Promise((fini, echec) => {
    let precedent = performance.now();
    const image_suivante = (maintenant) => {
      const ecoule = Math.min(RETARD_MAX_MS, maintenant - precedent);
      precedent = maintenant;
      try {
        m.executer(Math.round(ecoule * INSTRUCTIONS_PAR_MS));
      } catch (erreur) {
        echec(erreur);
        return;
      }
      afficher(m);
      if (OPTIONS.has('debug')) etat.textContent = `${nom} t = ${(m.t / INSTRUCTIONS_PAR_MS / 1000).toFixed(1)} s, IP ${m.ip.toString(16)}`;
      if (m.arret !== null) fini(m.arret);
      else requestAnimationFrame(image_suivante);
    };
    requestAnimationFrame(image_suivante);
  });
}

function afficher(m) {
  const graphique = m.mode === 0x13;
  ecran.hidden = !graphique;
  console_.hidden = graphique;
  if (graphique) {
    m.peindre(image.data);
    contexte.putImageData(image, 0, 0);
  } else {
    console_.textContent = m.texte();
  }
}

// La configuration enregistrée (commandes des joueurs), avec VGA, AdLib et la langue demandée.
function configuration(enregistree) {
  const cfg = (enregistree && enregistree.length === 9 ? enregistree : CONFIGURATION).slice();
  cfg[0] = VGA;
  cfg[1] = 0;
  cfg[2] = PILOTE_ADLIB;
  const langue = LANGUES[OPTIONS.get('langue')];
  if (langue !== undefined) cfg[4] = langue;
  return cfg;
}

// Mode hors ligne du site publié : le service worker garde les fichiers du site en cache.
// Seulement en HTTPS : ni en local (le cache masquerait les modifications), ni dans Electron (app://).
function enregistrerHorsLigne() {
  if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('mode hors ligne indisponible', e));
  }
}

async function demarrer() {
  enregistrerHorsLigne();
  etat.textContent = 'Chargement des fichiers du jeu…';
  const donnees = await chargerDonnees();
  const son = new Son(donnees.lireMorceau);
  if (OPTIONS.has('debug')) window.jeu = { son, machine: () => machine };   // pour outils/navigateur.mjs
  window.addEventListener('pointerdown', () => son.activer(), { once: true });
  window.addEventListener('keydown', () => son.activer(), { once: true });
  brancherEntrees();
  etat.textContent = '';

  donnees.fichiers.set('QUEST.CFG', configuration(donnees.fichiers.get('QUEST.CFG')));
  if (!OPTIONS.has('sans-intro')) {
    const bouton = document.querySelector('#passer-intro');
    bouton.hidden = false;
    bouton.addEventListener('click', passerIntro);
    await executer('INTRO', donnees, son);
    bouton.hidden = true;
  }
  await executer('QUEST', donnees, son);
  etat.textContent = 'Le jeu est terminé.';
}

demarrer().catch((e) => { etat.textContent = `Arrêt : ${e.message}`; console.error(e); });
