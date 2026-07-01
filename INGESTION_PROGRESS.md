# PokeAPI Ingestion Progress

This file is updated automatically by `scripts/ingest/fetch-pokeapi-data.ts`
after each species. Safe to interrupt the fetch (Ctrl-C) and resume later —
`scripts/ingest/.cache/` holds every response already fetched, so re-running
`npm run ingest:fetch` skips anything already cached.

## Rate limit assumption

PokeAPI doesn't publish a hard documented requests/minute ceiling (their
stance is aggressive Fastly CDN caching + "don't abuse it," not a stated
number). Assuming a conservative **60 req/min** ceiling and targeting 75%
of that: **45 req/min**, backing off on any HTTP 429. Adjust
`REQUESTS_PER_MINUTE` in `pokeapi-client.ts` if this turns out to be wrong
in either direction.

## Status

**Done.**

- Species fetched: 1025 / 1025 (100.0%)
- Last updated: 2026-07-01T08:45:16.661Z
- Resume command: `npm run ingest:fetch`
