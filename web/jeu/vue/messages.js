// Texte d'un message du jeu (numéro passé dans BX à affiche_message), lu dans le fichier de textes
// chargé en mémoire. Format : original/notes/02-ecrans.md (« Messages ») et outils/extraire.py.
//   table d'offsets en DS:5FC1 (relatifs à 5FC1) ; une entrée : boîte (4 octets), boutons de
//   6 octets jusqu'à FFFFh, puis des lignes « 11h, ligne, colonne, texte » jusqu'à 00h.
// Le journal de la vue moderne note chaque appel de affiche_message (journaliserMessages).

import { QUEST } from '../lisible/adresses.gen.js';

const TEXTES = 0x5fc1;
const SEGMENT_DONNEES = 0x97c;
const MARQUE_LIGNE = 0x11;
const LONGUEUR_MAX = 400;

// Quelques caractères de la page de code 437 utilisés par les textes européens.
const CP437 = { 0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à', 0x87: 'ç', 0x88: 'ê', 0x89: 'ë', 0x8a: 'è', 0x8b: 'ï', 0x8c: 'î', 0x93: 'ô', 0x94: 'ö', 0x96: 'û', 0x97: 'ù', 0x8e: 'Ä', 0x90: 'É', 0x99: 'Ö', 0x9a: 'Ü', 0xe1: 'ß', 0xa4: 'ñ', 0xa5: 'Ñ' };
const caractere = (c) => (c >= 0x20 && c < 0x80 ? String.fromCharCode(c) : CP437[c] ?? ' ');

// Lignes de texte du message, ou [] si l'entrée n'est pas une boîte de message.
export function lireMessage(m, numero) {
  const ds = m.L + SEGMENT_DONNEES;
  const octet = (offset) => m.rb(ds, offset & 0xffff);
  const mot = (offset) => octet(offset) | (octet(offset + 1) << 8);
  const debut = (TEXTES + mot(TEXTES + numero)) & 0xffff;
  let i = debut + 4;
  while (mot(i) !== 0xffff && i - debut < LONGUEUR_MAX) i += 6;
  i += 2;
  const lignes = [];
  while (octet(i) === MARQUE_LIGNE && i - debut < LONGUEUR_MAX) {
    let texte = '';
    let j = i + 3;
    while (octet(j) !== 0 && octet(j) !== MARQUE_LIGNE && j - debut < LONGUEUR_MAX) texte += caractere(octet(j++));
    lignes.push(texte.trim());
    if (octet(j) === 0) break;
    i = j;
  }
  return lignes;
}

// Note chaque message affiché par le jeu : remplace l'entrée de affiche_message dans la table des
// routines par une fonction qui appelle `noter`, puis la routine d'origine (ou réécrite).
export function journaliserMessages(m, noter) {
  const adresse = QUEST.affiche_message;
  const routine = m.table[adresse];
  m.table[adresse] = (machine, ip) => {
    noter(machine.bx);
    return routine(machine, ip);
  };
}
