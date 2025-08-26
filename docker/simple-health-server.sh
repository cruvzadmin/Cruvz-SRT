#!/bin/bash
while true; do
copilot/fix-35e09d45-ea2b-4c35-9d21-3c087e1cf288
    echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"healthy\"}" | nc -l -p 8090 -q 1
done
