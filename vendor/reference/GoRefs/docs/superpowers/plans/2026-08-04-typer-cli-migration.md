# Typer CLI migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `argparse` with Typer as the CLI parsing layer in GoRefs' two argparse-based entry points (`go_refs.py`, `src/ingest_community_submissions.py`), with every existing flag's underlying behavior (handler function bodies) left untouched — this is a declaration-layer swap, not a logic change — done first, ahead of the (separately specced, currently paused) fetch-verification-pipeline work, so that project's new flags (`--reexplore`, `--no-report`, etc.) get built as native Typer options from the start instead of being written twice.

**Architecture:** Each file's `argparse.ArgumentParser` + `parser.add_argument(...)` block is replaced with a `typer.Typer(add_completion=False)` app and a single `@app.command()`-decorated function whose parameters (with `Annotated[...,  typer.Option(...)]` type hints) declare the same flags, short names included where requested. Every flag keeps its existing long name (`--fetch`, `--build`, etc.) and default value. The one behavior change, agreed with the user after empirically verifying Typer 0.27.1 has no supported mechanism for "flag present with no attached value defaults to X" (Typer's own skill doc: `is_flag`/`flag_value` "shouldn't be used anymore"): `--deep-dive` now requires an explicit value whenever it's passed (`--deep-dive all` / `--deep-dive pokeapi`) instead of accepting a bare `--deep-dive` defaulting to `"all"`.

**Tech Stack:** Python 3.11+, `typer` (added as a project + inline-script dependency), `uv` for environment/dependency management, `pytest` + Typer's `typer.testing.CliRunner` for testing.

## Global Constraints

- Every existing flag's long name, default value, and help text meaning must be preserved exactly, with the one documented exception: `--deep-dive` no longer accepts a bare/valueless form.
- Handler function bodies (`run_fetching`, `run_freshness_check`, `run_doc_generation`, `run_deep_dive`, `run_source_coverage_test`, `run_paranoid_check_cli`, `run_web_server`, `ingest_submission_csv`) are not modified by this plan — only how their inputs get parsed from the command line changes.
- `typer` must be added to both `pyproject.toml`'s `dependencies` and each script's inline PEP 723 `# /// script ... dependencies = [...] ///` header block (both files are also run standalone via `uv run <file>.py`, which resolves deps from that inline block, not `pyproject.toml`).
- Add short-name aliases for flags where they don't already conflict with another flag's short form (see Task 2 for the exact mapping) — the user asked for these to be declared.
- No behavior/output-format change to any handler function — this plan is CLI-declaration-only.

---

### Task 1: Add `typer` as a dependency

**Files:**
- Modify: `vendor/reference/GoRefs/pyproject.toml`
- Modify: `vendor/reference/GoRefs/go_refs.py:1-13` (inline script header)
- Modify: `vendor/reference/GoRefs/src/ingest_community_submissions.py:1-5` (inline script header)
- Test: none (dependency-only change, verified by import in later tasks)

**Interfaces:**
- Produces: `typer` importable in the `uv`-managed `.venv` for both `pyproject.toml`-based test runs (`uv run pytest`) and standalone script runs (`uv run go_refs.py ...`, `uv run src/ingest_community_submissions.py ...`).

- [ ] **Step 1: Add typer to `pyproject.toml`**

In `vendor/reference/GoRefs/pyproject.toml`, add `"typer>=0.27.0"` to the `dependencies` list (alongside `duckdb`, `pandas`, etc.):

```toml
dependencies = [
    "duckdb>=1.0.0",
    "pandas>=2.0.0",
    "pydantic>=2.0.0",
    "pyyaml>=6.0",
    "requests>=2.31.0",
    "tqdm>=4.66.0",
    "pytest>=8.0.0",
    "typer>=0.27.0",
]
```

- [ ] **Step 2: Add typer to `go_refs.py`'s inline script header**

In `vendor/reference/GoRefs/go_refs.py`, lines 2-13, add `"typer>=0.27.0"` to the inline `dependencies` list:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "duckdb>=1.0.0",
#     "pandas>=2.0.0",
#     "pydantic>=2.0.0",
#     "pyyaml>=6.0",
#     "requests>=2.31.0",
#     "pytest>=8.0.0",
#     "tqdm>=4.66.0",
#     "typer>=0.27.0",
# ]
# ///
```

- [ ] **Step 3: Add typer to `src/ingest_community_submissions.py`'s inline script header**

In `vendor/reference/GoRefs/src/ingest_community_submissions.py`, lines 2-4, currently `dependencies = []`:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["typer>=0.27.0"]
# ///
```

