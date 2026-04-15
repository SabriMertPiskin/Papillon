import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { getCpanelConfig, getCpanelLiveSnapshot } from '../services/api';
import '../styles/CPanelData.css';

const formatLabel = (value) => {
  if (!value) return '-';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('tr-TR') : '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const getItemLabel = (item, fallback) => (
  item?.name
  || item?.display_name
  || item?.description
  || item?.domain
  || item?.key
  || fallback
);

const getItemValue = (item) => (
  item?.value
  ?? item?.usage
  ?? item?.percent
  ?? item?.count
  ?? item?.total
  ?? item?.status
  ?? item?.result
  ?? item?.bytes
  ?? item?.hits
  ?? item?.visits
  ?? item?.files
  ?? item?.pages
  ?? item?.hosts
  ?? item?.last_update
  ?? item?.path
  ?? item?.archive
  ?? item?.url
);

const normalizeSummaryRows = (snapshot, config) => [
  { label: 'Host', value: config?.host || '-' },
  { label: 'Auth Mode', value: config?.auth_mode || '-' },
  { label: 'Primary Domain', value: snapshot?.account_info?.domain || snapshot?.domains?.main_domain || '-' },
  { label: 'Email Accounts', value: Array.isArray(snapshot?.email_accounts) ? snapshot.email_accounts.length : snapshot?.email_count || 0 },
  { label: 'Databases', value: Array.isArray(snapshot?.mysql_databases) ? snapshot.mysql_databases.length : 0 },
  { label: 'Web Domains', value: Array.isArray(snapshot?.web_domains) ? snapshot.web_domains.length : 0 },
  { label: 'StatsBar Records', value: Array.isArray(snapshot?.stats_bar) ? snapshot.stats_bar.length : 0 },
  { label: 'Resource Peak', value: `${snapshot?.resource_peak_percent || 0}%` },
  { label: 'Bandwidth Records', value: Array.isArray(snapshot?.bandwidth) ? snapshot.bandwidth.length : snapshot?.bandwidth_records || 0 },
  { label: 'Error Log Lines', value: Array.isArray(snapshot?.errors) ? snapshot.errors.length : snapshot?.error_log_entries || 0 },
  { label: 'Access Log Records', value: Array.isArray(snapshot?.access_log) ? snapshot.access_log.length : snapshot?.access_log_records || 0 },
  { label: 'Webalizer Sites', value: Array.isArray(snapshot?.webalizer_sites) ? snapshot.webalizer_sites.length : 0 },
  { label: 'Log Archives', value: Array.isArray(snapshot?.log_archives) ? snapshot.log_archives.length : 0 },
  { label: 'Data Status', value: snapshot?.has_live_data ? 'Records found' : 'Connected but empty' },
];

const buildTableRows = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    label: getItemLabel(item, `Row ${index + 1}`),
    value: formatValue(getItemValue(item)),
    raw: item,
  }));
};

const renderObjectTable = (objectValue) => {
  if (!objectValue || typeof objectValue !== 'object' || Array.isArray(objectValue)) return [];
  return Object.entries(objectValue).map(([key, value]) => ({
    label: formatLabel(key),
    value: formatValue(value),
  }));
};

const renderDomainCollection = (objectValue) => {
  if (!objectValue || typeof objectValue !== 'object' || Array.isArray(objectValue)) return [];
  return Object.entries(objectValue).map(([key, value]) => ({
    label: formatLabel(key),
    value: Array.isArray(value) ? (value.length ? value.join(', ') : '-') : formatValue(value),
  }));
};

const buildWebalizerSummaries = (reports) => {
  if (!Array.isArray(reports)) return [];
  return reports
    .filter((report) => {
      const path = String(report?.path || '');
      return path.includes('/tmp/') && path.includes('/webalizer/');
    })
    .map((report, index) => {
      const rows = report?.tables?.flatMap((table) => table?.rows || []) || [];
      const titleText = String(report?.html_preview || report?.title || '');
      const titleMatch = titleText.match(/<TITLE>([\s\S]*?)<\/TITLE>/i);
      const extractedTitle = (titleMatch?.[1] || String(report?.title || '')).trim();
      const reportType = String(report?.path || '').includes('/ssl/') ? 'SSL' : 'Standard';
      return {
        id: `${report?.path || 'webalizer'}-${index}`,
        title: extractedTitle || reportType,
        reportType,
        path: report?.path || '-',
        rows: rows
          .filter((row) => row["Ay'a Gore Ozet"] && row["Ay'a Gore Ozet"] !== 'Ay' && row["Ay'a Gore Ozet"] !== "HIT'ler")
          .map((row) => {
            const period = row["Ay'a Gore Ozet"] || '-';
            if (period === 'Toplamlar') {
              return {
                period,
                dailyHits: '-',
                dailyFiles: '-',
                dailyPages: '-',
                dailyVisits: '-',
                dailyClients: '-',
                kbytes: row["Column 2"] || '-',
                monthlyVisits: row["Column 3"] || '-',
                monthlyPages: row["Column 4"] || '-',
                monthlyFiles: row["Column 5"] || '-',
                monthlyHits: row["Column 6"] || '-',
              };
            }
            return {
              period,
              dailyHits: row["Column 2"] || '-',
              dailyFiles: row["Column 3"] || '-',
              dailyPages: row["Column 4"] || '-',
              dailyVisits: row["Column 5"] || '-',
              dailyClients: row["Column 6"] || '-',
              kbytes: row["Column 7"] || '-',
              monthlyVisits: row["Column 8"] || '-',
              monthlyPages: row["Column 9"] || '-',
              monthlyFiles: row["Column 10"] || '-',
              monthlyHits: row["Column 11"] || '-',
            };
          }),
        raw: report,
      };
    });
};

