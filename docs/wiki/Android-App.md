# The Android app

Tippani has an Android app, in its own repository: **[aaronified/tippani-app](https://github.com/aaronified/tippani-app)**. It keeps a
library on the phone, works with no server, and pairs with this one when you have it. Download it from the
[latest release](https://github.com/aaronified/tippani-app/releases/latest) (a file named `tippani-app-vX.Y.Z.apk`); it checks for a newer
version itself when it opens. It is free software under the GPL-3.0, and Android only
([ADR-0014](ADR-0014-Android-Only-For-The-Native-Client-No-Unbuildable-Ios-Directory.md)).

## Pairing it with your server

1. On the web, open Settings › Server › Devices and make a pairing code (eight letters and numbers, good for five minutes, used once:
   [ADR-0022](ADR-0022-Pairing-Codes-Live-In-Memory-One-Shot-Five-Minutes.md)).
2. In the app, open Settings, enter your server's address, and type the code. No password is stored on the phone; it holds a device token
   ([ADR-0021](ADR-0021-Device-Tokens-Have-The-Opposite-Lifetime-To-Sessions-On-Purpose.md)).
3. Unpair any phone from the same Devices list.

## What it does with the server

- **Syncs both ways by itself.** Works, quotes, tags, boards and the shelf (reading, paused, abandoned, finished, with progress) stay in step.
  A delete on one side is checked before it reaches the other, and a conflict never stops the sync.
- **Shows the same people.** Portraits of authors, speakers, characters and actors on every quote, and a page for each person and character.
- **Makes the same share picture.** The quote, the credit, the signature and the backdrop, as the server draws them.
- **Reads in English or Bengali,** from the same language files as the web, so a correction here reaches the phone.
- **Runs the server from the phone** for an admin account: readers, backups, sources, metadata, cover search and the people console.

Without a server the app still keeps books, films, shows and games, quotes with their speakers, tags and colours, the daily quiz, anthologies
and statistics, and exports and imports Markdown.

## Where to find more

- [What's new in the app](https://github.com/aaronified/tippani-app/blob/main/CHANGELOG.md)
- [The app's wiki](https://github.com/aaronified/tippani-app/blob/main/docs/wiki/Home.md), with its plan and decisions
- [Issues for the app](https://github.com/aaronified/tippani-app/issues). Work the app needs from the server is filed in
  [this repository's issues](https://github.com/aaronified/tippani/issues).
