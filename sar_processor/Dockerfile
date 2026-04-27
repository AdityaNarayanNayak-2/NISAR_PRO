# Build stage: Cache dependencies
FROM rust:1.80 as builder
WORKDIR /app

# Copy dependency manifests
COPY Cargo.toml Cargo.lock* ./

# Create dummy source layer to cache dependencies
# This ensures that `cargo build` caches crates.io downloads
RUN mkdir src && \
    echo "fn main() { println!(\"dummy\"); }" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code and force recompile
COPY src ./src
# Touching main.rs ensures the timestamp is newer than the cached dummy build
RUN touch src/main.rs && cargo build --release

# Production stage: Debian slim (Edge optimized)
FROM debian:bookworm-slim
# Install only necessary runtime dependencies (SSL certs for HTTPS)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the lean compiled binary
COPY --from=builder /app/target/release/sar_processor /usr/local/bin/

ENTRYPOINT ["sar_processor"]