const buildBandwidthSummaries = (reports) => {
  if (!Array.isArray(reports)) return [];
  return reports
    .filter((report) => {
      const path = String(report?.path || '').toLowerCase();
      const title = String(report?.title || '').toLowerCase();
      const preview = String(report?.html_preview || '').toLowerCase();
      return path.includes('bandwidth') || title.includes('bandwidth') || preview.includes('bandwidth') || preview.includes('bant');
    })
    .map((report, index) => {
      const rows = report?.tables?.flatMap((table) => table?.rows || []) || [];
      return {
        id: `${report?.path || 'bandwidth'}-${index}`,
        title: String(report?.title || 'Bandwidth Report'),
        path: report?.path || '-',
        rows,
        preview: String(report?.html_preview || '').slice(0, 1200),
        raw: report,
      };
    });
};

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const buildWebalizerKpis = (webalizerSummaries) => {
  if (!Array.isArray(webalizerSummaries) || !webalizerSummaries.length) return [];

  const primary = webalizerSummaries[0];
  const latest = (primary.rows || []).find((row) => row.period && row.period !== 'Toplamlar');
  const totals = (primary.rows || []).find((row) => row.period === 'Toplamlar');

  return [
    {
      label: 'Webalizer Latest Period',
      value: latest?.period || '-',
      tone: 'neutral',
    },
    {
      label: 'Latest Monthly Visits',
      value: latest ? toNumber(latest.monthlyVisits).toLocaleString('tr-TR') : '-',
      tone: 'info',
    },
    {
      label: 'Latest Monthly Hits',
      value: latest ? toNumber(latest.monthlyHits).toLocaleString('tr-TR') : '-',
      tone: 'info',
    },
    {
      label: 'Total Monthly Visits',
      value: totals ? toNumber(totals.monthlyVisits).toLocaleString('tr-TR') : '-',
      tone: 'success',
    },
    {
      label: 'Total Monthly Hits',
      value: totals ? toNumber(totals.monthlyHits).toLocaleString('tr-TR') : '-',
      tone: 'success',
    },
  ];
};

const buildWebalizerTrendRows = (webalizerSummaries) => {
  if (!Array.isArray(webalizerSummaries) || !webalizerSummaries.length) return [];

  const aggregated = new Map();
  for (const summary of webalizerSummaries) {
    for (const row of summary?.rows || []) {
      if (!row?.period || row.period === 'Toplamlar') continue;
      const period = String(row.period).trim();
      const visits = toNumber(row.monthlyVisits);
      const hits = toNumber(row.monthlyHits);
      const existing = aggregated.get(period) || { period, visits: 0, hits: 0 };
      existing.visits += visits;
      existing.hits += hits;
      aggregated.set(period, existing);
    }
  }

  return Array.from(aggregated.values());
};

const pickDailyMetric = (item, keys) => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== '') {
      return item[key];
    }
  }
  return 0;
};

const normalizeDailyTrafficRows = (awstatsDaily) => {
  if (!awstatsDaily) return [];

  let source = [];
  if (Array.isArray(awstatsDaily)) {
    source = awstatsDaily;
  } else if (typeof awstatsDaily === 'object') {
    if (Array.isArray(awstatsDaily.data)) source = awstatsDaily.data;
    else if (Array.isArray(awstatsDaily.items)) source = awstatsDaily.items;
    else if (Array.isArray(awstatsDaily.daily)) source = awstatsDaily.daily;
    else if (Array.isArray(awstatsDaily.stats)) source = awstatsDaily.stats;
    else {
      source = Object.entries(awstatsDaily).map(([key, value]) => ({
        ...(typeof value === 'object' && value !== null ? value : { value }),
        _periodKey: key,
      }));
    }
  }

  return source
    .map((item, index) => ({
      id: `${item?._periodKey || item?.date || item?.day || index}`,
      period: String(item?.date || item?.day || item?.period || item?.label || item?.name || item?._periodKey || `Day ${index + 1}`),
      hits: toNumber(pickDailyMetric(item, ['hits', 'daily_hits', 'hit'])),
      visits: toNumber(pickDailyMetric(item, ['visits', 'daily_visits', 'visit'])),
      pages: toNumber(pickDailyMetric(item, ['pages', 'daily_pages', 'page'])),
      files: toNumber(pickDailyMetric(item, ['files', 'daily_files', 'file'])),
      bytes: toNumber(pickDailyMetric(item, ['bytes', 'bandwidth', 'kbytes', 'kb'])),
    }))
    .filter((row) => row.hits || row.visits || row.pages || row.files || row.bytes);
};

