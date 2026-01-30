import requests
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed

COMMON_PATHS: List[str] = [
    "admin",
    "login",
    "wp-admin",
    "administrator",
    "user/login",
    "cpanel",
    "dashboard",
    "cms",
    "panel",
    "auth",
    "backend",
    "manage",
]


def _probe(session: requests.Session, url: str, timeout: float) -> Dict[str, object]:
    try:
        resp = session.head(url, allow_redirects=True, timeout=timeout)
    except Exception:
        try:
            resp = session.get(url, allow_redirects=True, timeout=timeout)
        except Exception as ex:
            return {"url": url, "status": "error", "detail": str(ex)}

    info: Dict[str, object] = {
        "url": resp.url,
        "code": resp.status_code,
        "reason": resp.reason,
        "redirects": len(resp.history),
    }

    lower_headers = " ".join(f"{k}: {v}" for k, v in resp.headers.items()).lower()
    body_hint = ""
    try:
        body_snippet = resp.text[:500].lower()
        body_hint = "login" if "login" in body_snippet else ""
    except Exception:
        body_snippet = ""

    hints: List[str] = []
    if "wp-admin" in resp.url.lower():
        hints.append("wordpress")
    if "admin" in resp.url.lower():
        hints.append("admin-path")
    if "login" in resp.url.lower() or body_hint:
        hints.append("login-form")
    if "x-powered-by" in lower_headers:
        hints.append("tech-header")

    info["hints"] = list(set(hints))
    info["status"] = "ok"
    return info


def find_admin_panels(domain: str, timeout: float = 1.5) -> List[Dict[str, object]]:
    urls = [f"https://{domain}/{path}" for path in COMMON_PATHS]
    results: List[Dict[str, object]] = []

    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10)
    session.mount('https://', adapter)
    session.mount('http://', adapter)

    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(_probe, session, url, timeout): url for url in urls}
        for fut in as_completed(futures):
            try:
                results.append(fut.result())
            except Exception as exc:
                results.append({"url": futures[fut], "status": "error", "detail": str(exc)})

    return results
