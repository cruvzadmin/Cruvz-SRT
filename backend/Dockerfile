# Cruvz Streaming Backend API Dockerfile
# Lightweight production build

FROM node:18-slim

WORKDIR /app

# Copy package files and scripts
COPY package*.json ./
COPY scripts/ ./scripts/

# Install only production dependencies
RUN npm install --production --no-optional

# Copy application code
COPY . .

# Create directories
RUN mkdir -p data logs uploads recordings

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
