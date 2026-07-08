# Feature specs — hub

Full design specs for the app's features, indexed by release status. CLAUDE.md
points here; README.md has a shorter user-facing summary of what's shipped.
"Version" here means the app's release semver (`package.json`/
`android/app/build.gradle`'s `versionName`) — a distinct concept from the two
internal DB-version numbers covered in [data-model.md](data-model.md).

- **[docs/features/current.md](features/current.md)** — what's built and
  shipped as of the current release.
- **[docs/features/next.md](features/next.md)** — what's actively being
  built for the next release. Links out to `docs/v1-roadmap/` and
  `docs/v1-tasks/` for execution detail rather than duplicating it.
- **[docs/features/planned.md](features/planned.md)** — fully specced but
  not yet scheduled for a release (the search-string builder, the
  auto-declutter engine).
- **[docs/features/history/](features/history/)** — snapshots of `current.md`
  from past releases.

At each `npm run version:bump`, snapshot `current.md` into `history/` before
updating it for the new release (see `history/README.md`).
