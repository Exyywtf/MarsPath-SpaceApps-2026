# MarsPath

A planet-wide Mars atlas with 13 scientific destinations, inspectable terrain and climate layers, and numerical route comparisons.

**Live app:** https://marspath-spaceapps-2026.vercel.app/

**Sources and methods:** https://marspath-spaceapps-2026.vercel.app/sources/

Built for NASA Space Apps 2026. Research and education only; no NASA endorsement or astronaut-safety certification.

## Try the application

1. Search or filter the 13 destinations in **Explore**. Every destination can be used as A or B and links to its scientific and coordinate sources.
2. Open **Layers** and select MOLA elevation or an MCD temperature, pressure or wind-speed field. Click the map, or press Enter on the focused map, to inspect a value and its units.
3. Open **Directions**. Set A and B on the map, enter coordinates, or use **Try Jezero terrain example**. Drag endpoints and add up to three ordered stops.
4. Compare route metrics, select a science objective in Jezero, and inspect the elevation profile using the pointer or keyboard. Export the selected route and its provenance as Mars coordinates in a GeoJSON-shaped file.

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

Set `BASE_URL` to the deployed site to run browser tests against production. The NASA tile checks need network access. Vitest exercises both controlled grids and real Jezero and MOLA terrain. Normal tests leave validation records untouched. To regenerate the records, first make the original rasters available, then run:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-gis.txt
.\.venv\Scripts\python.exe scripts/gis/process_terrain.py
.\.venv\Scripts\python.exe scripts/gis/process_v2_layers.py
$env:UPDATE_VALIDATION = '1'
npm test
Remove-Item Env:UPDATE_VALIDATION
.\.venv\Scripts\python.exe scripts/validation/verify_routes.py --write
.\.venv\Scripts\python.exe scripts/validation/verify_v2.py --write
.\.venv\Scripts\python.exe scripts/gis/process_radiation.py --write
```

The GIS scripts preserve the originals. `scripts/gis/process_v2_layers.py` uses the supplied MOLA raster and the retained numerical MCD ASCII export to regenerate the 0.25° terrain derivative, climate arrays, and overlay PNGs. The build uses the tracked derivatives directly. Keep the large original rasters out of Git.

## Architecture

Next.js static export serves React and OpenLayers with a custom 3,396,190 m Mars sphere. NASA WMTS imagery loads directly from Mars Trek. A persistent worker caches terrain, computed legs, and environmental profiles for the current route candidates. The application reveals result geometry independently of the worker's measurements. Both radiation views, climate arrays, terrain derivatives and 13 destination records ship as static assets.

## Limits and release scope

- Fine terrain routing uses the 20 m Jezero DEM. The global MOLA tier uses 0.25° cells with approximately 14.8 km north–south spacing. Unresolved connections can use distance-only geographic planning.
- Local science comparisons use three published representative Jezero delta type locations. Global science themes link to regions and original evidence.
- MCD overlays show one climatology snapshot. Climate preferences can rank existing paths when the grid resolves a difference. Radiation provides one numerical cosmic-ray scenario and an approximately registered historical illustration. Its absolute dose accuracy is unknown and it carries zero route weight.
- Terrain coverage and numerical validation measure inputs and calculations. Safety, rock-scale obstacles and physical alignment accuracy remain outside the model.
- GitHub is private. The public Vercel deployment is managed through the CLI.

See `docs/PROJECT_STATUS.md`, `docs/VALIDATION.md`, and the in-app methods page for details.

## License and attribution

Original software: MIT (`LICENSE`). Scientific data, imagery and dependencies retain their original terms; see `THIRD_PARTY_NOTICES.md` and `docs/IMAGE_CREDITS.md`. AI assisted coding, research navigation, processing, design and documentation; see `docs/AI_DISCLOSURE.md`.
