#===== Rust builder =====
FROM ubuntu:22.04 as rust-builder
LABEL maintainer="ReDeFi"

ENV CARGO_HOME="/cargo-home"
ENV PATH="/cargo-home/bin:$PATH"
ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update && \
    apt-get install -y curl cmake pkg-config libssl-dev git clang llvm libudev-dev protobuf-compiler && \
    apt-get clean && \
    rm -r /var/lib/apt/lists/*

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain none

ARG RUST_TOOLCHAIN

RUN echo "Using Rust $RUST_TOOLCHAIN" && \
    rustup toolchain install $RUST_TOOLCHAIN && \
    rustup target add wasm32-unknown-unknown --toolchain ${RUST_TOOLCHAIN} && \
    rustup default $RUST_TOOLCHAIN && \
    rustup target list --installed && \
    rustup show


# ===== BUILD =====
FROM rust-builder as builder-relay-bin

RUN mkdir /redefi

RUN git clone -b main --depth 1 https://github.com/ReDeFi-Blockchain/redefi-relay-node.git /redefi-relay-node-src && \
    cd /redefi-relay-node-src && \
    CARGO_INCREMENTAL=0 cargo build --profile=production --locked && \
    mv ./target/production/polkadot /redefi/ && \
    mv ./target/production/polkadot-execute-worker /redefi/ && \
    mv ./target/production/polkadot-prepare-worker /redefi/

#===== BIN ======

FROM ubuntu:22.04

COPY --from=builder-relay-bin /redefi/polkadot /bin/polkadot
COPY --from=builder-relay-bin /redefi/polkadot-execute-worker /bin/polkadot-execute-worker
COPY --from=builder-relay-bin /redefi/polkadot-prepare-worker /bin/polkadot-prepare-worker

ENTRYPOINT ["/bin/polkadot"]
