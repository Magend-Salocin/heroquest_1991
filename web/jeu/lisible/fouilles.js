// Fouilles dans QUEST.EXE : le trésor (la pioche des cartes, et ce que fait chaque carte), puis les
// portes secrètes et les pièges.
// Règles : original/notes/03-regles.md, « Fouilles » (« Trésor », « Portes secrètes et pièges »).
//
// Chaque zone a un octet dans evenement_par_zone (copié de QUESTn.BIN) : 0 = on tire une carte,
// n = événement scripté n de la quête, FFh = déjà fouillée. La pioche (25 cartes, mélangée à
// chaque quête) est une liste d'octets terminée par FFh : on tire la carte du dessus, et
// certaines cartes sont remises dessous. Pas de fouille si un monstre actif est dans la zone.

import { Module, QUEST } from './module.js';
import { OCTET, MOT, POTION, EFFET_SORT, definirVariables } from './donnees.js';

definirVariables({
  zoneHeros: [0x3f94, OCTET],
  monstreDansZone: [0x3fc7, OCTET],        // 1 si un monstre actif est dans la zone du héros
  caseCoinZone: [0x3fe4, MOT],
  carteTresor: [0x4655, MOT],              // place de la prochaine carte remise, dans la pioche
  porteTrouvee: [0x37ed, MOT],             // ligne_carte, réutilisé : 1 quand une porte secrète s'ouvre
  piegeTrouve: [0x37eb, MOT],              // position_tuile_carte, réutilisé : 1 quand une fosse ou une lance est trouvée
  quelqueChoseTrouve: [0x3fcb, OCTET],     // porte, fosse, lance ou chute de pierre repérée
  erreurFichier: [0x37e9, MOT],
});

const PIOCHE = 0x463b;                     // 25 cartes, puis FFh
const TAILLE_PIOCHE = 25;
const FIN_PIOCHE = 0xff;
const EVENEMENT_PAR_ZONE = 0x4b70;
const ZONE_FOUILLEE = 0xff;
const ICONE_FOUILLE_TRESOR = 0x42f5;       // état de l'icône (DS:4277 + 12 × 10 + 6)
const ICONE_ENFONCEE = 0x1c;
const OR_CARTES = 0x49cd;                  // or des cartes 0 à 8
const POTIONS_CARTES = 0x43ad;             // bit de potion des cartes 9 à 13
const MESSAGES_POTIONS_CARTES = 0x4892;
const VOISINS = 0x439b;                    // 4 pas (dx, dy) : haut, droite, bas, gauche
const MONSTRE_ERRANT = 0x4d4a;             // monstre 0 de la quête
const ORDRE_CASES_VUE = 0x49d6;
const CASES_REGARDEES = 30;
const PERSONNAGE_ATTAQUE = 0x3fbc;
const HEROS_COURANT = 0x3fca;
const TEXTES = 0x5fc1;
const CHAINE_NOMBRE_OR = 0x1b2;            // le chiffre du dé y est écrit (carte 8)
const SIR_RAGNAR = 4;
const PORTES_FOUILLEES = 0x4b9b;           // par zone : 0, événement n, ou FFh une fois cherchée
const ICONE_FOUILLE_PORTES = 0x42ad;       // état de l'icône (DS:4277 + 12 × 4 + 6)
const DE_LA_GRILLE_DES_ZONES = { murs: 0x200, occupants: 0x400 };
const PIEGE = { fosseCachee: 0x32, chutePierre: 0x34, lance: 0x36 };
const BIT_PORTE = { gauche: 0x10, haut: 0x20, revelee: 0x04, secrete: 0x08 };
const LARGEUR = 26;
const HAUTEUR = 19;

// Cartes (numéros dans la pioche).
const CARTE = { orDernier: 8, premierePotion: 9, heroique: 14, eauBenite: 15, rien: 16, premierPiege: 17, premierMonstre: 20 };

// Adresses où la fouille continue par un saut (dans fouille_portes et redessin_plateau).
const SAUT = { evenementZone: 0x6e94, finFouille: 0x6eaa, monstreErrant: 0x6eb6 };

