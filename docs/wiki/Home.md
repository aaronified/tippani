# Tippani wiki

Tippani is a self-hosted, multi-user home for book highlights, film and show dialogue, and quotes from anywhere else. One static
Go binary with the app embedded: SQLite and FTS5 inside, no Node at runtime, built for a low-powered NAS.

This wiki is the source of truth for its documentation. Every page links to the others. Links stay on GitHub, apart from the
interactive demo.

Code lives in the [repository](https://github.com/aaronified/tippani). Report problems in its
[issues](https://github.com/aaronified/tippani/issues). Try the real interface on dummy data in the
[interactive demo](https://aaronified.github.io/tippani/demo/).

## 1. Using Tippani

- [Source files and context](Source-Files-And-Context.md): attach the file a work's quotes came from, open a quote in context, get
  times for film lines, fill a book's metadata from its own EPUB, prune a file you no longer need
- [Library folders](Library-Folders.md): for the administrator: mount the folders your books and films already live in, read-only,
  and let readers scan them
- [Spaced repetition](Spaced-repetition.md): how the recall deck decides what to show, and when
- [Troubleshooting](Troubleshooting.md): the app logged a `TIP-*` code, what now?

## 2. Roadmap

- [Roadmap](Roadmap.md): what is built, what is next, what is only being thought about
- [Plans index](Plans-Index.md): every plan for something not built yet, one line each
- [UI glossary](UI-Glossary.md): every part of the interface, named

## 3. Decisions

- [ADR index](ADR-Index.md): every architecture decision, one page each, grouped by what it is about
- [Design decisions](Design-decisions.md): what the `§` numbers the code cites mean, and the owner's approval statement

## 4. Building on it

- [Developing](Developing.md): the map of the whole repository, and how to know a change worked
- [Testing](Testing.md): what a kept test is, and how the suites are laid out
- [Releasing](Releasing.md): how a release is cut
- [How this was written](How-this-was-written.md): how much is AI-written, and what is actually checked
- [Bengali style](Bengali-style.md): register, terms and loanwords for the Bengali interface
- [Provider marks](Provider-marks.md): the supplier marks, where each came from, under what licence

Each plan and each ADR has its own page, listed in the [plans index](Plans-Index.md) and the [ADR index](ADR-Index.md).
