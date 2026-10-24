# Library folders

Source of truth: this wiki page.

For the administrator. A reader with three hundred books does not upload three hundred files. Mount the folders your books and films
already live in, **read-only**, and readers can scan them from Checks for the subtitle and ebook files of works they have quotes from.
Nothing is copied: an attached file stays where it is, and the app reads it through the folder.

## Setting it up

1. Mount the folders into the container with `:ro`. `docker-compose.yml` carries a commented example next to the other opt-ins:

   ```yaml
   - /srv/books:/library/books:ro
   - /srv/movies:/library/movies:ro
   ```

2. In **Settings > Server > Library**, add each folder by its path **inside the container** (`/library/books`) and a name. The folder
   must be readable; a typo is refused with the reason. Readers see a folder by its name and never see a path.
3. Readers press **Scan** on Checks. A large library is a few presses: each scan walks a bounded number of files and says where it
   stopped.

## What a scan does, and does not

- **It only proposes.** It lists "this file for this work", and nothing is attached until the reader accepts. A file refused once is
  not offered again.
- **Exact or by name.** A subtitle carries no title, so a film is named by its folder (`Title (Year) {tmdb-123}`, the layout media
  managers write; the id is an exact match) and an episode by `S01E04` in the file name. An ebook is identified by what is inside it:
  an ISBN or ASIN the library also holds is exact, and a title and author is a proposal. Plain English subtitles are preferred over
  hearing-impaired ones, then other languages.
- **Only works that have quotes** are proposed, a show's episode only if it has lines, and a work that already has a file is skipped.
- **Nothing is ever written to a folder.** Every read is read-only, a path that resolves outside the folder (a symlink out) is
  refused, only regular files are read, and the package that does this holds no call that writes (a test keeps it that way). `:ro` is
  your guarantee on top of ours.
- **Nothing runs on its own.** No scan on boot, none on a timer, none in the background.
- **A reader never sends a path.** A proposal carries a token the server signed; a forged one attaches nothing, and tokens do not
  survive a restart (which only means scan again).

## When a folder goes away

If a mounted volume is unplugged, every context already stored still opens: it is rows in the database. The work's source says the
file is not where it was, and a rescan says so. A removed folder's name cannot be given to a different folder while files attached
from it still point at it.

## Maintenance

**Settings > Server > Library** also offers **Tidy attached files** when there are stored files that no work names (left by a crash
between writing a file and its row). Files younger than ten minutes are left alone, and rows whose file is missing are only reported.

See also: [Source files and context](Source-Files-And-Context.md) · [Troubleshooting](Troubleshooting.md) · [Home](Home.md)
