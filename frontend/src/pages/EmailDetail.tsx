import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, MessageSquareText, Reply, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import type { EmailRecord } from "@/types/mailmind";
import AppShell from "@/components/layout/AppShell";
import { CategoryBadge, PriorityBadge, SpamBadge } from "@/components/mailmind/StatusBadge";

/** Risk-type metrics: higher value = more concerning (spam / phishing signal strength). */
function riskTone(value: number): "tone-safe" | "tone-warn" | "tone-risk" {
  if (value >= 60) return "tone-risk";
  if (value >= 30) return "tone-warn";
  return "tone-safe";
}

/** Confidence-type metrics: lower value = more concerning (weak category match). */
function confidenceTone(value: number): "tone-safe" | "tone-warn" | "tone-risk" {
  if (value >= 70) return "tone-safe";
  if (value >= 45) return "tone-warn";
  return "tone-risk";
}

function SignalRow({ label, value, tone, testId }: { label: string; value: number; tone: string; testId: string }) {
  return <div className="signal-row" data-testid={testId}>
    <div className="signal-label"><span>{label}</span><strong className={tone}>{value}%</strong></div>
    <div className="signal-track"><i className={tone} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
  </div>;
}

interface FeedbackResult { id: string; message: string; is_simulated: boolean }

export default function EmailDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: ["email", id], queryFn: () => apiGet<EmailRecord>(`/emails/${id}`) });
  const correction = useMutation({
    mutationFn: (label: "Spam" | "Not spam") => apiPost<FeedbackResult>("/feedback", { email_id: id, correction: label }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email", id] }),
  });

  if (isLoading) return <AppShell><div className="page-stack" data-testid="email-detail-loading"><div className="skeleton large" /><div className="skeleton" /></div></AppShell>;
  if (isError || !data) return <AppShell><div className="empty-state page-empty" data-testid="email-detail-error"><ShieldAlert size={24} /><strong>Email not found</strong><Link to="/dashboard" className="button-secondary">Back to overview</Link></div></AppShell>;

  const risky = data.spam_status !== "Legitimate";
  const reply = data.generated_response;

  return <AppShell><div className="page-stack" data-testid="email-detail-page">
    <div className="detail-top">
      <Link to="/dashboard" className="back-link" data-testid="email-detail-back"><ArrowLeft size={15} /> Back to overview</Link>
    </div>
    <div className="detail-layout">
      <article className="email-reader panel" data-testid="email-reader">
        <div className="reader-label"><span className="eyebrow">Email</span><span>{data.date}</span></div>
        <div className="reader-header">
          <div className="large-avatar">{data.sender.slice(0, 2).toUpperCase()}</div>
          <div>
            <h1>{data.subject}</h1>
            <div className="sender-line"><strong>{data.sender}</strong><span>&lt;{data.sender_email}&gt;</span></div>
          </div>
        </div>
        <div className="reader-tags"><CategoryBadge value={data.category} /><PriorityBadge value={data.priority} /><SpamBadge value={data.spam_status} /></div>
        <div className="reader-body">{data.body.split("\n").map((paragraph, index) => paragraph ? <p key={`${paragraph}-${index}`}>{paragraph}</p> : <br key={index} />)}</div>
      </article>

      <aside className="intelligence-panel" data-testid="ai-intelligence-panel">
        <div className="intelligence-header">
          <div><span className="eyebrow"><Sparkles size={12} /> AI insights</span><h2>What MailMind found</h2></div>
        </div>

        <div className="classification-card" data-testid="classification-card">
          <div className="classification-top">
            <div>
              <span className="eyebrow classification-eyebrow">Classification</span>
              <h3 className="classification-title">{data.spam_status}</h3>
            </div>
            <span className="classification-badge" data-testid="classification-priority-badge">{data.priority}</span>
          </div>
          <p className="classification-desc">{data.subject} was assessed as {data.category} with {data.priority.toLowerCase()} priority.</p>
          <div className="signal-bars">
            <SignalRow label="Spam probability" value={data.spam_probability} tone={riskTone(data.spam_probability)} testId="signal-spam-probability" />
            <SignalRow label="Phishing supporting signal" value={data.phishing_score} tone={riskTone(data.phishing_score)} testId="signal-phishing-score" />
            <SignalRow label="Category confidence" value={data.category_confidence} tone={confidenceTone(data.category_confidence)} testId="signal-category-confidence" />
          </div>
        </div>

        <div className="confidence-box">
          <div className="confidence-ring" style={{ "--confidence": `${data.confidence * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{data.confidence}%</strong><span>confidence</span></div>
          </div>
          <div>
            <strong>{data.confidence > 85 ? "High confidence" : "Worth a quick check"}</strong>
            <p>Confidence is a signal, not certainty.</p>
          </div>
        </div>
        <div className="insight-stack">
          <div className="insight-block" data-testid="security-indicators-block">
            <div className="insight-title"><span>{risky ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />} Security signals</span></div>
            <ul className="key-list">{data.security_indicators.map((item) => <li key={item} className={risky ? "flag-risk" : undefined}>{risky ? <ShieldAlert size={13} /> : <Check size={13} />}{item}</li>)}</ul>
          </div>
          <div className="insight-block">
            <div className="insight-title"><span>Summary</span></div>
            <p className="insight-text">{data.summary}</p>
          </div>
          <div className="insight-block">
            <div className="insight-title"><span>What to look at</span></div>
            <ul className="key-list">{data.key_information.map((item) => <li key={item}><Check size={13} />{item}</li>)}</ul>
          </div>
        </div>

        <div className="response-box" data-testid="response-box">
          <div className="response-heading"><div><MessageSquareText size={15} /><strong>Suggested reply</strong></div>{reply && !risky && <span data-testid="reply-source">{data.reply_source === "ollama" ? "Written by local LLM" : "Draft"}</span>}</div>
          {risky || !reply
            ? <p data-testid="no-reply-notice">This email looks unsafe, so no reply is suggested. Verify the sender through a channel you trust before responding.</p>
            : <div className="draft">
                <pre data-testid="generated-reply">{reply}</pre>
                <button onClick={() => { void navigator.clipboard?.writeText(reply); setCopied(true); }} data-testid="copy-response-button"><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
              </div>}
          {!risky && reply && <button className="button-secondary reply-cta" data-testid="email-reply-button"><Reply size={15} /> Use this draft</button>}
        </div>

        <div className="correction-box" data-testid="correction-box">
          <span className="correction-heading">Correct this prediction</span>
          <p>Your corrections are saved as feedback for future model improvement.</p>
          <div className="correction-buttons">
            <button className={data.user_correction === "Not spam" ? "selected" : ""} onClick={() => correction.mutate("Not spam")} disabled={correction.isPending} data-testid="correction-not-spam-button">Not spam</button>
            <button className={data.user_correction === "Spam" ? "selected" : ""} onClick={() => correction.mutate("Spam")} disabled={correction.isPending} data-testid="correction-spam-button">Spam</button>
          </div>
          {correction.isSuccess && <small data-testid="correction-success">{correction.data.message}</small>}
        </div>
      </aside>
    </div>
  </div></AppShell>;
}
