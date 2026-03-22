#!/bin/bash
# Serve the frontend using Python's built-in HTTP server
echo "Starting frontend on http://localhost:8080"
cd "$(dirname "$0")/frontend"
python3 -m http.server 8080
