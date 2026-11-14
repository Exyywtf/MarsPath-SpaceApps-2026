# Submission preparation

## Project description

MarsPath is a planet-wide Mars atlas and mission-planning tool. It brings NASA orbital imagery, thirteen scientific destinations and inspectable numerical layers into one map. Users can set endpoints anywhere on Mars and see which calculations the terrain supports. In Jezero they can compare routes on the 20 m terrain grid and evaluate published geological type locations as science stops.

## Problem and originality

Future surface explorers need to connect scientific opportunities with terrain evidence. MarsPath shows which parts of a route have terrain support, how terrain resolution limits the result, and why a science detour changes the comparison. Atmospheric layers come from a fixed, numerical MCD 6.2 climatology snapshot and show the sampling and model context alongside each readout.

## NASA data and technical approach

- NASA Mars Trek: Viking global optical mosaic, MOLA relief, regional CTX and HiRISE imagery.
- USGS/NASA MGS MOLA numerical DEM and a 0.25° derivative for global elevation inspection and coarse routing.
- USGS/NASA Mars 2020 CTX DTM: 20 m native numerical terrain for Jezero planning.
- NASA mission/image pages, IAU/USGS representative coordinates and a peer-reviewed Eridania study for source-linked descriptions.
- Next.js static export, OpenLayers planetary coordinates, TypeScript A* in a cancellable browser worker, independently checked against Python Dijkstra.

## Validation and limitations

An independent Python solver checked twelve V2 route calculations on real terrain, including a date-line crossing and a Jezero science stop. Browser tests exercise NASA imagery, all thirteen destinations, layer inspection, mobile directions and keyboard workflows. Fine routing and local science scoring are limited to supported Jezero terrain. Coarse routes serve global exploration. The route model does not assess rock-scale hazards or atmospheric and radiation exposure. See the public methodology and `docs/VALIDATION.md`.

## Links

- Application: https://marspath-spaceapps-2026.vercel.app/
- Sources: https://marspath-spaceapps-2026.vercel.app/sources/
- Methods: https://marspath-spaceapps-2026.vercel.app/methodology/
- GitHub (currently private): https://github.com/Exyywtf/marspath-spaceapps-2026
- Original software license: MIT. Retain scientific-image/data credits and dependency notices.

## Demo guidance

1. Open the whole planet and select a destination outside Jezero, such as Mawrth or Terra Sirenum. Show the source and representative-coordinate caveat.
2. Select atmospheric temperature in Layers. Inspect a numerical value and explain the fixed model context.
3. Open Directions and choose **Try Jezero terrain example**. Compare the routes, drag an endpoint, and show the three published delta type locations under Science objectives.
4. Link the elevation profile to the map, open **Why this route?**, and export the result.
5. Compare the fine Jezero tier with the coarse global tier and show the provenance on the methods page.

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
