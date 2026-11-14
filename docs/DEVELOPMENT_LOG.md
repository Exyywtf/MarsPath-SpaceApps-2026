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

## 2026-11-14 — V3.1 coordinate-edit completion guard

- The `336b002` deployment passed 29 Chromium production journeys. Its full WebKit run passed 28 and exposed a timing issue where route completion could hide a recently edited coordinate error. Pointer interaction inside the planning form now cancels automatic results scrolling and collapse.
- Added a deterministic regression that holds the terrain reply, enters an invalid latitude, moves focus outside the form and then releases the reply. The error and editing controls stay visible. All 11 WebKit route-interaction journeys passed locally, along with lint, the static build and all 24 numerical tests.

## 2026-11-14 22:23 Asia/Dubai — V3.1 production verification

- Pushed and deployed `2363667` to the existing [public MarsPath alias](https://marspath-spaceapps-2026.vercel.app/). Vercel deployment `Fp3iN2s8K58vYQabE8e56AE6pQps` is Ready. The application uses the prebuilt Next.js static export.
- All **30 Chromium production journeys passed in 1.4 minutes** and all **30 WebKit production journeys passed in 1.6 minutes**, including the delayed-coordinate-edit regression, all 13 destinations, real NASA imagery, scientific layers, radiation modes, route drawing and export, keyboard operation, touch Help and document navigation.
- The public route worker, climate data, radiation pressure grid and historical raster return HTTP 200 and match the local build bytes. Verified destination and science-source deep links also return HTTP 200.
- The numerical assets, terrain/ranking model and source terms retain their previous versions. The private GitHub repository contains the software's MIT licence and separate dataset terms. Visual evidence remains in the ignored local review directory. Device checks use browser emulation on Windows, with hardware screen-reader and physical-device testing remaining unverified.

## 2026-11-14 23:45 Asia/Dubai — V3.2 scrolling and recalculation milestone

- Replaced the shared native gutter with measured overlay indicators and independent, persistent workflow viewports. Indicators expose a 24 px pointer strip, a 4 px visible thumb and native scroll offsets; destination imagery now spans the complete panel inner width at its original 205 px height.
- Same-input recalculation retains route selection, matching environmental samples, open evidence and profile state. Prior samples are presentation-only and require exact geometry, connector and dataset fingerprints. Fresh geometry exports explicitly report pending analysis until its current worker reply is accepted.
- All 26 numerical/unit tests, type checking, lint and the static build passed. Seven existing route-interaction browser journeys passed against the static export; both new scrollbar and delayed-analysis regressions passed after correcting native-scroll settling and a 0.2 px status-line height difference.
- Scientific arrays, numerical models and worker calculations are unchanged. The remaining V3.2 controls, disclosures, label placement and navigation work follows this early correction.

## 2026-11-15 00:26 Asia/Dubai — V3.2 shared interface and static navigation

- The early correction `0b77f71` was pushed and deployed to the existing Vercel project. Both new production scrollbar and delayed-analysis regressions passed.
- Added one measured, reversible accordion, native styled selects and evidence links. Coordinates retain their action-row width; Science, Climate and Advanced controls sit together above status and Recalculate. All thirteen destination cards have symmetric 44 px header actions and full-width 205 px source images. Added orbit SVG and multi-size ICO icons.
- Shared measured map rectangles now drive explicit fits, bottom-right HUD docking and deterministic label collisions. Labels use cached wrapped text, stable priorities, four candidate positions, retention clearance and reserved fade-out bounds. Show map reduces an obstructing full sheet and focuses the map without moving its camera.
- Corrected the static server MIME type and generated flat aliases for Next.js segment payloads. Browser checks confirm normal Link navigation can keep the same document. Chromium uses React page transitions at 160/220 ms. Native transitions in the tested Windows WebKit port crashed when snapshotting the atlas canvas; WebKit uses a CSS entry fallback and omits that native boundary entirely.
- Type checking, lint, the 29-test numerical/unit suite and static export passed. The original worker checksum is unchanged. All 36 initial Chromium journeys passed; eighteen final targeted WebKit journeys passed after fixing the compatibility path. Release-wide checks and final production verification follow this milestone.
- Captured all nine approved viewports before/after, touch Help and intermediate interaction states. Visual review caught and corrected a profile SVG selector that enlarged the shared select chevron. Independent Python checks passed for original Jezero, regional/coarse/science routes, climate nodes, radiation assets and the new exported route statistics.

## 2026-11-15 — V3.2 production follow-up

- The `786bb89` production build passed 38 Chromium journeys. WebKit passed 37 and exposed a timing race where calculation completion closed the editor between manual waypoint placements. Each placement now restores the planner to its working size and suspends the automatic results jump for that calculation. The regression waits for all three calculations to finish and checks that waypoint controls remain accessible.
- Legends and inspection cards now dock above a tablet sheet when their boxes intersect it. The zoom controls can remain beside the sheet. The tablet regression checks both information cards and the zoom controls.
- A same-input route response keeps the matching recommendation until fresh scores arrive. The interface marks the analysis as updating during both stages and exports report pending analysis and ranking until the current results are available. The browser regression holds the analysis message and supplies distinct provisional and completed scores.
- The revised static build, type checking, lint and all 29 numerical and unit tests passed. The updated planner, floating scientific controls and delayed-response checks passed in Chromium and WebKit.

## 2026-11-15 00:59 Asia/Dubai — V3.2 production verification

- Pushed and deployed `5c683f9` as a prebuilt static export. Vercel deployment `dpl_9ztdnfJdakgxse7m96bU8tjv3Ync` is Ready at the [public atlas](https://marspath-spaceapps-2026.vercel.app/).
- All 39 Chromium and 39 WebKit journeys passed against the public alias in 1.7 and 2.1 minutes. A separate map click-through opened all 13 pins. Confirmed live NASA WMTS, deep links, science inspection, exports and the orbit icon in a visible Chrome tab. Deployed HTML, worker, sampled science assets, static navigation payload and icons matched the local build.
- Captured the nine approved viewport comparisons and start, intermediate and settled interaction frames. Both desktop engines measured the environmental section at 299.39 px before, during and after recalculation. Touch emulation covered phone and tablet layouts. WebKit used touch taps and keyboard scrolling. The physical devices and hardware screen readers remain untested.
- The final warmed Chromium comparison measured 166.9 ms median result latency and 16.8 ms median p95 frame interval for both versions. Both had one 156 ms long task. The 40 separate live NASA fetches had a 1,057 ms median and 1,349 ms p95. Raw timing and heap samples are in `data/validation/v32-performance.json`.
- The worker and scientific assets retain their established checksums. The software uses MIT terms and the datasets retain their individual terms. GitHub visibility was verified as private.

## 2026-11-15 02:11 Asia/Dubai — V3.3 interaction release

- `8e61453` gave native scroll regions a shared activity deadline and added a Headless UI listbox on Sources. `e86b550` added individual right-click, touch and keyboard endpoint removal, plus centered coordinate submit buttons. Removal preserves the other endpoint and ordered waypoints and invalidates the route, analysis and export before another result can be accepted.
- `fbb43fa` aligned all 13 category labels inside the detail body and compacted the sheet header. `d335d61` softened the thumb entrance and added intermediate fade reversal and 320 px touch-menu coverage.
- Compared V3.2 and V3.3 in Chromium and WebKit across nine viewports, including a 320 × 568 phone. The single-line sheet title row measured 48 px, down from 62 px, with the 44 px toolbar. Mawrth's category and coordinates shared a left edge at every size. The maximum observed offset between a Sources option label and its row center was 0.008 CSS px. Inspected intermediate scrollbar, menu, sheet and marker frames in both engines. The thumb used a 200 ms entrance, a 1,000 ms inactivity deadline and a 300 ms exit.
- Type checking, lint, the 29-test numerical and unit suite and the static build passed. The independent Python Jezero, coarse and science route calculations, climate node comparisons and radiation checks passed. The final local export passed 48 Chromium journeys in 2.1 minutes and 48 WebKit journeys in 2.8 minutes.
- Pushed the four implementation commits to private `main` and deployed `d335d61` as a prebuilt static export. Deployment `dpl_BzoUpUBMG1NkLe7DSopfJeE5F6qN` is Ready at the [public atlas](https://marspath-spaceapps-2026.vercel.app/). Verified 19 byte matches against the export, including HTML, the worker, scientific assets, icons and the static navigation payload. The worker SHA-256 is `988a535ecf040fecda8696ee8b5a2834d6b01a39e14d0437acae06c80978d475`.
- All 48 Chromium production journeys passed in 2.4 minutes and all 48 WebKit journeys passed in 3.2 minutes. The suite exercised live NASA imagery, both radiation modes, route planning and export, source navigation, deep links and endpoint removal. Separate touch checks confirmed endpoint removal and stable zoom on both landscape layouts in both engines.
- Captured production Sources and Mawrth views in both engines at desktop, phone and tablet sizes. A separate Chromium pass recorded 43 successful live NASA WMTS requests across Viking, CTX and HiRISE, with a 658 ms median and 1,316 ms p95. These describe the observed network sample. Phone and tablet coverage used browser emulation, with physical devices and hardware screen readers still unverified.

## 2026-11-15 — V4 destination galleries

- Added 39 individually credited NASA mission products, three for each of the 13 existing destinations. Gusev, Aram and Eridania now have galleries. Each record links the caption, original image, mission or instrument, processing, location relationship and usage terms. The 39 WebP derivatives total 7,053,794 bytes and have verified SHA-256 checksums.
- The atlas requests gallery images on opening a card and warms its next and previous slides. Embla wraps in both directions. Hover, missing visibility, keyboard focus and manual interaction suspend rotation. Reduced motion disables rotation and uses instant movement. The card preserves vertical scrolling and shows the credit for the dominant visible slide.
- Type checking, lint, 30 unit and numerical tests and the static build passed. All 51 browser journeys passed in Chromium and WebKit before the caption timing adjustment. The three targeted gallery journeys then passed again in both engines. Phone swipe verification used Chromium touch emulation. WebKit used touch controls and keyboard scrolling.
- Pushed `d3c7cb1` to private main and deployed the prebuilt export as `dpl_Hi8MTovPVr6ytGFR75wEFXD7Tdy7`. The public alias passed 14 Chromium and seven WebKit journeys covering live NASA imagery, card deep links, galleries, and route workflows. Nine local viewports in each engine requested three images when opening a gallery and measured 377–397 ms to reach 99% of the previous-slide movement. Normal atlas startup requested zero gallery images in the browser test.

## 2026-11-15 — V4 science layers

- Downloaded and checked all 1,311 USGS SIM 3292 source polygons. The 0.125° indexed grid preserves 44 unit codes, descriptions, original feature IDs and the published style colours. Verified 608 independent point-in-polygon checks including seam and polar cells. The source map scale is 1:20,000,000.
- Added 135 source CRISM image centres and 642 chloride catalogue records as separately styled and inspectable markers. Python matched every shipped record to the original coordinates, label or spectral interpretation.
- Added nightside MGS TES apparent thermal inertia. The 0.25° derivative shows 53.0% of Mars by area under the full-cell observation rule. Python confirmed 288 area-weighted values, 317 masked cells and the raster’s transparency. The science assets load when requested. Display rasters and packed inspection grids together with the point catalogue total about 2.3 MB.
- The decoded TES dust-cover PDS and VICAR arrays agreed. The repeated polar floor lacks a documented missing-data code and redistribution terms remain unresolved. The SWIM project returned HTTP 523 and its paper-linked JPL viewer returned 404. Both products remain source references. The MOCAAS download still returned HTTP 410, so the mineral overlay uses the two verified Caltech catalogues.
- Type checking, lint, 32 numerical/unit checks and the static build passed. All 53 browser journeys passed in Chromium and WebKit, including registered inspection, stable camera, failed-grid retry, the previous scientific overlays and live NASA imagery. Reviewed desktop, phone and tablet layer states and intermediate crossfade frames using browser emulation.
- Pushed `3447136` to private main and deployed `dpl_DWYQVBJGFQiqoM6TEHhtbETmfpQS`. Five production journeys in each engine verified the new overlays, failure recovery, climate and both radiation views.

## 2026-11-15 — V4 route evidence

- The route worker now reports mapped-unit lengths and transitions, apparent thermal inertia with length coverage, and closest spherical distances to CRISM and chloride catalogue centres. Exports distinguish assessed routes, connectors and geographic lines and identify pending or partial evidence independently of the original environmental analysis.
- Geologic unit selection compares candidate coverage from the accepted geometry and carries zero ranking weight. Existing A*, target evaluation, terrain costs, climate preferences and radiation analysis keep their original models. The route worker rejects superseded replies and the browser test confirms the gallery and overlay controls leave the calculation count unchanged.
- Independently checked four browser exports covering Jezero, the date line, Terra Sirenum and a short geographic line. Python used the Mars sphere, 2–15 m geodesic quadrature and a separate spherical closest-point calculation. The largest difference in supported thermal length was 0.706 m. These comparisons validate the implementations, with geographic alignment accuracy still unknown.
- With NASA requests disabled on a Windows desktop, eight Chromium and WebKit observations reached initial results in 311–436 ms from the example or coordinate interaction and evidence in 369–529 ms. The selected route’s worker evidence calculation took under 16 ms in those trials. These timings include browser interaction and vary with route length and caching.
- Type checking, lint, 35 numerical and unit checks, the static export and all 55 local Playwright journeys per engine passed. The separate delayed-message check verified that an earlier evidence reply cannot complete a newer export.
- Pushed `00a1aa7` and deployed `dpl_FnZLyEDpEBo8pMfHy4z8Ufq2UedL`. Seven production journeys per engine verified Jezero, coarse routing, both radiation views, the new evidence export and cancellation.

## 2026-11-15 — V4 Olympus Mons and release candidate

- Added Olympus Mons with Gazetteer centre and extent, USGS caldera research, and three NASA gallery images covering the shield and aureole, the summit caldera and a HiRISE lava fan. The atlas now includes 14 destinations and 42 referenced derivatives. Olympus uses the global 0.25° MOLA route tier.
- All 56 local Playwright journeys passed per engine. Every card loaded its three gallery images at desktop and phone sizes. A separate two-image fixture wrapped in both directions in Chromium and WebKit. Reviewed Olympus start, intermediate and settled frames at nine viewport sizes in each engine. The move reached 99% of its final position in 378–398 ms, with three image requests per open card.
- Type checking, lint, 35 numerical and unit checks and the final static build passed. Rechecked six original Jezero calculations, twelve V2 terrain and science calculations, nine climate source nodes, radiation data and environmental summaries.
