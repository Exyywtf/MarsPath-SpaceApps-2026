# MarsPath

A planet-wide Mars atlas with 13 scientific destinations and explainable, numerical-terrain route planning in a supported Jezero region.

**Live app:** https://marspath-spaceapps-2026.vercel.app/

**Sources and methods:** https://marspath-spaceapps-2026.vercel.app/sources/

Built for NASA Space Apps 2026. Research and education only; no NASA endorsement or astronaut-safety certification.

## Try the application

1. Explore global Viking imagery and MOLA relief. Search or filter the 13 destinations and open their original scientific and coordinate references.
2. Open **Mission planning**. Two terrain-sample endpoints appear inside the supported Jezero footprint.
3. Drag A or B, or click the map twice to replace them. Compare shortest feasible and terrain-weighted alternatives, inspect the elevation profile, change the model assumptions, and read **Why this route?**.
4. Export the route as GeoJSON carrying Mars coordinate conventions, source checksum, model parameters and limitations.

## Run locally

Requires Node.js 24 (tested with 24.13.1) and npm. Dependency versions and lockfile are pinned.

```powershell
npm ci
npm run dev
```

For the production static export:

```powershell
npm run build
npm start
```

Open http://127.0.0.1:3000. `npm start` serves exported files; it does not use Next.js server features. Vercel runs the same build. The worker is bundled explicitly with esbuild before Next.js compilation.

## Verify

```powershell
npm run typecheck
npm run lint
npm test
npx playwright install chromium
# Start the static export with npm start, then:
npm run test:e2e
```

Set `BASE_URL` to the deployed site to run browser tests against production. Real NASA tile tests need network access. Vitest includes three real-terrain cases as well as controlled grids. Reproduce the independent Python checks after downloading the source terrain:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-gis.txt
.\.venv\Scripts\python.exe scripts/gis/process_terrain.py
.\.venv\Scripts\python.exe scripts/validation/verify_routes.py
```

The GIS script preserves the downloaded source, exports native 20 m elevation/slope arrays, and records checksums and transforms. If the supplied global MOLA raster is available, it additionally exports a small average overview. Large original rasters stay ignored; deployable derivatives are tracked. To rerun the original supplied-file audit and source-image preparation, use `py scripts/prepare_atlas.py` with the original asset folder present.

## Architecture

Next.js static export + React + OpenLayers. Geographic map coordinates use a custom Mars sphere, not Earth Web Mercator. NASA WMTS imagery loads directly from Trek with published tile grids and coverage. Source-linked region data ships as JSON. The browser downloads numerical terrain only when planning and calculates A* in a cancellable Web Worker. No database, runtime AI, account, or API key is required by visitors.

## Limits and release scope

- Global atlas: all 13 supplied regions.
- Validated routing: the 20 m Jezero CTX terrain footprint only. Imagery can be much finer than elevation.
- Two terrain-cost candidates; no certified hazard avoidance, science-value optimization, travel-time or radiation-dose estimates.
- Climate/radiation screenshot registration is unverified; they do not enter routing or numerical readouts.
- NASA services require internet and may be unavailable. No fabricated imagery fallback is used.
- Repository remains private. Vercel CLI deployments work; automatic GitHub-to-Vercel linking did not succeed with the current integration access.

See `docs/PROJECT_STATUS.md`, `docs/VALIDATION.md`, and the in-app methods page for details.

## License and attribution

Original software: MIT (`LICENSE`). Scientific data, imagery and dependencies retain their original terms; see `THIRD_PARTY_NOTICES.md` and `docs/IMAGE_CREDITS.md`. AI assisted coding, research navigation, processing, design and documentation; see `docs/AI_DISCLOSURE.md`.
