// Inventaire de QUEST.EXE : liste des objets d'une page, et ce que fait un clic sur un objet.
// Règles : original/notes/03-regles.md, « Objets » ; écran : original/notes/02-ecrans.md, « Inventaire ».
//
// La fiche d'un héros range ses objets en champs de bits : ce qu'il possède (+0x0D artefacts,
// +0x0E et +0x0F armes et armures, +0x10 potions, +0x0B et +0x0C sorts) et ce qu'il a en service
// (+0x11 arme en main, +0x12 artefacts, +0x13 armures portées, +0x17 potions bues, +0x16 sort).
// Une page de l'inventaire liste jusqu'à 12 objets : pour chaque bit posé, le numéro de l'objet × 2,
// avec le bit 0x80 s'il est en service (cadre autour de l'image).
//
// Au clic sur un objet, la table objets_champs donne le champ de la fiche concerné et la valeur
// de l'objet dans ce champ ; la règle dépend du champ (utiliserObjet).

import { Module, QUEST } from './module.js';
import { ARTEFACT, ARMURE, POTION, OCTET, definirVariables } from './donnees.js';

definirVariables({
  modeInventaire: [0xad67, OCTET],      // 0 catégories, 1 armes et armures, 2 potions, 3 artefacts, 5 sorts
  iconeAttaque: [0x4289, OCTET],        // état de l'icône d'attaque du panneau : 0Bh allumée
  iconeAttaqueVisible: [0x428a, OCTET],
  objetChoisi: [0x3faf, OCTET],
});

const LISTE_OBJETS = 0xad6a;            // 12 mots : numéro d'objet × 2 (bit 0x80 : en service), FFFFh vide
const TAILLE_LISTE = 12;
const CASE_VIDE = 0xffff;
const EN_SERVICE = 0x80;
const OBJETS_CHAMPS = 0xae0e;           // 2 octets par objet : champ de la fiche, valeur dans ce champ
const ARMES_PERSONNAGE_4 = 0xae56;      // par numéro de bit : arme permise au personnage 4 (non nul)
const MESSAGES_POTIONS = 0xae62;        // par numéro de bit : message affiché quand on boit la potion
const CORPS_DEPART = 0x4394;            // points de corps de départ, par personnage
const COIN_ZONE = 0x3fe0;               // x, y du coin de la zone vue (origine des cases vues)
const ORDRE_CASES_VUE = 0x49d6;         // décalages des cases vues depuis le coin de la zone
const CASES_EAU_BENITE = 30;            // l'eau bénite regarde les 30 premières cases vues
const TEXTES = 0x5fc1;                  // table des offsets des messages
const MESSAGE_NOMBRE_MORTS = 0x1ae;     // chaîne « 1 UNDEAD ENEMIES » : le chiffre y est écrit
const ETAT_ACTION = 0x3f9b;
const ACTION_FAITE = 0x08;
const ICONE_ALLUMEE = 0x0b;
const SIR_RAGNAR = 4;
const IMAGES_MORTS_VIVANTS = [4, 5, 6];  // squelette, zombi, momie
const PREMIER_OCCUPANT_NON_MONSTRE = 0x30;

// Champs de la fiche, par décalage.
const CHAMP = { artefactsEnService: 0x12, armeEnMain: 0x11, armures: 0x13, sortChoisi: 0x16, potionsActives: 0x17 };
const HACHE_ARMES = 0x08;               // bit de la hache d'armes dans +0x11
const TROUSSE_OUTILS = 0x80;            // bit de la trousse à outils dans +0x11

const MESSAGE = {
  personnageNePeutPas: 0x002a,          // VOTRE PERSONNAGE / NE PEUT PAS UTILISER CELA
  bouclierEtHache: 0x002c,              // VOUS NE POUVEZ PAS UTILISER UN / BOUCLIER AVEC LA HACHE D'ARMES
  fluideRanime: 0x0082,                 // LE FLUIDE VOUS RANIME
  eauBeniteATue: 0x0084,                // VOTRE EAU BENITE / A TUE1 UNDEAD ENEMIES
  eauBeniteGaspillee: 0x0086,           // VOUS AVEZ GASPILLE / VOTRE EAU BENITE, PAS DE / MORTS VIVANTS DANS LA PIECE
  potionDejaBue: 0x0090,                // VOUS AVEZ TOUJOURS CETTE / POTION DANS LE SANG
};

