// Commandes de la vue moderne : elles passent toutes par l'entrée du jeu d'origine (un clic de
// souris à un endroit de son écran), jamais par une écriture en mémoire. Les règles et les dés
// restent donc ceux du code de 1991 (décision D6 de la roadmap).
//
// - Une action du panneau : clic au centre de sa zone dans zones_panneau (DS:48A4).
// - Une case du plateau : clic sur la même case dans la vue d'origine, si elle y est visible.
//   La vue d'origine montre 52 cases autour du coin de la zone ; leur position à l'écran et leur
//   décalage dans la grille sont les tables que lit clic_plateau (voir deplacement.js).

import { QUEST } from '../lisible/adresses.gen.js';

const SEGMENT_DONNEES = 0x97c;
const ZONES_PANNEAU = 0x48a4;          // x1, x2, y1, y2, routine : 10 octets, FFFFh à la fin
const TAILLE_ZONE = 10;
const ICONE_DE_ZONE = 0x41f3;          // numéro d'icône de chaque zone
const ICONES = 0x4277;                 // 12 octets par icône ; +6 : état
const ETAT_ICONE = { normale: 0x0b, enfoncee: 0x1c, grisee: 0x01, cachee: 0xff };
const CASES_VISIBLES = 52;
const POSITION_CASES = 0x4119;         // 52 positions à l'écran : y, x (mots)
const ORDRE_CASES_VUE = 0x49d6;        // 45 décalages d'octet, puis 7 mots
const ORDRE_CASES_VUE_MOTS = 0x4a03;
const CASE_COIN_ZONE = 0x3fe4;         // adresse (grille des zones) du coin de la vue
const GRILLE_ZONES = 0x546f;
const LARGEUR = 26;

// Libellés des actions, par routine appelée.
const ACTIONS = {
  fin_tour: 'Fin du tour', mode_attaque: 'Attaquer', fouille_tresor: 'Chercher un trésor',
  fouille_portes: 'Chercher pièges et passages', action_sort: 'Lancer un sort', inventaire_sorts: 'Inventaire',
  ouvre_portes: 'Ouvrir les portes', mode_regarder: 'Regarder',
  pas_gauche: 'Pas vers x − 1', pas_droite: 'Pas vers x + 1', pas_haut: 'Pas vers y − 1', pas_bas: 'Pas vers y + 1',
};
const NOMS = Object.fromEntries(Object.entries(QUEST).map(([nom, adresse]) => [adresse, nom]));

function lecteur(m) {
  const ds = m.L + SEGMENT_DONNEES;
  return { octet: (o) => m.rb(ds, o & 0xffff), mot: (o) => m.rw(ds, o & 0xffff) };
}

// Zones du panneau d'icônes : position (écran 320 × 200), action, et si l'icône est utilisable.
export function zonesPanneau(m) {
  const { octet, mot } = lecteur(m);
  const zones = [];
  for (let n = 0, adresse = ZONES_PANNEAU; mot(adresse) !== 0xffff && n < 16; n++, adresse += TAILLE_ZONE) {
    const routine = NOMS[mot(adresse + 8)] ?? `0x${mot(adresse + 8).toString(16)}`;
    const etat = octet(ICONES + 12 * octet(ICONE_DE_ZONE + n) + 6);
    zones.push({
      routine,
      libelle: ACTIONS[routine] ?? routine,
      x: (mot(adresse) + mot(adresse + 2)) >> 1,
      y: (mot(adresse + 4) + mot(adresse + 6)) >> 1,
      utilisable: etat !== ETAT_ICONE.grisee && etat !== ETAT_ICONE.cachee,
    });
  }
  return zones;
}

// Position sur l'écran d'origine (320 × 200) de la case (x, y) du plateau, ou null si elle n'est
// pas parmi les 52 cases de la vue d'origine. Même calcul que clic_plateau : centre de la case à
// (x + 24, y + 8) de sa position dans position_cases.
export function positionEcranCase(m, x, y) {
  const { octet, mot } = lecteur(m);
  const cible = y * LARGEUR + x;
  for (let n = 0; n < CASES_VISIBLES; n++) {
    const decalage = n >= 45 ? mot(ORDRE_CASES_VUE_MOTS + 2 * (n - 45)) : octet(ORDRE_CASES_VUE + n);
    const index = (mot(CASE_COIN_ZONE) + decalage - GRILLE_ZONES) & 0xffff;
    if (index !== cible) continue;
    const position = POSITION_CASES + 4 * n;
    return { x: (mot(position + 2) + 0x18) & 0xffff, y: (mot(position) + 8) & 0xffff };
  }
  return null;
}
