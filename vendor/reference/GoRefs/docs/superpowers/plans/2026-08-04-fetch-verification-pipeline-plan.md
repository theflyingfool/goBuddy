# Fetch verification pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fetch-verification pipeline described in
`docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md` —
per-endpoint fetch tracking with cross-source retry, an endpoint registry
separate from `sources.yml`, best-effort discovery of new endpoints, a
`latest/`+`history/` snapshot layout that fixes the empty-snapshot bug, a
central fetch-attempt log, and a Fetch+Discovery Markdown report — as new
code on a fresh branch, with the old `src/fetchers/` deleted outright
rather than preserved.

**Architecture:** All new code lives in new files (`src/fetchers/` rebuilt
fresh, `src/endpoint_registry.py`, `src/discovery.py`,
`src/snapshot_store.py`, `src/fetch_history.py`, `src/fetch_orchestrator.py`,
`src/fetch_report.py`). The old `src/fetchers/` package is deleted, not
relocated — this is a new branch, git history is the holding pen, and
merge friction later is accepted. `go_refs.py` is not modified at all.
`src/builder.py`, `src/engine.py`, `src/profiler.py`, `src/build_tables.py`,
`src/models.py`, `src/reference_shim.py`, `src/paranoid_check.py`, and
`src/ingest_community_submissions.py` are confirmed (via Serena symbol
inspection, see Task 1) to be downstream build/test tooling, not fetch
code — left untouched, and will raise `ImportError` on `from src.fetchers
import FetcherRegistry` (only `src/builder.py` has this import) until
someone rebuilds that call site later. That breakage is accepted, not
fixed here.

**Tech Stack:** Python 3.11+, `requests`, `pyyaml` — no new dependencies.

## Why `go_refs.py` isn't touched this round

A separate, already-written plan —
`docs/superpowers/plans/2026-08-04-typer-flat-cli-migration.md` — is queued
to rewrite `go_refs.py`'s entire CLI dispatch from `argparse` onto Typer
(flat options, e.g. `gorefs -fbd`) before any fetch-verification wiring
happens; that plan's own Task 9 addendum says new flags this spec needs
(`--reexplore`, `--no-report`, etc.) should be added Typer-style once it
lands. Editing `go_refs.py`'s CLI now would conflict with that plan and get
overwritten. Confirmed via `git log`: the typer plan exists on this branch
but has not been executed yet (`go_refs.py` is still `argparse` as of this
writing). Wiring `--fetch`/`--reexplore`/`--no-report` to this new pipeline,
and the auto-render/auto-open-on-close report behavior described below, are
explicitly **out of scope** for this plan — Task 14 records both as
follow-up.

## Global Constraints

- **Scope:** `vendor/reference/GoRefs` only, per the spec. All paths below
  are relative to that directory — `cd vendor/reference/GoRefs` before
  running any command in this plan.
- **No CLI wiring, no test writing or running.** Do not modify `go_refs.py`
  at all. Do not create `pytest` files and do not run the existing
  `pytest` suite as a checkpoint — per explicit user instruction
  (2026-08-04, token budget), verification in every task below is a
  runnable `python -c "..."` command with expected output stated, meant to
  be read and eyeballed, not asserted against a test runner.
- **Old `src/fetchers/` is deleted outright**, not relocated to a legacy
  package. New branch — git history holds the old code if it's ever
  needed. This is why there's only one `FetcherRegistry` class in this
  plan (`src.fetchers.base.FetcherRegistry`, built fresh in Task 2), not
  two.
- **Downstream files are confirmed untouched.** Task 1 uses Serena to
  confirm exactly what `src/builder.py`, `src/engine.py`, `src/profiler.py`,
  and `src/build_tables.py` do before anything is deleted, so "is this part
  of the fetch process" isn't guessed at.
- **Raw data:** no `raw_dumps/` migration in this plan. The new pipeline
  writes `raw_dumps/<source>/latest/` + `history/` directly; any
  pre-existing timestamped snapshot directories from the old fetchers are
  left alone, unread by anything (the only code that read them,
  `src.fetchers`, no longer exists in its old form). Cleanup of old
  snapshot dirs is a later decision, not this plan's.
- **`reexplore_interval_days = 7`**, stored in a new top-level `settings:`
  block in `config/sources.yml` (not per-source).
- **Retry policy:** exactly 3 total attempts per endpoint, no backoff delay
  between attempts (spec's own stated default when nothing else is
  specified).
