import { Archive, ArrowUpRight, Check, MoreHorizontal, ShieldAlert, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { EmailRecord } from "@/types/mailmind";
import { CategoryBadge, PriorityBadge, SpamBadge } from "./StatusBadge";

export default function EmailTable({ emails }: { emails: EmailRecord[] }) {
  return <div className="email-table-wrap" data-testid="email-table">
    <div className="email-table-head"><span className="check-cell"><input type="checkbox" aria-label="Select all emails" data-testid="email-select-all" /></span><span>Sender / subject</span><span>Category</span><span>Priority</span><span>Security</span><span>Confidence</span><span>Date</span><span /></div>
    {emails.map((email) => <div className="email-row" key={email.id} data-testid={`email-row-${email.id}`}>
      <span className="check-cell"><input type="checkbox" aria-label={`Select ${email.subject}`} data-testid={`email-select-${email.id}`} /></span>
      <Link to={`/inbox/${email.id}`} className="email-main-cell" data-testid={`email-open-${email.id}`}><div className="sender-avatar">{email.sender.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div className="email-copy"><strong>{email.sender}</strong><span>{email.subject}</span><small>{email.preview}</small></div></Link>
      <CategoryBadge value={email.category} />
      <PriorityBadge value={email.priority} />
      <div className="security-cell"><SpamBadge value={email.spam_status} />{email.phishing_risk === "High" && <ShieldAlert size={14} className="danger-icon" />}</div>
      <div className="confidence-cell"><span>{email.confidence}%</span><div className="tiny-progress"><i style={{ width: `${email.confidence}%` }} /></div></div>
      <span className="date-cell">{email.date.replace("2025-", "")}</span>
      <div className="row-actions"><Link to={`/inbox/${email.id}`} aria-label="View email" data-testid={`email-view-${email.id}`}><ArrowUpRight size={15} /></Link><button aria-label="More email actions" data-testid={`email-more-${email.id}`}><MoreHorizontal size={16} /></button></div>
    </div>)}
    {!emails.length && <div className="empty-state" data-testid="email-empty-state"><div className="empty-icon"><Check size={20} /></div><strong>No emails match this view</strong><span>Try adjusting your search or filter.</span></div>}
  </div>;
}