#!/bin/bash
set -euo pipefail

# Generate SSL certificates if they don't exist
if [ ! -f "/opt/ovenmediaengine/bin/origin_conf/cert.crt" ]; then
    echo "Generating SSL certificates..."
    openssl genrsa -out "/opt/ovenmediaengine/bin/origin_conf/cert.key" 2048
    openssl req -new -key "/opt/ovenmediaengine/bin/origin_conf/cert.key" -out "/opt/ovenmediaengine/bin/origin_conf/cert.csr" -subj "/C=US/ST=CA/L=San Francisco/O=Cruvz Streaming/OU=IT/CN=localhost"
    openssl x509 -req -days 365 -in "/opt/ovenmediaengine/bin/origin_conf/cert.csr" -signkey "/opt/ovenmediaengine/bin/origin_conf/cert.key" -out "/opt/ovenmediaengine/bin/origin_conf/cert.crt"
    touch "/opt/ovenmediaengine/bin/origin_conf/cert.ca-bundle"
    chmod 600 "/opt/ovenmediaengine/bin/origin_conf/cert.key"
    chmod 644 "/opt/ovenmediaengine/bin/origin_conf/cert.crt"
    chmod 644 "/opt/ovenmediaengine/bin/origin_conf/cert.ca-bundle"
    rm -f "/opt/ovenmediaengine/bin/origin_conf/cert.csr"
    echo "SSL certificates generated successfully"
fi

# Start health check server in background
/opt/ovenmediaengine/bin/simple-health-server.sh &

# Execute the main command
exec "$@"