const MESSAGE = {
  dejaFouillee: 0x004a,                    // CETTE PIECE A DEJA / ETE FOUILLEE
  rienTrouve: 0x004c,                      // VOUS FOUILLEZ MAIS / NE DECOUVREZ RIEN
  premierOr: 0x00f4,                       // messages des cartes 0 à 8 : 0xF4 + 2 × carte
  porteSecrete: 0x001a,                    // UNE PORTE SECRETE S'OUVRE / EN GRINCANT DANS LE MUR
  lanceDesarmee: 0x0034,                   // VOUS TROUVEZ ET DESARMEZ / UN PIEGE A LANCES CACHE
  rienDecouvert: 0x0108,                   // MALGRE UNE RECHERCHE MINUTIEUSE / VOUS NE DECOUVREZ RIEN
  trappe: 0x0110,                          // VOUS DECOUVREZ L'ENTREE / D'UNE TRAPPE
  monstreErrant: 0x0106,                   // PENDANT VOS RECHERCHES / UN MONSTRE VOUS TRAQUE / ET VOUS ATTAQUE
  arbalete: 0x010a,                        // ... FIL DE DETENTE ... COUP D'ARBALETE ... PERDEZ 1 POINT DE CORPS
  eauBenite: 0x0114,
  heroique: 0x011c,
};

export class Fouilles extends Module {
  // ---- Pioche

  // Tire la carte du dessus (tire_carte, 0x6D66) : les suivantes remontent d'un cran jusqu'au
  // FFh final. carteTresor pointe ensuite sur ce FFh, là où une carte remise ira.
  // Rend la carte et les registres laissés par la boucle : place (BP), lue (SI), reste (CX).
  tirerCarte() {
    const d = this.donnees;
    const carte = d.octet(PIOCHE);
    let place = PIOCHE;
    let lue = PIOCHE + 1;
    let reste = TAILLE_PIOCHE;
    for (;;) {
      const suivante = d.octet(lue++);
      d.ecrireOctet(place, suivante);
      if (suivante === FIN_PIOCHE) break;
      place++;
      if (--reste === 0) { d.ecrireOctet(place, FIN_PIOCHE); break; }
    }
    d.carteTresor = place;
    return { carte, place, lue, reste };
  }

  // Remet la carte sous la pioche (remet_carte, 0x6D8B). Rend la nouvelle fin de pioche.
  remettreCarte(carte) {
    const d = this.donnees;
    const place = d.carteTresor;
    d.ecrireOctet(place, carte);
    d.ecrireOctet(place + 1, FIN_PIOCHE);
    d.carteTresor = (place + 1) & 0xffff;
    return d.carteTresor;
  }

  // ---- Monstre dans la zone

  // monstre_dans_zone (0x6D9A) : regarde les 30 premières cases vues autour du coin de la zone
  // du héros ; un monstre actif dans la zone pose monstreDansZone. Révèle aussi la zone.
  *chercherMonstreDansZone() {
    const d = this.donnees;
    d.monstreDansZone = 0;
    yield* this.appeler(QUEST.adresse_case_perso, { di: d.adresseFicheCourante });
    d.zoneHeros = this.machine.ax & 0xff;
    yield* this.appeler(QUEST.revele_zone);
    const coin = this.machine.bx;
    d.caseCoinZone = coin;
    for (let n = 0; n < CASES_REGARDEES; n++) {
      const caseZones = (coin + d.octet(ORDRE_CASES_VUE + n)) & 0xffff;
      if ((d.octet(caseZones) & 0x3f) === d.zoneHeros) yield* this.monstreActifCase(caseZones);
    }
  }

  // monstre_actif_case (0x6DD7) : un monstre sur la case, dont l'octet +6 a un autre bit que 1
  // (réveillé, endormi, passe son tour...), pose monstreDansZone.
  // Bogue de l'original : le numéro est diminué de 1 avant adresse_monstre, qui le diminue déjà :
  // c'est l'octet +6 du monstre n - 1 qui est testé (pour le monstre 1, un octet hors de la table).
  *monstreActifCase(caseZones) {
    const d = this.donnees;
    const occupant = d.octet(caseZones + 0x400);
    if (occupant === 0 || occupant >= 0x30) return;
    yield* this.appeler(QUEST.adresse_monstre, { al: occupant - 1 });
    if (d.octet(this.machine.bx + 6) & 0xfe) d.monstreDansZone = 1;
  }

  // ---- fouille_tresor (0x6BE0)
  // Icône de fouille du trésor. Entrée DI : la fiche du héros (lue par fin_deplacement).

