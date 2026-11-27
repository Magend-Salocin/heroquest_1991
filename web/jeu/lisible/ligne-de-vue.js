// Ligne de vue de QUEST.EXE, du héros courant vers une case (tirs et sorts).
// Règles : original/notes/03-regles.md, « Ligne de vue ».
//
// Le tracé avance d'une case à la fois sur l'axe où l'écart est le plus grand, et sur l'autre axe
// quand l'erreur cumulée dépasse l'écart principal : c'est l'algorithme de Bresenham, en entiers.
// À chaque case, case_coupe_vue regarde le mur qu'on franchit (en haut ou à gauche de la case),
// puis ce qui occupe la case. resultat_vise vaut 0 si la ligne est libre.

import { Module } from './module.js';
import { OCTET, MOT, definirVariables } from './donnees.js';

definirVariables({
  traceErreur: [0x3f9f, OCTET],
  traceX: [0x3fa5, OCTET],
  traceY: [0x3fa6, OCTET],
  traceDx: [0x3fa1, OCTET],
  traceDy: [0x3fa2, OCTET],
  ligneLibre: [0x3fb2, OCTET],
  axeX: [0x37e9, MOT],                   // erreur_fichier, réutilisé : 1 si l'axe principal est x
  pasRestants: [0x37eb, OCTET],          // position_tuile_carte, réutilisé : cases qu'il reste à tracer
});

const LIGNES_GRILLE = 0x5ac5;            // adresse du début de chaque rangée (y × 26)
const GRILLE_MURS = 0x566f;
const GRILLE_OCCUPANTS = 0x586f;
const OCCUPANTS_VUE = 0x4946;            // 0 ou 1 par code d'occupant (cohérente pour 40h à 5Fh)
// Masques du mur franchi : en haut (mur 80h, porte 20h, secrète 08h, ouverte 04h) quand l'axe
// principal est y, à gauche (40h, 10h, 08h, 04h) quand c'est x.
const MASQUE_HAUT = { mur: 0xac, porte: 0x20 };
const MASQUE_GAUCHE = { mur: 0x5c, porte: 0x10 };
const PORTE_OUVERTE = 0x04;

const signe = (v) => (v & 0x80 ? v - 0x100 : v);

export class LigneDeVue extends Module {
  // ---- index_case (0x607E) : index de la case (x, y), et AX = début de la rangée.
  indexCase(x, y) {
    const debutRangee = this.donnees.mot(LIGNES_GRILLE + 2 * y);
    this.machine.ax = debutRangee;
    return (debutRangee + x) & 0xffff;
  }

  // ---- case_coupe_vue (0x1214) : la case (traceX, traceY) coupe-t-elle la vue ?
  // Un mur, ou une porte fermée, sur le bord franchi : oui (resultat_vise = 1). Sinon, sauf pour
  // la dernière case (pasRestants = 1), l'occupant décide par la table occupants_vue, ou un
  // personnage présent sur la case.
  // Bogue de l'original : occupants_vue n'a de valeurs justes que pour les meubles (40h à 5Fh) ;
  // pour un monstre (1 à 32) ou un piège (30h à 3Fh), le jeu lit les tables voisines.
  caseCoupeVue() {
    const d = this.donnees;
    const m = this.machine;
    const x = d.traceX;
    const y = d.traceY;
    const index = this.indexCase(x, y);
    const murs = d.octet(GRILLE_MURS + index);
    if (murs !== 0) {
      const masque = d.axeX === 1 ? MASQUE_GAUCHE : MASQUE_HAUT;
      const bord = murs & masque.mur;
      m.ax = (m.ax & 0xff00) | bord;
      if (bord !== 0 && (!(bord & masque.porte) || !(bord & PORTE_OUVERTE))) {
        d.resultatVise = 1;
        return;
      }
    }
    if (d.pasRestants === 1) return;
    const occupant = d.octet(GRILLE_OCCUPANTS + index);
    if (occupant !== 0) {
      d.resultatVise = d.octet(OCCUPANTS_VUE + occupant);
      m.ax = (m.ax & 0xff00) | d.resultatVise;
      return;
    }
    const personnage = this.jeu.deplacement.personnageEn(x, y) ? 1 : 0;
    m.ax = personnage;
    d.resultatVise = personnage;
  }

