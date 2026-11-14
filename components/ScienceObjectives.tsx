"use client";
import EvidenceLink from "./EvidenceLink";
import Accordion from "./Accordion";
import { useEffect } from "react";
import { Plus } from "lucide-react";
import { localObjectives, scienceTargets } from "@/lib/science";
import type { PlannerDraft, PlannerSettings } from "@/lib/planner";
export default function ScienceObjectives({
  draft,
  settings,
  onSettings,
  onDraft,
  onExploreGoal,
  sections, onSections, focus,
}: {
  draft: PlannerDraft;
  settings: PlannerSettings;
  onSettings: (s: PlannerSettings) => void;
  onDraft: (d: PlannerDraft) => void;
  onExploreGoal: (tag: string) => void;
  sections: { objectives: boolean; outcrops: boolean };
  onSections: (sections: { objectives: boolean; outcrops: boolean }) => void;
  focus: { id: string; revision: number } | null;
}) {
  useEffect(() => {
    if (!focus) return;
    const timer = window.setTimeout(() => document.getElementById(focus.id)?.focus(),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
    return () => clearTimeout(timer);
  }, [focus]);
  return (
    <Accordion className="science-objectives" open={sections.objectives}
      onOpenChange={(objectives) => onSections({ ...sections, objectives })} title={<>
        Science objectives{" "}
        <span>
          {settings.objectives.length
            ? settings.objectives.length + " selected"
            : "Optional"}
        </span>
      </>}>
      <section aria-labelledby="science-title">
        <h3 id="science-title">What would you investigate?</h3>
        <p className="small-note">
          Verified local outcrops support two Jezero objectives. Optional stops
          are evaluated against your distance and terrain preferences.
        </p>
        <div className="objective-options">
          {localObjectives.map((o) => (
            <label key={o.id}>
              <input
                type="checkbox"
                checked={settings.objectives.includes(o.id)}
                onChange={(e) =>
                  onSettings({
                    ...settings,
                    objectives: e.target.checked
                      ? [...settings.objectives, o.id]
                      : settings.objectives.filter((id) => id !== o.id),
                  })
                }
              />
              <span>{o.name}</span>
            </label>
          ))}
        </div>
        <Accordion className="quality-details" open={sections.outcrops}
          onOpenChange={(outcrops) => onSections({ ...sections, outcrops })} title={<>Verified Jezero type outcrops</>}>
          <p className="small-note">
            Published representative locations, rounded to 0.001°. They are not
            precise sample sites. A route reaches the cell containing the
            published type position; its connector remains unassessed.
          </p>
          {scienceTargets.map((t) => (
            <article
              key={t.id}
              id={t.id}
              tabIndex={-1}
              className="science-target"
            >
              <strong>
                {t.name} <span>{t.unit}</span>
              </strong>
              <p>{t.interpretation}.</p>
              <div className="button-row">
                <EvidenceLink
                  className="text-link"
                  href={t.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Published evidence</EvidenceLink>
                <button
                  className="text-button"
                  disabled={draft.waypoints.length >= 3}
                  onClick={() =>
                    onDraft({
                      ...draft,
                      waypoints: [...draft.waypoints, t.coordinates],
                    })
                  }
                >
                  <Plus size={15} />
                  Add stop
                </button>
              </div>
            </article>
          ))}
        </Accordion>
        <Accordion className="quality-details" title={<>Explore other science themes</>}>
          <p className="small-note">
            These filters identify supported regions, not invented local
            targets.
          </p>
          <div className="filters">
            {[
              "Ancient water",
              "Sediments",
              "Carbonates",
              "Clays",
              "Hydrothermal",
              "Volcanism",
            ].map((tag) => (
              <button key={tag} onClick={() => onExploreGoal(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </Accordion>
      </section>
    </Accordion>
  );
}
