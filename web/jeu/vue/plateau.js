// Vue moderne du plateau : un rendu isométrique sur un canvas séparé,
// qui ne fait que lire l'état de la partie (etat.js) à chaque image. Le jeu d'origine continue
// de tourner et de recevoir les clics sur son propre écran ; les règles et les dés sont les siens.
//
// Projection : une case est un losange de LARGEUR_CASE × HAUTEUR_CASE ; le coin haut de la case
// (x, y) est à ((x - y) × L/2, (x + y) × H/2). Seuls les murs du fond (bords haut et gauche de
// chaque case) sont dessinés, pour voir l'intérieur des pièces. Ordre de dessin : du fond vers
// l'avant (x + y croissant). On ne montre que ce que les héros ont vu : cases vues, monstres vus,
// pièges trouvés, portes secrètes ouvertes.
//
// Images : web/vue/images/atlas.png et atlas.json (outils/decouper-planches.py) s'ils existent ;
// sinon, ou pour une image absente de l'atlas, des formes simples.
//
// Bascule : bouton « Vue » ou touche F9 ; le choix est gardé dans le navigateur. index.html?vue=moderne
// et ?vue=origine forcent le choix sans le garder. La vue moderne ne remplace que le plateau, pendant
// une partie (phaseDuJeu) ; l'inventaire, les menus et les autres écrans restent ceux d'origine.
// Autour du plateau : fiches des héros, tour en cours, dés, actions, journal des messages.
//
// Commandes (commandes.js) : un clic sur une case devient un clic sur la même case de l'écran
// d'origine, une action du panneau un clic sur son icône ; clic droit, ou appui long au doigt,
// donne le clic droit du jeu. Rien n'est écrit en mémoire : les règles restent celles du jeu.

import { lireEtat, LARGEUR, HAUTEUR } from './etat.js';
import { phaseDuJeu } from './pile.js';
import { lireMessage, journaliserMessages } from './messages.js';
import { zonesPanneau, positionEcranCase } from './commandes.js';

const LARGEUR_CASE = 64;
const HAUTEUR_CASE = 32;
const HAUTEUR_MUR = 56;
const HAUTEUR_MURET = 8;                   // mur d'une case pas encore vue, dont seul le bord est connu
const SUIVI_CAMERA = 0.15;                 // part du chemin restant parcourue à chaque image
const PREMIERE_PIECE = 21;                 // zones 1 à 20 : couloirs ; 21 et plus : pièces
const ATLAS = 'vue/images/atlas';
const TYPES_HEROS = ['barbare', 'nain', 'elfe', 'enchanteur'];
const IMAGES_MONSTRES = ['gobelin', 'orc', 'brute', 'guerrier-noir', 'squelette', 'zombi', 'momie', 'gargouille', 'chef-orc', 'chef-orc', 'chef-orc', 'sorcier-trone'];
const COULEURS_HEROS = ['#c0392b', '#d68910', '#27ae60', '#2e86c1', '#aaa'];
const NOMS_HEROS = ['Barbare', 'Nain', 'Elfe', 'Enchanteur', 'Sir Ragnar'];
const PORTRAITS = 'vue/images/portraits';
const CLE_VUE = 'heroquest-vue';             // localStorage : 'moderne' ou 'origine'
const TAILLE_JOURNAL = 6;
const PERIODE_PANNEAU_MS = 100;
const IMAGES_STABLES = 3;                  // images concordantes avant de changer d'écran (pile estimée)
const DUREE_APPUI_LONG_MS = 500;           // au doigt : appui long = clic droit
const ORDRE_ACTIONS = ['mode_attaque', 'fouille_tresor', 'fouille_portes', 'ouvre_portes', 'action_sort', 'inventaire_sorts', 'mode_regarder', 'fin_tour'];

