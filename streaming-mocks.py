#!/usr/bin/env python3
import socketserver
import threading
import socket
import time

class TCPHandler(socketserver.BaseRequestHandler):
    def handle(self):
        # Just accept connections and keep them open
        try:
            while True:
                data = self.request.recv(1024)
                if not data:
                    break
        except:
            pass

class UDPHandler(socketserver.BaseRequestHandler):
    def handle(self):
        # Handle UDP packets
        data = self.request[0]
        socket = self.request[1]
        # Just acknowledge receipt
        pass

def start_tcp_server(port):
    server = socketserver.TCPServer(("localhost", port), TCPHandler)
    server.allow_reuse_address = True
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()
    print(f"TCP server listening on port {port}")
    return server

def start_udp_server(port):
    server = socketserver.UDPServer(("localhost", port), UDPHandler)
    server.allow_reuse_address = True
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()
    print(f"UDP server listening on port {port}")
    return server

if __name__ == "__main__":
    # Start RTMP mock (TCP 1935)
    rtmp_server = start_tcp_server(1935)
    
    # Start WebRTC mock (TCP 3333)
    webrtc_server = start_tcp_server(3333)
    
    # Start SRT mock (UDP 9999)
    srt_server = start_udp_server(9999)
    
    print("\nAll streaming protocol mock services started!")
    print("Press Ctrl+C to stop...")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        rtmp_server.shutdown()
        webrtc_server.shutdown()
        srt_server.shutdown()