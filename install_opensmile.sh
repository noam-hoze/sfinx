#!/bin/bash

# This script clones and builds the OpenSMILE toolkit in a specific directory.

# Exit immediately if a command exits with a non-zero status.
set -e

# The directory where OpenSMILE will be installed
INSTALL_DIR="/Users/noonejoze/Projects"

# Navigate to the installation directory
echo "Changing to directory: $INSTALL_DIR"
cd "$INSTALL_DIR"

# Clone the official OpenSMILE repository if it doesn't exist
if [ ! -d "opensmile" ]; then
    echo "Cloning OpenSMILE..."
    git clone https://github.com/audeering/opensmile.git
else
    echo "OpenSMILE directory already exists. Skipping clone."
fi

# Navigate into the cloned directory
cd opensmile

# Create a build directory
echo "Creating build directory..."
mkdir -p build
cd build

# Run CMake to configure the build
echo "Running CMake..."
cmake ..

# Build OpenSMILE using 4 cores
echo "Building OpenSMILE..."
make -j4

echo ""
echo "OpenSMILE installation complete in $INSTALL_DIR/opensmile"
echo "The executable 'SMILExtract' can be found in '$INSTALL_DIR/opensmile/build/bin'"
echo "Please ensure you have the necessary system dependencies like 'build-essential' and 'cmake' installed." 