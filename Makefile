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

.PHONY: build frontend changelog test run clean

## build: static binary with the currently built (or placeholder) frontend embedded
build:
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/tippani

## frontend: build the SPA into web/dist (needs Node on the DEV machine only)
## `npm ci`, not `npm install`: the committed dist is what a non-Docker deploy
## serves, so it has to be built from the same locked versions CI and the image
## use. An unlocked install here is how a bundle nobody has run reaches a user.
frontend:
	cd web/frontend && npm ci && npm run build

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
