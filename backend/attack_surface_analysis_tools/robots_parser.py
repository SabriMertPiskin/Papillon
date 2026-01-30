import requests


def get_robots_txt(domain: str) -> str:
    session = requests.Session()
    try:
        res = session.get(url=f"https://{domain}/robots.txt", timeout=3.0)
        return res.text
    except Exception:
        return ""
