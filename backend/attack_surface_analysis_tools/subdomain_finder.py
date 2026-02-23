import os
import requests
import urllib3
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

REQUEST_TIMEOUT = 3.0
MAX_PROBES = 100


def _check_subdomain(session: requests.Session, subdomain: str, domain: str) -> str:
    url = f"https://{subdomain}.{domain}"
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True, verify=False)
        if resp.status_code == 200:
            return url
    except Exception:
        pass
    return None


def get_subdomains(domain: str) -> List[str]:
    results: List[str] = []
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=20, pool_maxsize=20)
    session.mount('https://', adapter)
    session.mount('http://', adapter)

    # Resolve subdomain list path relative to this file so imports from elsewhere work
    subdomains_path = os.path.join(os.path.dirname(__file__), 'subdomain_list.txt')
    subdomains = []
    try:
        with open(subdomains_path, 'r', encoding='utf-8') as file:
            subdomains = file.read().splitlines()[:MAX_PROBES]
    except FileNotFoundError as e:
        print(f"[DEBUG SUBDOMAIN] subdomain list not found: {subdomains_path} - {e}")
        subdomains = []
    except Exception as e:
        print(f"[DEBUG SUBDOMAIN] error reading subdomain list: {e}")
        subdomains = []

    print(f"[DEBUG SUBDOMAIN] Checking {len(subdomains)} subdomains for {domain} in parallel")
    
    with ThreadPoolExecutor(max_workers=15) as ex:
        futures = {ex.submit(_check_subdomain, session, sub, domain): sub for sub in subdomains}
        for fut in as_completed(futures):
            try:
                result = fut.result()
                if result:
                    results.append(result)
                    print(f"[DEBUG SUBDOMAIN] Found: {result}")
            except Exception:
                continue

    print(f"[DEBUG SUBDOMAIN] Total found: {len(results)}")
    return results