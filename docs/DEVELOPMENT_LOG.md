# Development log

## 2026-11-14 — Foundation

Inspected the supplied 31 files and live NASA service metadata during planning. Initialized a static-export Next.js project and MIT software license. No application tests have run yet. Vercel requires account sign-in; GitHub CLI is authenticated. Commit hashes are recorded in subsequent log updates and Git history.

## 2026-11-14 — Global atlas and early deployment

- `c94bc9b`: initialized repository, static-export configuration and software license; created private GitHub repository and pushed successfully.
- `b8fcac0`: implemented NASA WMTS global map, all 13 destinations, search/filtering, source-linked panels, source library and methods page. Audited 31 supplied files without changing originals. Retrieved 12 source pages after correcting moved NASA resource URLs; Aram Chaos's JPL page returned 403. Source-image derivatives were obtained for ten regions.
- User completed Vercel device authorization. CLI production deployment succeeded; automatic linking to the private GitHub repository failed. Continued using verified Git pushes and separate CLI deployment.
- Production build and two Playwright browser checks passed against the early public atlas, including real NASA tile responses and mobile destination selection.

## 2026-11-14 — Numerical terrain and route engine

- `f5c84c0`: processed published 20 m Jezero CTX DTM and supplied MOLA overview, preserved raw input, recorded transform/units/checksum and exported compact browser derivatives.
- `cfe7df8`: added eight-neighbour A*, slope/grade constraints, nodata handling, no diagonal corner cutting, actual route metrics, and ordered waypoint support in the engine.
- Eight Vitest tests passed, including three real-terrain cases. An independent Python Dijkstra solver agreed with all six route costs and distances within 0.0001; original raster spot samples matched the derivative.

## 2026-11-14 — Interactive planner and verification

- `8c2e0de`: added cancellable worker calculation, draggable endpoints, two route modes, parameters, normalized two-candidate recommendation, elevation profile, computed explanation, and provenance-bearing GeoJSON export.
- Fixed static-export worker packaging with explicit esbuild output. Excluded exported artifacts from TypeScript input to avoid recursive checking of stale output.
- Fixed initial planner/map loading order, global whole-extent fitting, mobile sheet padding, stale metrics when endpoints change, and explicit tile matrix row/column bounds.
- Four local static-export Playwright tests passed, including actual desktop/mobile dragging and recalculation. Early failures identified a test click intercepted by the mobile Destinations button; adjusted the test to click exposed map surface. Another early drag test started before the map had focused; made the map respond reliably to planner activation and waited for observable view state.
- Typecheck and lint passed. Production-only dependency audit reported zero vulnerabilities; full dev-tool audit reports seven moderate entries in the minimatch/typescript-eslint chain, unchanged by `npm audit fix`.
- A second production deployment with the planner succeeded. Final production verification and release notes follow in the release entry.

## 2026-11-14 15:39 Asia/Dubai — Release verification

- `c189a73`: NASA-discovered WMTS templates, matrix dimensions and bounds; mobile and progressive-imagery checks.
- `5dc6db6`: synchronize imagery labels with actual visibility thresholds, make close-up navigation reach HiRISE, and add a 13-region availability registry.
- `3b33e50`: source/claim/provenance records, public cost definition and independent validation table, licensing notices, reproducibility instructions and submission materials. Pin dependencies and provide export-compatible npm start.
- `d477f43`: extract available institutional image credits and clarify processed/composite image contexts. Two illustrations retain explicit unresolved individual-credit notes instead of invented credits.
- Final Vercel deployment succeeded. All **five production Playwright tests passed in 14.5 seconds**, without browser credentials, at https://marspath-spaceapps-2026.vercel.app/ . Checks include real global/HiRISE tiles, sources and 13 places, coordinates, preserved map position, valid tile matrix requests, desktop/mobile route dragging, recalculation, comparisons, explanations and export.
- Final local TypeScript, ESLint and static production build passed. Eight Vitest tests and six independent Python route/source checks passed. Export inspection found no raw TIFF or TypeScript source.
- Original files remain untouched. Repository remains private; original software is MIT licensed. CLI deployment works; automatic GitHub/Vercel linking remains unresolved. Routing supports the 20 m Jezero grid; climate/radiation and science-value scoring remain excluded.
- Official challenge Resources/submission-guide access remained blocked by 502/SSL errors. The checklist leaves those eligibility checks unresolved. No competition submission was made.


## 2026-11-14 — V2 P0 interface and worker milestone

- Replaced competing sidebars with a readable map-first interface and responsive single workflow sheet; locally bundled Geist with its OFL notice.
- Added explicit A/B placement, coordinate entry, swapping, clearing, ordered waypoints, persistent drafts, Help, shortcuts and reduced-motion map navigation. Third clicks no longer replace endpoints.
- Kept the original terrain frontier/costs and measurements; exposed the same search through a generator for cooperative cancellation. Persistent request-ID worker caches decoded terrain (64 MiB bound). Added an explicitly unassessed geographic connection outside the regional DEM.
- Replaced the expensive unformatted chart with an extrema-preserving SVG profile and keyboard inspection linked to the map. Pointer coordinates now update their own component; view metadata updates after completed view changes, not continuously.
- All 11 Vitest tests, typecheck, lint and the static build passed. All six local Playwright tests passed in 9.4 seconds, including genuine NASA/HiRISE tiles, mobile dragging and terrain download reuse. Normal tests no longer rewrite validation records.
- Browser audit found and fixed an overridden font variable, geographic centre shifts during responsive padding updates, stale endpoint pixel metadata, and an onboarding card that intercepted a mobile drag. Climate overlays and coarse/science routing are next; no claim of measured FPS improvement yet.


