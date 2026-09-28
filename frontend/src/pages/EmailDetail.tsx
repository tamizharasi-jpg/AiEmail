import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, Check, Copy, Cpu, EyeOff, Flag, Loader2, Reply, RotateCcw,
  ScanText, ShieldAlert, ShieldCheck, ShieldX, Sparkles, Undo2, UserSearch,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import type { Category, EmailRecord, RegenerateReplyResponse } from "@/types/mailmind";
import AppShell from "@/components/layout/AppShell";
import { CategoryBadge, PriorityBadge } from "@/components/mailmind/StatusBadge";

const CATEGORY_OPTIONS: Category[] = ["Work", "Finance", "Career", "Education", "Personal", "Shopping", "Travel"];
const TONE_OPTIONS = [
  { key: "professional", label: "Professional" },
  { key: "formal", label: "Formal" },
  { key: "friendly", label: "Friendly" },
  { key: "short", label: "Short" },
] as const;

const VERDICT_META = {
  safe: { icon: ShieldCheck, label: "Looks safe", className: "verdict-safe" },
  suspicious: { icon: ShieldAlert, label: "Be careful", className: "verdict-suspicious" },
  dangerous: { icon: ShieldX, label: "Likely phishing", className: "verdict-dangerous" },
} as const;

const RECOMMENDED_ACTION_META = {
  reply: { label: "Reply", icon: Reply, variant: "primary" as const },
  verify_sender: { label: "Verify sender", icon: UserSearch, variant: "primary" as const },
  report: { label: "Report phishing", icon: Flag, variant: "danger" as const },
  ignore: { label: "Ignore", icon: EyeOff, variant: "secondary" as const },
};

function riskTone(value: number): "tone-safe" | "tone-warn" | "tone-risk" {
  if (value >= 60) return "tone-risk";
  if (value >= 30) return "tone-warn";
  return "tone-safe";
}

interface FeedbackPayload {
  correction?: "Safe" | "Spam" | "Phishing";
  corrected_category?: string;
  undo?: boolean;
}
interface FeedbackResult { id: string; message: string }

