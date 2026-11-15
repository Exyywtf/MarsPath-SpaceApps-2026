# Routing method

The regional registry enables the USGS Mars 2020 Jezero CTX DTM with 1,596 × 1,512 samples at 20 m spacing, and the Fawdon et al. Oxia CTX native window with 1,483 × 1,483 samples at 20.2341182386 m spacing. Both use the Mars sphere R = 3,396,190 m for route measurements. Geographic coverage, source hashes and exact affine transforms are in `public/processed/jezero.json` and `public/processed/oxia.json`. Oxia retains the source’s 335.45°E central meridian. [Oxia deposit and licence](https://doi.org/10.21954/ou.rd.16451220.v1).

## Graph and costs

Eight-neighbour A* searches valid terrain-cell centres. Missing/nonfinite terrain, excessive cell slope, and excessive inter-cell grade are blocked. Diagonal edges require both adjacent orthogonal cells to be passable. Slopes come from centred elevation finite differences (one-sided at edges), correcting east/west spacing for latitude. No rock-scale hazard detector is claimed.

For each edge, `d` is spherical Mars great-circle distance and `s` is the maximum of its endpoint terrain slopes and inter-cell grade. Let `theta` be the user's slope limit:

`edgeCost = d × (1 + lambda × (s / theta)^2)`

Shortest feasible uses lambda = 0. Terrain-weighted uses lambda = 4 by default, adjustable from 1 to 10. The default 20° constraint, adjustable 5–30°, is an application assumption, not a NASA safety standard. The great-circle distance heuristic is admissible and consistent because each allowed edge costs at least its distance.

## Measurements and recommendation

Distance is the sum of horizontal great-circle edge lengths; ascent/descent sum positive/negative original elevation changes. Maximum slope and distance-weighted mean slope include edge grades. The terrain penalty is `sum(d × (s/theta)^2)`; it is a model quantity in distance units, not a probability of harm.

The default ranking uses 35% normalized distance, 45% normalized terrain penalty and 20% missed selected Jezero objectives. Unsupported criteria receive zero weight and supported terms are renormalized. The pool includes shortest, terrain-focused and balanced candidates, plus feasible single-stop Jezero alternatives. Identical geometries are grouped. Climate preferences can contribute only when the source cells, complete coverage and nonoverlapping bounds support the difference. Mission presets change the weights of the accepted pool. Changing terrain constraints, mandatory stops or eligible target sets triggers new searches.

Endpoints snap to their containing valid cell centres and offsets are displayed. Missing terrain and excessive-slope endpoints remain infeasible. New endpoints or path-generation parameters invalidate old metrics and lines. Workers are cancelled on changes and stale responses discarded. Up to three ordered user waypoints remain mandatory. Published Jezero outcrops can provide optional science stops. Oxia has no enabled precise science-target registry.

Return to base searches directly from B to A with the same terrain constraints. Outbound stops remain outbound. Constant-speed timing requires a positive speed and adds the stated dwell once per outbound stop. The versioned mission export preserves both legs, full samples, dataset fingerprints and any pending analyses. Archived MEDA observations carry zero ranking weight.

## Exclusions

Terrain search uses distance and slope. An opt-in climate comparison can change the ranking of completed paths only when the numerical model supports the distinction. Radiation and the optional constant-speed travel time provide context. See `docs/VALIDATION.md`.
