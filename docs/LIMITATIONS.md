# Known limitations

- Fine routing covers the published Jezero CTX DTM footprint. The global tier uses averaged 0.25° MOLA cells. Geographic connections report great-circle distance for unresolved terrain legs.
- 20 m terrain cannot reveal individual rocks, small scarps, soil strength, local obstacles or actual astronaut traversability. No safety guarantees.
- Finite-difference slope and terrain-cost weights are modelling choices. Absolute elevation precision and inter-product alignment uncertainty are not converted into invented confidence percentages.
- Jezero science comparisons use three representative published delta outcrops and two objectives. Other regions expose their sourced evidence. Local science optimization outside Jezero remains unsupported.
- Climate overlays use one MCD 6.2 model snapshot. The supplied screenshots and radiation map remain reference material. Climate, radiation and mineral composition do not enter route costs.
- The MOLA grid averages elevations before computing slopes. North–south cell spacing is about 14.8 km. Smaller terrain features fall below this sampling scale.
- Tile services need internet. Higher-resolution imagery has limited footprints; outside them, lower-resolution imagery remains, explicitly labelled by source.
- Source-page illustrations may be false-colour, contextual or composite. Their captions and original credits control interpretation.
- Aram Chaos's linked JPL source blocks automated retrieval (403). Its source remains explicit and the access failure recorded.
- The official challenge Resources tab and submission guide could not be retrieved after repeated 502/SSL errors. Global Awards resource eligibility and detailed submission requirements are not claimed verified.
- Vercel's automatic private-GitHub integration failed to link. CLI deployment works and is the current release path.
- `npm audit --omit=dev` reported zero production vulnerabilities. The full audit reports seven moderate entries in the ESLint/typescript-eslint minimatch dependency chain; `npm audit fix` did not resolve them. They are build tooling, not browser runtime dependencies.
