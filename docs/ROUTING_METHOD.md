# Routing method

The regional registry currently enables the USGS Mars 2020 Jezero CTX DTM: 1,596 × 1,512 samples, 20 m projected spacing, Mars sphere R = 3,396,190 m. Geographic coverage and exact affine transform are in `public/processed/jezero.json`.

## Graph and costs

Eight-neighbour A* searches valid terrain-cell centres. Missing/nonfinite terrain, excessive cell slope, and excessive inter-cell grade are blocked. Diagonal edges require both adjacent orthogonal cells to be passable. Slopes come from centred elevation finite differences (one-sided at edges), correcting east/west spacing for latitude. No rock-scale hazard detector is claimed.

For each edge, `d` is spherical Mars great-circle distance and `s` is the maximum of its endpoint terrain slopes and inter-cell grade. Let `theta` be the user's slope limit:

`edgeCost = d × (1 + lambda × (s / theta)^2)`

Shortest feasible uses lambda = 0. Terrain-weighted uses lambda = 4 by default, adjustable from 1 to 10. The default 20° constraint, adjustable 5–30°, is an application assumption, not a NASA safety standard. The great-circle distance heuristic is admissible and consistent because each allowed edge costs at least its distance.

## Measurements and recommendation

Distance is the sum of horizontal great-circle edge lengths; ascent/descent sum positive/negative original elevation changes. Maximum slope and distance-weighted mean slope include edge grades. The terrain penalty is `sum(d × (s/theta)^2)`; it is a model quantity in distance units, not a probability of harm.

The recommendation compares the two candidates using min/max-normalized distance and integrated terrain penalty. Default weights are 40% distance and 60% terrain, adjustable by the user. Equal values contribute zero to that criterion. A tie deterministically chooses the shortest candidate. If paths coincide, the interface says so rather than manufacturing an alternative. This is a two-candidate comparison, not a proof of optimal science value or minimum physical danger.

Endpoints snap to their containing valid cell centres; offsets are displayed. Outside/invalid/excessive-slope endpoints are rejected instead of silently moved elsewhere. New endpoints or model parameters invalidate old metrics and lines. Workers are cancelled on changes and stale responses discarded. Ordered waypoints are supported in the tested engine; a science-waypoint UI and verified local targets are not yet released.

## Exclusions

Terrain search uses distance and slope. An opt-in climate comparison can change the ranking of completed paths only when the numerical model supports the distinction. Radiation and the optional constant-speed travel time provide context. See `docs/VALIDATION.md`.