## 2026-11-14 — V2 P1 numerical overlays

- P0 commit ce81abe deployed successfully. All six production Playwright tests passed in 19.3 seconds, including genuine NASA/HiRISE tiles and mobile route interaction.
- Added numerical MOLA elevation plus MCD 6.2 temperature, pressure and horizontal wind speed overlays. Single active scalar layer has opacity, exact-domain legend, source/context and bilinear numerical inspection. Original screenshot colours are never inverted to values.
- Acquired and retained the small source ASCII export (SHA-256 aabe016b2609e0a083d47f9be782de94f13204e8d5c0c1c6f11867b8eeb02cbd). Verified 64 longitude × 48 latitude nodes. Reconstructed unrounded linspace coordinates because printed longitudes are truncated. PNG resampling evaluates numerical values at pixel centres to avoid a half-cell shift.
- Model context: Ls 21.3°, local 00:00 at every longitude, 10 m ALS, climatology average solar. Temperature 143.291–207.346 K, pressure 88.6751–1238.46 Pa, wind 0.120004–39.43 m/s. Wind duplicate seam discrepancy max 0.00151 m/s is recorded and averaged; temperature/pressure seams match.
- User chose to send the MCD notice and explicitly confirmed it was sent to both authors. Agent did not send correspondence or independently verify delivery. Preserved MCD noncommercial conditions separately from MIT.
- Created the 1440×720 MOLA derivative and finite-difference slope/mask arrays (9,331,200 decoded bytes). All derived cells have numerical support; this is not independent physical coverage or safety confidence. Routing integration follows in P2.
- All 14 Vitest tests, TypeScript, ESLint and static build passed. All seven local Playwright journeys passed in 18.7 seconds. Browser inspection verified actual climatology values and responsive legends. One transient Windows write failure during regeneration was resolved by rerunning the deterministic processor; final array sizes and tests passed.

## 2026-11-14 — V2 global routing and science milestone

- The scientific layer commit `0de0df8` deployed successfully. Its four-field inspection journey passed against production in 6.8 seconds.
- Added a periodic 0.25° MOLA terrain graph and geographic fallback for unresolved legs. Terrain distance, elevation changes and slope use complete paths. Dotted connectors identify unassessed offsets at endpoints and stops. Fit on map centres date-line crossings on their actual local extent.
- Added three cited Jezero delta type locations, scoring for Ancient Water and Sedimentary Geology, and optional single-stop candidates alongside the ordered user waypoints. Kept the original Jezero slope and terrain cost model.
- Independently validated 12 V2 route calculations and nine numerical climate nodes. Maximum absolute model cost difference was about 0.00000184 m. Raster sample checks and full-path metrics passed.
- Archived repeatable cached-imagery desktop measurements. The tested V2 pointer and pan workload used 77 ms of median main-thread JavaScript time versus 187 ms for V1. Three warm recalculations reused the terrain cache and worker. Both builds had a 16.7 ms 95th-percentile frame interval.
- Added axe checks, keyboard/placement tests, a visit to each of the thirteen destinations, mobile sheet dragging and date-line route framing. A layer test once clicked the same position repeatedly, which could zoom via double-click. The current test inspects distinct positions and asserts that each control and inspection preserves the view.
- Production initially passed 13 of 14 journeys on `779faa0`. The failed keyboard journey entered Directions while the dynamically imported map was still loading. Map-dependent controls now wait for initialization. The new regression holds the map bundle while Directions loads and verifies that A can be placed as soon as the map is ready.

## 2026-11-14 — V2 production verification

