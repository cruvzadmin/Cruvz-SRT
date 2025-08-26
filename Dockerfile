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
COPY configs/Server.xml /opt/ovenmediaengine/bin/origin_conf/Server.xml
COPY configs/Logger.xml /opt/ovenmediaengine/bin/origin_conf/Logger.xml

# Set up directories for production
RUN mkdir -p /opt/ovenmediaengine/logs \
             /opt/ovenmediaengine/metrics \
             /opt/ovenmediaengine/health \
             /tmp/nginx-logs

# Correction: Ensure /tmp/nginx-logs is writable for log volume mounts
RUN chmod 777 /tmp/nginx-logs

 copilot/fix-35e09d45-ea2b-4c35-9d21-3c087e1cf288
# Production Port Exposure - Enable all streaming protocols
EXPOSE 80/tcp 8080/tcp 8081/tcp 8082/tcp 1935/tcp 3333/tcp 3334/tcp 4000-4005/udp 9998/udp 9999/udp 10000-10100/udp 9000/tcp 8088/tcp 8089/tcp

# Correction: expose full candidate port range for WebRTC as per compose (10000-10100/udp)
# Note: expose 10000-10100/udp above


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
