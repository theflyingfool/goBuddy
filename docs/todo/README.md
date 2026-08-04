# To-Do

At-a-glance tracker. Each row links to a detail file with the full original text.

| What | Status | Brief description | Link |
|---|---|---|---|
| Phone bulk-edit autofill | Done | Bulk edit wasn't auto-checking Standard/Caught alongside higher-tier flags (shiny/lucky/4★) — fixed in v0.19.0. | [details](phone-bulk-edit-autofill.md) |
| Unown/Spinda image fallback | Open | Species without a clear "standard" form (Unown, Spinda) need a fallback image convention. | [details](phone-unown-spinda-image-fallback.md) |
| Web install: deprecated packages | Open | Fresh web install in a new directory surfaces a lot of deprecated-package warnings. | [details](web-install-deprecated-packages.md) |
| Web install: prepare/git failures | Open | Fresh web install fails (likely a `prepare` script + git issue); `npm run dev` still works after the failed install. | [details](web-install-prepare-failures.md) |
| GoRefs ingestion swap: pre-merge testing | Open | 8 verification gaps from the GoRefs pipeline swap that weren't exercised before merge — sqlite build, app boot, fresh-clone bootstrap, and more. | [details](gorefs-ingestion-swap-pre-merge-testing.md) |
