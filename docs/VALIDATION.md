# Validation record

## MarsPath V4

- [Dataset checks](../data/validation/v4-datasets.json) independently matched 608 USGS polygon cell centres, all 777 mineral catalogue records and 605 TES cells, including 317 masked cells. The verifier checks output hashes and the relationship between raster colours and their source-derived lookup.
- [Route evidence checks](../data/validation/v4-route-evidence.json) cover four exported routes, including a regional Jezero path, a coarse date-line crossing, a Terra Sirenum route and a geographic connection. Independent Mars-sphere sampling agreed on mapped units, valid thermal lengths and closest catalogue approaches. The largest thermal coverage-length difference was 0.706 m. Ground alignment accuracy remains unknown.
- The local static build passed 56 Playwright journeys each in Chromium and WebKit, together with 35 numerical and unit tests, TypeScript and ESLint. Gallery captures cover nine viewport sizes in both engines. Chromium used touch swipe emulation, and WebKit used touch taps and keyboard scrolling. Physical devices and hardware screen readers remain untested.
- Production `558a524` matched 59 local export files byte for byte. Inspected rendered NASA imagery and collected separate live request timings. The local gallery and route trials isolated external imagery traffic. [Timing and asset-size record](../data/validation/v4-performance.json).
- The final public deployment passed 56 Chromium and 56 WebKit journeys in 2.6 and 3.2 minutes. A dedicated entrance-frame regression now checks layer text stays at full opacity.

Run `scripts/validation/verify_v4_datasets.py <snapshot>` with the original files named in the science manifest. Pass downloaded route GeoJSON files to `scripts/validation/verify_v4_route_evidence.py`. Both scripts read the committed derivatives and write validation records only with `--write`.

## MarsPath V3.2

- Application commit `5c683f9` passed 39 Chromium and 39 WebKit journeys on the public Vercel site. The runs took 1.7 and 2.1 minutes. Type checking, lint, the 29 numerical and unit tests, the independent Python checks and the static export also passed.
- Production tests covered live Viking and HiRISE tiles, all 13 destinations, keyboard and touch controls, waypoint editing, scientific layers, both radiation modes and export while new analysis is pending. A separate production click-through opened all 13 map pins at their recorded coordinates. The orbit icon was visible in a Chrome tab. The deployed worker, sampled scientific assets, favicons and navigation payload matched local bytes.
- The nine viewport comparisons and Chromium and WebKit motion captures are in the ignored `tmp/v32-review` directory. Touch swiping was exercised in Chromium. WebKit used touch taps and native keyboard scrolling. WebKit uses a 220 ms CSS entry fade because the Windows test engine crashed during native atlas transitions. The browser runs cover emulated devices. Physical devices and hardware screen readers remain untested.
- The independent Python checks covered six original Jezero paths, 12 regional, coarse and science route calculations, nine climate source nodes, the radiation rasters and the environmental samples in the new route export.

| Three warmed 1440×900 Chromium trials | V3.1 `fda8fa9` | V3.2 `5c683f9` |
|---|---:|---:|
| Median time from Recalculate to export-ready route | 166.9 ms | 166.9 ms |
| Median trial p95 frame interval | 16.8 ms | 16.8 ms |
| Median main-thread script time | 61.4 ms | 54.9 ms |
| Median layout time | 2.17 ms | 1.88 ms |
| Longest task | 156 ms | 156 ms |
| Last worker calculation with three cached legs | 13 ms | 13 ms |
| Median sampled main-page heap | 13.55 MB | 14.52 MB |

Each trial recalculates the Jezero example and performs 48 pointer moves. Both builds served all measured tile requests from the shared cache. The separate 40 live NASA tile fetches had a median of 1,057 ms and a p95 of 1,349 ms. Heap observations exclude worker and GPU memory and vary with garbage collection. The measurements describe a single Windows desktop. See [the raw V3.2 performance record](../data/validation/v32-performance.json).

To repeat the comparison, serve the V3.1 static export on port 4334 and V3.2 on port 4333. Run `npx playwright test --config=playwright.profile.config.ts v32.spec.ts --browser=chromium`. Set `MARSPATH_PROFILE_ONLY=1` to skip the nine viewport captures. For motion frames, run `v32-motion.spec.ts` with the same configuration and set `MOTION_OUTPUT` to choose the local destination.

## MarsPath V3.1

- Released application commit `2363667` passed all **30 Chromium and 30 WebKit production journeys** against the public Vercel alias without credentials. The runs completed in 1.4 and 1.6 minutes respectively. Type checking, lint, all 24 numerical tests, independent Python checks and the static production build passed. The coordinate-edit completion guard is included in both browser suites.
- Browser coverage includes the nine requested viewports, all 13 destinations, fresh global fitting, empty endpoints, explicit destination links, stable map pixels, coordinate entry, dragging, Swap/Clear, waypoints, cancellation, export during reveal, and the three terrain-capability tiers. It also covers scientific inspection, rapid layer switching and retry, both radiation modes, Sources, Methodology, keyboard Help and reduced motion. Actual production test counts and the deployed commit are recorded in the development log.
- Saved 72 before/after exploration, route, Sources and mouse-operated Help views at nine sizes in the ignored `tmp/v31-review` directory. Separate touch Help captures cover phone portrait, phone landscape and tablet orientations. Start, intermediate and settled motion frames are retained in its `motion` directory. The visual audit caught a clipped header at 834 px and the final layout uses accessible icon actions at that width.
- Independent Python reran six original Jezero routes, twelve regional/coarse/science calculations and nine climate source-node comparisons. It verified the radiation checksums, masks, periodic interpolation and legend colours, then recomputed the new Jezero export's climate and radiation statistics. The production worker bytes match V3. Numerical source assets have their original checksums.
- The automated accessibility audit covers settled interactive states. Motion is inspected separately. WebKit scroll positioning rounds the requested 20 px clearance by one pixel, so the regression allows 19–21 px and checks that recalculation retains the existing offset. Hardware screen-reader and physical iPad/phone testing remain outside this browser-emulation audit.

