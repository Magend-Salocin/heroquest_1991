// Construit le site publié (GitHub Pages) dans ../_site/ : la partie web du dépôt, sans rien
// du jeu d'origine ni du service PHP. Le jeu arrive ensuite par le paquet de données (paquet.mjs).
//   node construire-site.mjs
// Écrit aussi _site/precache-manifest.js (version et liste des fichiers pour le mode hors ligne).
// Refuse de construire si un fichier tiré du jeu d'origine se glisse dans le site.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ici, '..', 'web');
const SITE = path.join(ici, '..', '_site');

// Chemins de web/ qui ne vont pas sur le site (relatifs, séparateur /).
const ECARTES = new Set([
  'fichiers.php', 'README.md', 'package.json', 'sauvegardes', 'sons',
  'jeu/quest.gen.js', 'jeu/intro.gen.js',
]);
// Garde-fou : extensions des fichiers du jeu d'origine et de ce qui en est tiré.
const INTERDITES = /\.(exe|vga|ega|bin|drv|alb|rld|sav|cfg|pif|wav|mp3|asm)$/i;
const AUTORISES_GEN = new Set(['jeu/lisible/adresses.gen.js']);   // noms et adresses, rien d'autre

function lister(dossier, relatif = '') {
  const fichiers = [];
  for (const entree of fs.readdirSync(path.join(dossier, relatif), { withFileTypes: true })) {
    const chemin = relatif ? `${relatif}/${entree.name}` : entree.name;
    if (ECARTES.has(chemin)) continue;
    if (entree.isDirectory()) fichiers.push(...lister(dossier, chemin));
    else fichiers.push(chemin);
  }
  return fichiers;
}

const fichiers = lister(WEB).sort();
for (const f of fichiers) {
  if (INTERDITES.test(f) || (f.endsWith('.gen.js') && !AUTORISES_GEN.has(f))) {
    throw new Error(`${f} ne doit pas être publié (fichier du jeu d'origine ou tiré de lui)`);
  }
}

fs.rmSync(SITE, { recursive: true, force: true });
const empreinte = crypto.createHash('sha256');
for (const f of fichiers) {
  const contenu = fs.readFileSync(path.join(WEB, f));
  fs.mkdirSync(path.dirname(path.join(SITE, f)), { recursive: true });
  fs.writeFileSync(path.join(SITE, f), contenu);
  empreinte.update(f).update(contenu);
}
const version = empreinte.digest('hex').slice(0, 12);
const precache = ['./', ...fichiers, 'precache-manifest.js'];
fs.writeFileSync(path.join(SITE, 'precache-manifest.js'),
  `self.PRECACHE = ${JSON.stringify({ version, fichiers: precache }, null, 2)};\n`);
fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

console.log(`_site/ : ${fichiers.length} fichiers, version ${version}`);
