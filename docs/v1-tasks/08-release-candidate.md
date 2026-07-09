*Part of the [V1 Task Breakdown](README.md). Previous: [10. Documentation & release](07-documentation-and-release.md). Next: [12. V2 watchlist](09-v2-watchlist.md).*
*Roadmap context: [Theme 6 — Desktop story](../v1-roadmap/06-desktop-story.md).*

## 11. Release candidate

- [ ] The export on file import needs to be optional not forced
- [ ] An Import should clear the user db before importing as well. Right now it seems like it appends, which would be fine if we had a clear
  db button in app I guess
- [ ] Real-device install + first-boot timing (resolves
  [§ 8](06-performance-and-quality-infra.md)'s contingency).
- [ ] Upgrade-over-install test: v1 APK + real data → v2 APK, confirm data
  survives and no boot-brick.
- [ ] Confirm the [§ 9](06-performance-and-quality-infra.md) smoke suite +
  CI are green.
- [ ] Tag `v1.0.0`.
- [ ] Distribute with the install/update one-pager
  ([§ 10](07-documentation-and-release.md)).