  *fouillerTresor() {
    const d = this.donnees;
    if (d.personnageCourant === SIR_RAGNAR) return undefined;
    if (d.octet(ICONE_FOUILLE_TRESOR) !== ICONE_ENFONCEE) return undefined;
    yield* this.appeler(QUEST.fin_deplacement, { al: d.octet(0x3f9b) });

    for (;;) {
      yield* this.chercherMonstreDansZone();
      const fiche = d.ficheCourante;
      if (d.monstreDansZone !== 0) return this.sauter(SAUT.finFouille, { di: fiche.adresse });

      const zone = d.zoneHeros;
      const evenement = d.octet(EVENEMENT_PAR_ZONE + zone);
      d.ecrireOctet(EVENEMENT_PAR_ZONE + zone, ZONE_FOUILLEE);
      if (evenement === ZONE_FOUILLEE) {
        yield* this.afficherMessage(MESSAGE.dejaFouillee);
        return undefined;
      }
      if (evenement !== 0) return this.sauter(SAUT.evenementZone, { ax: evenement, bx: zone, di: fiche.adresse });

      const { carte } = this.tirerCarte();
      if (carte < CARTE.premierePotion) return yield* this.carteOr(fiche, carte);
      if (carte < CARTE.heroique) return this.cartePotion(fiche, carte);
      if (carte < CARTE.rien) return this.carteHeroiqueOuEauBenite(fiche, carte);
      if (carte === CARTE.rien) {
        yield* this.afficherMessage(MESSAGE.rienTrouve);
        return undefined;
      }
      if (carte < CARTE.premierMonstre) return yield* this.carteArbalete(carte);

      // Monstre errant : posé sur la première case libre à côté du héros, qui l'attaque aussitôt.
      // Sans case libre, la zone redevient fouillable et on recommence (une autre carte).
      this.remettreCarte(carte);
      const caseLibre = yield* this.placeDuMonstreErrant(fiche);
      if (caseLibre !== null) {
        yield* this.afficherMessage(MESSAGE.monstreErrant);
        return this.sauter(SAUT.monstreErrant, { di: MONSTRE_ERRANT, dx: caseLibre });
      }
      d.ecrireOctet(EVENEMENT_PAR_ZONE + d.zoneHeros, 0);
    }
  }

  // Cartes 0 à 8 : de l'or (table or_cartes). La carte 8 donne 10 × un dé de pièces, et le héros
  // perd son prochain tour (+0x18 bit 4) ; le chiffre du dé est écrit dans le message.
  *carteOr(fiche, carte) {
    const d = this.donnees;
    this.remettreCarte(carte);
    let pieces;
    if (carte === CARTE.orDernier) {
      const de = this.jeu.hasard.de6() + 1;
      const chaine = (d.mot(TEXTES + CHAINE_NOMBRE_OR) + TEXTES) & 0xffff;
      d.ecrireOctet(chaine, de + 0x30);
      pieces = (10 * de) & 0xff;
      fiche.effetsSorts |= EFFET_SORT.tempete;
    } else {
      pieces = d.octet(OR_CARTES + carte);
    }
    yield* this.appeler(QUEST.ajoute_or, { dx: pieces, di: fiche.adresse });
    yield* this.appeler(QUEST.affiche_or);
    return this.sauter(QUEST.affiche_message, { bx: MESSAGE.premierOr + 2 * carte });
  }

  // Cartes 9 à 13 : une potion (tables potions_cartes et messages_potions_cartes).
  cartePotion(fiche, carte) {
    const d = this.donnees;
    const rang = carte - CARTE.premierePotion;
    fiche.potions |= d.octet(POTIONS_CARTES + rang);
    return this.sauter(QUEST.affiche_message, { bx: d.mot(MESSAGES_POTIONS_CARTES + 2 * rang) });
  }

  // Cartes 14 et 15 : potion héroïque, eau bénite.
  carteHeroiqueOuEauBenite(fiche, carte) {
    const heroique = carte === CARTE.heroique;
    fiche.potions |= heroique ? POTION.heroique : POTION.eauBenite;
    return this.sauter(QUEST.affiche_message, { bx: heroique ? MESSAGE.heroique : MESSAGE.eauBenite });
  }

  // Cartes 17 à 19 : un carreau d'arbalète, 1 point de corps. À 1 point, le héros meurt ;
  // à 0, le compteur (un octet) passe à 255 et il survit.
  *carteArbalete(carte) {
    const d = this.donnees;
    this.remettreCarte(carte);
    yield* this.afficherMessage(MESSAGE.arbalete);
    yield* this.appeler(QUEST.redessine_plateau);
    const fiche = d.ficheCourante;
    fiche.pointsCorps -= 1;
    if (fiche.pointsCorps !== 0) return undefined;
    d.ecrireOctet(HEROS_COURANT, d.personnageCourant);
    return this.sauter(QUEST.mort_heros, { si: fiche.adresse });
  }

