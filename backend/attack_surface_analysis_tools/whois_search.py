import whois
import json
from typing import List


def get_whois(domain: str) -> List[List[str]]:
    try:
        w = whois.whois(domain)
        json_output = json.loads(str(w))

        key_values = [[str(key).replace("_", " ").title(), json_output[key]] for key in json_output]
        return key_values
    except Exception:
        return []