// Numéro du premier bit posé (numero_bit, 0x45AB) : 0 à 7, ou 0 si aucun.
export function numeroBit(octet) {
  for (let bit = 0; bit < 8; bit++) if (octet & (1 << bit)) return bit;
  return 0;
}

export class Inventaire extends Module {
  // ---- Liste des objets d'une page

  // Pour chacun des `nombre` bits de `bits`, du plus faible au plus fort, range le numéro
  // d'objet courant dans la liste (liste_bits, 0x9652). Le numéro avance de 2 à chaque bit.
  // Rend la place libre suivante et le numéro suivant.
  listerBits(bits, nombre, numero, place) {
    const d = this.donnees;
    let n = nombre;
    do {
      if (bits & 1) { d.ecrireMot(place, numero); place = (place + 2) & 0xffff; }
      bits >>= 1;
      numero = (numero + 2) & 0xffff;
      n = (n - 1) & 0xffff;
    } while (n !== 0);
    return { place, numero, bits };
  }

  // Marque comme en service (bit 0x80) l'entrée de la liste qui vaut `numero` (marque_objet,
  // 0x9670). Rend la position atteinte dans la liste et le compteur de la recherche, que
  // marque_en_service reprend par erreur comme le sien (voir marquerEnService).
  marquerObjet(numero) {
    const d = this.donnees;
    let place = LISTE_OBJETS;
    let reste = TAILLE_LISTE;
    do {
      if (d.mot(place) === numero) {
        d.ecrireMot(place, d.mot(place) | EN_SERVICE);
        return { place, reste };
      }
      place += 2;
      reste -= 1;
    } while (reste !== 0);
    return { place, reste: 0 };
  }

  // Pour chaque bit de `bits` (objets en service), marque l'objet correspondant de la liste
  // (marque_en_service, 0x9661). Le numéro d'objet avance de 2 à chaque bit.
  // Bogue de l'original : marque_objet se sert du même registre de compteur (CX) et le laisse
  // à sa valeur à elle. Après un objet trouvé à la place k de la liste, il ne reste que 11 - k
  // tours ; après un objet absent de la liste, le compteur repart de 0, soit 65 535 tours de plus.
  marquerEnService(bits, nombre, numero, place) {
    let n = nombre;
    do {
      const marque = bits & 1;
      bits >>= 1;
      if (marque) ({ place, reste: n } = this.marquerObjet(numero));
      numero = (numero + 2) & 0xffff;
      n = (n - 1) & 0xffff;
    } while (n !== 0);
    return { place, numero, bits };
  }

  // ---- Utiliser un objet (utilise_objet, 0x92C8)
  // Atteinte par un saut depuis la page d'objets, BX = zone cliquée (2 à 24, la case × 2).
  // Se termine par un saut : page_objets (liste refaite), boucle_objets, choix_sort, ou la
  // trousse à outils ; ou par un ret (armure sans valeur), qui sort de l'inventaire.

  *utiliserObjet(zone) {
    const d = this.donnees;
    const entree = d.mot(LISTE_OBJETS + zone - 2);
    if (entree === CASE_VIDE) return this.sauter(QUEST.boucle_objets);
    const regle = OBJETS_CHAMPS + (entree & 0x7f);
    const champ = d.octet(regle);
    const valeur = d.octet(regle + 1);
    const fiche = d.ficheCourante;
    const registres = { di: fiche.adresse };

    switch (champ) {
      case CHAMP.potionsActives: return yield* this.boirePotion(fiche, valeur);
      case CHAMP.armeEnMain: return yield* this.choisirArme(fiche, valeur);
      case CHAMP.armures: return yield* this.choisirArmure(fiche, valeur);
      case CHAMP.artefactsEnService: return this.choisirArtefact(fiche, valeur);
      case CHAMP.sortChoisi:
        return this.sauter(QUEST.choix_sort, { ...registres, ax: (d.octet(fiche.adresse + champ) << 8) | valeur });
      default:                                   // aucun objet de la table : jamais pris
        d.ecrireOctet(fiche.adresse + champ, valeur);
        return this.sauter(QUEST.page_objets);
    }
  }