export default function EmailDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [pendingTone, setPendingTone] = useState<string | null>(null);
  const [categoryChoice, setCategoryChoice] = useState<string>("");
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const { data, isLoading, isError } = useQuery({ queryKey: ["email", id], queryFn: () => apiGet<EmailRecord>(`/emails/${id}`) });

  useEffect(() => {
    if (!data) return;
    setReplyDraft(data.generated_response ?? "");
    setCategoryChoice(data.category);
    setCheckedItems({});
  }, [data?.id, data?.generated_response]);

  const regenerate = useMutation({
    mutationFn: (tone: string) => apiPost<RegenerateReplyResponse>(`/emails/${id}/reply`, { tone }),
    onSuccess: (result) => {
      setReplyDraft(result.generated_response ?? "");
      queryClient.invalidateQueries({ queryKey: ["email", id] });
    },
    onSettled: () => setPendingTone(null),
  });

  const feedback = useMutation({
    mutationFn: (body: FeedbackPayload) => apiPost<FeedbackResult>("/feedback", { email_id: id, ...body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email", id] }),
  });

  if (isLoading) return <AppShell><div className="page-stack" data-testid="email-detail-loading"><div className="skeleton large" /><div className="skeleton" /></div></AppShell>;
  if (isError || !data) return <AppShell><div className="empty-state page-empty" data-testid="email-detail-error"><ShieldAlert size={24} /><strong>Email not found</strong><Link to="/dashboard" className="button-secondary">Back to overview</Link></div></AppShell>;

  const verdict = VERDICT_META[data.verdict];
  const VerdictIcon = verdict.icon;
  const recommended = RECOMMENDED_ACTION_META[data.recommended_action];
  const RecommendedIcon = recommended.icon;
  const submitCorrection = (label: "Safe" | "Spam" | "Phishing") => {
    const payload: FeedbackPayload = { correction: label };
    if (categoryChoice !== data.category) payload.corrected_category = categoryChoice;
    feedback.mutate(payload);
  };
  const scrollTo = (elementId: string) => document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return <AppShell><div className="page-stack analysis-page" data-testid="email-detail-page">
    <Link to="/dashboard" className="back-link" data-testid="email-detail-back"><ArrowLeft size={15} /> Back to overview</Link>

    <div className="panel email-context-card" data-testid="email-context-card">
      <div className="email-context-top">
        <div className="large-avatar">{data.sender.slice(0, 2).toUpperCase()}</div>
        <div className="email-context-copy"><h1>{data.subject}</h1><div className="sender-line"><strong>{data.sender}</strong><span>&lt;{data.sender_email}&gt;</span></div></div>
        <span className="context-date">{data.date}</span>
      </div>
      <details className="original-email-toggle">
        <summary data-testid="toggle-original-email"><ScanText size={13} /> View original email</summary>
        <div className="original-email-body" data-testid="original-email-body">{data.body.split("\n").map((paragraph, index) => paragraph ? <p key={`${paragraph}-${index}`}>{paragraph}</p> : <br key={index} />)}</div>
      </details>
    </div>

    {data.low_content && <div className="low-content-notice" data-testid="low-content-notice"><AlertTriangle size={14} /> This email has very little content, so the analysis may be limited.</div>}

    {/* 1. Verdict banner */}
    <div className={`verdict-banner ${verdict.className}`} data-testid="verdict-banner" role="status">
      <div className="verdict-top">
        <div className="verdict-icon" aria-hidden="true"><VerdictIcon size={22} /></div>
        <div><span className="eyebrow classification-eyebrow">Classification</span><div className="verdict-label">{verdict.label}</div></div>
        <span className="engine-badge" data-testid="engine-badge">{data.engine === "ollama" ? <><Sparkles size={11} /> LLM analysis</> : <><Cpu size={11} /> Rule-based</>}</span>
      </div>
      <p className="verdict-reason" data-testid="verdict-reason">{data.reason}</p>
      <div className="verdict-chips"><CategoryBadge value={data.category} /><PriorityBadge value={data.priority} /></div>
    </div>

    {/* 2. Why we think so */}
    <section className="panel analysis-section" id="evidence-section" data-testid="evidence-section">
      <h2 className="section-title"><AlertTriangle size={15} /> Why we think so</h2>
      <p className="section-sub">Concrete signals found in the email text, not just the model's word.</p>
      {data.evidence.length === 0
        ? <div className="evidence-empty" data-testid="evidence-empty-state"><ShieldCheck size={15} /> No suspicious signals found</div>
        : <div className="evidence-list">{data.evidence.map((item, index) => <div className="evidence-item" key={`${item.quote}-${index}`}>
            <div className="evidence-quote"><AlertTriangle size={13} /> "{item.quote}"</div>
            <p className="evidence-why">{item.why}</p>
          </div>)}</div>}
    </section>

    {/* 3. What this email wants */}
    <section className="panel analysis-section" data-testid="intent-section">
      <h2 className="section-title"><Sparkles size={15} /> What this email wants</h2>
      <p className="section-sub">{data.summary || "No summary available."}</p>
      {data.action_items.length > 0 && <div className="action-checklist" data-testid="action-items-list">
        {data.action_items.map((item, index) => <label className="action-item-row" key={`${item.task}-${index}`}>
          <input type="checkbox" checked={!!checkedItems[index]} onChange={() => setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }))} aria-label={item.task} data-testid={`action-item-checkbox-${index}`} />
          <span>{item.task}</span>
          {item.deadline && <span className="deadline-chip">{item.deadline}</span>}
        </label>)}
      </div>}
    </section>

    {/* 4. Recommended action */}
    <section className="panel analysis-section recommend-card" data-testid="recommended-action-section">
      <h2 className="section-title">Recommended action</h2>
      <p className="recommend-text" data-testid="recommendation-text">{data.recommendation_text}</p>
      <div className="recommend-actions">
        <button
          className={`button-primary ${recommended.variant === "danger" ? "button-danger" : ""}`}
          onClick={() => (data.recommended_action === "reply" ? scrollTo("suggested-reply-section") : data.recommended_action === "verify_sender" ? scrollTo("evidence-section") : data.recommended_action === "report" ? (feedback.mutate({ correction: "Phishing" }), navigate("/dashboard")) : navigate("/dashboard"))}
          data-testid={`recommended-action-${data.recommended_action}-button`}
        ><RecommendedIcon size={15} /> {recommended.label}</button>
        {data.recommended_action !== "reply" && data.recommended_action !== "ignore" && <button className="button-secondary" onClick={() => navigate("/dashboard")} data-testid="recommended-action-ignore-button"><EyeOff size={15} /> Ignore</button>}
      </div>
    </section>

    {/* 5. Suggested reply — only when recommended_action is reply */}
    {data.recommended_action === "reply" && <section className="panel analysis-section reply-card" id="suggested-reply-section" data-testid="response-box">
      <h2 className="section-title"><Reply size={15} /> Suggested reply</h2>
      {!replyDraft && !regenerate.isPending
        ? <div className="no-reply-note" data-testid="no-reply-notice">We don't recommend replying to this email.</div>
        : <>
          <div className="tone-chips" role="group" aria-label="Reply tone">
            {TONE_OPTIONS.map((tone) => <button
              key={tone.key}
              className={`tone-chip ${(pendingTone ?? data.reply_tone) === tone.key ? "active" : ""}`}
              aria-pressed={(pendingTone ?? data.reply_tone) === tone.key}
              onClick={() => { setPendingTone(tone.key); regenerate.mutate(tone.key); }}
              disabled={regenerate.isPending}
              data-testid={`tone-chip-${tone.key}`}
            >{tone.label}</button>)}
          </div>
          {regenerate.isPending
            ? <div className="skeleton reply-skeleton" data-testid="reply-skeleton" />
            : <textarea className="reply-editor" value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} aria-label="Suggested reply body" data-testid="generated-reply" />}
          <div className="reply-actions">
            <button className="button-secondary" onClick={() => { setPendingTone(data.reply_tone); regenerate.mutate(data.reply_tone); }} disabled={regenerate.isPending} data-testid="regenerate-reply-button">{regenerate.isPending ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />} Regenerate</button>
            <button className="button-secondary" onClick={() => { void navigator.clipboard?.writeText(replyDraft); setCopied(true); }} disabled={regenerate.isPending} data-testid="copy-response-button"><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
            <button className="button-primary reply-cta" disabled={regenerate.isPending} data-testid="email-reply-button"><Check size={15} /> Use this draft</button>
          </div>
        </>}
    </section>}

    {/* 6. Technical details */}
    <details className="panel analysis-section technical-details" data-testid="technical-details">
      <summary><Cpu size={14} /> Technical details</summary>
      <div className="tech-bars">
        <div className="tech-bar-row"><div className="tech-bar-label" title="How closely this email matches known spam patterns."><span>Spam probability</span><strong className={riskTone(data.spam_probability)}>{data.spam_probability}%</strong></div><div className="tech-track"><i className={riskTone(data.spam_probability)} style={{ width: `${data.spam_probability}%` }} /></div></div>
        <div className="tech-bar-row"><div className="tech-bar-label" title="How many phishing indicators (links, credential requests, urgency) were detected."><span>Phishing probability</span><strong className={riskTone(data.phishing_score)}>{data.phishing_score}%</strong></div><div className="tech-track"><i className={riskTone(data.phishing_score)} style={{ width: `${data.phishing_score}%` }} /></div></div>
        <div className="tech-bar-row"><div className="tech-bar-label" title="How confident the model is in the assigned category."><span>Category confidence</span><strong className="tone-neutral">{data.category_confidence}%</strong></div><div className="tech-track"><i className="tone-neutral" style={{ width: `${data.category_confidence}%` }} /></div></div>
        <div className="tech-bar-row"><div className="tech-bar-label" title="Overall model confidence across every prediction on this email."><span>Model confidence</span><strong className="tone-neutral">{data.confidence}%</strong></div><div className="tech-track"><i className="tone-neutral" style={{ width: `${data.confidence}%` }} /></div></div>
      </div>
    </details>

    {/* 7. Feedback */}
    <section className="panel analysis-section feedback-card" data-testid="correction-box">
      <h2 className="section-title">Was this correct?</h2>
      <div className="verdict-options" role="group" aria-label="Correct classification">
        {(["Safe", "Spam", "Phishing"] as const).map((label) => <button
          key={label}
          className={`verdict-option ${data.user_correction === label ? "selected" : ""}`}
          aria-pressed={data.user_correction === label}
          onClick={() => submitCorrection(label)}
          disabled={feedback.isPending}
          data-testid={`correction-${label.toLowerCase()}-button`}
        >{label}</button>)}
        <select className="category-select" value={categoryChoice} onChange={(event) => setCategoryChoice(event.target.value)} aria-label="Correct category" data-testid="correction-category-select">
          {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      {data.user_correction && <div className="feedback-saved" data-testid="correction-success">
        <Check size={13} /> Thanks, saved.
        <button className="undo-link" onClick={() => feedback.mutate({ undo: true })} disabled={feedback.isPending} data-testid="correction-undo-button"><Undo2 size={12} /> Undo</button>
      </div>}
    </section>
  </div></AppShell>;
}
