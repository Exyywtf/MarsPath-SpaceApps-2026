import EvidenceLink from "@/components/EvidenceLink";
import ScrollArea from "@/components/ScrollArea";
import PageTransition from "@/components/PageTransition";
import validation from "@/data/validation/v2-independent.json";
import DocumentNav from "@/components/DocumentNav";
import { JezeroCaseEvidence } from "@/components/MissionPlanner";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/methodology/", "Methodology — MarsPath",
  "Learn how MarsPath searches terrain, compares mission candidates and reports scientific evidence and coverage.");
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
      <h2 id="mission-validation">Jezero mission case</h2>
      <JezeroCaseEvidence />
      <EvidenceLink className="text-link" href="/?mission=jezero">Open the Jezero Mission Planner</EvidenceLink>
      <h2>Daylight and terrain visibility</h2>
      <p className="lede">
        Mars24 converts Earth UTC to terrestrial time using the leap-second table through 2026, then estimates Mars season,
        local mean and true solar time, elevation and azimuth. The calculation converts atlas latitudes to planetographic latitude.
        The geometric horizon excludes terrain shadows and atmospheric extinction. Mission timelines sample travel and dwell at intervals
        of up to one Earth minute and refine detected horizon crossings to one second.
      </p>
      <EvidenceLink className="text-link" href="https://www.giss.nasa.gov/tools/mars24/help/algorithm.html">NASA Mars24 equations and worked examples</EvidenceLink>
      <EvidenceLink className="text-link" href="https://datacenter.iers.org/data/html/bulletinc-072.html">IERS leap-second bulletin</EvidenceLink>
      <p className="lede">
        Terrain visibility tests straight chords between hypothetical antenna locations and a numerical regional terrain model on the Mars sphere.
        The model samples each chord at half-cell spacing or finer. The route samples are nominally 40 m apart, with a maximum of 512 positions per leg.
        Missing terrain and unassessed connectors return unknown. Signal strength, communications range and equipment reliability remain unassessed.
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
        The Carter et al. archive supplies 1,851 distinct OMEGA and CRISM hydrated mineral records, with instrument product IDs
        and all original row numbers. The archive table gives published point locations and omits species.
        Mineral footprints and ground sampling locations remain unassessed.
      </p>
      <p className="lede">
        The TES layer aggregates 5 × 5 source pixels into 0.25° apparent thermal inertia cells with area weighting.
        Only cells with direct observational support throughout are shown.
        The source spacing is 0.05°. Apparent thermal inertia characterizes a modelled thermal response.
      </p>
      <EvidenceLink className="text-link" href="/sources/#geology">Geology, mineral and thermal sources</EvidenceLink>
      <EvidenceLink className="text-link" href="/sources/#hydrated-mineral-sites">Hydrated mineral archive and limitations</EvidenceLink>
      <p className="lede">
        Once geometry is ready, the route worker splits each full spherical Mars arc at 0.125° grid boundaries.
        It reports mapped lengths, unit transitions and the length-weighted mean over supported thermal cells.
        Endpoint connectors and geographic lines have their own records. Mineral proximity is the minimum spherical
        distance from a published catalogue point to the full route arcs. These sources inform research comparisons and carry zero ranking weight.
        Where the depth grids are unavailable, ice evidence remains a cited reference.
      </p>
      <h2>Three levels of route support</h2>
      <ul>
        <li>
          <strong>Regional terrain:</strong> native 20 m Jezero CTX and 20.23 m Oxia CTX
          elevation cells, with latitude-corrected surface spacing. Oxia covers a native-aligned window about 30 km across.
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
        The Oxia archive passed its published MD5 and all ZIP member CRC checks. Source elevations remain at their original grid centres.
        The native equirectangular coordinates were checked against the independently supplied MOLA grid, with a median absolute elevation
        difference of 7.84 m across 36,939 samples. The source WKT includes a Mars ellipsoid. A further latitude conversion worsens the MOLA agreement.
        MarsPath retains the native angular coordinates. Absolute alignment accuracy remains unknown.
      </p>
      <EvidenceLink className="text-link" href="/sources/#oxia-ctx">Oxia terrain source and registration limits</EvidenceLink>
      <h2 id="historical-observations">Archived MEDA measurements</h2>
      <p className="lede">
        The historical viewer preserves 520 pressure measurements selected from sols 30–32, with five calibrated temperature channels
        and position records matched at the exact spacecraft clock. Thirty-three selected pressure times have no matching temperature record.
        These channels remain missing. Source gaps interrupt the profiles. UTC uses the NAIF Mars 2020 clock kernel and its leap-second source.
        Some temperature and position label endpoints differ from the CSV clocks by half a second, which is recorded in the metadata.
      </p>
      <p className="lede">
        The three mast temperature sensors are about 1.45 m above the surface and the two rover-frame sensors are about 0.84 m.
        Calibrated local readings retain rover thermal effects. The source ATS products have no quality flag fields.
        Archived observations carry zero route weight. Their season, times, height and position differ from the MCD climatology scenario.
      </p>
      <EvidenceLink className="text-link" href="/sources/#meda-observations">MEDA products, sensor context and limitations</EvidenceLink>
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
        We used OpenAI Codex to explore implementation options and assist with
        research, design, coding, data processing, validation and writing. The
        atlas uses genuine mission imagery and measurements from the cited
        institutions and publications. Route search and ranking use deterministic
        calculations. We also used Codex for demo editing, editorial graphics and
        synthesized instrumental audio. The demo shows real atlas recordings.
      </p>
      <p className="lede">
        The original software is MIT licensed. Imagery, scientific data and
        fonts retain their own terms. We sent the required notice to the MCD
        authors for the retained climatology snapshot. Its noncommercial use
        conditions and attribution still apply.
      </p>
      <div className="notice">
        Research and education, not operational navigation. Unknown hazards
        remain unknown.
      </div>
      <EvidenceLink href="/sources/">Inspect original evidence, processing &amp; usage terms</EvidenceLink>
    </main></PageTransition>
  );
}
