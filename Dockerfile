# ---- frontend ----
FROM node:22-alpine AS frontend
WORKDIR /src/web/frontend
COPY web/frontend/package.json ./
RUN npm install
COPY web/frontend/ ./
RUN npm run build   # -> /src/web/dist

# ---- backend ----
# Build on the native BUILDPLATFORM and cross-compile to the target arch. The
# driver is pure Go (CGO_ENABLED=0), so this is fast and needs no QEMU — one
# multi-arch image serves amd64 NAS boxes and arm64 Pis/Synology/QNAP (arm64 is
# published but untested; amd64 is the tested arch).
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS backend
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /src/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags "-s -w" -o /tippani ./cmd/tippani
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
