import EvidenceLink from "@/components/EvidenceLink";
import ScrollArea from "@/components/ScrollArea";
import PageTransition from "@/components/PageTransition";
import validation from "@/data/validation/v2-independent.json";
import DocumentNav from "@/components/DocumentNav";
export default function Methodology() {
  return (
    <PageTransition page="methodology"><main className="document-page methodology-page page-view">
      <DocumentNav current="methodology" />
      <p className="eyebrow orange">Methods &amp; limitations</p>
      <h1>MarsPath methodology</h1>
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
      <h2 id="exploration-science">Geology, minerals and surface properties</h2>
      <p className="lede">
        The USGS SIM 3292 atlas layer assigns each 0.125° cell the polygon containing its centre.
        It preserves the published unit codes and colours from the 1:20,000,000 map.
        The global classifications describe regional geologic units. Local boundaries and small outcrops may be unresolved.
      </p>
      <p className="lede">
        Terra Sirenum CRISM centres retain the interpretations in the authors’ catalogue, including possible detections.
        The chloride catalogue provides locations of records identified using THEMIS imagery.
        Mineral footprints and ground sampling locations remain unassessed.
      </p>
      <p className="lede">
        The TES layer aggregates 5 × 5 source pixels into 0.25° apparent thermal inertia cells with area weighting.
        Only cells with direct observational support throughout are shown.
        The source spacing is 0.05°. Apparent thermal inertia characterizes a modelled thermal response.
      </p>
      <EvidenceLink className="text-link" href="/sources/#geology">Geology, mineral and thermal sources</EvidenceLink>
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
      <EvidenceLink
        className="text-link"
        href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7116714/#Tab2"
        target="_blank"
        rel="noreferrer"
      >
        Published Jezero type locations & interpretations</EvidenceLink>
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
      <ScrollArea className="table-scroll-area" axis="horizontal" label="Independent route validation results">
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
      </ScrollArea>
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
        establish native model resolution. The means describe this fixed
        climatology. Terrain search uses elevation and slope. Climate
        preferences can optionally rank the completed paths.
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
      <h2 id="route-environment">Environmental route profiles</h2>
      <p className="lede">
        The worker follows the assessed path with separate spans to and from
        intended stops. It divides each spherical arc at model grid lines and
        into intervals of at most 25 km. Sampled means weight midpoint values
        by valid interval length. Coverage divides that length by total
        route length. The full samples and their roles travel with the export.
      </p>
      <p className="lede">
        For an opted-in climate preference, the four surrounding export nodes
        bound the model values in each cell. The definitely-outside fraction
        gives the lower score bound. Adding ambiguous spans gives the upper
        bound. Climate can influence the recommendation only when comparable
        coverage is complete, the relevant routes occupy different model
        cells and unequal bounds do not overlap. Each usable field contributes
        equally to the climate component. The remaining weight is apportioned
        among distance, terrain and missed objectives.
      </p>
      <h2 id="radiation-method">Radiation views</h2>
      <p className="lede">
        For the quantitative view we interpolate the six surface effective dose
        rates at 700 MV from Zhang and Guo’s Figure 11. The input is their
        published Figure 2 surface pressure grid for Ls 0° at local midnight.
        The plot covers galactic cosmic rays and secondaries under the study’s
        uniform dry regolith assumption. Dose rates are scenario context.
        Radiation has zero routing weight. Absolute geographic dose accuracy
        and cumulative personal exposure remain unknown.
      </p>
      <p className="lede">
        NASA’s PIA03480 illustration has a separate overlay. Each globe is
        reprojected from a fit to its graticule. The more face-on view wins
        where they overlap. A viewing cosine cutoff of 0.2 leaves 79.8% of the
        planet covered. The original colours and legend remain a visual record.
        Map inspection reports only whether the image covers that point.
      </p>
      <p className="lede">
        <EvidenceLink href="/sources/#atris-radiation">Zhang and Guo dataset and provenance</EvidenceLink>
        {" · "}
        <EvidenceLink href="/sources/#pia03480">NASA illustration and registration</EvidenceLink>
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
      <EvidenceLink href="/sources/">Inspect original evidence, processing &amp; usage terms</EvidenceLink>
    </main></PageTransition>
  );
}
