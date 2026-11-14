# Changelog

## 0.3.0 — 2026-11-14

- Draw distinct route alternatives progressively and scroll the planning panel to the ready results.
- Feature Jezero’s planning footprint and improve scientific map labels.
- Add a modelled cosmic-ray surface field, a reprojected NASA historical illustration, and its original reference viewer.
- Add map-linked climate and radiation profiles, evidence bounds for optional climate ranking, and full samples and provenance in route export.

## 0.2.0 — 2026-11-14

- Redesign the atlas around the map with a single responsive panel, explicit endpoint placement, keyboard controls and reduced motion.
- Add numerical MOLA elevation and MCD temperature, pressure and wind-speed layers with opacity, legends, value inspection and source context.
- Compare 20 m Jezero routes, coarse global MOLA routes and distance-only geographic connections. Add ordered waypoints, published Jezero science targets, linked elevation inspection and provenance export.
- Cache terrain and route legs in a persistent worker. Validate the new routes independently and exercise the public browser workflows.

## 0.1.0 — 2026-11-14

- Initialize MarsPath static-export application, scientific standards, and software licensing.
- Add a real global NASA Mars map, all 13 scientific destinations, source links, search and scientific-theme filters.
- Add optical/relief controls and progressive CTX/HiRISE imagery inside supported coverage.
- Process real 20 m Jezero terrain; calculate shortest and terrain-weighted A* alternatives in a cancellable browser worker.
- Add draggable endpoints, measured route comparisons, elevation profiles, sensitivity controls, computed recommendations and source-linked GeoJSON export.
- Add independent real-terrain validation, browser interaction tests and public methodology.
- Deploy early atlas and regional planner to Vercel while retaining a private GitHub repository.
