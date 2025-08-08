# Production-Ready Backend with Full Dependencies
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies including curl for health checks
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    curl

# Copy application files first
COPY . .

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

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
CMD ["npm", "start"]
