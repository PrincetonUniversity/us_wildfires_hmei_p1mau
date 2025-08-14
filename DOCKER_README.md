# PM2.5 Wildfire Dashboard - Docker Deployment

This project provides a containerized deployment of the PM2.5 Wildfire Impact Dashboard using Docker and docker-compose.

## Architecture

The deployment consists of:
- **Frontend Container**: React app served by Nginx
- **Backend Container**: FastAPI application with Python
- **Database Container**: PostgreSQL database
- **Apache Reverse Proxy**: Routes traffic to the containers

## Prerequisites

- Docker and Docker Compose installed
- Apache web server with mod_proxy enabled (for reverse proxy)
- Mapbox API token (for map functionality)

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd us_wildfires_hmei_p1mau
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and set your REACT_APP_MAPBOX_TOKEN
   ```

3. **Build and start the containers:**
   ```bash
   docker-compose up -d
   ```

4. **Configure Apache reverse proxy:**
   Add the configuration from `apache-config.conf` to your Apache virtual host.

## Environment Variables

### Frontend (.env)
- `REACT_APP_MAPBOX_TOKEN`: Your Mapbox access token
- `REACT_APP_API_BASE_URL`: API base URL (default: `/heatmap/api`)
- `PUBLIC_URL`: Public URL path (default: `/heatmap`)

### Backend
- `DATABASE_URL`: PostgreSQL connection string (auto-configured in docker-compose)

## Data Management

The backend container automatically handles data download on first startup:
- Checks if `/app/data` directory is populated
- If empty, downloads `data.zip` from GitHub
- Extracts data to the persistent volume
- On subsequent starts, skips download if data exists

## Container Details

### Frontend Container
- **Base Image**: nginx:alpine
- **Port**: 80
- **Path**: Serves app at `/heatmap` path
- **Build**: Multi-stage build (Node.js build + Nginx serve)

### Backend Container
- **Base Image**: python:3.11-slim
- **Port**: 8000
- **Volume**: `/app/data` (persistent storage for downloaded data)
- **Health Check**: `/api/health` endpoint

### Database Container
- **Base Image**: postgres:15-alpine
- **Port**: 5432
- **Volume**: Persistent PostgreSQL data

## Apache Configuration

The application is designed to run behind an Apache reverse proxy at `/heatmap`.

Add this to your Apache virtual host configuration:

```apache
<Location "/heatmap">
    Require all granted
    ProxyPass http://docker301l.princeton.edu:80/heatmap
    ProxyPassReverse http://docker301l.princeton.edu:80/heatmap
    RequestHeader set Connection ""
</Location>

<Location "/heatmap/api">
    Require all granted
    ProxyPass http://docker301l.princeton.edu:8000/api
    ProxyPassReverse http://docker301l.princeton.edu:8000/api
    RequestHeader set Connection ""
</Location>
```

## Accessing the Application

Once deployed, the application will be available at:
- **Production**: `https://devops-dev.princeton.edu/heatmap`
- **Local development**: `http://localhost/heatmap`

## Container Management

### View container status:
```bash
docker-compose ps
```

### View logs:
```bash
# All containers
docker-compose logs -f

# Specific container
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Restart containers:
```bash
docker-compose restart
```

### Stop containers:
```bash
docker-compose down
```

### Rebuild containers:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Volumes

- `backend_data`: Persistent storage for downloaded data files
- `postgres_data`: PostgreSQL database storage

## Troubleshooting

### Backend container fails to start:
1. Check database connectivity: `docker-compose logs postgres`
2. Verify data download: `docker-compose logs backend`
3. Check data volume: `docker volume inspect us_wildfires_hmei_p1mau_backend_data`

### Frontend not accessible:
1. Check nginx configuration: `docker-compose logs frontend`
2. Verify Apache proxy configuration
3. Check network connectivity between containers

### Database connection issues:
1. Verify PostgreSQL is running: `docker-compose ps postgres`
2. Check database logs: `docker-compose logs postgres`
3. Verify environment variables in backend container

### Data download fails:
1. Check internet connectivity in backend container
2. Verify GitHub repository access
3. Manually place `data.zip` in the project root if download fails

## Development

For development purposes, you can override the docker-compose configuration:

```bash
# Create docker-compose.override.yml for development settings
# Mount source code as volumes for live reloading
```

## Security Notes

- Database credentials are configured in docker-compose.yaml
- For production, use Docker secrets or external configuration management
- Ensure proper firewall rules for exposed ports
- Keep container images updated regularly
