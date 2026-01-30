import nmap
from typing import List, Tuple

PORT_LIST = [21, 22, 23, 80, 443, 445, 3306, 3389, 8080]


def scan_ports(ip: str, timeout: int = 10) -> List[Tuple[int, str]]:
    results: List[Tuple[int, str]] = []
    print(f"[DEBUG PORT] Scanning {ip} for {len(PORT_LIST)} ports")
    try:
        scanner = nmap.PortScanner()
        port_range = ','.join(map(str, PORT_LIST))
        print(f"[DEBUG PORT] Running scan with range: {port_range}")
        
        res = scanner.scan(ip, port_range, arguments='-Pn -T4 --max-retries 1')
        
        if ip in res.get('scan', {}):
            tcp_info = res['scan'][ip].get('tcp', {})
            for port in PORT_LIST:
                if port in tcp_info and tcp_info[port]['state'] == 'open':
                    results.append((port, tcp_info[port].get('name', 'unknown')))
                    print(f"[DEBUG PORT] Found open: {port}/{tcp_info[port].get('name', 'unknown')}")
    except Exception as e:
        print(f"[DEBUG PORT] Error: {e}")
    
    print(f"[DEBUG PORT] Total open ports: {len(results)}")
    return results