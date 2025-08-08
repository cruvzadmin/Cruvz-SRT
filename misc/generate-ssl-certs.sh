#!/bin/bash

# Generate SSL certificates for Oven Media Engine
# This script creates self-signed certificates for production deployment

set -euo pipefail

CERT_DIR="/opt/ovenmediaengine/bin/origin_conf"
DOMAIN="${SSL_DOMAIN:-localhost}"

# Create certificate directory if it doesn't exist
mkdir -p "$CERT_DIR"

echo "Generating SSL certificates for domain: $DOMAIN"

# Generate private key
openssl genrsa -out "$CERT_DIR/cert.key" 2048

# Generate certificate signing request
openssl req -new -key "$CERT_DIR/cert.key" -out "$CERT_DIR/cert.csr" -subj "/C=US/ST=CA/L=San Francisco/O=Cruvz Streaming/OU=IT/CN=$DOMAIN"

# Generate self-signed certificate
openssl x509 -req -days 365 -in "$CERT_DIR/cert.csr" -signkey "$CERT_DIR/cert.key" -out "$CERT_DIR/cert.crt"

# Create empty chain certificate file (for self-signed)
touch "$CERT_DIR/cert.ca-bundle"

# Set proper permissions
chmod 600 "$CERT_DIR/cert.key"
chmod 644 "$CERT_DIR/cert.crt"
chmod 644 "$CERT_DIR/cert.ca-bundle"

# Clean up CSR
rm -f "$CERT_DIR/cert.csr"

echo "SSL certificates generated successfully in $CERT_DIR"
echo "Certificate: $CERT_DIR/cert.crt"
echo "Private Key: $CERT_DIR/cert.key"
echo "Chain Bundle: $CERT_DIR/cert.ca-bundle"