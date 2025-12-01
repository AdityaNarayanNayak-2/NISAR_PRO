# Build Stage
FROM rust:latest as builder

WORKDIR /usr/src/sar-gateway
COPY . .

RUN cargo install --path .

# Runtime Stage
FROM ubuntu:24.04

# Install OpenSSL and CA certificates (required for HTTPS requests to ESA)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/cargo/bin/sar-gateway /usr/local/bin/sar-gateway
COPY .env.example /usr/local/bin/.env

WORKDIR /usr/local/bin

CMD ["sar-gateway"]
