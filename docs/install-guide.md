# Installing PoGo Buddy (for friends)

This app is sideloaded, not installed from the Play Store — that's normal
for a small local-only tracker like this, not a sign anything's wrong.

## First install

1. You'll be given an `.apk` file directly (not a store link).
2. Tapping it will show an "unknown sources" or "install unknown apps"
   prompt the first time — allow it for whichever app you used to open the
   file (Files, Chrome, etc.). This is Android's normal gate for anything
   not from the Play Store, not specific to this app.
3. You may also see a Play Protect warning ("this app wasn't scanned" or
   similar) — this is expected for a small sideloaded app with no Play
   Store listing. Choose install anyway.

## Before you do anything else: back up

**Your Pokédex progress lives only on this phone — there is no cloud sync,
by design.** Right now, exporting is your only backup:

- Open **Settings → Export** and save the file somewhere you'll find it
  again (email it to yourself, save to Drive, etc.).
- Do this after any real play session where you've caught something worth
  keeping a record of, not just once.

## Updating to a new version

**Important caveat, current as of this app's early releases**: this app
doesn't yet ship with a stable release signing key (tracked as an open V1
item — see `docs/v1-tasks/02-data-safety-net.md`). Until that's done,
whether "install the new APK over the old one" preserves your data
**depends on whether both APKs were signed with the same key** — Android
refuses to update in place across a signing-key mismatch, and if that
happens your only path is uninstall → reinstall, which **erases the app's
data**. **Export before every update, no exceptions, until this note is
removed.** Once release signing ships, this section will be updated to
confirm installing over the old APK is safe.

## If something goes wrong

If the app fails to open (a "couldn't open the database" message or
similar), **don't uninstall it — message the owner before doing anything
else.** There's no in-app recovery for this yet (tracked as an open V1 item,
`docs/v1-tasks/02-data-safety-net.md`), and uninstalling erases the app's
data permanently. This is exactly why exporting regularly matters more than
it might seem.
