// Run after merging a branch into master:
//   npm run version:bump -- minor   (feature branches)
//   npm run version:bump -- patch   (fix branches)
//
// Bumps package.json's semver and android/app/build.gradle's versionName to
// match, and always increments versionCode by exactly 1 — Android only cares
// that versionCode strictly increases between installs, so it moves on every
// merge regardless of bump size. See CLAUDE.md's "Development workflow"
// section for the full policy this implements.
//
// Add --dry-run to print the changes without writing any files.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const packageJsonPath = `${repoRoot}package.json`;
const buildGradlePath = `${repoRoot}android/app/build.gradle`;

type BumpKind = "minor" | "patch";

function parseArgs(): { kind: BumpKind; dryRun: boolean } {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const kind = args.find((a): a is BumpKind => a === "minor" || a === "patch");
  if (!kind) {
    console.error('Usage: npm run version:bump -- <minor|patch> [--dry-run]');
    process.exit(1);
  }
  return { kind, dryRun };
}

function bumpSemver(version: string, kind: BumpKind): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Version "${version}" is not a plain x.y.z semver string`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const { kind, dryRun } = parseArgs();

  const packageJsonText = readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonText) as { version: string };
  const oldVersion = packageJson.version;
  const newVersion = bumpSemver(oldVersion, kind);

  const buildGradleText = readFileSync(buildGradlePath, "utf8");
  const versionCodeMatch = /versionCode (\d+)/.exec(buildGradleText);
  const versionNameMatch = /versionName "([^"]+)"/.exec(buildGradleText);
  if (!versionCodeMatch || !versionNameMatch) {
    throw new Error(
      `Could not find versionCode/versionName in ${buildGradlePath}`,
    );
  }
  const oldVersionCode = Number(versionCodeMatch[1]);
  const newVersionCode = oldVersionCode + 1;

  console.log(`package.json version:        ${oldVersion} -> ${newVersion}`);
  console.log(`build.gradle versionName:    "${versionNameMatch[1]}" -> "${newVersion}"`);
  console.log(`build.gradle versionCode:     ${oldVersionCode} -> ${newVersionCode}`);

  if (dryRun) {
    console.log("(dry run — no files written)");
    return;
  }

  const newPackageJsonText = packageJsonText.replace(
    `"version": "${oldVersion}"`,
    `"version": "${newVersion}"`,
  );
  writeFileSync(packageJsonPath, newPackageJsonText);

  const newBuildGradleText = buildGradleText
    .replace(`versionCode ${oldVersionCode}`, `versionCode ${newVersionCode}`)
    .replace(`versionName "${versionNameMatch[1]}"`, `versionName "${newVersion}"`);
  writeFileSync(buildGradlePath, newBuildGradleText);

  console.log("Done. Review the diff, then commit as its own \"Bump version\" commit.");
}

main();
