# Use Ubuntu 20.04 as the base image
FROM ubuntu:20.04

# Set environment variables to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install essential dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    wget \
    unzip \
    gfortran \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 2. Build and install OpenBLAS from source
WORKDIR /root
# Using a specific version of OpenBLAS known to be stable with OpenFace
RUN git clone https://github.com/xianyi/OpenBLAS.git && \
    cd OpenBLAS && \
    git checkout v0.3.20 && \
    make -j$(nproc) DYNAMIC_ARCH=1 && \
    make install

# 3. Install other OpenFace dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libboost-all-dev \
    libopencv-dev \
    libtbb-dev \
    libeigen3-dev \
    libgtk-3-dev \
    libglew-dev && \
    rm -rf /var/lib/apt/lists/*

# 4. Clone the OpenFace repository
WORKDIR /root
RUN git clone https://github.com/TadasBaltrusaitis/OpenFace.git

# 5. Build OpenFace, pointing to the self-compiled OpenBLAS
WORKDIR /root/OpenFace
RUN mkdir build && cd build && cmake -D CMAKE_BUILD_TYPE=RELEASE \
    -D OpenBLAS_INCLUDE_DIR=/usr/local/include \
    -D OpenBLAS_LIB=/usr/local/lib/libopenblas.so \
    .. && make -j$(nproc)

# Set the working directory for running the analysis
WORKDIR /data 