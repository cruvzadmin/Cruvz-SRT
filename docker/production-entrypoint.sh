#!/bin/bash
set -euo pipefail

# Create writable SSL directory if needed (not in mounted volumes)
SSL_DIR="/opt/ovenmediaengine/generated_ssl"
mkdir -p "$SSL_DIR"

# Generate SSL certificates if they don't exist
if [ ! -f "$SSL_DIR/cert.crt" ]; then
    echo "Skipping SSL certificate generation for faster startup..."
    # Create dummy certificates if needed by OvenMediaEngine
    touch "$SSL_DIR/cert.crt" "$SSL_DIR/cert.key" "$SSL_DIR/cert.ca-bundle"
    chmod 600 "$SSL_DIR/cert.key"
    chmod 644 "$SSL_DIR/cert.crt"
    chmod 644 "$SSL_DIR/cert.ca-bundle"
    echo "Dummy SSL certificates created in $SSL_DIR"
else
    echo "SSL certificates already exist in $SSL_DIR"
fi

# Start health check server in background
/opt/ovenmediaengine/bin/simple-health-server.sh &

# Execute the main command
exec "$@"