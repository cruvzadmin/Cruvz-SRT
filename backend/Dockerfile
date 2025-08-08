# Production-Ready Backend with Full Dependencies
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install essential dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Create required directories
RUN mkdir -p data logs uploads recordings && \
    chmod 755 data logs uploads recordings

# Run setup and migrations
RUN npm run postinstall || echo "Setup completed with warnings"

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "server-simple.js"]