- **Report system — this plan starts it, doesn't finish it.** Per user
  clarification (2026-08-04): every `go_refs.py` task (fetch, build, serve,
  docs, test-paranoid, ...) is meant to write a timestamped JSON state file,
  which `go_refs.py` parses into one Markdown report and auto-opens before
  it exits, unless a future `--no-report` flag is passed. This plan builds
  the underlying **logging/state mechanism** in full (Task 8's
  `fetch_history.jsonl`, Task 10's `report_state/*.json` + `render_report()`)
  and the **Fetch + Discovery** sections' real rendering, matching the
  spec's stated scope for this round. The auto-render-on-exit / auto-open /
  `--no-report` behavior itself is CLI wiring (`go_refs.py` calling
  `render_report()` at the end of every invocation) and is deferred with
  the rest of the CLI wiring — Task 14 records it explicitly so it isn't
  lost. **New this round, from the same clarification:** endpoints that
  fetched successfully but have no matching schema-mapping template raise
  a MAJOR ISSUE in the Fetch section ("un-assigned endpoints") — see Task 9
  Step 1 and Task 10.

---

### Task 1: Confirm scope with Serena, then delete old `src/fetchers/`

**Files:**
- Delete: `src/fetchers/` (entire old package)

**Interfaces:** none — this task removes code, adds none.

Before deleting anything, confirm via Serena (not grep) which files in `src/`
are actually part of the fetch process (get deleted) versus downstream
build/test tooling (stay untouched). This step's findings are recorded here
so Task 14's handoff doesn't have to re-derive them.

- [ ] **Step 1: Get a symbol overview of every other file in `src/`**

Using Serena's `get_symbols_overview` (not grep) on each of: `src/builder.py`,
`src/engine.py`, `src/profiler.py`, `src/build_tables.py`, `src/models.py`,
`src/reference_shim.py`, `src/paranoid_check.py`, `src/ingest_community_submissions.py`.

Findings from this planning session (re-verify if the codebase has changed
since 2026-08-04):

| File | Role | Part of fetch process? |
|---|---|---|
| `src/builder.py` | `GoRefsMasterEngine` — collects/resolves claims from already-fetched raw dumps, writes the master DuckDB, exports Parquet. Reads raw data via `FetcherRegistry.get_fetcher_class(...).load_latest_raw(...)` as a convenience, but its own job is building, not fetching. | No — downstream consumer |
| `src/engine.py` | Generic template-driven extraction engine (`run_source`, `extract_transformed_records`, `_load_template_and_records`) reading `config/source_templates/*.yml` + raw snapshots. | No — downstream consumer |
| `src/profiler.py` | `SourceProfiler` — inspects a raw snapshot to generate/update `config/source_templates/*.yml` (the `--deep-dive` CLI flag). | No — downstream consumer |
| `src/build_tables.py` | `build_exploration_tables()` — explicitly the spec's own non-goal (possible head start for the deferred exploration-DuckDB sub-project). | No — unrelated, deferred elsewhere |
| `src/models.py` | Pydantic models (`SpeciesModel`, `FormModel`, `MoveModel`, `DiscrepancyModel`). | No |
| `src/reference_shim.py` | `load_reference_json_shim()` — loads `reference.json` into `refjson_*` tables. | No |
| `src/paranoid_check.py` | `run_paranoid_check()` / `--test-paranoid` dual-method field-coverage check. Already has its own "endpoint not mapped by any template" logic (`find_templates_for_source`, `mapped_source_fields`, `classify_endpoint_fields`) — the closest existing precedent for this plan's new "un-assigned endpoints" MAJOR ISSUE (Task 9/10), reused only as a reference pattern, not imported. | No |
| `src/ingest_community_submissions.py` | `ingest_submission_csv()` — CSV ingestion for community submissions, unrelated to upstream fetching. | No |

Only `src/fetchers/` (the old per-source `fetch()` implementations) is the
fetch process. Everything else stays.

- [ ] **Step 2: Note the one call site that will break**

`src/builder.py` has `import src.fetchers` and `from src.fetchers import FetcherRegistry`
(used to call `.load_latest_raw(...)` when reading raw dumps for the build).
Once Task 2/3 replace `src/fetchers/` with the new per-endpoint API (no
`load_latest_raw`), this import will still resolve (the module exists) but
calls to the old methods will raise `AttributeError` at runtime — `--build`
breaks. This is accepted, not fixed in this plan (`src/builder.py` is
"the other scripts" the user will rebuild separately).

- [ ] **Step 3: Delete the old package**

```bash
git rm -r src/fetchers
```

- [ ] **Step 4: Verify it's gone**

Run: `ls src/ | grep fetchers`
Expected: no output (nothing left).

- [ ] **Step 5: Commit**

```bash
git commit -m "Delete legacy src/fetchers/ (per-source fetch() model) ahead of the per-endpoint rebuild"
```

---

### Task 2: New `src/fetchers/base.py` — per-endpoint fetcher base + registry

**Files:**
- Create: `src/fetchers/__init__.py`
- Create: `src/fetchers/base.py`

**Interfaces:**
- Produces: `EndpointFetchResult(name, ok, content=None, content_hash=None, etag=None, error=None)`;
  `BaseFetcher(source_key, config)` with `.build_url(path) -> str` and
  `.fetch_endpoint(name, path) -> EndpointFetchResult`; `FetcherRegistry.register(source_key)`
  decorator and `FetcherRegistry.get_fetcher_class(source_key) -> Optional[Type[BaseFetcher]]`.
  Task 9's orchestrator consumes `FetcherRegistry.get_fetcher_class` and `fetch_endpoint`.

- [ ] **Step 1: Create the package init**

`src/fetchers/__init__.py`:
```python
"""Per-endpoint fetcher package (fetch-verification-pipeline spec, 2026-08-03).

Every source normalizes to a flat list of named endpoints, defined in
config/source_templates/<source>_endpoints.yml (see src/endpoint_registry.py),
not here. Replaces the deleted whole-source fetch() model.
"""
from .base import BaseFetcher, EndpointFetchResult, FetcherRegistry

# Import order matters: these registration side-effects must run so
# FetcherRegistry.get_fetcher_class() has every source_key populated.
from . import pogoapi_net  # noqa: E402,F401
from . import pokemon_go_api  # noqa: E402,F401
from . import pokeapi  # noqa: E402,F401
from . import alexelgt_game_masters  # noqa: E402,F401
from . import pvpoke  # noqa: E402,F401
from . import rplus_shiny  # noqa: E402,F401
from . import local_authoring  # noqa: E402,F401

__all__ = ["BaseFetcher", "EndpointFetchResult", "FetcherRegistry"]
```

- [ ] **Step 2: Write the base module**

`src/fetchers/base.py`:
```python
"""Base per-endpoint fetcher + registry for the fetch-verification pipeline."""

import hashlib
from typing import Any, Dict, Optional, Type

import requests


class EndpointFetchResult:
    """Outcome of one (source, endpoint) fetch attempt."""

    def __init__(
        self,
        name: str,
        ok: bool,
        content: Optional[bytes] = None,
        content_hash: Optional[str] = None,
        etag: Optional[str] = None,
        error: Optional[str] = None,
    ):
        self.name = name
        self.ok = ok
        self.content = content
        self.content_hash = content_hash
        self.etag = etag
        self.error = error


class BaseFetcher:
    """Per-endpoint fetcher. Subclasses normally need no overrides -- build_url()
    combines config's base_url/url with an endpoint's path, and fetch_endpoint()
    does a generic HTTP GET + byte hash. Override fetch_endpoint() directly for
    non-HTTP sources (see LocalAuthoringFetcher)."""

    def __init__(self, source_key: str, config: Dict[str, Any]):
        self.source_key = source_key
        self.config = config

    def build_url(self, endpoint_path: str) -> str:
        base_url = self.config.get("base_url") or self.config.get("url", "")
        if endpoint_path.startswith("http"):
            return endpoint_path
        if base_url.endswith("/") and endpoint_path.startswith("/"):
            return base_url + endpoint_path[1:]
        if not base_url.endswith("/") and not endpoint_path.startswith("/"):
            return base_url + "/" + endpoint_path
        return base_url + endpoint_path

    def fetch_endpoint(self, name: str, path: str) -> EndpointFetchResult:
        url = self.build_url(path)
        try:
            res = requests.get(url, timeout=30)
            res.raise_for_status()
            content = res.content
            etag = res.headers.get("ETag") or res.headers.get("Last-Modified")
            content_hash = hashlib.sha256(content).hexdigest()
            return EndpointFetchResult(
                name, ok=True, content=content, content_hash=content_hash,
                etag=str(etag).strip('"') if etag else None,
            )
        except Exception as e:
            return EndpointFetchResult(name, ok=False, error=str(e))


class FetcherRegistry:
    """Registry for per-endpoint fetchers."""

    _registry: Dict[str, Type[BaseFetcher]] = {}

    @classmethod
    def register(cls, source_key: str):
        def decorator(subclass: Type[BaseFetcher]):
            cls._registry[source_key] = subclass
            return subclass
        return decorator

    @classmethod
    def get_fetcher_class(cls, source_key: str) -> Optional[Type[BaseFetcher]]:
        return cls._registry.get(source_key)
```

- [ ] **Step 3: Verify it imports cleanly on its own**

Run: `uv run python3 -c "from src.fetchers.base import BaseFetcher, EndpointFetchResult, FetcherRegistry; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/fetchers/__init__.py src/fetchers/base.py
git commit -m "Add new per-endpoint BaseFetcher + FetcherRegistry (fetch-verification pipeline)"
```

(Task 2's `__init__.py` imports 7 sibling modules that don't exist yet — Step 3's
verify command imports `src.fetchers.base` directly, not the package `__init__`,
so it passes before Task 3 lands. `import src.fetchers` will fail until Task 3
is done; that's expected mid-plan.)

---

### Task 3: New per-source fetcher classes

**Files:**
- Create: `src/fetchers/pogoapi_net.py`
- Create: `src/fetchers/pokemon_go_api.py`
- Create: `src/fetchers/pokeapi.py`
- Create: `src/fetchers/alexelgt_game_masters.py`
- Create: `src/fetchers/pvpoke.py`
- Create: `src/fetchers/rplus_shiny.py`
- Create: `src/fetchers/local_authoring.py`

**Interfaces:**
- Consumes: `BaseFetcher`, `EndpointFetchResult`, `FetcherRegistry` from Task 2.
- Produces: one registered fetcher class per source_key, each usable via
  `FetcherRegistry.get_fetcher_class(source_key)(source_key, source_cfg).fetch_endpoint(name, path)`.

Six of the seven sources need no override — the generic `BaseFetcher.fetch_endpoint()`
(HTTP GET + byte hash) already does the right thing once `build_url()` has a `base_url`
or `url` to combine with the endpoint's `path`. Only `local_authoring` (local files,
not HTTP) needs a real override.

- [ ] **Step 1: The six generic sources**

`src/fetchers/pogoapi_net.py`:
```python
from .base import BaseFetcher, FetcherRegistry


@FetcherRegistry.register("pogoapi_net")
class PogoApiFetcher(BaseFetcher):
    """Static reference endpoints from pogoapi.net. Generic fetch_endpoint()."""
```

`src/fetchers/pokemon_go_api.py`:
```python
from .base import BaseFetcher, FetcherRegistry


@FetcherRegistry.register("pokemon_go_api")
class PokemonGoApiFetcher(BaseFetcher):
    """Endpoints from pokemon-go-api.github.io. Generic fetch_endpoint().

    Sprite asset download (the deleted legacy fetcher's download_assets())
    is not part of the per-endpoint model and isn't ported here -- assets
    aren't a JSON endpoint. Revisit if/when assets need their own tracked
    pipeline.
    """
```

`src/fetchers/pokeapi.py`:
```python
from .base import BaseFetcher, FetcherRegistry


@FetcherRegistry.register("pokeapi")
class PokeApiFetcher(BaseFetcher):
    """Resource-type endpoints from pokeapi.co. Generic fetch_endpoint()."""
```

`src/fetchers/alexelgt_game_masters.py`:
```python
from .base import BaseFetcher, FetcherRegistry


@FetcherRegistry.register("alexelgt_game_masters")
class GameMasterFetcher(BaseFetcher):
    """Single-endpoint GAME_MASTER.json source. Generic fetch_endpoint()."""
```

`src/fetchers/pvpoke.py`:
```python
from .base import BaseFetcher, FetcherRegistry


@FetcherRegistry.register("pvpoke")
class PvPokeFetcher(BaseFetcher):
    """Single-endpoint PvPoke gamemaster.json source. Generic fetch_endpoint()."""
```

`src/fetchers/rplus_shiny.py`:
```python
from .base import BaseFetcher, FetcherRegistry


@FetcherRegistry.register("rplus_shiny")
class RplusShinyFetcher(BaseFetcher):
    """Single-endpoint shiny-release sheet source. Generic fetch_endpoint()."""
```

- [ ] **Step 2: `local_authoring` (local files, needs a real override)**

`src/fetchers/local_authoring.py`:
```python
import hashlib
from pathlib import Path

from .base import BaseFetcher, EndpointFetchResult, FetcherRegistry


@FetcherRegistry.register("local_authoring")
class LocalAuthoringFetcher(BaseFetcher):
    """In-repo hand-maintained files, archived like any other endpoint.

    Two endpoints, not one -- config/sources.yml's `files:` list has two
    entries (costume-lookup.json, community-submissions.json) despite the
    spec text describing local_authoring as single-item; see
    config/source_templates/local_authoring_endpoints.yml (Task 5).
    `path` here is a local filesystem path, not a URL.
    """

    def fetch_endpoint(self, name: str, path: str) -> EndpointFetchResult:
        file_path = Path(path)
        if not file_path.exists():
            return EndpointFetchResult(name, ok=False, error=f"{file_path} not found")
        content = file_path.read_bytes()
        content_hash = hashlib.sha256(content).hexdigest()
        return EndpointFetchResult(name, ok=True, content=content, content_hash=content_hash, etag=None)
```

- [ ] **Step 3: Verify the package imports and every source is registered**

Run:
```bash
uv run python3 -c "
import src.fetchers as f
expected = {'pogoapi_net', 'pokemon_go_api', 'pokeapi', 'alexelgt_game_masters', 'pvpoke', 'rplus_shiny', 'local_authoring'}
registered = set(f.FetcherRegistry._registry.keys())
assert registered == expected, registered
print('ok', sorted(registered))
"
```
Expected: `ok [...]` listing all 7 source keys, no traceback.

- [ ] **Step 4: Commit**

```bash
git add src/fetchers/
git commit -m "Add new per-endpoint fetcher classes for all 7 sources"
```

---

### Task 4: `src/endpoint_registry.py` — `_endpoints.yml` load/save

**Files:**
- Create: `src/endpoint_registry.py`

**Interfaces:**
- Produces: `load_endpoint_registry(source_key, templates_dir=...) -> dict` (keys `active`,
  `candidates`, `ignored`, `last_discovered_at`); `save_endpoint_registry(source_key, registry, templates_dir=...)`;
  `add_candidate(registry, name, path_value) -> bool` (True if newly added). Consumed by
  Task 6 (discovery) and Task 9 (orchestrator).

- [ ] **Step 1: Write the module**

`src/endpoint_registry.py`:
```python
"""Loads/saves config/source_templates/<source>_endpoints.yml -- the
per-source active/candidates/ignored endpoint registry (spec section 2).
"""

from pathlib import Path
from typing import Any, Dict

import yaml

TEMPLATES_DIR = Path("config/source_templates")


def registry_path(source_key: str, templates_dir: Path = TEMPLATES_DIR) -> Path:
    return templates_dir / f"{source_key}_endpoints.yml"


def load_endpoint_registry(source_key: str, templates_dir: Path = TEMPLATES_DIR) -> Dict[str, Any]:
    path = registry_path(source_key, templates_dir)
    if not path.exists():
        return {"active": [], "candidates": [], "ignored": [], "last_discovered_at": None}
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    data.setdefault("active", [])
    data.setdefault("candidates", [])
    data.setdefault("ignored", [])
    data.setdefault("last_discovered_at", None)
    return data


def save_endpoint_registry(source_key: str, registry: Dict[str, Any], templates_dir: Path = TEMPLATES_DIR) -> None:
    path = registry_path(source_key, templates_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(registry, f, sort_keys=False, allow_unicode=True)


def add_candidate(registry: Dict[str, Any], name: str, path_value: str) -> bool:
    """Appends a new candidate if `name` isn't already active/candidate/ignored.
    Returns True if it was newly added."""
    import datetime

    known_names = {e["name"] for e in registry["active"] + registry["candidates"] + registry["ignored"]}
    if name in known_names:
        return False
    registry["candidates"].append({
        "name": name,
        "path": path_value,
        "discovered_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    })
    return True
```

- [ ] **Step 2: Verify round-trip in a scratch location**

Run:
```bash
uv run python3 -c "
from pathlib import Path
from src.endpoint_registry import load_endpoint_registry, save_endpoint_registry, add_candidate
import tempfile

d = Path(tempfile.mkdtemp())
reg = load_endpoint_registry('does_not_exist_yet', templates_dir=d)
assert reg == {'active': [], 'candidates': [], 'ignored': [], 'last_discovered_at': None}
added = add_candidate(reg, 'foo', '/foo.json')
assert added is True
added_again = add_candidate(reg, 'foo', '/foo.json')
assert added_again is False
save_endpoint_registry('does_not_exist_yet', reg, templates_dir=d)
reg2 = load_endpoint_registry('does_not_exist_yet', templates_dir=d)
assert reg2['candidates'][0]['name'] == 'foo'
print('ok')
"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/endpoint_registry.py
git commit -m "Add endpoint_registry.py: load/save config/source_templates/*_endpoints.yml"
```

---

### Task 5: Seed `_endpoints.yml` for all 7 sources

**Files:**
- Create: `config/source_templates/pogoapi_net_endpoints.yml`
- Create: `config/source_templates/pokemon_go_api_endpoints.yml`
- Create: `config/source_templates/pokeapi_endpoints.yml`
- Create: `config/source_templates/alexelgt_game_masters_endpoints.yml`
- Create: `config/source_templates/pvpoke_endpoints.yml`
- Create: `config/source_templates/rplus_shiny_endpoints.yml`
- Create: `config/source_templates/local_authoring_endpoints.yml`

Seeded directly from `config/sources.yml`'s current `endpoints:`/`url:`/`files:` values
(read that file again if needed — this is a data-entry task, not code). All 7 files use
`last_verified_at: null` (this plan doesn't run a live fetch pass against every endpoint;
Task 12's smoke test populates real timestamps for the handful it exercises) and
`last_discovered_at: null` (no discovery pass has run yet).

- [ ] **Step 1: `pogoapi_net` (19 endpoints, copied from `sources.yml`'s current list)**

`config/source_templates/pogoapi_net_endpoints.yml`:
```yaml
active:
  - {name: cp_multiplier, path: /cp_multiplier.json, last_verified_at: null}
  - {name: pokemon_types, path: /pokemon_types.json, last_verified_at: null}
  - {name: type_effectiveness, path: /type_effectiveness.json, last_verified_at: null}
  - {name: weather_boosts, path: /weather_boosts.json, last_verified_at: null}
  - {name: pokemon_max_cp, path: /pokemon_max_cp.json, last_verified_at: null}
  - {name: pokemon_rarity, path: /pokemon_rarity.json, last_verified_at: null}
  - {name: pokemon_stats, path: /pokemon_stats.json, last_verified_at: null}
  - {name: fast_moves, path: /fast_moves.json, last_verified_at: null}
  - {name: charged_moves, path: /charged_moves.json, last_verified_at: null}
  - {name: shadow_pokemon, path: /shadow_pokemon.json, last_verified_at: null}
  - {name: mega_pokemon, path: /mega_pokemon.json, last_verified_at: null}
  - {name: community_days, path: /community_days.json, last_verified_at: null}
  - {name: alolan_pokemon, path: /alolan_pokemon.json, last_verified_at: null}
  - {name: galarian_pokemon, path: /galarian_pokemon.json, last_verified_at: null}
  - {name: released_pokemon, path: /released_pokemon.json, last_verified_at: null}
  - {name: nesting_pokemon, path: /nesting_pokemon.json, last_verified_at: null}
  - {name: shiny_pokemon, path: /shiny_pokemon.json, last_verified_at: null}
  - {name: baby_pokemon, path: /baby_pokemon.json, last_verified_at: null}
  - {name: badges, path: /badges.json, last_verified_at: null}
candidates: []
ignored: []
last_discovered_at: null
```

- [ ] **Step 2: `pokemon_go_api` (5 endpoints, verified live during planning — repo
`pokemon-go-api/pokemon-go-api`, branch `gh-pages`, path `api/`, also contains
`hashes.json` (metadata, not an endpoint) and a `pokedex/` subdirectory (per-species
files, out of scope) not listed as candidates here since this is the seed, not a
discovery result)**

`config/source_templates/pokemon_go_api_endpoints.yml`:
```yaml
active:
  - {name: pokedex, path: /pokedex.json, last_verified_at: null}
  - {name: maxbattles, path: /maxbattles.json, last_verified_at: null}
  - {name: raidboss, path: /raidboss.json, last_verified_at: null}
  - {name: quests, path: /quests.json, last_verified_at: null}
  - {name: types, path: /types.json, last_verified_at: null}
candidates: []
ignored: []
last_discovered_at: null
```

- [ ] **Step 3: `pokeapi` (seeded from the legacy fetcher's auto_index fallback list:
`pokemon`, `pokemon-species`, `type`, `move` — verified live against `/api/v2/` during
planning)**

`config/source_templates/pokeapi_endpoints.yml`:
```yaml
active:
  - {name: pokemon, path: "/pokemon?limit=1025", last_verified_at: null}
  - {name: pokemon_species, path: "/pokemon-species?limit=1025", last_verified_at: null}
  - {name: type, path: "/type?limit=1025", last_verified_at: null}
  - {name: move, path: "/move?limit=1025", last_verified_at: null}
candidates: []
ignored: []
last_discovered_at: null
```

- [ ] **Step 4: The three single/multi-item sources**

`config/source_templates/alexelgt_game_masters_endpoints.yml`:
```yaml
active:
  - {name: GAME_MASTER, path: "https://raw.githubusercontent.com/alexelgt/game_masters/master/GAME_MASTER.json", last_verified_at: null}
candidates: []
ignored: []
last_discovered_at: null
```

`config/source_templates/pvpoke_endpoints.yml`:
```yaml
active:
  - {name: gamemaster, path: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json", last_verified_at: null}
candidates: []
ignored: []
last_discovered_at: null
```

`config/source_templates/rplus_shiny_endpoints.yml`:
```yaml
active:
  - {name: shiny_releases, path: "https://opensheet.elk.sh/13UreWc5Nq4yiLYvDRt2RyPWXsDx9y4pMWhSD0JsnHCw/1", last_verified_at: null}
candidates: []
ignored: []
last_discovered_at: null
```

Note: these three sources' `path` is a full URL, not a `base_url`-relative path —
`BaseFetcher.build_url()` (Task 2) already handles this (`if endpoint_path.startswith("http"): return endpoint_path`).

`config/source_templates/local_authoring_endpoints.yml`:
```yaml
active:
  - {name: costume_lookup, path: "data-authoring/costume-lookup.json", last_verified_at: null}
  - {name: community_submissions, path: "data-authoring/community-submissions.json", last_verified_at: null}
candidates: []
ignored: []
last_discovered_at: null
```

- [ ] **Step 5: Verify all 7 load cleanly via the Task 4 loader**

Run:
```bash
uv run python3 -c "
from src.endpoint_registry import load_endpoint_registry
sources = ['pogoapi_net', 'pokemon_go_api', 'pokeapi', 'alexelgt_game_masters', 'pvpoke', 'rplus_shiny', 'local_authoring']
for s in sources:
    reg = load_endpoint_registry(s)
    assert reg['active'], f'{s} has no active endpoints'
    print(s, len(reg['active']), 'active endpoints')
"
```
Expected: 7 lines, one per source, each with a nonzero endpoint count (19, 5, 4, 1, 1, 1, 2).

- [ ] **Step 6: Commit**

```bash
git add config/source_templates/*_endpoints.yml
git commit -m "Seed config/source_templates/*_endpoints.yml for all 7 sources"
```

---

### Task 6: `src/discovery.py` — `discover_endpoints()` + staleness gate

**Files:**
- Create: `src/discovery.py`

**Interfaces:**
- Consumes: `endpoint_registry` dict shape from Task 4.
- Produces: `discover_endpoints(source_key, config, registry) -> List[Dict[str, str]]`
  (list of `{"name", "path"}` not already known); `needs_reexplore(registry, interval_days) -> bool`.
  Consumed by Task 9's `run_discovery_pass`.

All three sources with a real listing mechanism get a verified-live override
(confirmed via `curl` during planning, not guessed): `pokemon_go_api` via
GitHub's contents API (`pokemon-go-api/pokemon-go-api`, branch `gh-pages`,
path `api/`); `pokeapi` via its own `/api/v2/` root resource index;
`pogoapi_net` via its own `https://pogoapi.net/api/v1/api_hashes.json`
listing (47 files total as of 2026-08-04, vs. 19 in the current `active`
seed — genuine discovery value, e.g. `pokemon_evolutions.json`,
`raid_bosses.json`, `pvp_charged_moves.json` all show up as candidates).

- [ ] **Step 1: Write the module**

`src/discovery.py`:
```python
"""discover_endpoints() hooks + staleness gate (spec section 3).

Default is an explicit no-op ("no discovery available for this source") --
used by alexelgt_game_masters, pvpoke, rplus_shiny, local_authoring (no
listable "other endpoints" concept). pokemon_go_api, pokeapi, and
pogoapi_net have real overrides below, all verified live during planning.
"""

import datetime
from typing import Any, Dict, List

import requests


def needs_reexplore(registry: Dict[str, Any], interval_days: int) -> bool:
    last = registry.get("last_discovered_at")
    if not last:
        return True
    last_dt = datetime.datetime.fromisoformat(last)
    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=datetime.timezone.utc)
    age = datetime.datetime.now(datetime.timezone.utc) - last_dt
    return age.days >= interval_days


def _known_names(registry: Dict[str, Any]) -> set:
    return {e["name"] for e in registry["active"] + registry["candidates"] + registry["ignored"]}


def _discover_github_contents(owner: str, repo: str, ref: str, dir_path: str, registry: Dict[str, Any]) -> List[Dict[str, str]]:
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{dir_path}?ref={ref}"
    res = requests.get(url, timeout=15)
    res.raise_for_status()
    entries = res.json()
    known = _known_names(registry)
    found = []
    for entry in entries:
        if entry.get("type") != "file" or not entry["name"].endswith(".json"):
            continue
        if entry["name"] == "hashes.json":
            continue
        name = entry["name"][:-5]
        if name in known:
            continue
        found.append({"name": name, "path": f"/{entry['name']}"})
    return found


def _discover_pokemon_go_api(config: Dict[str, Any], registry: Dict[str, Any]) -> List[Dict[str, str]]:
    return _discover_github_contents("pokemon-go-api", "pokemon-go-api", "gh-pages", "api", registry)


def _discover_pokeapi(config: Dict[str, Any], registry: Dict[str, Any]) -> List[Dict[str, str]]:
    base_url = config.get("base_url", "https://pokeapi.co/api/v2")
    index_url = base_url if base_url.endswith("/") else base_url + "/"
    res = requests.get(index_url, timeout=15)
    res.raise_for_status()
    index_map = res.json()
    known = _known_names(registry)
    found = []
    for res_key in sorted(index_map.keys()):
        name = res_key.replace("-", "_")
        if name in known:
            continue
        found.append({"name": name, "path": f"/{res_key}?limit=1025"})
    return found


def _discover_pogoapi_net(config: Dict[str, Any], registry: Dict[str, Any]) -> List[Dict[str, str]]:
    """pogoapi.net exposes its own file listing at /api_hashes.json -- a dict
    keyed by filename (e.g. "raid_bosses.json") with per-file content hashes.
    No GitHub lookup needed; verified live during planning (47 files total
    as of 2026-08-04, vs. 19 in the current active seed)."""
    base_url = config.get("base_url", "https://pogoapi.net/api/v1")
    hashes_url = base_url.rstrip("/") + "/api_hashes.json"
    res = requests.get(hashes_url, timeout=15)
    res.raise_for_status()
    file_map = res.json()
    known = _known_names(registry)
    found = []
    for filename in sorted(file_map.keys()):
        if not filename.endswith(".json") or filename == "api_hashes.json":
            continue
        name = filename[:-5]
        if name in known:
            continue
        found.append({"name": name, "path": f"/{filename}"})
    return found


_DISCOVERERS = {
    "pokemon_go_api": _discover_pokemon_go_api,
    "pokeapi": _discover_pokeapi,
    "pogoapi_net": _discover_pogoapi_net,
}


def discover_endpoints(source_key: str, config: Dict[str, Any], registry: Dict[str, Any]) -> List[Dict[str, str]]:
    fn = _DISCOVERERS.get(source_key)
    if fn is None:
        print(f"[{source_key}] No discovery available for this source.")
        return []
    return fn(config, registry)
```

- [ ] **Step 2: Verify the staleness gate logic (no network needed)**

Run:
```bash
uv run python3 -c "
import datetime
from src.discovery import needs_reexplore

fresh = {'last_discovered_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
stale = {'last_discovered_at': (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=10)).isoformat()}
never = {'last_discovered_at': None}

assert needs_reexplore(fresh, 7) is False
assert needs_reexplore(stale, 7) is True
assert needs_reexplore(never, 7) is True
print('ok')
"
```
Expected: `ok`

- [ ] **Step 3: Verify the default no-op for a source with no override**

Run: `uv run python3 -c "from src.discovery import discover_endpoints; print(discover_endpoints('pvpoke', {}, {'active': [], 'candidates': [], 'ignored': []}))"`
Expected: prints `[pvpoke] No discovery available for this source.` then `[]`

- [ ] **Step 4: Live-verify the three real overrides (requires network)**

Run:
```bash
uv run python3 -c "
from src.discovery import discover_endpoints
from src.endpoint_registry import load_endpoint_registry

configs = {
    'pokemon_go_api': {},
    'pokeapi': {'base_url': 'https://pokeapi.co/api/v2'},
    'pogoapi_net': {'base_url': 'https://pogoapi.net/api/v1'},
}
for source_key, cfg in configs.items():
    reg = load_endpoint_registry(source_key)
    found = discover_endpoints(source_key, cfg, reg)
    print(source_key, 'new candidates:', len(found), [f['name'] for f in found][:5], '...')
"
```
Expected: no traceback. `pokemon_go_api` prints an empty or small list (everything in
its seed is already `active`, so genuinely new names would only appear if upstream
added files since 2026-08-04). `pokeapi` lists many names (only 4 of ~50+ PokeAPI
resource types are seeded active). `pogoapi_net` lists roughly 28 names (47 upstream
files vs. 19 seeded active) — all three are correct, expected behavior, not a bug.

- [ ] **Step 5: Commit**

```bash
git add src/discovery.py
git commit -m "Add discovery.py: discover_endpoints() + reexplore staleness gate"
```

---

### Task 7: `src/snapshot_store.py` — `latest/`+`history/` layout

**Files:**
- Create: `src/snapshot_store.py`

**Interfaces:**
- Produces: `write_endpoint_result(source_key, endpoint_name, content, content_hash, fetched_at, etag, raw_dumps_dir=...)`;
  `mark_endpoint_failed(source_key, endpoint_name, error, raw_dumps_dir=...)`;
  `load_manifest(source_key, raw_dumps_dir=...) -> dict`; `read_latest(source_key, endpoint_name, raw_dumps_dir=...) -> Optional[Any]`.
  Consumed by Task 9's orchestrator.

- [ ] **Step 1: Write the module**

`src/snapshot_store.py`:
```python
"""raw_dumps/<source>/latest/ + history/ snapshot storage (spec section 4),
including the empty-snapshot fix: a failed endpoint never has its
latest/<endpoint>.json deleted, only its manifest status flipped."""

import json
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

RAW_DUMPS_DIR = Path("raw_dumps")


def source_dir(source_key: str, raw_dumps_dir: Path = RAW_DUMPS_DIR) -> Path:
    return raw_dumps_dir / source_key


def latest_dir(source_key: str, raw_dumps_dir: Path = RAW_DUMPS_DIR) -> Path:
    return source_dir(source_key, raw_dumps_dir) / "latest"


def manifest_path(source_key: str, raw_dumps_dir: Path = RAW_DUMPS_DIR) -> Path:
    return latest_dir(source_key, raw_dumps_dir) / ".manifest.json"


def load_manifest(source_key: str, raw_dumps_dir: Path = RAW_DUMPS_DIR) -> Dict[str, Any]:
    path = manifest_path(source_key, raw_dumps_dir)
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_manifest(source_key: str, manifest: Dict[str, Any], raw_dumps_dir: Path = RAW_DUMPS_DIR) -> None:
    path = manifest_path(source_key, raw_dumps_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


def write_endpoint_result(
    source_key: str,
    endpoint_name: str,
    content: bytes,
    content_hash: str,
    fetched_at: str,
    etag: Optional[str],
    raw_dumps_dir: Path = RAW_DUMPS_DIR,
) -> None:
    """Writes a changed-or-new endpoint payload. Caller (orchestrator) must
    only call this when content_hash differs from the manifest's recorded
    hash -- unchanged content should leave fetched_at alone entirely."""
    ldir = latest_dir(source_key, raw_dumps_dir)
    ldir.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(source_key, raw_dumps_dir)

    outgoing_file = ldir / f"{endpoint_name}.json"
    if outgoing_file.exists():
        outgoing_meta = manifest.get(endpoint_name, {})
        outgoing_fetched_at = outgoing_meta.get("fetched_at", "unknown").replace(":", "")
        history_dir = source_dir(source_key, raw_dumps_dir) / "history" / outgoing_fetched_at
        history_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(outgoing_file), str(history_dir / f"{endpoint_name}.json"))

    outgoing_file.write_bytes(content)
    manifest[endpoint_name] = {
        "content_hash": content_hash,
        "fetched_at": fetched_at,
        "etag": etag,
        "status": "ok",
        "error": None,
    }
    save_manifest(source_key, manifest, raw_dumps_dir)


def mark_endpoint_failed(source_key: str, endpoint_name: str, error: str, raw_dumps_dir: Path = RAW_DUMPS_DIR) -> None:
    """Flips status to failed WITHOUT touching latest/<endpoint>.json -- last-known-good
    data is never deleted by a failed run (spec 'Empty-snapshot fix')."""
    manifest = load_manifest(source_key, raw_dumps_dir)
    entry = manifest.get(endpoint_name, {})
    entry["status"] = "failed"
    entry["error"] = error
    manifest[endpoint_name] = entry
    save_manifest(source_key, manifest, raw_dumps_dir)


def read_latest(source_key: str, endpoint_name: str, raw_dumps_dir: Path = RAW_DUMPS_DIR) -> Optional[Any]:
    path = latest_dir(source_key, raw_dumps_dir) / f"{endpoint_name}.json"
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
```

- [ ] **Step 2: Verify write → archive-on-change → read, using a scratch `raw_dumps_dir`**

Run:
```bash
uv run python3 -c "
import json, tempfile
from pathlib import Path
from src.snapshot_store import write_endpoint_result, mark_endpoint_failed, read_latest, load_manifest

d = Path(tempfile.mkdtemp())

write_endpoint_result('src_a', 'ep1', b'{\"v\": 1}', 'hash1', '2026-01-01T000000Z', None, raw_dumps_dir=d)
assert read_latest('src_a', 'ep1', raw_dumps_dir=d) == {'v': 1}
assert not (d / 'src_a' / 'history').exists()  # first write, nothing to archive

write_endpoint_result('src_a', 'ep1', b'{\"v\": 2}', 'hash2', '2026-01-02T000000Z', None, raw_dumps_dir=d)
assert read_latest('src_a', 'ep1', raw_dumps_dir=d) == {'v': 2}
archived = d / 'src_a' / 'history' / '2026-01-01T000000Z' / 'ep1.json'
assert archived.exists(), 'outgoing version should be archived under its OWN fetched_at'
assert json.loads(archived.read_text()) == {'v': 1}

mark_endpoint_failed('src_a', 'ep1', 'timeout', raw_dumps_dir=d)
assert read_latest('src_a', 'ep1', raw_dumps_dir=d) == {'v': 2}, 'failed run must not delete last-known-good'
manifest = load_manifest('src_a', raw_dumps_dir=d)
assert manifest['ep1']['status'] == 'failed'
assert manifest['ep1']['error'] == 'timeout'
print('ok')
"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/snapshot_store.py
git commit -m "Add snapshot_store.py: latest/+history/ layout with the empty-snapshot fix"
```

---

### Task 8: `src/fetch_history.py` — central attempt log

**Files:**
- Create: `src/fetch_history.py`

**Interfaces:**
- Produces: `append_fetch_attempt(source, endpoint, timestamp, outcome, error=None, history_path=...)`.
  Consumed by Task 9's orchestrator.

This is the "logging aspect" of the new report system, per user clarification: a
durable, timestamped, append-only record `go_refs.py` will eventually parse into
the Fetch report section (Task 10 renders it via `run_fetch_pass()`'s summary
today; a future CLI-wiring task could additionally read this raw log directly for
a "how flaky is this endpoint over time" view — not built this round, but the log
itself is durable and complete from day one).

- [ ] **Step 1: Write the module**

`src/fetch_history.py`:
```python
"""Central raw_dumps/.fetch_history.jsonl append-only log (spec section 5) --
every attempt, not just failures, so 'is this endpoint chronically flaky'
is answerable by reading one file."""

import json
from pathlib import Path
from typing import Optional

HISTORY_PATH = Path("raw_dumps/.fetch_history.jsonl")


def append_fetch_attempt(
    source: str,
    endpoint: str,
    timestamp: str,
    outcome: str,
    error: Optional[str] = None,
    history_path: Path = HISTORY_PATH,
) -> None:
    history_path.parent.mkdir(parents=True, exist_ok=True)
    record = {"source": source, "endpoint": endpoint, "timestamp": timestamp, "outcome": outcome}
    if error:
        record["error"] = error
    with open(history_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
```

- [ ] **Step 2: Verify append + read-back, using a scratch path**

Run:
```bash
uv run python3 -c "
import json, tempfile
from pathlib import Path
from src.fetch_history import append_fetch_attempt

p = Path(tempfile.mkdtemp()) / '.fetch_history.jsonl'
append_fetch_attempt('pokeapi', 'move', '2026-08-04T09:00:01Z', 'failed', error='timeout after 30s', history_path=p)
append_fetch_attempt('pokeapi', 'move', '2026-08-04T09:00:05Z', 'changed', history_path=p)
lines = p.read_text().strip().split(chr(10))
assert len(lines) == 2
first = json.loads(lines[0])
assert first == {'source': 'pokeapi', 'endpoint': 'move', 'timestamp': '2026-08-04T09:00:01Z', 'outcome': 'failed', 'error': 'timeout after 30s'}
print('ok')
"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/fetch_history.py
git commit -m "Add fetch_history.py: central .fetch_history.jsonl attempt log"
```

---

### Task 9: `src/fetch_orchestrator.py` — worklist + retry sweep + discovery pass + unassigned-endpoint check

**Files:**
- Create: `src/fetch_orchestrator.py`

**Interfaces:**
- Consumes: `FetcherRegistry` (Task 2), `endpoint_registry` (Task 4), `discovery` (Task 6),
  `snapshot_store` (Task 7), `fetch_history` (Task 8).
- Produces: `build_worklist(sources_config) -> List[dict]`; `run_fetch_pass(sources_config) -> dict`
  (`{"succeeded": [...], "failed": [...], "unassigned": [...]}`, keys formatted `"{source_key}:{endpoint_name}"`);
  `run_discovery_pass(sources_config, interval_days, force=False) -> dict` (`{source_key: [new candidate names]}`).
  Consumed by Task 10 (report) and Task 12 (smoke test).

- [ ] **Step 1: Write the module**

`src/fetch_orchestrator.py`:
```python
"""Per-endpoint fetch worklist + cross-source retry queue (spec section 1).

Builds one flat worklist of (source, endpoint) pairs across every enabled
source, attempts each once in source order, then re-queues only the
failures and retries the queue after the FULL first pass completes -- up to
MAX_ATTEMPTS total attempts per endpoint. A source's failures never block
later sources; retries never happen inline within one source's own loop.

Also flags "un-assigned" endpoints: fetched successfully but with no
matching config/source_templates/*.yml schema-mapping template, so nothing
downstream can use the data yet. Best-effort heuristic (exact filename
match) -- src/paranoid_check.py's find_templates_for_source()/
mapped_source_fields() do the thorough, field-level version; reuse that
later if this heuristic proves too noisy.
"""

import datetime
from pathlib import Path
from typing import Any, Dict, List

from src import discovery, endpoint_registry, fetch_history, snapshot_store
from src.fetchers.base import FetcherRegistry

MAX_ATTEMPTS = 3
TEMPLATES_DIR = Path("config/source_templates")


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def build_worklist(sources_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    worklist = []
    for source_key, source_cfg in sources_config.items():
        if not source_cfg.get("enabled", True):
            continue
        reg = endpoint_registry.load_endpoint_registry(source_key)
        for ep in reg["active"]:
            worklist.append({
                "source_key": source_key,
                "source_cfg": source_cfg,
                "name": ep["name"],
                "path": ep["path"],
            })
    return worklist


def _attempt_one(item: Dict[str, Any]) -> bool:
    fetcher_cls = FetcherRegistry.get_fetcher_class(item["source_key"])
    if fetcher_cls is None:
        fetch_history.append_fetch_attempt(item["source_key"], item["name"], _now_iso(), "failed", error="no fetcher registered")
        return False

    fetcher = fetcher_cls(item["source_key"], item["source_cfg"])
    result = fetcher.fetch_endpoint(item["name"], item["path"])

    if not result.ok:
        fetch_history.append_fetch_attempt(item["source_key"], item["name"], _now_iso(), "failed", error=result.error)
        return False

    manifest = snapshot_store.load_manifest(item["source_key"])
    prior_hash = manifest.get(item["name"], {}).get("content_hash")
    if prior_hash != result.content_hash:
        snapshot_store.write_endpoint_result(
            item["source_key"], item["name"], result.content, result.content_hash,
            _now_iso(), result.etag,
        )
        fetch_history.append_fetch_attempt(item["source_key"], item["name"], _now_iso(), "changed")
    else:
        fetch_history.append_fetch_attempt(item["source_key"], item["name"], _now_iso(), "unchanged")
    return True


def find_unassigned_endpoints(succeeded_keys: List[str], templates_dir: Path = TEMPLATES_DIR) -> List[str]:
    """An endpoint is 'unassigned' if neither <source>.yml nor
    <source>_<endpoint>.yml exists under templates_dir. Heuristic only --
    doesn't follow a template's own source_key: override (e.g.
    alexelgt_game_masters' templates are named game_master_*.yml)."""
    unassigned = []
    for key in succeeded_keys:
        source_key, endpoint_name = key.split(":", 1)
        whole_source = templates_dir / f"{source_key}.yml"
        per_endpoint = templates_dir / f"{source_key}_{endpoint_name}.yml"
        if not whole_source.exists() and not per_endpoint.exists():
            unassigned.append(key)
    return unassigned


def run_fetch_pass(sources_config: Dict[str, Any]) -> Dict[str, Any]:
    worklist = build_worklist(sources_config)
    pending = list(worklist)
    attempts_used = {f"{i['source_key']}:{i['name']}": 0 for i in worklist}
    succeeded, failed = set(), set()

    for _ in range(MAX_ATTEMPTS):
        if not pending:
            break
        next_pending = []
        for item in pending:
            key = f"{item['source_key']}:{item['name']}"
            attempts_used[key] += 1
            ok = _attempt_one(item)
            if ok:
                succeeded.add(key)
            elif attempts_used[key] < MAX_ATTEMPTS:
                next_pending.append(item)
            else:
                failed.add(key)
                snapshot_store.mark_endpoint_failed(item["source_key"], item["name"], "exhausted retries")
        pending = next_pending

    unassigned = find_unassigned_endpoints(sorted(succeeded))
    return {"succeeded": sorted(succeeded), "failed": sorted(failed), "unassigned": unassigned}


def run_discovery_pass(sources_config: Dict[str, Any], interval_days: int, force: bool = False) -> Dict[str, List[str]]:
    results = {}
    for source_key, source_cfg in sources_config.items():
        if not source_cfg.get("enabled", True):
            continue
        reg = endpoint_registry.load_endpoint_registry(source_key)
        if not force and not discovery.needs_reexplore(reg, interval_days):
            continue
        found = discovery.discover_endpoints(source_key, source_cfg, reg)
        added = [f["name"] for f in found if endpoint_registry.add_candidate(reg, f["name"], f["path"])]
        reg["last_discovered_at"] = _now_iso()
        endpoint_registry.save_endpoint_registry(source_key, reg)
        results[source_key] = added
    return results
```

- [ ] **Step 2: Verify `build_worklist()` against the real seeded registries (no network)**

Run:
```bash
uv run python3 -c "
from src.fetch_orchestrator import build_worklist

sources_config = {
    'pogoapi_net': {'enabled': True},
    'pokemon_go_api': {'enabled': True},
    'pokeapi': {'enabled': True},
    'alexelgt_game_masters': {'enabled': True},
    'pvpoke': {'enabled': True},
    'rplus_shiny': {'enabled': True},
    'local_authoring': {'enabled': True},
    'disabled_source': {'enabled': False},
}
worklist = build_worklist(sources_config)
by_source = {}
for item in worklist:
    by_source.setdefault(item['source_key'], 0)
    by_source[item['source_key']] += 1
assert by_source == {
    'pogoapi_net': 19, 'pokemon_go_api': 5, 'pokeapi': 4,
    'alexelgt_game_masters': 1, 'pvpoke': 1, 'rplus_shiny': 1, 'local_authoring': 2,
}, by_source
assert 'disabled_source' not in by_source
print('ok', sum(by_source.values()), 'total endpoints')
"
```
Expected: `ok 33 total endpoints`

- [ ] **Step 3: Verify one real end-to-end fetch pass against a single cheap, real endpoint**

Run:
```bash
uv run python3 -c "
from src.fetch_orchestrator import run_fetch_pass
from src.snapshot_store import read_latest

# local_authoring's costume_lookup.json is a real local file -- no network needed,
# fastest real end-to-end check of the whole pipeline.
sources_config = {'local_authoring': {'enabled': True, 'files': ['data-authoring/costume-lookup.json', 'data-authoring/community-submissions.json']}}
summary = run_fetch_pass(sources_config)
print(summary)
assert 'local_authoring:costume_lookup' in summary['succeeded']
data = read_latest('local_authoring', 'costume_lookup')
assert data is not None
print('ok')
"
```
Expected: `{'succeeded': [...], 'failed': [], 'unassigned': [...]}` then `ok`. Inspect
`raw_dumps/local_authoring/latest/.manifest.json` afterward — should show
`costume_lookup` and `community_submissions` with `status: ok`. `unassigned` will
likely list both (no `local_authoring*.yml` template exists under this exact naming
today) — expected, not a bug; this is the new signal working as designed.

- [ ] **Step 4: Commit**

```bash
git add src/fetch_orchestrator.py
git commit -m "Add fetch_orchestrator.py: worklist + cross-source retry sweep + discovery pass + unassigned-endpoint check"
```

---

### Task 10: `src/fetch_report.py` — Fetch + Discovery report sections

**Files:**
- Create: `src/fetch_report.py`

**Interfaces:**
- Produces: `write_section_state(section, data)`; `render_report(sections_written_this_run) -> str`
  (writes `output/fetch_report.md`, also returns the Markdown). Only `fetch` and `discovery`
  sections render in detail this round — `serve`, `docs`, `test_paranoid` render as
  `_Not yet run._` placeholders per the spec's non-goals (their shell exists so headers
  never move later; full implementation is out of scope). Per user clarification, EVERY
  `go_refs.py` task is meant to eventually write its own section here with a timestamp —
  this module's shape (one JSON state file per section, pure-function render) already
  supports that; only the CLI call sites that would write `serve`/`docs`/`test_paranoid`
  state are the deferred part (Task 14).

- [ ] **Step 1: Write the module**

`src/fetch_report.py`:
```python
"""Per-section JSON state + single render step (spec section 6). Each section
owns output/report_state/<section>.json; render_report() is a pure function
over whatever state files exist -- no marker-comment text mutation. Only
'fetch' and 'discovery' have real renderers this round (spec non-goals)."""

import datetime
import json
from pathlib import Path
from typing import Any, Dict, List

STATE_DIR = Path("output/report_state")
REPORT_PATH = Path("output/fetch_report.md")
SECTION_ORDER = ["fetch", "discovery", "serve", "docs", "test_paranoid"]
SECTION_TITLES = {
    "fetch": "Fetch",
    "discovery": "Discovery",
    "serve": "Serve",
    "docs": "Docs",
    "test_paranoid": "Test-Paranoid",
}


def _state_path(section: str) -> Path:
    return STATE_DIR / f"{section}.json"


def write_section_state(section: str, data: Dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    data = dict(data)
    data["_written_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with open(_state_path(section), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _load_section_state(section: str) -> Dict[str, Any]:
    path = _state_path(section)
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _render_fetch_section(data: Dict[str, Any]) -> str:
    lines = ["## Fetch", ""]
    succeeded = data.get("succeeded", [])
    failed = data.get("failed", [])
    unassigned = data.get("unassigned", [])
    lines.append(f"- Succeeded: {len(succeeded)}")
    lines.append(f"- Failed: {len(failed)}")
    lines.append(f"- Unassigned (no template): {len(unassigned)}")
    if failed or unassigned:
        lines.append("")
        lines.append("**MAJOR ISSUES**")
        for key in failed:
            lines.append(f"- `{key}` failed all attempts")
        for key in unassigned:
            lines.append(f"- `{key}` fetched but has no schema-mapping template")
    return "\n".join(lines)


def _render_discovery_section(data: Dict[str, Any]) -> str:
    lines = ["## Discovery", ""]
    per_source = data.get("new_candidates", {})
    if not per_source or not any(per_source.values()):
        lines.append("No new candidates found.")
    for source_key, names in per_source.items():
        if names:
            lines.append(f"- `{source_key}`: {', '.join(names)}")
    return "\n".join(lines)


_RENDERERS = {"fetch": _render_fetch_section, "discovery": _render_discovery_section}


def render_report(sections_written_this_run: List[str]) -> str:
    parts = ["# GoRefs Fetch Report", "", f"_Generated {datetime.datetime.now(datetime.timezone.utc).isoformat()}_", ""]
    for section in SECTION_ORDER:
        state = _load_section_state(section)
        if not state:
            parts.append(f"## {SECTION_TITLES[section]}")
            parts.append("")
            parts.append("_Not yet run._")
            parts.append("")
            continue
        if section in sections_written_this_run and section in _RENDERERS:
            parts.append(_RENDERERS[section](state))
        else:
            written_at = state.get("_written_at", "unknown")
            parts.append(f"## {SECTION_TITLES[section]} — last updated {written_at}, not run this pass")
        parts.append("")

    markdown = "\n".join(parts)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(markdown, encoding="utf-8")
    return markdown
```

- [ ] **Step 2: Verify collapsed-by-freshness rendering + the unassigned MAJOR ISSUE, using scratch state**

Run:
```bash
uv run python3 -c "
import src.fetch_report as fr
fr.STATE_DIR.mkdir(parents=True, exist_ok=True)

fr.write_section_state('fetch', {'succeeded': ['a:b'], 'failed': ['c:d'], 'unassigned': ['a:b']})
md = fr.render_report(['fetch'])
assert '## Fetch' in md
assert 'Succeeded: 1' in md
assert 'MAJOR ISSUES' in md
assert '\`c:d\` failed all attempts' in md
assert '\`a:b\` fetched but has no schema-mapping template' in md
assert '_Not yet run._' in md  # discovery/serve/docs/test_paranoid, untouched

fr.write_section_state('discovery', {'new_candidates': {'pokeapi': ['ability']}})
md2 = fr.render_report(['discovery'])
assert 'not run this pass' in md2  # fetch collapses now, this run only touched discovery
assert '## Discovery' in md2
assert 'pokeapi' in md2
print('ok')
"
```
Expected: `ok`. Inspect `output/fetch_report.md` afterward to eyeball the rendering.

- [ ] **Step 3: Commit**

```bash
git add src/fetch_report.py
git commit -m "Add fetch_report.py: per-section JSON state + render_report() + unassigned-endpoint MAJOR ISSUES"
```

---

### Task 11: `reexplore_interval_days` settings block

**Files:**
- Modify: `config/sources.yml`

- [ ] **Step 1: Add the settings block**

At the top of `config/sources.yml`, before the `sources:` key:

```yaml
settings:
  reexplore_interval_days: 7

sources:
  alexelgt_game_masters:
    ...
```

- [ ] **Step 2: Verify it parses and the existing `sources:` block is unaffected**

Run:
```bash
uv run python3 -c "
import yaml
with open('config/sources.yml') as f:
    cfg = yaml.safe_load(f)
assert cfg['settings']['reexplore_interval_days'] == 7
assert len(cfg['sources']) == 7
print('ok')
"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add config/sources.yml
git commit -m "Add settings.reexplore_interval_days=7 to sources.yml"
```

---

### Task 12: End-to-end smoke script (manual entrypoint, not wired to `go_refs.py`)

**Files:**
- Create: `scripts/fetch_pipeline_smoke.py`

This is a standalone, manually-invoked script — not a `go_refs.py` flag. It's the one
place that exercises `run_fetch_pass()` + `run_discovery_pass()` + `render_report()`
together against every real source, useful for manual verification now and as the
reference implementation whenever the typer-migration plan's follow-up wires this into
`gorefs --fetch`/`--reexplore`/`--no-report`.

**Interfaces:**
- Consumes: `fetch_orchestrator.run_fetch_pass`, `fetch_orchestrator.run_discovery_pass`,
  `fetch_report.write_section_state`, `fetch_report.render_report` (Tasks 9-10).

- [ ] **Step 1: Write the script**

`scripts/fetch_pipeline_smoke.py`:
```python
"""Manual smoke entrypoint for the new fetch-verification pipeline.

NOT wired to go_refs.py -- see docs/superpowers/plans/2026-08-04-fetch-verification-pipeline-plan.md
for why. Run directly: `uv run python3 scripts/fetch_pipeline_smoke.py`.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.resolve()))

import yaml

from src.fetch_orchestrator import run_discovery_pass, run_fetch_pass
from src.fetch_report import render_report, write_section_state


def main() -> None:
    with open("config/sources.yml", "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    sources_config = config["sources"]
    interval_days = config.get("settings", {}).get("reexplore_interval_days", 7)

    print("Running fetch pass...")
    fetch_summary = run_fetch_pass(sources_config)
    write_section_state("fetch", fetch_summary)
    print(f"  succeeded: {len(fetch_summary['succeeded'])}, failed: {len(fetch_summary['failed'])}, unassigned: {len(fetch_summary['unassigned'])}")

    print("Running discovery pass...")
    discovery_summary = run_discovery_pass(sources_config, interval_days)
    write_section_state("discovery", {"new_candidates": discovery_summary})
    for source_key, names in discovery_summary.items():
        if names:
            print(f"  {source_key}: {len(names)} new candidates")

    render_report(["fetch", "discovery"])
    print("Report written to output/fetch_report.md")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it for real**

Run: `uv run python3 scripts/fetch_pipeline_smoke.py`
Expected: no traceback. Network-dependent sources may show individual `failed`
endpoints in the summary (fine, that's the retry/report system working as designed)
but the script itself must complete and write `output/fetch_report.md`.

- [ ] **Step 3: Inspect the results**

```bash
cat output/fetch_report.md
cat raw_dumps/local_authoring/latest/.manifest.json
head -5 raw_dumps/.fetch_history.jsonl
```
Expected: a readable Fetch + Discovery report (including an "Unassigned" count and
any MAJOR ISSUES entries); a manifest with real `status`/`content_hash`/`fetched_at`
entries; JSONL lines matching the schema from Task 8.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch_pipeline_smoke.py
git commit -m "Add manual smoke entrypoint for the fetch-verification pipeline"
```

(Don't commit `raw_dumps/`, `output/fetch_report.md`, or `output/report_state/` from
this step's run unless you want that snapshot data checked in — check `git status`
before staging and only add the script itself if in doubt.)

---

### Task 13: Close the two TODOs this spec's design resolves

**Files:**
- Modify: `todo/fetch-skip-unchanged.md`
- Modify: `todo/raw-dumps-retention.md`

Per spec section 4: "Both should be closed once this design lands, rather than tracked
separately." This plan lands the design (per-endpoint change detection via content
hash, `latest/`+`history/` archive-on-change) but doesn't wire it into `go_refs.py`'s
`--fetch` yet — so mark them addressed-by-design-pending-wiring, not fully Closed.

