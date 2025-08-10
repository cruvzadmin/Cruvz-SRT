#!/bin/bash
# Production Metrics Endpoint
echo "HTTP/1.1 200 OK"
echo "Content-Type: text/plain"
echo ""
echo "# Production Quality Metrics"
echo "cruvz_streaming_uptime_seconds $(cat /proc/uptime | cut -d' ' -f1)"
echo "cruvz_streaming_process_running $(pgrep -c OvenMediaEngine)"
echo "cruvz_streaming_production_ready 1"