const buildDailyTrafficKpis = (dailyRows) => {
  if (!Array.isArray(dailyRows) || !dailyRows.length) return [];

  const latest = dailyRows[0];
  const peakHits = dailyRows.reduce((max, row) => (row.hits > max.hits ? row : max), dailyRows[0]);
  const avgVisits = dailyRows.reduce((sum, row) => sum + row.visits, 0) / dailyRows.length;

  return [
    { label: 'Latest Day', value: latest.period, tone: 'neutral' },
    { label: 'Latest Hits', value: latest.hits.toLocaleString('tr-TR'), tone: 'info' },
    { label: 'Latest Visits', value: latest.visits.toLocaleString('tr-TR'), tone: 'info' },
    { label: 'Peak Hits Day', value: `${peakHits.period} (${peakHits.hits.toLocaleString('tr-TR')})`, tone: 'warn' },
    { label: 'Average Daily Visits', value: Math.round(avgVisits).toLocaleString('tr-TR'), tone: 'success' },
  ];
};

const normalizeTopSourceIpRows = (topSourceIps) => {
  if (!Array.isArray(topSourceIps)) return [];
  return topSourceIps
    .map((item, index) => ({
      id: item?.ip || `ip-${index}`,
      rank: item?.rank ?? index + 1,
      ip: item?.ip || '-',
      requestCount: toNumber(item?.request_count ?? item?.count ?? item?.requests),
      sharePercent: toNumber(item?.share_percent ?? item?.percent ?? item?.share),
    }))
    .filter((row) => row.ip !== '-' && row.requestCount > 0);
};

const normalizeIpRequestFrequencyRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((item, index) => ({
      id: item?.ip || `freq-${index}`,
      ip: item?.ip || '-',
      requestCount: toNumber(item?.request_count ?? item?.requests ?? item?.count),
      timestampCount: toNumber(item?.timestamp_count ?? item?.timestamps),
      coveragePercent: toNumber(item?.coverage_percent ?? item?.coverage),
      firstSeen: item?.first_seen || '-',
      lastSeen: item?.last_seen || '-',
      spanMinutes: item?.span_minutes ?? '-',
      requestsPerMinute: item?.requests_per_minute ?? '-',
      requestsPerHour: item?.requests_per_hour ?? '-',
    }))
    .filter((row) => row.ip !== '-' && row.requestCount > 0);
};

const buildIpRequestFrequencyFromMatrix = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return [];

  const grouped = new Map();

  for (const row of rows) {
    const ip = String(row?.ip || row?.client_ip || row?.remote_addr || row?.host || '-').trim();
    if (!ip || ip === '-') continue;

    const requestedAt = String(row?.requestedAt || row?.requested_at || row?.timestamp || row?.time || row?.date || '').trim();
    const existing = grouped.get(ip) || {
      id: ip,
      ip,
      requestCount: 0,
      timestampCount: 0,
      firstSeen: '-',
      lastSeen: '-',
      firstSeenDate: null,
      lastSeenDate: null,
    };

    existing.requestCount += 1;

    if (requestedAt && requestedAt !== '-') {
      const parsed = new Date(requestedAt);
      if (!Number.isNaN(parsed.getTime())) {
        existing.timestampCount += 1;
        if (!existing.firstSeenDate || parsed < existing.firstSeenDate) {
          existing.firstSeenDate = parsed;
          existing.firstSeen = parsed.toISOString();
        }
        if (!existing.lastSeenDate || parsed > existing.lastSeenDate) {
          existing.lastSeenDate = parsed;
          existing.lastSeen = parsed.toISOString();
        }
      }
    }

    grouped.set(ip, existing);
  }

  return Array.from(grouped.values())
    .map((row) => {
      const spanMinutes = row.firstSeenDate && row.lastSeenDate
        ? Math.max((row.lastSeenDate - row.firstSeenDate) / 60000, 0)
        : null;
      const requestsPerMinute = spanMinutes !== null
        ? (spanMinutes > 0 ? row.requestCount / spanMinutes : row.requestCount)
        : null;
      const requestsPerHour = spanMinutes !== null
        ? (spanMinutes > 0 ? row.requestCount / (spanMinutes / 60) : row.requestCount * 60)
        : null;

      return {
        ...row,
        coveragePercent: row.requestCount ? Math.round((row.timestampCount / row.requestCount) * 10000) / 100 : 0,
        spanMinutes: spanMinutes !== null ? Math.round(spanMinutes * 100) / 100 : '-',
        requestsPerMinute: requestsPerMinute !== null ? Math.round(requestsPerMinute * 100) / 100 : '-',
        requestsPerHour: requestsPerHour !== null ? Math.round(requestsPerHour * 100) / 100 : '-',
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 15);
};

const ACCESS_LOG_LINE_PATTERN = /(?<ip>\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\b).*?\[(?<timestamp>[^\]]+)\].*?"(?<method>[A-Z]+)\s+(?<path>[^"\s]+)(?:\s+HTTP\/[0-9.]+)?"\s+(?<status>\d{3})/i;

