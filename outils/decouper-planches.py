"""Découpe les planches de la vue moderne en images, puis les assemble en un atlas.

    python decouper-planches.py [--source DOSSIER] [--sortie DOSSIER] [--tolerance N]

Les planches sont générées d'après docs/prompts-interface.md et posées dans graphismes/planches/
(<nom>.png). Leur description (grille, noms, tailles, ancrages) est dans outils/planches.json.
Pour chaque planche présente : découpe, retrait du fond vert (#00FF00), recadrage, mise à la
taille de sortie, puis écriture de <sortie>/<nom>.png. Une planche absente est signalée et ignorée.
Enfin, toutes les images du dossier de sortie sont rangées dans atlas.png, avec atlas.json
(nom -> x, y, largeur, hauteur, ancrage en pixels).

Ces images sont créées pour le projet : elles sont versionnées, contrairement aux fichiers du jeu.
"""

import argparse
import json
from pathlib import Path

from PIL import Image

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
LARGEUR_ATLAS = 1024
ESPACE_ATLAS = 1          # pixels transparents entre deux images de l'atlas


def detourer(image, tolerance):
    """Rend transparent le vert du fond, avec un bord adouci, et retire le reflet vert des bords."""
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            ecart = g - max(r, b)                       # combien le pixel est « plus vert » que le reste
            if ecart <= 0:
                continue
            if ecart >= tolerance:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # Pixel de bord : en partie transparent, et le vert ramené au niveau des autres couleurs.
                opacite = 1 - ecart / tolerance
                pixels[x, y] = (r, max(r, b), b, round(a * opacite))
    return image


def recadrer(image):
    boite = image.getbbox()
    return image.crop(boite) if boite else None


def mettre_a_taille(element, taille, cadrage):
    """Réduit l'élément pour qu'il tienne dans la taille, en gardant ses proportions, et le pose
    en bas au centre (cadrage 'bas') ou au centre ('centre') d'une image transparente."""
    largeur, hauteur = taille
    echelle = min(largeur / element.width, hauteur / element.height)
    nouvelle = (max(1, round(element.width * echelle)), max(1, round(element.height * echelle)))
    element = element.resize(nouvelle, Image.LANCZOS)
    sortie = Image.new("RGBA", taille, (0, 0, 0, 0))
    x = (largeur - element.width) // 2
    y = hauteur - element.height if cadrage == "bas" else (hauteur - element.height) // 2
    sortie.paste(element, (x, y), element)
    return sortie


def reduire(image, echelle):
    taille = (max(1, round(image.width * echelle)), max(1, round(image.height * echelle)))
    return image.resize(taille, Image.LANCZOS)


def decouper_grille(planche, description, tolerance):
    colonnes, rangees = description["grille"]
    largeur_case = planche.width // colonnes
    hauteur_case = planche.height // rangees
    images = {}
    for rang, nom in enumerate(description["noms"]):
        if nom is None:
            continue
        colonne, rangee = rang % colonnes, rang // colonnes
        case = planche.crop((colonne * largeur_case, rangee * hauteur_case,
                             (colonne + 1) * largeur_case, (rangee + 1) * hauteur_case))
        if description.get("detourer"):
            case = detourer(case, tolerance)
        element = recadrer(case.convert("RGBA"))
        if element is None:
            print(f"  {nom} : case vide, ignorée")
            continue
        taille = tuple(description.get("tailles", {}).get(nom, description["taille"]))
        images[nom] = mettre_a_taille(element, taille, description.get("cadrage", "bas"))
    return images


def decouper_neuf(planche, description, tolerance):
    """Cadre en 9 morceaux : 4 coins, 4 bords, le fond ; dans l'ordre de lecture."""
    m = description["marge"]
    l, h = planche.width, planche.height
    xs, ys = [0, m, l - m, l], [0, m, h - m, h]
    if description.get("detourer"):
        planche = detourer(planche, tolerance)
    images = {}
    for rang, nom in enumerate(description["noms"]):
        colonne, rangee = rang % 3, rang // 3
        morceau = planche.crop((xs[colonne], ys[rangee], xs[colonne + 1], ys[rangee + 1])).convert("RGBA")
        images[nom] = reduire(morceau, description.get("echelle", 1))
    return images


