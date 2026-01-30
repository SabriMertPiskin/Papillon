import dns.resolver
import dns.rdatatype
from typing import List, Tuple

RECORD_TYPES = ["A", "AAAA", "NS", "CNAME", "MX", "TXT", "SOA", "CAA"]


def get_records(domain: str, timeout: float = 3.0) -> List[Tuple[str, str]]:
    resolver = dns.resolver.Resolver()
    resolver.timeout = timeout
    resolver.lifetime = timeout
    results: List[Tuple[str, str]] = []

    for rtype in RECORD_TYPES:
        try:
            answer = resolver.resolve(domain, rtype, raise_on_no_answer=False)
            if not answer.rrset:
                continue
            rtype_txt = dns.rdatatype.to_text(answer.rdtype)
            for rr in answer:
                results.append((rtype_txt, rr.to_text()))
        except (dns.resolver.NXDOMAIN, dns.resolver.NoNameservers, dns.resolver.NoAnswer):
            continue
        except Exception:
            continue
    return results