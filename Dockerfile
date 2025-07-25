# Step 1: Build React app
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the React app
RUN npm run build

# Step 2: Python environment
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Copy all project files to the container
COPY . .

# Create a virtual environment and install dependencies
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Add virtual environment binaries to PATH
ENV PATH="/opt/venv/bin:$PATH"

# Copy the built React app from the build stage
COPY --from=build /app/build ./build

# Expose application port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]