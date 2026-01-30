import socket


def get_ip(domain: str, timeout: float = 2.0) -> str:
    try:
        socket.setdefaulttimeout(timeout)
        ipv4_addresses = socket.getaddrinfo(domain, 443, socket.AF_INET)
        ipv4_list = [addr[4][0] for addr in ipv4_addresses]
        return list(set(ipv4_list))[0] if ipv4_list else "0.0.0.0"
    except Exception:
        return "0.0.0.0"

