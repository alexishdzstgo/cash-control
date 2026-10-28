import socket
import threading
import sys

def forward(src, dst):
    try:
        while True:
            data = src.recv(4096)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        try:
            src.close()
        except Exception:
            pass
        try:
            dst.close()
        except Exception:
            pass

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', 5433))
    server.listen(10)
    print("PG_PROXY_LISTENING_5433", flush=True)

    while True:
        client_sock, addr = server.accept()
        pg_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            pg_sock.connect(('127.0.0.1', 5432))
        except Exception as e:
            print("Failed to connect to local PG:", e, flush=True)
            client_sock.close()
            continue

        t1 = threading.Thread(target=forward, args=(client_sock, pg_sock), daemon=True)
        t2 = threading.Thread(target=forward, args=(pg_sock, client_sock), daemon=True)
        t1.start()
        t2.start()

if __name__ == '__main__':
    main()
