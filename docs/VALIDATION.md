# Validation record

## MarsPath 0.2.0

- The original Jezero numerical tests are part of the V2 suite. Representative V2 cases cover coarse MOLA near Gale, a coarse date-line crossing, a longer Gale–Jezero route and a Jezero route through a published delta outcrop.
- An independent Python Dijkstra solver checked twelve V2 route calculations. The maximum absolute difference in model cost was 0.00000184 m. The script checks the full distances, ascent, descent and maximum slope, verifies that used cells are valid and compares original raster samples.
- Nine interior numerical climate values were compared with the retained original ASCII file. The unit suite also checks the export axes, date line and bilinear inspection. See `data/validation/v2-independent.json` and `data/validation/v2-routes.json`.
- Automated axe scans and manual-style browser interactions cover the tested Chromium views. The results describe those views and actions. A complete assistive technology and cross-browser conformance audit remains outside the validation.
- Measured V1 vs V2 on the same Windows desktop with headless Chromium, three repetitions at 1440×900. The measurement workload uses cached NASA tiles. See `data/validation/performance.json` for per-run timings and the separate live requests.

| Median measurement | V1 | V2 |
|---|---:|---:|
| Main-thread JavaScript time during pointer and pan sequence | 187 ms | 77 ms |
| 95th-percentile frame interval | 16.7 ms | 16.7 ms |
| Warm route recalculation | 294 ms | 197 ms |
| Terrain requests over three warm recalculations | 9 | 0 |
| Workers created over three warm recalculations | 3 | 0 |

These timings describe the tested desktop workload. The main browser heap measurement excludes the worker and GPU. Run `npx playwright test --config playwright.profile.config.ts` with the baseline and candidate static previews available to reproduce the desktop comparison and screenshots.

## MarsPath 0.1.0 archive

## Checks actually run

- TypeScript check: passed.
- ESLint: passed without warnings after image/config fixes.
- Vitest: 8 tests passed (controlled coordinates/terrain plus one test covering three real-terrain endpoint pairs and six routes).
- Independent Python Dijkstra: all six route costs agree within 0.0001 model-cost metres; distances independently agree within 0.0001 m. Original GeoTIFF spot samples match exported elevation cells.
- Production static build: passed locally and on Vercel.
- Early deployed atlas: 2 Playwright tests passed against production; NASA tile responses, all 13 destinations, search, source filtering, coordinates, layer controls and mobile selection.
- Updated local static export: 5 Playwright tests passed, including genuine HiRISE loading, valid WMTS requests, preserved map position, desktop/mobile endpoint dragging, worker recalculation, comparisons, explanation/export and stale-metric clearing. The npm start static server was exercised.
- Final production suite: **5 passed in 14.5 seconds** against https://marspath-spaceapps-2026.vercel.app/ on 2026-11-14 at 11:39 UTC (15:39 Asia/Dubai). Deployed application commit: `d477f43`. Vercel deployment completed before testing; no browser credentials were supplied.
- Export inspection: 13 unique region IDs with valid coordinate ranges; no original TIFF or TypeScript source in production output.

## Independent real-terrain results

| Case | Mode | Distance (m) | Maximum modelled slope (°) | Absolute independent cost difference |
|---|---|---:|---:|---:|
| 1 | shortest | 2804.01 | 19.33 | 4e-07 |
| 1 | terrain | 2876.35 | 13.36 | 4.6e-07 |
| 2 | shortest | 3339.35 | 8.50 | 3.1e-07 |
| 2 | terrain | 3339.42 | 6.01 | 3.4e-07 |
| 3 | shortest | 3099.97 | 14.60 | 4.3e-07 |
| 3 | terrain | 3100.01 | 5.91 | 4.6e-07 |

Inputs and complete paths are recorded in `data/validation/routes.json`; independent results are in `data/validation/independent.json`. Source checksum: `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`. Reproduce with `npm test`, then `scripts/validation/verify_routes.py` after source acquisition.

## What these checks establish

The two implementations agree on numerical terrain costs and distance. These are not comparisons with recorded astronaut traverses or field-certified safe routes. High-resolution imagery/elevation registration is based on published co-registered product extents and compatible CRS, not a new independent control-network accuracy assessment. Browser tests are Chromium automation; other browser engines and long-term NASA service availability are not validated.
