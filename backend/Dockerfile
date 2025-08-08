# Six Sigma Zero-Error Backend - No External Dependencies Required
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy all application files
COPY . .

# Create required directories
RUN mkdir -p data logs uploads recordings && \
    chmod 755 data logs uploads recordings

# Create a minimal package.json for Node.js built-ins only
RUN echo '{"name":"cruvz-backend","version":"1.0.0","main":"server-minimal.js","scripts":{"start":"node server-minimal.js"}}' > package.json

# Expose port
EXPOSE 5000

# Health check using Node.js built-ins only (IPv4 explicit)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:5000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start application
CMD ["node", "server-minimal.js"]
