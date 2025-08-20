# Production-Ready Backend with Full Dependencies
FROM node:18-slim

# Set working directory
WORKDIR /app

# Define environment (improves some library behaviors & enables production optimizations)
ENV NODE_ENV=production

# Install essential build/runtime dependencies (needed for native modules like sqlite3, bcrypt, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package definition files first for better Docker layer caching
# (package-lock.json will be honored by npm ci)
COPY package*.json ./

# Install production dependencies reproducibly
# - Use npm install instead of npm ci for better compatibility
RUN npm config set registry https://registry.npmjs.org/ \
 && npm set audit false \
 && npm set fund false \
 && npm install --production --no-optional

# Copy application source AFTER dependencies (so code changes don't bust dependency cache)
COPY . .

# (Optional hardening) Create a non-root user and adjust ownership
RUN useradd -r -u 1001 -m appuser \
 && mkdir -p data logs uploads recordings \
 && chown -R appuser:appuser /app \
 && chmod 755 data logs uploads recordings

# Switch to non-root user for runtime security
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "server.js"]