- [ ] **Step 4: Sync the environment and verify the import**

Run: `cd vendor/reference/GoRefs && uv sync`
Expected: completes without error.

Run: `cd vendor/reference/GoRefs && uv run python3 -c "import typer; print(typer.__version__)"`
Expected: prints a version string (`0.27.x` or later), no `ModuleNotFoundError`.

- [ ] **Step 5: Commit**

```bash
cd vendor/reference/GoRefs
git add pyproject.toml uv.lock go_refs.py src/ingest_community_submissions.py
git commit -m "Add typer dependency ahead of CLI migration"
```

---

### Task 2: Migrate `go_refs.py`'s CLI to Typer

**Files:**
- Modify: `vendor/reference/GoRefs/go_refs.py:21-29` (imports)
- Modify: `vendor/reference/GoRefs/go_refs.py:310-374` (`main()` and the `if __name__ == "__main__":` block)
- Test: `vendor/reference/GoRefs/tests/test_typer_cli.py` (new)

**Interfaces:**
- Consumes: every `run_*` function already defined earlier in `go_refs.py` (`run_fetching(config, force=False)`, `run_freshness_check(config)`, `run_doc_generation()`, `run_deep_dive(target="all")`, `run_source_coverage_test()`, `run_paranoid_check_cli(source=None)`, `run_web_server(port=8000)`), plus `load_config(config_path)`, `GoRefsMasterEngine`, `load_reference_json_shim` — all unchanged, called exactly as today.
- Produces: `app` (a module-level `typer.Typer` instance) importable as `go_refs.app`, for use by `tests/test_typer_cli.py` and by Task 3's update to `tests/test_build_freshness.py`. The Typer-decorated command function itself is renamed from `main` to `_run` (still callable directly as a plain function taking keyword arguments, but no longer the thing `if __name__ == "__main__":` invokes — that now calls `app()`).

