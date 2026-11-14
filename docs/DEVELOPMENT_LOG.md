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
