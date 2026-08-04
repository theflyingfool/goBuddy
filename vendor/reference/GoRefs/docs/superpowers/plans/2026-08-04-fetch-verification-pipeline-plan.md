# Fetch verification pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fetch-verification pipeline described in
`docs/superpowers/specs/2026-08-03-fetch-verification-pipeline-design.md` —
per-endpoint fetch tracking with cross-source retry, an endpoint registry
separate from `sources.yml`, best-effort discovery of new endpoints, a
`latest/`+`history/` snapshot layout that fixes the empty-snapshot bug, a
central fetch-attempt log, and a Fetch+Discovery Markdown report — as new,
self-contained modules that don't yet touch `go_refs.py`'s CLI dispatch.

**Architecture:** All new code lives in new files (`src/fetchers/` rebuilt
fresh, `src/endpoint_registry.py`, `src/discovery.py`,
`src/snapshot_store.py`, `src/fetch_history.py`, `src/fetch_orchestrator.py`,
`src/fetch_report.py`). The *existing* fetcher implementations and the raw
data they've already collected move to holding locations
(`src/fetchers_legacy/`, `raw_dumps_legacy/`) untouched and still fully
functional — `go_refs.py`'s current `--fetch`/`--build` keep working exactly
as today, just reading/writing the legacy locations. Nothing in this plan
calls the new orchestrator from `go_refs.py`.

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
writing). Wiring `--fetch`/`--reexplore`/`--no-report` to this new pipeline
is explicitly **out of scope** for this plan — track it as follow-up (Task
14 records this).

## Global Constraints

- **Scope:** `vendor/reference/GoRefs` only, per the spec. All paths below
  are relative to that directory — `cd vendor/reference/GoRefs` before
  running any command in this plan.
- **No CLI wiring.** Do not modify `go_refs.py`'s `main()`/argparse, `run_fetching()`,
  `run_freshness_check()`, or add any new CLI flags. The only edits this plan makes
  to `go_refs.py` are the two import-line fixes in Task 1 (needed so the *existing*
  CLI keeps working after fetchers move to a holding package — not new functionality).
- **Tests deliberately deferred.** Per explicit user instruction (2026-08-04, token
  budget), this plan does not add new `pytest` files. Every task's verification step
  is a runnable command (`python -c "..."` or `pytest -q`) with the exact expected
  output stated, so a fresh executor can tell done from broken without a test suite.
  Adding real coverage for this subsystem is tracked as follow-up in Task 14's
  handoff note.
- **Baseline (capture before Task 1, recheck after every task):** `uv run pytest -q`
  at the start of this plan reports **134 passed, 1 skipped, 7 failed**. The 7
  pre-existing failures (unrelated to this plan, do not fix them here):
  - `tests/test_local_authoring_costume_display_name_join.py::test_curated_costume_token_reaches_forms_table`
  - `tests/test_local_authoring_costume_display_name_join.py::test_uncurated_costume_token_leaves_display_name_none`
  - `tests/test_master_engine.py::test_costumes_gender_and_raid_bosses_fixes`
  - `tests/test_pokemon_go_api_frillish_cutover.py::test_frillish_produces_exactly_two_correctly_identified_form_rows`
  - `tests/test_pokemon_go_api_single_source_domains.py::test_raidboss_template_injects_tier_via_key_becomes_field`
  - `tests/test_pokemon_go_api_single_source_domains.py::test_raidboss_composite_identity_distinguishes_same_pokemon_across_tiers`
  - `tests/test_species_claims.py::test_species_build_emits_base_stat_claims`

  After every task in this plan, `uv run pytest -q` must report the exact same 7
  names failing and the same 134/1 pass/skip counts — never more, never different
  names. If a count changes, stop and investigate before continuing.
- **`reexplore_interval_days = 7`**, stored in a new top-level `settings:` block in
  `config/sources.yml` (not per-source).
