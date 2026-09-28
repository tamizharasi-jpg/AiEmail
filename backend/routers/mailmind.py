from datetime import datetime, timezone
from typing import Annotated
import uuid

from fastapi import APIRouter, HTTPException, Query

from lib.db import db
from models.mailmind import (
    AnalysisStage,
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


DEMO_EMAILS = [
    {
        "id": "demo-rahul-project-review",
        "sender": "Rahul Sharma",
        "sender_email": "rahul@northstar.dev",
        "subject": "Project Review Meeting",
        "preview": "Can we align on the evaluation plan before Thursday?",
        "body": "Hi team,\n\nCan we align on the evaluation plan before Thursday? I have attached the latest experiment notes and would like your review on the error analysis section.\n\nBest,\nRahul",
        "category": "Work",
        "priority": "High",
        "spam_status": "Legitimate",
        "spam_probability": 3,
        "phishing_risk": "Low",
        "confidence": 92,
        "date": "2025-05-14",
        "action_required": True,
        "intent": "Request for review",
        "summary": "Rahul is asking for feedback on the evaluation plan and error analysis before Thursday.",
        "key_information": ["Review requested", "Deadline: Thursday", "Experiment notes attached"],
        "entities": ["Evaluation plan", "Error analysis", "Thursday"],
        "influencing_factors": [{"label": "Known work domain", "impact": 82, "direction": "trust"}, {"label": "Clear meeting context", "impact": 65, "direction": "trust"}, {"label": "Attachment present", "impact": 18, "direction": "risk"}],
    },
    {
        "id": "demo-maya-interview",
        "sender": "Maya Patel",
        "sender_email": "maya@talentloop.co",
        "subject": "Next steps: Data Science interview",
        "preview": "We enjoyed meeting you and would like to schedule the next round.",
        "body": "Hello,\n\nWe enjoyed meeting you and would like to schedule the next round of your Data Science interview. Please choose a slot from the calendar link below.\n\nRegards,\nMaya",
        "category": "Career",
        "priority": "High",
        "spam_status": "Legitimate",
        "spam_probability": 4,
        "phishing_risk": "Low",
        "confidence": 95,
        "date": "2025-05-13",
        "action_required": True,
        "intent": "Scheduling request",
        "summary": "A recruiter is inviting you to schedule the next round of a Data Science interview.",
        "key_information": ["Interview next round", "Calendar link included", "Reply recommended"],
        "entities": ["Data Science", "Next round", "Calendar"],
        "influencing_factors": [{"label": "Consistent sender domain", "impact": 79, "direction": "trust"}, {"label": "Professional language", "impact": 71, "direction": "trust"}, {"label": "External link", "impact": 22, "direction": "risk"}],
    },
    {
        "id": "demo-bank-statement",
        "sender": "Axis Bank",
        "sender_email": "statements@axisbank.example",
        "subject": "Your monthly statement is ready",
        "preview": "Your April account statement is now available in online banking.",
        "body": "Your monthly statement for April is available in online banking. Sign in through the official app to view it. This message does not contain a sign-in link.",
        "category": "Finance",
        "priority": "Medium",
        "spam_status": "Legitimate",
        "spam_probability": 6,
        "phishing_risk": "Low",
        "confidence": 89,
        "date": "2025-05-12",
        "action_required": False,
        "intent": "Account notification",
        "summary": "A monthly bank statement notification is available through the official banking app.",
        "key_information": ["April statement", "No sign-in link", "Review when convenient"],
        "entities": ["April", "Online banking"],
        "influencing_factors": [{"label": "Known finance pattern", "impact": 76, "direction": "trust"}, {"label": "No credential request", "impact": 64, "direction": "trust"}, {"label": "Financial context", "impact": 19, "direction": "risk"}],
    },
    {
        "id": "demo-vendor-urgent",
        "sender": "Accounts Payable",
        "sender_email": "billing@vendor-notice.example",
        "subject": "Urgent: invoice payment details changed",
        "preview": "Please update the beneficiary account before the next payment run.",
        "body": "Urgent request: our beneficiary account has changed. Please update payment details before the next payment run. Reply with confirmation once complete.",
        "category": "Finance",
        "priority": "Critical",
        "spam_status": "Suspicious",
        "spam_probability": 73,
        "phishing_risk": "High",
        "confidence": 87,
        "date": "2025-05-11",
        "action_required": True,
        "intent": "Payment change request",
        "summary": "The sender asks for a banking change under urgent time pressure; verify through a known channel.",
        "key_information": ["Beneficiary change", "Urgent language", "Do not reply with confirmation"],
        "entities": ["Payment run", "Beneficiary account"],
        "influencing_factors": [{"label": "Urgency indicators", "impact": 82, "direction": "risk"}, {"label": "Financial request", "impact": 76, "direction": "risk"}, {"label": "Domain mismatch", "impact": 69, "direction": "risk"}],
    },
    {
        "id": "demo-newsletter",
        "sender": "Product Weekly",
        "sender_email": "hello@productweekly.example",
        "subject": "The field guide to better product experiments",
        "preview": "Five practical ways to turn research into sharper product decisions.",
        "body": "This week's field guide covers practical ways to turn research into sharper product decisions. Read the latest edition when you have a moment.",
        "category": "Education",
        "priority": "Low",
        "spam_status": "Legitimate",
        "spam_probability": 11,
        "phishing_risk": "Low",
        "confidence": 90,
        "date": "2025-05-09",
        "action_required": False,
        "intent": "Newsletter",
        "summary": "A product research newsletter with practical guidance on product experiments.",
        "key_information": ["Weekly edition", "No action required", "Optional reading"],
        "entities": ["Product experiments", "Research"],
        "influencing_factors": [{"label": "Expected newsletter pattern", "impact": 72, "direction": "trust"}, {"label": "Low urgency", "impact": 44, "direction": "trust"}, {"label": "Promotional language", "impact": 28, "direction": "risk"}],
    },
    {
        "id": "demo-credential-risk",
        "sender": "Security Desk",
        "sender_email": "security-alert@verify-account.example",
        "subject": "Action required: verify your mailbox",
        "preview": "Your account will be suspended unless you verify within 24 hours.",
        "body": "Your account will be suspended unless you verify within 24 hours. Use the secure portal below and enter your password to restore access.",
        "category": "Personal",
        "priority": "Critical",
        "spam_status": "Suspicious",
        "spam_probability": 94,
        "phishing_risk": "High",
        "confidence": 96,
        "date": "2025-05-08",
        "action_required": True,
        "intent": "Credential harvesting",
        "summary": "This message uses account suspension pressure and requests credentials through an unverified domain.",
        "key_information": ["24-hour threat", "Password request", "Do not use the link"],
        "entities": ["Mailbox", "24 hours", "Secure portal"],
        "influencing_factors": [{"label": "Credential request", "impact": 91, "direction": "risk"}, {"label": "Urgency indicators", "impact": 86, "direction": "risk"}, {"label": "External domain", "impact": 77, "direction": "risk"}],
    },
]


async def ensure_demo_emails() -> None:
    if await db.emails.count_documents({}) == 0:
        await db.emails.insert_many(DEMO_EMAILS)


async def get_email_or_404(email_id: str) -> EmailRecord:
    await ensure_demo_emails()
    doc = await db.emails.find_one({"id": email_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Email analysis not found")
    return EmailRecord(**doc)


@router.get("/overview", response_model=OverviewResponse)
async def get_overview() -> OverviewResponse:
    await ensure_demo_emails()
    recent_docs = await db.emails.find().sort("date", -1).limit(6).to_list(6)
    return OverviewResponse(
        emails_analyzed=2430,
        month_change=12.4,
        spam_detected=324,
        spam_rate=13.3,
        high_priority=187,
        action_required=421,
        phishing_risk=42,
        inbox_health=78,
        health_breakdown=["Low clutter", "Good response coverage", "Moderate spam", "12 urgent emails"],
        volume_trend=[{"label": "May 08", "value": 290}, {"label": "May 09", "value": 348}, {"label": "May 10", "value": 312}, {"label": "May 11", "value": 401}, {"label": "May 12", "value": 377}, {"label": "May 13", "value": 442}, {"label": "May 14", "value": 435}],
        priority_distribution=[{"label": "Critical", "value": 42}, {"label": "High", "value": 187}, {"label": "Medium", "value": 612}, {"label": "Low", "value": 1008}, {"label": "Informational", "value": 581}],
        category_distribution=[{"label": "Work", "value": 734}, {"label": "Personal", "value": 405}, {"label": "Finance", "value": 328}, {"label": "Career", "value": 218}, {"label": "Education", "value": 247}, {"label": "Shopping", "value": 206}, {"label": "Travel", "value": 142}, {"label": "Other", "value": 150}],
        recent_analysis=[EmailRecord(**doc) for doc in recent_docs],
    )


@router.get("/emails", response_model=EmailListResponse)
async def list_emails(
    search: str = "",
    filter_name: Annotated[str, Query(alias="filter")] = "all",
    page: int = 1,
    page_size: int = 20,
) -> EmailListResponse:
    await ensure_demo_emails()
    query: dict = {}
    if search:
        query["$or"] = [{"sender": {"$regex": search, "$options": "i"}}, {"subject": {"$regex": search, "$options": "i"}}, {"preview": {"$regex": search, "$options": "i"}}]
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


@router.post("/analysis", response_model=AnalyzeEmailResponse)
async def analyze_email(payload: AnalyzeEmailRequest) -> AnalyzeEmailResponse:
    subject_lower = payload.subject.lower()
    body_lower = payload.body.lower()
    risk_terms = [term for term in ["urgent", "password", "verify", "payment", "suspended", "beneficiary"] if term in f"{subject_lower} {body_lower}"]
    suspicious = len(risk_terms) >= 2
    category = "Finance" if any(term in body_lower for term in ["payment", "invoice", "bank", "statement"]) else "Work"
    priority = "Critical" if suspicious and any(term in body_lower for term in ["password", "suspended", "verify"]) else ("High" if "urgent" in subject_lower else "Medium")
    record = EmailRecord(
        sender=payload.sender,
        sender_email=payload.sender or "unknown@example.local",
        subject=payload.subject,
        preview=payload.body[:120],
        body=payload.body,
        category=category,
        priority=priority,
        spam_status="Suspicious" if suspicious else "Legitimate",
        spam_probability=min(96, 18 + len(risk_terms) * 19),
        phishing_risk="High" if suspicious else "Low",
        confidence=83 if suspicious else 79,
        date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        action_required=True,
        intent="Potentially risky request" if suspicious else "General correspondence",
        summary="The demo model flagged risk indicators that warrant verification before acting." if suspicious else "The demo model found a routine message that may need a response.",
        key_information=["Human review recommended", *([f"Risk term: {term}" for term in risk_terms] if risk_terms else ["No high-risk terms detected"])],
        entities=[payload.sender, payload.subject[:40]],
        influencing_factors=[{"label": "Risk language", "impact": min(92, 35 + len(risk_terms) * 15), "direction": "risk" if suspicious else "trust"}, {"label": "Message context", "impact": 54, "direction": "trust"}],
    )
    await db.emails.insert_one(record.model_dump())
    stages = [
        AnalysisStage(name="Ingesting", detail="Email parsed", status="complete"),
        AnalysisStage(name="Cleaning", detail="Text normalized", status="complete"),
        AnalysisStage(name="NLP processing", detail="42 language features extracted", status="complete"),
        AnalysisStage(name="Feature engineering", detail="Signals prepared", status="complete"),
        AnalysisStage(name="ML classification", detail="Category and spam models evaluated", status="complete"),
        AnalysisStage(name="Explainability", detail="Influencing factors prepared", status="complete"),
        AnalysisStage(name="Complete", detail="Human review remains recommended", status="active"),
    ]
    response = "Do not act on this email until the sender and request are verified through a known channel." if suspicious else "Hi,\n\nThanks for reaching out. I’ve reviewed your message and will follow up shortly with the next steps.\n\nBest,\nAlex"
    return AnalyzeEmailResponse(email=record, stages=stages, generated_response=response)


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(period: str = "30d") -> AnalyticsResponse:
    if period not in {"7d", "30d", "90d", "all"}:
        period = "30d"
    points = {
        "7d": [42, 51, 47, 62, 58, 71, 68],
        "30d": [39, 47, 44, 58, 52, 61, 68, 64, 73, 77, 81, 86],
        "90d": [31, 38, 42, 46, 51, 58, 62, 68, 73, 79, 84, 91],
        "all": [18, 29, 34, 42, 49, 58, 66, 74, 81, 91, 103, 112],
    }[period]
    return AnalyticsResponse(period=period, volume=[{"label": f"W{i + 1}", "analyzed": value, "spam": round(value * 0.13), "priority": round(value * 0.09)} for i, value in enumerate(points)], confidence_distribution=[{"label": "90–100%", "value": 61}, {"label": "75–89%", "value": 27}, {"label": "50–74%", "value": 9}, {"label": "Below 50%", "value": 3}], response_rate=68, low_confidence=73, corrections=18)


@router.get("/model-insights", response_model=ModelInsightsResponse)
async def get_model_insights() -> ModelInsightsResponse:
    return ModelInsightsResponse(
        dataset_size=12480,
        spam_records=3642,
        legitimate_records=8838,
        missing_values=0,
        duplicate_records=12,
        average_email_length=486,
        metrics=[{"name": "Naive Bayes", "accuracy": 0.91, "precision": 0.89, "recall": 0.86, "f1": 0.87, "roc_auc": 0.93}, {"name": "Logistic Regression", "accuracy": 0.94, "precision": 0.92, "recall": 0.90, "f1": 0.91, "roc_auc": 0.96}, {"name": "Random Forest", "accuracy": 0.93, "precision": 0.91, "recall": 0.88, "f1": 0.89, "roc_auc": 0.95}, {"name": "Linear SVM", "accuracy": 0.95, "precision": 0.94, "recall": 0.91, "f1": 0.92, "roc_auc": 0.97}],
        confusion_matrix=[[876, 42], [71, 251]],
        feature_importance=[{"label": "TF-IDF tokens", "value": 88}, {"label": "URL count", "value": 76}, {"label": "Sender domain signal", "value": 71}, {"label": "Credential language", "value": 68}, {"label": "HTML ratio", "value": 44}, {"label": "Email length", "value": 31}],
        pipeline=[{"name": "Raw email", "detail": "Input text and metadata"}, {"name": "Cleaning", "detail": "Normalize and strip noise"}, {"name": "NLP", "detail": "Tokenize and embed language"}, {"name": "Features", "detail": "Build model signals"}, {"name": "Classifiers", "detail": "Spam, category and priority"}, {"name": "Explainability", "detail": "Surface influencing factors"}],
    )


@router.post("/feedback", response_model=FeedbackResponse)
async def create_feedback(payload: FeedbackCreate) -> FeedbackResponse:
    feedback_id = str(uuid.uuid4())
    await db.feedback.insert_one({**payload.model_dump(), "id": feedback_id, "created_at": datetime.now(timezone.utc)})
    return FeedbackResponse(id=feedback_id, message="Feedback recorded for the demo model.")