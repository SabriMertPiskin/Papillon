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

function DataSection({ title, subtitle, rows, emptyMessage, raw }) {
  const hasRows = Array.isArray(rows) && rows.length > 0;

  return (
    <section className="cpanel-data-section">
      <div className="cpanel-data-section-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      {hasRows ? (
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
      ) : (
        <div className="cpanel-empty-state">{emptyMessage}</div>
      )}

      {raw ? (
        <pre className="cpanel-raw-json">{JSON.stringify(raw, null, 2)}</pre>
      ) : null}
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

  const summaryRows = useMemo(() => normalizeSummaryRows(snapshot, config), [snapshot, config]);
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
  const discoveredLinkRows = useMemo(() => buildTableRows(snapshot?.discovered_metric_links), [snapshot]);
  const warningRows = useMemo(() => buildTableRows(snapshot?.warnings), [snapshot]);
  const webalizerSummaries = useMemo(() => buildWebalizerSummaries(snapshot?.html_reports), [snapshot]);
  const bandwidthSummaries = useMemo(() => buildBandwidthSummaries(snapshot?.html_reports), [snapshot]);
  const dailyStatsRows = useMemo(() => {
    if (Array.isArray(snapshot?.awstats_daily)) return buildTableRows(snapshot.awstats_daily);
    return renderObjectTable(snapshot?.awstats_daily);
  }, [snapshot]);
  const logSettingsRows = useMemo(() => renderObjectTable(snapshot?.log_settings), [snapshot]);

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

        {config?.has_token && !error && user?.role === 'analyst' ? (
          <>
            <div className="cpanel-overview-grid">
              {summaryRows.map((row) => (
                <div className="cpanel-summary-card" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>

            <DataSection
              title="Connection Config"
              subtitle="Frontend'in backend'den aldigi cPanel configuration cevabi."
              rows={renderObjectTable(config)}
              emptyMessage="Config bilgisi donmedi."
              raw={config}
            />

            <DataSection
              title="Account Info"
              subtitle="cPanel account metadata ve kullaniciya ait temel ayarlar."
              rows={accountRows}
              emptyMessage="Account info donmedi."
              raw={snapshot?.account_info}
            />

            <DataSection
              title="Domain Inventory"
              subtitle="Ana domain, addon domain, parked domain ve subdomain listeleri."
              rows={domainRows}
              emptyMessage="Domain listesi donmedi."
              raw={snapshot?.domains}
            />

            <DataSection
              title="Domain Details"
              subtitle="DomainInfo tarafindan donen domain bazli hosting detaylari."
              rows={domainDetailRows}
              emptyMessage="Domain details donmedi."
              raw={snapshot?.domain_details}
            />

            <DataSection
              title="Quota"
              subtitle="Disk quota ve benzeri limit bilgileri."
              rows={quotaRows}
              emptyMessage="Quota bilgisi donmedi."
              raw={snapshot?.quota}
            />

            <DataSection
              title="Local Quota"
              subtitle="Lokal disk quota detaylari."
              rows={localQuotaRows}
              emptyMessage="Local quota bilgisi donmedi."
              raw={snapshot?.local_quota}
            />

            <DataSection
              title="PHP Versions"
              subtitle="Sunucuda kurulu PHP surumleri."
              rows={phpVersionRows}
              emptyMessage="PHP version bilgisi donmedi."
              raw={snapshot?.php_versions}
            />

            <DataSection
              title="PHP Default"
              subtitle="Varsayilan PHP surumu ve iliskili ayarlar."
              rows={phpDefaultRows}
              emptyMessage="Varsayilan PHP bilgisi donmedi."
              raw={snapshot?.php_default}
            />

            <DataSection
              title="PHP vHosts"
              subtitle="Vhost bazli PHP surum atamalari."
              rows={phpVhostRows}
              emptyMessage="PHP vhost bilgisi donmedi."
              raw={snapshot?.php_vhosts}
            />

            <DataSection
              title="Email Accounts"
              subtitle="cPanel altindaki mail kutulari."
              rows={emailRows}
              emptyMessage="Email account listesi donmedi."
              raw={snapshot?.email_accounts}
            />

            <DataSection
              title="MySQL Databases"
              subtitle="Token ile gorulebilen veritabani listesi."
              rows={databaseRows}
              emptyMessage="Database listesi donmedi."
              raw={snapshot?.mysql_databases}
            />

            <DataSection
              title="Web Domains"
              subtitle="Web vhost tarafinda gorunen domainler."
              rows={webDomainRows}
              emptyMessage="Web domain listesi donmedi."
              raw={snapshot?.web_domains}
            />

            <DataSection
              title="StatsBar"
              subtitle="cPanel ana istatistik kutusundan donen kisa ozetler."
              rows={statsBarRows}
              emptyMessage="StatsBar tarafinda kayit donmedi."
              raw={statsBarRows.length ? null : snapshot?.stats_bar}
            />

            <DataSection
              title="Resource Usage"
              subtitle="CPU, memory, entry process ve benzeri kaynak kullanimi kayitlari."
              rows={resourceRows}
              emptyMessage="Resource Usage verisi donmedi."
              raw={resourceRows.length ? null : snapshot?.resource_usage}
            />

            <DataSection
              title="Bandwidth"
              subtitle="Metrics > Bandwidth tarafindaki kayitlar."
              rows={bandwidthRows}
              emptyMessage="Bandwidth tarafinda kayit donmedi."
              raw={snapshot?.bandwidth}
            />

            <DataSection
              title="Error Logs"
              subtitle="Metrics > Errors tarafindaki satirlar."
              rows={errorRows}
              emptyMessage="Error log satiri donmedi."
              raw={snapshot?.errors}
            />

            <DataSection
              title="Access Log"
              subtitle="Access log veya raw erisim kayitlari donerse burada gorunur."
              rows={accessLogRows}
              emptyMessage="Access log kaydi donmedi."
              raw={snapshot?.access_log}
            />

            <DataSection
              title="AWStats / Daily Stats"
              subtitle="Stats gunluk ozetleri veya AWStats benzeri cPanel verisi."
              rows={dailyStatsRows}
              emptyMessage="AWStats / daily stats verisi donmedi."
              raw={snapshot?.awstats_daily}
            />

            <DataSection
              title="Webalizer Sites"
              subtitle="Webalizer tarafinda listelenen siteler ve hazir istatistik setleri."
              rows={webalizerRows}
              emptyMessage="Webalizer site kaydi donmedi."
              raw={snapshot?.webalizer_sites}
            />

            <DataSection
              title="Analog Sites"
              subtitle="cPanel analog engine uzerinden gorunen site listesi."
              rows={analogSiteRows}
              emptyMessage="Analog site kaydi donmedi."
              raw={snapshot?.analog_sites}
            />

            <DataSection
              title="Analog Domain Stats"
              subtitle="Domain bazli analog tablo ciktilari."
              rows={analogDomainRows}
              emptyMessage="Analog domain stats donmedi."
              raw={snapshot?.analog_domain_stats}
            />

            <DataSection
              title="Raw Log Archives"
              subtitle="LogManager uzerinden listelenen raw arsiv dosyalari."
              rows={archiveRows}
              emptyMessage="Log archive listesi donmedi."
              raw={snapshot?.log_archives}
            />

            <DataSection
              title="Discovered Report Files"
              subtitle="Fileman ile logs ve tmp altinda bulunan AWStats, Webalizer, Analog veya log rapor dosyalari."
              rows={reportFileRows}
              emptyMessage="Rapor dosyasi bulunamadi."
              raw={snapshot?.report_files}
            />

            <DataSection
              title="Discovered Metric Links"
              subtitle="cPanel ana sayfasindan kesfedilen metrics linkleri."
              rows={discoveredLinkRows}
              emptyMessage="Metrics linki kesfedilemedi."
              raw={snapshot?.discovered_metric_links}
            />

            <section className="cpanel-data-section">
              <div className="cpanel-data-section-header">
                <div>
                  <h2>Webalizer Data</h2>
                  <p>Session login ile cekilen ve parse edilen Webalizer raporlari.</p>
                </div>
              </div>
              {webalizerSummaries.length ? (
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
              ) : (
                <div className="cpanel-empty-state">Webalizer raporu bulundu ama parse edilebilir veri cikmadi.</div>
              )}
            </section>

            <section className="cpanel-data-section">
              <div className="cpanel-data-section-header">
                <div>
                  <h2>Bandwidth Data</h2>
                  <p>Session login ile cekilen bandwidth sayfalari ve parse edilen icerik.</p>
                </div>
              </div>
              {bandwidthSummaries.length ? (
                <div className="cpanel-webalizer-grid">
                  {bandwidthSummaries.map((summary) => (
                    <div className="cpanel-webalizer-card" key={summary.id}>
                      <div className="cpanel-webalizer-card-head">
                        <div>
                          <h3>{summary.title}</h3>
                          <p>{summary.path}</p>
                        </div>
                        <span className="cpanel-webalizer-badge">Bandwidth</span>
                      </div>
                      {summary.rows.length ? (
                        <div className="cpanel-table-shell">
                          <table className="cpanel-table">
                            <thead>
                              <tr>
                                <th>Metric</th>
                                <th>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.rows.flatMap((row, rowIndex) => (
                                Object.entries(row).map(([key, value], valueIndex) => (
                                  <tr key={`${summary.id}-${rowIndex}-${valueIndex}`}>
                                    <td>{key}</td>
                                    <td>{formatValue(value)}</td>
                                  </tr>
                                ))
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <pre className="cpanel-raw-json">{summary.preview}</pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cpanel-empty-state">Bandwidth sayfasi henuz bulunamadi.</div>
              )}
            </section>

            <DataSection
              title="cPanel Warnings"
              subtitle="Hangi endpoint veya dosya okuma denemesi bos ya da hatali dondu burada gorunur."
              rows={warningRows}
              emptyMessage="Ek warning donmedi."
              raw={snapshot?.warnings}
            />

            <DataSection
              title="Log Settings"
              subtitle="cPanel log arsivleme ve raw log ayarlari."
              rows={logSettingsRows}
              emptyMessage="Log settings bilgisi donmedi."
              raw={snapshot?.log_settings}
            />
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
