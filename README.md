# lexora-presentation

Présentation interactive de **Lexora** — l'ERP comptable piloté par l'IA, conçu pour l'Île Maurice — accompagnée d'une **vidéo guidée** cinématique qui se joue toute seule.

## Fichiers

- **`Lexora - Vidéo guidée.html`** — la pièce maîtresse. Une vidéo guidée qui pilote la présentation : intro animée (titre LEXORA lettre par lettre), un doigt qui circule pour faire défiler chaque page lentement, puis tape pour passer à la section suivante. Rythme volontairement lent pour pouvoir commenter en direct. Contrôles lecture/pause, barre de progression et puces de chapitres sous le cadre.
- **`presentation.html`** — la présentation dynamique chargée dans le cadre de la vidéo (14 sections : Vue d'ensemble, Philosophie, Comptabilité, Banque, MRA, IFRS, GBC, RH, Stocks, Agents IA, MCP, Telegram, Architecture, Comparatif). 100 % autonome (CSS + JS inline).
- **`director.js`** — le moteur « réalisateur » qui orchestre la vidéo : intro, doigt animé, défilement, transitions de page. La durée de chaque page est **calculée selon la densité de son contenu** (~20 s à ~46 s), pour un total d'environ 8 min.

## Utilisation

La vidéo guidée charge `presentation.html` dans une iframe, il faut donc servir les
fichiers via HTTP (ouvrir directement le fichier en `file://` bloque l'iframe) :

```sh
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000/Lexora%20-%20Vid%C3%A9o%20guid%C3%A9e.html>.

### Contrôles

- **Espace** — lecture / pause
- **← / →** — reculer / avancer de 5 s
- **↺** — recommencer
- Clic sur la barre de progression ou sur une puce de chapitre pour se positionner

Le respect de `prefers-reduced-motion` et la mémorisation de la position de
lecture (via `localStorage`) sont assurés par la présentation et le moteur.
