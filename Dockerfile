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
FROM node:22-alpine AS frontend
WORKDIR /src/web/frontend
COPY web/frontend/package.json web/frontend/package-lock.json ./
RUN npm ci
COPY web/frontend/ ./
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
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /src/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags "-s -w -X tippani/internal/buildinfo.Version=${VERSION}" -o /tippani ./cmd/tippani
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
