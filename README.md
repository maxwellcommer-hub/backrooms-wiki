# The Backrooms Update wiki

The player wiki for **The Backrooms Update 3.0.0** (NeoForge 1.21.1, on CurseForge as "The Backrooms Update", by MC_CREATIONS).
A static site: plain HTML, one stylesheet (`assets/style.css`), one small script (`assets/site.js`), no build step.
It is published with GitHub Pages at https://maxwellcommer-hub.github.io/backrooms-wiki/ .

## Preview

From the repo root:

    python3 -m http.server -d wiki

then open http://localhost:8000/ . (Opening the files straight from disk works too, except the search box,
which loads `assets/search-index.json` with `fetch`.)

## Layout

- `index.html` and one page per topic: `getting-in`, `the-remembering`, `rules`, `insanity`, `refuges`, `mobs`, `keeper`,
  `buried-works`, `items`, `crafting`, `config`, `commands`, `faq`. Every page carries the same sidebar and footer.
- `assets/shots/`: in-game screenshots from the mod's scripted shot runs, JPEG, at most 1280 px wide.
- `assets/icons/`: the mod's own 16x16 item and block textures, drawn pixelated. Vanilla items in recipes are shown by name
  (no Mojang textures are shipped).
- `assets/search-index.json`: the client-side search index.
- `tools/search_index.py`: rebuilds the search index from the pages. Run it after editing any page.
- `tools/check_links.py`: checks every internal link, anchor and image. Run it before publishing.
- `.nojekyll`: tells GitHub Pages to serve the files as they are.

All links are relative, so the site works under `/backrooms-wiki/` and from any other folder.

## Editing

Edit the HTML directly. Take numbers from the code (loot tables, recipes, config) rather than from memory. Then:

    python3 wiki/tools/search_index.py
    python3 wiki/tools/check_links.py

## Publishing

The wiki lives in its own repository, `maxwellcommer-hub/backrooms-wiki`, with the contents of this folder at its root and
GitHub Pages serving the `main` branch from `/` (Settings > Pages). Push to `main` and Pages redeploys in a minute or two.

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
