// Version PC (Electron) : la page de web/ dans une fenêtre, sans serveur PHP.
// Le protocole app:// sert web/ et joue le rôle de fichiers.php : il lit les fichiers du jeu
// dans jeu/ (ou dans les ressources du .exe) et garde QUEST.SAV et QUEST.CFG dans le dossier
// de l'utilisateur. Pour un usage personnel : le .exe contient le jeu d'origine, ne pas le distribuer.
//   npm start          lancer
//   npm start -- --dev avec les outils de développement
//   npm run dist       fabriquer le .exe (dist/)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, net, protocol } from 'electron';
import { ecrireArchive } from '../web/jeu/archive.js';

const ici = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ici, '..', 'web');
const JEU = app.isPackaged ? path.join(process.resourcesPath, 'jeu') : path.join(ici, '..', 'jeu');
const SAUVEGARDES = () => path.join(app.getPath('userData'), 'sauvegardes');
const DEV = process.argv.includes('--dev') && !app.isPackaged;

// Comme fichiers.php : un seul affichage (VGA) et un seul son (AdLib) ; seuls ces fichiers s'écrivent.
const ECARTES = /\.(EGA|PIF|MD)$|^(TANDY|MT32)\.DRV$/;
const ECRITS = ['QUEST.SAV', 'QUEST.CFG'];
const NOM_VALIDE = /^[A-Z0-9&_-]{1,8}\.[A-Z0-9]{1,3}$/;
const ECRAN = { largeur: 1024, hauteur: 768 };   // 320 x 200 en 4/3

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Le nom réel d'un fichier, quelle que soit sa casse : la sauvegarde d'abord, puis le jeu.
function chemin(nom) {
  for (const dossier of [SAUVEGARDES(), JEU]) {
    if (!fs.existsSync(dossier)) continue;
    const trouve = fs.readdirSync(dossier).find((f) => f.toUpperCase() === nom);
    if (trouve) return path.join(dossier, trouve);
  }
  return null;
}

function archiveDuJeu() {
  if (!fs.existsSync(JEU)) throw new Error(`fichiers du jeu introuvables : ${JEU}`);
  const noms = new Set(fs.readdirSync(JEU).map((f) => f.toUpperCase())
    .filter((n) => NOM_VALIDE.test(n) && !ECARTES.test(n)));
  for (const n of ECRITS) if (fs.existsSync(path.join(SAUVEGARDES(), n))) noms.add(n);
  return ecrireArchive([...noms].map((n) => [n, new Uint8Array(fs.readFileSync(chemin(n)))]));
}

const binaire = (octets) => new Response(octets, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-cache' } });

async function fichiersPhp(requete, adresse) {
  const nom = (adresse.searchParams.get('nom') || '').toUpperCase();
  if (!nom) return binaire(archiveDuJeu());
  if (!NOM_VALIDE.test(nom)) return new Response(null, { status: 400 });
  if (requete.method === 'POST') {
    if (!ECRITS.includes(nom)) return new Response(null, { status: 403 });
    fs.mkdirSync(SAUVEGARDES(), { recursive: true });
    fs.writeFileSync(path.join(SAUVEGARDES(), nom), Buffer.from(await requete.arrayBuffer()));
    return new Response(null, { status: 204 });
  }
  const trouve = chemin(nom);
  return trouve ? binaire(fs.readFileSync(trouve)) : new Response(null, { status: 404 });
}

function servir() {
  protocol.handle('app', (requete) => {
    const adresse = new URL(requete.url);
    const relatif = decodeURIComponent(adresse.pathname).replace(/^\/+/, '') || 'index.html';
    if (relatif === 'fichiers.php') return fichiersPhp(requete, adresse);
    const fichier = path.resolve(WEB, relatif);
    if (!fichier.startsWith(WEB + path.sep)) return new Response(null, { status: 403 });
    return net.fetch(`file://${fichier.replace(/\\/g, '/')}`);
  });
}

function ouvrirFenetre() {
  const fenetre = new BrowserWindow({
    width: ECRAN.largeur,
    height: ECRAN.hauteur + 40,
    useContentSize: true,
    backgroundColor: '#000000',
    title: 'HeroQuest 1991',
    icon: path.join(WEB, 'icones', 'icone-512.png'),
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  fenetre.once('ready-to-show', () => fenetre.show());
  fenetre.webContents.on('before-input-event', (evenement, touche) => {
    if (touche.type === 'keyDown' && touche.key === 'F11') {
      evenement.preventDefault();
      fenetre.setFullScreen(!fenetre.isFullScreen());
    }
  });
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const options = process.argv.find((a) => a.startsWith('--options='));    // par exemple --options=sans-intro
  fenetre.loadURL(`app://jeu/index.html${options ? `?${options.slice('--options='.length)}` : ''}`);
  if (DEV) fenetre.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  servir();
  ouvrirFenetre();
});
app.on('window-all-closed', () => app.quit());