- **Retry policy:** exactly 3 total attempts per endpoint, no backoff delay between
  attempts (spec's own stated default when nothing else is specified).
- **Two `FetcherRegistry` classes exist after Task 1** — `src.fetchers_legacy.base.FetcherRegistry`
  (old, still used by `go_refs.py` + `src/builder.py`) and `src.fetchers.base.FetcherRegistry`
  (new, built by this plan, not imported by anything outside its own modules + the Task 12
  smoke script). Never import both unaliased in the same file.
- **Raw data layout:** the pre-existing timestamped-snapshot data in `raw_dumps/` moves to
  `raw_dumps_legacy/` in Task 1 (read/written only by the legacy fetchers, unchanged
  behavior). All new-pipeline data lands in a fresh `raw_dumps/<source>/latest/` +
  `raw_dumps/<source>/history/`. The two layouts must never coexist in one source's
  directory — `sorted(iterdir())[-1]`-style legacy readers would silently pick up
  the wrong thing (`latest`/`history` sort after ISO timestamp dirnames), which is
  exactly the bug class this spec exists to kill. This is why Task 1 relocates the
  data, not just the code.
- **pogoapi_net discovery:** verified during planning that `pokemon-go-api/pokemon-go-api`
  (branch `gh-pages`, path `api/`) and `https://pokeapi.co/api/v2/` both support the
  GitHub-contents / root-index discovery pattern the spec describes. No public GitHub
  source repo for `pogoapi.net` itself was found during this planning session (a
  `gh api search/repositories?q=pogoapi` turned up unrelated projects). `pogoapi_net`
  therefore uses the spec's explicit default no-op discovery (`discover_endpoints()`
  prints "no discovery available for this source") rather than a guessed override —
  revisit if a real listing endpoint for pogoapi.net is confirmed later.

---

### Task 1: Relocate legacy fetchers + raw data to holding locations

**Files:**
- Move: `src/fetchers/` → `src/fetchers_legacy/`
- Move: `raw_dumps/` → `raw_dumps_legacy/`
- Modify: `go_refs.py:34`, `src/builder.py:17-18`, `tests/test_fetcher_freshness.py:2-3`
- Modify: `src/fetchers_legacy/base.py` (default dump dir)

**Interfaces:**
- Produces: `src.fetchers_legacy.base.FetcherRegistry`, `src.fetchers_legacy.base.BaseFetcher`
  (same API as before the move — only the import path and default dump directory change).

- [ ] **Step 1: Move the fetchers package**

```bash
git mv src/fetchers src/fetchers_legacy
```

- [ ] **Step 2: Move the raw data**

```bash
git mv raw_dumps raw_dumps_legacy
```

- [ ] **Step 3: Repoint the legacy fetchers' default dump directory**

In `src/fetchers_legacy/base.py`, find `BaseFetcher.__init__`:

```python
    def __init__(self, source_key: str, config: Dict[str, Any], base_dump_dir: Path = Path("raw_dumps")):
```

Change the default to:

```python
    def __init__(self, source_key: str, config: Dict[str, Any], base_dump_dir: Path = Path("raw_dumps_legacy")):
```

Also add a short note at the top of the module docstring:

```python
"""Base fetcher module for Pokémon GO reference data source fetchers.

LEGACY as of the fetch-verification-pipeline plan (2026-08-04) -- kept
functionally intact so go_refs.py's current --fetch/--build keep working
unchanged. New fetch work lives in src/fetchers/ (per-endpoint model). See
docs/superpowers/plans/2026-08-04-fetch-verification-pipeline-plan.md.

Handles timestamped snapshot storage, pre-flight commit/ETag checks, raw payload storage.
"""
```

- [ ] **Step 4: Fix the three import sites**

`go_refs.py:34`:
```python
from src.fetchers_legacy import FetcherRegistry
```

`src/builder.py:17-18`:
```python
import src.fetchers_legacy
from src.fetchers_legacy import FetcherRegistry
```

`tests/test_fetcher_freshness.py:2-3`:
```python
from src.fetchers_legacy.pogoapi_net import PogoApiFetcher
from src.fetchers_legacy.pokeapi import PokeApiFetcher
```

- [ ] **Step 5: Verify nothing else references the old path**

