"use client";

import { memo, useEffect, useState } from "react";
import { loadMedaObservations, medaManifest, medaMeanHours, medaProfileSegments, type MedaData } from "@/lib/medaObservations";
import { climateSnapshot } from "@/lib/layers";
import Accordion from "./Accordion";
import EvidenceLink from "./EvidenceLink";
import StyledSelect from "./StyledSelect";

export default memo(function HistoricalObservations() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MedaData>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [sol, setSol] = useState(30);
  const [channel, setChannel] = useState(0);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!open || data) return;
    let active = true;
    loadMedaObservations().then((result) => { if (active) { setData(result); setError(undefined); } },
      (reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [open, data, retry]);
  const series = data?.series.find((series) => series.sol === sol);
  const sample = series?.samples[Math.min(index, series.samples.length - 1)];
  const segments = series ? medaProfileSegments(series, channel) : [];
  const values = segments.flat().map(({ value }) => value);
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const unit = channel ? "K" : "Pa";
  const sensor = data?.sensors.find((sensor) => sensor.channel === channel);
  const sampleValue = sample && (channel ? sample.temperatureK[channel - 1] : sample.pressurePa);
  const product = data?.products.find(({ id }) => id === (channel ? series?.temperatureProduct : series?.pressureProduct));
  const ancillary = data?.products.find(({ id }) => id === series?.positionProduct);
  const x = (hours: number) => 18 + hours / 24 * 284;
  const y = (value: number) => 107 - (value - minimum) / Math.max(1, maximum - minimum) * 82;
  return <Accordion className="quality-details historical-observations" title="Historical observations · MEDA" open={open} onOpenChange={setOpen}>
    <p className="small-note">Perseverance at Jezero · sols 30–32 · March 2021 · archived measurements · zero ranking weight.</p>
    {!data && !error && <p role="status" className="small-note">Loading the historical series…</p>}
    {error && <div role="status"><p>{error}</p><button className="secondary-button" onClick={() => { setError(undefined); setRetry((value) => value + 1); }}>Retry observations</button></div>}
    {data && series && sample && <>
      <div className="mission-fields">
        <label>Observation sol<StyledSelect value={sol} onChange={(event) => { setSol(+event.target.value); setIndex(0); }}>
          {data.series.map(({ sol }) => <option value={sol} key={sol}>Sol {sol}</option>)}
        </StyledSelect></label>
        <label>Observed variable<StyledSelect value={channel} onChange={(event) => setChannel(+event.target.value)}>
          <option value="0">Pressure · Pa</option>
          {data.sensors.map((sensor) => <option key={sensor.channel} value={sensor.channel}>Temperature · {sensor.name} · {sensor.heightM} m</option>)}
        </StyledSelect></label>
      </div>
      <p className="small-note">{sensor ? `Calibrated local sensor temperature · ${sensor.heightM} m above the surface. Rover thermal influence remains in these measurements.` : "Derived surface pressure · source transducer retained."}</p>
      {values.length > 0 && <>
        <div className="observation-plot"><svg className="observation-chart" viewBox="0 0 320 118" role="img" aria-label={`Sol ${sol} ${channel ? "local sensor temperature" : "pressure"} against local mean solar time. Gaps remain unconnected.`}>
          {[6, 12, 18].map((hour) => <line x1={x(hour)} x2={x(hour)} y1="16" y2="109" key={hour} stroke="#3d504a" />)}
          {segments.map((segment, i) => segment.length > 1
            ? <polyline key={i} fill="none" stroke="#f6bc8c" strokeWidth="2" points={segment.map(({ hours, value }) => `${x(hours).toFixed(2)},${y(value).toFixed(2)}`).join(" ")} />
            : <circle key={i} cx={x(segment[0].hours)} cy={y(segment[0].value)} r="1.5" fill="#f6bc8c" />)}
          {sampleValue != null && <circle cx={x(medaMeanHours(sample.lmst))} cy={y(sampleValue)} r="4" fill="#86ddc5" />}
        </svg>
        <div className="observation-axis" aria-hidden="true">{[0, 6, 12, 18, 24].map((hour) => <span key={hour}>{hour}</span>)}</div></div>
        <p className="small-note">{minimum.toFixed(1)}–{maximum.toFixed(1)} {unit} in displayed samples · horizontal axis in LMST hours.</p>
      </>}
      <label className="observation-slider">Inspect archived sample
        <input type="range" min="0" max={series.samples.length - 1} value={Math.min(index, series.samples.length - 1)} onChange={(event) => setIndex(+event.target.value)} />
      </label>
      <dl className="route-evidence-metrics">
        <div><dt>Measurement</dt><dd>{sampleValue == null ? "Missing" : `${sampleValue.toFixed(2)} ${unit}`}</dd></div>
        <div><dt>Earth UTC</dt><dd>{sample.utc}</dd></div>
        <div><dt>LMST</dt><dd>{sample.lmst}</dd></div>
        <div><dt>LTST</dt><dd>{sample.ltst}</dd></div>
        <div><dt>Position in M2020_TOPO</dt><dd>{sample.positionM?.map((v) => v.toFixed(2)).join(", ")} m</dd></div>
      </dl>
      <p className="small-note">{data.positionFrame} {channel ? series.temperatureGaps.length : series.gaps.length} native {channel ? "temperature" : "pressure"} gaps.
        Values shown are the first observation in each occupied five-minute LMST bin.</p>
      <p className="small-note">MCD comparison context · {climateSnapshot.scenario}.
        Season, time, height and position differ. A model-minus-observation calculation is unavailable.</p>
      <Accordion title="Observation sources & limitations" className="quality-details">
        <ul className="mission-alternates">{data.limitations.map((text) => <li key={text}>{text}</li>)}</ul>
        {product && <><EvidenceLink className="text-link" href={product.url} target="_blank" rel="noreferrer">Original {channel ? "temperature" : "pressure"} product</EvidenceLink>
          <EvidenceLink className="text-link" href={product.labelUrl} target="_blank" rel="noreferrer">PDS product label</EvidenceLink>
          <p className="small-note observation-product">{product.id}</p></>}
        {ancillary && <EvidenceLink className="text-link" href={ancillary.labelUrl} target="_blank" rel="noreferrer">Matched position record</EvidenceLink>}
        <EvidenceLink className="text-link" href={medaManifest.sensorSource} target="_blank" rel="noreferrer">MEDA sensor heights and thermal influences</EvidenceLink>
        <p className="small-note">{medaManifest.credit}</p>
      </Accordion>
    </>}
    <EvidenceLink className="text-link" href={medaManifest.source} target="_blank" rel="noreferrer">MEDA archive and data citation</EvidenceLink>
  </Accordion>;
});
