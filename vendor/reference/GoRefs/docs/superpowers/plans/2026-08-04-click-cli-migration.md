# Click CLI migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **This plan supersedes `2026-08-04-typer-cli-migration.md`'s original approach.**
> That plan (and a large amount of live conversation) explored migrating
> `go_refs.py`'s argparse CLI to Typer. Along the way, autocompletion (the
> primary reason Typer was under consideration) turned out to require a
> packaging change (a real `[project.scripts]` entry point) regardless of
> library choice — `uv run go_refs.py` isn't a registered command name, and
> completion registers against one. Separately, a dispatched CLI-design
> agent found, and this session independently re-verified from scratch
> twice, that Typer 0.27.1's `chain=True` (needed to run several subcommands
> in one invocation, e.g. `fetch build docs`) silently fails at runtime
> (`Got unexpected extra argument(s)`) even though it's accepted at
> app-construction time with no error — while the identical group/command
> structure under raw Click 8.4.2 chains correctly (verified: both printed
> all three outputs, exit 0, same scenario). Click also turned out to have
> support for several other patterns this project needs
> (`is_flag=False, flag_value=...` for optional-value options,
> `callback=` validation, `rich-click` for grouped/colorized help) that
> Typer's simplified wrapper doesn't fully expose. Decision: use `rich-click`
> (a drop-in, parameter-compatible Click wrapper adding Rich rendering and
> grouped help — not a different API to learn) directly, not Typer.

**Goal:** Replace `argparse` with a `rich-click`-based subcommand CLI, and turn GoRefs from "a script run via `uv run go_refs.py`" into a real installable package with a `gorefs` console-script entry point — required for shell autocompletion to work at all, which was the original motivation for this whole migration. The two existing CLI scripts (`go_refs.py`, `src/ingest_community_submissions.py`) become one unified `gorefs` command with subcommands; the second script is absorbed, not kept as a separate entry point.

**Architecture:** `go_refs.py` exposes a `click.group(chain=True, invoke_without_command=True)` named `cli`, decorated with `rich-click`'s grouping support, with one `@cli.command()` per verb. Handler function bodies (`run_fetching`, `run_freshness_check`, `run_doc_generation`, `run_deep_dive`, `run_source_coverage_test`, `run_paranoid_check_cli`, `run_web_server`, `ingest_submission_csv`) are not redesigned — each subcommand's body is a thin wrapper calling the existing handler, same as argparse's `main()` did. `pyproject.toml` gains `[build-system]` + `[project.scripts] gorefs = "go_refs:cli"` (verified: Click group objects are directly callable, same as `if __name__ == "__main__": cli()` already does) so `gorefs <verb>` replaces `uv run go_refs.py --flag` everywhere. The inline PEP 723 `# /// script ... ///` header in both files is deleted once packaging lands — it currently duplicates `pyproject.toml`'s dependency list and the two already disagree (inline lists `pytest` as a runtime dep, `pyproject.toml` doesn't); one source of truth after this.

**Tech Stack:** Python 3.11+, `rich-click` (Click 8.x + Rich rendering, added as a project dependency — no more inline PEP 723 per-script dependency blocks once packaging lands), `uv` with a real `[build-system]` (not bare-script mode), `pytest` + `click.testing.CliRunner` for testing.

## Global Constraints

- Handler function bodies are not modified — only how their inputs get parsed from the command line and how the CLI is packaged/invoked changes.
- Every subcommand below was arrived at through extended back-and-forth in conversation; the table in Task 2 is the single source of truth for the final shape — don't reintroduce flags/behavior from the old argparse or Typer-draft designs that aren't in that table.
- `chain=True` is used, but only because it's needed for `all` (kept as a real subcommand whose body directly calls the pipeline handlers in sequence — this never actually required `chain=True` either, since it's just normal function calls, not CLI-level chaining) and to allow *optional* ad-hoc multi-verb invocations (`gorefs fetch build`) if the user wants them. No command's own implementation depends on chaining being used — every subcommand also works correctly invoked alone.
- Source-key validation (`pull <source>`, `inspect <source>`) reads `config/sources.yml`'s actual keys at parse time via a `callback=`, not a static `Enum` — avoids duplicating the source-of-truth `sources.yml` already is (this project's own "do not duplicate sources of truth" invariant).
- No-args behavior: Click's default for a chained, `invoke_without_command=True` group is to do nothing special unless handled explicitly — this needs an explicit `ctx.exit(2)` in the group callback's no-subcommand branch, per the user's correction: printing help without exiting non-zero would falsely claim success for a run that did nothing. Every subcommand's own `--help` still exits 0, same as any command that successfully explains itself.
- `rich-click`'s `COMMAND_GROUPS` config groups the top-level `gorefs --help` listing into sections rather than one flat list of 12 verbs.

