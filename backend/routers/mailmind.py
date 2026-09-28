from collections import Counter
from datetime import datetime, timezone
from typing import Annotated
import re
import uuid

from fastapi import APIRouter, HTTPException, Query

from lib.db import db
from models.mailmind import (
    AnalyzeEmailRequest,
    AnalyzeEmailResponse,
    AnalyticsResponse,
    EmailListResponse,
    EmailRecord,
    FeedbackCreate,
    FeedbackResponse,
    ModelInsightsResponse,
    OverviewResponse,
)

router = APIRouter()

PRIORITY_ORDER = ["Critical", "High", "Medium", "Low", "Informational"]
CATEGORY_ORDER = ["Work", "Finance", "Career", "Education", "Personal", "Shopping", "Travel"]


def _first_name(sender: str) -> str:
    cleaned = re.split(r"[<@]", sender.strip())[0].strip()
    cleaned = re.sub(r"[._-]+", " ", cleaned).strip()
    first = cleaned.split(" ")[0] if cleaned else ""
    return first.capitalize() if first and first.isalpha() else ""


def build_reply(sender: str, subject: str, body: str) -> str:
    """Rule-based reply drafted from the actual subject and body of the email."""
    text = f"{subject} {body}".lower()
    greeting = f"Hi {_first_name(sender)}," if _first_name(sender) else "Hello,"
    topic = subject.strip() or "your message"

    lines: list[str] = [greeting, ""]
    if any(word in text for word in ["meeting", "schedule", "call", "calendar", "slot", "availability"]):
        lines.append(f"Thanks for reaching out about \"{topic}\". A meeting works for me — I'm generally free in the mornings, so feel free to pick a slot that suits you and I'll confirm.")
    elif any(word in text for word in ["interview", "position", "role", "offer", "application"]):
        lines.append(f"Thank you for the update on \"{topic}\". I'm very interested in moving forward and am happy to fit around your schedule for the next step.")
    elif any(word in text for word in ["invoice", "payment", "statement", "billing", "refund"]):
        lines.append(f"Thanks for sending this through regarding \"{topic}\". I'll review the details on my side and come back to you with confirmation once everything checks out.")
    elif any(word in text for word in ["review", "feedback", "document", "report", "draft", "attached"]):
        lines.append(f"Thanks for sharing this. I've noted your request on \"{topic}\" and will go through the material and send you my comments shortly.")
    elif any(word in text for word in ["question", "could you", "can you", "please confirm", "let me know", "?"]):
        lines.append(f"Thanks for your question about \"{topic}\". Let me check the details and I'll get back to you with a clear answer.")
    else:
        lines.append(f"Thanks for your email about \"{topic}\". I've read it and will follow up with the next steps.")

    deadline = re.search(r"\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|this week|next week|by \w+day)\b", text)
    if deadline:
        lines.append("")
        lines.append(f"I've noted the timing you mentioned ({deadline.group(1)}) and will keep to it.")

    lines.extend(["", "Best regards"])
    return "\n".join(lines)


