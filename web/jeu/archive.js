// Archive de fichiers : pour chacun, longueur du nom (1 octet), nom, taille (4 octets,
// petit-boutiste), contenu. Format de fichiers.php et du paquet de données (outils/paquet.mjs).

export function lireArchive(octets) {
  const fichiers = new Map();
  for (let p = 0; p < octets.length;) {
    const longueur = octets[p];
    const nom = String.fromCharCode(...octets.subarray(p + 1, p + 1 + longueur));
    p += 1 + longueur;
    const taille = (octets[p] | (octets[p + 1] << 8) | (octets[p + 2] << 16) | (octets[p + 3] << 24)) >>> 0;
    if (p + 4 + taille > octets.length) throw new Error(`archive tronquée (${nom})`);
    fichiers.set(nom, octets.slice(p + 4, p + 4 + taille));
    p += 4 + taille;
  }
  return fichiers;
}

// entrees : [nom, Uint8Array][] ; noms ASCII de 255 caractères au plus.
export function ecrireArchive(entrees) {
  const total = entrees.reduce((somme, [nom, contenu]) => somme + 5 + nom.length + contenu.length, 0);
  const archive = new Uint8Array(total);
  let p = 0;
  for (const [nom, contenu] of entrees) {
    archive[p++] = nom.length;
    for (let i = 0; i < nom.length; i++) archive[p++] = nom.charCodeAt(i);
    new DataView(archive.buffer).setUint32(p, contenu.length, true);
    archive.set(contenu, p + 4);
    p += 4 + contenu.length;
  }
  return archive;
}
