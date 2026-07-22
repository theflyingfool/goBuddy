import type { ReferenceData, ReferenceGap } from "../../db/reference-data";
import type { Form } from "../../db/types";
import { clear, el } from "../../ui/dom";
import { formToCsvRow, referenceRowsToCsv } from "../../data/reference-csv-format";
import { downloadTextFile } from "../../shared/file-download";
import gapsJson from "../../data/reference-gaps.json";
import referenceJson from "../../data/reference.json";

const gaps = gapsJson as unknown as ReferenceGap[];
const reference = referenceJson as unknown as ReferenceData;

const KIND_LABELS: Record<ReferenceGap["kind"], string> = {
  "mega-discrepancy": "Mega evolution discrepancy",
  "unverified-gender": "Unverified gender",
  "missing-types": "Missing/placeholder types",
  "inherited-availability": "Inherited (not per-form) availability",
  "possible-bogus-form": "Possibly bogus source-CSV row",
  "guessed-costume-name": "Guessed costume name",
  "missing-species": "Missing from ingestion sources",
  "gigantamax-mismatch": "Gigantamax flag mismatch",
  "family-root-mismatch": "Evolution family root mismatch",
};

// This one fires for basically every non-base form (by design — the
// source CSV only varies Shiny per form, everything else is inherited from
// the species row) so it'd otherwise dwarf every other gap kind. Summarize
// it as a single count instead of one row per form.
const SUMMARIZE_ONLY: ReferenceGap["kind"][] = ["inherited-availability"];

/**
 * The forms a gap-kind's CSV export should include: whichever form a gap
 * names directly, plus — for gaps that only name a species (mega-discrepancy,
 * unverified-gender, possible-bogus-form all fire at species granularity,
 * with no single form to blame) — every form of that species, since the
 * fields worth double-checking (gender, mega-eligibility, ...) live on the
 * species row all of that species' forms share in this CSV shape.
 */
function formsForGaps(gapList: ReferenceGap[]): Form[] {
  const formsBySlug = new Map(reference.forms.map((f) => [f.slug, f]));
  const formsBySpecies = new Map<string, Form[]>();
  for (const form of reference.forms) {
    const list = formsBySpecies.get(form.speciesSlug) ?? [];
    list.push(form);
    formsBySpecies.set(form.speciesSlug, list);
  }

  const seen = new Set<string>();
  const result: Form[] = [];
  for (const gap of gapList) {
    const matched = gap.formSlug ? [formsBySlug.get(gap.formSlug)].filter((f): f is Form => f !== undefined) : (formsBySpecies.get(gap.speciesSlug) ?? []);
    for (const form of matched) {
      if (seen.has(form.slug)) continue;
      seen.add(form.slug);
      result.push(form);
    }
  }
  return result;
}

function csvFileNameFor(kind: ReferenceGap["kind"]): string {
  return `gobuddy-coverage-${kind}.csv`;
}

export function renderCoverageReportPage(container: HTMLElement) {
  clear(container);

  container.append(
    el("h2", {}, ["Coverage Report"]),
    el("p", { class: "stub-message" }, [
      "Reference data gaps worth a manual glance, produced by the last ingestion run (npm run ingest:build). Not errors — just things to verify. " +
        "Export a section as CSV, hand-edit the flagged fields, then run npm run ingest:csv:import on it to apply the fix.",
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

    const statusEl = el("p", { class: "gap-note" }, []);
    const exportButton = el("button", { type: "button" }, ["Export as CSV"]);
    exportButton.addEventListener("click", async () => {
      statusEl.textContent = "Exporting…";
      try {
        const forms = formsForGaps(list);
        const rows = forms.map((form) => formToCsvRow(reference, form));
        const csv = referenceRowsToCsv(rows);
        await downloadTextFile(csv, {
          suggestedName: csvFileNameFor(kind),
          mimeType: "text/csv",
          description: `GoBuddy coverage report — ${label}`,
        });
        statusEl.textContent = `Exported ${rows.length} row(s). Edit the flagged fields, then run: npm run ingest:csv:import -- <path to this file>`;
      } catch (err) {
        statusEl.textContent = `Export failed: ${(err as Error).message}`;
      }
    });

    fieldset.append(exportButton, statusEl);
    container.append(fieldset);
  }
}
