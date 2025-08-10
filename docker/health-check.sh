#!/bin/bash
# Production Health Check Endpoint
if pgrep -f OvenMediaEngine > /dev/null; then
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: application/json"
    echo ""
    echo "{\"status\":\"healthy\",\"service\":\"cruvz-streaming\",\"timestamp\":\"$(date -Iseconds)\"}"
else
    echo "HTTP/1.1 503 Service Unavailable"
    echo "Content-Type: application/json"
    echo ""
    echo "{\"status\":\"unhealthy\",\"service\":\"cruvz-streaming\",\"timestamp\":\"$(date -Iseconds)\"}"
fi