| Three warmed 1440×900 Chromium trials | V3 | V3.1 |
|---|---:|---:|
| Median result latency | 167.8 ms | 169.0 ms |
| Median trial p95 frame interval | 16.7 ms | 16.8 ms |
| Median main-thread JavaScript | 78.8 ms | 80.4 ms |
| Median layout time | 3.2 ms | 2.8 ms |
| Long tasks across three trials | 1 | 1 |
| Longest observed task | 159 ms | 159 ms |
| Last calculation with three cached legs | 13 ms | 14 ms |
| Median main-page JavaScript heap | 10.2 MB | 15.0 MB |

The workload recalculates the Jezero example and makes 48 pointer moves. Both builds used cached NASA imagery during the measured trials and generated zero new NASA tile loads in those trials. The separate 40 live tile requests had a 1,019 ms median and 1,499 ms p95. Heap observations exclude the worker and GPU and vary with garbage collection. These results describe one Windows desktop. Raw observations and reveal-frame counts are in [v31-performance.json](../data/validation/v31-performance.json). The explicit profiling command writes ignored local review artifacts, and normal numerical tests keep committed validation records read-only.

## MarsPath 0.3.0

- Application commit `6c954a2` passed all 22 Chromium journeys in 52.1 s on the [public Vercel alias](https://marspath-spaceapps-2026.vercel.app/) without credentials. Type checking, ESLint, 24 Vitest checks and the local and Vercel static builds passed. The public worker, methods and source deep links and radiation assets returned HTTP 200. The tests exercised live NASA WMTS, all 13 destinations, route export during reveal, cancellation, mobile scrolling, radiation modes and score-only climate preferences.
- The read-only V3 Python check validates checksums, raster masks, Mars longitude wrapping, georeferenced sample colours and the expected model pressure domain. An independent spherical calculation matched the Jezero export’s weighted temperature, pressure, wind speed and radiation means to within 0.00001 of their displayed units before rounding, and distance to within 0.01 m. V2 independent terrain checks still pass.
- The PIA03480 controls match printed grid lines with a 95th-percentile residual of 1.39 source pixels or less. The five landmark residuals are below 4.89 source pixels. These are checks on the artwork registration. Absolute geographical dose accuracy remains unknown.
- The sampled reveal progressed monotonically over 82 captured frames and 1.35 s. Before-and-after exploration and route views at 1920×1080, 1440×900, 1024×768 and 390×844 and reveal screenshots are in the ignored local `tmp/v3-review` folder.

| Measured in headless Chromium at 1440×900 | V2 `c40fe5f` | V3 `6c954a2` |
|---|---:|---:|
| Median time from warm Recalculate to results | 224 ms | 222 ms |
| Median trial p95 frame interval | 16.7 ms | 16.8 ms |
| Median main-thread JavaScript time for the workload | 18 ms | 90 ms |
| Long tasks across three trials | 1 | 1 |
| Last warm terrain calculation with three cached legs | 13 ms | 17 ms |
| Median main JS heap after a trial | 22.3 MB | 16.5 MB |

The fixed workload recalculates the Jezero example and moves the pointer over the map 54 times. The animation adds JavaScript work. Live NASA requests were measured separately for 86 tile loads, with a 528 ms median and a 1,367 ms 95th percentile. Two new tile loads fell within one V2 run. Heap sampling excludes the worker and GPU and varies with garbage collection. These measurements cover one Windows desktop and do not establish mobile runtime performance. Raw timings are in [v3-performance.json](../data/validation/v3-performance.json). To repeat the comparison, serve copies of the V2 and V3 static builds on ports 4321 and 4320 and run `npx playwright test --config playwright.profile.config.ts v3.spec.ts`.

## MarsPath 0.2.0

- Deployed application commit `811074a` passed all 15 Playwright journeys in 31.5 seconds against the public Vercel alias on November 14, 2026. The tests used fresh browser contexts without credentials. Local Chromium passed the same 15 journeys in 24.1 seconds. Type checking, ESLint, the 18-test Vitest suite and the local and Vercel static builds passed.
- Captured the V1 and released V2 layouts at 1920×1080, 1440×900, 1024×768 and 390×844 in the local `tmp/v2-review` directory. The V1 baseline comes from its original Git commit and the V2 screenshots use the public deployment.
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

These timings describe the tested desktop workload. The main browser heap measurement excludes the worker and GPU. To reproduce, serve a static build of `9a0936d` on port 4318 and V2 on port 3000, then run `npx playwright test --config playwright.profile.config.ts`. Set `BASE_URL` when running the screenshot test to capture the released site.

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
