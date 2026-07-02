BINARY  := bin/tippani
LDFLAGS := -s -w

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
