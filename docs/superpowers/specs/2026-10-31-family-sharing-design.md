# Family & Sharing — Design (Piece 14)

Date: 2026-10-31
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. What

1. **More than one child.** The Kids' Workshop keeps a list of children (kids-profiles.json). The first child
   keeps the original kids-progress.json, so a workshop set up before this carries on unchanged. Each child has
   their own path, badges, quizzes, tool level, games switch and finished-project photos. The parent PIN is
   shared. When there is more than one child, Kids' Home shows "Who's working?" name buttons; picking a name
   needs no PIN. Adding or removing a child needs the PIN. A removed child's file is renamed and kept, not
   deleted.
2. **Parent dashboard.** A Family table in the Parent area shows, for each child: the level reached, quizzes
   passed, lessons opened, projects built, badges and tool level. It also has "Add a child" and "Remove".
3. **Project packages.** In the Master Shop toolbar, a Share menu has two items:
   - **Share this project…** saves one `.aapkg` file. It holds the design and, optionally, the project's shop
     journal (notes, time, costs, photos), plus who it's from and a note.
   - **Open a shared project…** opens the design as a new, unsaved project and adds the journal entries to the
     opener's journal, marked "(from …)". Entries that don't check out are left out.
4. **Full backup and restore.** These are on the Home screen.
   - **Back up everything…** writes one `.aabackup` file, which is gzip-compressed JSON. It holds:
     - the app's own data: kids' progress, profiles, PIN, photos, journal, inventory, stock and woods;
     - the whole projects folder, including My Plans.
     It leaves out caches, temp, backup and autosave files.
   - **Restore from a backup…** asks for the parent PIN when one is set. Every path in the file is checked;
     anything outside its folder is refused and nothing is written. Any file the restore would replace is first
     copied to a `_before-restore-<time>` folder beside it. The app reloads when the restore is done.

## 2. Testing

- **Unit tests:**
  - Profiles: migrating a single child, adding a child, switching, keeping each child's record separate, the
    family list, name sync, removal rules, photo names.
  - Backup: what is collected, a round trip to an empty computer, keeping replaced files aside, refusing damaged
    or doctored files.
  - Packages: the round trip, journal filtering, bad entries left out.
- **E2E:**
  - The parent adds a second child, switches to them, and finds the first child's progress kept.
  - Back up, change something, restore, and the change is undone.
  - Share a project and open it again.
