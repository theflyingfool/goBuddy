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

Every release is signed with the same dedicated release key, so installing a
new APK over an old one should preserve your data going forward — a
signing-key mismatch is the one thing that would silently block an in-place
update, and this key isn't changing again (it's backed up outside the
project; see `docs/v1-tasks/02-data-safety-net.md`, item D4).

**Export before every update anyway.** A stable signing key rules out one
failure mode, not all of them — a botched migration or a corrupted database
doesn't care whether the key matches. Exporting takes a few seconds; treat
it as habit, not a one-time precaution.

If a signing key mismatch happens, the install appears to succeed but your
phone silently keeps the old version — no error will appear. Before updating,
check the version in **Settings → About**. After reopening the app, check it
again — if it's unchanged, message the owner immediately. **Don't uninstall**
— that's the only thing that actually erases your data.

## If something goes wrong

If the app fails to open (a "couldn't open the database" message or
similar), the app itself should offer a one-time "export personal data"
option on that failure screen — use it before doing anything else. If for
any reason that doesn't appear, **don't uninstall — message the owner
before doing anything else**, since uninstalling erases the app's data
permanently. This is exactly why exporting regularly matters more than it
might seem.
