# Project status

## Complete and tested

- Static-export Next.js application and public Vercel atlas.
- NASA Viking global imagery and MOLA relief, source attribution and correct Mars coordinates.
- All 13 supplied destinations, search/filtering, source-linked descriptions and representative-coordinate caveats.
- Regional CTX/HiRISE imagery, actual 20 m CTX numerical terrain, A*, two route modes, route metrics and elevation profiles.
- Draggable endpoints, recalculation, explicit snapping, parameter changes, computed explanations, GeoJSON export and no stale metrics after a new endpoint pair.
- Unit tests, three real-terrain examples, and independent Python Dijkstra/source-raster checks for six routes.
- Production atlas browser checks and desktop planner checks. Final production/mobile validation is recorded in `docs/VALIDATION.md` when run.
- Private GitHub repository, coherent pushed milestones, MIT original-software license.

## Blocked by missing or unverified data

- Quantitative climate and radiation layers; screenshot georeferencing and radiation provenance remain unverified.
- Official challenge Resources/submission-guide retrieval; no claim of verified award eligibility.

## Not yet implemented

- Additional supported routing regions, science-value routing, verified local mineral targets, public waypoint editing, uncertainty propagation and 3D terrain.
- Automatic GitHub/Vercel integration linking; deployments currently use authenticated Vercel CLI.

This release prioritizes a smaller working, validated system over inactive controls or fabricated coverage.
