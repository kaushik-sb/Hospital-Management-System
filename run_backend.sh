#!/bin/bash
# Run the Flask backend
echo "Starting Flask backend on http://localhost:5000"
cd "$(dirname "$0")/backend"
pip install -r requirements.txt
python app.py
