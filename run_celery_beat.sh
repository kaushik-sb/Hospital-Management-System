#!/bin/bash
# Run the Celery beat scheduler for periodic tasks
echo "Starting Celery beat..."
cd "$(dirname "$0")/backend"
celery -A app.celery beat --loglevel=info