def decouper_bandes(planche, description, tolerance):
    """Bandes horizontales de hauteurs données, de haut en bas."""
    if description.get("detourer"):
        planche = detourer(planche, tolerance)
    images = {}
    y = 0
    for nom, hauteur in zip(description["noms"], description["bandes"]):
        bande = planche.crop((0, y, planche.width, y + hauteur)).convert("RGBA")
        images[nom] = reduire(bande, description.get("echelle", 1))
        y += hauteur
    return images


DECOUPES = {"grille": decouper_grille, "neuf": decouper_neuf, "bandes": decouper_bandes}


def ancrage_de(nom, image, planches):
    """Point de pose en pixels, d'après la planche qui décrit ce nom (bas au centre par défaut)."""
    for description in planches.values():
        if isinstance(description, dict) and nom in description.get("noms", []):
            fx, fy = description.get("ancrage", [0.5, 1.0])
            return [round(image.width * fx), round(image.height * fy)]
    return [image.width // 2, image.height]


def assembler_atlas(sortie, planches):
    """Range toutes les images du dossier de sortie en rangées, les plus hautes d'abord."""
    images = {f.stem: Image.open(f).convert("RGBA") for f in sorted(sortie.glob("*.png")) if f.stem != "atlas"}
    if not images:
        return 0
    ordre = sorted(images, key=lambda n: (-images[n].height, n))
    positions = {}
    x = y = hauteur_rangee = 0
    for nom in ordre:
        image = images[nom]
        if x + image.width > LARGEUR_ATLAS:
            x, y, hauteur_rangee = 0, y + hauteur_rangee + ESPACE_ATLAS, 0
        positions[nom] = (x, y)
        x += image.width + ESPACE_ATLAS
        hauteur_rangee = max(hauteur_rangee, image.height)
    atlas = Image.new("RGBA", (LARGEUR_ATLAS, y + hauteur_rangee), (0, 0, 0, 0))
    index = {}
    for nom, (x, y) in positions.items():
        image = images[nom]
        atlas.paste(image, (x, y))
        index[nom] = {"x": x, "y": y, "l": image.width, "h": image.height, "ancrage": ancrage_de(nom, image, planches)}
    atlas.save(sortie / "atlas.png")
    (sortie / "atlas.json").write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(index)


def principal():
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("--source", type=Path, default=RACINE / "graphismes" / "planches")
    parametres.add_argument("--sortie", type=Path, default=RACINE / "web" / "vue" / "images")
    parametres.add_argument("--tolerance", type=int, default=60, help="écart de vert au-delà duquel un pixel est effacé")
    arguments = parametres.parse_args()

    planches = json.loads((ICI / "planches.json").read_text(encoding="utf-8"))
    arguments.sortie.mkdir(parents=True, exist_ok=True)
    for nom_planche, description in planches.items():
        if nom_planche.startswith("_"):
            continue
        fichier = arguments.source / f"{nom_planche}.png"
        if not fichier.exists():
            print(f"{nom_planche} : planche absente ({fichier}), ignorée")
            continue
        planche = Image.open(fichier).convert("RGB")
        decoupe = DECOUPES[description.get("decoupe", "grille")]
        images = decoupe(planche, description, arguments.tolerance)
        for nom, image in images.items():
            image.save(arguments.sortie / f"{nom}.png")
        print(f"{nom_planche} : {len(images)} images")
    total = assembler_atlas(arguments.sortie, planches)
    print(f"atlas : {total} images" if total else "atlas : aucune image")


if __name__ == "__main__":
    principal()
