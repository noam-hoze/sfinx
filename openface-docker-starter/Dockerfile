# Use Ubuntu 20.04 as the base image
FROM ubuntu:20.04

# Set environment variables to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies for OpenFace
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libboost-all-dev \
    libopencv-dev \
    libtbb-dev \
    libeigen3-dev \
    libopenblas-dev \
    unzip \
    wget

# Clone the OpenFace repository
RUN git clone https://github.com/TadasBaltrusaitis/OpenFace.git /root/OpenFace

# Build OpenFace
WORKDIR /root/OpenFace
RUN mkdir build && cd build && cmake -D CMAKE_BUILD_TYPE=RELEASE .. && make

# Set the working directory for running the analysis
WORKDIR /data 