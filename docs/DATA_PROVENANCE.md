# Dataset provenance

Full machine-readable records: `data/provenance.json`, `data/audit.json`, `public/processed/jezero.json`.

## Regional CTX terrain

- Original URL: https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
- Acquired: 2026-11-14T11:04:37.100573+00:00
- SHA-256: `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`
- Preserved source: ignored `data/raw/jezero-ctx-20m.tif`
- Processing: `scripts/gis/process_terrain.py`
- Grid: 1596 × 1512, 20 m projected pixel spacing; R=3396190 m, native equirectangular transform.
- Nodata: extreme negative float32 sentinel and nonfinite values excluded before arithmetic.
- Elevation resampling: none.
- Outputs: little-endian float32 elevations/slopes, uint8 valid mask, metadata JSON, labelled derivative elevation image.
- Units: metres elevation / degrees slope.
- Details and limitations: Native grid, no elevation resampling. Invalid sentinel and nonfinite cells masked. Centred finite differences; edge derivatives one-sided. Slope unavailable next to missing terrain. Little-endian float32 arrays.

## Global MOLA

The supplied original is preserved and checksummed in `data/audit.json`. MarsPath uses a 1440×720 numerical grid with 0.25° cells for coarse terrain routing. The derivative averages valid samples and preserves nodata. Its manifest is `public/processed/mola-quarter.json`. The original raster remains outside the export. Separate relief imagery comes from NASA Mars Trek.

## Oxia CTX native window

The authors’ complete `03_CTX.zip` passed its published MD5 and every member CRC. The preserved elevation TIFF has SHA-256 `6b307414f20bdd254d78124175c60c1477d14c67b3cb00200052467dcad4a021`. The processor crops a native-aligned 1,483-cell square about 30 km across, centred on the valid source footprint midpoint. Original elevation samples remain unchanged. A source halo supports finite-difference slopes. The WKT, affine transform, exact 20.2341182386 m spacing, nodata, crop offsets, source terms and derivative hashes are in `public/processed/oxia.json`. The numerical MOLA comparison is recorded in `data/validation/v5-oxia-registration.json`. [Source and CC BY 4.0 terms](https://doi.org/10.21954/ou.rd.16451220.v1).

## MEDA sols 30–32

`scripts/gis/process_meda.py` checks the nine PDS CSV files against their XML sizes, MD5s and record counts. It retains the first pressure sample in each occupied five-minute LMST bin and matches the temperature and position records by their original spacecraft clocks. Missing records remain null. UTC is derived with the checksummed NAIF kernels listed in the derivative. Half-second label endpoint discrepancies are recorded. Product IDs, original URLs, labels, fields and checksums are in `public/processed/meda-sols-30-32-v1.json`. The small series loads on demand. [PDS archive](https://doi.org/10.17189/1522849).

## Images

Every destination gallery uses individually credited derivatives of original mission imagery. `data/gallery.json` records source and image URLs, dimensions, credits, terms and checksums. Images support visual interpretation. The route engine uses the separate numerical grids.
