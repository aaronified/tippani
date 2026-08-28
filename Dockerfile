# ---- frontend ----
#
# THE LOCKFILE COMES WITH THE MANIFEST, AND THE INSTALL IS `npm ci`.
#
# This stage used to copy package.json alone and run `npm install`, which
# resolves every `^` range afresh at image-build time. Every dependency here is a
# caret range — react ^19, vite ^6, tailwindcss ^4 — so the bundle in the image
# was built against whatever minor versions npm happened to resolve that minute,
# and two builds of the identical commit could differ.
#
# It held for seventy releases and then did exactly what it was always going to
# do: the SPA in :latest stopped booting while the Go binary, whose dependencies
# ARE locked by go.sum, came up perfectly healthy. A container passing its own
# healthcheck and serving a dead page is the worst shape this failure has.
#
# And CI could not catch it, which is the part worth fixing rather than just
# patching. ci.yml and pages.yml both run `npm ci` — locked — so the suite was
# green against one set of versions while the image shipped a bundle nobody had
# ever run. The two paths now install the same way, so a dependency that breaks
# the build breaks it in CI first.
#
# `npm ci` also refuses to start when package.json and the lockfile disagree,
# which turns "somebody edited a version by hand" into a failed build instead of
# a silent resolution.
#
# THE PIN TO $BUILDPLATFORM IS LOAD-BEARING, AND IT IS A PERFORMANCE FIX.
#
# Unpinned, buildx builds this stage once per entry in `platforms:`, so the
# linux/arm64 pass ran node under QEMU on an amd64 runner. That was survivable
# only by accident: the install layer was keyed on package.json alone, and
# package.json had not changed in dozens of releases, so the emulated install was
# a cache hit every single time and never actually ran. Adding the lockfile to
# the COPY above — correctly — changed the layer's key, the emulated `npm ci`
# finally ran for real, and 1.12.0 took 15 minutes to publish instead of 2.
#
# Emulating it was never worth doing, cached or not. This stage emits static
# JS/CSS/HTML; there is nothing architecture-specific in a bundle. Pinned to the
# native platform it builds ONCE and both target images copy the same bytes,
# which is also the only way the two arches are guaranteed to serve an identical
# frontend. The backend stage below has always done this; this one was missed.
#
# The cost of getting it wrong is paid twice over, because the 231-package tree
# here carries native musl-arm64 binaries — @tailwindcss/oxide (Rust), esbuild
# (Go), rollup — that QEMU is at its worst on.
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend
WORKDIR /src/web/frontend
COPY web/frontend/package.json web/frontend/package-lock.json ./
RUN npm ci
COPY web/frontend/ ./
# THE LOCALE FILES ARE OUTSIDE THIS STAGE'S COPY, and the build fails without
# them. internal/i18n/en.txt and bn.txt are the canonical copy for BOTH sides of
# the app: the Go binary embeds them and src/i18n.js imports the same bytes with
# Vite's `?raw`. They live in a Go package because //go:embed cannot reach outside
# its own directory and Vite can reach anywhere — so the one file goes where the
# constrained side can see it, and there is nothing to keep in step.
#
# Copied SEPARATELY rather than by widening the COPY above: this stage should get
# the frontend tree plus exactly the two assets it reaches out of it, so a build
# that starts depending on something else in the repository fails here instead of
# quietly succeeding.
COPY internal/i18n/*.txt /src/internal/i18n/
# `npm run build` ends by rewriting web/dist-inputs.json, the record of which
# bytes the bundle was built from (scripts/dist-inputs.mjs says why it exists).
# The image throws that file away — it is checked in the repository, by a Go test
# — but the write is part of the build command on purpose: a rebuild that can
# skip it is a manifest that can be stale, and there is then nothing to trust.
#
# This is the second thing this stage reaches out of its own tree for, and it is
# copied on its own line for the reason the locale files are: the COPY above
# stays narrow so a build that starts depending on something else in the
# repository fails here rather than quietly succeeding.
COPY scripts/dist-inputs.mjs /src/scripts/
RUN npm run build   # -> /src/web/dist
# The bundle is what the whole image exists to serve, so a build that "succeeded"
# without emitting one must not become an image. index.html is written last, so
# its absence is the honest test.
RUN test -s /src/web/dist/index.html || (echo "frontend build produced no index.html" && exit 1)

# ---- backend ----
# Build on the native BUILDPLATFORM and cross-compile to the target arch. The
# driver is pure Go (CGO_ENABLED=0), so this is fast and needs no QEMU — one
# multi-arch image serves amd64 NAS boxes and arm64 Pis/Synology/QNAP (arm64 is
# published but untested; amd64 is the tested arch).
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS backend
ARG TARGETOS
ARG TARGETARCH
# VERSION is stamped into the binary (buildinfo.Version) so the app knows its
# own version for the in-app update check; the docker-publish workflow passes
# the release tag, and it defaults to "dev" for a plain local build.
ARG VERSION=dev
# TMDB_TOKEN fills the built-in TMDB slot (defaultTMDBKey in cmd/tippani). The
# publish workflow passes the repository secret; a plain local build leaves it
# empty, which means no built-in and a 503 until a key is saved in Settings.
#
# It is an ARG rather than a BuildKit secret mount deliberately: the value is
# linked INTO the binary either way, so hiding it from `docker history` would
# protect nothing that the image itself does not already carry. See the comment
# on defaultTMDBKey for what embedding does and does not buy.
ARG TMDB_TOKEN=""
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /src/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags "-s -w -X tippani/internal/buildinfo.Version=${VERSION} -X main.defaultTMDBKey=${TMDB_TOKEN}" -o /tippani ./cmd/tippani
# Stage an empty data dir owned by distroless's nonroot uid (65532). A named
# volume mounted at /data inherits this ownership when first initialized, so the
# non-root process can create the SQLite DB — otherwise the volume is root-owned
# and startup fails with "unable to open database file".
RUN mkdir -p /data && chown 65532:65532 /data

# ---- runtime: distroless static, non-root (PLAN §1) ----
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=backend /tippani /tippani
COPY --from=backend --chown=65532:65532 /data /data
ENV TIPPANI_DATA=/data
# In-container bind must be 0.0.0.0; keep it host-local by publishing
# with `-p 127.0.0.1:8080:8080` (PLAN §2).
ENV TIPPANI_BIND=0.0.0.0:8080
VOLUME /data
EXPOSE 8080
# The binary probes itself — distroless has no shell/curl, so exec form only.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/tippani", "healthcheck"]
USER nonroot:nonroot
ENTRYPOINT ["/tippani"]
CMD ["serve"]
