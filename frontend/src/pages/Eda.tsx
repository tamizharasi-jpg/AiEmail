import { useQuery } from "@tanstack/react-query";
import { Binary, FileText, Hash, Link2, ScanText, Type } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { EdaResponse } from "@/types/mailmind";
import AppShell from "@/components/layout/AppShell";

function maxValue(items: Array<{ value: number }>): number {
  return Math.max(1, ...items.map((item) => item.value));
}

function BarList({ items, unit, testId }: { items: Array<{ label: string; value: number }>; unit?: string; testId: string }) {
  const top = maxValue(items);
  return <div className="bar-list" data-testid={testId}>
    {items.map((item) => <div className="bar-item" key={item.label}>
      <div className="bar-label"><span>{item.label}{unit ? ` ${unit}` : ""}</span><strong>{item.value}</strong></div>
      <div className="bar-track"><i style={{ width: `${Math.max(3, (item.value / top) * 100)}%` }} /></div>
    </div>)}
  </div>;
}

export default function Eda() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["eda"], queryFn: () => apiGet<EdaResponse>("/eda") });
  const spam = data?.spam_vs_ham.find((row) => row.label.startsWith("Spam"))?.value ?? 0;
  const ham = data?.spam_vs_ham.find((row) => row.label.startsWith("Ham"))?.value ?? 0;
  const total = Math.max(1, spam + ham);
  const spamPct = Math.round((spam / total) * 100);
  const withUrlPct = data ? Math.round((data.url_frequency.with_url / Math.max(1, data.total)) * 100) : 0;
  const htmlPct = data ? Math.round((data.html_frequency.html / Math.max(1, data.total)) * 100) : 0;
  const topWordMax = maxValue(data?.top_words ?? []);
  const topCharMax = maxValue(data?.character_frequency ?? []);

  return <AppShell><div className="page-stack" data-testid="eda-page">
    <div className="page-heading compact">
      <div><div className="eyebrow"><ScanText size={12} /> Data science workspace</div><h1>Exploratory data analysis</h1><p>Statistical patterns mined from the emails MailMind has actually analyzed.</p></div>
      <div className="data-source-chip" data-testid="eda-source-chip"><span className="banner-dot" /> Computed from analyzed emails</div>
    </div>

    {isError && <div className="inline-error" data-testid="eda-error">Couldn't load the EDA dataset. Try again shortly.</div>}

    {!isLoading && data && !data.has_data && <div className="empty-state page-empty panel" data-testid="eda-empty-state">
      <ScanText size={24} /><strong>No analyzed emails yet</strong><span>Analyze a few emails first — EDA needs a dataset to describe.</span>
    </div>}

    {(isLoading || data?.has_data) && <>
      <div className="model-overview-grid" data-testid="eda-stat-grid">
        <div className="panel model-stat"><Hash size={17} /><span>Total records</span><strong>{data?.total ?? "—"}</strong><small>analyzed emails</small></div>
        <div className="panel model-stat"><Binary size={17} /><span>Spam rate</span><strong>{data ? `${spamPct}%` : "—"}</strong><small>{spam} of {total} flagged</small></div>
        <div className="panel model-stat"><FileText size={17} /><span>Avg. email length</span><strong>{data?.average_email_length ?? "—"}</strong><small>characters</small></div>
        <div className="panel model-stat"><Type size={17} /><span>Avg. subject length</span><strong>{data?.average_subject_length ?? "—"}</strong><small>characters</small></div>
      </div>

      <section className="analytics-grid">
        <div className="panel category-panel" data-testid="eda-spam-vs-ham-panel">
          <div className="section-heading"><div><span className="eyebrow">Class balance</span><h2>Spam vs ham</h2></div><span className="panel-meta">{total} emails</span></div>
          <div className="category-chart">
            <div className="donut" style={{ background: `conic-gradient(#65dda8 0 ${100 - spamPct}%, #ff8b9b ${100 - spamPct}% 100%)` }}><div><strong>{spamPct}%</strong><span>spam</span></div></div>
            <div className="legend-list">
              <div><span className="legend-dot" style={{ background: "#65dda8" }} />Ham (legitimate)<strong>{ham}</strong></div>
              <div><span className="legend-dot" style={{ background: "#ff8b9b" }} />Spam / suspicious<strong>{spam}</strong></div>
            </div>
          </div>
        </div>
        <div className="panel feature-panel" data-testid="eda-top-words-panel">
          <div className="section-heading"><div><span className="eyebrow">Text mining</span><h2>Top words</h2></div></div>
          {(data?.top_words ?? []).map((word) => <div className="feature-row" key={word.label}>
            <div><span>{word.label}</span><strong>{word.value}</strong></div>
            <div className="feature-track"><i style={{ width: `${Math.max(4, (word.value / topWordMax) * 100)}%` }} /></div>
          </div>)}
          {data && !data.top_words.length && <p className="metrics-note">Not enough text yet to surface frequent words.</p>}
        </div>
      </section>

      <section className="analytics-grid">
        <div className="panel distribution-panel" data-testid="eda-email-length-panel">
          <div className="section-heading"><div><span className="eyebrow">Distribution</span><h2>Email length</h2></div></div>
          <BarList items={data?.email_length_buckets ?? []} unit="chars" testId="eda-email-length-bars" />
        </div>
        <div className="panel distribution-panel" data-testid="eda-subject-length-panel">
          <div className="section-heading"><div><span className="eyebrow">Distribution</span><h2>Subject length</h2></div></div>
          <BarList items={data?.subject_length_buckets ?? []} unit="chars" testId="eda-subject-length-bars" />
        </div>
      </section>

      <section className="analytics-grid">
        <div className="panel analytics-insight" data-testid="eda-url-html-panel">
          <div className="section-heading"><div><span className="eyebrow">Signal frequency</span><h2>URL &amp; HTML frequency</h2></div></div>
          <div className="distribution-row"><span><Link2 size={13} /> Contains a URL</span><div><span className="distribution-fill" style={{ width: `${withUrlPct}%` }} /></div><strong>{withUrlPct}%</strong></div>
          <div className="distribution-row"><span><Type size={13} /> HTML markup</span><div><span className="distribution-fill fill-1" style={{ width: `${htmlPct}%` }} /></div><strong>{htmlPct}%</strong></div>
        </div>
        <div className="panel feature-panel" data-testid="eda-character-frequency-panel">
          <div className="section-heading"><div><span className="eyebrow">Signal frequency</span><h2>Character frequency</h2></div></div>
          {(data?.character_frequency ?? []).map((item) => <div className="feature-row" key={item.label}>
            <div><span>{`"${item.label}"`}</span><strong>{item.value}</strong></div>
            <div className="feature-track"><i style={{ width: `${Math.max(4, (item.value / topCharMax) * 100)}%` }} /></div>
          </div>)}
        </div>
      </section>

      <section className="analytics-grid">
        <div className="panel distribution-panel" data-testid="eda-category-distribution-panel">
          <div className="section-heading"><div><span className="eyebrow">Semantic map</span><h2>Category distribution</h2></div></div>
          <BarList items={data?.category_distribution ?? []} testId="eda-category-bars" />
        </div>
        <div className="panel distribution-panel" data-testid="eda-priority-distribution-panel">
          <div className="section-heading"><div><span className="eyebrow">Signal overview</span><h2>Priority distribution</h2></div></div>
          <BarList items={data?.priority_distribution ?? []} testId="eda-priority-bars" />
        </div>
      </section>
    </>}
  </div></AppShell>;
}
