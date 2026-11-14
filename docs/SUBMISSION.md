# Submission preparation

## Project description

MarsPath is a planet-wide Mars atlas and transparent regional mission-planning tool. It brings real NASA orbital imagery, thirteen scientific destinations and source-linked geological context into one map. In a supported Jezero region, users can drag endpoints, calculate terrain-based routes, compare distance and terrain penalties, inspect elevation and understand why a recommendation changes.

## Problem and originality

Future surface explorers need to connect scientific opportunities with terrain evidence. MarsPath makes the boundary between global exploration and supported numerical planning explicit, and exposes the sources, assumptions and calculations behind its recommendations. It helps users ask scientific questions without presenting coarse climate imagery or unsupported hazards as local measurements.

## NASA data and technical approach

- NASA Mars Trek: Viking global optical mosaic, MOLA relief, regional CTX and HiRISE imagery.
- USGS/NASA MGS MOLA numerical DEM: preserved source, reproducible audit and browser-friendly overview.
- USGS/NASA Mars 2020 CTX DTM: 20 m native numerical terrain for Jezero planning.
- NASA mission/image pages, IAU/USGS representative coordinates and a peer-reviewed Eridania study for source-linked descriptions.
- Next.js static export, OpenLayers planetary coordinates, TypeScript A* in a cancellable browser worker, independently checked against Python Dijkstra.

## Validation and limitations

Three real-terrain endpoint pairs produce six independently checked routes. Browser tests exercise real imagery, global navigation, sources and the route interaction flow. Validation demonstrates numerical consistency, not actual astronaut safety. Routing is regional; science-value optimization, climate/radiation penalties and rock-scale hazards are excluded. See the public methodology and `docs/VALIDATION.md`.

## Links

- Application: https://marspath-spaceapps-2026.vercel.app/
- Sources: https://marspath-spaceapps-2026.vercel.app/sources/
- Methods: https://marspath-spaceapps-2026.vercel.app/methodology/
- GitHub (currently private): https://github.com/Exyywtf/marspath-spaceapps-2026
- Original software license: MIT. Retain scientific-image/data credits and dependency notices.

## Demo guidance

1. Open the whole planet and select a destination outside Jezero, such as Mawrth or Terra Sirenum. Show the source and representative-coordinate caveat.
2. Switch optical/relief imagery and open Jezero's supported planner.
3. Show the two actual route alternatives. Drag an endpoint and change the terrain preference.
4. Open the elevation profile and **Why this route?**. Export the source-linked route.
5. End on Sources & Methodology and the explicit 20 m terrain limitation.

Prepare any video/slide format only after checking the current official submission guide; its detailed requirements could not be independently retrieved in this session.

## Checklist

- [x] Working public application, source archive and methods page.
- [x] MIT original-software license and separate data/image notices.
- [x] NASA sources, AI-use disclosure and limitations prepared.
- [x] Accurate Git history and validation records.
- [ ] Confirm registration/team membership in the Universal Event.
- [ ] Verify the live official Resources tab includes at least one NASA resource actually used; do not assert Global Awards eligibility without this check.
- [ ] Review the current Project Submission Guide, fields, demo limits and licensing/public-code requirements. Repeated guide/challenge fetches returned 502 or SSL errors.
- [ ] Publish the GitHub repository only with approval or a verified submission requirement, and test judge access without a signed-in account.
- [ ] Record or prepare the team's final demo in the required format and verify public access.
- [ ] Team reviews and submits through its Space Apps project page by the applicable deadline.

The user confirmed Universal Event / Asia-Dubai. Published event timeline: November 14, 2026 at 09:00 to November 15, 2026 at 23:59 in the applicable local clock. Sources: https://www.spaceappschallenge.org/2026/ and https://github.com/nasa/spaceapps/discussions/1827 . Actual submission is not performed by this script or application.
