// Paquet de données de la version publiée (GitHub Pages). Le site ne contient rien du jeu
// d'origine : les fichiers de 1991, le code traduit (*.gen.js) et les sons arrivent dans un
// paquet fabriqué sur le PC (outils/paquet.mjs), importé une fois sur l'appareil et gardé
// dans IndexedDB, avec les sauvegardes (QUEST.SAV, QUEST.CFG).

import { lireArchive } from './archive.js';

const BASE = 'heroquest-1991';
const MAGASIN = 'donnees';
const CLE_PAQUET = 'paquet';
const PREFIXE_SAUVEGARDE = 'sauvegarde:';
export const MAGIQUE = 'HEROQUEST-PAQUET';

function ouvrirBase() {
  return new Promise((ok, echec) => {
    const demande = indexedDB.open(BASE, 1);
    demande.onupgradeneeded = () => demande.result.createObjectStore(MAGASIN);
    demande.onsuccess = () => ok(demande.result);
    demande.onerror = () => echec(demande.error);
  });
}

async function operation(mode, action) {
  const base = await ouvrirBase();
  try {
    return await new Promise((ok, echec) => {
      const transaction = base.transaction(MAGASIN, mode);
      const demande = action(transaction.objectStore(MAGASIN));
      transaction.oncomplete = () => ok(demande.result);
      transaction.onerror = () => echec(transaction.error);
    });
  } finally {
    base.close();
  }
}

const lire = (cle) => operation('readonly', (magasin) => magasin.get(cle));
const ecrire = (cle, valeur) => operation('readwrite', (magasin) => magasin.put(valeur, cle));
const cles = () => operation('readonly', (magasin) => magasin.getAllKeys());

async function decompresser(octets) {
  if (octets[0] !== 0x1f || octets[1] !== 0x8b) return octets;          // pas compressé (gzip)
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

// Vérifie le paquet (gzip ou brut) et le garde sur l'appareil. Lève une erreur s'il n'est pas valide.
export async function importerPaquet(octets) {
  const archive = await decompresser(new Uint8Array(octets));
  const contenu = lireArchive(archive);
  if (!contenu.has(MAGIQUE)) throw new Error("ce fichier n'est pas un paquet de données HeroQuest");
  for (const nom of ['QUEST.EXE', 'INTRO.EXE', 'quest.gen.js', 'intro.gen.js']) {
    if (!contenu.has(nom)) throw new Error(`paquet incomplet : ${nom} manque`);
  }
  if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  await ecrire(CLE_PAQUET, archive.buffer);
}

export async function sauverFichier(nom, octets) {
  await ecrire(PREFIXE_SAUVEGARDE + nom, octets.slice().buffer);
}

// Le paquet gardé, sauvegardes comprises, ou null s'il n'y en a pas.
//   fichiers : Map nom -> Uint8Array (fichiers du jeu, avec sauver(nom, octets))
//   programme(nom) : le module du code traduit ('INTRO' ou 'QUEST')
//   lireMorceau(fichier) : le WAV d'un morceau (ArrayBuffer) ou null
export async function chargerPaquet() {
  const archive = await lire(CLE_PAQUET);
  if (!archive) return null;
  const contenu = lireArchive(new Uint8Array(archive));
  const fichiers = new Map();
  for (const [nom, octets] of contenu) {
    if (nom !== MAGIQUE && !nom.includes('/') && !nom.endsWith('.js')) fichiers.set(nom, octets);
  }
  for (const cle of await cles()) {
    if (String(cle).startsWith(PREFIXE_SAUVEGARDE)) {
      fichiers.set(cle.slice(PREFIXE_SAUVEGARDE.length), new Uint8Array(await lire(cle)));
    }
  }
  fichiers.sauver = (nom, octets) => sauverFichier(nom, octets).catch((e) => console.error('sauvegarde impossible', e));
  return {
    fichiers,
    programme(nom) {
      const code = contenu.get(`${nom.toLowerCase()}.gen.js`);
      return import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    },
    async lireMorceau(fichier) {
      const octets = contenu.get(`sons/${fichier}`);
      return octets ? octets.slice().buffer : null;
    },
  };
}
