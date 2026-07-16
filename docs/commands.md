# Command Reference

Developer commands for running, building, testing, and managing data in PoGo Buddy.

---

## Development & Verification

- Run development server (Vite):

  ```sh
  npm run dev
  ```

- Run code linter & typechecking:

  ```sh
  npm run lint
  ```

- Run unit tests:

  ```sh
  npm run test
  ```

- Run Playwright E2E integration tests:

  ```sh
  npm run test:e2e
  ```

---

## Native Builds (Android)

- Build debug APK:

  ```sh
  npm run android:build
  ```

- Build release APK:

  ```sh
  npm run android:release
  ```

---

## Data Ingestion & Maintenance

- Fetch reference data from PokeAPI and rebuild local database inputs:

  ```sh
  npm run ingest:fetch && npm run ingest:build
  ```

- Verify slug stability against previous git commit:

  ```sh
  npm run ingest:check-slugs
  ```

- Build inspectable dummy SQLite database at root:

  ```sh
  npm run build:dummy-db
  ```
