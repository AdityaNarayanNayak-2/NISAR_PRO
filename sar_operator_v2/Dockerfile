FROM rust:latest as builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM ubuntu:24.04
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/sar_operator_v2 /usr/local/bin/
ENTRYPOINT ["sar_operator_v2"]