const COULEUR = {
  fond: '#0b0d12',
  piece: '#4a5363', couloir: '#3a4250', joint: 'rgba(0,0,0,0.35)',
  murFace: '#6b7385', murDessus: '#8a93a6', murOmbre: '#4c5260',
  porteFermee: '#7a4a24', porteOuverte: '#2b1a0e', porteBord: '#3b2412',
  eboulis: '#77777a', escalier: '#15171c', piege: '#a08a20', meuble: '#6e4a2a', meubleDessus: '#8b6238',
  monstre: '#b03030', ombre: 'rgba(0,0,0,0.35)',
};

// Coin haut du losange de la case (x, y), dans le repère du plateau.
const projeter = (x, y) => [(x - y) * (LARGEUR_CASE / 2), (x + y) * (HAUTEUR_CASE / 2)];

// Petit hachage stable de la position : la même case garde la même variante d'image.
const hachage = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

async function chargerAtlas() {
  try {
    const reponse = await fetch(`${ATLAS}.json`);
    if (!reponse.ok) return null;
    const index = await reponse.json();
    const image = new Image();
    image.src = `${ATLAS}.png`;
    await image.decode();
    return { index, image };
  } catch {
    return null;                             // pas d'atlas : formes simples
  }
}

function lireChoix(options) {
  const force = options.get('vue');
  if (force === 'moderne' || force === 'origine') return force;
  try { return localStorage.getItem(CLE_VUE) === 'moderne' ? 'moderne' : 'origine'; } catch { return 'origine'; }
}

function garderChoix(choix) {
  try { localStorage.setItem(CLE_VUE, choix); } catch { /* stockage indisponible : choix pour cette page seulement */ }
}

function element(parent, balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  parent.append(e);
  return e;
}

