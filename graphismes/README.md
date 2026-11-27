# Graphismes de la vue moderne

Images créées pour le projet (phase 5), versionnées : elles ne viennent pas du jeu de 1991.

- `planches/<nom>.png` : les planches générées d'après [docs/prompts-interface.md](../docs/prompts-interface.md), une par nom de planche (`sols.png`, `murs.png`…).
- Découpe, depuis `outils/` : `python decouper-planches.py`. Le script lit `outils/planches.json`, écrit les images et l'atlas dans `web/vue/images/` (`atlas.png`, `atlas.json`) et ignore les planches absentes.
