#!/bin/bash

# Check if a filename is provided
if [ -z "$1" ]; then
  echo "Usage: ./run_openface.sh <video_filename>"
  exit 1
fi

VIDEO_FILE=$1

# Run the Docker container to process the video
docker run --rm -v "$(pwd):/data" openface /root/OpenFace/build/bin/FaceLandmarkVid -f "$VIDEO_FILE" -out_dir output 