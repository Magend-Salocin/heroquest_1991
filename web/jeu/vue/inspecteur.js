// Inspecteur (index.html?inspecteur=1) : un panneau à côté de l'écran du jeu qui montre la
// partie telle que le code la voit : routine en cours et pile d'appels, dernier tirage du hasard,
// fiches des héros, monstres vus, et les trois grilles du plateau (zones, murs, occupants).
// Il ne fait que lire la mémoire. Sans ?inspecteur=1, ce module n'est pas chargé.

import { lireEtat, LARGEUR, HAUTEUR } from './etat.js';
import { Hasard } from '../lisible/hasard.js';
import { QUEST } from '../lisible/adresses.gen.js';
import { RETOUR_LISIBLE } from '../lisible/routines.js';

const PERIODE_MS = 100;            // rafraîchissement du panneau
const CASE_PX = 8;                 // taille d'une case dans les grilles
const PROFONDEUR_PILE = 256;       // mots de pile lus au plus
const NOMS = Object.fromEntries(Object.entries(QUEST).map(([nom, adresse]) => [adresse, nom]));
const hex = (n, chiffres = 4) => n.toString(16).padStart(chiffres, '0');

// ---- Routines et pile d'appels

// Nom de la routine qui contient ip : le code généré range une même fonction sur toute la plage
// de la routine (nom_adresse) ; une routine réécrite n'occupe que son adresse d'entrée.
function nomRoutine(m, ip) {
  if (NOMS[ip]) return NOMS[ip];
  const nom = m.table[ip]?.name;
  const generee = nom && /^(.+)_[0-9a-f]+$/.exec(nom);
  return generee ? generee[1] : `0x${hex(ip)}`;
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

// Routine en cours : celle de ip, ou la routine lisible qui reprend la main (ip = RETOUR_LISIBLE).
function routineEnCours(m) {
  if (m.ip === RETOUR_LISIBLE && m.lisibles?.length) return `${m.lisibles.at(-1).routine.nom} (lisible)`;
  return nomRoutine(m, m.ip);
}

// Pile d'appels estimée, de la plus récente à la plus ancienne : les adresses de retour trouvées
// dans la pile du programme, et les routines lisibles en cours. Une routine lisible qui appelle
// pose RETOUR_LISIBLE juste sous sa propre entrée dans la pile (sp mémorisé par routines.js).
function pileAppels(m) {
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

// ---- Grilles

function couleurZone(zone, vue) {
  return zone === 0 ? '#000' : `hsl(${(zone * 47) % 360} 45% ${vue ? 50 : 22}%)`;
}

function couleurOccupant(occupant) {
  switch (occupant?.sorte) {
    case 'monstre': return '#e33';
    case 'éboulis': return '#888';
    case 'piège': return occupant.cache ? '#775' : '#ee3';
    case 'escalier': return '#3cc';
    case 'meuble': return '#a63';
    default: return null;
  }
}

function couleurPorte(porte) {
  if (porte.secrete && !porte.ouverte) return '#b4f';    // secrète, pas encore trouvée
  return porte.ouverte ? '#4e4' : '#f93';
}

function dessinerZones(ctx, cases) {
  for (const c of cases) {
    ctx.fillStyle = couleurZone(c.zone, c.vue);
    ctx.fillRect(c.x * CASE_PX, c.y * CASE_PX, CASE_PX, CASE_PX);
  }
}

function dessinerMurs(ctx, cases) {
  for (const c of cases) {
    const [x, y] = [c.x * CASE_PX, c.y * CASE_PX];
    ctx.fillStyle = c.zone ? '#333' : '#000';
    ctx.fillRect(x, y, CASE_PX, CASE_PX);
    for (const [bord, horizontal] of [[c.haut, true], [c.gauche, false]]) {
      const couleur = bord.porte ? couleurPorte(bord.porte) : bord.mur ? '#ddd' : null;
      if (!couleur) continue;
      ctx.fillStyle = couleur;
      if (horizontal) ctx.fillRect(x, y, CASE_PX, 2); else ctx.fillRect(x, y, 2, CASE_PX);
    }
  }
}

function dessinerOccupants(ctx, cases) {
  for (const c of cases) {
    const [x, y] = [c.x * CASE_PX, c.y * CASE_PX];
    ctx.fillStyle = c.zone ? '#222' : '#000';
    ctx.fillRect(x, y, CASE_PX, CASE_PX);
    const couleur = couleurOccupant(c.occupant);
    if (couleur) {
      ctx.fillStyle = couleur;
      ctx.fillRect(x + 1, y + 1, CASE_PX - 2, CASE_PX - 2);
    }
  }
}

function dessinerHeros(ctx, heros) {
  ctx.fillStyle = '#fff';
  for (const h of heros) {
    ctx.beginPath();
    ctx.arc(h.x * CASE_PX + CASE_PX / 2, h.y * CASE_PX + CASE_PX / 2, CASE_PX / 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// ---- Panneau

function element(parent, balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte) e.textContent = texte;
  parent.append(e);
  return e;
}

function tableau(parent, entetes, lignes) {
  parent.replaceChildren();
  const t = element(parent, 'table');
  const tete = element(t, 'tr');
  for (const entete of entetes) element(tete, 'th', null, entete);
  for (const { cellules, courant } of lignes) {
    const ligne = element(t, 'tr', courant ? 'courant' : null);
    for (const cellule of cellules) element(ligne, 'td', null, String(cellule));
  }
}

function detailCase(etat, index) {
  const c = etat.plateau.cases[index];
  const lignes = [`case (${c.x}, ${c.y}), index ${index}, zone ${c.zone}${c.vue ? ', vue' : ''}${c.bordVu ? ', bord vu' : ''}`];
  for (const nom of ['haut', 'gauche', 'bas', 'droite']) {
    const b = c[nom];
    if (b.mur) lignes.push(`${nom} : mur`);
    if (b.porte) lignes.push(`${nom} : porte${b.porte.secrete ? ' secrète' : ''}, ${b.porte.ouverte ? 'ouverte' : 'fermée'}`);
  }
  const o = c.occupant;
  if (o) lignes.push(`occupant 0x${hex(o.code, 2)} : ${o.sorte}${o.nom ? ` (${o.nom})` : ''}${o.cache ? ', caché' : ''}`);
  if (o?.sorte === 'monstre') {
    const m = etat.monstres.find((monstre) => monstre.numero === o.numero);
    if (m) lignes.push(`monstre ${m.numero} : ${m.nomType}${m.vu ? '' : ', pas encore vu'}${m.reveille ? ', réveillé' : ''}${m.endormi ? ', endormi' : ''}`);
  }
  for (const h of etat.heros.filter((heros) => heros.x === c.x && heros.y === c.y)) {
    lignes.push(`héros ${h.numero} : ${h.nomType}`);
  }
  return lignes.join('\n');
}

export function creerInspecteur(conteneur) {
  const feuille = document.createElement('link');
  feuille.rel = 'stylesheet';
  feuille.href = new URL('./inspecteur.css', import.meta.url).href;
  document.head.append(feuille);
  document.body.classList.add('avec-inspecteur');

  const panneau = element(conteneur, 'aside', null);
  panneau.id = 'inspecteur';
  const entete = element(panneau, 'p', 'entete');
  element(panneau, 'h2', null, 'Pile d\'appels (estimée)');
  const pile = element(panneau, 'ol', 'pile');
  element(panneau, 'h2', null, 'Hasard');
  const hasard = element(panneau, 'p', 'hasard');
  element(panneau, 'h2', null, 'Héros');
  const heros = element(panneau, 'div');
  element(panneau, 'h2', null, 'Monstres vus');
  const monstres = element(panneau, 'div');
  element(panneau, 'h2', null, 'Plateau : zones, murs et portes, occupants');
  const grilles = element(panneau, 'div', 'grilles');
  const contextes = ['zones', 'murs', 'occupants'].map((nom) => {
    const canvas = element(grilles, 'canvas');
    canvas.width = LARGEUR * CASE_PX;
    canvas.height = HAUTEUR * CASE_PX;
    canvas.title = nom;
    return canvas.getContext('2d');
  });
  element(panneau, 'p', 'legende',
    'Murs : blanc ; portes : orange fermée, vert ouverte, violet secrète non trouvée. Occupants : rouge monstre, '
    + 'gris éboulis, jaune piège (sombre : caché), cyan escalier, brun meuble. Rond blanc : héros.');
  const detail = element(panneau, 'pre', 'detail', 'Survoler une grille pour le détail d\'une case.');

  let dernierTirage = null;
  let tirages = 0;
  Hasard.observateur = (tirage) => { dernierTirage = tirage; tirages++; };

  let caseSurvolee = null;
  for (const { canvas } of contextes) {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * LARGEUR);
      const y = Math.floor(((e.clientY - r.top) / r.height) * HAUTEUR);
      caseSurvolee = x >= 0 && x < LARGEUR && y >= 0 && y < HAUTEUR ? y * LARGEUR + x : null;
    });
  }

  let precedent = 0;
  return {
    mettreAJour(m, programme) {
      const maintenant = performance.now();
      if (maintenant - precedent < PERIODE_MS) return;
      precedent = maintenant;
      if (programme !== 'QUEST') {
        entete.textContent = `${programme} : l'inspecteur suit QUEST.EXE.`;
        return;
      }
      const etat = lireEtat(m);
      const graine = etat.graine;
      entete.textContent = `Quête ${etat.quete + 1}, personnage ${etat.personnageCourant} · routine en cours : ${routineEnCours(m)} (IP ${hex(m.ip)})`;

      pile.replaceChildren();
      for (const appel of pileAppels(m)) element(pile, 'li', null, appel);

      hasard.textContent = dernierTirage
        ? `${tirages} tirages. Dernier : 1 à ${dernierTirage.max} → ${dernierTirage.resultat} ; `
          + `registre ${hex(dernierTirage.avant, 8)} → ${hex(dernierTirage.apres, 8)}. Registre actuel ${hex(graine, 8)}.`
        : `Registre actuel ${hex(graine, 8)}. Aucun tirage suivi (avec ?genere, le hasard n'est pas réécrit).`;

      tableau(heros, ['n°', 'type', 'case', 'corps', 'esprit', 'att.', 'déf.', 'or'], etat.heros.map((h) => ({
        courant: h.numero === etat.personnageCourant,
        cellules: [h.numero, h.nomType, `${h.x}, ${h.y}`, h.pointsCorps, h.pointsEsprit, h.desAttaque, h.desDefense, h.or],
      })));
      tableau(monstres, ['n°', 'type', 'case', 'zone', 'état'], etat.monstres.filter((mo) => mo.vu && mo.vivant).map((mo) => ({
        cellules: [mo.numero, mo.nomType, `${mo.x}, ${mo.y}`, mo.zone,
          [mo.reveille && 'réveillé', mo.endormi && 'endormi', mo.passeSonTour && 'passe son tour'].filter(Boolean).join(', ') || '-'],
      })));

      const [zones, murs, occupants] = contextes;
      dessinerZones(zones, etat.plateau.cases);
      dessinerMurs(murs, etat.plateau.cases);
      dessinerOccupants(occupants, etat.plateau.cases);
      for (const ctx of contextes) dessinerHeros(ctx, etat.heros);
      if (caseSurvolee !== null) detail.textContent = detailCase(etat, caseSurvolee);
    },
  };
}
