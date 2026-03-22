#!/bin/bash
# Run the Celery worker (requires Redis running)
echo "Starting Celery worker..."
cd "$(dirname "$0")/backend"
celery -A app.celery worker --loglevel=info