- [ ] **Step 1: Update `fetch-skip-unchanged.md`**

Change the `**Status:** Open` line to:
```markdown
**Status:** Addressed by design — pending CLI wiring
```

Add at the end of the file:
```markdown

2026-08-04: Resolved by the fetch-verification-pipeline design
(`docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md`)
and implemented in `docs/superpowers/plans/2026-08-04-fetch-verification-pipeline-plan.md`
-- `src/fetch_orchestrator.py`'s `_attempt_one()` compares each endpoint's
content hash against `.manifest.json` and only writes/archives when it
changed (see `src/snapshot_store.py`). Not yet reachable from `--fetch`
(that CLI is being rebuilt on Typer first, see
`docs/superpowers/plans/2026-08-04-typer-flat-cli-migration.md`) -- close
this item fully once that wiring lands.
```

- [ ] **Step 2: Update `raw-dumps-retention.md`**

Change the `**Status:** Open` line to:
```markdown
**Status:** Addressed by design — pending CLI wiring
```

Add at the end of the file:
```markdown

2026-08-04: Resolved by the fetch-verification-pipeline design -- the new
`raw_dumps/<source>/latest/`+`history/` layout (spec section 4,
`src/snapshot_store.py`) only grows `history/` when an endpoint's content
actually changes; unchanged endpoints never duplicate. Same caveat as
`fetch-skip-unchanged.md` above: not yet reachable from `--fetch`. The old
per-source `fetch()` implementations that produced the original ~53MB of
timestamped snapshots were deleted outright (not migrated) in
`docs/superpowers/plans/2026-08-04-fetch-verification-pipeline-plan.md`
Task 1; the pre-existing timestamped snapshot directories themselves were
left in place, unread by anything now, and still need an explicit
retention decision (delete, archive elsewhere, or leave as historical
record) -- not decided by this plan, flagged in the Task 14 handoff note.
```

