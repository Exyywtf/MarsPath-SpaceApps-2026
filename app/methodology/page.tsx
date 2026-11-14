import Link from "next/link";
import validation from "@/data/validation/v2-independent.json";
export default function Methodology() {
  return (
    <main className="document-page">
      <nav className="document-nav">
        <Link className="brand" href="/">
          <span className="brand-orbit" />
          MarsPath
        </Link>
        <Link href="/">Explorer</Link>
        <Link href="/sources/">Sources</Link>
      </nav>
      <span className="eyebrow orange">Methods & limitations</span>
      <h1>
        Know what the
        <br />
        map can tell you.
      </h1>
      <p className="lede">
        MarsPath makes calculations traceable to their inputs. A route is a
        model result; neither a fine image nor a precise coordinate establishes
        safe access.
      </p>
      <h2>Coordinates and imagery</h2>
      <p className="lede">
        Positions use planetocentric latitude and east-positive longitude,
        normalized between 180° west and 180° east. Distances use a Mars sphere
        of radius 3,396,190 m, matching the supplied MOLA and published Jezero
        terrain products. Earth Web Mercator is not used. NASA Mars Trek WMTS
        matrices use their actual origins, resolutions and dimensions. CTX 6 m
        and HiRISE 0.25 m imagery appear only within available footprints; they
        do not create matching terrain resolution.
      </p>
      <h2>Three levels of route support</h2>
      <ul>
        <li>
          <strong>Regional terrain:</strong> native 20 m projected Jezero CTX
          elevation cells, with latitude-corrected surface spacing.
        </li>
        <li>
          <strong>Coarse terrain:</strong> MOLA elevations averaged to a 1440 ×
          720, 0.25° grid. North–south spacing is about 14.8 km; east–west
          spacing varies with latitude. The approximately 463 m source spacing
          is not the routing resolution.
        </li>
        <li>
          <strong>Geographic connection:</strong> great-circle distance through
          ordered stops, without unsupported ascent, slope, risk or feasibility
          claims. Exact poles and legs smaller than the available grid are
          unresolved by terrain routing. Coarse search timeouts can produce an
          explicitly labelled geographic result.
        </li>
      </ul>
      <p className="lede">
        A failed regional search retains its failure. Choosing a geographic
        connection after that failure is explicit. Global connections are
        exploration context, not practical EVA traverses. Missing terrain is
        blocked; broad feature centres are destinations, not precise sample
        sites.
      </p>
      <h2>Terrain costs and full-path measurements</h2>
      <div className="formula">
        cost = Σ distance × (1 + λ × (slope / limit)²)
      </div>
      <p className="lede">
        Eight-neighbour A* searches numerical cells. Diagonals cannot cut
        blocked corners. The global graph wraps longitude and stops at its first
        and last latitude rows. Each edge uses the maximum of its two cell
        slopes and inter-cell grade. The great-circle heuristic is admissible
        because every permitted edge costs at least its spherical distance. The
        worker yields every 2,048 expanded nodes to process cancellations. It
        gives the base terrain comparison five seconds of search time and the
        optional science-stop evaluation its own five-second budget.
      </p>
      <p className="lede">
        Shortest uses λ = 0; the terrain-focused candidate defaults to λ = 4,
        adjustable 1–10; balanced uses λ = 2. The 20° default slope assumption
        is adjustable 5–30° and is not a NASA safety standard. Distance sums
        full unsimplified edges. Ascent and descent sum original cell-elevation
        changes. Mean slope is distance-weighted. Terrain penalty integrates
        distance × normalized slope²; it is not an accident probability. Plot
        simplification does not change these calculations.
      </p>
      <p className="lede">
        Endpoints and stops snap to cell centres. Dotted connectors show the
        unassessed offsets; total distance includes them, with a return
        connector at intermediate stops. Terrain ascent, descent and slopes
        exclude those connectors. The coarse grid hides local terrain even where
        every numerical cell is valid.
      </p>
      <h2>Science-aware comparisons</h2>
      <p className="lede">
        Three representative Jezero delta type outcrops come from Stack et al.
        (2020), Table 2: thinly layered, thickly layered and
        truncated-curvilinear units. Their sedimentary/fluvial interpretations
        support Ancient Water and Sedimentary Geology themes. Coordinates are
        published to 0.001°; this rounding is not an independent accuracy
        measurement. The table’s numerical pairs are interpreted as longitude
        then latitude against its Jezero map extent. These points are not
        confirmed sample sites.
      </p>
      <p className="lede">
        Up to three relevant verified targets are evaluated as optional
        single-stop insertions, while up to three user waypoints remain
        mandatory and ordered. A target is counted when the route visits the
        terrain cell containing its published type position. The interface names
        included outcrops and explains their limits. Other science themes filter
        source-linked regions rather than inventing local targets.
      </p>
      <p className="lede">
        Recommendations minimize a weighted score of min/max-normalized
        distance, min/max-normalized terrain penalty and the fraction of
        selected objective types missed. Defaults are 35 / 45 / 20. Unavailable
        science is removed and remaining weights renormalized. Equal criteria
        contribute zero; ties choose the first candidate, shortest where
        applicable. The balanced candidate is selected from the tested candidate
        pool, whose size and attempts are reported. This is not a global science
        optimum or a probability of finding life. Identical paths are disclosed.
      </p>
      <a
        className="text-link"
        href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7116714/#Tab2"
        target="_blank"
        rel="noreferrer"
      >
        Published Jezero type locations & interpretations ↗
      </a>
      <h2 id="validation-v2">Independent numerical validation</h2>
      <p className="lede">
        {validation.checks.length} V2 route calculations were checked with an
        independent Python Dijkstra solver without a heuristic. These include a
        date-line crossing, coarse terrain near Gale, a Gale-to-Jezero
        connection and a science route through a published outcrop. Python also
        recalculates full-path distance, ascent, descent and maximum slope, then
        checks original GeoTIFF samples. These tests establish numerical
        consistency, not physical positional accuracy or astronaut
        traversability.
      </p>
      <div className="table-scroll">
        <table className="validation-table">
          <thead>
            <tr>
              <th>Case / tier</th>
              <th>Candidate</th>
              <th>Assessed distance</th>
              <th>Cost difference</th>
            </tr>
          </thead>
          <tbody>
            {validation.checks.map((r) => (
              <tr key={r.case + "-" + r.route}>
                <td>
                  {r.case} · {r.tier}
                </td>
                <td>{r.route}</td>
                <td>{(r.distanceM / 1000).toFixed(3)} km</td>
                <td>{r.absoluteCostDifference.toExponential(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>What quality percentages mean</h2>
      <p className="lede">
        Assessed route percentage is terrain-edge distance divided by total
        distance including unassessed connectors. Dataset valid percentage
        counts numerical mask cells. Missing-path percentage counts invalid
        samples along the assessed path; these should be zero because missing
        cells are blocked. None measures safety, source completeness, sub-cell
        obstacles or alignment accuracy. Independent physical alignment accuracy
        has not been measured. No aggregate confidence score is supplied.
      </p>
      <h2>Numerical climate overlays</h2>
      <p className="lede">
        Temperature, pressure and horizontal wind speed come from a numerical
        Mars Climate Database 6.2 export. Its fixed context is Ls 21.3°, local
        time 00:00 at every longitude, 10 m above the local surface and
        climatology average solar conditions. The 64 × 48 export samples do not
        establish native model resolution. These are interpolated model means,
        not live weather or extreme conditions; no climate field contributes to
        route costs.
      </p>
      <p className="lede">
        The provider prints truncated integer longitude labels. We reconstruct
        its unrounded evenly spaced axes, transpose and reverse values to
        north-up, and average duplicate date-line columns. Their maximum wind
        discrepancy is 0.00151 m/s; temperature and pressure seam columns match.
        PNG pixels are generated by numerical interpolation at pixel centres,
        avoiding a half-cell shift. Inspection, legends and images use the same
        numerical fields. Source bytes, context and checksums are retained; nine
        interior field nodes were independently compared with the source ASCII.
      </p>
      <p className="lede">
        Supplied screenshots remain references. Unverified radiation
        registration, unverified mineral rasters, weather extremes and
        rock-scale hazards are excluded from numerical optimization.
      </p>
      <h2>AI assistance and licensing</h2>
      <p className="lede">
        AI assisted implementation, research navigation, design, processing,
        validation and documentation. Scientific evidence comes from cited
        institutions and publications. No generated Mars surface photographs or
        invented measurements are used. Original software is MIT licensed;
        imagery, datasets and fonts retain separate terms. MCD outputs retain
        noncommercial conditions and attribution; the user confirmed its
        required author notice was sent. NASA names and imagery do not imply
        endorsement.
      </p>
      <div className="notice">
        Research and education, not operational navigation. Unknown hazards
        remain unknown.
      </div>
      <Link className="text-link" href="/sources/">
        Inspect original evidence, processing & usage terms →
      </Link>
    </main>
  );
}
