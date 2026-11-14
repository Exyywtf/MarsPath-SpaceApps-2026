# Validation record

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
