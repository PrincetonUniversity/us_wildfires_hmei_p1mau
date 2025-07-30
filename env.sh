#!/bin/bash

# shellcheck disable=SC2034
BASE_IMAGE="python"
BASE_VERSION="3.11-slim"
IMAGE_REGISTRY="dockerhub.princeton.edu"
IMAGE_REPO="student"
BACKEND_IMAGE_NAME="heatmap-backend"
IMAGE_VERSION="0.0.1"
FRONTEND_IMAGE_NAME="heatmap-frontend"
FRONTEND_CONTAINER_NAME="heatmap-frontend"
BACKEND_CONTAINER_NAME="heatmap-backend"