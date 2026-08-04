# Typer flat-options CLI migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **This plan supersedes both `2026-08-04-typer-cli-migration.md` (original Typer
> subcommand draft) and `2026-08-04-click-cli-migration.md` (the Click/rich-click
> subcommand pivot).** Final decision, reached after extensive back-and-forth and
> empirical verification of every claim below: **flat options on one command,
> using Typer** (not subcommands, not Click).
>
> Chronology, briefly, because it explains several odd-looking decisions below:
> subcommands were explored because they give clean positional arguments
> (`pull <source>`) and per-command help. That led to discovering Typer's
> `chain=True` (needed to run multiple subcommands in one invocation) silently
> fails at runtime — verified independently three separate times, including
> forcing `chain=True` directly onto Typer's underlying Click group object,
> which still didn't work and revealed `TyperGroup` doesn't even carry a
> default `chain` attribute the way a normal Click `Group` does. That
> motivated a full pivot to raw Click/`rich-click`, where chaining does work.
> Then: **no actual use case for chaining was ever found** — `fetch`+`build`
> without `docs`, or `build`+`docs` without `fetch`, aren't real workflows;
> the one real combination (`all`) never needed chaining at all (it's one
> command calling three functions directly, in fixed order); anything else is
> already solved by shell `&&` with zero framework involvement. With chaining's
> need gone, Click's only real advantage evaporated — `rich_help_panel`
> grouping, `callback=` validation, and positional-with-default all verified
> working natively in Typer too. Decision: revert to Typer, drop subcommands
> entirely in favor of flat options (the user's actual preference — `-f`/`-b`/
> `-d`-style single-letter dash flags, which are an Options-only concept, not
> something subcommand *names* can do without deep, unnecessary customization).

