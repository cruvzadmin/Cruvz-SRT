#!/bin/bash
set -euo pipefail

# Create writable SSL directory if needed (not in mounted volumes)
SSL_DIR="/opt/ovenmediaengine/generated_ssl"
mkdir -p "$SSL_DIR"

# Generate SSL certificates if they don't exist
if [ ! -f "$SSL_DIR/cert.crt" ]; then
    echo "Generating SSL certificates..."
    openssl genrsa -out "$SSL_DIR/cert.key" 2048
    openssl req -new -key "$SSL_DIR/cert.key" -out "$SSL_DIR/cert.csr" -subj "/C=US/ST=CA/L=San Francisco/O=Cruvz Streaming/OU=IT/CN=localhost"
    openssl x509 -req -days 365 -in "$SSL_DIR/cert.csr" -signkey "$SSL_DIR/cert.key" -out "$SSL_DIR/cert.crt"
    touch "$SSL_DIR/cert.ca-bundle"
    chmod 600 "$SSL_DIR/cert.key"
    chmod 644 "$SSL_DIR/cert.crt"
    chmod 644 "$SSL_DIR/cert.ca-bundle"
    rm -f "$SSL_DIR/cert.csr"
    echo "SSL certificates generated successfully in $SSL_DIR"
else
    echo "SSL certificates already exist in $SSL_DIR"
fi

# Start health check server in background
/opt/ovenmediaengine/bin/simple-health-server.sh &

# Execute the main command
exec "$@"