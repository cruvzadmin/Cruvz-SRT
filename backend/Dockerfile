# Simple Production Backend with Essential Dependencies Only
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install essential build dependencies (needed for native modules like bcrypt, pg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package definition files first for better Docker layer caching
COPY package-simple.json package.json

# Install dependencies
RUN npm install --production --no-optional

# Copy application source
COPY server-simple-prod.js server.js

# Create a non-root user for security
RUN useradd -r -u 1001 -m appuser \
 && mkdir -p data logs \
 && chown -R appuser:appuser /app \
 && chmod 755 data logs

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start application
CMD ["node", "server.js"]