  // Armures (+0x13) : une pièce se porte ou s'enlève. La cotte de mailles et l'armure de plates
  // remplacent les autres armures de corps et retirent l'armure de Borin. Le bouclier est refusé
  // avec la hache d'armes en main. Sir Ragnar ne porte rien.
  // Une valeur nulle ferait sortir par ret, sans redessiner le plateau ; objets_champs n'en
  // contient pas : ce chemin n'est jamais pris.
  *choisirArmure(fiche, valeur) {
    const d = this.donnees;
    if (valeur === 0) return undefined;
    if (d.personnageCourant === SIR_RAGNAR) return yield* this.refuser(MESSAGE.personnageNePeutPas);
    if (fiche.armures & valeur) {
      fiche.armures ^= valeur;
    } else if (valeur & (ARMURE.armureDePlates | ARMURE.cotteDeMailles)) {
      this.porterArmureDeCorps(fiche, valeur);
    } else if ((valeur & ARMURE.bouclier) && (fiche.armeEnMain & HACHE_ARMES)) {
      return yield* this.refuser(MESSAGE.bouclierEtHache);
    } else {
      fiche.armures |= valeur;
    }
    return this.sauter(QUEST.page_objets);
  }

  porterArmureDeCorps(fiche, valeur) {
    fiche.armures = (fiche.armures & (ARMURE.bouclier | ARMURE.casque)) | valeur;
    fiche.artefactsEnService &= ~ARTEFACT.armureBorin & 0x1f;
  }

  // Armes (+0x11) : une seule en main ; recliquer la lâche, ce qui efface aussi les artefacts en
  // service (+0x12, écrit avec +0x11 d'un seul mot). Prendre une arme pose le poison d'orc et la
  // lame de l'esprit. La hache d'armes enlève le bouclier ; la trousse à outils désarme un piège.
  // Sir Ragnar n'a que les armes de sa table.
  *choisirArme(fiche, valeur) {
    const d = this.donnees;
    if (d.personnageCourant === SIR_RAGNAR && d.octet(ARMES_PERSONNAGE_4 + numeroBit(valeur)) === 0) {
      return yield* this.refuser(MESSAGE.personnageNePeutPas);
    }
    if (valeur === fiche.armeEnMain) {
      d.ecrireMot(fiche.adresse + CHAMP.armeEnMain, 0);
      return this.sauter(QUEST.page_objets);
    }
    fiche.armeEnMain = valeur;
    fiche.artefactsEnService &= 0x07;
    if (valeur & TROUSSE_OUTILS) return this.sauter(QUEST.trousse_outils, { di: fiche.adresse });
    if ((valeur & HACHE_ARMES) && (fiche.armures & ARMURE.bouclier)) {
      fiche.armures &= ~ARMURE.bouclier & 0xff;
      return yield* this.refuser(MESSAGE.bouclierEtHache);
    }
    return this.sauter(QUEST.page_objets);
  }

  // Artefacts (+0x12). La baguette de rappel et le talisman du savoir agissent seuls : le clic ne
  // fait rien. Les autres se prennent ou se posent. Le poison d'orc et la lame de l'esprit
  // s'excluent et lâchent l'arme en main ; l'armure de Borin enlève la cotte et les plates.
  choisirArtefact(fiche, valeur) {
    if (valeur & (ARTEFACT.baguetteRappel | ARTEFACT.talismanSavoir)) return this.sauter(QUEST.page_objets);
    if (fiche.artefactsEnService & valeur) {
      fiche.artefactsEnService ^= valeur;
    } else if (!(valeur & ARTEFACT.armureBorin)) {
      fiche.artefactsEnService = (fiche.artefactsEnService & 0x07) | valeur;
      fiche.armeEnMain = 0;
    } else {
      fiche.artefactsEnService |= valeur;
      fiche.armures &= ARMURE.bouclier | ARMURE.casque;
    }
    return this.sauter(QUEST.page_objets);
  }

