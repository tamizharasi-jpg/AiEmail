import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ShieldAlert, ShieldCheck, ShieldQuestion, Siren } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { SecurityResponse } from "@/types/mailmind";
import AppShell from "@/components/layout/AppShell";

const MATRIX_KEYS = ["legitimate", "review", "spam", "phishing"] as const;

export default function Spam() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["security"], queryFn: () => apiGet<SecurityResponse>("/security") });
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [openIndicator, setOpenIndicator] = useState<string | null>(null);

  const cells = useMemo(() => {
    const map = new Map((data?.threat_matrix ?? []).map((cell) => [cell.key, cell]));
    return MATRIX_KEYS.map((key) => map.get(key)).filter((cell) => cell !== undefined);
  }, [data]);

  const active = cells.find((cell) => cell.key === selectedCell) ?? null;
  const rows = useMemo(() => {
    const items = data?.items ?? [];
    if (!selectedCell) return items;
    return items.filter((email) => {
      const highSpam = email.spam_probability >= 50;
      const highRisk = email.phishing_risk !== "Low";
      if (selectedCell === "legitimate") return !highSpam && !highRisk;
      if (selectedCell === "review") return !highSpam && highRisk;
      if (selectedCell === "spam") return highSpam && !highRisk;
      return highSpam && highRisk;
    });
  }, [data, selectedCell]);

  const maxIndicator = Math.max(1, ...(data?.indicators ?? []).map((item) => item.count));

  return <AppShell><div className="page-stack" data-testid="spam-page">
    <div className="page-heading compact">
      <div>
        <div className="eyebrow"><ShieldAlert size={12} /> Security operations</div>
        <h1>Spam &amp; Security</h1>
        <p>Identify unwanted and potentially dangerous emails across everything MailMind has analyzed.</p>
      </div>
      <div className="data-source-chip" data-testid="security-source-chip"><span className="banner-dot" /> Rule-based scanner on real analyses</div>
    </div>

    {isError && <div className="inline-error" data-testid="security-error">Couldn't load the security centre. Try again shortly.</div>}

    {!isLoading && data && !data.has_data && <div className="empty-state page-empty panel" data-testid="security-empty-state">
      <ShieldCheck size={24} /><strong>No suspicious emails detected</strong><span>Analyze an email and its security signals will appear here.</span>
    </div>}

    {(isLoading || data?.has_data) && <>
      <div className="model-overview-grid" data-testid="security-metric-grid">
        <div className="panel model-stat" data-testid="metric-spam"><Siren size={17} /><span>Spam</span><strong>{data?.spam ?? "—"}</strong><small>verdict: dangerous</small></div>
        <div className="panel model-stat" data-testid="metric-phishing"><ShieldAlert size={17} /><span>Phishing risk</span><strong>{data?.phishing_risk ?? "—"}</strong><small>high phishing score</small></div>
        <div className="panel model-stat" data-testid="metric-suspicious"><ShieldQuestion size={17} /><span>Suspicious</span><strong>{data?.suspicious ?? "—"}</strong><small>needs verification</small></div>
        <div className="panel model-stat" data-testid="metric-legitimate"><ShieldCheck size={17} /><span>Legitimate</span><strong>{data?.legitimate ?? "—"}</strong><small>{data?.needs_review ?? 0} flagged for review</small></div>
      </div>

      <section className="analytics-grid">
        <div className="panel threat-panel" data-testid="threat-matrix-panel">
          <div className="section-heading">
            <div><span className="eyebrow">Threat matrix</span><h2>Spam score vs phishing risk</h2></div>
            {selectedCell && <button className="quiet-button" onClick={() => setSelectedCell(null)} data-testid="threat-matrix-clear">Clear filter</button>}
          </div>
          <div className="threat-matrix" data-testid="threat-matrix">
            <span className="matrix-corner" />
            <span className="matrix-head">Low phishing risk</span>
            <span className="matrix-head">High phishing risk</span>
            <span className="matrix-side">Low spam</span>
            {cells.slice(0, 2).map((cell) => <button key={cell.key} className={`threat-cell cell-${cell.key} ${selectedCell === cell.key ? "selected" : ""}`} onClick={() => setSelectedCell(selectedCell === cell.key ? null : cell.key)} data-testid={`threat-cell-${cell.key}`}>
              <strong>{cell.count}</strong><span>{cell.label}</span>
            </button>)}
            <span className="matrix-side">High spam</span>
            {cells.slice(2).map((cell) => <button key={cell.key} className={`threat-cell cell-${cell.key} ${selectedCell === cell.key ? "selected" : ""}`} onClick={() => setSelectedCell(selectedCell === cell.key ? null : cell.key)} data-testid={`threat-cell-${cell.key}`}>
              <strong>{cell.count}</strong><span>{cell.label}</span>
            </button>)}
          </div>
          <p className="confusion-note" data-testid="threat-matrix-note">{active ? active.description : "Click a quadrant to filter the table below."}</p>
        </div>

        <div className="panel feature-panel" data-testid="security-indicators-panel">
          <div className="section-heading"><div><span className="eyebrow">Detected signals</span><h2>Security indicators</h2></div></div>
          {(data?.indicators ?? []).map((indicator) => <div className="indicator-row" key={indicator.label}>
            <button onClick={() => setOpenIndicator(openIndicator === indicator.label ? null : indicator.label)} data-testid={`indicator-${indicator.label.toLowerCase().replaceAll(/[^a-z]+/g, "-")}`}>
              <span>{indicator.label}</span>
              <strong>{indicator.count}</strong>
              <ChevronDown size={13} className={openIndicator === indicator.label ? "rotated" : ""} />
            </button>
            <div className="feature-track"><i style={{ width: `${Math.max(5, (indicator.count / maxIndicator) * 100)}%` }} /></div>
            {openIndicator === indicator.label && <p className="indicator-explain" data-testid="indicator-explanation">{indicator.explanation}</p>}
          </div>)}
          {data && !data.indicators.length && <p className="metrics-note">No security indicators fired on the analyzed emails yet.</p>}
        </div>
      </section>

      <section className="panel recent-panel" data-testid="spam-table-panel">
        <div className="section-heading">
          <div><span className="eyebrow">Flagged mail</span><h2>{active ? active.label : "Spam & suspicious emails"}</h2></div>
          <span className="panel-meta">{rows.length} emails</span>
        </div>
        <div className="recent-table spam-table">
          <div className="recent-head spam-head">
            <span>Sender / subject</span><span>Spam prob.</span><span>Phishing risk</span><span>Risk level</span><span>Indicators</span><span />
          </div>
          {rows.map((email) => <div className="recent-row spam-row" key={email.id} data-testid={`spam-row-${email.id}`}>
            <div className="recent-sender">
              <div className="sender-avatar">{email.sender.slice(0, 2).toUpperCase()}</div>
              <div><strong>{email.sender}</strong><span>{email.subject}</span></div>
            </div>
            <div className="prob-cell"><strong>{email.spam_probability}%</strong><div className="tiny-progress"><i style={{ width: `${email.spam_probability}%` }} /></div></div>
            <span className={`status-badge ${email.phishing_risk === "High" ? "spam-spam" : email.phishing_risk === "Medium" ? "spam-suspicious" : "spam-legitimate"}`}>{email.phishing_risk}</span>
            <span className={`status-badge ${email.verdict === "dangerous" ? "spam-spam" : email.verdict === "suspicious" ? "spam-suspicious" : "spam-legitimate"}`}>{email.verdict === "dangerous" ? "Dangerous" : email.verdict === "suspicious" ? "Suspicious" : "Safe"}</span>
            <span className="indicator-count">{email.security_indicators.length}</span>
            <Link className="quiet-button" to={`/inbox/${email.id}`} data-testid={`spam-review-${email.id}`}>Review</Link>
          </div>)}
          {!rows.length && <div className="empty-state" data-testid="spam-table-empty"><strong>Nothing in this quadrant</strong><span>No analyzed email matches this risk profile.</span></div>}
        </div>
      </section>
    </>}
  </div></AppShell>;
}
