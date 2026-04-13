import requests
from requests.auth import HTTPBasicAuth
from html.parser import HTMLParser


class CPanelAPIError(Exception):
    pass


class _SimpleTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self._in_table = False
        self._in_row = False
        self._cell_tag = None
        self._current_table = []
        self._current_row = []
        self._current_cell = []

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self._in_table = True
            self._current_table = []
        elif tag == 'tr' and self._in_table:
            self._in_row = True
            self._current_row = []
        elif tag in ('td', 'th') and self._in_row:
            self._cell_tag = tag
            self._current_cell = []

    def handle_data(self, data):
        if self._cell_tag:
            self._current_cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self._cell_tag == tag:
            self._current_row.append(' '.join(part.strip() for part in self._current_cell if part.strip()))
            self._cell_tag = None
            self._current_cell = []
        elif tag == 'tr' and self._in_row:
            if any(cell for cell in self._current_row):
                self._current_table.append(self._current_row)
            self._current_row = []
            self._in_row = False
        elif tag == 'table' and self._in_table:
            if self._current_table:
                self.tables.append(self._current_table)
            self._current_table = []
            self._in_table = False


class _LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self._current_href = ''
        self._current_text = []

    def handle_starttag(self, tag, attrs):
        if tag != 'a':
            return
        href = dict(attrs).get('href') or ''
        self._current_href = href
        self._current_text = []

    def handle_data(self, data):
        if self._current_href:
            self._current_text.append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self._current_href:
            self.links.append({
                'href': self._current_href,
                'text': ' '.join(part.strip() for part in self._current_text if part.strip()),
            })
            self._current_href = ''
            self._current_text = []


