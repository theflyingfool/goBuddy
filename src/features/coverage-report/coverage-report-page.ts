import type { ReferenceGap } from "../../db/reference-data";
import { clear, el } from "../../ui/dom";
import gapsJson from "../../data/reference-gaps.json";

const gaps = gapsJson as unknown as ReferenceGap[];

const KIND_LABELS: Record<ReferenceGap["kind"], string> = {
  "mega-discrepancy": "Mega evolution discrepancy",
  "unverified-gender": "Unverified gender",
  "missing-types": "Missing/placeholder types",
  "inherited-availability": "Inherited (not per-form) availability",
  "possible-bogus-form": "Possibly bogus source-CSV row",
};

// This one fires for basically every non-base form (by design — the
// source CSV only varies Shiny per form, everything else is inherited from
// the species row) so it'd otherwise dwarf every other gap kind. Summarize
// it as a single count instead of one row per form.
const SUMMARIZE_ONLY: ReferenceGap["kind"][] = ["inherited-availability"];

export function renderCoverageReportPage(container: HTMLElement) {
  clear(container);

  container.append(
    el("h2", {}, ["Coverage Report"]),
    el("p", { class: "stub-message" }, [
      "Reference data gaps worth a manual glance, produced by the last ingestion run (npm run ingest:build). Not errors — just things to verify.",
    ]),
  );

  const byKind = new Map<ReferenceGap["kind"], ReferenceGap[]>();
  for (const gap of gaps) {
    const list = byKind.get(gap.kind) ?? [];
    list.push(gap);
    byKind.set(gap.kind, list);
  }

  if (gaps.length === 0) {
    container.append(el("p", { class: "empty-state" }, ["No gaps recorded — run npm run ingest:build to generate a report."]));
    return;
  }

  for (const [kind, label] of Object.entries(KIND_LABELS) as [ReferenceGap["kind"], string][]) {
    const list = byKind.get(kind);
    if (!list || list.length === 0) continue;

    const fieldset = el("fieldset", {}, [el("legend", {}, [`${label} (${list.length})`])]);

    if (SUMMARIZE_ONLY.includes(kind)) {
      fieldset.append(
        el("p", { class: "gap-note" }, [
          `${list.length} forms inherit this species' availability rather than being independently verified per form. Expected for most non-base forms — not individually actionable.`,
        ]),
      );
    } else {
      const ul = el("ul", { class: "gap-list" });
      for (const gap of list) {
        ul.append(
          el("li", { class: "gap-item" }, [
            el("strong", {}, [gap.formSlug ?? gap.speciesSlug]),
            el("span", {}, [` — ${gap.note}`]),
          ]),
        );
      }
      fieldset.append(ul);
    }

    container.append(fieldset);
  }
}
