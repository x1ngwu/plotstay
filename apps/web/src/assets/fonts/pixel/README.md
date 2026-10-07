# Pixel font delivery assets

The approved font designs and source files are documented in
`docs/font-previews.md` and `apps/web/public/font-preview/fonts/README.md`.
The original files remain in `public/`; these assets are imported by Vite
to obtain content-hashed URLs and long-lived browser caching.

- `DinkieBitmap-9pxCode.woff2`, `cc-red-alert-inet.ttf`, and
  `press-start-k.ttf` are unchanged copies of the supplied originals.
  C&C's original notice is included as `README-c-c-red-alert.txt`.
- `ChicagoFLF.woff2` is an unchanged copy of the existing Lime brand font;
  the accompanying System.css license is retained here.
- `dinkie-{7,9}-*.woff2` are generated delivery subsets. The generator
  preserves embedded names/copyrights, outlines, metrics and bitmap tables.
  It verifies every character previously exposed by the CSS remains in
  exactly one subset, with identical advance widths and outline coordinates.
  Punctuation and commonly used characters are separate from the remaining
  Unicode ranges, which the browser fetches only when needed.
- `pixel-fallback.woff2` contains the existing WenQuanYi Zen Hei Sharp
  fallback glyphs below U+3000 and the core characters absent from Dinkie 9.
  UI arrows and fullwidth punctuation no longer require its entire CJK
  core. The original fallback remains available for other characters.
  Its license and embedding exception are included here.

The Dinkie and Press Start fonts retain their embedded copyright notices;
they are not reclassified as open-source or unrestricted redistribution.
Use remains within the user's existing license scope.

Regenerate with `scripts/prepare-pixel-fonts.py` using the same optional
FontTools 4.66.1 / Brotli 1.2.0 environment as `prepare-lime-font.py`.
Generated assets, `manifest.json`, and `packages/themes/pixel-fonts.css`
are checked in; normal builds and the running site do not require Python.