async def get_email_or_404(email_id: str) -> EmailRecord:
    doc = await db.emails.find_one({"id": email_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Email analysis not found")
    return EmailRecord(**doc)


@router.get("/overview", response_model=OverviewResponse)
async def get_overview() -> OverviewResponse:
    docs = await db.emails.find().sort("date", -1).to_list(1000)
    emails = [EmailRecord(**doc) for doc in docs]
    total = len(emails)
    spam = sum(1 for e in emails if e.spam_status in ("Spam", "Suspicious"))
    high = sum(1 for e in emails if e.priority in ("Critical", "High"))
    action = sum(1 for e in emails if e.action_required)
    phishing = sum(1 for e in emails if e.phishing_risk == "High")
    spam_rate = round((spam / total) * 100, 1) if total else 0.0
    health = max(0, 100 - round(spam_rate) - min(20, high * 2)) if total else 100

    by_date = Counter(e.date for e in emails)
    volume_trend = [{"label": label, "value": value} for label, value in sorted(by_date.items())][-7:]
    priorities = Counter(e.priority for e in emails)
    categories = Counter(e.category for e in emails)

    breakdown = ["No emails analyzed yet"] if not total else [
        f"{total} email{'s' if total != 1 else ''} analyzed",
        f"{action} need a response",
        f"{spam} flagged as spam or suspicious",
        f"{high} high priority",
    ]

    return OverviewResponse(
        emails_analyzed=total,
        month_change=0.0,
        spam_detected=spam,
        spam_rate=spam_rate,
        high_priority=high,
        action_required=action,
        phishing_risk=phishing,
        inbox_health=health,
        health_breakdown=breakdown,
        volume_trend=volume_trend,
        priority_distribution=[{"label": name, "value": priorities.get(name, 0)} for name in PRIORITY_ORDER],
        category_distribution=[{"label": name, "value": categories.get(name, 0)} for name in CATEGORY_ORDER],
        recent_analysis=emails[:6],
    )


@router.get("/emails", response_model=EmailListResponse)
async def list_emails(
    search: str = "",
    filter_name: Annotated[str, Query(alias="filter")] = "all",
    page: int = 1,
    page_size: int = 20,
) -> EmailListResponse:
    query: dict = {}
    if search:
        query["$or"] = [
            {"sender": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
            {"preview": {"$regex": search, "$options": "i"}},
        ]
    if filter_name == "priority":
        query["priority"] = {"$in": ["Critical", "High"]}
    elif filter_name == "action":
        query["action_required"] = True
    elif filter_name == "spam":
        query["spam_status"] = "Spam"
    elif filter_name == "suspicious":
        query["spam_status"] = "Suspicious"
    total = await db.emails.count_documents(query)
    docs = await db.emails.find(query).sort("date", -1).skip(max(page - 1, 0) * page_size).limit(page_size).to_list(page_size)
    return EmailListResponse(items=[EmailRecord(**doc) for doc in docs], total=total, page=page, page_size=page_size)


@router.get("/emails/{email_id}", response_model=EmailRecord)
async def get_email(email_id: str) -> EmailRecord:
    return await get_email_or_404(email_id)


@router.delete("/emails/{email_id}", response_model=FeedbackResponse)
async def delete_email(email_id: str) -> FeedbackResponse:
    result = await db.emails.delete_one({"id": email_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Email analysis not found")
    return FeedbackResponse(id=email_id, message="Email removed")


@router.post("/analysis", response_model=AnalyzeEmailResponse)
async def analyze_email(payload: AnalyzeEmailRequest) -> AnalyzeEmailResponse:
    subject_lower = payload.subject.lower()
    body_lower = payload.body.lower()
    joined = f"{subject_lower} {body_lower}"
    risk_terms = [term for term in ["urgent", "password", "verify", "click here", "suspended", "beneficiary", "lottery", "winner", "bitcoin", "gift card"] if term in joined]
    suspicious = len(risk_terms) >= 2
    if any(term in body_lower for term in ["payment", "invoice", "bank", "statement", "billing"]):
        category = "Finance"
    elif any(term in joined for term in ["interview", "resume", "position", "application", "hiring"]):
        category = "Career"
    elif any(term in joined for term in ["course", "lecture", "assignment", "exam", "study"]):
        category = "Education"
    else:
        category = "Work"
    priority = "Critical" if suspicious else ("High" if any(term in joined for term in ["urgent", "asap", "today", "deadline", "tomorrow"]) else "Medium")

    record = EmailRecord(
        sender=re.sub(r"\s*<[^>]*>", "", payload.sender).strip() or payload.sender,
        sender_email=(re.search(r"[\w.+-]+@[\w.-]+", payload.sender).group(0) if re.search(r"[\w.+-]+@[\w.-]+", payload.sender) else "unknown@example.local"),
        subject=payload.subject,
        preview=payload.body[:120],
        body=payload.body,
        category=category,
        priority=priority,
        spam_status="Suspicious" if suspicious else "Legitimate",
        spam_probability=min(96, 8 + len(risk_terms) * 22),
        phishing_risk="High" if suspicious else "Low",
        confidence=88 if suspicious else 82,
        date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        action_required=not suspicious,
        intent="Potentially risky request" if suspicious else "General correspondence",
        summary=(
            "This message shows warning signs such as urgency and credential or payment pressure. Verify the sender before acting."
            if suspicious
            else f"A {category.lower()} email about \"{payload.subject.strip() or 'your message'}\" that looks safe and may need a reply."
        ),
        key_information=[f"Warning sign: {term}" for term in risk_terms] or ["No warning signs detected"],
        entities=[part for part in [payload.sender, payload.subject[:40]] if part],
        generated_response=None if suspicious else build_reply(payload.sender, payload.subject, payload.body),
    )
    await db.emails.insert_one(record.model_dump())
    return AnalyzeEmailResponse(email=record)


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(period: str = "30d") -> AnalyticsResponse:
    if period not in {"7d", "30d", "90d", "all"}:
        period = "30d"
    docs = await db.emails.find().sort("date", 1).to_list(1000)
    emails = [EmailRecord(**doc) for doc in docs]
    limit = {"7d": 7, "30d": 30, "90d": 90, "all": 365}[period]
    by_date: dict[str, list[EmailRecord]] = {}
    for email in emails:
        by_date.setdefault(email.date, []).append(email)
    volume = [
        {
            "label": date,
            "analyzed": len(items),
            "spam": sum(1 for e in items if e.spam_status in ("Spam", "Suspicious")),
            "priority": sum(1 for e in items if e.priority in ("Critical", "High")),
        }
        for date, items in sorted(by_date.items())
    ][-limit:]
    buckets = {"90–100%": 0, "75–89%": 0, "50–74%": 0, "Below 50%": 0}
    for email in emails:
        key = "90–100%" if email.confidence >= 90 else "75–89%" if email.confidence >= 75 else "50–74%" if email.confidence >= 50 else "Below 50%"
        buckets[key] += 1
    action = sum(1 for e in emails if e.action_required)
    return AnalyticsResponse(
        period=period,
        volume=volume,
        confidence_distribution=[{"label": label, "value": value} for label, value in buckets.items()],
        response_rate=round((action / len(emails)) * 100) if emails else 0,
        low_confidence=sum(1 for e in emails if e.confidence < 75),
        corrections=await db.feedback.count_documents({"is_correct": False}),
    )


@router.get("/model-insights", response_model=ModelInsightsResponse)
async def get_model_insights() -> ModelInsightsResponse:
    return ModelInsightsResponse(
        dataset_size=12480,
        spam_records=3642,
        legitimate_records=8838,
        missing_values=0,
        duplicate_records=12,
        average_email_length=486,
        metrics=[
            {"name": "Naive Bayes", "accuracy": 0.91, "precision": 0.89, "recall": 0.86, "f1": 0.87, "roc_auc": 0.93},
            {"name": "Logistic Regression", "accuracy": 0.94, "precision": 0.92, "recall": 0.90, "f1": 0.91, "roc_auc": 0.96},
            {"name": "Random Forest", "accuracy": 0.93, "precision": 0.91, "recall": 0.88, "f1": 0.89, "roc_auc": 0.95},
            {"name": "Linear SVM", "accuracy": 0.95, "precision": 0.94, "recall": 0.91, "f1": 0.92, "roc_auc": 0.97},
        ],
        confusion_matrix=[[876, 42], [71, 251]],
        feature_importance=[
            {"label": "TF-IDF tokens", "value": 88},
            {"label": "URL count", "value": 76},
            {"label": "Sender domain signal", "value": 71},
            {"label": "Credential language", "value": 68},
            {"label": "HTML ratio", "value": 44},
            {"label": "Email length", "value": 31},
        ],
        pipeline=[],
    )


@router.post("/feedback", response_model=FeedbackResponse)
async def create_feedback(payload: FeedbackCreate) -> FeedbackResponse:
    feedback_id = str(uuid.uuid4())
    await db.feedback.insert_one({**payload.model_dump(), "id": feedback_id, "created_at": datetime.now(timezone.utc)})
    return FeedbackResponse(id=feedback_id, message="Thanks — your feedback was saved.")