  // ---- fouille_portes (0x6DFA)
  // Icône de fouille des portes secrètes et des pièges. Entrée DI : la fiche (fin_deplacement).
  // Ordre : porte trouvée (message, zone marquée), sinon piège trouvé (la zone reste à fouiller),
  // sinon rien (message) ou l'événement de la zone. Le premier test « déjà fouillée » lit
  // zoneHeros avant qu'elle soit recalculée : c'est la zone de la dernière fouille ou du dernier
  // calcul, pas forcément celle du héros.

  *fouillerPortes() {
    const d = this.donnees;
    if (d.personnageCourant === SIR_RAGNAR) return undefined;
    if (d.octet(ICONE_FOUILLE_PORTES) !== ICONE_ENFONCEE) return undefined;
    yield* this.appeler(QUEST.fin_deplacement, { al: d.octet(0x3f9b) });
    if (d.octet(PORTES_FOUILLEES + d.zoneHeros) === ZONE_FOUILLEE) return yield* this.dejaFouillee();

    d.porteTrouvee = 0;
    yield* this.chercherPortesEtPieges();
    yield* this.appeler(QUEST.adresse_case_perso, { di: d.adresseFicheCourante });
    const zone = this.machine.ax & 0xff;
    const registres = { di: d.adresseFicheCourante };

    if (d.porteTrouvee !== 0) {
      d.ecrireOctet(PORTES_FOUILLEES + zone, ZONE_FOUILLEE);
      yield* this.appeler(QUEST.son_porte);
      yield* this.afficherMessage(MESSAGE.porteSecrete);
      d.porteTrouvee = 0;
      return this.sauter(SAUT.finFouille, registres);
    }
    // Bogue de l'original : piegeTrouve n'est jamais remis à 0 avant la recherche ; c'est une
    // variable du dessin de la carte, et s'il vaut 1 depuis une fouille précédente, on sort sans rien.
    if (d.piegeTrouve === 1) return this.sauter(SAUT.finFouille, registres);
    const evenement = d.octet(PORTES_FOUILLEES + zone);
    if (evenement === 0) {
      d.porteTrouvee = 1;
      d.ecrireOctet(PORTES_FOUILLEES + zone, ZONE_FOUILLEE);
      yield* this.afficherMessage(MESSAGE.rienDecouvert);
      return this.sauter(SAUT.finFouille, registres);
    }
    if (evenement === ZONE_FOUILLEE) return yield* this.dejaFouillee();
    d.ecrireOctet(PORTES_FOUILLEES + zone, ZONE_FOUILLEE);
    return this.sauter(SAUT.evenementZone, { ax: evenement, bx: zone, di: d.adresseFicheCourante });
  }

  *dejaFouillee() {
    yield* this.afficherMessage(MESSAGE.dejaFouillee);
    return undefined;
  }

  // cherche_portes_pieges (0x720A) : fouille_case sur chacune des 30 premières cases vues de la
  // zone du héros. Révèle aussi la zone (revele_zone, sans événement : BP = 1).
  *chercherPortesEtPieges() {
    const d = this.donnees;
    d.erreurFichier = 0;
    yield* this.appeler(QUEST.adresse_case_perso, { di: d.adresseFicheCourante });
    d.zoneHeros = this.machine.ax & 0xff;
    yield* this.appeler(QUEST.revele_zone, { bp: 1 });
    const coin = this.machine.bx;
    d.caseCoinZone = coin;
    for (let n = 0; n < CASES_REGARDEES; n++) {
      const decalage = d.octet(ORDRE_CASES_VUE + n);
      const caseZones = (coin + decalage) & 0xffff;
      if ((d.octet(caseZones) & 0x3f) !== d.zoneHeros) continue;
      yield* this.appeler(QUEST.fouille_case, { bx: caseZones, di: ORDRE_CASES_VUE + n, cx: CASES_REGARDEES - n, dx: decalage, al: d.zoneHeros });
    }
  }

