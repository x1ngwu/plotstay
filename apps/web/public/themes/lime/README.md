# digi-tech Lime resources

The four SVG tiles are copied unchanged from `/data/apps/cocoons-web/assets/`:
`lime-border.svg`, `lime-border-inactive.svg`, `lime-grid.svg`, and
`lime-panel-grid.svg`. They are the local digi-tech (dot-back) Lime study's
reproductions of Ken Takahashi's 2000 theme. Do not rescale their tile sizes or
replace them with the Colony palette. See `docs/phase-3-visual-alignment.md`.

`fonts/ChicagoFLF.woff2` is copied unchanged from the reference's
`vendor/system.css/fonts/`; the accompanying System.css license is retained
as `fonts/system-css-LICENSE.txt`.

The `zen-hei-sharp-*.woff2` files use WenQuanYi Zen Hei Sharp, the exact body
face used by the reference. They are generated from face 2 of the locally
installed `/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc` using
`scripts/prepare-lime-font.py`. Outlines, hinting, glyph names and embedded
bitmap strikes are retained for the selected glyphs. The full Unicode
coverage of the source face is split into disjoint ranges; the browser loads
only ranges it needs. Existing local installations take precedence.

The prepared files are served locally and committed with the site. Python,
FontTools and Brotli are only needed to regenerate them, not to run or build
PlotStay. The optional generator uses `fonttools==4.66.1`, `brotli==1.2.0`.
Font license and embedding exception: `fonts/WenQuanYi-LICENSE.txt` and
`fonts/GPL-2.txt`.
