# Third-party data and software

MarsPath's MIT license covers original software, not third-party data or branding.

- NASA Mars Trek tiles: retain NASA/JPL/USGS attribution and product-specific metadata. https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- USGS MOLA global DEM: the product metadata lists CC0/public domain and no use constraints. https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
- USGS Mars 2020 CTX DTM: use constraints request citation of the authors. Cite the product and Fergason et al., 2020, *Mars 2020 Terrain Relative Navigation Flight Product Generation: Digital Terrain Model and Orthorectified Image Mosaics*, LPSC abstract 2020. https://www.hou.usra.edu/meetings/lpsc2020/pdf/2020.pdf
- IAU/USGS Gazetteer: cite the original feature pages and coordinate convention; no claim of ownership over approved nomenclature.
- Resized source-page imagery: original image files and caption/credit pages are listed in `data/locations.json` and `docs/IMAGE_CREDITS.md`. Do not treat NASA hosting as a blanket license for all third-party imagery.
- Mars Climate Database: cited as context; screenshot provenance and registration are incomplete, so no screenshot is used for numerical inference.

Dependency copyright and license files remain in installed packages. Next.js, React, Tailwind CSS, Lucide React, esbuild, Vitest and ESLint use MIT licenses. OpenLayers uses BSD-2-Clause. Playwright and TypeScript use Apache-2.0. Retain upstream notices when redistributing dependencies and consult the pinned lockfile for exact versions.


## V2 numerical climate outputs and fonts

- MCD 6.2 fields and derived maps: © LMD / OU / IAA / ESA / CNES. Noncommercial scientific use only without separate commercial authorization. Preserve origin/citations, disclaimers and https://www-mars.lmd.jussieu.fr/mars/access ; credits at https://www-mars.lmd.jussieu.fr/mcd_python/credit.html . User confirmed notification to authors sent on 2026-11-14; agent did not send email or independently verify delivery. These data are not relicensed under MIT.
- Geist Sans and Geist Mono: Copyright The Geist Project Authors; SIL Open Font License 1.1, bundled in app/fonts/OFL.txt. Files copied unmodified from the installed Next.js distribution.

## Radiation products

- Jian Zhang and Jingnan Guo, 2022. Figure 2 surface pressures and Figure 11 effective dose data were transposed, masked, and interpolated by MarsPath. The study archive is licensed under CC BY 4.0. [Data deposit](https://doi.org/10.5281/zenodo.5953666) · [License](https://creativecommons.org/licenses/by/4.0/).
- PIA03480, NASA/Jet Propulsion Laboratory/JSC, March 2002. MarsPath preserves the original JPEG and reprojects both globes into an approximate historical overlay. [Original caption](https://www.jpl.nasa.gov/images/pia03480-estimated-radiation-dosage-on-mars/) · [JPL Image Use Policy](https://www.jpl.nasa.gov/jpl-image-use-policy/).

## V4 galleries and science derivatives

- Each gallery image retains its source caption, mission credit and usage conditions. The atlas packages resized WebP derivatives for credited educational use under the original image guidance. [Image registry](data/gallery.json) · [JPL Image Use Policy](https://www.jpl.nasa.gov/jpl-image-use-policy/).
- Geology uses the public-domain USGS SIM 3292 unit polygons and style. Credit Tanaka et al. (2014) and USGS. [SIM 3292](https://pubs.usgs.gov/publication/sim3292).
- Mineral markers retain source IDs and interpretations from two CC0 1.0 deposits. Credit the authors and the MRO CRISM and Mars Odyssey THEMIS teams. [Terra Sirenum CRISM catalogue](https://data.caltech.edu/records/yhd9q-q8g95) · [Chloride catalogue](https://data.caltech.edu/records/kasms-vp209).
- Hydrated mineral sites use NASA PDS `MEX-M-OMEGA-5-DDR-GLOBAL-MAPS-V1.0`, product `HYDROUS_SITES_GEO_MAP`, release and revision `0001`. Credit Carter et al. (2013), ESA Mars Express OMEGA and NASA MRO CRISM. NASA Open Data lists the archive as US public domain. [Original table and label](https://pds-geosciences.wustl.edu/mex/mex-m-omega-5-ddr-global-maps-v1/mexomg_2000/data/hydrous/) · [Study](https://doi.org/10.1029/2012JE004145) · [NASA dataset terms](https://data.nasa.gov/dataset/omega-mars-global-maps).
- Apparent thermal inertia uses the archived nightside MGS TES data and its interpolation mask. Credit Putzig, Mellon, Heet and Ward (2009), NASA PDS product MGS-M-TES-5-TIMAP-V1.0. [Original PDS archive](https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html).
- Embla Carousel 8.6 uses the MIT license. The pinned dependency packages include their license files. [Embla license](https://github.com/davidjerleke/embla-carousel/blob/v8.6.0/LICENSE).