- Deployed `811074a` to [the public MarsPath site](https://marspath-spaceapps-2026.vercel.app/). All 15 production Playwright journeys passed in 31.5 seconds, including NASA WMTS and HiRISE, all 13 destinations, four scientific layers, keyboard placement during delayed map loading, mobile dragging, geographic fallback, a coarse date-line route and a Jezero science route.
- The homepage, sources, methods, worker and scientific assets are served statically. Verified the public retained MCD ASCII checksum against the processed manifest.
- The 18-test Vitest suite, type checking, ESLint and the production build passed. The production dependency audit reported zero vulnerabilities. The previously documented seven moderate development-tool findings remain.
- Saved before-and-after screenshots at four viewport sizes in `tmp/v2-review`. The automated accessibility checks apply to the tested Chromium states. Desktop profiling and independent numerical checks are linked from the validation record.

## 2026-11-14 — V3 interaction milestone

- Route results, export and editing stay available while the map draws the accepted paths. Exact duplicates are grouped by ordered geometry and stops. The Directions panel reveals the comparison once and yields to manual scrolling and active editing. Jezero has a featured route-planning entry that preserves the draft, and the world map declutters labels without removing destinations.
- Local static build, type checking, lint, 20 Vitest checks and 19 Chromium journeys passed. Independent Python also reproduced 12 V2 route calculations and nine climate nodes. The independent validation scripts now only write their committed records when invoked with `--write`.
- Pushed and deployed `a6e9288` to Vercel. Eighteen production browser journeys passed on the first run. The bundle-delay test initially missed Vercel’s immutable chunk path and then attempted a click before hydration. The corrected test passed on the same deployment.

## 2026-11-14 — V3 scientific analysis

- Added worker-side environmental profiles, score-only preference changes, science-aware candidates, and a versioned route export with separate connector features. Terrain search and its validated metrics remain the basis of path generation.
- Built the radiation scenario from Zhang and Guo’s numerical pressure grid and six published AtRIS outputs. The historical overlay independently reprojects NASA’s PIA03480. Its retained coverage is 79.75% of Mars by area. Independent controls and checksum evidence are in `data/validation/v3-radiation.json`.
- Confirmed six published pressure anchors against the grid. The largest withheld-pressure interpolation difference was 2.48 mSv/year. Point accuracy remains unknown. No radiation product contributes to the score.
- Independently checked the numerical raster colours and compared the Jezero GeoJSON means for four environmental factors against Python using the full route. Captured V2 and V3 layouts at four widths and recorded the actual reveal intervals.
- Pushed and deployed `6c954a2`. All 22 unauthenticated production Chromium journeys passed in 52.1 s, including the production bundle delay, imagery, sources, route, overlay and export checks. The 24 Vitest tests, type checking, lint and static builds passed.
- The 1440×900 comparison measured 222 ms median warm result latency in V3, compared with 224 ms in V2. The median trial 95th-percentile frame interval was 16.8 ms in V3. The reveal increased median main-thread JavaScript time from 18 ms to 90 ms. See the validation record for live tile timings and memory limits.

## 2026-11-14 — V3.1 startup and camera

- Started from `393b85e` and retained the prior static export for visual comparison. The atlas now fits Mars inside the initial usable viewport. Camera movement is reserved for navigation, explicit fit actions and actual viewport resizing. A verified `?place=jezero` destination link starts focused, with an empty draft.
- Seven targeted Chromium journeys passed locally, including globe framing at nine viewports, no restored endpoints, pixel stability across panels, relief and scientific opacity defaults, live NASA tiles, and all 13 destinations. The 24 existing Vitest tests passed.

## 2026-11-14 — V3.1 route interaction

- Pushed the startup checkpoint `6c88805`. Reused endpoint features, eased the distance-based route reveal, and added a delayed calculation status that shares the Skip reveal control's position.
- A same-input recalculation retains the comparison position and marks the prior values as updating. Current geometry export resumes on worker completion. Verified cancellation, immediate export, scroll interruption, Edit route focus, resizing, endpoint dragging, geographic fallback and the published Jezero outcrop journey in local Chromium.
- Deployed `9fb9ba1` as an early prebuilt static export on the existing Vercel project. All 13 targeted public Chromium journeys passed in 33.5 seconds.

## 2026-11-14 — V3.1 map and reference interface

- Visited workflows keep their controls and scroll position. Scientific rasters crossfade between reused layers after the new image and inspection data load. A failed layer keeps the last working layer visible, and an older response cannot replace a newer selection.
- Added map label fades, a stable profile frame, native disclosure transitions, shared Sources and Methodology navigation, and centred Help and NASA illustration dialogs. Touch Help uses three short sections; keyboard activation exposes the shortcut controls.
- Tests exercised rapid switching and retry, focus on the published outcrop after opening nested evidence, touch Help at five sizes, document navigation and numerical radiation inspection. Radiation raster checksums, masks and numeric-to-legend checks passed the independent Python verifier.

## 2026-11-14 — V3.1 final visual verification

- Deployed `e4a7458` and passed all 29 production Chromium journeys. The subsequent visual audit added outgoing workflow/profile transitions, smooth overlay dismissal and disclosure chevrons, and fixed the tablet header overflow.
- Captured and reviewed nine viewport comparisons and motion storyboards, including a real-time monotonic route reveal. The fixed warm benchmark measured a 169.0 ms median result latency and 16.8 ms median trial p95 frame interval in V3.1. The raw record also reports a 159 ms long task and the sampled heap, with worker/GPU and physical-device limitations.
- Independent Python checks passed for the original terrain cases, regional/coarse/science routes, climate source nodes, radiation assets and the newly exported environmental profile. The route-worker bundle is byte-identical to V3.
- A WebKit run exposed one-pixel scroll rounding and a test that attempted Swap after the editor had collapsed. Updated the checks to exercise Edit route and the requested approximate scroll clearance. All 16 affected WebKit journeys then passed. Ten final targeted Chromium journeys, the 24 numerical tests, type checking, lint and the static build passed before release.
