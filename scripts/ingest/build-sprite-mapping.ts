// Bootstraps the §7 image pipeline (docs/v1-tasks/05-image-pipeline.md) from
// PokeMiners/pogo_assets's "Addressable Assets" icon set — a human-readable
// naming convention (pm{dex}.f{FORM}.c{COSTUME}.g{gender}.s.icon.png) rather
// than the opaque numeric form/costume IDs the task doc originally expected,
// discovered while triaging this task. Deliberately conservative: only ships
// art this script can match with real confidence (species base icons; a
// small whitelist of unambiguous regional/Mega/Gigantamax form tokens;
// costumes previously confirmed via costume-lookup.json; gender-tagged
// files — see below). Everything else — every unwhitelisted/ambiguous form
// token (Unown's bare letters collide with Mewtwo's "A" = Armored,
// Deoxys/Rotom/Vivillon/Burmy multiforms, etc.) — goes to a scratch-dir CSV
// for hand review instead of being guessed.
//
// Gender tag convention (owner-confirmed, and independently verified against
// the dump — every .g file found is .g2, .g1 never appears): the untagged
// file already serves as the "male" (or only/unknown-gender) art; .g2 is
// specifically the "female" variant. `parsed` is processed male-first
// (see the sort below) so a later .g2 match can correct a slug a male-first
// pass provisionally filled in, rather than racily depending on directory
// order.
//
// Re-run after adding entries to costume-lookup.json (committed, starts
// empty) to auto-match previously-unresolved costumes — this is the
// "only ever check new things" loop the reviewer asked for.

import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import referenceDataJson from "../../src/data/reference.json";
import type { ReferenceData } from "../../src/db/reference-data";
import type { Form, MegaVariant, MegaVariantKind } from "../../src/db/types";
import costumeLookupJson from "./costume-lookup.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const ASSET_DIR = resolve(REPO_ROOT, "Refs from Obsidian/pogo_assets/Images/Pokemon - 256x256/Addressable Assets");
const SPRITES_DIR = resolve(REPO_ROOT, "public/sprites");
const FORM_SPRITES_DIR = resolve(SPRITES_DIR, "forms");
const MEGA_SPRITES_DIR = resolve(SPRITES_DIR, "mega");
const SCRATCH_DIR = resolve(REPO_ROOT, "Refs from Obsidian/image-pipeline-staging");

const referenceData = referenceDataJson as unknown as ReferenceData;
const costumeLookup = costumeLookupJson as Record<string, string>;

