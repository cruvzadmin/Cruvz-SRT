#!/bin/bash
# Production Health Check Endpoint

# Correction: Check OvenMediaEngine API endpoint with correct API header

API_URL="http://localhost:8080/v1/stats/current"
API_TOKEN="${OME_ACCESS_TOKEN:-cruvz-production-api-token-2025}"

# OvenMediaEngine expects: Authorization: access-token <token>
if curl -fs -H "Authorization: access-token $API_TOKEN" "$API_URL" >/dev/null; then
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
