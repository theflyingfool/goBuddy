*Part of the [V1 Roadmap](README.md). Next: [Theme 2 — Reference-data corrections](02-reference-data-corrections.md).*

## Theme 1 — Data safety: the V1-blocking cluster

This app's entire value is one SQLite file on a phone. The review found five
distinct ways that file (or a friend's trust in it) can currently be lost, and
none require exotic circumstances.

### 1.1 The signing keystore is a data-loss time bomb *(Product, Platform — both ranked it #1)*

Android will only install an app *update* if it's signed with the same
cryptographic key as the installed version. Today every APK is a **debug
build**, signed by an auto-generated key that lives in one file on one machine
(`~/.android/debug.keystore`). If that machine is reinstalled, replaced, or the
file is lost, no future APK can update any friend's install — their only path
is uninstall → reinstall, **which deletes the database**. All the careful
migration machinery is downstream of this one unversioned file, and nothing in
the repo mentions it.

**Fix (S):** generate a dedicated release keystore once; back it up in at least
two places (committing it to this private repo is a defensible choice — decide
deliberately); add a `signingConfigs.release` block to
`android/app/build.gradle` and ship `assembleRelease` builds from now on.
First friend install should already be release-signed.

### 1.2 Two boot-brick scenarios with no way out *(Platform, Architecture)*

"Boot-brick" = the app shows *"Couldn't open the on-device database. Try
reloading."* forever, and because Export lives behind a successful boot, the
user can't even rescue their data.

- **Removed slug → sync failure.** The reference sync defers *foreign-key*
  checks (the database rule that a personal row must point at an existing
  reference row) until the transaction commits. If a slug is ever **removed**
  from `reference.json` (not renamed via the registry) while someone's personal
  data references it, the commit fails, the sync throws, and every subsequent
  boot fails the same way. This isn't hypothetical: known-bogus rows (the fake
  Galarian Persian/Grimer/Muk) are natural candidates for deletion in a future
  data pass. One friend who toggled a bogus form + one cleanup commit = bricked
  install. (`src/db/reference-sync.ts:65`)
- **A failed migration mid-run.** A *migration* is a script that upgrades the
  database's structure in place. The runner (`src/db/migrations.ts:54-57`)
  doesn't wrap each migration in a transaction: on native Android a crash
  halfway leaves the database half-upgraded with the old version number, so the
  next boot re-runs the migration, hits "duplicate column," and fails forever.
  The `MIGRATIONS` list is empty today — this must be fixed *before* the first
  real entry ships, whenever that is.

**Fixes (S each):**
- In the sync transaction, detect personal rows whose slug no longer resolves
  and quarantine them (move to an `orphaned_personal` table) instead of letting
  the commit fail; add an ingestion-time check that fails the build if a slug
  disappears without a rename-registry entry.
- Wrap each migration in a transaction; refuse to boot (with a clear message)
  if the stored schema version is *newer* than the app's (someone sideloaded an
  old APK); dump personal tables to JSON before running any pending migration.
- **A boot-failure rescue screen**: on any DB-open/sync/migration error, still
  offer a raw "export personal data" button that reads the personal tables
  directly. This one screen turns every scenario above from catastrophic into
  annoying. The platform reviewer's summary line: *"every other risk is
  recoverable if the keystore and the rescue path exist."*

### 1.3 Silent write failures: the UI lies *(Architecture, Product, Platform — all three found it independently)*

Every edit updates an in-memory copy immediately (so the UI shows it saved) and
writes to the real database asynchronously through a queue. If that write fails
— disk full, I/O error, a foreign-key violation — the only symptom is
`console.error`, which nobody sees on a phone
(`src/data/sqlite-repository.ts:96-98`). The toggle looks saved, survives the
session, and vanishes on next launch. Bulk edits have a variant: a mid-batch
failure still commits the partial batch.

**Fix (S):** on the first failed write, show a persistent in-app banner ("Your
last change didn't save — export a backup now") with a retry; make import
report the number of rows it skipped (see 1.4).

### 1.4 Import can silently drop data, and has no undo *(Platform, Product, Architecture)*

Import overwrites matching entries with only a confirm dialog as the guard —
no automatic pre-import snapshot. Worse: an export from a *newer* app version
can contain form slugs this build doesn't know; each such row fails its
foreign-key check inside the silent write path above, so the user sees
"Imported." while rows quietly vanish. Phone and desktop *will* drift versions
— this is the exact workflow the feature exists for.

**Fix (S):** auto-export a snapshot before applying any import (the function
already exists — call it first); pre-filter unknown slugs and report the count;
surface write failures per 1.3.

### 1.5 No backup story beyond a button nobody is told about *(Docs, Platform, Architecture)*

- On desktop/web, the entire database lives in the browser's IndexedDB —
  storage the browser is allowed to **evict** (delete) under disk pressure.
  `navigator.storage.persist()` — a one-line request that asks the browser to
  protect the data — is never called.
- On Android, `allowBackup="true"` is the untested scaffold default; whether
  Google's auto-backup actually restores a sideloaded app's DB has never been
  verified.
- Nothing in the app or docs tells a friend that Export is their only real
  backup.

**Fixes (S–M):** call `storage.persist()` on web; a once-daily rotating
auto-export on Android (keep last 3, via the already-integrated Filesystem
plugin) is the proportionate net; add "why you should export" text next to the
button; decide the `allowBackup` stance deliberately and document it.
