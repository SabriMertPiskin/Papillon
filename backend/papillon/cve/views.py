from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import requests
from datetime import datetime, timedelta

@require_http_methods(["GET"])
def latest_cves(request):
    """Fetch latest 10 CVEs from NVD API"""
    try:
        # NVD API endpoint
        url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        
        # Get CVEs from last 7 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        params = {
            'pubStartDate': start_date.strftime('%Y-%m-%dT%H:%M:%S.000'),
            'pubEndDate': end_date.strftime('%Y-%m-%dT%H:%M:%S.000'),
            'resultsPerPage': 10
        }
        
        # Add API key if you have one (recommended for rate limits)
        # Get free key at: https://nvd.nist.gov/developers/request-an-api-key
        # params['apiKey'] = 'YOUR_API_KEY'
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        vulnerabilities = data.get('vulnerabilities', [])
        
        # Parse CVE data
        cves = []
        for item in vulnerabilities[:10]:
            cve_data = item.get('cve', {})
            cve_id = cve_data.get('id', 'N/A')
            
            # Get description
            descriptions = cve_data.get('descriptions', [])
            description = next(
                (d['value'] for d in descriptions if d.get('lang') == 'en'),
                'No description available'
            )
            
            # Get severity
            metrics = cve_data.get('metrics', {})
            severity = 'UNKNOWN'
            score = 0.0
            
            if 'cvssMetricV31' in metrics and metrics['cvssMetricV31']:
                cvss = metrics['cvssMetricV31'][0]['cvssData']
                severity = cvss.get('baseSeverity', 'UNKNOWN')
                score = cvss.get('baseScore', 0.0)
            elif 'cvssMetricV2' in metrics and metrics['cvssMetricV2']:
                cvss = metrics['cvssMetricV2'][0]
                severity = cvss.get('baseSeverity', 'UNKNOWN')
                score = cvss.get('baseScore', 0.0)
            
            # Get published date
            published = cve_data.get('published', '')
            
            # Get references
            references = cve_data.get('references', [])
            refs = [ref.get('url', '') for ref in references[:3]]
            
            cves.append({
                'id': cve_id,
                'description': description,
                'severity': severity,
                'score': score,
                'published': published,
                'references': refs
            })
        
        return JsonResponse({
            'success': True,
            'count': len(cves),
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
