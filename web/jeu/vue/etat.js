// État de la partie en cours, lu dans la mémoire du jeu émulé et rendu sous forme d'objet simple
// (nombres, chaînes, tableaux), sans référence à la mémoire : la vue moderne et l'inspecteur le
// dessinent, essai.mjs l'écrit en JSON. Rien n'est écrit dans la mémoire.
// Sens des octets : original/notes/03-regles.md (Fiche d'un personnage, Monstres, Plateau en mémoire)
// et docs/FORMATS.md (Quêtes : QUESTn.BIN).

import { Donnees, TABLES, Fiche, Monstre } from '../lisible/donnees.js';
import { MUR, PORTE } from '../lisible/deplacement.js';
import { Hasard } from '../lisible/hasard.js';
import '../lisible/combat.js';                // variables du combat (cranes, boucliers) dans Donnees

export const LARGEUR = 26;
export const HAUTEUR = 19;
const TAILLE_FICHE = 26;
const TAILLE_MONSTRE = 10;
const NOMBRE_FICHES = 5;
const NOMBRE_MONSTRES = 32;
const SEGMENT_DONNEES = 0x97c;   // DS de QUEST.EXE dans l'image, avant relogement

export const TYPES_HEROS = ['barbare', 'nain', 'elfe', 'enchanteur', 'Sir Ragnar'];
export const TYPES_MONSTRES = ['gobelin', 'orc', 'fimir', 'guerrier du chaos', 'squelette', 'zombi', 'momie',
  'gargouille', 'Ulag', 'Grak', 'Balur', 'Sorcier-Roi (trône)', 'Sorcier-Roi'];

// Octet de zone : bits 0 à 5 la zone, 0x40 case vue, 0x80 bord vu.
const ZONE = { numero: 0x3f, vue: 0x40, bordVu: 0x80 };

// Codes de la grille des occupants (docs/FORMATS.md, codes du mobilier).
const MEUBLES = {
  0x4b: 'table', 0x4c: 'table', 0x4d: 'chevalet', 0x4e: 'chevalet', 0x4f: 'établi', 0x50: 'établi',
  0x53: 'tombeau', 0x54: 'armoire', 0x5a: 'armoire', 0x55: 'râtelier', 0x5b: 'râtelier',
  0x56: 'bibliothèque', 0x58: 'bibliothèque', 0x57: 'cheminée', 0x59: 'cheminée',
  0x5c: 'coffre', 0x5d: 'coffre', 0x5e: 'trône', 0x5f: 'trône',
};
const PIEGES = { 0x32: 'fosse cachée', 0x33: 'fosse', 0x34: 'chute de pierre', 0x35: 'chute de pierre sans effet', 0x36: 'lance', 0x37: 'portail magique' };

// Ce qui occupe une case, d'après son code. Un piège caché ou une case de meuble reste signalé
// comme tel : c'est à la vue de ne pas montrer ce que les héros n'ont pas trouvé.
export function decrireOccupant(code) {
  if (code === 0) return null;
  if (code >= 1 && code <= NOMBRE_MONSTRES) return { sorte: 'monstre', numero: code - 1, code };
  if (code === 0x30 || code === 0x31) return { sorte: 'éboulis', code };
  if (code in PIEGES) return { sorte: 'piège', nom: PIEGES[code], cache: code === 0x32, code };
  if (code >= 0x38 && code <= 0x3b) return { sorte: 'escalier', code };
  if (code >= 0x42 && code <= 0x4a) return { sorte: 'meuble', nom: 'suite', code };   // case supplémentaire d'un meuble
  if (code >= 0x40) return { sorte: 'meuble', nom: MEUBLES[code] || 'meuble', code };
  return { sorte: 'inconnu', code };
}

// Porte sur un bord, lue dans l'octet de murs de la case qui porte ce bord.
function porte(murs, bitPorte) {
  if (!(murs & bitPorte)) return null;
  return { ouverte: (murs & PORTE.ouverte) !== 0, secrete: (murs & PORTE.secrete) !== 0 };
}

