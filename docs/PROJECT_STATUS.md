# MarsPath 0.2.0 status

## Delivered

- A static export with public NASA imagery, all 13 scientific destinations and links to original coordinate, image and geology sources.
- A responsive map and directions workflow with explicit A/B placement, coordinate forms, dragging, three ordered waypoints, keyboard operation and a reduced-motion option.
- Numerical MOLA elevation and an MCD 6.2 climatology snapshot for temperature, pressure and horizontal wind speed. Each layer exposes units, sampling, opacity, a legend and numerical inspection.
- Fine Jezero terrain routing on the 20 m CTX grid, coarse global routing on the 0.25° MOLA grid and geographic distance estimates when terrain cannot resolve the route.
- A persistent route worker, three route candidates, verified Jezero delta outcrops, measured comparisons, linked elevation profiles and provenance export.
- Separate data and software terms. The original software is MIT licensed. GitHub is private and deployments use the Vercel CLI.

See [the validation record](VALIDATION.md) for counts and limitations. The public methods page describes how to interpret each calculation.

## Limits

- The coarse grid smooths local slopes and obstacles. Data coverage and test agreement do not establish physical alignment accuracy or astronaut safety.
- Local science scoring is supported for Jezero delta type locations and two objectives. The published type positions are representative. Global mineral-layer registration, verified radiation values and additional fine regional DEMs remain unresolved.
- Optional 3D, additional regions and comparison dividers were deferred.
- The official challenge Resources and Submission Guide could not be retrieved in the earlier eligibility check. Award eligibility and submission remain unverified.
