
import http.server
import socketserver
import webbrowser
import os
import threading
import time

PORT = 8000
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Servidor iniciado: http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    # Iniciar el servidor en un hilo separado
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()

    # Abrir el navegador tras esperar un momento
    time.sleep(1)
    webbrowser.open(f"http://localhost:{PORT}")

    print("Presiona Ctrl+C para detener el servidor.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServidor detenido.")