// Bords d'une case : la grille ne range que le bord gauche et le bord haut de chaque case ;
// le bord droit est le bord gauche de la voisine de droite, le bas celui du haut de la voisine du dessous.
function bords(d, x, y) {
  const murs = (cx, cy) => (cx < LARGEUR && cy < HAUTEUR ? d.octet(TABLES.grilleMurs + cy * LARGEUR + cx) : 0);
  const ici = murs(x, y);
  const droite = murs(x + 1, y);
  const dessous = murs(x, y + 1);
  return {
    haut: { mur: (ici & MUR.haut) !== 0, porte: porte(ici, PORTE.haut) },
    gauche: { mur: (ici & MUR.gauche) !== 0, porte: porte(ici, PORTE.gauche) },
    bas: { mur: (dessous & MUR.haut) !== 0, porte: porte(dessous, PORTE.haut) },
    droite: { mur: (droite & MUR.gauche) !== 0, porte: porte(droite, PORTE.gauche) },
  };
}

function lirePlateau(d) {
  const cases = [];
  for (let y = 0; y < HAUTEUR; y++) {
    for (let x = 0; x < LARGEUR; x++) {
      const index = y * LARGEUR + x;
      const zone = d.octet(TABLES.grilleZones + index);
      cases.push({
        x, y,
        zone: zone & ZONE.numero,
        vue: (zone & ZONE.vue) !== 0,
        bordVu: (zone & ZONE.bordVu) !== 0,
        ...bords(d, x, y),
        occupant: decrireOccupant(d.octet(TABLES.grilleOccupants + index)),
      });
    }
  }
  return { largeur: LARGEUR, hauteur: HAUTEUR, cases };
}

function lireHeros(d) {
  const heros = [];
  for (let n = 0; n < NOMBRE_FICHES; n++) {
    const fiche = new Fiche(d, TABLES.fichesPersonnages + n * TAILLE_FICHE);
    if (!fiche.present) continue;
    heros.push({
      numero: n,
      type: fiche.type,
      nomType: TYPES_HEROS[fiche.type] ?? `type ${fiche.type}`,
      x: fiche.x,
      y: fiche.y,
      zone: fiche.zone,
      pointsCorps: fiche.pointsCorps,
      pointsEsprit: fiche.pointsEsprit,
      desAttaque: fiche.desAttaque,
      desDefense: fiche.desDefense,
      or: fiche.or,
      image: fiche.image,
    });
  }
  return heros;
}

function lireMonstres(d) {
  const monstres = [];
  for (let n = 0; n < NOMBRE_MONSTRES; n++) {
    const monstre = new Monstre(d, TABLES.monstres + n * TAILLE_MONSTRE);
    if (!monstre.etat) continue;                 // enregistrement vide
    monstres.push({
      numero: n,
      type: monstre.type,
      nomType: TYPES_MONSTRES[monstre.type] ?? `type ${monstre.type}`,
      image: monstre.image,
      x: monstre.x,
      y: monstre.y,
      zone: monstre.zone,
      vu: (monstre.etat & 0x80) === 0,
      vivant: monstre.vivant !== 0,
      reveille: (monstre.drapeaux & 0x01) !== 0,
      passeSonTour: (monstre.drapeaux & 0x02) !== 0,
      endormi: (monstre.drapeaux & 0x04) !== 0,
    });
  }
  return monstres;
}

// Phase du tour : la mémoire ne dit pas si c'est le tour des héros ou des monstres (aucune variable
// identifiée pour l'instant) ; seul le personnage qui joue ou a joué en dernier est connu.
// La lecture se fait toujours dans le segment de données du jeu : le code d'origine change DS
// par moments (décompression, copies d'images), et l'image peut tomber à ce moment-là.
export function lireEtat(machine) {
  const d = new Donnees(Object.create(machine, { ds: { value: machine.L + SEGMENT_DONNEES } }));
  return {
    quete: d.numeroQuete,
    personnageCourant: d.personnageCourant,
    graine: new Hasard(d).graine(),          // registre du hasard (DS:38FD), octet a en haut
    desDeplacement: d.desDeplacement,         // dés de déplacement du tour
    deplacementRestant: d.deplacementRestant, // cases qu'il reste à parcourir
    combat: { cranes: d.cranes, boucliers: d.boucliers },   // dés du dernier combat
    plateau: lirePlateau(d),
    heros: lireHeros(d),
    monstres: lireMonstres(d),
  };
}
