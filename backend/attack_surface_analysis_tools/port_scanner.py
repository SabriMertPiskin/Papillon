from typing import List, Tuple
import socket

PORT_LIST = [21, 22, 23, 80, 443, 445, 3306, 3389, 8080]

# Prefer python-nmap if available, but fall back to a simple socket-based scan
try:
    import nmap  # type: ignore
    _HAS_NMAP = True
except Exception:
    _HAS_NMAP = False


def scan_ports(ip: str, timeout: int = 3) -> List[Tuple[int, str]]:
    results: List[Tuple[int, str]] = []
    print(f"[DEBUG PORT] Scanning {ip} for {len(PORT_LIST)} ports (nmap={_HAS_NMAP})")

    if _HAS_NMAP:
        try:
            scanner = nmap.PortScanner()
            port_range = ','.join(map(str, PORT_LIST))
            print(f"[DEBUG PORT] Running nmap with range: {port_range}")
            res = scanner.scan(ip, port_range, arguments='-Pn -T4 --max-retries 1')

            if ip in res.get('scan', {}):
                tcp_info = res['scan'][ip].get('tcp', {})
                for port in PORT_LIST:
                    if port in tcp_info and tcp_info[port]['state'] == 'open':
                        results.append((port, tcp_info[port].get('name', 'unknown')))
                        print(f"[DEBUG PORT] Found open: {port}/{tcp_info[port].get('name', 'unknown')}")
        except Exception as e:
            print(f"[DEBUG PORT] nmap error: {e}")

    else:
        print("[DEBUG PORT] nmap not installed, falling back to socket connect checks")
        for port in PORT_LIST:
            try:
                with socket.create_connection((ip, port), timeout=timeout):
                    results.append((port, 'unknown'))
                    print(f"[DEBUG PORT] Found open (socket): {port}")
            except Exception:
                continue

    print(f"[DEBUG PORT] Total open ports: {len(results)}")
    return results