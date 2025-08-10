# PRODUCTION OPTIMIZED: Use pre-built OvenMediaEngine as base for faster deployment
FROM airensoft/ovenmediaengine:latest

# Install additional tools for production environment
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    netcat-openbsd \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# PRODUCTION ENVIRONMENT SETUP (using existing pre-built binaries)
WORKDIR /opt/ovenmediaengine/bin

# Copy custom configuration files
COPY misc/conf_examples/Origin.xml /opt/ovenmediaengine/bin/origin_conf/Server.xml
COPY misc/conf_examples/Logger.xml /opt/ovenmediaengine/bin/origin_conf/Logger.xml

# Set up directories for production
RUN mkdir -p /opt/ovenmediaengine/logs \
             /opt/ovenmediaengine/metrics \
             /opt/ovenmediaengine/health

# Production Port Exposure
EXPOSE 80/tcp 8080/tcp 1935/tcp 3333/tcp 3334/tcp 4000-4005/udp 10000-10010/udp 9000/tcp

# Production Health Check Script  
COPY docker/health-check.sh /opt/ovenmediaengine/bin/health-check.sh
RUN chmod +x /opt/ovenmediaengine/bin/health-check.sh

# Production Metrics endpoint
COPY docker/metrics.sh /opt/ovenmediaengine/bin/metrics.sh
RUN chmod +x /opt/ovenmediaengine/bin/metrics.sh

# Set up health check HTTP server
COPY docker/simple-health-server.sh /opt/ovenmediaengine/bin/simple-health-server.sh
RUN chmod +x /opt/ovenmediaengine/bin/simple-health-server.sh

# Copy production startup script
COPY docker/production-entrypoint.sh /opt/ovenmediaengine/bin/production-entrypoint.sh
RUN chmod +x /opt/ovenmediaengine/bin/production-entrypoint.sh

# Production Labels for monitoring
LABEL com.cruvz.production="enabled" \
      com.cruvz.monitoring="comprehensive" \
      com.cruvz.zero_errors="true"

# Default run as Origin mode with Production validation
CMD ["/opt/ovenmediaengine/bin/production-entrypoint.sh", "/opt/ovenmediaengine/bin/OvenMediaEngine", "-c", "origin_conf"]