const parseAccessLogText = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const match = raw.match(ACCESS_LOG_LINE_PATTERN);
  if (!match?.groups) return { raw };

  return {
    ip: match.groups.ip || '-',
    requested_at: match.groups.timestamp || '-',
    method: match.groups.method || '-',
    path: match.groups.path || '-',
    status: match.groups.status || '-',
    user_agent: '-',
    referer: '-',
    raw,
  };
};

const buildTopSourceIpBars = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return [];
  const maxRequests = rows.reduce((max, row) => Math.max(max, row.requestCount), 0) || 1;
  return rows.map((row) => ({
    ...row,
    barHeight: Math.max(22, Math.round((row.requestCount / maxRequests) * 180)),
  }));
};

const normalizeAccessLogMatrixRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({
      id: row?.ip || row?.requested_at || `access-${index}`,
      ip: row?.ip || row?.client_ip || row?.remote_addr || row?.host || '-',
      requestedAt: row?.requested_at || row?.timestamp || row?.time || row?.date || '-',
      method: row?.method || row?.verb || '-',
      path: row?.path || row?.url || row?.request_path || '-',
      status: row?.status || row?.status_code || '-',
      userAgent: row?.user_agent || row?.agent || '-',
      referer: row?.referer || row?.referrer || '-',
      raw: row?.raw || '',
    }))
    .map((row) => {
      if (row.ip !== '-' || row.requestedAt !== '-' || row.path !== '-') {
        return row;
      }

      const parsed = parseAccessLogText(row.raw);
      if (!parsed) return row;

      return {
        ...row,
        id: parsed.ip || row.id,
        ip: parsed.ip || row.ip,
        requestedAt: parsed.requested_at || row.requestedAt,
        method: parsed.method || row.method,
        path: parsed.path || row.path,
        status: parsed.status || row.status,
        userAgent: parsed.user_agent || row.userAgent,
        referer: parsed.referer || row.referer,
        raw: parsed.raw || row.raw,
      };
    })
    .filter((row) => row.ip !== '-' || row.requestedAt !== '-' || row.path !== '-');
};

const buildWebalizerChartPoints = (rows) => {
  if (!Array.isArray(rows)) return [];
  const points = rows
    .filter((row) => row.period && row.period !== 'Toplamlar')
    .map((row) => ({
      period: row.period,
      visits: toNumber(row.visits ?? row.monthlyVisits),
      hits: toNumber(row.hits ?? row.monthlyHits),
    }))
    .filter((row) => row.visits > 0 || row.hits > 0)
    .reverse();

  const maxValue = points.reduce((max, row) => Math.max(max, row.visits, row.hits), 0) || 1;
  return points.map((row) => ({
    ...row,
    visitsHeight: Math.max(8, Math.round((row.visits / maxValue) * 120)),
    hitsHeight: Math.max(8, Math.round((row.hits / maxValue) * 120)),
  }));
};

const hasRows = (rows) => Array.isArray(rows) && rows.length > 0;

const isNonEmptyValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized !== '' && normalized !== '-' && normalized !== '{}' && normalized !== '[]';
  }
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'boolean') return value;
  return true;
};

