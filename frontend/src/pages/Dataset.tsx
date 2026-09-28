import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Database, Layers, Rows3, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { DatasetResponse } from "@/types/mailmind";
import AppShell from "@/components/layout/AppShell";

export default function Dataset() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["dataset"], queryFn: () => apiGet<DatasetResponse>("/dataset") });
  const [labelFilter, setLabelFilter] = useState<"All" | "Spam" | "Ham">("All");
  const rows = (data?.rows ?? []).filter((row) => labelFilter === "All" || row.label === labelFilter);

  return <AppShell><div className="page-stack" data-testid="dataset-page">
    <div className="page-heading compact">
      <div>
        <div className="eyebrow"><Database size={12} /> Data science workspace</div>
        <h1>Dataset Explorer</h1>
        <p>The working corpus behind MailMind — record counts, data quality checks and feature statistics.</p>
      </div>
      <div className="data-source-chip" data-testid="dataset-source-chip"><span className="banner-dot" /> Derived from analyzed emails</div>
    </div>

    {isError && <div className="inline-error" data-testid="dataset-error">Couldn't load the dataset. Try again shortly.</div>}

    {!isLoading && data && !data.has_data && <div className="empty-state page-empty panel" data-testid="dataset-empty-state">
      <Database size={24} /><strong>The dataset is empty</strong><span>Analyze a few emails to populate the corpus.</span>
    </div>}

    {(isLoading || data?.has_data) && <>
      <div className="model-overview-grid" data-testid="dataset-stat-grid">
        <div className="panel model-stat" data-testid="stat-total"><Rows3 size={17} /><span>Total records</span><strong>{data?.total_records ?? "—"}</strong><small>analyzed emails</small></div>
        <div className="panel model-stat" data-testid="stat-labels"><Layers size={17} /><span>Class split</span><strong>{data ? `${data.spam_records} / ${data.legitimate_records}` : "—"}</strong><small>spam / ham</small></div>
        <div className="panel model-stat" data-testid="stat-quality"><Copy size={17} /><span>Data quality</span><strong>{data ? `${data.missing_values} / ${data.duplicate_records}` : "—"}</strong><small>missing fields / duplicates</small></div>
        <div className="panel model-stat" data-testid="stat-senders"><Users size={17} /><span>Unique senders</span><strong>{data?.unique_senders ?? "—"}</strong><small>avg. length {data?.average_email_length ?? 0} chars</small></div>
      </div>

      <section className="panel feature-stats-panel" data-testid="feature-stats-panel">
        <div className="section-heading"><div><span className="eyebrow">Descriptive statistics</span><h2>Feature statistics</h2></div><span className="panel-meta">computed over {data?.total_records ?? 0} records</span></div>
        <div className="stats-table">
          <div className="stats-head"><span>Feature</span><span>Min</span><span>Median</span><span>Mean</span><span>Max</span><span>Unit</span></div>
          {(data?.feature_stats ?? []).map((stat) => <div className="stats-row" key={stat.name} data-testid={`feature-stat-${stat.name.toLowerCase().replaceAll(" ", "-")}`}>
            <strong>{stat.name}</strong><span>{stat.minimum}</span><span>{stat.median}</span><span>{stat.mean}</span><span>{stat.maximum}</span><span className="stat-unit">{stat.unit}</span>
          </div>)}
        </div>
      </section>

      <section className="panel recent-panel" data-testid="dataset-preview-panel">
        <div className="section-heading">
          <div><span className="eyebrow">Row preview</span><h2>Dataset rows</h2></div>
          <div className="segmented" data-testid="dataset-label-filter">
            {(["All", "Spam", "Ham"] as const).map((option) => <button key={option} className={labelFilter === option ? "selected" : ""} onClick={() => setLabelFilter(option)} data-testid={`dataset-filter-${option.toLowerCase()}`}>{option}</button>)}
          </div>
        </div>
        <div className="recent-table">
          <div className="recent-head dataset-head"><span>Sender / subject</span><span>Label</span><span>Category</span><span>Priority</span><span>Length</span><span>URLs</span><span>Spam %</span></div>
          {rows.map((row) => <div className="recent-row dataset-row" key={row.id} data-testid={`dataset-row-${row.id}`}>
            <div className="recent-sender"><div className="sender-avatar">{row.sender.slice(0, 2).toUpperCase()}</div><div><strong>{row.sender}</strong><span>{row.subject}</span></div></div>
            <span className={`status-badge ${row.label === "Spam" ? "spam-spam" : "spam-legitimate"}`}>{row.label}</span>
            <span className="status-badge category-badge">{row.category}</span>
            <span className={`status-badge priority-${row.priority.toLowerCase()}`}>{row.priority}</span>
            <span>{row.body_length}</span>
            <span>{row.url_count}</span>
            <span className="confidence-number">{row.spam_probability}%</span>
          </div>)}
          {!rows.length && <div className="empty-state" data-testid="dataset-preview-empty"><strong>No rows for this label</strong><span>Switch the filter to see other records.</span></div>}
        </div>
        <p className="metrics-note" data-testid="dataset-preview-note">Preview shows the 50 most recent records. Labels come from the rule-based / LLM verdict stored with each analysis, not from a hand-annotated ground truth set.</p>
      </section>
    </>}
  </div></AppShell>;
}
