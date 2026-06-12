FROM postgres:18

# Install build dependencies for pgvector (including clang-19 for LTO)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    build-essential \
    git \
    postgresql-server-dev-18 \
    clang-19 \
    llvm-19-dev

# Clone and install pgvector (latest version for PostgreSQL 18)
RUN cd /tmp && \
    git clone https://github.com/pgvector/pgvector.git && \
    cd pgvector && \
    make && \
    make install && \
    rm -rf /tmp/pgvector

# Clean up build dependencies
RUN apt-get remove -y build-essential git clang-19 llvm-19-dev && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