---

### Task 1: `uv init` as a real package + packaging

**Files:**
- Modify: `vendor/reference/GoRefs/pyproject.toml`
- Modify: `vendor/reference/GoRefs/go_refs.py:1-13` (delete the inline PEP 723 header)
- Modify: `vendor/reference/GoRefs/src/ingest_community_submissions.py:1-5` (delete the inline PEP 723 header — this file is deleted outright in Task 5, but its header shouldn't linger stale in the meantime if Task 5 runs later than expected)
- Test: none (packaging-only change, verified via `uv run gorefs --help` in Step 4)

**Interfaces:**
- Produces: a `gorefs` console-script command, installed into the project's `.venv`, invokable directly (`uv run gorefs ...` or, after `uv tool install -e .`, bare `gorefs ...`).

- [ ] **Step 1: Add a build backend**

In `vendor/reference/GoRefs/pyproject.toml`, add at the top (before `[project]`):

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- [ ] **Step 2: Add the console-script entry point and rich-click dependency**

In `vendor/reference/GoRefs/pyproject.toml`, add a new table after `[project]`'s fields:

```toml
[project.scripts]
gorefs = "go_refs:cli"
```

Add `"rich-click>=1.9.0"` to `dependencies`, and remove `"tqdm>=4.66.0"` (Task 7 replaces `tqdm` usage — removing the dependency now, before that task runs, is fine since nothing in this task's steps imports it; if executing tasks out of order, keep `tqdm` until Task 7 actually lands its replacement):

```toml
dependencies = [
    "duckdb>=1.0.0",
    "pandas>=2.0.0",
    "pydantic>=2.0.0",
    "pyyaml>=6.0",
    "requests>=2.31.0",
    "pytest>=8.0.0",
    "rich-click>=1.9.0",
]
```

- [ ] **Step 3: Sync and confirm the package installs**

Run: `cd vendor/reference/GoRefs && uv sync`
Expected: completes without error. This will fail if `go_refs.py` doesn't yet define a module-level `cli` object — if Task 2 hasn't landed yet, this step will fail with an import error citing `go_refs:cli`; that's expected and fine if executing tasks in order (Task 2 defines `cli`). If you hit this on a fresh checkout, do Task 2 first, then return here.

- [ ] **Step 4: Verify the entry point resolves**

Run: `cd vendor/reference/GoRefs && uv run gorefs --help`
Expected: rich-click's grouped help output, no traceback. (This step can't fully pass until Task 2 defines every subcommand — a partial/empty group listing here is fine at this point in the plan; a traceback is not.)

- [ ] **Step 5: Delete both files' inline PEP 723 headers**

In `vendor/reference/GoRefs/go_refs.py`, delete lines 1-13 (the `#!/usr/bin/env python3` shebang through the closing `# ///`) — `pyproject.toml` is now the single dependency source of truth. Keep the module docstring that follows.

In `vendor/reference/GoRefs/src/ingest_community_submissions.py`, delete its equivalent inline header (lines 1-5: `#!/usr/bin/env python3` / `# /// script` / `# requires-python = ">=3.11"` / `# dependencies = []` / `# ///`).

- [ ] **Step 6: Commit**

```bash
cd vendor/reference/GoRefs
git add pyproject.toml uv.lock go_refs.py src/ingest_community_submissions.py
git commit -m "Add build backend, gorefs console-script entry point, rich-click dependency"
```

---

### Task 2: Build the `gorefs` Click CLI in `go_refs.py`

**Files:**
- Modify: `vendor/reference/GoRefs/go_refs.py:21-29` (imports)
- Modify: `vendor/reference/GoRefs/go_refs.py:310-374` (replace `main()` and the `if __name__ == "__main__":` block)
- Test: `vendor/reference/GoRefs/tests/test_click_cli.py` (new)

**Interfaces:**
- Consumes: every `run_*` function already in `go_refs.py` (`run_fetching(config, force=False)`, `run_freshness_check(config)`, `run_doc_generation()`, `run_deep_dive(target="all")`, `run_source_coverage_test()`, `run_paranoid_check_cli(source=None)`, `run_web_server(port=8000)`), `load_config(config_path)`, `GoRefsMasterEngine`, `load_reference_json_shim`, and (until Task 5 absorbs it) `ingest_submission_csv(csv_path)` from `src/ingest_community_submissions.py`.
- Produces: `cli` (a module-level Click group instance, imported via `rich_click as click`) importable as `go_refs.cli` — this is the exact object `pyproject.toml`'s `[project.scripts]` entry (Task 1) points to, and what `tests/test_click_cli.py` and `tests/test_build_freshness.py` (Task 4) invoke via `CliRunner`.

## Final command table (source of truth for this task)

| Command | Args/Options | Description | Handler called |
|---|---|---|---|
| `gorefs fetch` | `--force` (bool flag, opt. — see Task 6) | Fetch all enabled sources | `run_fetching(config, force=force)` |
| `gorefs pull SOURCE` | positional, validated against `sources.yml` keys | Fetch one source | `run_fetching` on a config pre-filtered to just that source |
| `gorefs build` | — | Freshness check + build DB + Parquet export + regen docs | `run_freshness_check`, `GoRefsMasterEngine`, `run_doc_generation` (same sequence as today's `--build`) |
| `gorefs docs` | — | Regenerate docs only | `run_doc_generation()` |
| `gorefs test` | — | Coverage/precedence suite | `run_source_coverage_test()` |
| `gorefs paranoid` | — | Exhaustive dual-method field check, always all in-scope sources | `run_paranoid_check_cli(source=None)` — no source restriction, by design |
| `gorefs profile` | — | Profile every source into `config/source_templates/` | `run_deep_dive(target="all")` |
| `gorefs inspect SOURCE` | positional, validated | Profile one source | `run_deep_dive(target=source)` |
| `gorefs serve [PORT]` | optional positional, default `8000` | Start the local web explorer | `run_web_server(port=port)` |
| `gorefs all` | — | fetch + build + docs, in that fixed order | Calls `run_fetching`, `run_freshness_check`, `GoRefsMasterEngine`, `run_doc_generation` directly in sequence — same as today's `--all` branch, not via chaining |
| `gorefs shim` | — | Load `reference.json` into `refjson_*` tables | `load_reference_json_shim()` |
| `gorefs ingest CSV` | positional, `exists=True` | Ingest a community-submission CSV | `ingest_submission_csv(Path(csv))` (imported from `src.ingest_community_submissions` until Task 5 moves it directly into `go_refs.py`) |
| *(no args)* | — | Prints help, **exits 2** | Per the Global Constraints section above — not exit 0 |

Dropped entirely (do not re-add): `--config`, standalone `--port`, standalone `--source`.

- [ ] **Step 1: Replace the imports**

In `vendor/reference/GoRefs/go_refs.py`, replace line 23 (`import argparse`) with:

```python
import rich_click as click
```

(`rich_click` is designed to be imported as a drop-in replacement for `click` — every `click.X` API used below works identically, with Rich-rendered output.)

- [ ] **Step 2: Write the source-key validation callback**

Add this near the top of `go_refs.py`, after the existing imports and before `load_config()`:

```python
def _validate_source(ctx: click.Context, param: click.Parameter, value: str) -> str:
    config = load_config(Path("config/sources.yml"))
    known = set(config.get("sources", {}).keys())
    if value not in known:
        raise click.BadParameter(f"unknown source {value!r}, expected one of {sorted(known)}")
    return value
```

Verified pattern (structurally identical, tested against a scratch source list during planning): a `callback=` on a `click.argument(...)` receives `(ctx, param, value)` and either returns the (possibly transformed) value or raises `click.BadParameter(...)`, which Click turns into a clean CLI error before the command body ever runs.

- [ ] **Step 3: Write the `cli` group and the no-args exit-2 behavior**

Replace lines 310-369 of `go_refs.py` (from `def main() -> None:` through the end of its body) with:

```python
@click.group(chain=True, invoke_without_command=True)
@click.pass_context
def cli(ctx: click.Context) -> None:
    """Pokémon GO Open Reference Knowledge Base CLI (`gorefs`)."""
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())
        ctx.exit(2)
```

- [ ] **Step 4: Add the `fetch` and `pull` commands**

```python
@cli.command()
@click.option("--force", is_flag=True, default=False, help="Re-fetch regardless of local cache")
def fetch(force: bool) -> None:
    """Fetch all enabled sources."""
    config = load_config(Path("config/sources.yml"))
    run_fetching(config, force=force)


@cli.command()
@click.argument("source", callback=_validate_source)
def pull(source: str) -> None:
    """Fetch a single source."""
    config = load_config(Path("config/sources.yml"))
    single_source_config = {"sources": {source: config["sources"][source]}}
    run_fetching(single_source_config, force=False)
```

Note on `pull`: `run_fetching()` already loops over whatever's in `config["sources"]` — passing it a config dict pre-filtered to just the requested key is enough to fetch only that source, with zero changes to `run_fetching()`'s own body. This is the smallest change that satisfies "fetch one source" without touching handler logic, consistent with this plan's constraint.

- [ ] **Step 5: Add `build`, `docs`, `test`, `paranoid`**

```python
@cli.command()
def build() -> None:
    """Freshness-check, build the master DuckDB, export Parquet, regen docs."""
    config = load_config(Path("config/sources.yml"))
    run_freshness_check(config)
    engine = GoRefsMasterEngine(output_dir=Path("output"))
    engine.build()
    engine.export_parquet(db_path=engine.db_path, output_dir=Path("output"))
    run_doc_generation()


@cli.command()
def docs() -> None:
    """Regenerate docs only."""
    run_doc_generation()


@cli.command()
def test() -> None:
    """Run the source-by-source coverage/precedence suite."""
    run_source_coverage_test()


@cli.command()
def paranoid() -> None:
    """Run the exhaustive dual-method field-coverage check (always all in-scope sources)."""
    run_paranoid_check_cli(source=None)
```

- [ ] **Step 6: Add `profile`, `inspect`, `serve`, `shim`**

```python
@cli.command()
def profile() -> None:
    """Profile every source into config/source_templates/."""
    run_deep_dive(target="all")


@cli.command()
@click.argument("source", callback=_validate_source)
def inspect(source: str) -> None:
    """Profile a single source."""
    run_deep_dive(target=source)


@cli.command()
@click.argument("port", type=int, default=8000, required=False)
def serve(port: int) -> None:
    """Start the local web explorer (default port 8000)."""
    run_web_server(port=port)


@cli.command()
def shim() -> None:
    """Load data-authoring/reference_json_shim/reference.json into refjson_* tables."""
    row_counts = load_reference_json_shim()
    click.echo(f"Loaded {len(row_counts)} refjson_* tables into output/GoRefs_Master.duckdb:")
    for table_name, count in sorted(row_counts.items()):
        click.echo(f"  {table_name}: {count} rows")
```

- [ ] **Step 7: Add `all`**

```python
@cli.command()
def all() -> None:
    """Run fetch, build, and docs in sequence."""
    config = load_config(Path("config/sources.yml"))
    run_fetching(config, force=False)
    run_freshness_check(config)
    engine = GoRefsMasterEngine(output_dir=Path("output"))
    engine.build()
    engine.export_parquet(db_path=engine.db_path, output_dir=Path("output"))
    run_doc_generation()
```

Note: this shadows the Python builtin `all()` within `go_refs.py`'s module namespace — harmless here since nothing else in this file calls the builtin `all()`, but worth knowing if a future edit to this file needs the real one (use `builtins.all(...)` in that case).

- [ ] **Step 8: Add `ingest` (temporary import until Task 5 absorbs the file fully)**

```python
@cli.command()
@click.argument("csv", type=click.Path(exists=True))
def ingest(csv: str) -> None:
    """Ingest a community-submission CSV."""
    from src.ingest_community_submissions import ingest_submission_csv
    ingest_submission_csv(Path(csv))
```

- [ ] **Step 9: Update the `if __name__ == "__main__":` block**

Replace the old block with:

```python
if __name__ == "__main__":
    cli()
```

- [ ] **Step 10: Write the CLI test file**

Create `vendor/reference/GoRefs/tests/test_click_cli.py`:

```python
from pathlib import Path
from unittest.mock import patch

from click.testing import CliRunner

import go_refs

runner = CliRunner()


def test_no_args_exits_2_and_shows_help():
    result = runner.invoke(go_refs.cli, [])
    assert result.exit_code == 2
    assert "Usage" in result.output


def test_fetch_calls_run_fetching(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.cli, ["fetch"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once_with({"sources": {}}, force=False)


def test_fetch_force_flag(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.cli, ["fetch", "--force"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once_with({"sources": {}}, force=True)


def test_pull_unknown_source_rejected(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config:
        mock_load_config.return_value = {"sources": {"pokeapi": {}}}
        result = runner.invoke(go_refs.cli, ["pull", "not-a-real-source"])
    assert result.exit_code != 0


def test_pull_known_source_calls_run_fetching_scoped(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {"pokeapi": {"enabled": True}}}
        result = runner.invoke(go_refs.cli, ["pull", "pokeapi"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once_with({"sources": {"pokeapi": {"enabled": True}}}, force=False)


def test_serve_default_port(monkeypatch):
    with patch("go_refs.run_web_server") as mock_serve:
        result = runner.invoke(go_refs.cli, ["serve"])
    assert result.exit_code == 0
    mock_serve.assert_called_once_with(port=8000)


def test_serve_custom_port(monkeypatch):
    with patch("go_refs.run_web_server") as mock_serve:
        result = runner.invoke(go_refs.cli, ["serve", "8080"])
    assert result.exit_code == 0
    mock_serve.assert_called_once_with(port=8080)


def test_inspect_calls_run_deep_dive_with_source(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_deep_dive") as mock_deep_dive:
        mock_load_config.return_value = {"sources": {"pokeapi": {}}}
        result = runner.invoke(go_refs.cli, ["inspect", "pokeapi"])
    assert result.exit_code == 0
    mock_deep_dive.assert_called_once_with(target="pokeapi")


def test_profile_calls_run_deep_dive_with_all():
    with patch("go_refs.run_deep_dive") as mock_deep_dive:
        result = runner.invoke(go_refs.cli, ["profile"])
    assert result.exit_code == 0
    mock_deep_dive.assert_called_once_with(target="all")


def test_paranoid_never_takes_a_source():
    with patch("go_refs.run_paranoid_check_cli") as mock_paranoid:
        result = runner.invoke(go_refs.cli, ["paranoid"])
    assert result.exit_code == 0
    mock_paranoid.assert_called_once_with(source=None)


def test_chained_fetch_and_docs_both_run(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch, \
         patch("go_refs.run_doc_generation") as mock_docs:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.cli, ["fetch", "docs"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once()
    mock_docs.assert_called_once()
```

- [ ] **Step 11: Run the test suite to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_click_cli.py -v`
Expected: all 11 tests PASS. If `test_chained_fetch_and_docs_both_run` fails, that's the one test in this file directly re-confirming the core premise of this whole plan (Click's chaining working where Typer's didn't) — don't treat a failure there as "probably fine," debug it fully before proceeding.

- [ ] **Step 12: Manually verify the CLI end-to-end**

```bash
cd vendor/reference/GoRefs
uv run python3 go_refs.py --help
uv run python3 go_refs.py
echo "exit code: $?"   # expect 2
uv run python3 go_refs.py pull not-a-real-source
echo "exit code: $?"   # expect non-zero
uv run python3 go_refs.py serve --help
```

Expected: grouped help output, exit code 2 for no-args, a clean rejection (not a traceback) for the invalid `pull` target, and `serve`'s own help text showing its optional `PORT` argument.

- [ ] **Step 13: Commit**

```bash
cd vendor/reference/GoRefs
git add go_refs.py tests/test_click_cli.py
git commit -m "Build the gorefs Click CLI: subcommands, validation, chaining"
```

---

### Task 3: `rich-click` command grouping for `--help`

**Files:**
- Modify: `vendor/reference/GoRefs/go_refs.py` (add `rich-click` config near the top, after imports)

**Interfaces:** none new — this only affects how `gorefs --help` renders, not any command's behavior.

- [ ] **Step 1: Add command groups**

After the imports in `go_refs.py` (before `cli`'s definition), add:

```python
click.rich_click.COMMAND_GROUPS = {
    "go_refs.py": [
        {
            "name": "Pipeline",
            "commands": ["fetch", "pull", "build", "docs", "all"],
        },
        {
            "name": "Diagnostics",
            "commands": ["test", "paranoid", "profile", "inspect"],
        },
        {
            "name": "Other",
            "commands": ["serve", "shim", "ingest"],
        },
    ],
}
```

The key (`"go_refs.py"`) must match the invoked program name exactly — verify this against `rich-click`'s own docs for how it resolves the key when installed as a console script (`gorefs`) versus run directly (`go_refs.py`); this may need to be `"gorefs"` instead, or both, once Task 1's console-script entry point is the primary invocation path. Confirm empirically in Step 2 rather than assuming.

- [ ] **Step 2: Verify the grouping actually renders**

Run: `cd vendor/reference/GoRefs && uv run gorefs --help`
Expected: three headed sections ("Pipeline", "Diagnostics", "Other") instead of one flat alphabetical command list. If commands still show ungrouped, the dictionary key in Step 1 doesn't match what `rich-click` is resolving as the program name — check `rich-click`'s current documentation for the correct key (varies by how the program was invoked/installed) rather than guessing further variations.

- [ ] **Step 3: Commit**

```bash
cd vendor/reference/GoRefs
git add go_refs.py
git commit -m "Group gorefs --help output via rich-click COMMAND_GROUPS"
```

---

### Task 4: Update `tests/test_build_freshness.py` for the Click CLI

**Files:**
- Modify: `vendor/reference/GoRefs/tests/test_build_freshness.py`

**Interfaces:**
- Consumes: `go_refs.cli` (from Task 2), `click.testing.CliRunner`.

This test currently calls `go_refs.main()` directly with `sys.argv` patched — `main` no longer exists after Task 2 (replaced by the `cli` group and its subcommands). Needs to invoke through `CliRunner` against the `build` subcommand instead.

- [ ] **Step 1: Rewrite the test**

Replace the full contents of `vendor/reference/GoRefs/tests/test_build_freshness.py`:

```python
from unittest.mock import patch
from click.testing import CliRunner

import go_refs

runner = CliRunner()


def test_build_calls_freshness_check(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "output").mkdir()
    with patch("go_refs.run_freshness_check") as mock_check, \
         patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.GoRefsMasterEngine") as mock_engine_cls, \
         patch("go_refs.run_doc_generation"):
        mock_load_config.return_value = {"sources": {}}
        mock_engine_cls.return_value.build.return_value = {}
        mock_engine_cls.return_value.db_path = tmp_path / "output" / "GoRefs_Master.duckdb"
        mock_engine_cls.return_value.export_parquet.return_value = []
        result = runner.invoke(go_refs.cli, ["build"])
        assert result.exit_code == 0
        mock_check.assert_called_once()
```

Note the test name drops "even_without_fetch_flag" — that phrase described argparse's `--build` running the freshness check regardless of whether `--fetch` was *also* passed in the same invocation. Under subcommands, `build` is its own command; there's no equivalent "was another flag also set" question to describe, since `gorefs build` never takes a `--fetch`-shaped companion. The underlying property being tested (the freshness check always runs as part of a build) is preserved, just re-described accurately for the new shape.

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_build_freshness.py -v`
Expected: PASS. If it fails, run with `-s` and inspect `result.exception`/`result.output` (`CliRunner` captures exceptions into `result.exception` rather than letting them propagate) before guessing at the cause.

- [ ] **Step 3: Run the full test suite for regressions**

Run: `cd vendor/reference/GoRefs && uv run pytest -v`
Expected: same pass/fail counts as before this plan started, for every file other than the ones this plan explicitly touches. Investigate any new failure fully before assuming it's unrelated.

- [ ] **Step 4: Commit**

```bash
cd vendor/reference/GoRefs
git add tests/test_build_freshness.py
git commit -m "Update test_build_freshness.py for the Click CliRunner invocation pattern"
```

---

### Task 5: Absorb `src/ingest_community_submissions.py` fully into `gorefs ingest`

**Files:**
- Modify: `vendor/reference/GoRefs/go_refs.py` (move `ingest_submission_csv` in, remove the deferred import from Task 2 Step 8)
- Delete: `vendor/reference/GoRefs/src/ingest_community_submissions.py`
- Test: `vendor/reference/GoRefs/tests/test_ingest_cli.py` (new)

**Interfaces:**
- Produces: `ingest_submission_csv(csv_path: Path) -> None` now lives directly in `go_refs.py`, called by the `ingest` command already defined in Task 2 Step 8 (that step's deferred `from src.ingest_community_submissions import ingest_submission_csv` import gets removed once the function moves).

- [ ] **Step 1: Check for existing references to the old module**

Run: `grep -rn "ingest_community_submissions" vendor/reference/GoRefs --include="*.py" --include="*.md"`
Read every result before proceeding — confirm at execution time that no other file depends on this module's path.

- [ ] **Step 2: Move `ingest_submission_csv` into `go_refs.py`**

Read the full current contents of `vendor/reference/GoRefs/src/ingest_community_submissions.py` (its `ingest_submission_csv` function body, and its imports — `json`, `csv`, `pathlib.Path`, and a `DATA_AUTHORING_DIR` constant, based on the version read during planning; confirm against the real file rather than this summary). Move that function (and any module-level constants/imports it needs that aren't already in `go_refs.py`) directly into `go_refs.py`, placed near the other handler functions (e.g. after `run_paranoid_check_cli`).

- [ ] **Step 3: Update the `ingest` command to call it directly**

In `go_refs.py`'s `ingest` command (added in Task 2 Step 8), remove the deferred import and call the now-local function directly:

```python
@cli.command()
@click.argument("csv", type=click.Path(exists=True))
def ingest(csv: str) -> None:
    """Ingest a community-submission CSV."""
    ingest_submission_csv(Path(csv))
```

- [ ] **Step 4: Delete the old file**

```bash
git rm vendor/reference/GoRefs/src/ingest_community_submissions.py
```

- [ ] **Step 5: Write the CLI test**

Create `vendor/reference/GoRefs/tests/test_ingest_cli.py`:

```python
from pathlib import Path
from unittest.mock import patch

from click.testing import CliRunner

import go_refs

runner = CliRunner()


def test_ingest_calls_ingest_submission_csv(tmp_path):
    csv_path = tmp_path / "submissions.csv"
    csv_path.write_text("pokemon_name,attribute,value\n")
    with patch("go_refs.ingest_submission_csv") as mock_ingest:
        result = runner.invoke(go_refs.cli, ["ingest", str(csv_path)])
    assert result.exit_code == 0
    mock_ingest.assert_called_once_with(Path(str(csv_path)))


def test_ingest_missing_file_rejected(tmp_path):
    missing = tmp_path / "does-not-exist.csv"
    result = runner.invoke(go_refs.cli, ["ingest", str(missing)])
    assert result.exit_code != 0
```

- [ ] **Step 6: Run the tests**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_ingest_cli.py -v`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
cd vendor/reference/GoRefs
git add go_refs.py tests/test_ingest_cli.py
git rm -f vendor/reference/GoRefs/src/ingest_community_submissions.py 2>/dev/null || true
git commit -m "Absorb ingest_community_submissions.py into the unified gorefs CLI"
```

---

### Task 6: `--force` is new — confirm with the user before or during execution

**Files:** none (this task is a checkpoint, not code).

Task 2 Step 4 adds `gorefs fetch --force`, wiring up `run_fetching(force=...)` — a parameter that already exists on the handler but was never reachable from the old argparse CLI. This is a genuinely new capability, not a straight port, proposed during the design-review agent's analysis without a dedicated round of explicit sign-off. Before or during execution of Task 2, confirm this is wanted; if not, delete the `--force` option from `fetch`'s definition and drop `test_fetch_force_flag` from Task 2 Step 10's test file.

- [ ] **Step 1: Confirm `--force` is wanted (or remove it)**

---

### Task 7: Replace `tqdm` with `rich.progress.Progress` in `src/paranoid_check.py`

**Files:**
- Modify: `vendor/reference/GoRefs/src/paranoid_check.py:292` (import), `:325`, `:339` (the two loop sites)
- Test: check for an existing paranoid-check test file first (see Step 1)

**Interfaces:**
- Consumes: `rich.progress.Progress` (available transitively — `rich-click` depends on `rich`, so no new direct dependency should be needed; confirm this with `uv run python3 -c "import rich.progress"` in Step 2 before assuming it's importable).
- Produces: no interface change — `run_paranoid_check()`'s signature and return shape are untouched.

Using `rich.progress.Progress` rather than `click.progressbar()` specifically because it supports two genuinely simultaneous, independently-updating bars (a persistent outer "Sources" bar plus a transient inner "N endpoints" bar that clears per source) — this matches `tqdm`'s current `leave=False` nested behavior more closely than Click's simpler sequential-only `progressbar()` context manager can.

- [ ] **Step 1: Check for existing paranoid_check tests**

Run: `find vendor/reference/GoRefs/tests -iname "*paranoid*"`
Read any result fully before writing Step 5's test — don't duplicate existing assertions.

- [ ] **Step 2: Confirm `rich.progress` is importable**

Run: `cd vendor/reference/GoRefs && uv run python3 -c "import rich.progress; print(rich.progress.Progress)"`
Expected: prints the class, no `ModuleNotFoundError`. If this fails, add `"rich>=13.0"` explicitly to `pyproject.toml`'s `dependencies` rather than relying on the transitive dependency — don't skip this check and assume.

- [ ] **Step 3: Replace the import and both loop sites**

Replace line 292 of `vendor/reference/GoRefs/src/paranoid_check.py`:

```python
from tqdm import tqdm
```

with:

```python
from rich.progress import Progress
```

Read the exact current code first (`sed -n '320,355p' vendor/reference/GoRefs/src/paranoid_check.py` — line numbers may have shifted if earlier tasks touched this area, which they shouldn't have, but confirm), then replace the outer loop (originally `for source_key in tqdm(target_sources, desc="Sources"):`) and inner loop (originally `for data_file in tqdm(raw_files, desc=f"{source_key} endpoints", leave=False):`) with:

```python
    with Progress() as progress:
        sources_task = progress.add_task("Sources", total=len(target_sources))
        for source_key in target_sources:
            templates = find_templates_for_source(source_key, templates_dir)
            mapped_by_endpoint = mapped_source_fields(templates)
            canonical_attrs = canonical_attribute_names(db_path)
            claims_attrs = claims_ledger_attributes(db_path, source_key)

            raw_files = find_raw_files_for_source(source_key, raw_dumps_dir)
            endpoints_report: Dict[str, Dict[str, List[str]]] = {}
            untemplated_endpoints: List[str] = []
            method_mismatches: Dict[str, List[str]] = {}
            duckdb_parse_failures: List[str] = []
            collapsed_type_paths: Dict[str, List[str]] = {}
            counts = {"CANONICAL": 0, "CLAIMS_ONLY": 0, "MISSING": 0}

            endpoints_task = progress.add_task(f"{source_key} endpoints", total=len(raw_files))
            for data_file in raw_files:
                endpoint = data_file.stem
                mapped_fields = mapped_by_endpoint.get(endpoint, set())
                if endpoint not in mapped_by_endpoint:
                    untemplated_endpoints.append(endpoint)

                python_fields = extract_fields_python_walk(data_file)
                duckdb_fields, collapsed_paths = extract_fields_duckdb_auto(data_file)

                classification = classify_endpoint_fields(
                    endpoint, python_fields, mapped_fields, canonical_attrs, claims_attrs
                )
                endpoints_report[endpoint] = classification
                for tier, fields in classification.items():
                    counts[tier] += len(fields)
                progress.advance(endpoints_task)
            progress.remove_task(endpoints_task)
            progress.advance(sources_task)
```

This is a reindented, `Progress`-driven version of the exact same loop body the original code has — the business logic inside is unchanged, only the progress-bar mechanics around it. `progress.remove_task(endpoints_task)` after each source's inner loop is what gives the "transient, clears when done" behavior `tqdm`'s `leave=False` had. Whatever code originally followed this loop (assembling `endpoints_report` etc. into the function's return value) stays exactly where it was, just at the loop's original indentation level relative to the `for source_key in target_sources:` line — read the full original function body (not just the loop) before editing, so that trailing code isn't lost.

- [ ] **Step 4: Verify the file compiles and imports**

Run: `cd vendor/reference/GoRefs && uv run python3 -m py_compile src/paranoid_check.py && uv run python3 -c "import src.paranoid_check"`
Expected: no output, no traceback.

- [ ] **Step 5: Run existing paranoid-check tests (or skip adding new ones if none exist)**

Run: `cd vendor/reference/GoRefs && uv run pytest -v -k paranoid`
Expected: same results as before this task. Per this project's rapid-development posture, don't add net-new test coverage for previously-untested logic — this task's scope is the progress-display layer only.

- [ ] **Step 6: Commit**

```bash
cd vendor/reference/GoRefs
git add src/paranoid_check.py
git commit -m "Replace tqdm with rich.progress.Progress in paranoid_check.py"
```

---

### Task 8: Rewrite `README.md`'s CLI section

**Files:**
- Modify: `vendor/reference/GoRefs/README.md` (roughly lines 70-100, per planning-time read — confirm exact range at execution time)

**Interfaces:** none (documentation-only).

Every example in this section currently shows `uv run go_refs.py --flag`. All of it needs rewriting to the `gorefs <verb>` form, not just the `--config`/`--port` lines — the invocation style itself changed, not just two flags.

- [ ] **Step 1: Read the current section in full**

Run: `sed -n '1,120p' vendor/reference/GoRefs/README.md`
Identify the exact current boundaries of the CLI-usage section before editing.

- [ ] **Step 2: Rewrite each example**

For each `uv run go_refs.py --X [args]` example, replace with the equivalent `gorefs <verb> [args]` form from Task 2's command table (e.g. `uv run go_refs.py --serve --port 8080` becomes `uv run gorefs serve 8080`, or bare `gorefs serve 8080` if the README is being updated to assume the package is installed rather than always invoked via `uv run` — pick whichever framing matches how the rest of the README already describes running this project, and stay consistent with it).

- [ ] **Step 3: Commit**

```bash
cd vendor/reference/GoRefs
git add README.md
git commit -m "Rewrite README CLI section for the gorefs Click command"
```

---

### Task 9: Full regression pass

**Files:**
- Modify: `vendor/reference/GoRefs/docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md` (one-line addendum)

**Interfaces:** none (verification + documentation task).

- [ ] **Step 1: Run the entire test suite**

Run: `cd vendor/reference/GoRefs && uv run pytest -v`
Expected: no failures beyond any pre-existing failures documented in `KNOWN_ISSUES.md` before this plan started — check that file if anything unexpected fails.

- [ ] **Step 2: Smoke-test every subcommand's `--help`**

```bash
cd vendor/reference/GoRefs
for cmd in fetch pull build docs test paranoid profile inspect serve all shim ingest; do
  echo "=== $cmd ==="
  uv run gorefs "$cmd" --help || echo "FAILED: $cmd"
done
```

Expected: all twelve print help text with no `FAILED` lines.

- [ ] **Step 3: Add the addendum to the paused fetch-verification spec**

In `vendor/reference/GoRefs/docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md`, at the end of its "## Open items for the implementation plan" section, add:

```markdown
- CLI layer is now a rich-click-based `gorefs` command with subcommands
  (see `docs/superpowers/plans/2026-08-04-click-cli-migration.md`, landed
  ahead of this spec's implementation) — `--reexplore`, `--no-report`,
  and any other new behavior this spec introduces should be added as new
  subcommands or options on existing ones, following the pattern in
  `go_refs.py`'s `cli` group.
```

- [ ] **Step 4: Commit**

```bash
cd vendor/reference/GoRefs
git add docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md
git commit -m "Note Click CLI migration landed, for when fetch-verification work resumes"
```
