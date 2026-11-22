# NISAR Pro: engine + gateway + dashboard in one image.
#
#   podman build -t nisar-pro .          (or docker build)
#   podman run -p 3000:3000 -v nisar-data:/var/lib/nisar-pro nisar-pro
#
# Put NISAR GCOV .h5 files in /var/lib/nisar-pro/data (or let the app download them with
# EARTHDATA_TOKEN). Runs are written to /var/lib/nisar-pro/results. Probes: /healthz, /readyz.
# Metrics: /metrics (Prometheus).

# ── 1. Rust: engine and gateway ─────────────────────────────────────────────
FROM docker.io/library/rust:1-bookworm AS rust
WORKDIR /src
# Dependencies first so source edits do not rebuild them.
COPY sar_science_processor/Cargo.toml sar_science_processor/Cargo.lock sar_science_processor/
COPY sar-gateway/Cargo.toml sar-gateway/Cargo.lock sar-gateway/
RUN for c in sar_science_processor sar-gateway; do mkdir -p $c/src && echo 'fn main() {}' > $c/src/main.rs; done \
 && touch sar_science_processor/src/lib.rs \
 && cargo build --release --locked --manifest-path sar_science_processor/Cargo.toml \
 && cargo build --release --locked --manifest-path sar-gateway/Cargo.toml \
 && rm -rf sar_science_processor/src sar-gateway/src
COPY sar_science_processor/src sar_science_processor/src
COPY sar-gateway/src sar-gateway/src
RUN touch sar_science_processor/src/main.rs sar_science_processor/src/lib.rs sar-gateway/src/main.rs \
 && cargo build --release --locked --manifest-path sar_science_processor/Cargo.toml --bin sar_science_processor \
 && cargo build --release --locked --manifest-path sar-gateway/Cargo.toml --bin sar-gateway \
 && strip sar_science_processor/target/release/sar_science_processor sar-gateway/target/release/sar-gateway

# ── 2. Dashboard ────────────────────────────────────────────────────────────
FROM docker.io/library/node:22-bookworm-slim AS web
WORKDIR /src/sar-dashboard-v3
COPY sar-dashboard-v3/package.json sar-dashboard-v3/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY Docs /src/Docs
COPY sar-dashboard-v3/ ./
RUN npm run build

# ── 3. Runtime ──────────────────────────────────────────────────────────────
FROM docker.io/library/debian:bookworm-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="NISAR Pro" \
      org.opencontainers.image.description="Flood mapping from NISAR L- and S-band radar" \
      org.opencontainers.image.source="https://github.com/AdityaNarayanNayak-2/NISAR_PRO" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${VERSION}"
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --home-dir /var/lib/nisar-pro --create-home nisar
COPY --from=rust /src/sar_science_processor/target/release/sar_science_processor /usr/local/bin/
COPY --from=rust /src/sar-gateway/target/release/sar-gateway /usr/local/bin/
COPY --from=web /src/sar-dashboard-v3/dist /opt/nisar-pro/dashboard
ENV NISAR_PROCESSOR=/usr/local/bin/sar_science_processor \
    NISAR_DASHBOARD_DIR=/opt/nisar-pro/dashboard \
    NISAR_DATA_DIRS=/var/lib/nisar-pro/data \
    NISAR_PORT=3000 \
    MAX_CONCURRENT_JOBS=1 \
    RUST_LOG=info
USER 10001
WORKDIR /var/lib/nisar-pro
RUN mkdir -p results data
VOLUME ["/var/lib/nisar-pro"]
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sar-gateway"]
