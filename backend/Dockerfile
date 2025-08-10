# Production-Ready Backend with Full Dependencies
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install essential dependencies including those needed for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies with reliable settings
RUN npm install --omit=dev --no-audit --no-fund

# Copy application files after dependencies are installed
COPY . .

# Run setup script to create directories and initialize database
RUN npm run setup

# Create required directories with proper permissions
RUN mkdir -p data logs uploads recordings && \
    chmod 755 data logs uploads recordings

# Create required directories
RUN mkdir -p data logs uploads recordings && \
    chmod 755 data logs uploads recordings

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "server.js"]
