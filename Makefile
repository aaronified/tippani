BINARY  := bin/tippani
# VERSION stamps buildinfo.Version so the app knows its own version for the
# in-app update check; override with `make build VERSION=v1.2.3`.
VERSION ?= dev
LDFLAGS := -s -w -X tippani/internal/buildinfo.Version=$(VERSION)

.PHONY: build frontend test run clean

## build: static binary with the currently built (or placeholder) frontend embedded
build:
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/tippani

## frontend: build the SPA into web/dist (needs Node on the DEV machine only)
frontend:
	cd web/frontend && npm install && npm run build

test:
	go test ./...

run:
	go run ./cmd/tippani serve

clean:
	rm -rf bin web/frontend/node_modules