Run: `grep -rn "src\.fetchers\b" --include="*.py" . | grep -v fetchers_legacy | grep -v "^\./src/fetchers/"`
Expected: no output (the new `src/fetchers/` package doesn't exist yet — Task 2 creates it).

- [ ] **Step 6: Verify the baseline is unchanged**

Run: `uv run pytest -q`
Expected: `134 passed, 1 skipped, 7 failed` — the same 7 names listed in Global Constraints.

- [ ] **Step 7: Commit**

```bash
git add -A -- src/fetchers_legacy src/fetchers raw_dumps_legacy raw_dumps go_refs.py src/builder.py tests/test_fetcher_freshness.py
git commit -m "Relocate legacy fetchers and raw_dumps to holding locations for the fetch-verification rebuild"
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
"""New per-endpoint fetcher package (fetch-verification-pipeline spec, 2026-08-03).

Every source normalizes to a flat list of named endpoints, defined in
config/source_templates/<source>_endpoints.yml (see src/endpoint_registry.py),
not here. See src/fetchers_legacy/ for the pre-migration whole-source fetch()
model this replaces.
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
    does a generic HTTP GET + JSON-agnostic byte hash. Override fetch_endpoint()
    directly for non-HTTP sources (see LocalAuthoringFetcher)."""

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
    """Registry for the NEW per-endpoint fetchers. Distinct from
    src.fetchers_legacy.base.FetcherRegistry -- never import both unaliased
    in the same module."""

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

    Sprite asset download (src/fetchers_legacy/pokemon_go_api.py's
    download_assets()) is not part of the per-endpoint model and isn't
    ported here -- assets aren't a JSON endpoint. Left on the legacy
    fetcher; revisit if/when assets need their own tracked pipeline.
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

- [ ] **Step 1: Write the module**

`src/discovery.py`:
```python
"""discover_endpoints() hooks + staleness gate (spec section 3).

Default is an explicit no-op ("no discovery available for this source") --
used by alexelgt_game_masters, pvpoke, rplus_shiny, local_authoring, and
pogoapi_net (no verified public listing endpoint found; see plan Global
Constraints). pokemon_go_api and pokeapi have real overrides below,
verified live during planning.
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


_DISCOVERERS = {
    "pokemon_go_api": _discover_pokemon_go_api,
    "pokeapi": _discover_pokeapi,
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

- [ ] **Step 4: Live-verify the two real overrides (requires network)**

Run:
```bash
uv run python3 -c "
from src.discovery import discover_endpoints
from src.endpoint_registry import load_endpoint_registry

for source_key in ['pokemon_go_api', 'pokeapi']:
    reg = load_endpoint_registry(source_key)
    found = discover_endpoints(source_key, {'base_url': 'https://pokeapi.co/api/v2'} if source_key == 'pokeapi' else {}, reg)
    print(source_key, 'new candidates:', [f['name'] for f in found])
"
```
Expected: no traceback; `pokemon_go_api` prints an empty or small list (everything in
its seed is already `active`, so genuinely new names would only appear if upstream
added files since 2026-08-04); `pokeapi` likely lists many names (only 4 of ~50+
PokeAPI resource types are seeded active) — that's correct, expected behavior, not a bug.

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

### Task 9: `src/fetch_orchestrator.py` — worklist + retry sweep + discovery pass

**Files:**
- Create: `src/fetch_orchestrator.py`

**Interfaces:**
- Consumes: `FetcherRegistry` (Task 2), `endpoint_registry` (Task 4), `discovery` (Task 6),
  `snapshot_store` (Task 7), `fetch_history` (Task 8).
- Produces: `build_worklist(sources_config) -> List[dict]`; `run_fetch_pass(sources_config) -> dict`
  (`{"succeeded": [...], "failed": [...]}`, keys formatted `"{source_key}:{endpoint_name}"`);
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
"""

import datetime
from typing import Any, Dict, List

from src import discovery, endpoint_registry, fetch_history, snapshot_store
from src.fetchers.base import FetcherRegistry

MAX_ATTEMPTS = 3


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

    return {"succeeded": sorted(succeeded), "failed": sorted(failed)}


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
Expected: `{'succeeded': [...], 'failed': []}` then `ok`. Inspect
`raw_dumps/local_authoring/latest/.manifest.json` afterward — should show
`costume_lookup` and `community_submissions` with `status: ok`.

- [ ] **Step 4: Commit**

```bash
git add src/fetch_orchestrator.py
git commit -m "Add fetch_orchestrator.py: worklist + cross-source retry sweep + discovery pass"
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
  never move later; full implementation is out of scope).

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
    lines.append(f"- Succeeded: {len(succeeded)}")
    lines.append(f"- Failed: {len(failed)}")
    if failed:
        lines.append("")
        lines.append("**MAJOR ISSUES**")
        for key in failed:
            lines.append(f"- `{key}` failed all attempts")
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

- [ ] **Step 2: Verify collapsed-by-freshness rendering, using scratch state**

Run:
```bash
uv run python3 -c "
import src.fetch_report as fr
fr.STATE_DIR.mkdir(parents=True, exist_ok=True)

fr.write_section_state('fetch', {'succeeded': ['a:b'], 'failed': ['c:d']})
md = fr.render_report(['fetch'])
assert '## Fetch' in md
assert 'Succeeded: 1' in md
assert 'MAJOR ISSUES' in md
assert '\`c:d\` failed all attempts' in md
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
git commit -m "Add fetch_report.py: per-section JSON state + single render_report() step"
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

- [ ] **Step 3: Verify the legacy CLI still runs unaffected (`load_config()` doesn't care about unknown top-level keys)**

Run: `uv run pytest -q`
Expected: same `134 passed, 1 skipped, 7 failed` baseline as Task 1.

- [ ] **Step 4: Commit**

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
    print(f"  succeeded: {len(fetch_summary['succeeded'])}, failed: {len(fetch_summary['failed'])}")

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
Expected: a readable Fetch + Discovery report; a manifest with real `status`/`content_hash`/`fetched_at`
entries; JSONL lines matching the schema from Task 8.

- [ ] **Step 4: Verify the baseline test suite is still unaffected**

Run: `uv run pytest -q`
Expected: same `134 passed, 1 skipped, 7 failed` baseline.

- [ ] **Step 5: Commit**

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
`fetch-skip-unchanged.md` above: not yet reachable from `--fetch`. The
pre-existing ~53MB of timestamped snapshots moved to `raw_dumps_legacy/`
in this plan's Task 1 and still needs an explicit retention decision of
its own (delete, archive elsewhere, or leave as historical record) --
not decided by this plan, flagged in the Task 14 handoff note.
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
not a `go_refs.py` flag).

**What's deliberately NOT done yet:**

- **CLI wiring.** `go_refs.py` still runs the legacy `--fetch`/`--build`
  path unchanged (`src/fetchers_legacy/`). Wiring `--fetch` (and new
  `--reexplore`/`--no-report` flags) to `src/fetch_orchestrator.py` was
  explicitly deferred because `docs/superpowers/plans/2026-08-04-typer-flat-cli-migration.md`
  is queued to rewrite `go_refs.py`'s entire CLI dispatch first (argparse
  → Typer flat options) -- do the wiring as a Typer option, following that
  plan's Task 9 addendum pattern, after it lands.
