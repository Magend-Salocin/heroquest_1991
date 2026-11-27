// Branche les routines réécrites à la place du code généré (quest.gen.js).
//
// La machine appelle une routine par son adresse d'origine. Deux sortes de routines lisibles :
//
// - Routine d'un seul tenant : une méthode ordinaire, qui ne fait que calculer. Elle rend les
//   registres que ses appelants lisent (champ sortie), puis revient comme le ret d'origine.
//
// - Routine par étapes (etapes: true) : une méthode génératrice, qui appelle d'autres routines
//   d'origine et attend leur fin (yield). À chaque appel, on pose sur la pile du programme
//   l'adresse de retour RETOUR_LISIBLE ; quand la routine appelée y revient, la méthode reprend.
//   Une méthode qui se termine en renvoyant une adresse continue par un saut (jmp) vers elle.
//
// Les drapeaux du processeur ne sont pas rendus : les appelants de ces routines ne les lisent pas.
// Chaque remplacement est vérifié contre la version générée par outils/lisible.mjs.
// Dans la page, ?genere garde le code généré seul (pour comparer).

import { Donnees } from './donnees.js';
import { Hasard } from './hasard.js';
import { Combat } from './combat.js';
import { Deplacement } from './deplacement.js';
import { Tour } from './tour.js';
import { Inventaire, numeroBit } from './inventaire.js';
import { Fouilles } from './fouilles.js';
import { Fiche } from './donnees.js';

// Adresse de retour réservée : le segment de code de QUEST s'arrête à 0x97C0.
export const RETOUR_LISIBLE = 0xfff0;

const octetBas = (registre, valeur) => (registre & 0xff00) | (valeur & 0xff);