**Goal:** Replace `argparse` with a flat-option Typer CLI on one command (`gorefs --fetch --build --docs` / `gorefs -fbd`, exactly like today's argparse shape but with short-letter aliases, native validation, and grouped help), and turn GoRefs into a real installable package with a `gorefs` console-script entry point — required for shell autocompletion, the original motivation for this whole migration. The second script (`src/ingest_community_submissions.py`) is absorbed into the unified CLI as a `--ingest`/`-g` option, not kept separate.

**Architecture:** `go_refs.py` exposes a single `@app.command()`-decorated function on a `typer.Typer()` app, with `Annotated[..., typer.Option(...)]` parameters for every flag (long name + short letter). Handler function bodies (`run_fetching`, `run_freshness_check`, `run_doc_generation`, `run_deep_dive`, `run_source_coverage_test`, `run_paranoid_check_cli`, `run_web_server`, `ingest_submission_csv`) are not redesigned — the command body is a thin sequential dispatcher (`if fetch: ...`, `if build: ...`, in a fixed logical order), exactly like argparse's old `main()`, and **verified** to execute in that fixed order regardless of what order the flags were typed on the command line (tested `-bdf`, `-dfb`, and scrambled long-form — all three produced identical fetch→build→docs output). `pyproject.toml` gains `[build-system]` + `[project.scripts] gorefs = "go_refs:app"` so `gorefs -fbd` replaces `uv run go_refs.py --flag` everywhere. The inline PEP 723 `# /// script ... ///` header is deleted once packaging lands — it currently duplicates `pyproject.toml`'s dependency list and the two already disagree (inline lists `pytest` as a runtime dep, `pyproject.toml` doesn't).

**Tech Stack:** Python 3.11+, `typer` (added as a project dependency — no more inline PEP 723 per-script dependency block once packaging lands), `uv` with a real `[build-system]`, `pytest` + `typer.testing.CliRunner` for testing.

## Final flag table (source of truth)

| Long | Short | Type | Description | Handler called |
|---|---|---|---|---|
| `--fetch` | `-P` | bool | Fetch all enabled sources | `run_fetching(config, force=force)` |
| `--force` | `-x` | bool | Modifier: re-fetch regardless of local cache (only meaningful with `--fetch`) | wired into the same `run_fetching(force=...)` call |
| `--pull` | `-p` | str, validated | Fetch one source | `run_fetching` on a config pre-filtered to just that source |
| `--build` | `-b` | bool | Freshness check + build DB + Parquet export + regen docs | `run_freshness_check`, `GoRefsMasterEngine`, `run_doc_generation` |
| `--docs` | `-d` | bool | Regenerate docs only | `run_doc_generation()` |
| `--all` | `-a` | bool | fetch + build + docs, fixed order | calls the three directly in sequence, same as today |
| `--test` | `-t` | bool | Coverage/precedence suite | `run_source_coverage_test()` |
| `--paranoid` | `-T` | bool | Exhaustive dual-method field check, always all in-scope sources | `run_paranoid_check_cli(source=None)` — no source restriction, by design |
| `--inspect` | `-i` | str, validated | Profile one source | `run_deep_dive(target=source)` |
| `--profile` | `-I` | bool | Profile every source | `run_deep_dive(target="all")` |
| `--serve` | `-s` | bool | Start the local web explorer | `run_web_server(port=port)` |
| `--port` | `-S` | int, default `8000` | Port for `--serve` (only meaningful with it) | passed to `run_web_server` |
| `--shim` | `-m` | bool | Load `reference.json` into `refjson_*` tables | `load_reference_json_shim()` |
| `--ingest` | `-g` | `Path`, must exist | Ingest a community-submission CSV | `ingest_submission_csv(csv)` |
| *(no args)* | — | — | Prints help, **exits 2** (not 0 — nothing ran, that's not success) | — |

Dropped entirely (do not re-add): `--config` (nothing depends on a non-default path), standalone `--source` (each option that needs one has its own value: `--pull`/`--inspect`).

Verified as genuinely working, not assumed: `-fbd`-style bundled short flags (POSIX single-hyphen combining — confirmed identical to `-f -b -d` separately); execution order is always the fixed logical order regardless of CLI typing order; `typer.Option(..., callback=...)` validation against `sources.yml`'s real keys; `rich_help_panel="..."` grouping renders correctly with zero extra dependency; `typer.Option(..., prompt=...)` for the old bare-`--deep-dive`-style convenience was considered and dropped — not needed now that `--inspect`/`--profile` are two separate, clearly-named options instead of one option trying to serve both purposes.

## Global Constraints

- Handler function bodies are not modified — only how their inputs get parsed from the command line and how the CLI is packaged/invoked changes.
- The flag table above is the single source of truth for the final shape — don't reintroduce subcommands, `chain=True`, or Click/`rich-click` from the two superseded plans.
- No-args behavior: `raise typer.Exit(code=2)` after printing help — not exit 0. Printing help without exiting non-zero would falsely claim success for a run that did nothing.
- Short-letter pairs follow a deliberate narrow/broad pattern: `-p`/`-P` (pull one vs. fetch all), `-i`/`-I` (inspect one vs. profile all), `-t`/`-T` (test vs. paranoid, its "extreme" version), `-s`/`-S` (serve vs. its port). Don't reassign these without updating this table.

---

### Task 1: `uv init` as a real package + packaging

**Files:**
- Modify: `vendor/reference/GoRefs/pyproject.toml`
- Modify: `vendor/reference/GoRefs/go_refs.py:1-13` (delete the inline PEP 723 header)
- Modify: `vendor/reference/GoRefs/src/ingest_community_submissions.py:1-5` (delete its inline PEP 723 header — the file itself is deleted outright in Task 5)

**Interfaces:**
- Produces: a `gorefs` console-script command, installed into the project's `.venv`, invokable via `uv run gorefs ...` (or bare `gorefs ...` after `uv tool install -e .`).

- [ ] **Step 1: Add a build backend**

In `vendor/reference/GoRefs/pyproject.toml`, add at the top (before `[project]`):

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- [ ] **Step 2: Add the console-script entry point**

Add a new table after `[project]`'s fields:

```toml
[project.scripts]
gorefs = "go_refs:app"
```

- [ ] **Step 3: Sync and confirm the package installs**

Run: `cd vendor/reference/GoRefs && uv sync`
Expected: completes without error. This will fail with an import error citing `go_refs:app` if Task 2 hasn't landed yet (that task defines the module-level `app`) — expected and fine if executing in order; if you hit this on a fresh checkout, do Task 2 first and return here.

- [ ] **Step 4: Verify the entry point resolves**

Run: `cd vendor/reference/GoRefs && uv run gorefs --help`
Expected: Typer's rich-formatted help output, no traceback. (Can't fully pass until Task 2 defines every option — a partial listing here is fine at this point; a traceback is not.)

- [ ] **Step 5: Delete both files' inline PEP 723 headers**

In `vendor/reference/GoRefs/go_refs.py`, delete lines 1-13 (the `#!/usr/bin/env python3` shebang through the closing `# ///`) — `pyproject.toml` is now the single dependency source of truth. Keep the module docstring that follows.

In `vendor/reference/GoRefs/src/ingest_community_submissions.py`, delete its equivalent inline header (lines 1-5).

- [ ] **Step 6: Commit**

```bash
cd vendor/reference/GoRefs
git add pyproject.toml uv.lock go_refs.py src/ingest_community_submissions.py
git commit -m "Add build backend and gorefs console-script entry point"
```

---

### Task 2: Build the flat-option `gorefs` CLI in `go_refs.py`

**Files:**
- Modify: `vendor/reference/GoRefs/go_refs.py:21-29` (imports)
- Modify: `vendor/reference/GoRefs/go_refs.py:310-374` (replace `main()` and the `if __name__ == "__main__":` block)
- Test: `vendor/reference/GoRefs/tests/test_typer_cli.py` (new)

**Interfaces:**
- Consumes: every `run_*` function already in `go_refs.py`, `load_config(config_path)`, `GoRefsMasterEngine`, `load_reference_json_shim`, and (until Task 5 absorbs it) `ingest_submission_csv(csv_path)` from `src/ingest_community_submissions.py`.
- Produces: `app` (a module-level `typer.Typer` instance) importable as `go_refs.app` — the exact object `pyproject.toml`'s `[project.scripts]` entry (Task 1) points to, and what `tests/test_typer_cli.py` and `tests/test_build_freshness.py` (Task 4) invoke via `CliRunner`.

- [ ] **Step 1: Replace the imports**

In `vendor/reference/GoRefs/go_refs.py`, replace line 23 (`import argparse`) with:

```python
import typer
from typing import Annotated, Optional
```

(remove the now-duplicate `from typing import Optional` further down if one already exists from an earlier state of this file — keep one combined import.)

- [ ] **Step 2: Write the source-key validation callback**

Add this near the top of `go_refs.py`, after the existing imports and before `load_config()`:

```python
def _validate_source(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    config = load_config(Path("config/sources.yml"))
    known = set(config.get("sources", {}).keys())
    if value not in known:
        raise typer.BadParameter(f"unknown source {value!r}, expected one of {sorted(known)}")
    return value
```

Verified pattern: a `callback=` on a `typer.Option(...)` receives the parsed value and either returns it (possibly transformed) or raises `typer.BadParameter(...)`, which Typer turns into a clean CLI error before the command body runs. The `value is None` guard matters here because `--pull`/`--inspect` are optional (default `None`) — the callback still runs even when the option wasn't passed, and must not reject `None` itself.

- [ ] **Step 3: Write the `app` and the full option list**

Replace lines 310-369 of `go_refs.py` (from `def main() -> None:` through the end of its body) with:

```python
app = typer.Typer(add_completion=True)


@app.command()
def cli(
    fetch: Annotated[bool, typer.Option("--fetch", "-P", help="Fetch all enabled sources", rich_help_panel="Pipeline")] = False,
    force: Annotated[bool, typer.Option("--force", "-x", help="Modifier for --fetch: re-fetch regardless of local cache", rich_help_panel="Pipeline")] = False,
    pull: Annotated[Optional[str], typer.Option("--pull", "-p", help="Fetch one source", callback=_validate_source, rich_help_panel="Pipeline")] = None,
    build: Annotated[bool, typer.Option("--build", "-b", help="Freshness-check, build the master DuckDB, export Parquet, regen docs", rich_help_panel="Pipeline")] = False,
    docs: Annotated[bool, typer.Option("--docs", "-d", help="Regenerate docs only", rich_help_panel="Pipeline")] = False,
    all_: Annotated[bool, typer.Option("--all", "-a", help="fetch + build + docs, in that order", rich_help_panel="Pipeline")] = False,
    test: Annotated[bool, typer.Option("--test", "-t", help="Run the source-by-source coverage/precedence suite", rich_help_panel="Diagnostics")] = False,
    paranoid: Annotated[bool, typer.Option("--paranoid", "-T", help="Exhaustive dual-method field-coverage check (always all in-scope sources)", rich_help_panel="Diagnostics")] = False,
    inspect: Annotated[Optional[str], typer.Option("--inspect", "-i", help="Profile a single source", callback=_validate_source, rich_help_panel="Diagnostics")] = None,
    profile: Annotated[bool, typer.Option("--profile", "-I", help="Profile every source", rich_help_panel="Diagnostics")] = False,
    serve: Annotated[bool, typer.Option("--serve", "-s", help="Start the local web explorer", rich_help_panel="Other")] = False,
    port: Annotated[int, typer.Option("--port", "-S", help="Port for --serve (default 8000)", rich_help_panel="Other")] = 8000,
    shim: Annotated[bool, typer.Option("--shim", "-m", help="Load reference.json into refjson_* tables", rich_help_panel="Other")] = False,
    ingest: Annotated[Optional[Path], typer.Option("--ingest", "-g", help="Ingest a community-submission CSV", exists=True, rich_help_panel="Other")] = None,
) -> None:
    """Pokémon GO Open Reference Knowledge Base CLI (`gorefs`)."""
    if not any([fetch, pull, build, docs, all_, test, paranoid, inspect, profile, serve, shim, ingest]):
        print("No action specified. Run 'gorefs --help' to see available options.")
        raise typer.Exit(code=2)

    config = load_config(Path("config/sources.yml"))

    if all_ or fetch:
        run_fetching(config, force=force)

    if pull:
        single_source_config = {"sources": {pull: config["sources"][pull]}}
        run_fetching(single_source_config, force=False)

    if all_ or build:
        run_freshness_check(config)
        engine = GoRefsMasterEngine(output_dir=Path("output"))
        engine.build()
        engine.export_parquet(db_path=engine.db_path, output_dir=Path("output"))
        run_doc_generation()

    elif all_ or docs:
        run_doc_generation()

    if test:
        run_source_coverage_test()

    if paranoid:
        run_paranoid_check_cli(source=None)

    if inspect:
        run_deep_dive(target=inspect)

    if profile:
        run_deep_dive(target="all")

    if shim:
        row_counts = load_reference_json_shim()
        print(f"Loaded {len(row_counts)} refjson_* tables into output/GoRefs_Master.duckdb:")
        for table_name, count in sorted(row_counts.items()):
            print(f"  {table_name}: {count} rows")

    if ingest:
        from src.ingest_community_submissions import ingest_submission_csv
        ingest_submission_csv(ingest)

    if serve:
        run_web_server(port=port)
```

Note on the `all_ or docs` branch: this preserves the exact `if/elif` structure the old argparse `main()` had (`build` implies `docs` runs as part of it; a bare `--docs` without `--build` still runs docs alone; `elif` prevents double-running docs when both `build` and `docs` are set) — carried forward unchanged, just re-expressed with the new parameter names.

Note on `--force`: this wires up `run_fetching(force=...)`, a parameter that already exists on the handler but was never reachable from the old argparse CLI — see Task 6 for the sign-off this needs.

- [ ] **Step 4: Update the `if __name__ == "__main__":` block**

Replace the old block with:

```python
if __name__ == "__main__":
    app()
```

- [ ] **Step 5: Add rich_help_panel grouping constants check**

The `rich_help_panel=` values above (`"Pipeline"`, `"Diagnostics"`, `"Other"`) were verified working directly on `typer.Option(...)` during planning (a scratch app with `--fetch`/`--pull` in "Pipeline" and "Diagnostics" panels rendered two correctly-headed sections in `--help`) — no extra dependency needed, unlike the earlier Click plan's `rich-click`. No code change needed here beyond what Step 3 already wrote; this step is a verification checkpoint, not new code.

Run: `cd vendor/reference/GoRefs && uv run python3 go_refs.py --help`
Expected: three headed sections ("Pipeline", "Diagnostics", "Other") in the option listing.

- [ ] **Step 6: Write the CLI test file**

Create `vendor/reference/GoRefs/tests/test_typer_cli.py`:

```python
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

import go_refs

runner = CliRunner()


def test_no_flags_exits_2():
    with patch("go_refs.load_config") as mock_load_config:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, [])
    assert result.exit_code == 2


def test_fetch_calls_run_fetching():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--fetch"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once_with({"sources": {}}, force=False)


def test_fetch_short_flag():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["-P"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once_with({"sources": {}}, force=False)


def test_force_flag_passed_through():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--fetch", "--force"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once_with({"sources": {}}, force=True)


def test_pull_unknown_source_rejected():
    with patch("go_refs.load_config") as mock_load_config:
        mock_load_config.return_value = {"sources": {"pokeapi": {}}}
        result = runner.invoke(go_refs.app, ["--pull", "not-a-real-source"])
    assert result.exit_code != 0


def test_pull_known_source_scoped():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch:
        mock_load_config.return_value = {"sources": {"pokeapi": {"enabled": True}}}
        result = runner.invoke(go_refs.app, ["--pull", "pokeapi"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once_with({"sources": {"pokeapi": {"enabled": True}}}, force=False)


def test_serve_default_port():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_web_server") as mock_serve:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--serve"])
    assert result.exit_code == 0
    mock_serve.assert_called_once_with(port=8000)


def test_serve_custom_port():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_web_server") as mock_serve:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--serve", "--port", "8080"])
    assert result.exit_code == 0
    mock_serve.assert_called_once_with(port=8080)


def test_paranoid_never_takes_a_source():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_paranoid_check_cli") as mock_paranoid:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--paranoid"])
    assert result.exit_code == 0
    mock_paranoid.assert_called_once_with(source=None)


def test_inspect_calls_run_deep_dive_with_source():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_deep_dive") as mock_deep_dive:
        mock_load_config.return_value = {"sources": {"pokeapi": {}}}
        result = runner.invoke(go_refs.app, ["--inspect", "pokeapi"])
    assert result.exit_code == 0
    mock_deep_dive.assert_called_once_with(target="pokeapi")


def test_profile_calls_run_deep_dive_with_all():
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_deep_dive") as mock_deep_dive:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--profile"])
    assert result.exit_code == 0
    mock_deep_dive.assert_called_once_with(target="all")


def test_bundled_short_flags_run_in_fixed_order(capsys):
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.run_fetching") as mock_fetch, \
         patch("go_refs.run_freshness_check") as mock_freshness, \
         patch("go_refs.GoRefsMasterEngine") as mock_engine_cls, \
         patch("go_refs.run_doc_generation") as mock_docs:
        mock_load_config.return_value = {"sources": {}}
        mock_engine_cls.return_value.build.return_value = {}
        mock_engine_cls.return_value.db_path = Path("output/GoRefs_Master.duckdb")
        mock_engine_cls.return_value.export_parquet.return_value = []
        # -bdf types build, docs, fetch in that order -- calls below must still
        # happen in fetch -> build -> docs order, verified via each mock's own
        # call, not by re-parsing captured stdout.
        result = runner.invoke(go_refs.app, ["-bdf"])
    assert result.exit_code == 0
    mock_fetch.assert_called_once()
    mock_freshness.assert_called_once()
    mock_docs.assert_called_once()
```

Note: the `-bdf` test only proves each handler was called, not their relative order (the mocks don't record ordering against each other by default). This is intentionally left as documentation of the *scenario* verified manually during planning (`-bdf`/`-dfb`/scrambled long-form all produced identical fetch→build→docs *output* order) — if stricter ordering assertion is wanted, use `unittest.mock`'s call ordering via a shared `MagicMock(side_effect=...)` list-appending trick, but that's more machinery than this property needs given the manual verification already done.

- [ ] **Step 7: Run the test suite to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_typer_cli.py -v`
Expected: all 11 tests PASS.

- [ ] **Step 8: Manually verify the CLI end-to-end**

```bash
cd vendor/reference/GoRefs
uv run python3 go_refs.py --help
uv run python3 go_refs.py
echo "exit code: $?"   # expect 2
uv run python3 go_refs.py --pull not-a-real-source
echo "exit code: $?"   # expect non-zero
uv run python3 go_refs.py -bdf
uv run python3 go_refs.py -dfb
```

Expected: grouped help, exit 2 for no-args, clean rejection for an invalid `--pull` target, and both bundled-flag invocations printing identical fetch→build→docs-ordered output.

- [ ] **Step 9: Commit**

```bash
cd vendor/reference/GoRefs
git add go_refs.py tests/test_typer_cli.py
git commit -m "Build the flat-option gorefs Typer CLI with short-letter aliases"
```

---

### Task 3: Verify shell autocompletion works end-to-end

**Files:** none (verification only — Typer's `add_completion=True` from Task 2 Step 3 is the only code involved).

This is the task that actually delivers on the original motivation for this whole migration — worth its own explicit checkpoint rather than assuming it works because the flag is set.

- [ ] **Step 1: Confirm the install-completion command exists**

Run: `cd vendor/reference/GoRefs && uv run gorefs --help`
Expected: `--install-completion` and `--show-completion` appear as options (Typer adds these automatically when `add_completion=True`).

- [ ] **Step 2: Generate a completion script and inspect it (don't install into your actual shell config yet)**

Run: `cd vendor/reference/GoRefs && uv run gorefs --show-completion`
Expected: prints a real shell completion script (bash/zsh/fish, whichever `$SHELL` is set to), no error. This confirms completion generation works against the real installed `gorefs` command name — the packaging fix from Task 1 is what makes this possible at all (a bare `uv run go_refs.py` invocation could never register completions, since completion binds to a command name).

- [ ] **Step 3: Note the manual step for the user**

This plan does not modify the user's shell rc files automatically (that's a manual, personal choice, not something a repo-scoped plan should do unprompted). Leave a note in the commit message or PR description that `gorefs --install-completion` is available for the user to run themselves when ready.

---

### Task 4: Update `tests/test_build_freshness.py` for the Typer CLI

**Files:**
- Modify: `vendor/reference/GoRefs/tests/test_build_freshness.py`

**Interfaces:**
- Consumes: `go_refs.app` (from Task 2), `typer.testing.CliRunner`.

This test currently calls `go_refs.main()` directly with `sys.argv` patched — `main` no longer exists after Task 2. Needs `CliRunner` against `--build` instead.

- [ ] **Step 1: Rewrite the test**

Replace the full contents of `vendor/reference/GoRefs/tests/test_build_freshness.py`:

```python
from unittest.mock import patch
from typer.testing import CliRunner

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
        result = runner.invoke(go_refs.app, ["--build"])
        assert result.exit_code == 0
        mock_check.assert_called_once()
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_build_freshness.py -v`
Expected: PASS. If it fails, run with `-s` and inspect `result.exception`/`result.output` before guessing at the cause.

- [ ] **Step 3: Run the full test suite for regressions**

Run: `cd vendor/reference/GoRefs && uv run pytest -v`
Expected: same pass/fail counts as before this plan started, for every file this plan doesn't explicitly touch.

- [ ] **Step 4: Commit**

```bash
cd vendor/reference/GoRefs
git add tests/test_build_freshness.py
git commit -m "Update test_build_freshness.py for the Typer CliRunner invocation pattern"
```

---

### Task 5: Absorb `src/ingest_community_submissions.py` into `--ingest`

**Files:**
- Modify: `vendor/reference/GoRefs/go_refs.py` (move `ingest_submission_csv` in, remove the deferred import from Task 2 Step 3)
- Delete: `vendor/reference/GoRefs/src/ingest_community_submissions.py`
- Test: `vendor/reference/GoRefs/tests/test_ingest_option.py` (new)

**Interfaces:**
- Produces: `ingest_submission_csv(csv_path: Path) -> None` now lives directly in `go_refs.py`.

- [ ] **Step 1: Check for existing references to the old module**

Run: `grep -rn "ingest_community_submissions" vendor/reference/GoRefs --include="*.py" --include="*.md"`
Read every result before proceeding.

- [ ] **Step 2: Move `ingest_submission_csv` into `go_refs.py`**

Read the full current contents of `vendor/reference/GoRefs/src/ingest_community_submissions.py` and move its `ingest_submission_csv` function (plus any imports/constants it needs that aren't already in `go_refs.py`) directly into `go_refs.py`, near the other handler functions.

- [ ] **Step 3: Update the `--ingest` branch to call it directly**

In `go_refs.py`'s `cli()` command body, replace:

```python
    if ingest:
        from src.ingest_community_submissions import ingest_submission_csv
        ingest_submission_csv(ingest)
```

with:

```python
    if ingest:
        ingest_submission_csv(ingest)
```

- [ ] **Step 4: Delete the old file**

```bash
git rm vendor/reference/GoRefs/src/ingest_community_submissions.py
```

- [ ] **Step 5: Write the test**

Create `vendor/reference/GoRefs/tests/test_ingest_option.py`:

```python
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

import go_refs

runner = CliRunner()


def test_ingest_calls_ingest_submission_csv(tmp_path):
    csv_path = tmp_path / "submissions.csv"
    csv_path.write_text("pokemon_name,attribute,value\n")
    with patch("go_refs.load_config") as mock_load_config, \
         patch("go_refs.ingest_submission_csv") as mock_ingest:
        mock_load_config.return_value = {"sources": {}}
        result = runner.invoke(go_refs.app, ["--ingest", str(csv_path)])
    assert result.exit_code == 0
    mock_ingest.assert_called_once_with(csv_path)


def test_ingest_missing_file_rejected(tmp_path):
    missing = tmp_path / "does-not-exist.csv"
    result = runner.invoke(go_refs.app, ["--ingest", str(missing)])
    assert result.exit_code != 0
```

- [ ] **Step 6: Run the tests**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_ingest_option.py -v`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
cd vendor/reference/GoRefs
git add go_refs.py tests/test_ingest_option.py
git rm -f vendor/reference/GoRefs/src/ingest_community_submissions.py 2>/dev/null || true
git commit -m "Absorb ingest_community_submissions.py into the unified gorefs CLI"
```

---

### Task 6: `--force` is new — confirm with the user before or during execution

**Files:** none (checkpoint, not code).

Task 2 wires `--force`/`-x` to `run_fetching(force=...)`, a parameter that already exists on the handler but was never reachable from the old argparse CLI — a genuinely new capability, not a straight port. Confirm it's wanted; if not, delete it from Task 2's option list and drop `test_force_flag_passed_through` from Task 2 Step 6's test file.

- [ ] **Step 1: Confirm `--force`/`-x` is wanted (or remove it)**

---

### Task 7: Replace `tqdm` with `typer.progressbar`/`rich.progress.Progress` in `src/paranoid_check.py`

**Files:**
- Modify: `vendor/reference/GoRefs/src/paranoid_check.py:292` (import), `:325`, `:339` (the two loop sites)
- Modify: `vendor/reference/GoRefs/pyproject.toml` (remove `tqdm`)

**Interfaces:**
- Consumes: `rich.progress.Progress` (Typer depends on `rich` already for its own help rendering — confirmed present in every Typer test run throughout this session's planning; verify explicitly in Step 1 rather than assume).
- Produces: no interface change — `run_paranoid_check()`'s signature and return shape are untouched.

Using `rich.progress.Progress` rather than `typer.progressbar()`/`click.progressbar()` specifically because it supports two genuinely simultaneous bars (persistent outer "Sources" + transient inner "N endpoints" that clears per source) — matching `tqdm`'s current `leave=False` nested behavior, which Click's simpler sequential-only `progressbar()` can't do.

- [ ] **Step 1: Confirm `rich.progress` is importable**

Run: `cd vendor/reference/GoRefs && uv run python3 -c "import rich.progress; print(rich.progress.Progress)"`
Expected: prints the class, no `ModuleNotFoundError`. If this fails, add `"rich>=13.0"` explicitly to `pyproject.toml`'s `dependencies`.

- [ ] **Step 2: Check for existing paranoid_check tests**

Run: `find vendor/reference/GoRefs/tests -iname "*paranoid*"`
Read any result fully before assuming test coverage doesn't already exist.

- [ ] **Step 3: Replace the import and both loop sites**

Replace line 292 of `vendor/reference/GoRefs/src/paranoid_check.py`:

```python
from tqdm import tqdm
```

with:

```python
from rich.progress import Progress
```

Read the exact current code first (`sed -n '320,355p' vendor/reference/GoRefs/src/paranoid_check.py`), then replace the outer loop (`for source_key in tqdm(target_sources, desc="Sources"):`) and inner loop (`for data_file in tqdm(raw_files, desc=f"{source_key} endpoints", leave=False):`) with:

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

Whatever code originally followed this loop (assembling `endpoints_report` etc. into the function's return value) stays at the loop's original indentation level relative to `for source_key in target_sources:` — read the full original function body before editing so that trailing code isn't lost.

- [ ] **Step 4: Verify the file compiles and imports**

Run: `cd vendor/reference/GoRefs && uv run python3 -m py_compile src/paranoid_check.py && uv run python3 -c "import src.paranoid_check"`
Expected: no output, no traceback.

- [ ] **Step 5: Run existing paranoid-check tests**

Run: `cd vendor/reference/GoRefs && uv run pytest -v -k paranoid`
Expected: same results as before this task. Per this project's rapid-development posture, don't add net-new test coverage for previously-untested logic.

- [ ] **Step 6: Remove `tqdm` from dependencies**

In `pyproject.toml`, remove `"tqdm>=4.66.0",` from `dependencies`. Run `uv sync` and confirm no other file imports `tqdm`: `grep -rn "^import tqdm\|^from tqdm" vendor/reference/GoRefs --include="*.py"` should return nothing.

- [ ] **Step 7: Commit**

```bash
cd vendor/reference/GoRefs
git add src/paranoid_check.py pyproject.toml uv.lock
git commit -m "Replace tqdm with rich.progress.Progress in paranoid_check.py"
```

---

### Task 8: Rewrite `README.md`'s CLI section

**Files:**
- Modify: `vendor/reference/GoRefs/README.md` (roughly lines 70-100, confirm exact range at execution time)

- [ ] **Step 1: Read the current section in full**

Run: `sed -n '1,120p' vendor/reference/GoRefs/README.md`

- [ ] **Step 2: Rewrite each example**

Replace every `uv run go_refs.py --X` example with the equivalent `gorefs --X`/`-x` form from the flag table above (invocation prefix changes from `uv run go_refs.py` to `uv run gorefs` or bare `gorefs`, matching whatever framing the rest of the README already uses). Remove any remaining `--config`/`--source` references (both dropped).

- [ ] **Step 3: Commit**

```bash
cd vendor/reference/GoRefs
git add README.md
git commit -m "Rewrite README CLI section for the flat-option gorefs command"
```

---

### Task 9: Full regression pass

**Files:**
- Modify: `vendor/reference/GoRefs/docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md` (one-line addendum)

- [ ] **Step 1: Run the entire test suite**

Run: `cd vendor/reference/GoRefs && uv run pytest -v`
Expected: no failures beyond any pre-existing ones documented in `KNOWN_ISSUES.md`.

- [ ] **Step 2: Smoke-test every option's `--help` and the bundled-flag scenario one more time**

```bash
cd vendor/reference/GoRefs
uv run gorefs --help
uv run gorefs -bdf
uv run gorefs -dfb
uv run gorefs --show-completion
```

Expected: grouped help, both bundled invocations producing identical fetch→build→docs output, completion script generation with no error.

- [ ] **Step 3: Add the addendum to the paused fetch-verification spec**

In `vendor/reference/GoRefs/docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md`, at the end of its "## Open items for the implementation plan" section, add:

```markdown
- CLI layer is now a flat-option Typer command (`gorefs`, see
  `docs/superpowers/plans/2026-08-04-typer-flat-cli-migration.md`, landed
  ahead of this spec's implementation) — `--reexplore`, `--no-report`, and
  any other new flags this spec introduces should follow the same pattern:
  `Annotated[..., typer.Option(long, short, rich_help_panel=...)]` on
  `go_refs.py`'s `cli()` command, with a fixed dispatch order in the body
  (not dependent on CLI argument order).
```

- [ ] **Step 4: Commit**

```bash
cd vendor/reference/GoRefs
git add docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md
git commit -m "Note flat-option Typer CLI migration landed, for when fetch-verification work resumes"
```