- **Reader migration.** `src/builder.py`, `src/engine.py`
  (`_get_latest_snapshot_dir`), `src/profiler.py`, and `src/build_tables.py`
  all still read the legacy `raw_dumps_legacy/<source>/<timestamp>/` layout
  via `src.fetchers_legacy`. None of them read the new
  `raw_dumps/<source>/latest/` layout yet -- `src/snapshot_store.read_latest()`
  exists for this but has no caller outside its own module and
  `fetch_orchestrator`. This is real work for whenever the live build
  pipeline cuts over to the new data.
- **Tests.** No `pytest` coverage was added for any of the 7 new modules,
  per explicit user instruction (2026-08-04, token budget) -- every task in
  the plan instead has a runnable manual-verification command with stated
  expected output. Add real test coverage before this subsystem becomes the
  build pipeline's actual data source.
- **`raw_dumps_legacy/` retention.** The plan's Task 1 relocated ~53MB of
  pre-existing timestamped snapshots here unchanged. No decision was made
  on what happens to this data long-term (delete once the new pipeline has
  run enough real cycles to have its own history? archive outside the repo?
  keep indefinitely as a historical record?) -- open question for whoever
  does the reader migration above.
- **`pogoapi_net` discovery** has no real override (default no-op) -- no
  public GitHub source repo was found during planning. Revisit if one
  surfaces.
- **Sprite/asset fetching** (`src/fetchers_legacy/pokemon_go_api.py`'s
  `download_assets()`) was not ported to the per-endpoint model -- assets
  aren't a JSON endpoint and the spec doesn't cover them. Still only
  reachable via the legacy fetcher.

**Where to look first:** `src/fetch_orchestrator.py`'s `run_fetch_pass()`/
`run_discovery_pass()` are the two functions a Typer `--fetch`/`--reexplore`
handler would call; `src/fetch_report.py`'s `render_report()` is what
`--no-report` would suppress the auto-open of (report generation itself
always runs, per spec).
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