- [ ] **Step 3: Commit**

```bash
git add todo/fetch-skip-unchanged.md todo/raw-dumps-retention.md
git commit -m "Mark fetch-skip-unchanged and raw-dumps-retention addressed by design, pending CLI wiring"
```

---

### Task 14: Handoff note

**Files:**
- Create: `todo/fetch-verification-pipeline-cutover.md`

This plan touches 10+ files across a new subsystem with no automated test coverage —
per CLAUDE.md's 5+-file handoff convention, leave a trail for whoever picks up the
CLI-wiring follow-up.

- [ ] **Step 1: Write the handoff note**

`todo/fetch-verification-pipeline-cutover.md`:
```markdown
## Fetch-verification pipeline: built, not yet wired to the CLI

**Status:** Open

2026-08-04: `docs/superpowers/plans/2026-08-04-fetch-verification-pipeline-plan.md`
built the full new subsystem (`src/fetchers/`, `src/endpoint_registry.py`,
`src/discovery.py`, `src/snapshot_store.py`, `src/fetch_history.py`,
`src/fetch_orchestrator.py`, `src/fetch_report.py`) implementing
`docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md`.
Verified working end-to-end via `scripts/fetch_pipeline_smoke.py` (manual,
not a `go_refs.py` flag). The old `src/fetchers/` (per-source `fetch()`
model) was deleted outright, not preserved -- this is a new branch, git
history holds it if needed.

**What's deliberately NOT done yet:**

- **CLI wiring.** `go_refs.py` was not touched at all. Wiring `--fetch`
  (and new `--reexplore`/`--no-report` flags) to `src/fetch_orchestrator.py`
  was explicitly deferred because
  `docs/superpowers/plans/2026-08-04-typer-flat-cli-migration.md` is queued
  to rewrite `go_refs.py`'s entire CLI dispatch first (argparse → Typer flat
  options) -- do the wiring as a Typer option, following that plan's Task 9
  addendum pattern, after it lands.
- **Report auto-render/auto-open on exit.** Per 2026-08-04 clarification,
  the intended end state is: every `go_refs.py` task writes a timestamped
  JSON state file (Task 10's `report_state/<section>.json` mechanism
  already supports this for any section), `go_refs.py` calls
  `render_report()` once at the end of every invocation and auto-opens
  `output/fetch_report.md` (`xdg-open`/`$EDITOR`, precedence still an open
  spec question), and a future `--no-report` flag suppresses only the
  auto-open, never the render. None of the `go_refs.py`-side behavior
  exists yet -- `render_report()` itself is ready to be called from
  wherever that CLI wiring lands.
- **`serve`/`docs`/`test_paranoid` report sections** only render as
  `_Not yet run._` placeholders (`src/fetch_report.py`'s `SECTION_ORDER`) --
  no code anywhere writes their state files yet. Per spec non-goals, only
  `fetch`+`discovery` got real implementations this round.
- **`src/builder.py` is broken.** Its `from src.fetchers import
  FetcherRegistry` (line ~18) now resolves to the NEW per-endpoint
  `FetcherRegistry`, which has no `load_latest_raw()` method --
  `--build` will raise `AttributeError` the first time it tries to read
  raw data. `src/engine.py`, `src/profiler.py`, and `src/build_tables.py`
  don't import `src.fetchers` directly but assume the OLD
  `raw_dumps/<source>/<timestamp>/` layout via their own
  `sorted(iterdir())[-1]`-style scanning -- none of them read the new
  `raw_dumps/<source>/latest/` layout. `src/snapshot_store.read_latest()`
  exists as the new reader but has no caller outside its own module and
  `fetch_orchestrator`. Confirmed via Serena (Task 1) that all four files
  are downstream build tooling, not fetch code -- rebuilding them to read
  the new layout is real, separate work.
- **`tests/test_fetcher_freshness.py`** imports the old `PogoApiFetcher`/
  `PokeApiFetcher` classes and exercises their old `fetch(force=...)`
  pre-flight-skip behavior, which no longer exists on the new classes
  (same names, different API -- `fetch_endpoint(name, path)` now). This
  test file was not touched (no test writing/running this round, per
  explicit instruction) -- it will fail or error if run. Needs a rewrite
  or deletion whenever tests are added back for this subsystem.
- **No `pytest` coverage** exists for any of the 7 new modules, per
  explicit user instruction (2026-08-04, token budget) -- every task in
  the plan instead has a runnable manual-verification command with stated
  expected output.
- **Old timestamped `raw_dumps/<source>/<timestamp>/` directories** were
  left in place (not deleted, not migrated). No decision was made on their
  long-term retention -- open question for whoever rebuilds the readers
  above.
- **Sprite/asset fetching** (the deleted legacy fetcher's
  `download_assets()`) was not ported to the per-endpoint model -- assets
  aren't a JSON endpoint and the spec doesn't cover them.

**Where to look first:** `src/fetch_orchestrator.py`'s `run_fetch_pass()`/
`run_discovery_pass()` are the two functions a Typer `--fetch`/`--reexplore`
handler would call; `src/fetch_report.py`'s `render_report()` is what
`go_refs.py` should call once at the end of every invocation, with
`--no-report` suppressing only the auto-open that would follow it.
```

