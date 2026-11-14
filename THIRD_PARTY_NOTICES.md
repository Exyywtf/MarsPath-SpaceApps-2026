# Third-party data and software

MarsPath's MIT license covers original software, not third-party data or branding.

- NASA Mars Trek tiles: retain NASA/JPL/USGS attribution and product-specific metadata. https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- USGS MOLA global DEM: the product metadata lists CC0/public domain and no use constraints. https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
- USGS Mars 2020 CTX DTM: use constraints request citation of the authors. Cite the product and Fergason et al., 2020, *Mars 2020 Terrain Relative Navigation Flight Product Generation: Digital Terrain Model and Orthorectified Image Mosaics*, LPSC abstract 2020. https://www.hou.usra.edu/meetings/lpsc2020/pdf/2020.pdf
- IAU/USGS Gazetteer: cite the original feature pages and coordinate convention; no claim of ownership over approved nomenclature.
- Resized source-page imagery: original image files and caption/credit pages are listed in `data/locations.json` and `docs/IMAGE_CREDITS.md`. Do not treat NASA hosting as a blanket license for all third-party imagery.
- Mars Climate Database: cited as context; screenshot provenance and registration are incomplete, so no screenshot is used for numerical inference.

Dependency copyright/license files remain in installed packages. Next.js, React, Tailwind CSS, Lucide React, Recharts, esbuild and Vitest use MIT licenses; OpenLayers uses BSD-2-Clause; Playwright and TypeScript use Apache-2.0; ESLint uses MIT. Retain upstream notices when redistributing dependencies. See the pinned lockfile for exact package versions.