**Flag mapping** (long name unchanged for all; short names added per the user's request, skipping any that would collide):

| Old argparse flag | New Typer param | Short name | Type | Default |
|---|---|---|---|---|
| `--fetch` | `fetch` | `-f` | `bool` | `False` |
| `--build` | `build` | `-b` | `bool` | `False` |
| `--docs` | `docs` | `-d` | `bool` | `False` |
| `--test` | `test` | `-t` | `bool` | `False` |
| `--serve` | `serve` | `-s` | `bool` | `False` |
| `--all` | `all_` | `-a` | `bool` | `False` |
| `--port` | `port` | `-p` | `int` | `8000` |
| `--config` | `config` | `-c` | `str` | `"config/sources.yml"` |
| `--deep-dive` | `deep_dive` | none (`-d` taken by `--docs`) | `Optional[str]` | `None` |
| `--test-paranoid` | `test_paranoid` | none (`-t` taken by `--test`) | `bool` | `False` |
| `--source` | `source` | none (`-s` taken by `--serve`) | `Optional[str]` | `None` |
| `--load-reference-shim` | `load_reference_shim` | none (no obvious free letter, avoid collision) | `bool` | `False` |

- [ ] **Step 1: Replace the imports**

In `vendor/reference/GoRefs/go_refs.py`, replace line 23 (`import argparse`) with:

```python
import typer
from typing import Optional
```

(line 29 already has `from typing import Optional` — remove the duplicate, keep one `Optional` import combined with `typer`.)

- [ ] **Step 2: Write the CLI test (before the implementation exists)**

Create `vendor/reference/GoRefs/tests/test_typer_cli.py`:

```python
from unittest.mock import patch
from typer.testing import CliRunner

import go_refs

runner = CliRunner()


def test_no_flags_prints_usage_and_exits_zero(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, [])
    assert result.exit_code == 0
    assert "No action specified" in result.stdout


def test_fetch_flag_calls_run_fetching(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--fetch"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once()


def test_fetch_short_flag_calls_run_fetching(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["-f"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once()


def test_deep_dive_requires_explicit_value():
    result = runner.invoke(go_refs.app, ["--deep-dive"])
    assert result.exit_code != 0


def test_deep_dive_with_value_calls_run_deep_dive(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_deep_dive") as mock_deep_dive:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--deep-dive", "pokeapi"])
    assert result.exit_code == 0
    mock_deep_dive.assert_called_once_with(target="pokeapi")


def test_deep_dive_omitted_does_not_call_run_deep_dive(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching"), \
         patch("go_refs.run_deep_dive") as mock_deep_dive:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--fetch"])
    assert result.exit_code == 0
    mock_deep_dive.assert_not_called()
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_typer_cli.py -v`
Expected: FAIL — `go_refs` still has `main`, not `app`/`_run`, so every test errors with `AttributeError: module 'go_refs' has no attribute 'app'` (or an `ImportError` if the module fails to import at all, depending on what's on line 23 at this point). This confirms the test is actually exercising code that doesn't exist yet.

- [ ] **Step 4: Replace `main()` with the Typer app + `_run` command**

Replace lines 310-369 (from `def main() -> None:` through the end of the function body, i.e. everything up to but not including the `if __name__ == "__main__":` line) with:

```python
app = typer.Typer(add_completion=False)


@app.command()
def _run(
    fetch: bool = typer.Option(False, "--fetch", "-f", help="Fetch fresh raw snapshots from all upstream sources"),
    build: bool = typer.Option(False, "--build", "-b", help="Build master DuckDB database (output/GoRefs_Master.duckdb) using GoRefsMasterEngine"),
    docs: bool = typer.Option(False, "--docs", "-d", help="Generate docstring documentation in docs/ using scripts/generate_docs.py"),
    test: bool = typer.Option(False, "--test", "-t", help="Run source-by-source data coverage & precedence test suite (lowest to highest priority)"),
    serve: bool = typer.Option(False, "--serve", "-s", help="Start local web server hosting single-page explorer & master database"),
    all_: bool = typer.Option(False, "--all", "-a", help="Execute all pipeline stages (fetch, build, and docs)"),
    port: int = typer.Option(8000, "--port", "-p", help="Port for local web server (default: 8000)"),
    config: str = typer.Option("config/sources.yml", "--config", "-c", help="Path to sources.yml configuration file (default: config/sources.yml)"),
    deep_dive: Optional[str] = typer.Option(None, "--deep-dive", help="Run schema profiler to generate/update source templates (pass 'all' or a single source_key; the flag requires an explicit value)"),
    test_paranoid: bool = typer.Option(False, "--test-paranoid", help="Run the slow, exhaustive dual-method field-coverage check (never part of --build/--test; local_authoring excluded)"),
    source: Optional[str] = typer.Option(None, "--source", help="Restrict --test-paranoid to a single source_key (default: all in-scope sources)"),
    load_reference_shim: bool = typer.Option(False, "--load-reference-shim", help="Wholesale-load data-authoring/reference_json_shim/reference.json into refjson_* tables in output/GoRefs_Master.duckdb (temporary stopgap, never overrides canonical tables)"),
) -> None:
    """
    Master CLI entrypoint for Pokémon GO Reference Knowledge Base (`go_refs.py`).

    Parses command-line arguments (--fetch, --build, --serve, --docs, --all, --port, --config)
    and dispatches pipeline stages sequentially.
    """
    config_obj = load_config(Path(config))

    if not any([fetch, build, docs, test, serve, all_, deep_dive, test_paranoid, load_reference_shim]):
        print("No action specified. Usage: uv run go_refs.py [--fetch] [--build] [--docs] [--test] [--serve] [--all] [--deep-dive SOURCE] [--test-paranoid] [--source SOURCE_KEY] [--load-reference-shim] [--port PORT] [--config PATH]")
        raise typer.Exit(code=0)

    if all_ or fetch:
        run_fetching(config_obj)

    if all_ or build:
        run_freshness_check(config_obj)
        engine = GoRefsMasterEngine(output_dir=Path("output"))
        engine.build()
        engine.export_parquet(db_path=engine.db_path, output_dir=Path("output"))
        run_doc_generation()

    elif docs:
        run_doc_generation()

    if test:
        run_source_coverage_test()

    if deep_dive:
        run_deep_dive(target=deep_dive)

    if test_paranoid:
        run_paranoid_check_cli(source=source)

    if load_reference_shim:
        row_counts = load_reference_json_shim()
        print(f"Loaded {len(row_counts)} refjson_* tables into output/GoRefs_Master.duckdb:")
        for table_name, count in sorted(row_counts.items()):
            print(f"  {table_name}: {count} rows")

    if serve:
        run_web_server(port=port)
```

This is a direct port of the old `main()` body: every `args.X` reference becomes the matching parameter name (`args.all` → `all_`, since `all` is a Python builtin and the old code already avoided shadowing it via `args.all`/no local var — the new code uses `all_` as the parameter name to avoid shadowing `all()`), `args.config` becomes `config`, etc. `sys.exit(0)` becomes `raise typer.Exit(code=0)` (Typer's own exit mechanism — behaves identically for a top-level command: prints nothing extra, exits 0).

- [ ] **Step 5: Update the `if __name__ == "__main__":` block**

Replace lines 372-373:

```python
if __name__ == "__main__":
    main()
```

with:

```python
if __name__ == "__main__":
    app()
```

- [ ] **Step 6: Remove the now-unused `sys` import if nothing else uses it**

Check: `grep -n "sys\." vendor/reference/GoRefs/go_refs.py`
If the only remaining reference was the removed `sys.exit(0)` and `sys.path.insert(...)` on line 32, keep the import (line 32 still needs it) — do not remove `import sys` (line 21), only confirm no dangling unused import was introduced.

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_typer_cli.py -v`
Expected: all 6 tests PASS (this is the green state — the same test file from Step 2, unchanged, now passing against the real implementation from Steps 4-6).

- [ ] **Step 8: Manually verify the CLI end-to-end**

Run: `cd vendor/reference/GoRefs && uv run go_refs.py --help`
Expected: Typer's auto-generated help output lists all 12 options with their help text, no traceback.

Run: `cd vendor/reference/GoRefs && uv run go_refs.py`
Expected: prints the "No action specified..." usage line, exits 0.

Run: `cd vendor/reference/GoRefs && uv run go_refs.py --deep-dive`
Expected: Typer error "Option '--deep-dive' requires an argument.", non-zero exit — this is the one accepted behavior change, confirm it matches expectation rather than treating it as a bug.

- [ ] **Step 9: Commit**

```bash
cd vendor/reference/GoRefs
git add go_refs.py tests/test_typer_cli.py
git commit -m "Migrate go_refs.py CLI from argparse to Typer"
```

---

### Task 3: Update `tests/test_build_freshness.py` for the Typer app

**Files:**
- Modify: `vendor/reference/GoRefs/tests/test_build_freshness.py`

**Interfaces:**
- Consumes: `go_refs.app` (from Task 2), `typer.testing.CliRunner`.

**Problem:** this test currently calls `go_refs.main()` directly with `sys.argv` patched to `["go_refs.py", "--build"]` — after Task 2, `main` no longer exists as a zero-argument, sys.argv-reading function (Typer's command function takes real Python parameters and doesn't re-parse `sys.argv` when called directly). It must invoke through `CliRunner` instead, matching the pattern established in Task 2's `test_typer_cli.py`.

- [ ] **Step 1: Rewrite the test**

Replace the full contents of `vendor/reference/GoRefs/tests/test_build_freshness.py`:

```python
from unittest.mock import patch
from typer.testing import CliRunner

import go_refs

runner = CliRunner()


def test_build_calls_freshness_check_even_without_fetch_flag(monkeypatch, tmp_path):
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
        result = runner.invoke(go_refs.app, ["--build"])
        assert result.exit_code == 0
        mock_check.assert_called_once()
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_build_freshness.py -v`
Expected: PASS. If it fails with an exception from inside the Typer command, run with `-s` and inspect `result.exception`/`result.output` (CliRunner swallows tracebacks into `result.exception` by default) to debug rather than guessing.

- [ ] **Step 3: Run the full existing test suite to check for other regressions**

Run: `cd vendor/reference/GoRefs && uv run pytest -v`
Expected: same pass/fail counts as before this plan started for every test file *other than* `test_build_freshness.py` and the new `test_typer_cli.py` (both already verified above). If any other test newly fails, stop and investigate before committing — do not proceed on an assumption that it's unrelated.

- [ ] **Step 4: Commit**

```bash
cd vendor/reference/GoRefs
git add tests/test_build_freshness.py
git commit -m "Update test_build_freshness.py for the Typer CliRunner invocation pattern"
```

---

### Task 4: Migrate `src/ingest_community_submissions.py`'s CLI to Typer

**Files:**
- Modify: `vendor/reference/GoRefs/src/ingest_community_submissions.py:15` (import), lines 54-60 (`main()`), and the `if __name__ ==` block below it.
- Test: `vendor/reference/GoRefs/tests/test_ingest_community_submissions_cli.py` (new)

**Interfaces:**
- Consumes: `ingest_submission_csv(csv_path: Path)` — already defined earlier in the file, unchanged.
- Produces: `app` (module-level `typer.Typer` instance) importable as `ingest_community_submissions.app` for the new test.

- [ ] **Step 1: Replace the import**

Replace line 15 (`import argparse`) with:

```python
import typer
```

- [ ] **Step 2: Replace `main()` and the `if __name__` block**

The current tail of the file (lines 53-65, confirmed by direct read during planning) is:

```python
def main():
    parser = argparse.ArgumentParser(description="Ingest Community Submissions")
    parser.add_argument("--csv", help="Path to Google Form CSV export")
    args = parser.parse_args()

    if args.csv:
        ingest_submission_csv(Path(args.csv))
    else:
        print("Usage: python src/ingest_community_submissions.py --csv <path-to-file.csv>")


if __name__ == "__main__":
    main()
```

Replace all of it (including the trailing `if __name__ ==` block) with:

```python
app = typer.Typer(add_completion=False)


@app.command()
def main(
    csv: str = typer.Option(None, "--csv", help="Path to Google Form CSV export"),
) -> None:
    if csv:
        ingest_submission_csv(Path(csv))
    else:
        print("Usage: python src/ingest_community_submissions.py --csv <path-to-file.csv>")


if __name__ == "__main__":
    app()
```

- [ ] **Step 3: Write the CLI test**

Create `vendor/reference/GoRefs/tests/test_ingest_community_submissions_cli.py`:

```python
import sys
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

sys.path.insert(0, str(Path(__file__).parent.parent))
import src.ingest_community_submissions as ics

runner = CliRunner()


def test_no_csv_flag_does_not_call_ingest():
    with patch("src.ingest_community_submissions.ingest_submission_csv") as mock_ingest:
        result = runner.invoke(ics.app, [])
    assert result.exit_code == 0
    mock_ingest.assert_not_called()


def test_csv_flag_calls_ingest_with_path():
    with patch("src.ingest_community_submissions.ingest_submission_csv") as mock_ingest:
        result = runner.invoke(ics.app, ["--csv", "submissions.csv"])
    assert result.exit_code == 0
    mock_ingest.assert_called_once_with(Path("submissions.csv"))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_ingest_community_submissions_cli.py -v`
Expected: both tests PASS.

- [ ] **Step 5: Manually verify end-to-end**

Run: `cd vendor/reference/GoRefs && uv run python3 src/ingest_community_submissions.py --help`
Expected: Typer help output, no traceback.

- [ ] **Step 6: Commit**

```bash
cd vendor/reference/GoRefs
git add src/ingest_community_submissions.py tests/test_ingest_community_submissions_cli.py
git commit -m "Migrate ingest_community_submissions.py CLI from argparse to Typer"
```

---

### Task 5: Full regression pass and doc note

**Files:**
- Modify: `vendor/reference/GoRefs/docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md` (one-line addendum)

**Interfaces:** none (verification + documentation task).

- [ ] **Step 1: Run the entire test suite one more time**

Run: `cd vendor/reference/GoRefs && uv run pytest -v`
Expected: no failures beyond any pre-existing failures documented in `KNOWN_ISSUES.md` before this plan started (check that file if anything unexpected fails — do not assume a failure is pre-existing without checking).

- [ ] **Step 2: Verify every documented flag still works**

Run each of these and confirm no traceback (behavior/output content doesn't need deep verification here — Task 2's tests already cover that — just confirm the CLI layer itself doesn't error):

```bash
cd vendor/reference/GoRefs
uv run go_refs.py --help
uv run go_refs.py --fetch --help  # combining a real flag with --help should still just show help
uv run go_refs.py --all --port 9999 --config config/sources.yml --help
```

Expected: all three print help text (or otherwise don't error/traceback) — `--help` short-circuits before any real pipeline logic runs, so this is a pure CLI-parsing smoke test.

- [ ] **Step 3: Add a one-line addendum to the paused fetch-verification spec**

In `vendor/reference/GoRefs/docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md`, at the end of the "## Open items for the implementation plan" section, add:

```markdown
- CLI layer is now Typer (see `docs/superpowers/plans/2026-08-04-typer-cli-migration.md`,
  landed ahead of this spec's implementation) — `--reexplore`, `--no-report`,
  and any other new flags this spec introduces should be added as native
  Typer options, following the existing `--fetch`/`--build`/etc. pattern in
  `go_refs.py`'s `_run` command.
```

- [ ] **Step 4: Commit**

```bash
cd vendor/reference/GoRefs
git add docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md
git commit -m "Note Typer CLI migration landed, for when fetch-verification work resumes"
```