- [ ] **Step 2: Commit**

```bash
git add todo/fetch-verification-pipeline-cutover.md
git commit -m "Add handoff note for fetch-verification-pipeline CLI wiring + reader migration follow-up"
```

---

## Self-review notes

- **Spec coverage:** §1 (worklist/retry) → Task 9; §2 (endpoint registry) → Tasks 4-5;
  §3 (discovery) → Task 6; §4 (snapshot layout + empty-snapshot fix) → Task 7; §5
  (fetch history log) → Task 8; §6 (report) → Task 10; settings/`reexplore_interval_days`
  → Task 11; the two TODOs §4 says to close → Task 13. Non-goals (exploration DuckDB,
  diff/patch storage, auto-adopting candidates, full Docs/Serve/Test-Paranoid sections,
  cron scheduling) are all correctly absent from every task above.
- **Local_authoring discrepancy:** spec text describes it as single-item like the other
  three; it's actually 2 files in `sources.yml`. Task 3/5 use 2 endpoints and call this
  out explicitly rather than silently picking one interpretation.
- **CLI wiring:** confirmed absent from every task via the "No CLI wiring" Global
  Constraint and Task 14's explicit follow-up note.
- **pogoapi_net discovery:** originally planned as a GitHub-contents lookup with no
  confirmed repo. User pointed out `pogoapi.net/api/v1/api_hashes.json` — a native
  listing endpoint, verified live (47 files vs. 19 seeded active) — Task 6 uses it.
- **Scope correction (2026-08-04, second round):** user asked for old `src/fetchers/`
  to be deleted outright rather than relocated to a legacy holding package (new
  branch), confirmed via Serena that `builder.py`/`engine.py`/`profiler.py`/
  `build_tables.py`/`models.py`/`reference_shim.py`/`paranoid_check.py`/
  `ingest_community_submissions.py` are downstream tooling, not fetch code (Task 1),
  and clarified the "new report system" is this spec's §6 report — this plan starts
  its logging/state mechanism in full and adds an "unassigned endpoints" MAJOR ISSUE
  (Task 9/10) but still defers the CLI-side auto-render/auto-open wiring, per the
  "no CLI wiring yet" constraint. All `pytest`-running verification steps were also
  removed per "don't write or run tests."
