// Fabrique le paquet de données pour le site publié : ce que le site ne contient pas.
//   node paquet.mjs        ->  ../paquet/heroquest-donnees.bin (ignoré par git)
// Contenu : les fichiers du jeu d'origine (../jeu/, sans les versions EGA, Tandy et MT-32),
// le code traduit (../web/jeu/*.gen.js) et les sons (../web/sons/*.wav), en une archive
// (web/jeu/archive.js) compressée en gzip. À importer sur l'appareil depuis la page du jeu.
// Prérequis : jeu/ rempli, puis recompiler.py QUEST et INTRO, et pour le son son.py et sons.mjs.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ecrireArchive } from '../web/jeu/archive.js';
import { MAGIQUE } from '../web/jeu/paquet.js';

const ici = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ici, '..');
const JEU = path.join(RACINE, 'jeu');
const CODE = path.join(RACINE, 'web', 'jeu');
const SONS = path.join(RACINE, 'web', 'sons');
const SORTIE = path.join(RACINE, 'paquet', 'heroquest-donnees.bin');
// Mêmes fichiers que sert fichiers.php : un seul affichage (VGA), un seul son (AdLib).
const ECARTES = /\.(EGA|PIF|MD)$|^(TANDY|MT32)\.DRV$/;
const VERSION_PAQUET = '1';

const lire = (chemin) => new Uint8Array(fs.readFileSync(chemin));
const entrees = [[MAGIQUE, new TextEncoder().encode(VERSION_PAQUET)]];

if (!fs.existsSync(path.join(JEU, 'QUEST.EXE'))) throw new Error(`fichiers du jeu introuvables dans ${JEU}`);
for (const nom of fs.readdirSync(JEU).sort()) {
  const majuscules = nom.toUpperCase();
  if (fs.statSync(path.join(JEU, nom)).isFile() && !ECARTES.test(majuscules)) entrees.push([majuscules, lire(path.join(JEU, nom))]);
}
for (const nom of ['quest.gen.js', 'intro.gen.js']) {
  const chemin = path.join(CODE, nom);
  if (!fs.existsSync(chemin)) throw new Error(`${nom} manque : lancer d'abord python recompiler.py QUEST et INTRO`);
  entrees.push([nom, lire(chemin)]);
}
const sons = fs.existsSync(SONS) ? fs.readdirSync(SONS).filter((n) => n.endsWith('.wav')).sort() : [];
if (!sons.length) console.warn('aucun son dans web/sons/ : le jeu sera muet (python son.py puis node sons.mjs)');
for (const nom of sons) entrees.push([`sons/${nom}`, lire(path.join(SONS, nom))]);

const paquet = zlib.gzipSync(ecrireArchive(entrees), { level: 9 });
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, paquet);
console.log(`${path.relative(RACINE, SORTIE)} : ${entrees.length - 1} fichiers, ${(paquet.length / 1e6).toFixed(1)} Mo`);
