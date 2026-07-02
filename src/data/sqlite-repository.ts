// The real backend: everything reads from/writes through a genuine
// on-device @capacitor-community/sqlite database (see src/db/sqlite-client.ts
// for why this currently runs in "Web" mode via jeep-sqlite rather than a
// native Android project — same SQL either way).
//
// Reads are served from an in-memory cache (src/data/in-memory-store.ts)
// loaded once at startup — the same approach dummy-repository.ts already
// used, just backed by real SQLite instead of localStorage. This keeps the
// Repository interface synchronous (no ripple of async/loading-state
// changes through every UI call site) at the cost of one async boot step in
// main.ts before the first render. Writes update the cache immediately (so
// the UI reflects them synchronously) and queue a SQL write-through plus a
// saveToStore() call (required on Web for IndexedDB persistence) behind the
// scenes.

import type { ReferenceData } from "../db/reference-data";
import { DEFAULT_APP_SETTINGS } from "../db/defaults";
import { FORM_PERSONAL_BOOLEAN_FIELDS, FORM_PERSONAL_FIELD_COLUMNS, type FormPersonal, type SpeciesPersonal } from "../db/types";
import { getDb, persistDb } from "../db/sqlite-client";
import { runPersonalMigrations } from "../db/migrations";
import { syncReferenceData } from "../db/reference-sync";
import { getCompletionStatsSql } from "./completion-stats-sql";
import referenceDataJson from "./reference.json";
import { createInMemoryRepository, type PersonalState } from "./in-memory-store";
import type { Repository } from "./repository";

const referenceData = referenceDataJson as unknown as ReferenceData;

const FORM_PERSONAL_COLUMNS = [...FORM_PERSONAL_BOOLEAN_FIELDS.map((f) => FORM_PERSONAL_FIELD_COLUMNS[f]), "best_shiny", "best_non_shiny", "best_lucky"];

function upsertFormPersonalSql(): string {
  const columns = ["form_slug", ...FORM_PERSONAL_COLUMNS];
  const placeholders = columns.map(() => "?").join(", ");
  const updates = FORM_PERSONAL_COLUMNS.map((c) => `${c} = excluded.${c}`).join(", ");
  return `INSERT INTO form_personal (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(form_slug) DO UPDATE SET ${updates}`;
}

function formPersonalValues(fp: FormPersonal): unknown[] {
  const values: unknown[] = [fp.formSlug];
  for (const field of FORM_PERSONAL_BOOLEAN_FIELDS) values.push(fp[field] ? 1 : 0);
  values.push(fp.bestShiny, fp.bestNonShiny, fp.bestLucky);
  return values;
}

async function loadPersonalState(db: Awaited<ReturnType<typeof getDb>>): Promise<PersonalState> {
  const speciesPersonal: Record<string, SpeciesPersonal> = {};
  for (const row of (await db.query("SELECT * FROM species_personal")).values ?? []) {
    speciesPersonal[row.species_slug] = {
      speciesSlug: row.species_slug,
      registered: !!row.registered,
      xxl: !!row.xxl,
      xxs: !!row.xxs,
      purified: !!row.purified,
    };
  }

  const formPersonal: Record<string, FormPersonal> = {};
  for (const row of (await db.query("SELECT * FROM form_personal")).values ?? []) {
    const fp = { formSlug: row.form_slug, bestShiny: row.best_shiny ?? null, bestNonShiny: row.best_non_shiny ?? null, bestLucky: row.best_lucky ?? null } as FormPersonal;
    for (const field of FORM_PERSONAL_BOOLEAN_FIELDS) {
      fp[field] = !!row[FORM_PERSONAL_FIELD_COLUMNS[field]];
    }
    formPersonal[row.form_slug] = fp;
  }

  const appSettings: Record<string, string> = {};
  for (const row of (await db.query("SELECT * FROM app_settings")).values ?? []) {
    appSettings[row.key] = row.value;
  }

  return { speciesPersonal, formPersonal, appSettings };
}

