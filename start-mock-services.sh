#!/bin/bash

# Start persistent mock services for all streaming protocols

# Kill any existing processes
pkill -f "nc -l"

# Start RTMP mock (port 1935) - use socat for persistent listening
socat TCP-LISTEN:1935,fork,reuseaddr EXEC:'/bin/cat' &
echo "RTMP mock service started on port 1935"

# Start WebRTC mock (port 3333) - use socat for persistent listening  
socat TCP-LISTEN:3333,fork,reuseaddr EXEC:'/bin/cat' &
echo "WebRTC mock service started on port 3333"

# Start SRT UDP mock (port 9999) - use socat for persistent listening
socat UDP-LISTEN:9999,fork,reuseaddr EXEC:'/bin/cat' &
echo "SRT UDP mock service started on port 9999"

echo "All streaming protocol mock services are running"

# Test all ports
sleep 2
echo "Testing ports:"
nc -z localhost 1935 && echo "✅ RTMP (1935) accessible" || echo "❌ RTMP (1935) failed"
nc -z localhost 3333 && echo "✅ WebRTC (3333) accessible" || echo "❌ WebRTC (3333) failed"  
nc -z -u localhost 9999 && echo "✅ SRT UDP (9999) accessible" || echo "❌ SRT UDP (9999) failed"