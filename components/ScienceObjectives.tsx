"use client";
import { Plus } from "lucide-react";
import { localObjectives, scienceTargets } from "@/lib/science";
import type { PlannerDraft, PlannerSettings } from "@/lib/planner";
export default function ScienceObjectives({
  draft,
  settings,
  onSettings,
  onDraft,
  onExploreGoal,
}: {
  draft: PlannerDraft;
  settings: PlannerSettings;
  onSettings: (s: PlannerSettings) => void;
  onDraft: (d: PlannerDraft) => void;
  onExploreGoal: (tag: string) => void;
}) {
  return (
    <details className="science-objectives">
      <summary>
        Science objectives{" "}
        <span>
          {settings.objectives.length
            ? settings.objectives.length + " selected"
            : "Optional"}
        </span>
      </summary>
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
        <details className="quality-details">
          <summary>Verified Jezero type outcrops</summary>
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
                <a
                  className="text-link"
                  href={t.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Published evidence ↗
                </a>
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
        </details>
        <details className="quality-details">
          <summary>Explore other science themes</summary>
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
        </details>
      </section>
    </details>
  );
}
