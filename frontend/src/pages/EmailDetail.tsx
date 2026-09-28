import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, MessageSquareText, Reply, ShieldAlert, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import type { EmailRecord } from "@/types/mailmind";
import AppShell from "@/components/layout/AppShell";
import { CategoryBadge, PriorityBadge, SpamBadge } from "@/components/mailmind/StatusBadge";

export default function EmailDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: ["email", id], queryFn: () => apiGet<EmailRecord>(`/emails/${id}`) });
  const feedback = useMutation({
    mutationFn: (is_correct: boolean) => apiPost("/feedback", { email_id: id, is_correct }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email", id] }),
  });

  if (isLoading) return <AppShell><div className="page-stack" data-testid="email-detail-loading"><div className="skeleton large" /><div className="skeleton" /></div></AppShell>;
  if (isError || !data) return <AppShell><div className="empty-state page-empty" data-testid="email-detail-error"><ShieldAlert size={24} /><strong>Email not found</strong><Link to="/inbox" className="button-secondary">Back to inbox</Link></div></AppShell>;

  const risky = data.spam_status !== "Legitimate";
  const reply = data.generated_response;

  return <AppShell><div className="page-stack" data-testid="email-detail-page">
    <div className="detail-top">
      <Link to="/inbox" className="back-link" data-testid="email-detail-back"><ArrowLeft size={15} /> Back to inbox</Link>
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
          <div className="insight-block">
            <div className="insight-title"><span>Safety</span></div>
            <div className="insight-result"><SpamBadge value={data.spam_status} /><span>{data.spam_probability}% spam likelihood</span></div>
          </div>
          <div className="insight-block">
            <div className="insight-title"><span>Priority</span></div>
            <div className="insight-result"><PriorityBadge value={data.priority} /><span>{data.action_required ? "Reply recommended" : "No action needed"}</span></div>
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

        <div className="feedback-box">
          <span>Was this useful?</span>
          <div>
            <button onClick={() => feedback.mutate(true)} data-testid="feedback-yes-button"><ThumbsUp size={14} /> Yes</button>
            <button onClick={() => feedback.mutate(false)} data-testid="feedback-no-button"><ThumbsDown size={14} /> No</button>
          </div>
          {feedback.isSuccess && <small data-testid="feedback-success">Feedback recorded</small>}
        </div>
      </aside>
    </div>
  </div></AppShell>;
}