// jeu.cliquer(x, y, bouton) : clic sur l'écran d'origine (320 × 200 ; x null : sans bouger le curseur),
// bouton 1 gauche, 2 droit (principal.js).
export function creerVueModerne(conteneur, options, jeu) {
  const feuille = document.createElement('link');
  feuille.rel = 'stylesheet';
  feuille.href = new URL('./plateau.css', import.meta.url).href;
  document.head.append(feuille);

  const cadre = document.createElement('div');
  cadre.id = 'vue-moderne-cadre';
  conteneur.prepend(cadre);
  const canvas = element(cadre, 'canvas');
  canvas.id = 'vue-moderne';
  const panneau = element(cadre, 'aside');
  panneau.id = 'panneau-moderne';
  const titreTour = element(panneau, 'p', 'tour');
  const fiches = element(panneau, 'div', 'fiches');
  const des = element(panneau, 'p', 'des');
  element(panneau, 'h2', null, 'Actions');
  const actions = element(panneau, 'div', 'actions');
  const aide = element(panneau, 'p', 'aide', 'Clic sur une case : y aller (ou arrêter les dés, viser). Clic droit ou appui long : fin du tour, fermer un message.');
  element(panneau, 'h2', null, 'Messages');
  const journal = element(panneau, 'ol', 'journal');
  const bouton = element(conteneur, 'button', null);
  bouton.id = 'bascule-vue';
  bouton.type = 'button';

  let choix = lireChoix(options);
  const afficherChoix = () => {
    document.body.classList.toggle('vue-moderne', choix === 'moderne');
    bouton.textContent = choix === 'moderne' ? "Vue d'origine (F9)" : 'Vue moderne (F9)';
  };
  afficherChoix();
  const basculer = () => {
    choix = choix === 'moderne' ? 'origine' : 'moderne';
    garderChoix(choix);
    afficherChoix();
  };
  bouton.addEventListener('click', basculer);

  const messages = [];
  let machineSuivie = null;
  let dernierPanneau = 0;
  let ecranAffiche = 'autre';
  let ecranVu = 'autre';
  let imagesConcordantes = 0;
  let decalage = [0, 0];                     // translation du plateau dans le canvas (dernière image)
  let machineCourante = null;
  let zones = [];
  const ctx = canvas.getContext('2d');
  let atlas = null;
  chargerAtlas().then((a) => { atlas = a; });
  let camera = null;

  // ---- Dessin d'une image de l'atlas, ou rien (la forme simple prend le relais)

  function image(nom, x, y, miroir = false) {
    const entree = atlas?.index[nom];
    if (!entree) return false;
    const [ax, ay] = entree.ancrage;
    ctx.save();
    ctx.translate(x, y);
    if (miroir) ctx.scale(-1, 1);
    ctx.drawImage(atlas.image, entree.x, entree.y, entree.l, entree.h, -ax, -ay, entree.l, entree.h);
    ctx.restore();
    return true;
  }

  // ---- Formes simples

  function losange(x, y, couleur, bord) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + LARGEUR_CASE / 2, y + HAUTEUR_CASE / 2);
    ctx.lineTo(x, y + HAUTEUR_CASE);
    ctx.lineTo(x - LARGEUR_CASE / 2, y + HAUTEUR_CASE / 2);
    ctx.closePath();
    ctx.fillStyle = couleur;
    ctx.fill();
    if (bord) { ctx.strokeStyle = bord; ctx.stroke(); }
  }

  // Pan de mur vertical entre deux points du sol.
  function pan(x1, y1, x2, y2, hauteur, couleur) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 - hauteur);
    ctx.lineTo(x1, y1 - hauteur);
    ctx.closePath();
    ctx.fillStyle = couleur;
    ctx.fill();
  }

  // Bloc posé sur une case : un losange réduit, extrudé.
  function bloc(x, y, hauteur, couleurFace, couleurDessus, reduction = 0.7) {
    const l = (LARGEUR_CASE / 2) * reduction;
    const h = (HAUTEUR_CASE / 2) * reduction;
    const cx = x;
    const cy = y + HAUTEUR_CASE / 2;
    pan(cx - l, cy, cx, cy + h, hauteur, couleurFace);
    pan(cx, cy + h, cx + l, cy, hauteur, COULEUR.murOmbre);
    ctx.beginPath();
    ctx.moveTo(cx, cy - h - hauteur);
    ctx.lineTo(cx + l, cy - hauteur);
    ctx.lineTo(cx, cy + h - hauteur);
    ctx.lineTo(cx - l, cy - hauteur);
    ctx.closePath();
    ctx.fillStyle = couleurDessus;
    ctx.fill();
  }

  function figurine(x, y, couleur, hauteur) {
    const cx = x;
    const pied = y + HAUTEUR_CASE / 2;
    ctx.fillStyle = COULEUR.ombre;
    ctx.beginPath();
    ctx.ellipse(cx, pied, 12, 6, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = couleur;
    ctx.fillRect(cx - 7, pied - hauteur, 14, hauteur);
    ctx.beginPath();
    ctx.arc(cx, pied - hauteur - 5, 7, 0, 2 * Math.PI);
    ctx.fill();
  }

  // ---- Éléments du plateau

  function dessinerSol(c, x, y) {
    const piece = c.zone >= PREMIERE_PIECE;
    const variante = 1 + (hachage(c.x, c.y) % 6);
    if (image(`sol-${piece ? 'piece' : 'couloir'}-${variante}`, x, y + HAUTEUR_CASE)) return;
    losange(x, y, piece ? COULEUR.piece : COULEUR.couloir, COULEUR.joint);
  }

  // Bord haut (vers le haut à droite) ou gauche (vers le haut à gauche) d'une case. Une case dont
  // seul le bord est connu (bordVu) n'a qu'un muret : un mur entier cacherait la case vue devant.
  function dessinerBord(c, x, y, cote) {
    const bord = c[cote];
    if (!c.vue) {
      if (!bord.mur && !bord.porte) return;
      const [x2, y2] = cote === 'haut' ? [x + LARGEUR_CASE / 2, y + HAUTEUR_CASE / 2] : [x - LARGEUR_CASE / 2, y + HAUTEUR_CASE / 2];
      pan(x, y, x2, y2, HAUTEUR_MURET, COULEUR.murOmbre);
      return;
    }
    const porteVisible = bord.porte && (!bord.porte.secrete || bord.porte.ouverte);
    if (!bord.mur && !porteVisible && !(bord.porte?.secrete)) return;
    const [x2, y2] = cote === 'haut' ? [x + LARGEUR_CASE / 2, y + HAUTEUR_CASE / 2] : [x - LARGEUR_CASE / 2, y + HAUTEUR_CASE / 2];
    const milieu = [(x + x2) / 2, (y + y2) / 2];
    if (porteVisible) {
      const nom = bord.porte.secrete ? `secret-${cote}` : `porte-${cote}-${bord.porte.ouverte ? 'ouverte' : 'fermee'}`;
      if (image(nom, milieu[0], milieu[1] + HAUTEUR_CASE / 4)) return;
      pan(x, y, x2, y2, HAUTEUR_MUR, COULEUR.murFace);
      pan(x + (x2 - x) * 0.2, y + (y2 - y) * 0.2, x + (x2 - x) * 0.8, y + (y2 - y) * 0.8, HAUTEUR_MUR * 0.75,
        bord.porte.ouverte ? COULEUR.porteOuverte : COULEUR.porteFermee);
      return;
    }
    // Mur, ou porte secrète pas encore trouvée (vue comme un mur).
    const torche = hachage(c.x, c.y) % 7 === 0 ? '-torche' : '';
    if (image(`mur-${cote}${torche}`, milieu[0], milieu[1] + HAUTEUR_CASE / 4) || image(`mur-${cote}`, milieu[0], milieu[1] + HAUTEUR_CASE / 4)) return;
    pan(x, y, x2, y2, HAUTEUR_MUR, cote === 'haut' ? COULEUR.murFace : COULEUR.murOmbre);
    ctx.strokeStyle = COULEUR.murDessus;
    ctx.beginPath();
    ctx.moveTo(x, y - HAUTEUR_MUR);
    ctx.lineTo(x2, y2 - HAUTEUR_MUR);
    ctx.stroke();
  }

  function dessinerOccupant(c, x, y) {
    const o = c.occupant;
    if (!o) return;
    const pied = y + HAUTEUR_CASE;
    switch (o.sorte) {
      case 'éboulis':
        if (!image('eboulis', x, pied)) bloc(x, y, 10, COULEUR.eboulis, '#99999c', 0.8);
        break;
      case 'escalier':
        losange(x, y, COULEUR.escalier);
        break;
      case 'piège':
        if (!o.cache) losange(x, y + HAUTEUR_CASE * 0.2, COULEUR.piege);
        break;
      case 'meuble':
        if (o.nom === 'suite') bloc(x, y, 18, COULEUR.meuble, COULEUR.meubleDessus, 0.9);
        else if (!image(`meuble-${o.nom}`, x, pied)) bloc(x, y, 18, COULEUR.meuble, COULEUR.meubleDessus, 0.9);
        break;
      default:
        break;
    }
  }

  function dessinerMonstre(m, x, y) {
    const nom = IMAGES_MONSTRES[m.type] ?? 'sorcier';
    if (!image(`monstre-${nom}`, x, y + HAUTEUR_CASE / 2)) figurine(x, y, COULEUR.monstre, 22);
  }

  function dessinerHeros(h, x, y) {
    const type = TYPES_HEROS[h.type];
    if (type && image(`heros-${type}-h-bas`, x, y + HAUTEUR_CASE / 2)) return;
    figurine(x, y, COULEURS_HEROS[h.type] ?? '#fff', 26);
  }

  // ---- Image complète

  function dessiner(etat) {
    const largeur = canvas.clientWidth;
    const hauteur = canvas.clientHeight;
    const echelle = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(largeur * echelle) || canvas.height !== Math.round(hauteur * echelle)) {
      canvas.width = Math.round(largeur * echelle);
      canvas.height = Math.round(hauteur * echelle);
    }
    ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
    ctx.fillStyle = COULEUR.fond;
    ctx.fillRect(0, 0, largeur, hauteur);

    // La caméra suit le personnage courant (ou le premier héros).
    const suivi = etat.heros.find((h) => h.numero === etat.personnageCourant) ?? etat.heros[0];
    if (suivi) {
      const [cx, cy] = projeter(suivi.x + 0.5, suivi.y + 0.5);
      camera = camera ? [camera[0] + (cx - camera[0]) * SUIVI_CAMERA, camera[1] + (cy - camera[1]) * SUIVI_CAMERA] : [cx, cy];
    }
    if (!camera) return;
    ctx.save();
    decalage = [Math.round(largeur / 2 - camera[0]), Math.round(hauteur / 2 - camera[1])];
    ctx.translate(...decalage);

    const cases = etat.plateau.cases;
    const personnages = new Map();
    for (const h of etat.heros) personnages.set(h.y * LARGEUR + h.x, () => dessinerHeros(h, ...projeter(h.x, h.y)));
    for (const m of etat.monstres) {
      const c = cases[m.y * LARGEUR + m.x];
      if (m.vu && m.vivant && c?.vue) personnages.set(m.y * LARGEUR + m.x, () => dessinerMonstre(m, ...projeter(m.x, m.y)));
    }

    // Du fond vers l'avant : diagonales x + y croissantes.
    for (let somme = 0; somme <= LARGEUR + HAUTEUR - 2; somme++) {
      for (let x = Math.max(0, somme - HAUTEUR + 1); x <= Math.min(LARGEUR - 1, somme); x++) {
        const y = somme - x;
        const index = y * LARGEUR + x;
        const c = cases[index];
        if (!c.zone || !(c.vue || c.bordVu)) continue;
        const [px, py] = projeter(x, y);
        if (c.vue) dessinerSol(c, px, py);
        dessinerBord(c, px, py, 'haut');
        dessinerBord(c, px, py, 'gauche');
        if (c.vue) dessinerOccupant(c, px, py);
        personnages.get(index)?.();
      }
    }
    ctx.restore();
  }

  // ---- Commandes

  // Case du plateau sous un point du canvas (inverse de projeter).
  function caseSous(e) {
    const r = canvas.getBoundingClientRect();
    const u = (e.clientX - r.left - decalage[0]) / (LARGEUR_CASE / 2);   // x - y
    const v = (e.clientY - r.top - decalage[1]) / (HAUTEUR_CASE / 2);    // x + y
    const x = Math.floor((u + v) / 2);
    const y = Math.floor((v - u) / 2);
    return x >= 0 && x < LARGEUR && y >= 0 && y < HAUTEUR ? { x, y } : null;
  }

  function cliquerCase(e) {
    const c = caseSous(e);
    if (!c || !machineCourante) return;
    const point = positionEcranCase(machineCourante, c.x, c.y);
    if (!point) {
      aide.textContent = `La case (${c.x}, ${c.y}) n'est pas dans la vue d'origine : approchez-vous, ou cliquez sur l'écran d'origine.`;
      return;
    }
    jeu.cliquer(point.x, point.y, 1);
  }

  let appui = null;                          // { minuterie, droit } pendant un appui au doigt
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'mouse') {
      if (e.button === 2) jeu.cliquer(null, null, 2);
      else if (e.button === 0) cliquerCase(e);
      return;
    }
    const a = { droit: false };
    a.minuterie = setTimeout(() => { a.droit = true; jeu.cliquer(null, null, 2); }, DUREE_APPUI_LONG_MS);
    appui = a;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || !appui) return;
    clearTimeout(appui.minuterie);
    if (!appui.droit) cliquerCase(e);
    appui = null;
  });
  canvas.addEventListener('pointercancel', () => { if (appui) clearTimeout(appui.minuterie); appui = null; });

  // Boutons d'action, dans l'ordre de ORDRE_ACTIONS ; grisés comme l'icône d'origine.
  function remplirActions() {
    const boutons = new Map([...actions.children].map((b) => [b.dataset.routine, b]));
    for (const routine of ORDRE_ACTIONS) {
      const zone = zones.find((z) => z.routine === routine);
      let b = boutons.get(routine);
      if (!zone) { b?.remove(); continue; }
      if (!b) {
        b = element(actions, 'button', null, zone.libelle);
        b.type = 'button';
        b.dataset.routine = routine;
        b.addEventListener('click', () => {
          const z = zones.find((candidate) => candidate.routine === routine);
          if (z) jeu.cliquer(z.x, z.y, 1);
        });
      }
      b.disabled = !zone.utilisable;
    }
  }

  // ---- Panneau : tour, fiches, dés, actions, journal

  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

  function remplirPanneau(etat, phase) {
    const courant = etat.heros.find((h) => h.numero === etat.personnageCourant);
    titreTour.textContent = phase.tour === 'monstres' ? 'Tour de Morcar' : `Tour : ${courant ? NOMS_HEROS[courant.type] ?? '?' : '?'}`;

    fiches.replaceChildren();
    for (const h of etat.heros) {
      const fiche = element(fiches, 'div', h.numero === etat.personnageCourant && phase.tour === 'heros' ? 'fiche courante' : 'fiche');
      const type = TYPES_HEROS[h.type];
      if (type) {
        const portrait = element(fiche, 'img');
        portrait.src = `${PORTRAITS}/${type}-h.png`;
        portrait.alt = '';
      }
      element(fiche, 'strong', null, NOMS_HEROS[h.type] ?? `Personnage ${h.numero}`);
      element(fiche, 'span', 'valeurs', `Corps ${h.pointsCorps} · Esprit ${h.pointsEsprit} · Att. ${h.desAttaque} · Déf. ${h.desDefense} · Or ${h.or}`);
    }

    const combat = `Dernier combat : ${pluriel(etat.combat.cranes, 'crâne')}, ${pluriel(etat.combat.boucliers, 'bouclier')}`;
    des.textContent = phase.tour === 'heros'
      ? `Déplacement : ${pluriel(etat.deplacementRestant, 'case')} (${pluriel(etat.desDeplacement, 'dé')}) · ${combat}`
      : combat;

    remplirActions();
    journal.replaceChildren();
    for (const texte of messages) element(journal, 'li', null, texte);
  }

  function noterMessage(m, numero) {
    const lignes = lireMessage(m, numero).filter(Boolean);
    if (!lignes.length) return;
    const texte = lignes.join(' ');
    if (messages[0] === texte) return;              // même boîte réaffichée
    messages.unshift(texte);
    messages.length = Math.min(messages.length, TAILLE_JOURNAL);
  }

  return {
    basculer,
    mettreAJour(m, programme) {
      if (programme !== 'QUEST') { document.body.classList.remove('plateau-actif'); return; }
      if (machineSuivie !== m) {
        machineSuivie = m;
        journaliserMessages(m, (numero) => noterMessage(m, numero));
      }
      if (choix !== 'moderne') { document.body.classList.remove('plateau-actif'); return; }
      machineCourante = m;
      const phase = phaseDuJeu(m);
      const etat = lireEtat(m);
      // La phase vient d'une pile estimée : un mot isolé peut tromper une image ; on attend qu'elle se confirme.
      if (phase.ecran === ecranVu) imagesConcordantes++; else { ecranVu = phase.ecran; imagesConcordantes = 1; }
      if (imagesConcordantes >= IMAGES_STABLES) ecranAffiche = ecranVu;
      const surLePlateau = ecranAffiche === 'plateau' && etat.heros.length > 0 && etat.plateau.cases.some((c) => c.vue);
      document.body.classList.toggle('plateau-actif', surLePlateau);
      if (!surLePlateau) return;
      dessiner(etat);
      const maintenant = performance.now();
      if (maintenant - dernierPanneau >= PERIODE_PANNEAU_MS) {
        dernierPanneau = maintenant;
        zones = zonesPanneau(m);
        remplirPanneau(etat, phase);
      }
    },
  };
}