// Regional/Mega/Gigantamax/Unown form tokens confident enough to auto-match
// without hand-checking. Mega/Primal aren't in this table — they're matched
// against the separate `megaVariants` reference table below, not `forms`.
//
// Unown's letters are namespaced `UNOWN_A`..`UNOWN_Z` (+ `UNOWN_EXCLAMATION_
// POINT`/`UNOWN_QUESTION_MARK`) in the file dump, distinct from Mewtwo's bare
// `A` (Armored) token — confirmed by listing both species' actual files
// side by side, no real collision here after all.
const FORM_TOKEN_WHITELIST: Record<string, string> = {
  ALOLA: "Alolan",
  GALARIAN: "Galarian",
  HISUIAN: "Hisuian",
  PALDEA_COMBAT: "Paldean(Combat)",
  PALDEA_AQUA: "Paldean(Aqua)",
  PALDEA_BLAZE: "Paldean(Blaze)",
  PALDEA: "Paldean",
  GIGANTAMAX: "Gigantamax",
  A: "Armored",
  UNOWN_EXCLAMATION_POINT: "!",
  UNOWN_QUESTION_MARK: "?",
  ...Object.fromEntries("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => [`UNOWN_${letter}`, letter])),
};

// Mega/Primal art lives in its own reference table (megaVariants), not
// `forms` — see CLAUDE.md's note that not every future fact is per-form.
// Maps a file's form token to the `variant` value used to key a
// (speciesSlug, variant) lookup into that table.
const MEGA_FORM_TOKEN_TO_VARIANT: Record<string, MegaVariantKind> = {
  MEGA: null,
  MEGA_X: "X",
  MEGA_Y: "Y",
  PRIMAL: "Primal",
};

interface ParsedFile {
  fileName: string;
  dex: number;
  formToken: string | null;
  costumeToken: string | null;
  genderToken: string | null;
  shiny: boolean;
}

const FILENAME_RE = /^pm(\d+)(?:\.f([A-Za-z0-9_]+))?(?:\.c([A-Za-z0-9_]+))?(?:\.g(\d+))?(\.s)?\.icon\.png$/;

function parseFileName(fileName: string): ParsedFile | null {
  const match = FILENAME_RE.exec(fileName);
  if (!match) return null;
  return {
    fileName,
    dex: Number(match[1]),
    formToken: match[2] ?? null,
    costumeToken: match[3] ?? null,
    genderToken: match[4] ?? null,
    shiny: match[5] !== undefined,
  };
}

interface ExtraRow {
  reason: string;
  fileName: string;
  dex: number;
  speciesName: string;
  formToken: string;
  costumeToken: string;
  genderToken: string;
}

interface MissingRow {
  formSlug: string;
  speciesName: string;
  dexNumber: number;
  formName: string;
  costumeName: string;
  reason: string;
}

function main() {
  if (!existsSync(ASSET_DIR)) {
    throw new Error(`Asset dir not found: ${ASSET_DIR} — is Refs from Obsidian/pogo_assets checked out?`);
  }

  const speciesByDex = new Map(referenceData.species.map((s) => [s.dexNumber, s]));
  const formsBySpeciesFormName = new Map<string, Form[]>();
  const formsBySpeciesCostumeName = new Map<string, Form[]>();
  const formsBySpecies = new Map<string, Form[]>();
  for (const f of referenceData.forms) {
    (formsBySpecies.get(f.speciesSlug) ?? formsBySpecies.set(f.speciesSlug, []).get(f.speciesSlug)!).push(f);
    const formKey = `${f.speciesSlug}|${f.formName}`;
    (formsBySpeciesFormName.get(formKey) ?? formsBySpeciesFormName.set(formKey, []).get(formKey)!).push(f);
    if (f.costumeName) {
      const costumeKey = `${f.speciesSlug}|${f.costumeName}`;
      (formsBySpeciesCostumeName.get(costumeKey) ?? formsBySpeciesCostumeName.set(costumeKey, []).get(costumeKey)!).push(f);
    }
  }

  const megaVariantsBySpeciesToken = new Map<string, MegaVariant>();
  for (const mv of referenceData.megaVariants) {
    const token = Object.entries(MEGA_FORM_TOKEN_TO_VARIANT).find(([, v]) => v === mv.variant)?.[0];
    if (token) megaVariantsBySpeciesToken.set(`${mv.speciesSlug}|${token}`, mv);
  }

  // Only "-female" is ever a real ambiguity to resolve — every array here
  // realistically holds at most one "-male" and one "-female" slug (or a
  // single "-unknown" for genderless species, where forms.length is 1 and
  // this is a no-op). A file with no gender tag keeps the pre-existing
  // broad-copy behavior (copy to every matched slug) so single-image
  // costumes/forms without a distinct female file still cover both slugs;
  // a .g2 file narrows to just the "-female" slug(s) so it doesn't stomp
  // the male slug with female art.
  function pickFormsForFile(forms: Form[], genderToken: string | null): Form[] {
    if (genderToken === null || forms.length <= 1) return forms;
    return forms.filter((f) => f.slug.endsWith("-female"));
  }

  const allFiles = readdirSync(ASSET_DIR).filter((f) => f.endsWith(".icon.png"));
  const parsed: ParsedFile[] = [];
  const parseFailures: string[] = [];
  for (const f of allFiles) {
    const p = parseFileName(f);
    if (p) parsed.push(p);
    else parseFailures.push(f);
  }
  // Male-tagged (i.e. untagged) files first, so a later .g2 pass can correct
  // a slug the untagged pass provisionally filled in — Array.prototype.sort
  // is a stable sort, so this only reorders across the null/non-null split.
  parsed.sort((a, b) => (a.genderToken === null ? 0 : 1) - (b.genderToken === null ? 0 : 1));

  // Wholesale-replace every generated output dir on each run — a stale file
  // from a previous run (e.g. one a matching-logic fix now correctly
  // rejects) must not silently survive just because this run didn't
  // overwrite that exact path. Confirmed this actually happened: a form-
  // token/costume-token interaction bug briefly mislabeled Galarian Ponyta/
  // Zigzagoon art under their "-standard-" slugs, and simply fixing the
  // matching logic didn't remove the already-copied bad files.
  for (const dir of [SPRITES_DIR, FORM_SPRITES_DIR, MEGA_SPRITES_DIR, SCRATCH_DIR]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
  }

  const extraRows: ExtraRow[] = [];
  const matchedFormSlugs = new Set<string>();
  const matchedMegaSlugs = new Set<string>();
  const dexWithAnyBaseIcon = new Set<number>();
  const dexWithAnyAltTaggedFile = new Set<number>();
  let speciesBaseCopied = 0;
  let formMatchesCopied = 0;
  let megaMatchesCopied = 0;

  function copyTo(destDir: string, destBaseName: string, srcFileName: string, shiny: boolean) {
    const suffix = shiny ? "-shiny" : "";
    copyFileSync(join(ASSET_DIR, srcFileName), join(destDir, `${destBaseName}${suffix}.png`));
  }

  function toExtra(p: ParsedFile, reason: string) {
    const species = speciesByDex.get(p.dex);
    extraRows.push({
      reason,
      fileName: p.fileName,
      dex: p.dex,
      speciesName: species?.name ?? "(unknown dex)",
      formToken: p.formToken ?? "",
      costumeToken: p.costumeToken ?? "",
      genderToken: p.genderToken ?? "",
    });
    copyFileSync(join(ASSET_DIR, p.fileName), join(SCRATCH_DIR, p.fileName));
  }

  for (const p of parsed) {
    if (p.formToken || p.costumeToken || p.genderToken) dexWithAnyAltTaggedFile.add(p.dex);

    const species = speciesByDex.get(p.dex);
    if (!species) {
      toExtra(p, "dex not found in reference.json");
      continue;
    }

    if (!p.formToken && !p.costumeToken) {
      if (p.genderToken === null) {
        // Species base icon.
        dexWithAnyBaseIcon.add(p.dex);
        copyTo(SPRITES_DIR, String(p.dex).padStart(3, "0"), p.fileName, p.shiny);
        speciesBaseCopied++;
        continue;
      }
      // Bare gender variant (.g2 = female, see module comment) of the plain
      // Standard form — formsBySpeciesFormName also holds every costume that
      // happens to share formName "Standard" (e.g. Pikachu's hats), so filter
      // down to the actual costume-less Standard form(s) first.
      const standardForms = (formsBySpeciesFormName.get(`${species.slug}|Standard`) ?? []).filter((f) => f.costumeName === null);
      const forms = pickFormsForFile(standardForms, p.genderToken);
      if (forms.length === 0) {
        toExtra(p, "gender-tagged Standard-form variant but no matching Standard form for this species");
        continue;
      }
      for (const form of forms) {
        copyTo(FORM_SPRITES_DIR, form.slug, p.fileName, p.shiny);
        matchedFormSlugs.add(form.slug);
      }
      formMatchesCopied++;
      continue;
    }

    if (p.costumeToken) {
      const displayName = costumeLookup[p.costumeToken];
      if (!displayName) {
        toExtra(p, "costume codename not yet in costume-lookup.json");
        continue;
      }
      let rawForms = formsBySpeciesCostumeName.get(`${species.slug}|${displayName}`) ?? [];
      if (p.formToken) {
        // A file can carry both tokens at once (e.g. Galarian Zigzagoon's
        // "Meloetta hat", Pumpkaboo's sized "Spooky Festival") — matching on
        // costumeName alone isn't enough there, since formsBySpeciesCostumeName
        // ignores formName and can return a "Standard"-form row for what's
        // actually Galarian-form art, mislabeling it (confirmed happening for
        // Zigzagoon/Ponyta before this check existed — the Galarian sprite was
        // getting copied to the "-standard-" slug). Require the form to also
        // match a whitelisted translation of the form token; if the token
        // isn't whitelisted, don't guess.
        const translatedForm = FORM_TOKEN_WHITELIST[p.formToken];
        if (!translatedForm) {
          toExtra(p, `costume file also carries an unwhitelisted form token "${p.formToken}" — can't verify which form this belongs to`);
          continue;
        }
        rawForms = rawForms.filter((f) => f.formName === translatedForm);
      }
      if (rawForms.length === 0) {
        toExtra(p, `costume-lookup.json maps to "${displayName}" but no matching form.costumeName for this species${p.formToken ? ` with form "${p.formToken}"` : ""}`);
        continue;
      }
      const forms = pickFormsForFile(rawForms, p.genderToken);
      if (forms.length === 0) {
        toExtra(p, `gender-tagged costume file but no "-female" form slug found for "${displayName}"`);
        continue;
      }
      for (const form of forms) {
        copyTo(FORM_SPRITES_DIR, form.slug, p.fileName, p.shiny);
        matchedFormSlugs.add(form.slug);
      }
      formMatchesCopied++;
      continue;
    }

    // formToken present, no costumeToken. Mega/Primal come from a separate
    // reference table (megaVariants), not `forms` — handle that first.
    if (p.formToken! in MEGA_FORM_TOKEN_TO_VARIANT) {
      const mega = megaVariantsBySpeciesToken.get(`${species.slug}|${p.formToken}`);
      if (!mega) {
        toExtra(p, `mega/primal token "${p.formToken}" but no matching megaVariant for this species`);
        continue;
      }
      copyTo(MEGA_SPRITES_DIR, mega.slug, p.fileName, p.shiny);
      matchedMegaSlugs.add(mega.slug);
      megaMatchesCopied++;
      continue;
    }

    const translated = FORM_TOKEN_WHITELIST[p.formToken!];
    if (!translated) {
      toExtra(p, "form token not in the confident-match whitelist");
      continue;
    }
    const rawForms = formsBySpeciesFormName.get(`${species.slug}|${translated}`) ?? [];
    if (rawForms.length === 0) {
      toExtra(p, `whitelisted form token "${p.formToken}" -> "${translated}" but no matching form.formName for this species`);
      continue;
    }
    const forms = pickFormsForFile(rawForms, p.genderToken);
    if (forms.length === 0) {
      toExtra(p, `gender-tagged file for whitelisted form token "${p.formToken}" but no "-female" slug among matches`);
      continue;
    }
    for (const form of forms) {
      copyTo(FORM_SPRITES_DIR, form.slug, p.fileName, p.shiny);
      matchedFormSlugs.add(form.slug);
    }
    formMatchesCopied++;
  }

  // "Forms missing images": a real coverage gap (no candidate art exists at
  // all), NOT the same thing as "a file exists but wasn't confidently
  // matched" (that's extraRows, from the other direction).
  const missingRows: MissingRow[] = [];
  for (const species of referenceData.species) {
    const forms = formsBySpecies.get(species.slug) ?? [];
    const hasBase = dexWithAnyBaseIcon.has(species.dexNumber);
    const hasAnyAltFile = dexWithAnyAltTaggedFile.has(species.dexNumber);

    if (!hasBase && !hasAnyAltFile) {
      // Truly nothing in the dump for this species at all (beyond PokeMiners
      // coverage, or a very new species) — every one of its forms is a real
      // gap, not just an unresolved file.
      for (const form of forms) {
        missingRows.push({
          formSlug: form.slug,
          speciesName: species.name,
          dexNumber: species.dexNumber,
          formName: form.formName,
          costumeName: form.costumeName ?? "",
          reason: "no art of any kind (base or form/costume-tagged) anywhere in the dump for this species",
        });
      }
      continue;
    }

    for (const form of forms) {
      const isStandard = form.formName === "Standard" && form.costumeName === null;
      if (isStandard) {
        // The species-level sprite covers this — unless there's genuinely no
        // base icon (e.g. Unown, which has per-letter art but no plain
        // "Standard" icon at all; not this app's problem to solve here).
        if (!hasBase) {
          missingRows.push({
            formSlug: form.slug,
            speciesName: species.name,
            dexNumber: species.dexNumber,
            formName: form.formName,
            costumeName: form.costumeName ?? "",
            reason: "species has alt-tagged art but no plain base icon for its Standard form",
          });
        }
        continue;
      }
      if (matchedFormSlugs.has(form.slug)) continue;
      // Some file (base and/or alt-tagged) exists for this species, but this
      // specific non-standard form wasn't confidently matched to one. Since
      // *something* plausibly corresponds to it (already surfaced from the
      // file side in extra-images.csv), don't also claim "no art exists" here
      // — that would contradict extra-images.csv and mislead the hand-check.
    }
  }

  function writeCsv(path: string, header: string[], rows: (string | number)[][]) {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(","), ...rows.map((r) => r.map(esc).join(","))];
    writeFileSync(path, lines.join("\n") + "\n");
  }

  writeCsv(
    join(SCRATCH_DIR, "extra-images.csv"),
    ["reason", "dex", "species_name", "form_token", "costume_token", "gender_token", "file_name"],
    extraRows.map((r) => [r.reason, r.dex, r.speciesName, r.formToken, r.costumeToken, r.genderToken, r.fileName]),
  );

  writeCsv(
    join(SCRATCH_DIR, "forms-missing-images.csv"),
    ["dex", "species_name", "form_name", "costume_name", "form_slug", "reason"],
    missingRows.map((r) => [r.dexNumber, r.speciesName, r.formName, r.costumeName, r.formSlug, r.reason]),
  );

  if (parseFailures.length > 0) {
    writeCsv(
      join(SCRATCH_DIR, "unparsed-filenames.csv"),
      ["file_name"],
      parseFailures.map((f) => [f]),
    );
  }

  // Committed manifests (src/data/, alongside reference.json) so
  // src/ui/sprites.ts's formSpritePath()/megaSpritePath() know which
  // slugs actually got art without needing a runtime file-exists check
  // (this is a bundled static public/ folder, not a queryable filesystem
  // at runtime).
  writeFileSync(
    resolve(REPO_ROOT, "src/data/form-sprite-slugs.json"),
    JSON.stringify([...matchedFormSlugs].sort(), null, 2) + "\n",
  );
  writeFileSync(
    resolve(REPO_ROOT, "src/data/mega-sprite-slugs.json"),
    JSON.stringify([...matchedMegaSlugs].sort(), null, 2) + "\n",
  );

  console.log(`Parsed ${parsed.length}/${allFiles.length} .icon.png files (${parseFailures.length} didn't match the naming pattern).`);
  console.log(`Species base icons copied: ${speciesBaseCopied} files -> ${SPRITES_DIR}`);
  console.log(`Confident form matches copied: ${formMatchesCopied} files -> ${FORM_SPRITES_DIR} (${matchedFormSlugs.size} distinct form slugs)`);
  console.log(`Mega/Primal matches copied: ${megaMatchesCopied} files -> ${MEGA_SPRITES_DIR} (${matchedMegaSlugs.size} distinct mega variant slugs)`);
  console.log(`Extra (unmatched, needs hand-check): ${extraRows.length} files -> ${SCRATCH_DIR}/extra-images.csv (+ copies)`);
  console.log(`Forms with no art anywhere in the dump: ${missingRows.length} -> ${SCRATCH_DIR}/forms-missing-images.csv`);
}

main();
