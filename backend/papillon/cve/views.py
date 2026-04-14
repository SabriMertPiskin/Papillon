from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import requests
from datetime import datetime, timedelta

@require_http_methods(["GET"])
def latest_cves(request):
    """Fetch latest CVEs from NVD API"""
    try:
        # Get limit from query params (default 10)
        limit = int(request.GET.get('limit', 10))
        limit = min(max(limit, 1), 50)  # Clamp between 1 and 50
        
        # NVD API endpoint
        url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        
        # Get CVEs from last 60 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=60)
        
        # Paginate through NVD results until we have enough non-rejected CVEs
        cves = []
        start_index = 0
        page_size = min(limit * 4, 200)  # Fetch more per page to reduce API calls
        max_api_calls = 5  # Safety limit to prevent excessive API calls
        api_calls = 0

        while len(cves) < limit and api_calls < max_api_calls:
            params = {
                'pubStartDate': start_date.strftime('%Y-%m-%dT%H:%M:%S.000'),
                'pubEndDate': end_date.strftime('%Y-%m-%dT%H:%M:%S.000'),
                'resultsPerPage': page_size,
                'startIndex': start_index,
            }
            
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            api_calls += 1
            
            data = response.json()
            vulnerabilities = data.get('vulnerabilities', [])
            total_results = data.get('totalResults', 0)

            if not vulnerabilities:
                break  # No more results from NVD

            for item in vulnerabilities:
                if len(cves) >= limit:
                    break

                cve_data = item.get('cve', {})
                cve_id = cve_data.get('id', 'N/A')
                vuln_status = cve_data.get('vulnStatus', '')

                # Skip rejected or empty CVEs
                if vuln_status.upper() in ('REJECTED', 'DEFERRED'):
                    continue
                
                # Get description
                descriptions = cve_data.get('descriptions', [])
                description = next(
                    (d['value'] for d in descriptions if d.get('lang') == 'en'),
                    'No description available'
                )

                # Skip entries with placeholder/rejected descriptions
                if description.startswith('** REJECT'):
                    continue
                
                # Get severity (v4.0 → v3.1 → v2 fallback)
                metrics = cve_data.get('metrics', {})
                severity = 'UNKNOWN'
                score = 0.0

                if 'cvssMetricV40' in metrics and metrics['cvssMetricV40']:
                    cvss = metrics['cvssMetricV40'][0].get('cvssData', {})
                    severity = cvss.get('baseSeverity', 'UNKNOWN')
                    score = cvss.get('baseScore', 0.0)
                elif 'cvssMetricV31' in metrics and metrics['cvssMetricV31']:
                    cvss = metrics['cvssMetricV31'][0].get('cvssData', {})
                    severity = cvss.get('baseSeverity', 'UNKNOWN')
                    score = cvss.get('baseScore', 0.0)
                elif 'cvssMetricV2' in metrics and metrics['cvssMetricV2']:
                    cvss = metrics['cvssMetricV2'][0]
                    severity = cvss.get('baseSeverity', 'UNKNOWN')
                    score = cvss.get('baseScore', 0.0)
                
                # Get published date
                published = cve_data.get('published', '')
                
                # Get ALL references
                references = cve_data.get('references', [])
                refs = [ref.get('url', '') for ref in references if ref.get('url')]

                # NVD detail page URL
                nvd_url = f'https://nvd.nist.gov/vuln/detail/{cve_id}'
                
                cves.append({
                    'id': cve_id,
                    'description': description,
                    'severity': severity,
                    'score': score,
                    'published': published,
                    'references': refs,
                    'nvd_url': nvd_url,
                    'status': vuln_status,
                })

            # Move to next page
            start_index += page_size
            if start_index >= total_results:
                break  # No more pages available
        
        return JsonResponse({
            'success': True,
            'count': len(cves),
            'limit': limit,
            'cves': cves
        }, status=200)
    
    except requests.RequestException as e:
        return JsonResponse({
            'success': False,
            'detail': f'Error fetching CVEs: {str(e)}'
        }, status=500)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'detail': str(e)
        }, status=500)
