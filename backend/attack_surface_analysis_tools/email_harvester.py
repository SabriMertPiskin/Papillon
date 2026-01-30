import requests
import re
from bs4 import BeautifulSoup
from typing import List, Set
from urllib.parse import urljoin
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

REQUEST_TIMEOUT = 3.0
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')

COMMON_PAGES = ['contact', 'about', 'about-us', 'team', 'support']


def harvest_emails(domain: str) -> List[dict]:
    found_emails = {}
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=5, pool_maxsize=5)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    
    print(f"[DEBUG EMAIL] Starting email harvest for {domain}")
    
    pages_to_check = [(f"https://{domain}", "main page")]
    for page in COMMON_PAGES:
        pages_to_check.append((f"https://{domain}/{page}", f"/{page}"))
    
    for url, page_name in pages_to_check[:4]:
        try:
            print(f"[DEBUG EMAIL] Checking {url}")
            resp = session.get(url, timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=True)
            
            emails = EMAIL_PATTERN.findall(resp.text)
            for email in emails:
                email_lower = email.lower()
                if _is_valid_email(email_lower):
                    if email_lower not in found_emails:
                        found_emails[email_lower] = page_name
                    print(f"[DEBUG EMAIL] Found: {email_lower} from {page_name}")
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            mailto_links = soup.find_all('a', href=re.compile(r'^mailto:'))
            for link in mailto_links:
                email = link.get('href', '').replace('mailto:', '').split('?')[0].lower()
                if email and _is_valid_email(email):
                    if email not in found_emails:
                        found_emails[email] = page_name
                    print(f"[DEBUG EMAIL] Found (mailto): {email} from {page_name}")
        
        except Exception as e:
            print(f"[DEBUG EMAIL] Error on {url}: {e}")
            continue
    
    result = [{'email': email, 'source': source} for email, source in sorted(found_emails.items())]
    print(f"[DEBUG EMAIL] Total unique emails found: {len(result)}")
    return result


def _is_valid_email(email: str) -> bool:
    if '@' not in email:
        return False
    
    spam_domains = ['example.com', 'test.com', 'sample.com', 'yoursite.com', 
                    'yourdomain.com', 'domain.com', 'email.com', 'sentry.io',
                    'wixpress.com', 'placeholder.com']
    
    domain = email.split('@')[1]
    if domain in spam_domains:
        return False
    
    invalid_patterns = ['noreply', 'no-reply', 'donotreply', 'postmaster', 
                        'webmaster', 'admin@localhost', '@localhost']
    
    for pattern in invalid_patterns:
        if pattern in email:
            return False
    
    return True
