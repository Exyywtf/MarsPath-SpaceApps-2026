# Known limitations

- Fine routing covers the Jezero CTX DTM footprint and a native-aligned 30 km Oxia CTX window. Oxia’s actual spacing is 20.234 m and its Gazetteer marker represents a wider region outside that window. The global tier uses averaged 0.25° MOLA cells. Geographic connections report great-circle distance for unresolved terrain legs.
- Mars24 daylight uses a geometric horizon. Terrain shadows and extinction remain unresolved. Terrain line of sight assumes a spherical Mars reference and hypothetical antenna heights. Radio propagation and equipment reliability remain unassessed.
- MEDA pressure and local sensor temperatures describe archived Perseverance conditions during sols 30–32. The calibrated temperatures retain rover influences and the products provide no flag fields. Exact clock matches are required for the selected temperature and position records. Their time, season and height differ from the MCD scenario.
- 20 m terrain cannot reveal individual rocks, small scarps, soil strength, local obstacles or actual astronaut traversability. No safety guarantees.
- Finite-difference slope and terrain-cost weights are modelling choices. Absolute elevation precision and inter-product alignment uncertainty are not converted into invented confidence percentages.
- Jezero science comparisons use three representative published delta outcrops and two objectives. Other regions expose their sourced evidence. Local science optimization outside Jezero remains unsupported.
- Climate overlays use one MCD 6.2 model snapshot. Opt-in climate preferences can rank established terrain paths when model cells resolve a difference. The historical NASA radiation overlay gives image coverage, while the numerical radiation profile describes one galactic cosmic-ray scenario. Radiation and mineral composition have zero route weight.
- The MOLA grid averages elevations before computing slopes. North–south cell spacing is about 14.8 km. Smaller terrain features fall below this sampling scale.
- Tile services need internet. Higher-resolution imagery has limited footprints; outside them, lower-resolution imagery remains, explicitly labelled by source.
- Source-page illustrations may be false-colour, contextual or composite. Their captions and original credits control interpretation.
- Aram Chaos's linked JPL source blocks automated retrieval (403). Its source remains explicit and the access failure recorded.
- The official challenge Resources tab and submission guide could not be retrieved after repeated 502/SSL errors. Global Awards resource eligibility and detailed submission requirements are not claimed verified.
- Vercel's automatic private-GitHub integration failed to link. CLI deployment works and is the current release path.
- `npm audit --omit=dev` reported zero production vulnerabilities. The full audit reports seven moderate entries in the ESLint/typescript-eslint minimatch dependency chain; `npm audit fix` did not resolve them. They are build tooling, not browser runtime dependencies.
