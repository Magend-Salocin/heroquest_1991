// Pile d'appels du programme et phase du jeu, lues sans rien modifier. Servent à l'inspecteur et
// à la vue moderne (sur le plateau ou non, tour des héros ou de Morcar).

import { QUEST } from '../lisible/adresses.gen.js';
import { RETOUR_LISIBLE } from '../lisible/routines.js';

const PROFONDEUR_PILE = 256;       // mots de pile lus au plus
const NOMS = Object.fromEntries(Object.entries(QUEST).map(([nom, adresse]) => [adresse, nom]));
const hex = (n) => n.toString(16).padStart(4, '0');

// Nom de la routine qui contient ip : le code généré range une même fonction sur toute la plage
// de la routine (nom_adresse) ; une routine réécrite n'occupe que son adresse d'entrée.
export function nomRoutine(m, ip) {
  if (NOMS[ip]) return NOMS[ip];
  const nom = m.table[ip]?.name;
  const generee = nom && /^(.+)_[0-9a-f]+$/.exec(nom);
  return generee ? generee[1] : `0x${hex(ip)}`;
}

// Routine en cours : celle de ip, ou la routine lisible qui reprend la main (ip = RETOUR_LISIBLE).
export function routineEnCours(m) {
  if (m.ip === RETOUR_LISIBLE && m.lisibles?.length) return `${m.lisibles.at(-1).routine.nom} (lisible)`;
  return nomRoutine(m, m.ip);
}

// Le mot de pile est-il l'adresse de retour d'un call proche ? On regarde l'instruction qui la
// précède : E8 (call rel16) ou FF /2 (call indirect, selon l'adressage).
function estRetourDAppel(m, retour) {
  const octet = (recul) => m.rb(m.cs, (retour - recul) & 0xffff);
  const appelIndirect = (recul, modes) => {
    const modrm = octet(recul - 1);
    return octet(recul) === 0xff && (modrm & 0x38) === 0x10 && modes(modrm >> 6, modrm & 7);
  };
  return octet(3) === 0xe8
    || appelIndirect(2, (mod, rm) => mod === 3 || (mod === 0 && rm !== 6))
    || appelIndirect(3, (mod) => mod === 1)
    || appelIndirect(4, (mod, rm) => mod === 2 || (mod === 0 && rm === 6));
}

// Pile d'appels estimée, de la plus récente à la plus ancienne : les adresses de retour trouvées
// dans la pile du programme, et les routines lisibles en cours. Une routine lisible qui appelle
// pose RETOUR_LISIBLE juste sous sa propre entrée dans la pile (sp mémorisé par routines.js).
// Une donnée de la pile qui ressemble à une adresse de retour peut s'y glisser.
export function pileAppels(m) {
  const lisibles = new Map((m.lisibles || []).map((l) => [(l.sp - 2) & 0xffff, l.routine.nom]));
  const appels = [];
  const fond = m.spDepart ?? 0xfffe;
  for (let sp = m.sp, n = 0; sp < fond && n < PROFONDEUR_PILE; sp += 2, n++) {
    const mot = m.rw(m.ss, sp);
    if (mot === RETOUR_LISIBLE) {
      appels.push(`${lisibles.get(sp) ?? '?'} (lisible)`);
    } else if (m.table[mot] && estRetourDAppel(m, mot)) {
      appels.push(nomRoutine(m, mot));
    }
  }
  return appels;
}

// Où en est le jeu, d'après les routines en cours :
//   ecran : 'plateau' (pendant une partie), 'inventaire', ou 'autre' (menus, écrans des héros...) ;
//   tour  : 'heros' ou 'monstres' sur le plateau, sinon null.
export function phaseDuJeu(m) {
  const routines = new Set([routineEnCours(m), ...pileAppels(m)].map((nom) => nom.replace(' (lisible)', '')));
  if (routines.has('inventaire_sorts') || routines.has('utilise_objet')) return { ecran: 'inventaire', tour: 'heros' };
  if (routines.has('tour_morcar')) return { ecran: 'plateau', tour: 'monstres' };
  if (routines.has('tour_personnage')) return { ecran: 'plateau', tour: 'heros' };
  return { ecran: 'autre', tour: null };
}
