BINARY  := bin/tippani
# VERSION stamps buildinfo.Version so the app knows its own version for the
# in-app update check; override with `make build VERSION=v1.2.3`.
VERSION ?= dev
# TMDB_TOKEN fills the built-in TMDB slot (defaultTMDBKey in cmd/tippani) at
# build time, so the credential lives in a CI secret rather than in the source.
# Empty for a local build, which is the honest default: no built-in, and film
# lookups answer 503 until a key is saved in Settings.
TMDB_TOKEN ?=
# TVDB_TOKEN is the same slot for TheTVDB, which is the default film/show source.
TVDB_TOKEN ?=
LDFLAGS := -s -w -X tippani/internal/buildinfo.Version=$(VERSION) \
	-X main.defaultTMDBKey=$(TMDB_TOKEN) -X main.defaultTVDBKey=$(TVDB_TOKEN)

.PHONY: build frontend glossary changelog test run clean typescale frame-scroll panel-depth hero-control

## build: static binary with the currently built (or placeholder) frontend embedded
build:
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/tippani

## frontend: build the SPA into web/dist (needs Node on the DEV machine only)
## `npm ci`, not `npm install`: the committed dist is what a non-Docker deploy
## serves, so it has to be built from the same locked versions CI and the image
## use. An unlocked install here is how a bundle nobody has run reaches a user.
frontend:
	cd web/frontend && npm ci && npm run build

## glossary: regenerate docs/ui-glossary.html from the components and tokens that
## define the interface. Needs a built web/dist (it inlines the shipped stylesheet)
## and web/frontend's node_modules (it renders the real components through Vite), so
## it runs after `make frontend`, not instead of it.
glossary:
	cd web/frontend && npm run glossary

## typescale: turn every type dial to 200%, set the root to 24px, and fail if a screen
## clips anything it did not clip before. Type size is a setting, so a px box drawn
## around text is a guess that stops being true the moment a reader changes it. The
## recorded debt lives in scripts/screenshots/typescale-baseline.json and may only fall.
typescale:
	bash scripts/screenshots/run-typescale.sh

## frame-scroll: open a book's detail in a real browser and fail if the locked page
## clips or a column cannot scroll. jsdom has no layout, so the vitest suite cannot
## see this at all — test/pure/screen-scroll-chain.test.js guards the stylesheet half,
## and this measures the result.
frame-scroll:
	bash scripts/screenshots/run-frame-scroll.sh

## panel-depth: press a door a PANEL itself offers and fail if the second panel is
## not on screen afterwards. `open()` walks history back before pushing, and jsdom
## dispatches popstate on a schedule that does not lose to a frame callback — so
## test/dom/panel-opens-panel.test.jsx passes against the broken ordering and only
## a real browser can see it.
panel-depth:
	bash scripts/screenshots/run-panel-depth.sh

## hero-control: measure the heart beside a work's title against the title's own
## optical centre, for a one-line title AND a wrapped one. The pair is the point:
## a 44px tap target beside a 25px line hangs below it, and a two-line title hides
## that because the title's box is then the taller of the two.
hero-control:
	bash scripts/screenshots/run-hero-control.sh

## perf: measure main-thread blocking per action against a scratch server, and fail
## when any action crosses the budget. See scripts/perf/README.md for what the number
## means and, just as importantly, what it does not cover.
perf:
	bash scripts/perf/run-with-server.sh

## changelog: refresh the copy the binary embeds (//go:embed cannot reach the
## repo root, so the app shows internal/changelog/CHANGELOG.md — a drift test
## fails the build when it falls behind the real one)
changelog:
	cp CHANGELOG.md internal/changelog/CHANGELOG.md

test:
	go test ./...

run:
	go run ./cmd/tippani serve

clean:
	rm -rf bin web/frontend/node_modules