// adresse -> { nom, cout, sortie, etapes, fin, executer(jeu, m) }
//   cout   : instructions comptées pour le temps du jeu (moyenne de la version générée ;
//            pour une routine par étapes, à chaque reprise, hors routines appelées)
//   sortie : registres rendus aux appelants, comparés par outils/lisible.mjs ('al' = octet bas seul)
//   fin    : routine qui se termine par un saut : l'adresse où elle finit, ou la liste des adresses
//            possibles (pour la comparaison)
export const ROUTINES_QUEST = {
  0x3613: {
    nom: 'hasard', cout: 17, sortie: ['ax'],
    // Entrée BL = max. Sortie AL = 1 à max, AH = AL - 1.
    executer({ hasard }, m) {
      const resultat = hasard.tirer(m.bx & 0xff);
      m.ax = ((resultat - 1) << 8) | resultat;
    },
  },
  0x6033: {
    nom: 'de6_moins_un', cout: 34, sortie: ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp'],
    // Sortie BL = 0 à 5 ; les autres registres sont conservés.
    executer({ hasard }, m) { m.bx = octetBas(m.bx, hasard.de6()); },
  },
  0x21b7: {
    nom: 'de_combat', cout: 38, sortie: ['bx'],
    // Sortie BX = face (FACE dans combat.js).
    executer({ combat }, m) { m.bx = combat.lancerDe(); },
  },
  0x5d8c: {
    nom: 'compte_cranes', cout: 130, sortie: ['al', 'dx'],
    // Entrée DH = nombre de dés. Sortie AL = DL = crânes, DH = 0.
    executer({ combat }, m) {
      const cranes = combat.compterCranes(m.dx >> 8);
      m.ax = octetBas(m.ax, cranes);
      m.dx = cranes;
    },
  },
  0x0b28: {
    nom: 'calcule_des_monstre', cout: 10, sortie: ['si', 'bx', 'ax'],
    // Sortie SI = cible, BX = 5 × type, AX = dés (attaque, défense).
    executer({ combat, donnees }, m) {
      combat.calculerDesMonstre();
      m.si = donnees.adresseCible;
      m.bx = (5 * donnees.cible.type) & 0xff;
      m.ax = (donnees.desDefenseMonstre << 8) | donnees.desAttaqueMonstre;
    },
  },
  0x0b44: {
    nom: 'bonus_attaque_heros', cout: 18, sortie: ['di', 'si'],
    // Sortie DI = fiche courante, SI = cible.
    executer({ combat, donnees }, m) {
      combat.appliquerBonusAttaque();
      m.di = donnees.adresseFicheCourante;
      m.si = donnees.adresseCible;
    },
  },
  0x0b8b: {
    nom: 'calcule_defense_heros', cout: 15, sortie: ['di', 'al'],
    // Sortie DI = fiche courante, AL = dés de défense.
    executer({ combat, donnees }, m) {
      combat.calculerDefenseHeros();
      m.di = donnees.adresseFicheCourante;
      m.ax = octetBas(m.ax, donnees.desDefenseHeros);
    },
  },
  0x214d: {
    nom: 'calcule_attaque_heros', cout: 20, sortie: ['di'],
    // Sortie DI = fiche courante, lue par portee_attaque qui suit.
    executer({ combat, donnees }, m) {
      combat.calculerAttaqueHeros();
      m.di = donnees.adresseFicheCourante;
    },
  },
  0x0936: {
    nom: 'attaque_heros', cout: 10, sortie: [], etapes: true, fin: 0x12aa,
    executer: ({ combat }) => combat.attaqueHeros(),
  },
  0x1d8f: {
    nom: 'combat_monstre', cout: 10, sortie: [], etapes: true,
    executer: ({ combat }) => combat.combatMonstre(),
  },
  0x1e90: {
    nom: 'attaque_contre_heros', cout: 10, sortie: [], etapes: true,
    executer: ({ combat }) => combat.attaqueContreHeros(),
  },

  // ---- Déplacement (deplacement.js)
  0x68ae: {
    nom: 'des_deplacement_tour', cout: 18, sortie: ['di'],
    executer({ deplacement, donnees }, m) {
      deplacement.calculerDesDeplacement();
      m.di = donnees.adresseFicheCourante;
    },
  },
  0x6049: {
    nom: 'fin_deplacement', cout: 9, sortie: ['di'],
    // Entrée DI : lue par l'original quand le héros n'a pas bougé (voir terminerDeplacement).
    executer({ deplacement }, m) { m.di = deplacement.terminerDeplacement(m.di); },
  },
  0x26d7: {
    nom: 'arrete_deplacement', cout: 3, sortie: [],
    executer({ deplacement }) { deplacement.arreterDeplacement(); },
  },
  0x66f9: {
    nom: 'tirage_deplacement', cout: 10, sortie: [], etapes: true,
    executer: ({ deplacement }) => deplacement.tirageDeplacement(),
  },
  0x58f4: {
    nom: 'fleches_deplacement', cout: 51, sortie: ['di', 'cx', 'bp'],
    executer({ deplacement }, m) {
      deplacement.calculerFleches();
      m.di = 0x42bf + 4 * 12;
      m.cx = 0;
      m.bp = 0;
    },
  },
  // Les 4 pas sont atteints par un saut depuis clic_tour (DI fiche, SI sprite) ; ils reviennent
  // par ret, ou continuent par un saut vers vue_alignee ou redessin_plateau.
  0x48a0: {
    nom: 'pas_gauche', cout: 30, sortie: [], etapes: true,
    executer: ({ deplacement }, m) => deplacement.pas('gauche', m.di, m.si),
  },
  0x4968: {
    nom: 'pas_droite', cout: 30, sortie: [], etapes: true,
    executer: ({ deplacement }, m) => deplacement.pas('droite', m.di, m.si),
  },
  0x4a2f: {
    nom: 'pas_haut', cout: 30, sortie: [], etapes: true,
    executer: ({ deplacement }, m) => deplacement.pas('haut', m.di, m.si),
  },
  0x4af7: {
    nom: 'pas_bas', cout: 30, sortie: [], etapes: true,
    executer: ({ deplacement }, m) => deplacement.pas('bas', m.di, m.si),
  },
  0x6784: {
    nom: 'pas_automatique', cout: 15, sortie: [], etapes: true,
    executer: ({ deplacement }) => deplacement.pasAutomatique(),
  },
  0x4daa: {
    nom: 'tire_teleport', cout: 81, sortie: ['al', 'bx', 'dx'],
    // Entrée DI : la fiche du héros téléporté. Sortie AL zone, BX téléport, DX décalage dans la table.
    executer({ deplacement, donnees }, m) {
      const teleport = deplacement.tirerTeleport(new Fiche(donnees, m.di));
      m.ax = octetBas(m.ax, donnees.octet(teleport));
      m.bx = teleport;
      m.dx = teleport - 0x43b2;
    },
  },
  0x4dc7: {
    nom: 'entre_piege', cout: 15, sortie: ['ax', 'bx', 'dx', 'bp'],
    // Entrée AL code de la case, BX son adresse (grille des occupants), DL x et DH y, DI fiche.
    executer({ deplacement, donnees }, m) {
      const code = m.ax & 0xff;
      const fiche = new Fiche(donnees, m.di);
      const x = m.dx & 0xff;
      const y = m.dx >> 8;
      const piegeArme = code < 0x37 && !deplacement.personnageEn(x, y);
      deplacement.entrerPiege(code, m.bx, x, y, fiche);
      if (piegeArme) {
        m.bx = donnees.casePiege;
        m.dx = (m.dx & 0xff00) | 0x1a;
        m.bp = 0x45a6 + 2 * ((code - 0x32) & 0xff);
      }
    },
  },
  0x67b6: {
    nom: 'clic_plateau', cout: 2600, sortie: [],
    executer({ deplacement }) { deplacement.clicPlateau(); },
  },
  0x2dac: {
    nom: 'chemin_heros', cout: 700, sortie: [],
    executer({ deplacement }) { deplacement.chercherChemin(); },
  },

  // ---- Tour d'un personnage (tour.js)
  0x0349: {
    nom: 'tour_personnage', cout: 10, sortie: [], etapes: true, fin: 0x02cd,
    // Entrée AL numéro du personnage, AH type de commande, BX fiche, DX sprite.
    executer: ({ tour }, m) => tour.tourPersonnage(m.ax & 0xff, m.bx, m.dx, m.ax >> 8),
  },
  0x6413: {
    nom: 'commandes_tour', cout: 8, sortie: [], etapes: true,
    executer: ({ tour }) => tour.commandesTour(),
  },
  // Atteinte aussi depuis 0x7EC2 ; finit par un saut vers la routine de la zone cliquée
  // (DI fiche, SI sprite, BX entrée de la zone) ou vers clic_plateau.
  0x6441: {
    nom: 'clic_tour', cout: 8, sortie: [], etapes: true,
    executer: ({ tour }) => tour.clicTour(),
  },
  0x64a7: {
    nom: 'zone_panneau', cout: 60, sortie: ['si', 'ax', 'dx', 'bp', 'cf'],
    // Sortie SI zone (ou fin de table), AX rang ; survol_icones lit SI et AL (xlat), pas CF.
    executer({ tour }) { tour.rendreZone(tour.zoneSousLeCurseur()); },
  },
  0x0756: {
    nom: 'fin_tour', cout: 12, sortie: [], etapes: true,
    executer: ({ tour }) => tour.finTour(),
  },

  // ---- Inventaire (inventaire.js)
  0x45ab: {
    nom: 'numero_bit', cout: 11, sortie: ['ax', 'cx'],
    // Entrée AL. Sortie AL = AH = numéro du premier bit posé, ou AX = 0.
    executer(jeu, m) {
      const bits = m.ax & 0xff;
      const numero = numeroBit(bits);
      m.ax = bits ? (numero << 8) | numero : 0;
    },
  },
  0x9652: {
    nom: 'liste_bits', cout: 40, sortie: ['ax', 'bx', 'cx', 'si'],
    // Entrée AL bits, CX nombre, BX premier numéro d'objet, SI place dans la liste.
    executer({ inventaire }, m) {
      const r = inventaire.listerBits(m.ax & 0xff, m.cx, m.bx, m.si);
      Object.assign(m, { si: r.place, bx: r.numero, cx: 0, ax: octetBas(m.ax, r.bits) });
    },
  },
  0x9661: {
    nom: 'marque_en_service', cout: 60, sortie: ['ax', 'cx', 'si', 'di'],
    // Entrée AL bits en service, CX nombre, SI premier numéro d'objet ; DI laissé par marque_objet.
    executer({ inventaire }, m) {
      const r = inventaire.marquerEnService(m.ax & 0xff, m.cx, m.si, m.di);
      Object.assign(m, { si: r.numero, di: r.place, cx: 0, ax: octetBas(m.ax, r.bits) });
    },
  },
  0x9670: {
    nom: 'marque_objet', cout: 51, sortie: ['cx', 'di'],
    // Entrée SI numéro d'objet. Sortie DI place atteinte, CX reste du compteur.
    executer({ inventaire }, m) {
      const r = inventaire.marquerObjet(m.si);
      Object.assign(m, { di: r.place, cx: r.reste });
    },
  },
  0x94f7: {
    nom: 'eau_benite_case', cout: 9, sortie: [], etapes: true,
    // Entrée BX : la case dans grille_zones. Finit par un saut vers retire_monstre quand elle tue.
    executer: ({ inventaire }, m) => inventaire.eauBeniteCase(m.bx),
  },
  // Atteinte par un saut depuis la page d'objets (BX zone cliquée) ; finit par un saut vers la page
  // ou la boucle des objets, ou passe par le choix d'un sort ou la trousse à outils, qui finissent
  // par fermer l'inventaire ou par revenir à la page.
  0x92c8: {
    nom: 'utilise_objet', cout: 20, sortie: [], etapes: true, fin: [0x90e7, 0x91e2, 0x8f5d],
    executer: ({ inventaire }, m) => inventaire.utiliserObjet(m.bx),
  },

  // ---- Fouille du trésor (fouilles.js)
  0x6d66: {
    nom: 'tire_carte', cout: 120, sortie: ['al', 'si', 'cx', 'bp'],
    // Sortie AL la carte tirée ; SI, CX, BP laissés par la boucle.
    executer({ fouilles }, m) {
      const r = fouilles.tirerCarte();
      Object.assign(m, { ax: octetBas(m.ax, r.carte), si: r.lue, cx: r.reste, bp: r.place });
    },
  },
  0x6d8b: {
    nom: 'remet_carte', cout: 6, sortie: ['bx'],
    // Entrée AL la carte. Sortie BX la nouvelle fin de pioche.
    executer({ fouilles }, m) { m.bx = fouilles.remettreCarte(m.ax & 0xff); },
  },
  0x6dd7: {
    nom: 'monstre_actif_case', cout: 12, sortie: [], etapes: true,
    // Entrée BX : la case dans grille_zones.
    executer: ({ fouilles }, m) => fouilles.monstreActifCase(m.bx),
  },
  0x6d9a: {
    nom: 'monstre_dans_zone', cout: 20, sortie: [], etapes: true,
    executer: ({ fouilles }) => fouilles.chercherMonstreDansZone(),
  },
  // Atteinte par un saut depuis clic_tour (DI fiche) ; finit par ret, ou par un saut vers
  // affiche_message, mort_heros, l'événement de la zone, la fin de fouille ou le monstre errant.
  0x6be0: {
    nom: 'fouille_tresor', cout: 12, sortie: [], etapes: true,
    executer: ({ fouilles }) => fouilles.fouillerTresor(),
  },

  // ---- Fouille des portes secrètes et des pièges (fouilles.js)
  0x72f4: {
    nom: 'ouvre_porte_secrete', cout: 8, sortie: ['bx'], etapes: true,
    // Entrée BX : le bord (grille des murs) qui porte la porte.
    executer: ({ fouilles }, m) => fouilles.ouvrirPorteSecrete(m.bx),
  },
  0x7247: {
    nom: 'fouille_case', cout: 30, sortie: [], etapes: true,
    // Entrée BX : la case dans grille_zones.
    executer: ({ fouilles }, m) => fouilles.fouillerCase(m.bx),
  },
  0x720a: {
    nom: 'cherche_portes_pieges', cout: 20, sortie: [], etapes: true,
    executer: ({ fouilles }) => fouilles.chercherPortesEtPieges(),
  },
  // Atteinte par un saut depuis clic_tour (DI fiche) ; finit par ret, ou par un saut vers la fin
  // de fouille ou l'événement de la zone.
  0x6dfa: {
    nom: 'fouille_portes', cout: 12, sortie: [], etapes: true,
    executer: ({ fouilles }) => fouilles.fouillerPortes(),
  },
};

