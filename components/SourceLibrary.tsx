"use client";
import { Field, Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import Accordion from "./Accordion";

import { useState, type ReactNode } from "react";
import EvidenceLink from "./EvidenceLink";
import { ChevronDown, Search } from "lucide-react";
import { locations } from "@/lib/atlas";
import records from "@/data/sources.json";
import services from "@/data/services.json";
import DocumentNav from "./DocumentNav";

const sourceTypes = ["All", ...new Set(records.map((record) => record.type))];

function OriginalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <EvidenceLink className="original-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </EvidenceLink>
  );
}

export default function SourceLibrary() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const term = query.trim().toLowerCase();
  const filtered = records.filter((record) =>
    (type === "All" || record.type === type) &&
    [record.id, record.title, record.institution, record.type, record.description].join(" ").toLowerCase().includes(term)
  );
  return (
    <main className="document-page sources-page page-view">
      <DocumentNav current="sources" />
      <header className="document-heading">
        <p className="eyebrow orange">Scientific sources</p>
        <h1>Evidence behind the exploration</h1>
        <p className="lede">Trace the imagery, coordinates and scientific descriptions back to the people and missions that produced them.</p>
      </header>
      <div className="source-search">
        <label className="search">
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search sources"
            placeholder="Search by region, mission or dataset…" />
        </label>
        <Field className="source-select">
          <Label className="sr-only">Filter source type</Label>
          <Listbox value={type} onChange={setType}>
            <ListboxButton className="source-select-trigger">
              <span>{type}</span><ChevronDown size={16} aria-hidden="true" />
            </ListboxButton>
            <ListboxOptions anchor={{ to: "bottom", gap: 5, padding: 8 }} modal={false} transition className="source-select-options">
              {sourceTypes.map((option) => (
                <ListboxOption key={option} value={option} className="source-select-option">
                  <span>{option}</span>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
        </Field>
        <p className="source-count" role="status">{filtered.length} {filtered.length === 1 ? "source" : "sources"}</p>
      </div>
      {filtered.length === 0 && <p className="empty">No sources match those filters.</p>}
      {filtered.map((record) => (
        <article className="source-record" key={record.id} id={record.id}>
          <div className="source-type">
            <strong>{record.type}</strong>
            <span className="source-id">{record.id}</span>
          </div>
          <div className="source-description">
            <h2>{record.title}</h2>
            <p className="source-institution">{record.institution}</p>
            <p>{record.description}</p>
            <OriginalLink href={record.url}>Original source</OriginalLink>
            <Accordion className="dataset-details" title={<>Provenance, units &amp; limitations</>}>
              <dl>
                {[
                  ["Source ID", record.id],
                  ["Institution / mission", record.institution],
                  ["Accessed", "accessed" in record ? record.accessed : "Not recorded for supplied original"],
                  ["Format", "format" in record ? record.format : "Original linked source"],
                  ["Coverage", "coverage" in record ? record.coverage : "Representative region; see coordinate evidence"],
                  ["Resolution", "resolution" in record ? record.resolution : "Not a quantitative measurement product"],
                  ["Units", "units" in record ? record.units : "Scientific description"],
                  ["Coordinate system", "crs" in record ? record.crs : "See linked coordinate evidence"],
                  ["Processing", record.processing],
                  ["Limitations", record.limitations],
                  ["Usage / credits", record.usage],
                  ["Checksum", "sha256" in record ? record.sha256 : "See source-specific provenance where available"],
                ].map(([label, value]) => (
                  <div className="provenance-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              {record.id === "trek" && services.map((service) => (
                <p key={service.id}>
                  <OriginalLink href={service.capabilities}>{service.title} · {service.matrixIds.length} tile levels</OriginalLink>
                </p>
              ))}
            </Accordion>
            {record.coordinateSource && <>
              <p>{record.coordinateNote}</p>
              <OriginalLink href={record.coordinateSource}>Coordinate evidence</OriginalLink>
              <p className="small-note">Access check: {record.sourceStatus}</p>
            </>}
          </div>
        </article>
      ))}
      <h2>Image credits and processing</h2>
      <p className="lede">Displayed illustrations are resized derivatives from the linked sources. The original captions describe their locations, false colour and interpretation.</p>
      {locations.filter((location) => location.image).map((location) => (
        <article className="source-record" key={location.id}>
          <div className="source-type"><strong>Image</strong><span className="source-id">{location.id}</span></div>
          <div className="source-description">
            <h3>{location.name}</h3>
            <p>{location.imageCaption} {location.imageCredit}</p>
            <div className="source-image-links">
              {location.imageSource && <OriginalLink href={location.imageSource}>Original image file</OriginalLink>}
              <OriginalLink href={location.sourceUrl}>Caption, credits &amp; usage</OriginalLink>
            </div>
          </div>
        </article>
      ))}
      <h2>Reference layers and missing data</h2>
      <p className="lede">The atmospheric overlays use a numerical MCD 6.2 export with reconstructed coordinates and source checksums. The NASA historical radiation layer shows registered illustration colours and image coverage. Its original model grid is unknown. Missing measurements remain unavailable.</p>
      <div className="notice">MarsPath supports research and education. Dataset resolution, coverage and uncertainty limit each interpretation. NASA provides source imagery and has not endorsed MarsPath.</div>
      <EvidenceLink href="/methodology/">Read methods, limitations &amp; AI disclosure</EvidenceLink>
    </main>
  );
}
