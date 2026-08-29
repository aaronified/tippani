# Snappiness harness

Measures how long the app blocks the main thread around each action, and fails when
anything crosses the budget (500ms by default).

```bash
bash run-with-server.sh                 # scratch server, seeded and bulked, then measured
bash run-with-server.sh --quotes=2000   # a bigger library
node snappiness.mjs --base-url http://127.0.0.1:8080   # against a server you already have
```

`run-with-server.sh` builds the binary from this working tree, boots it on a throw-away
data directory, seeds it with `../screenshots/seed.mjs`, bulks it up with
`seed-bulk.mjs`, measures, and tears everything down. Nothing touches a real data dir.

## What the number means

It measures **timer drift**: a timer scheduled every 16ms, and how late it comes back.
That is the length of time the main thread was busy and could not answer an event, a
scroll or a keystroke — the same quantity behind the browser's "a web page is slowing
down your browser" dialog.

It deliberately does **not** measure frames. A headless browser has no compositor and
no vsync, so requestAnimationFrame fires a handful of times a second whatever the page
is doing; a frame-gap metric there reports confident numbers about the harness. The
first version of this harness did exactly that and reported ~800ms "stalls" on a board
the app was doing no work on at all.

## What it therefore does not cover

Paint and compositing happen off the main thread and cannot be measured from inside the
page. A run under a software rasteriser would not represent a real machine even if they
could — measured here, removing every texture, blend layer and shadow on the page
changes the frame timings not at all. So a paint-bound problem on a particular machine
will not show up in these numbers. What this asserts is narrower and worth asserting:
**the app's own work never holds the main thread long enough to be felt.**

## Required actions

`open share` and `share: backdrop on` must run. If the harness cannot reach them it
fails rather than passing quietly — a green result that never opened the share panel
would be believed, and the share panel is the reason this harness exists.

That is also why `seed-bulk.mjs` credits one quote to a person who has a portrait: the
backdrop is the most expensive thing the app draws and it only appears when the quote
credits somebody with a photograph. Without that row the share measurement would fall
back to the cheap card and report a fast app.
