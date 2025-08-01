#!/bin/bash
# Health check script for the backend container

# Check if the FastAPI application is responding
curl -f http://localhost:8000/api/health || exit 1