  // ---- ligne_de_vue (0x1148) : du héros courant à la case (cibleX, cibleY).
  // Bogue de l'original : le mur testé est toujours celui du haut (ou de gauche) de la case où le
  // tracé entre. En montant ou vers la gauche, le mur franchi est celui de la case quittée : le jeu
  // teste le suivant et saute le dernier test (pas = 1 vers le haut ou la gauche) ; le mur de la
  // case du tireur n'est jamais testé.
  ligneDeVue(cibleX, cibleY) {
    const d = this.donnees;
    const m = this.machine;
    const fiche = d.ficheCourante;
    const departX = fiche.x;
    const departY = fiche.y;
    d.traceX = departX;
    d.traceY = departY;
    d.traceErreur = 0;
    d.resultatVise = 0;

    // Écart et sens sur chaque axe : sens 1 vers les grandes coordonnées, FFh vers les petites.
    const ecart = (depart, cible) => {
      const difference = (depart - cible) & 0xff;
      if (difference === 0) return { ecart: 0, sens: 0 };
      return depart >= cible ? { ecart: difference, sens: 0xff } : { ecart: (-difference) & 0xff, sens: 1 };
    };
    const enX = ecart(departX, cibleX);
    const enY = ecart(departY, cibleY);
    d.traceDx = enX.ecart;
    d.traceDy = enY.ecart;
    m.ax = (m.ax & 0xff00) | enY.ecart;
    const sensX = enX.sens;
    const sensY = enY.sens;
    m.bx = (sensX << 8) | sensY;
    m.di = fiche.adresse;

    if (enY.ecart >= enX.ecart) {
      // Axe principal y : un pas en y à chaque case, en x quand l'erreur dépasse l'écart en y.
      let reste = enY.ecart;
      for (;;) {
        d.traceErreur += enX.ecart;
        if (d.traceErreur >= enY.ecart) {
          d.traceErreur -= enY.ecart;
          d.traceX = (d.traceX + signe(sensX)) & 0xff;
        }
        d.traceY = (d.traceY + signe(sensY)) & 0xff;
        d.axeX = 0;
        d.pasRestants = reste;
        if (!(reste === 1 && sensY === 0xff)) this.caseCoupeVue();
        if (d.resultatVise !== 0) break;
        reste = (reste - 1) & 0xff;
        if (reste === 0) break;
      }
      m.cx = (reste << 8) | enX.ecart;
      m.dx = (departX << 8) | enY.ecart;
      return;
    }

    // Axe principal x. Bogue de l'original : l'écart en x et le compteur de la boucle sont le même
    // registre (CL, décrémenté par loop). L'erreur est comparée aux cases restantes au lieu de
    // l'écart en x : le seuil baisse à chaque pas, et le tracé monte (ou descend) trop tôt.
    let reste = enX.ecart;
    for (;;) {
      d.traceErreur += enY.ecart;
      if (d.traceErreur >= reste) {
        d.traceErreur -= reste;
        d.traceY = (d.traceY + signe(sensY)) & 0xff;
      }
      d.traceX = (d.traceX + signe(sensX)) & 0xff;
      d.axeX = 1;
      d.pasRestants = reste;
      if (!(reste === 1 && sensX === 0xff)) this.caseCoupeVue();
      if (d.resultatVise !== 0) break;
      reste = (reste - 1) & 0xff;
      if (reste === 0) break;
    }
    m.cx = reste;
    m.dx = (departX << 8) | enY.ecart;
  }

  // ---- vue_cible (0x113E) : ligne de vue vers la case du monstre visé.
  vueCible() {
    const cible = this.donnees.cible;
    this.machine.si = cible.adresse;
    this.ligneDeVue(cible.x, cible.y);
  }

  // ---- tir_ligne_libre (0x0B1C) : ligneLibre = 1 si la ligne vers la cible est libre.
  tirLigneLibre() {
    this.vueCible();
    const libre = this.donnees.resultatVise ^ 1;
    this.machine.ax = (this.machine.ax & 0xff00) | libre;
    this.donnees.ligneLibre = libre;
  }
}