// Remplace, dans la table des routines générées, l'entrée de chaque routine réécrite.
// Les adresses intérieures gardent le code généré : on n'y arrive jamais, la routine
// lisible remplaçant la routine entière.
export function brancherRoutines(table, routines = ROUTINES_QUEST) {
  let jeu = null;
  const jeuDe = (m) => {
    if (!jeu || jeu.machine !== m) jeu = creerJeu(m);
    return jeu;
  };
  table[RETOUR_LISIBLE] = (m) => reprendre(m);
  for (const [adresse, routine] of Object.entries(routines)) {
    table[Number(adresse)] = routine.etapes
      ? (m) => commencer(m, routine, routine.executer(jeuDe(m), m))
      : (m) => {
        routine.executer(jeuDe(m), m);
        compter(m, routine.cout);
        return m.pop();
      };
  }
  return table;
}

function compter(m, instructions) {
  m.t += instructions;
  m.pas -= instructions;
}

// m.lisibles : routines par étapes en cours, de la plus ancienne à la plus récente.
function commencer(m, routine, etapes) {
  m.lisibles ||= [];
  // Une routine dont la pile a été abandonnée (le programme est reparti plus haut sans revenir)
  // ne reprendra jamais : on l'oublie.
  while (m.lisibles.length && m.lisibles.at(-1).sp <= m.sp) m.lisibles.pop();
  m.lisibles.push({ routine, etapes, sp: m.sp });
  return reprendre(m);
}

function reprendre(m) {
  const enCours = m.lisibles.at(-1);
  compter(m, enCours.routine.cout);
  const { value: adresse, done } = enCours.etapes.next();
  if (!done) {
    m.push(RETOUR_LISIBLE);       // la routine appelée reviendra ici
    return adresse;
  }
  m.lisibles.pop();
  return adresse === undefined ? m.pop() : adresse;   // ret, ou saut final
}

export function creerJeu(machine) {
  const donnees = new Donnees(machine);
  const jeu = { machine, donnees, hasard: new Hasard(donnees) };
  jeu.combat = new Combat(jeu);
  jeu.deplacement = new Deplacement(jeu);
  jeu.tour = new Tour(jeu);
  jeu.inventaire = new Inventaire(jeu);
  jeu.fouilles = new Fouilles(jeu);
  return jeu;
}
