# Engineering decisions

- **Static export:** all user functionality runs in the browser. Vercel hosts files; no route handlers, server actions, runtime database or user credentials are needed.
- **OpenLayers and Mars coordinates:** geographic planetary view with explicit 3,396,190 m sphere, east-positive longitude, planetocentric latitude. Tile grids use the WMTS angular extent and matrix dimensions; Earth-based scale denominators do not drive scientific distances.
- **Coverage:** NASA global optical/relief sources remain available; regional CTX/HiRISE layers are clipped to published bounds. Tile matrix row/column limits are explicit to avoid requests beyond the poles.
- **Terrain:** use the published 20 m CTX product for the first supported region. Preserve native elevation cells. Much finer optical imagery does not justify finer routing claims.
- **Worker:** esbuild produces an explicit static browser worker because relying on a TypeScript worker URL in the Next.js export emitted a source asset rather than the intended standalone bundle.
- **Two route candidates first:** distance and terrain-cost alternatives work and are independently checked. Science-value scoring is deferred until verified local target geometry is curated.
- **No numerical climate from colours:** supplied PNGs remain blocked for quantitative use and geographic overlays while registration is unverified.
- **Hosting:** Vercel selected by the user. CLI production deployments succeeded after device sign-in. Automatic GitHub integration linking failed; Git pushes and CLI deployment remain separate, verified operations.
- **No fabricated completeness:** blocked data and optional features are reported separately from working functionality.
