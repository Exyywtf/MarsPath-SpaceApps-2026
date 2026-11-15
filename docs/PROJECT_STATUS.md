# MarsPath V4 status

## Delivered

- A static export with public NASA imagery, the 13 original destinations plus Olympus Mons, and 42 individually credited gallery images.
- A responsive map and directions workflow with explicit A/B placement, coordinate forms, dragging, three ordered waypoints, keyboard operation and a reduced-motion option.
- Full-Mars startup framing, empty fresh route drafts, destination links, stable camera positions across workflows, and shared typography and motion. The open atlas retains workflow controls and scroll positions.
- Overlay scrollbars with native keyboard and touch scrolling, stable coordinate controls, grouped planner settings, and full-width imagery on all destination cards. Recalculation keeps matching charts visible while the worker refreshes them. Exports identify pending analysis.
- Map controls dock around the active panel. Show map reduces an obstructing sheet and keeps the current camera. Destination labels use available screen space and retain their positions where clearance permits.
- Reused route markers, eased route drawing, progress feedback, internal results scrolling, scientific-layer crossfades with retry, responsive Sources controls and centred touch and keyboard Help.
- Numerical MOLA elevation and an MCD 6.2 climatology snapshot for temperature, pressure and horizontal wind speed. Each layer exposes units, sampling, opacity, a legend and numerical inspection.
- Fine Jezero terrain routing on the 20 m CTX grid, coarse global routing on the 0.25° MOLA grid and geographic distance estimates when terrain cannot resolve the route.
- A persistent route worker with distinct candidates, progressive route drawing and immediate results and export. Verified Jezero delta outcrops, map-linked elevation and environmental profiles, and opt-in climate preference scoring.
- Two geographic radiation views. One shows a modelled cosmic-ray scenario derived from published numerical tables. The other reprojects NASA’s historical PIA03480 and includes the original illustration.
- USGS global geology, 2,628 records from three published mineral catalogues and masked TES apparent thermal inertia. The worker reports mapped-unit lengths, supported thermal summaries and distances to published catalogue points for the accepted route geometry.
- Separate data and software terms. The original software is MIT licensed. GitHub is private and deployments use the Vercel CLI.

See [the validation record](VALIDATION.md) for counts and limitations. The public methods page describes how to interpret each calculation.

## Limits

- The coarse grid smooths local slopes and obstacles. Data coverage and test agreement do not establish physical alignment accuracy or astronaut safety.
- Local science scoring covers representative Jezero delta type locations and two objectives. The radiation model gives scenario context at coarse resolution with unknown absolute dose accuracy. The mineral catalogues represent targeted observations and carry zero ranking weight.
- SWIM numerical depth products remain unavailable from the project and its paper-linked JPL viewer. The opt-in ice preference and Arcadia Planitia await those products. TES dust-cover validity and terms remain unresolved.
- The official challenge Resources and Submission Guide could not be retrieved in the earlier eligibility check. Award eligibility and submission remain unverified.
