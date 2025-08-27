#!/bin/bash

# Simple health endpoint that doesn't require authentication
# This runs a basic HTTP server on port 8090 to serve health checks

while true; do
  {
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: application/json"
    echo "Connection: close"
    echo ""
    echo '{"status":"healthy","timestamp":"'$(date -Iseconds)'"}'
  } | nc -l -p 8090 -q 1
done