class CPanelClient:
    def __init__(self, host, username, token='', password='', verify_ssl=True, timeout=15):
        self.host = (host or '').strip().rstrip('/')
        self.username = (username or '').strip()
        self.token = (token or '').strip()
        self.password = (password or '').strip()
        self.verify_ssl = verify_ssl
        self.timeout = timeout

    @property
    def base_url(self):
        return f"https://{self.host}:2083/execute"

    @property
    def headers(self):
        headers = {
            'Authorization': f'cpanel {self.username}:{self.token}',
            'Accept': 'application/json',
        }
        if self.password:
            headers.pop('Authorization', None)
        return headers

    @property
    def auth(self):
        if self.password:
            return HTTPBasicAuth(self.username, self.password)
        return None

    def call(self, module, function, params=None):
        response = requests.get(
            f"{self.base_url}/{module}/{function}",
            headers=self.headers,
            auth=self.auth,
            params=params or {},
            timeout=self.timeout,
            verify=self.verify_ssl,
        )
        response.raise_for_status()
        payload = response.json()
        result = payload.get('result') or {}
        if result.get('status') not in (1, None):
            message = result.get('errors') or result.get('messages') or 'cPanel API call failed'
            raise CPanelAPIError(str(message))
        return result.get('data')

    @staticmethod
    def _ensure_list_payload(payload, default_name='value'):
        if payload is None:
            return []
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            if isinstance(payload.get('data'), list):
                return payload['data']
            if isinstance(payload.get('items'), list):
                return payload['items']
            if isinstance(payload.get('usage'), list):
                return payload['usage']
            normalized = []
            for key, value in payload.items():
                if isinstance(value, dict):
                    row = {'name': key}
                    row.update(value)
                    normalized.append(row)
                else:
                    normalized.append({'name': key or default_name, 'value': value})
            return normalized
        return [{'name': default_name, 'value': payload}]

    def test_connection(self):
        data = self.call('StatsBar', 'get_stats', {'display': 'bandwidthusage|diskusage'})
        return {'connected': True, 'stats': data}

    def _safe_call(self, module, function, params=None, default=None, warnings=None, warning_label=None):
        try:
            return self.call(module, function, params or {})
        except Exception as exc:
            if warnings is not None:
                warnings.append({
                    'source': warning_label or f'{module}/{function}',
                    'detail': str(exc),
                })
            return default

    def _list_report_dir(self, directory, warnings):
        data = self._safe_call(
            'Fileman',
            'list_files',
            {'dir': directory},
            default=[],
            warnings=warnings,
            warning_label=f'Fileman/list_files:{directory}',
        )
        return self._ensure_list_payload(data, default_name='file')

    def _read_report_preview(self, directory, filename, warnings):
        if not filename:
            return None
        return self._safe_call(
            'Fileman',
            'get_file_content',
            {
                'dir': directory,
                'file': filename,
                'from_charset': 'utf-8',
                'to_charset': 'utf-8',
            },
            default=None,
            warnings=warnings,
            warning_label=f'Fileman/get_file_content:{directory}/{filename}',
        )

    def _discover_report_files(self, domain, warnings):
        candidates = [
            'logs',
            'tmp',
            'tmp/analog',
            'tmp/awstats',
            'tmp/webalizer',
        ]
        discovered = []
        previews = []
        normalized_domain = (domain or '').lower()

        for directory in candidates:
            entries = self._list_report_dir(directory, warnings)
            for entry in entries:
                name = str(
                    entry.get('file')
                    or entry.get('name')
                    or entry.get('fullpath')
                    or entry.get('path')
                    or ''
                ).strip()
                if not name:
                    continue
                lower_name = name.lower()
                if normalized_domain and normalized_domain not in lower_name:
                    continue
                if not any(token in lower_name for token in ('awstats', 'webalizer', 'analog', 'log', '.html', '.txt', '.gz')):
                    continue

                discovered.append({
                    'directory': directory,
                    'name': name,
                    'size': entry.get('size') or entry.get('human_size') or entry.get('bytes'),
                    'modified': entry.get('mtime') or entry.get('modified') or entry.get('date'),
                    'type': entry.get('type') or entry.get('mime') or entry.get('filetype'),
                })

                if len(previews) >= 3:
                    continue
                if lower_name.endswith(('.html', '.txt')):
                    preview = self._read_report_preview(directory, name, warnings)
                    if isinstance(preview, dict):
                        content = preview.get('content') or preview.get('contents') or ''
                    else:
                        content = preview or ''
                    if content:
                        previews.append({
                            'directory': directory,
                            'name': name,
                            'content_preview': str(content)[:4000],
                        })

        return discovered, previews

    def _login_session(self, warnings):
        if not self.password:
            warnings.append({'source': 'session_login', 'detail': 'No cPanel password available for session login'})
            return None, ''

        session = requests.Session()
        login_url = f"https://{self.host}:2083/login/?login_only=1"

        try:
            response = session.post(
                login_url,
                data={'user': self.username, 'pass': self.password},
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            warnings.append({'source': 'session_login', 'detail': str(exc)})
            return None, ''

        if payload.get('status') not in (1, '1') and payload.get('security_token') is None:
            warnings.append({'source': 'session_login', 'detail': f'Unexpected login response: {payload}'})
            return None, ''

        security_token = str(payload.get('security_token') or '').strip()
        if not security_token:
            redirect = str(payload.get('redirect') or payload.get('url') or '').strip()
            if '/cpsess' in redirect:
                security_token = redirect.split(':2083', 1)[-1]
                security_token = '/' + security_token.strip('/').split('/', 1)[0]

        if not security_token.startswith('/'):
            security_token = f'/{security_token}' if security_token else ''

        return session, security_token

    @staticmethod
    def _parse_html_tables(html_text):
        parser = _SimpleTableParser()
        parser.feed(html_text or '')
        tables = []
        for table in parser.tables[:8]:
            if not table:
                continue
            headers = table[0]
            rows = []
            for row in table[1:]:
                if not any(row):
                    continue
                row_data = {}
                for index, value in enumerate(row):
                    key = headers[index] if index < len(headers) and headers[index] else f'Column {index + 1}'
                    row_data[key] = value
                rows.append(row_data)
            tables.append({'headers': headers, 'rows': rows[:50]})
        return tables

    def _fetch_html_report(self, session, security_token, path, warnings):
        try:
            response = session.get(
                f"https://{self.host}:2083{security_token}{path}",
                timeout=self.timeout,
                verify=self.verify_ssl,
                allow_redirects=True,
            )
            response.raise_for_status()
            html_text = response.text or ''
        except Exception as exc:
            warnings.append({'source': f'html_report:{path}', 'detail': str(exc)})
            return None

        lowered = html_text.lower()
        if '<html' not in lowered:
            warnings.append({'source': f'html_report:{path}', 'detail': 'Response is not HTML'})
            return None

        return {
            'path': path,
            'title': html_text.split('<title>', 1)[-1].split('</title>', 1)[0].strip() if '<title>' in lowered else path,
            'tables': self._parse_html_tables(html_text),
            'links': self._extract_links(html_text)[:50],
            'html_preview': html_text[:6000],
        }

    @staticmethod
    def _extract_links(html_text):
        parser = _LinkParser()
        parser.feed(html_text or '')
        return parser.links

    def _discover_metric_links(self, session, security_token, warnings):
        home_candidates = [
            '',
            '/',
            '/index.html',
            '/frontend/jupiter/index.html',
            '/frontend/paper_lantern/index.html',
        ]
        discovered = []

        for path in home_candidates:
            try:
                response = session.get(
                    f"https://{self.host}:2083{security_token}{path}",
                    timeout=self.timeout,
                    verify=self.verify_ssl,
                    allow_redirects=True,
                )
                response.raise_for_status()
                html_text = response.text or ''
            except Exception as exc:
                warnings.append({'source': f'home_discovery:{path or "/"}', 'detail': str(exc)})
                continue

            for link in self._extract_links(html_text):
                href = (link.get('href') or '').strip()
                text = (link.get('text') or '').strip()
                lowered = f'{href} {text}'.lower()
                if not any(token in lowered for token in ('awstats', 'webalizer', 'analog', 'metrics', 'bandwidth')):
                    continue
                discovered.append({
                    'path': href,
                    'label': text or href,
                    'base_path': path or '/frontend/jupiter/index.html',
                })

            if discovered:
                break

        deduped = []
        seen = set()
        for item in discovered:
            key = (item.get('path') or '').strip()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(item)

        return deduped

    @staticmethod
    def _normalize_report_path(href, security_token, base_path=''):
        path = (href or '').strip()
        if not path:
            return ''
        if path.startswith('http://') or path.startswith('https://'):
            marker = ':2083'
            if marker in path:
                path = path.split(marker, 1)[-1]
        if not path.startswith('/'):
            base = (base_path or '').strip() or '/frontend/jupiter/index.html'
            if not base.startswith('/'):
                base = f'/{base}'
            base_dir = base.rsplit('/', 1)[0] if '/' in base else ''
            path = f'{base_dir}/{path}'.replace('//', '/')
        if path.startswith(security_token):
            return path[len(security_token):] or '/'
        return path

    def _fetch_session_reports(self, domain, warnings):
        session, security_token = self._login_session(warnings)
        if not session or not security_token:
            return []

        normalized_domain = (domain or '').strip()
        candidate_paths = [
            f'/frontend/jupiter/awstats/index.html?domain={normalized_domain}',
            f'/frontend/jupiter/webalizer/index.html?domain={normalized_domain}',
            f'/frontend/jupiter/analogstats/index.html?domain={normalized_domain}',
            '/frontend/jupiter/awstats/index.html',
            '/frontend/jupiter/webalizer/index.html',
            '/frontend/jupiter/analogstats/index.html',
            '/frontend/jupiter/stats/index.html',
            '/frontend/paper_lantern/awstats/index.html',
            '/frontend/paper_lantern/webalizer/index.html',
        ]
        discovered_links = self._discover_metric_links(session, security_token, warnings)
        normalized_discovered_links = []
        for item in discovered_links:
            normalized = self._normalize_report_path(
                item.get('path'),
                security_token,
                item.get('base_path') or '/frontend/jupiter/index.html',
            )
            normalized_discovered_links.append({
                'path': item.get('path'),
                'label': item.get('label'),
                'normalized_path': normalized,
            })
            if normalized and normalized not in candidate_paths:
                candidate_paths.append(normalized)

        reports = []
        for path in candidate_paths:
            report = self._fetch_html_report(session, security_token, path, warnings)
            if not report:
                continue
            preview_text = (report.get('html_preview') or '').lower()
            if not any(token in preview_text for token in ('awstats', 'webalizer', 'analog', 'kullanim', 'traffic', 'visits', 'bandwidth', 'bant', 'mb', 'gb', 'byte')):
                continue
            reports.append(report)

        detailed_reports = []
        for report in reports:
            for link in report.get('links') or []:
                href = (link.get('href') or '').strip()
                text = (link.get('text') or '').strip()
                lowered = f'{href} {text}'.lower()
                if not href:
                    continue
                if not any(token in lowered for token in ('goruntule', 'görüntüle', 'view', 'webalizer', 'awstats', 'analog', 'bandwidth')):
                    continue
                normalized = self._normalize_report_path(href, security_token, report.get('path') or '')
                if not normalized:
                    continue
                detail_report = self._fetch_html_report(session, security_token, normalized, warnings)
                if not detail_report:
                    continue
                detail_report['source_label'] = text or href
                detailed_reports.append(detail_report)

        if not reports and not detailed_reports:
            warnings.append({'source': 'session_reports', 'detail': 'No AWStats/Webalizer/Analog HTML report page matched the tested paths'})
        return reports + detailed_reports, normalized_discovered_links

    def fetch_live_snapshot(self, domain):
        warnings = []
        report_files, report_previews = self._discover_report_files(domain, warnings)
        html_reports, discovered_metric_links = self._fetch_session_reports(domain, warnings)

        return {
            'account_info': self._safe_call(
                'Variables',
                'get_user_information',
                {},
                default={},
                warnings=warnings,
            ),
            'domains': self._safe_call(
                'DomainInfo',
                'list_domains',
                {'hide_temporary_domains': 1},
                default={},
                warnings=warnings,
            ),
            'domain_details': self._safe_call(
                'DomainInfo',
                'domains_data',
                {'format': 'list', 'hide_temporary_domains': 1},
                default=[],
                warnings=warnings,
            ),
            'quota': self._safe_call(
                'Quota',
                'get_quota_info',
                {},
                default={},
                warnings=warnings,
            ),
            'local_quota': self._safe_call(
                'Quota',
                'get_local_quota_info',
                {},
                default={},
                warnings=warnings,
            ),
            'php_versions': self._safe_call(
                'LangPHP',
                'php_get_installed_versions',
                {},
                default={},
                warnings=warnings,
            ),
            'php_default': self._safe_call(
                'LangPHP',
                'php_get_system_default_version',
                {},
                default={},
                warnings=warnings,
            ),
            'php_vhosts': self._safe_call(
                'LangPHP',
                'php_get_vhost_versions',
                {},
                default=[],
                warnings=warnings,
            ),
            'email_accounts': self._safe_call(
                'Email',
                'list_pops',
                {'skip_main': 0},
                default=[],
                warnings=warnings,
            ),
            'email_count': self._safe_call(
                'Email',
                'count_pops',
                {},
                default=0,
                warnings=warnings,
            ),
            'mysql_databases': self._safe_call(
                'Mysql',
                'list_databases',
                {},
                default=[],
                warnings=warnings,
            ),
            'web_domains': self._safe_call(
                'WebVhosts',
                'list_domains',
                {},
                default=[],
                warnings=warnings,
            ),
            'stats_bar': self._ensure_list_payload(
                self._safe_call(
                    'StatsBar',
                    'get_stats',
                    {'display': 'bandwidthusage|diskusage|subdomains|addondomains'},
                    default=[],
                    warnings=warnings,
                ),
                default_name='stat',
            ),
            'resource_usage': self._ensure_list_payload(
                self._safe_call('ResourceUsage', 'get_usages', default=[], warnings=warnings),
                default_name='resource',
            ),
            'bandwidth': self._ensure_list_payload(
                self._safe_call('Stats', 'get_bandwidth', {}, default=[], warnings=warnings),
                default_name='bandwidth',
            ),
            'errors': self._ensure_list_payload(
                self._safe_call('Stats', 'get_site_errors', {'domain': domain, 'maxlines': 50}, default=[], warnings=warnings),
                default_name='error',
            ),
            'access_log': self._ensure_list_payload(
                self._safe_call('Stats', 'get_access_log', {'domain': domain}, default=[], warnings=warnings),
                default_name='access',
            ),
            'awstats_daily': self._safe_call('Stats', 'get_stats_daily', {'domain': domain}, default={}, warnings=warnings),
            'webalizer_sites': self._ensure_list_payload(
                self._safe_call('Stats', 'list_sites', {'engine': 'webalizer', 'traffic': 'http'}, default=[], warnings=warnings),
                default_name='webalizer_site',
            ),
            'analog_sites': self._ensure_list_payload(
                self._safe_call('Stats', 'list_sites', {'engine': 'analog', 'traffic': 'http'}, default=[], warnings=warnings),
                default_name='analog_site',
            ),
            'analog_domain_stats': self._ensure_list_payload(
                self._safe_call(
                    'Stats',
                    'list_stats_by_domain',
                    {'domain': domain, 'engine': 'analog', 'ssl': 1},
                    default=[],
                    warnings=warnings,
                ),
                default_name='analog_stat',
            ),
            'log_settings': self._safe_call('LogManager', 'get_settings', default={}, warnings=warnings),
            'archives': self._ensure_list_payload(
                self._safe_call('LogManager', 'list_archives', default=[], warnings=warnings),
                default_name='archive',
            ),
            'report_files': report_files,
            'report_previews': report_previews,
            'discovered_metric_links': discovered_metric_links,
            'html_reports': html_reports,
            'warnings': warnings,
        }