  // fouille_case (0x7247) : une case de la zone. Portes secrètes sur ses bords (le sien, puis le
  // bord gauche de la voisine de droite et le bord haut de la voisine du dessous), puis fosse
  // cachée (devient connue), lance (retirée), chute de pierre (repérée, sans message).
  // Entrée BX : la case dans grille_zones.
  *fouillerCase(caseZones) {
    const d = this.donnees;
    const murs = (caseZones + DE_LA_GRILLE_DES_ZONES.murs) & 0xffff;
    let occupant = (murs + 0x200) & 0xffff;
    const octetMurs = d.octet(murs);
    if ((octetMurs & BIT_PORTE.secrete) && !(octetMurs & BIT_PORTE.revelee)) {
      d.ecrireOctet(murs, octetMurs | BIT_PORTE.revelee);
      const parLaGauche = (d.octet(murs) & BIT_PORTE.gauche) !== 0;
      const zoneVoisine = d.octet(murs - 0x200 - (parLaGauche ? 1 : LARGEUR)) & 0x3f;
      const pas = parLaGauche ? 1 : LARGEUR;
      yield* this.appeler(QUEST.marque_zone_vue, { al: zoneVoisine, bx: murs, cx: pas });
      // Bogue de l'original : BX et CX sont empilés puis dépilés dans le désordre ; BX reçoit le
      // pas (1 ou 26) et le calcul « BX - CX » donne pas - adresse. Le piège de cette case est donc
      // cherché, et peut être modifié, à une adresse sans rapport (entre DS:A9A5 et DS:ABAB).
      occupant = (pas - murs + 0x200) & 0xffff;
      d.porteTrouvee = 1;
    }

    const code = d.octet(occupant);
    if (code === PIEGE.fosseCachee || code === PIEGE.lance) {
      if (code === PIEGE.fosseCachee) d.ecrireOctet(occupant, code + 1); else d.ecrireOctet(occupant, 0);
      yield* this.afficherMessage(code === PIEGE.fosseCachee ? MESSAGE.trappe : MESSAGE.lanceDesarmee);
      yield* this.appeler(QUEST.redessine_plateau);
      d.piegeTrouve = 1;
      d.quelqueChoseTrouve = 1;
    } else if (code === PIEGE.chutePierre) {
      d.quelqueChoseTrouve = 1;
    }

    // Bords des voisines : gauche de la case de droite, haut de la case du dessous. La zone de
    // l'autre côté est passée à marque_zone_vue sans être masquée (bits de case vue compris).
    for (const [voisine, bitPorte] of [[murs + 1, BIT_PORTE.gauche], [murs + LARGEUR, BIT_PORTE.haut]]) {
      const octet = d.octet(voisine);
      const fermee = (octet & BIT_PORTE.secrete) && (octet & bitPorte) && !(octet & BIT_PORTE.revelee);
      if (!fermee) continue;
      yield* this.appeler(QUEST.ouvre_porte_secrete, { bx: voisine });
      yield* this.appeler(QUEST.marque_zone_vue, { al: d.octet(voisine - 0x200), bx: voisine });
    }
    return undefined;
  }

  // ouvre_porte_secrete (0x72F4) : la porte du bord BX est révélée, la zone de l'autre côté aussi.
  *ouvrirPorteSecrete(caseMurs) {
    const d = this.donnees;
    d.ecrireOctet(caseMurs, d.octet(caseMurs) | BIT_PORTE.revelee);
    yield* this.appeler(QUEST.revele_derriere_porte, { bx: caseMurs });
    d.porteTrouvee = 1;
    d.quelqueChoseTrouve = 1;
    this.machine.bx = caseMurs;
  }

  // Première case libre à côté du héros (haut, droite, bas, gauche), au sens de case_libre pour le
  // monstre errant, placé dans la zone du héros. Rend la case (DH y, DL x) ou null.
  *placeDuMonstreErrant(fiche) {
    const d = this.donnees;
    d.ecrireOctet(PERSONNAGE_ATTAQUE, d.personnageCourant);
    d.ecrireOctet(MONSTRE_ERRANT + 3, fiche.zone);
    for (let n = 0; n < 4; n++) {
      const x = (fiche.x + d.octet(VOISINS + 2 * n)) & 0xff;
      if (x >= LARGEUR) continue;
      const y = (fiche.y + d.octet(VOISINS + 2 * n + 1)) & 0xff;
      if (y >= HAUTEUR) continue;
      yield* this.appeler(QUEST.case_libre, { dx: (y << 8) | x, di: MONSTRE_ERRANT, si: fiche.adresse });
      if ((this.machine.ax & 0xff) === 0) return (y << 8) | x;
    }
    return null;
  }
}