  // Potions (+0x17 en cours, +0x10 possédées). Les curatives soignent tout de suite, l'eau bénite
  // agit sur la pièce ; les autres restent en cours jusqu'à ce que leur effet serve. On ne boit
  // pas une potion dont l'effet dure encore.
  *boirePotion(fiche, valeur) {
    const d = this.donnees;
    if ((valeur & ~POTION.eauBenite & 0xff) === 0) return yield* this.verserEauBenite();
    if ((valeur & 0xfb) === 0 || (valeur & 0xf7) === 0) return yield* this.boireCurative(fiche, valeur);
    if (fiche.potionsActives & valeur) return yield* this.refuser(MESSAGE.potionDejaBue);

    fiche.potionsActives |= valeur;
    fiche.potions ^= valeur;
    // Potion héroïque : l'icône d'attaque se rallume, et l'effet est consommé aussitôt.
    // Bogue de l'original : l'action faite est inversée (xor), pas effacée : boire la potion avant
    // d'avoir agi marque l'action comme faite.
    if (valeur === POTION.heroique && d.iconeAttaque !== ICONE_ALLUMEE) {
      d.iconeAttaque = ICONE_ALLUMEE;
      d.iconeAttaqueVisible = 1;
      d.ecrireOctet(ETAT_ACTION, d.octet(ETAT_ACTION) ^ ACTION_FAITE);
      fiche.potionsActives ^= POTION.heroique;
    }
    const message = d.mot(MESSAGES_POTIONS + 2 * numeroBit(valeur));
    yield* this.afficherMessage(message);
    return this.sauter(QUEST.page_objets);
  }

  // Potion curative : +4 points de corps, sans dépasser ceux du départ. Les deux emplacements de
  // curative (bits 4 et 8) se distinguent ; le code efface aussi toutes les autres potions en
  // cours (+0x17 ne garde que le bit de la curative, qui n'y est jamais posé).
  *boireCurative(fiche, valeur) {
    const d = this.donnees;
    const maximum = d.octet(CORPS_DEPART + d.personnageCourant);
    const points = (fiche.pointsCorps + 4) & 0xff;
    fiche.pointsCorps = points < maximum ? points : maximum;
    const emplacement = valeur & 4 ? 4 : 8;
    fiche.potions ^= emplacement;
    fiche.potionsActives &= emplacement;
    yield* this.afficherMessage(MESSAGE.fluideRanime);
    return this.sauter(QUEST.page_objets);
  }

  // Eau bénite : tue les squelettes, zombis et momies sur les 30 premières cases vues de la zone
  // du héros, et affiche leur nombre (un chiffre écrit dans le message : 10 morts donneraient
  // « : »). Le compte se fait dans choixMenu.
  *verserEauBenite() {
    const d = this.donnees;
    yield* this.appeler(QUEST.adresse_case, { cx: d.mot(COIN_ZONE) });
    const coin = this.machine.bx;
    d.choixMenu = 0;
    const zoneHeros = d.ficheCourante.zone;
    for (let n = 0; n < CASES_EAU_BENITE; n++) {
      const caseVue = (coin + d.octet(ORDRE_CASES_VUE + n)) & 0xffff;
      if ((d.octet(caseVue) & 0x3f) === zoneHeros) yield* this.appeler(QUEST.eau_benite_case, { bx: caseVue });
    }
    let message = MESSAGE.eauBeniteGaspillee;
    if (d.choixMenu !== 0) {
      const texte = (d.mot(TEXTES + MESSAGE_NOMBRE_MORTS) + TEXTES) & 0xffff;
      d.ecrireOctet(texte, d.choixMenu + 0x30);
      message = MESSAGE.eauBeniteATue;
    }
    yield* this.afficherMessage(message);
    const fiche = d.ficheCourante;
    fiche.potionsActives |= POTION.eauBenite;
    fiche.potions ^= POTION.eauBenite;
    yield* this.appeler(QUEST.affiche_et_pause);
    return this.sauter(QUEST.page_objets);
  }

  // Une case de l'eau bénite (eau_benite_case, 0x94F7) : un mort-vivant (image 4, 5 ou 6) y est
  // tué et compté. Se termine par un saut vers retire_monstre.
  *eauBeniteCase(caseZones) {
    const d = this.donnees;
    const occupant = d.octet(caseZones + 0x400);
    if (occupant === 0 || occupant >= PREMIER_OCCUPANT_NON_MONSTRE) return undefined;
    yield* this.appeler(QUEST.adresse_monstre, { al: occupant });
    const monstre = this.machine.bx;
    if (!IMAGES_MORTS_VIVANTS.includes(d.octet(monstre + 8))) return undefined;
    d.choixMenu = (d.choixMenu + 1) & 0xff;
    return this.sauter(QUEST.retire_monstre, { si: monstre });
  }

  *refuser(message) {
    yield* this.afficherMessage(message);
    return this.sauter(QUEST.page_objets);
  }
}