function DataSection({ title, subtitle, rows }) {
  const shouldRender = hasRows(rows);

  if (!shouldRender) return null;

  return (
    <section className="cpanel-data-section">
      <div className="cpanel-data-section-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      <div className="cpanel-table-shell">
        <table className="cpanel-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${row.label}-${index}`}>
                <td>{row.label}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CPanelData() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const userRaw = localStorage.getItem('user');
      const nextUser = userRaw ? JSON.parse(userRaw) : null;
      setUser(nextUser);

      if (nextUser?.role !== 'analyst') {
        setConfig(null);
        setSnapshot(null);
        setError('Bu sayfa su anda analyst hesabinin bagli cPanel verisini gosteriyor.');
        return;
      }

      const configResponse = await getCpanelConfig();
      const nextConfig = configResponse.data?.config || null;
      setConfig(nextConfig);

      if (!nextConfig?.has_token) {
        setSnapshot(null);
        return;
      }

      const snapshotResponse = await getCpanelLiveSnapshot();
      if (snapshotResponse.data?.success) {
        setSnapshot(snapshotResponse.data.snapshot || null);
      } else {
        setError('cPanel verisi alinamadi.');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'cPanel verisi alinirken hata olustu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const accountRows = useMemo(() => renderObjectTable(snapshot?.account_info), [snapshot]);
  const domainRows = useMemo(() => renderDomainCollection(snapshot?.domains), [snapshot]);
  const domainDetailRows = useMemo(() => buildTableRows(snapshot?.domain_details), [snapshot]);
  const quotaRows = useMemo(() => renderObjectTable(snapshot?.quota), [snapshot]);
  const localQuotaRows = useMemo(() => renderObjectTable(snapshot?.local_quota), [snapshot]);
  const phpVersionRows = useMemo(() => renderObjectTable(snapshot?.php_versions), [snapshot]);
  const phpDefaultRows = useMemo(() => renderObjectTable(snapshot?.php_default), [snapshot]);
  const phpVhostRows = useMemo(() => buildTableRows(snapshot?.php_vhosts), [snapshot]);
  const emailRows = useMemo(() => buildTableRows(snapshot?.email_accounts), [snapshot]);
  const databaseRows = useMemo(() => buildTableRows(snapshot?.mysql_databases), [snapshot]);
  const webDomainRows = useMemo(() => buildTableRows(snapshot?.web_domains), [snapshot]);
  const statsBarRows = useMemo(() => buildTableRows(snapshot?.stats_bar), [snapshot]);
  const resourceRows = useMemo(() => buildTableRows(snapshot?.resource_usage), [snapshot]);
  const bandwidthRows = useMemo(() => buildTableRows(snapshot?.bandwidth), [snapshot]);
  const errorRows = useMemo(() => buildTableRows(snapshot?.errors), [snapshot]);
  const accessLogRows = useMemo(() => buildTableRows(snapshot?.access_log), [snapshot]);
  const archiveRows = useMemo(() => buildTableRows(snapshot?.log_archives), [snapshot]);
  const webalizerRows = useMemo(() => buildTableRows(snapshot?.webalizer_sites), [snapshot]);
  const analogSiteRows = useMemo(() => buildTableRows(snapshot?.analog_sites), [snapshot]);
  const analogDomainRows = useMemo(() => buildTableRows(snapshot?.analog_domain_stats), [snapshot]);
  const reportFileRows = useMemo(() => buildTableRows(snapshot?.report_files), [snapshot]);
  const warningRows = useMemo(() => buildTableRows(snapshot?.warnings), [snapshot]);
  const webalizerSummaries = useMemo(() => buildWebalizerSummaries(snapshot?.html_reports), [snapshot]);
  const dailyTrafficRows = useMemo(() => normalizeDailyTrafficRows(snapshot?.awstats_daily), [snapshot]);
  const dailyTrafficKpis = useMemo(() => buildDailyTrafficKpis(dailyTrafficRows), [dailyTrafficRows]);
  const topSourceIpRows = useMemo(() => normalizeTopSourceIpRows(snapshot?.top_source_ips), [snapshot]);
  const topSourceIpBars = useMemo(() => buildTopSourceIpBars(topSourceIpRows), [topSourceIpRows]);
  const logSettingsRows = useMemo(() => renderObjectTable(snapshot?.log_settings), [snapshot]);
  const webalizerKpis = useMemo(() => buildWebalizerKpis(webalizerSummaries), [webalizerSummaries]);
  const webalizerTrendRows = useMemo(() => buildWebalizerTrendRows(webalizerSummaries), [webalizerSummaries]);
  const webalizerTrendPoints = useMemo(() => buildWebalizerChartPoints(webalizerTrendRows), [webalizerTrendRows]);
  const accessLogMatrixRows = useMemo(() => normalizeAccessLogMatrixRows(snapshot?.access_log_matrix || snapshot?.access_log), [snapshot]);
  const accessLogMatrixFallbackRows = useMemo(() => {
    if (accessLogMatrixRows.length) return accessLogMatrixRows;
    return normalizeTopSourceIpRows(snapshot?.top_source_ips).map((row, index) => ({
      id: row.id || `fallback-${index}`,
      ip: row.ip,
      requestedAt: '-',
      method: '-',
      path: '-',
      status: '-',
      userAgent: '-',
      referer: '-',
      raw: '',
    }));
  }, [accessLogMatrixRows, snapshot]);
  const ipRequestFrequencyRows = useMemo(() => {
    const fromSnapshot = normalizeIpRequestFrequencyRows(snapshot?.ip_request_frequency);
    if (fromSnapshot.length) return fromSnapshot;
    return buildIpRequestFrequencyFromMatrix(accessLogMatrixRows);
  }, [snapshot, accessLogMatrixRows]);

  const socInsightCards = useMemo(() => {
    const cards = [
      {
        label: 'Warning Count',
        value: warningRows.length,
        tone: warningRows.length > 0 ? 'warn' : 'success',
      },
      {
        label: 'Error Log Entries',
        value: errorRows.length,
        tone: errorRows.length > 0 ? 'warn' : 'success',
      },
      {
        label: 'Access Log Entries',
        value: accessLogRows.length,
        tone: accessLogRows.length > 0 ? 'info' : 'neutral',
      },
      {
        label: 'Resource Peak',
        value: `${snapshot?.resource_peak_percent || 0}%`,
        tone: (snapshot?.resource_peak_percent || 0) >= 80 ? 'warn' : 'success',
      },
    ];
    return cards;
  }, [warningRows, errorRows, accessLogRows, snapshot]);

  const ipFrequencyCards = useMemo(() => {
    if (!ipRequestFrequencyRows.length) return [];

    const top = ipRequestFrequencyRows[0];
    const highestRate = ipRequestFrequencyRows.reduce((best, row) => {
      const currentRate = Number(row.requestsPerMinute) || 0;
      const bestRate = Number(best.requestsPerMinute) || 0;
      return currentRate > bestRate ? row : best;
    }, top);

    return [
      {
        label: 'Top IP',
        value: top.ip,
        tone: 'info',
      },
      {
        label: 'Top IP Requests',
        value: top.requestCount,
        tone: 'warn',
      },
      {
        label: 'Coverage',
        value: `${top.timestampCount}/${top.requestCount} (${top.coveragePercent}%)`,
        tone: 'neutral',
      },
      {
        label: 'Fastest IP',
        value: `${highestRate.ip} / ${highestRate.requestsPerMinute || 0} rpm`,
        tone: 'success',
      },
    ];
  }, [ipRequestFrequencyRows]);

  const visibleSections = useMemo(
    () => [
      {
        key: 'account',
        title: 'Account Info',
        subtitle: 'Hesap metadata ve temel cPanel alanlari.',
        rows: accountRows,
      },
      {
        key: 'domains',
        title: 'Domain Inventory',
        subtitle: 'Ana/addon/parked/subdomain listeleri.',
        rows: domainRows,
      },
      {
        key: 'domain-details',
        title: 'Domain Details',
        subtitle: 'Domain bazli hosting ayrintilari.',
        rows: domainDetailRows,
      },
      {
        key: 'quota',
        title: 'Quota',
        subtitle: 'Disk quota ve limit metrikleri.',
        rows: quotaRows,
      },
      {
        key: 'local-quota',
        title: 'Local Quota',
        subtitle: 'Lokal quota detaylari.',
        rows: localQuotaRows,
      },
      {
        key: 'php-versions',
        title: 'PHP Versions',
        subtitle: 'Kurulu PHP surumleri.',
        rows: phpVersionRows,
      },
      {
        key: 'php-default',
        title: 'PHP Default',
        subtitle: 'Varsayilan PHP ve ayarlar.',
        rows: phpDefaultRows,
      },
      {
        key: 'php-vhosts',
        title: 'PHP vHosts',
        subtitle: 'Vhost bazli PHP atamalari.',
        rows: phpVhostRows,
      },
      {
        key: 'email',
        title: 'Email Accounts',
        subtitle: 'Mail kutulari ve hesap listesi.',
        rows: emailRows,
      },
      {
        key: 'db',
        title: 'MySQL Databases',
        subtitle: 'Veritabani envanteri.',
        rows: databaseRows,
      },
      {
        key: 'web-domains',
        title: 'Web Domains',
        subtitle: 'Web vhost tarafindaki domainler.',
        rows: webDomainRows,
      },
      {
        key: 'stats-bar',
        title: 'StatsBar',
        subtitle: 'Kisa panel metrikleri.',
        rows: statsBarRows,
      },
      {
        key: 'resource',
        title: 'Resource Usage',
        subtitle: 'CPU/memory/entry process kayitlari.',
        rows: resourceRows,
      },
      {
        key: 'errors',
        title: 'Error Logs',
        subtitle: 'Hata satirlari.',
        rows: errorRows,
      },
      {
        key: 'access',
        title: 'Access Log',
        subtitle: 'Erisim loglari.',
        rows: accessLogRows,
      },
      {
        key: 'webalizer-sites',
        title: 'Webalizer Sites',
        subtitle: 'Webalizer kaynak siteleri.',
        rows: webalizerRows,
      },
      {
        key: 'analog-sites',
        title: 'Analog Sites',
        subtitle: 'Analog engine site listesi.',
        rows: analogSiteRows,
      },
      {
        key: 'analog-domains',
        title: 'Analog Domain Stats',
        subtitle: 'Domain bazli analog metrikleri.',
        rows: analogDomainRows,
      },
      {
        key: 'archives',
        title: 'Raw Log Archives',
        subtitle: 'Raw log arsiv dosyalari.',
        rows: archiveRows,
      },
      {
        key: 'report-files',
        title: 'Discovered Report Files',
        subtitle: 'Kesfedilen rapor dosyalari.',
        rows: reportFileRows,
      },
      {
        key: 'warnings',
        title: 'cPanel Warnings',
        subtitle: 'Eksik/hatali endpoint cevaplari.',
        rows: warningRows,
      },
      {
        key: 'log-settings',
        title: 'Log Settings',
        subtitle: 'Log arsivleme ve raw log ayarlari.',
        rows: logSettingsRows,
      },
    ].filter((section) => hasRows(section.rows) && section.rows.some((row) => isNonEmptyValue(row.value))),
    [
      accountRows,
      domainRows,
      domainDetailRows,
      quotaRows,
      localQuotaRows,
      phpVersionRows,
      phpDefaultRows,
      phpVhostRows,
      emailRows,
      databaseRows,
      webDomainRows,
      statsBarRows,
      resourceRows,
      errorRows,
      accessLogRows,
      webalizerRows,
      analogSiteRows,
      analogDomainRows,
      archiveRows,
      reportFileRows,
      warningRows,
      logSettingsRows,
    ]
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="cpanel-data-page">
          <div className="cpanel-hero">
            <div>
              <h1>cPanel Data</h1>
              <p>Turhost ve cPanel kaynaklarini yukluyorum.</p>
            </div>
          </div>
          <div className="cpanel-loading">cPanel telemetry yukleniyor...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="cpanel-data-page">
        <div className="cpanel-hero">
          <div>
            <h1>cPanel Data</h1>
            <p>
              Turhost/cPanel metrikleri, log kayitlari ve AWStats-Webalizer benzeri tablolar burada toplanir.
            </p>
            <div className={`cpanel-auth-badge ${config?.auth_mode || 'unknown'}`}>
              Auth Mode: {config?.auth_mode || 'unknown'}
            </div>
          </div>
          <div className="cpanel-hero-actions">
            <button className="cpanel-action-btn secondary" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
            <button className="cpanel-action-btn secondary" onClick={loadData}>
              Yenile
            </button>
            <button className="cpanel-action-btn" onClick={() => navigate('/profile')}>
              cPanel Ayarlari
            </button>
          </div>
        </div>

        {!config?.has_token ? (
          <div className="cpanel-empty-panel">
            <h2>cPanel baglantisi kurulmamis</h2>
            <p>Once Profile & Account sayfasindan cPanel host, username ve API token bilgilerini kaydet.</p>
          </div>
        ) : null}

        {error ? (
          <div className="cpanel-error-panel">
            <strong>Baglanti hatasi</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {ipFrequencyCards.length ? (
          <section className="cpanel-data-section cpanel-insight-panel">
            <div className="cpanel-data-section-header">
              <div>
                <h2>IP Frequency Snapshot</h2>
                <p>IP bazinda request yogunlugu. Bu kartlar alttaki tabloda da ayni verinin ozetini verir.</p>
              </div>
            </div>

            <div className="cpanel-insight-grid">
              {ipFrequencyCards.map((card) => (
                <div key={card.label} className={`cpanel-insight-card ${card.tone}`}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {config?.has_token && !error && user?.role === 'analyst' ? (
          <>
            <section className="cpanel-data-section cpanel-trend-spotlight">
              <div className="cpanel-data-section-header">
                <div>
                  <h2>Monthly Trend</h2>
                  <p>Sayfa geneline yayilan genel trafik trendi.</p>
                </div>
              </div>

              {webalizerKpis.length ? (
                <div className="cpanel-insight-grid cpanel-trend-kpi-grid">
                  {webalizerKpis.map((kpi) => (
                    <div key={kpi.label} className={`cpanel-insight-card ${kpi.tone}`}>
                      <span>{kpi.label}</span>
                      <strong>{kpi.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {webalizerTrendPoints.length ? (
                <div className="cpanel-trend-chart-shell">
                  <div className="cpanel-webalizer-chart-header">
                    <span>Trend by Month</span>
                    <div className="cpanel-webalizer-chart-legend">
                      <span><i className="legend-dot visits" />Visits</span>
                      <span><i className="legend-dot hits" />Hits</span>
                    </div>
                  </div>
                  <div className="cpanel-trend-chart">
                    {webalizerTrendPoints.map((point) => (
                      <div key={`trend-${point.period}`} className="cpanel-trend-group">
                        <div className="cpanel-trend-bars">
                          <div className="cpanel-trend-bar visits" style={{ height: `${Math.max(18, point.visitsHeight * 1.8)}px` }} title={`Visits: ${point.visits.toLocaleString('tr-TR')}`} />
                          <div className="cpanel-trend-bar hits" style={{ height: `${Math.max(18, point.hitsHeight * 1.8)}px` }} title={`Hits: ${point.hits.toLocaleString('tr-TR')}`} />
                        </div>
                        <div className="cpanel-trend-label">{point.period}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="cpanel-empty-state">Webalizer trend verisi bulunamadi.</div>
              )}
            </section>

            {webalizerSummaries.length ? (
              <section className="cpanel-data-section cpanel-webalizer-matrix-spotlight">
                <div className="cpanel-data-section-header">
                  <div>
                    <h2>Webalizer Matrix</h2>
                    <p>Standart raporun matrix gorunumu.</p>
                  </div>
                </div>

                <div className="cpanel-webalizer-grid">
                  {webalizerSummaries.map((summary) => (
                    <div className="cpanel-webalizer-card" key={summary.id}>
                      <div className="cpanel-webalizer-card-head">
                        <div>
                          <h3>{summary.title || summary.reportType}</h3>
                          <p>{summary.reportType} report</p>
                        </div>
                        <span className="cpanel-webalizer-badge">{summary.reportType}</span>
                      </div>

                      <div className="cpanel-table-shell">
                        <table className="cpanel-table">
                          <thead>
                            <tr>
                              <th rowSpan="2">Period</th>
                              <th colSpan="5">Daily Average</th>
                              <th colSpan="5">Monthly Totals</th>
                            </tr>
                            <tr>
                              <th>Hits</th>
                              <th>Files</th>
                              <th>Pages</th>
                              <th>Visits</th>
                              <th>Clients</th>
                              <th>KBytes</th>
                              <th>Visits</th>
                              <th>Pages</th>
                              <th>Files</th>
                              <th>Hits</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.rows.map((row, index) => (
                              <tr key={`${summary.id}-${index}`}>
                                <td>{row.period}</td>
                                <td>{row.dailyHits}</td>
                                <td>{row.dailyFiles}</td>
                                <td>{row.dailyPages}</td>
                                <td>{row.dailyVisits}</td>
                                <td>{row.dailyClients}</td>
                                <td>{row.kbytes}</td>
                                <td>{row.monthlyVisits}</td>
                                <td>{row.monthlyPages}</td>
                                <td>{row.monthlyFiles}</td>
                                <td>{row.monthlyHits}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {accessLogMatrixFallbackRows.length || (snapshot?.access_log_records || snapshot?.top_source_ip_count) ? (
              <section className="cpanel-data-section cpanel-ip-matrix-spotlight">
                <div className="cpanel-data-section-header">
                  <div>
                    <h2>IP Log Matrix</h2>
                    <p>Kim, ne zaman, ne istemiş: parse edilen access log matrisi.</p>
                  </div>
                </div>

                <div className="cpanel-table-shell cpanel-ip-matrix-shell">
                  <table className="cpanel-table cpanel-ip-matrix-table">
                    <thead>
                      <tr>
                        <th>IP</th>
                        <th>Requested At</th>
                        <th>Method</th>
                        <th>Path</th>
                        <th>Status</th>
                        <th>User Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessLogMatrixFallbackRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.ip}</td>
                          <td>{row.requestedAt}</td>
                          <td>{row.method}</td>
                          <td>{row.path}</td>
                          <td>{row.status}</td>
                          <td>{row.userAgent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {ipRequestFrequencyRows.length ? (
              <section className="cpanel-data-section cpanel-ip-frequency-spotlight">
                <div className="cpanel-data-section-header">
                  <div>
                    <h2>IP Request Frequency</h2>
                    <p>IP bazinda sayim, zaman kapsami ve dakika/saat hizlari.</p>
                  </div>
                </div>

                <div className="cpanel-table-shell cpanel-ip-frequency-shell">
                  <table className="cpanel-table cpanel-ip-frequency-table">
                    <thead>
                      <tr>
                        <th>IP</th>
                        <th>Requests</th>
                        <th>Timestamp Coverage</th>
                        <th>First Seen</th>
                        <th>Last Seen</th>
                        <th>Span (min)</th>
                        <th>Req / Min</th>
                        <th>Req / Hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ipRequestFrequencyRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.ip}</td>
                          <td>{row.requestCount}</td>
                          <td>{row.timestampCount ? `${row.timestampCount} (${row.coveragePercent}%)` : '-'}</td>
                          <td>{row.firstSeen}</td>
                          <td>{row.lastSeen}</td>
                          <td>{row.spanMinutes}</td>
                          <td>{row.requestsPerMinute}</td>
                          <td>{row.requestsPerHour}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
