# MarsPath V3 status

## Delivered

- A static export with public NASA imagery, all 13 scientific destinations and links to original coordinate, image and geology sources.
- A responsive map and directions workflow with explicit A/B placement, coordinate forms, dragging, three ordered waypoints, keyboard operation and a reduced-motion option.
- Numerical MOLA elevation and an MCD 6.2 climatology snapshot for temperature, pressure and horizontal wind speed. Each layer exposes units, sampling, opacity, a legend and numerical inspection.
- Fine Jezero terrain routing on the 20 m CTX grid, coarse global routing on the 0.25° MOLA grid and geographic distance estimates when terrain cannot resolve the route.
- A persistent route worker with distinct candidates, progressive route drawing and immediate results and export. Verified Jezero delta outcrops, map-linked elevation and environmental profiles, and opt-in climate preference scoring.
- Two geographic radiation views. One shows a modelled cosmic-ray scenario derived from published numerical tables. The other reprojects NASA’s historical PIA03480 and includes the original illustration.
- Separate data and software terms. The original software is MIT licensed. GitHub is private and deployments use the Vercel CLI.

See [the validation record](VALIDATION.md) for counts and limitations. The public methods page describes how to interpret each calculation.

## Limits

- The coarse grid smooths local slopes and obstacles. Data coverage and test agreement do not establish physical alignment accuracy or astronaut safety.
- Local science scoring covers representative Jezero delta type locations and two objectives. The radiation model gives scenario context at coarse resolution with unknown absolute dose accuracy. Global mineral-layer registration and additional fine regional DEMs remain unresolved.
- Optional 3D, additional regions and comparison dividers were deferred.
- The official challenge Resources and Submission Guide could not be retrieved in the earlier eligibility check. Award eligibility and submission remain unverified.
