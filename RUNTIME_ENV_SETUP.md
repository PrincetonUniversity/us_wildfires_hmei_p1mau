# Runtime Environment Variables Setup

## Overview
The REACT_APP_MAPBOX_TOKEN is now injected at runtime rather than build time, allowing for more flexible deployments without rebuilding the Docker image for different environments.

## How it works
1. During the Docker build, a placeholder `REACT_APP_MAPBOX_TOKEN_PLACEHOLDER` is inserted into the React bundle
2. At container startup, the `inject-env.sh` script replaces this placeholder with the actual runtime environment variable
3. The container then starts nginx to serve the modified files

## Usage

### Option 1: Using .env file with docker-compose
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your actual Mapbox token:
   ```bash
   REACT_APP_MAPBOX_TOKEN=pk.your_actual_mapbox_token_here
   ```

3. Run docker-compose:
   ```bash
   docker-compose up --build
   ```

### Option 2: Setting environment variable directly
```bash
REACT_APP_MAPBOX_TOKEN=pk.your_actual_mapbox_token_here docker-compose up --build
```

### Option 3: Export environment variable
```bash
export REACT_APP_MAPBOX_TOKEN=pk.your_actual_mapbox_token_here
docker-compose up --build
```

## Benefits
- ✅ No need to rebuild Docker images when changing tokens
- ✅ Better security (tokens not baked into images)
- ✅ Support for different environments (dev/staging/prod)
- ✅ CI/CD friendly deployment
- ✅ Same Docker image can be used across environments

## Important Notes
- The environment variable must be set when starting the container
- If not set, the placeholder value will remain (causing map functionality to fail)
- The script will log injection status to container logs for debugging
