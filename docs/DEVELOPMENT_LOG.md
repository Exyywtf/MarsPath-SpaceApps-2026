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
