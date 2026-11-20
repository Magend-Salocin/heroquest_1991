// Commandes tactiles, sous l'écran (portrait) ou à côté (paysage). Toucher l'écran du jeu
// déplace le curseur et clique (bouton gauche, voir principal.js) ; ces boutons ajoutent ce
// qu'un écran tactile ne sait pas faire :
//   Clic droit   le bouton droit de la souris, tenu tant que le doigt reste sur le bouton
//   Clavier      ouvre le clavier de l'appareil (nom des héros)
//   Son          F10 : coupe la musique et active les effets, comme dans l'original
// Affichées sur un écran tactile (pointer: coarse), ou avec ?tactile ; masquées avec ?sans-tactile.

const LETTRE = /^[A-Z]$/;
const CHIFFRE = /^[0-9]$/;
const SIGNES = { ' ': 'Space', '-': 'Minus', '.': 'Period', ',': 'Comma', "'": 'Quote' };

// Nom de touche (KeyboardEvent.code) d'un caractère, sur un clavier QWERTY : le jeu lit des
// positions, et la position QWERTY d'une lettre donne bien cette lettre.
function toucheDe(caractere) {
  if (LETTRE.test(caractere)) return `Key${caractere}`;
  if (CHIFFRE.test(caractere)) return `Digit${caractere}`;
  return SIGNES[caractere];
}

export function commandesTactilesVoulues(options) {
  if (options.has('sans-tactile')) return false;
  return options.has('tactile') || matchMedia('(pointer: coarse)').matches;
}

// actions : { appuyerBouton(bit), relacherBouton(bit), taper(touche, ascii) }
export function brancherCommandesTactiles(actions) {
  const commandes = document.querySelector('#commandes');
  const saisie = document.querySelector('#saisie');
  commandes.hidden = false;
  document.body.classList.add('tactile');

  const boutonDroit = document.querySelector('#clic-droit');
  boutonDroit.addEventListener('pointerdown', (e) => {
    boutonDroit.setPointerCapture(e.pointerId);
    actions.appuyerBouton(2);
  });
  for (const fin of ['pointerup', 'pointercancel']) {
    boutonDroit.addEventListener(fin, () => actions.relacherBouton(2));
  }

  document.querySelector('#son').addEventListener('click', () => actions.taper('F10', 0));

  // Le clavier de l'appareil s'ouvre sur un champ invisible ; chaque caractère tapé devient
  // une touche du PC, puis le champ est vidé.
  const boutonClavier = document.querySelector('#clavier');
  boutonClavier.addEventListener('pointerdown', (e) => e.preventDefault());   // garde le champ actif
  boutonClavier.addEventListener('click', () => {
    if (document.activeElement === saisie) saisie.blur();
    else saisie.focus();
  });
  saisie.addEventListener('input', () => {
    const texte = saisie.value.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
    saisie.value = '';
    for (const caractere of texte) {
      const touche = toucheDe(caractere);
      if (touche) actions.taper(touche, caractere.charCodeAt(0));
    }
  });
  saisie.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') actions.taper('Backspace', 0x08);
    else if (e.key === 'Enter') { actions.taper('Enter', 0x0d); saisie.blur(); }
    else return;
    e.preventDefault();
  });
}