export async function createSqliteRepository(): Promise<Repository> {
  const db = await getDb();
  await runPersonalMigrations(db);
  await syncReferenceData(db, referenceData);
  const state = await loadPersonalState(db);

  // Backfill any app-setting defaults the DB doesn't have a value for yet —
  // covers both a brand-new install (nothing set at all) and an existing
  // install that predates a newly-added default key. Never overwrites a
  // value the user (or a previous default) already set.
  for (const [key, value] of Object.entries(DEFAULT_APP_SETTINGS)) {
    if (state.appSettings[key] !== undefined) continue;
    state.appSettings[key] = value;
    await db.run("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
  }
  await persistDb();

  // Serializes writes onto one promise chain so rapid consecutive toggles
  // can't interleave against the same connection; logs rather than throws
  // since a failed write-through shouldn't crash the UI (the in-memory
  // cache — what the UI actually reads — is already updated by this point).
  let writeQueue: Promise<void> = Promise.resolve();
  function enqueueWrite(fn: () => Promise<void>): void {
    writeQueue = writeQueue.then(fn).catch((err) => console.error("SQLite write-through failed:", err));
  }

  // When > 0, a bulk operation is in flight (see runBulk below). The
  // personal-changed hooks below fire synchronously — one per row — while the
  // in-memory bulk method loops, so each reads this flag at enqueue time and,
  // if inside a bulk, (a) skips its own per-statement transaction (runBulk
  // wraps the whole batch in ONE explicit transaction instead — and the
  // plugin's default per-statement BEGIN would error nested inside that) and
  // (b) skips its per-row persistDb, leaving runBulk to do a single flush at
  // the end. Outside a bulk, behavior is unchanged: per-statement transaction
  // + a persist flush per edit.
  let bulkDepth = 0;

  const repo = createInMemoryRepository(referenceData, state, {
    onSpeciesPersonalChanged(speciesSlug, personal) {
      const inBulk = bulkDepth > 0;
      enqueueWrite(async () => {
        await db.run(
          `INSERT INTO species_personal (species_slug, registered, xxl, xxs, purified) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(species_slug) DO UPDATE SET registered = excluded.registered, xxl = excluded.xxl, xxs = excluded.xxs, purified = excluded.purified`,
          [speciesSlug, personal.registered ? 1 : 0, personal.xxl ? 1 : 0, personal.xxs ? 1 : 0, personal.purified ? 1 : 0],
          !inBulk,
        );
        if (!inBulk) await persistDb();
      });
    },
    onFormPersonalChanged(_formSlug, personal) {
      const inBulk = bulkDepth > 0;
      enqueueWrite(async () => {
        await db.run(upsertFormPersonalSql(), formPersonalValues(personal), !inBulk);
        if (!inBulk) await persistDb();
      });
    },
    onAppSettingChanged(key, value) {
      enqueueWrite(async () => {
        await db.run("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
        await persistDb();
      });
    },
  });

  // Runs a batched in-memory apply (which fires N onXChanged hooks
  // synchronously, each enqueuing a transaction-less row write with persist
  // suppressed — see bulkDepth above) wrapped in a single SQL transaction and
  // followed by exactly ONE persistDb() IndexedDB flush, instead of N. Awaits
  // the queue so callers can rely on the writes having landed.
  async function runBulk(applyBatch: () => Promise<void>): Promise<void> {
    bulkDepth++;
    enqueueWrite(async () => {
      await db.beginTransaction();
    });
    try {
      await applyBatch();
    } finally {
      bulkDepth--;
    }
    enqueueWrite(async () => {
      await db.commitTransaction();
      await persistDb();
    });
    await writeQueue;
  }

  return {
    ...repo,
    // Overrides the in-memory-store default with real parameterized SQL
    // (CLAUDE.md explicitly asks for this, not just an in-memory scan) — the
    // in-memory version stays as the dummy backend's implementation. Flushes
    // the write queue first so a stat computed right after a toggle can't
    // read a connection that's still mid-write.
    async getCompletionStats(scope, lenses) {
      await writeQueue;
      return getCompletionStatsSql(db, scope, lenses);
    },
    // Overrides the in-memory-store default to also wait for the writes it
    // just queued (via the onXChanged hooks above) to actually land in
    // SQLite + IndexedDB — callers that reload the page right after
    // importing need the real backing store updated first, not just the
    // in-memory cache.
    async importPersonalData(data) {
      await repo.importPersonalData(data);
      await writeQueue;
    },
    // Bulk overrides: run the shared in-memory cascade path (repo.bulkSet*)
    // but collapse its N per-row IndexedDB flushes into one transaction + one
    // persist via runBulk.
    async bulkSetFormPersonalField(formSlugs, field, value) {
      await runBulk(() => repo.bulkSetFormPersonalField(formSlugs, field, value));
    },
    async bulkSetSpeciesPersonalField(speciesSlugs, field, value) {
      await runBulk(() => repo.bulkSetSpeciesPersonalField(speciesSlugs, field, value));
    },
  };
}
