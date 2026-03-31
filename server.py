import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

DB_FILE = 'workouts.json'

class APIHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/workouts':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            data = []
            if os.path.exists(DB_FILE):
                with open(DB_FILE, 'r') as f:
                    try:
                        data = json.load(f)
                    except:
                        data = []
            self.wfile.write(json.dumps(data).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/workouts':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            workout = json.loads(post_data)
            
            data = []
            if os.path.exists(DB_FILE):
                with open(DB_FILE, 'r') as f:
                    try:
                        data = json.load(f)
                    except:
                        data = []
            
            data.append(workout)
            with open(DB_FILE, 'w') as f:
                json.dump(data, f)
                
            self.send_response(201)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(workout).encode('utf-8'))
        else:
            self.send_error(404)

if __name__ == '__main__':
    server_address = ('127.0.0.1', 8080)
    httpd = HTTPServer(server_address, APIHandler)
    print("Serving API on http://127.0.0.1:8080")
    httpd.serve_forever()
