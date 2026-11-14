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

The supplied original is preserved and checksummed in `data/audit.json`. Rasterio creates a 720×360 average numerical overview (0.5° cells), preserving nodata. The original is never bundled. Global relief imagery comes from NASA Trek, a distinct visualization source.

## Images

Original source-page image URLs and access dates are stored in `data/locations.json`. Derivatives preserve content, reduce maximum dimensions to 1100×700, and encode JPEG quality 88. No geographic details are generated. Source screenshots remain untouched and excluded from quantitative use.
