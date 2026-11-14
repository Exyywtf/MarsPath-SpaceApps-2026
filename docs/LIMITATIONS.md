# Known limitations

- Routing supports one published Jezero CTX DTM footprint, not the whole crater or planet. All 13 destinations remain available in the global atlas.
- 20 m terrain cannot reveal individual rocks, small scarps, soil strength, local obstacles or actual astronaut traversability. No safety guarantees.
- Finite-difference slope and terrain-cost weights are modelling choices. Absolute elevation precision and inter-product alignment uncertainty are not converted into invented confidence percentages.
- No science-value scoring or verified local mineral targets are released. Engine waypoint support is tested, but the public planner compares two terrain routes.
- Supplied climate/radiation PNGs lack verified georeferencing/provenance. They are excluded from map measurement and route optimization. There is no current Mars weather forecast.
- Global MOLA is used as a relief source and processed overview; the public planner uses the regional CTX grid. No metre-scale route is inferred from MOLA.
- Tile services need internet. Higher-resolution imagery has limited footprints; outside them, lower-resolution imagery remains, explicitly labelled by source.
- Source-page illustrations may be false-colour, contextual or composite. Their captions and original credits control interpretation.
- Aram Chaos's linked JPL source blocks automated retrieval (403). Its source remains explicit and the access failure recorded.
- The official challenge Resources tab and submission guide could not be retrieved after repeated 502/SSL errors. Global Awards resource eligibility and detailed submission requirements are not claimed verified.
- Vercel's automatic private-GitHub integration failed to link. CLI deployment works and is the current release path.
- `npm audit --omit=dev` reported zero production vulnerabilities. The full audit reports seven moderate entries in the ESLint/typescript-eslint minimatch dependency chain; `npm audit fix` did not resolve them. They are build tooling, not browser runtime dependencies.
