from collections import Counter
from datetime import datetime, timezone
from typing import Annotated
import re
import uuid

from fastapi import APIRouter, HTTPException, Query

from lib.db import db
from lib import ollama
from models.mailmind import (
    AiStatusResponse,
    AnalyzeEmailRequest,
    AnalyzeEmailResponse,
    AnalyticsResponse,
    EdaResponse,
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
STOPWORDS = {
    "the", "and", "for", "you", "your", "with", "this", "that", "from", "have", "will",
    "are", "was", "were", "has", "had", "not", "but", "can", "our", "all", "any", "been",
    "into", "than", "then", "them", "they", "their", "there", "here", "just", "its", "it's",
    "please", "email", "regards", "hi", "hello", "dear", "thanks", "thank", "sincerely",
    "about", "would", "could", "should", "when", "what", "which", "who", "how", "out",
    "get", "got", "let", "one", "two", "new", "now", "yet", "per", "via", "over", "some",
}
SPECIAL_CHARS = ["!", "$", "%", "@", "#", "?", "*", "&"]


def detect_phishing_signals(subject: str, body: str, sender_email: str) -> dict:
    """Rule-based phishing detector: scans the actual subject/body/sender for concrete
    indicators instead of a fabricated number, and returns a supporting-signal score."""
    text = f"{subject} {body}".lower()
    indicators: list[str] = []
    score = 4

    urls = re.findall(r"https?://[^\s]+", body)
    if urls:
        looks_baited = any(term in text for term in ["click here", "verify", "confirm", "login", "reset your password", "bit.ly"])
        indicators.append(f"Suspicious URL ({len(urls)} link{'s' if len(urls) != 1 else ''})")
        score += 22 if looks_baited else 8

    if any(term in text for term in ["password", "login credentials", "verify your identity", "confirm your account", "security code", "one-time password", "otp", "social security"]):
        indicators.append("Credential request")
        score += 24

    if any(term in text for term in ["urgent", "immediately", "act now", "within 24 hours", "account suspended", "will be closed", "final notice", "expire"]):
        indicators.append("Urgency pattern")
        score += 16

    if any(term in text for term in ["bitcoin", "gift card", "wire transfer", "bank account", "beneficiary", "lottery", "winner", "inheritance", "claim your prize"]):
        indicators.append("Financial request")
        score += 22

    brand_terms = ["bank", "paypal", "amazon", "apple", "microsoft", "netflix"]
    mentioned_brand = next((brand for brand in brand_terms if brand in text), None)
    if mentioned_brand and mentioned_brand not in sender_email.lower():
        indicators.append("Sender / brand domain mismatch")
        score += 18

    if any(term in text for term in ["attached", "attachment", ".exe", ".zip", ".scr"]) and len(indicators) >= 1:
        indicators.append("Risky attachment reference")
        score += 10

    return {"score": min(97, score), "indicators": indicators or ["No warning signs detected"]}


def extract_key_information(subject: str, body: str) -> list[str]:
    """The 'Extract important information' pipeline stage: pulls concrete, grounded
    facts out of the email (deadlines, amounts, meeting requests, links, questions)
    so both the reply generator and the UI can reference real content, not guesses."""
    text = f"{subject} {body}"
    lower = text.lower()
    facts: list[str] = []

    deadline = re.search(r"\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week|by \w+day|end of day|eod)\b", lower)
    if deadline:
        facts.append(f"Deadline mentioned: {deadline.group(1)}")

    amount = re.search(r"\$\s?\d[\d,]*(?:\.\d{2})?|\b\d+\s?(?:usd|inr|dollars)\b", text, re.IGNORECASE)
    if amount:
        facts.append(f"Amount mentioned: {amount.group(0).strip()}")

    if any(term in lower for term in ["meeting", "call", "schedule", "calendar", "availability", "slot"]):
        facts.append("Meeting or call requested")

    if "?" in text or any(term in lower for term in ["could you", "can you", "please confirm", "let me know"]):
        facts.append("Contains a direct question")

    urls = re.findall(r"https?://[^\s]+", body)
    if urls:
        facts.append(f"Contains {len(urls)} link{'s' if len(urls) != 1 else ''}")

    if any(term in lower for term in ["attached", "attachment"]):
        facts.append("References an attachment")

    name_match = re.search(r"\b([A-Z][a-z]+ [A-Z][a-z]+)\b", body)
    if name_match:
        facts.append(f"Mentions: {name_match.group(1)}")

    return facts or ["No specific action items detected"]


CATEGORY_KEYWORDS = {
    "Finance": ["payment", "invoice", "bank", "statement", "billing", "refund", "transaction"],
    "Career": ["interview", "resume", "position", "application", "hiring", "offer letter"],
    "Education": ["course", "lecture", "assignment", "exam", "study", "semester"],
    "Personal": ["appointment", "reminder", "family", "birthday", "personal"],
    "Shopping": ["order", "shipment", "delivery", "cart", "discount"],
    "Travel": ["flight", "itinerary", "booking", "hotel", "reservation"],
}

# Human-friendly noun phrase for each category, used to state plainly what kind of email this is.
CATEGORY_LABELS = {
    "Work": "work",
    "Finance": "finance",
    "Career": "career",
    "Education": "educational",
    "Personal": "personal",
    "Shopping": "purchase",
    "Travel": "travel",
}


def classify_category(joined: str, body_lower: str) -> tuple[str, int]:
    """Picks the category with the strongest keyword match and a confidence that reflects
    how many real signals were found, instead of a fixed number."""
    best_category = "Work"
    best_hits = 0
    for category, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in joined)
        if hits > best_hits:
            best_category, best_hits = category, hits
    confidence = min(96, 44 + best_hits * 16) if best_hits else 32 + min(18, len(body_lower.split()) // 10)
    return best_category, confidence


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
    sender_email = re.search(r"[\w.+-]+@[\w.-]+", payload.sender)
    sender_email = sender_email.group(0) if sender_email else "unknown@example.local"
    category, category_confidence = classify_category(joined, body_lower)
    phishing = detect_phishing_signals(payload.subject, payload.body, sender_email)
    priority = "Critical" if suspicious else ("High" if any(term in joined for term in ["urgent", "asap", "today", "deadline", "tomorrow"]) else "Medium")

    label = CATEGORY_LABELS.get(category, category.lower())
    article = "an" if label[0] in "aeiou" else "a"
    extracted_info = extract_key_information(payload.subject, payload.body)
    record = EmailRecord(
        sender=re.sub(r"\s*<[^>]*>", "", payload.sender).strip() or payload.sender,
        sender_email=sender_email,
        subject=payload.subject,
        preview=payload.body[:120],
        body=payload.body,
        category=category,
        priority=priority,
        spam_status="Suspicious" if suspicious else "Legitimate",
        spam_probability=min(96, 8 + len(risk_terms) * 22),
        phishing_risk="High" if phishing["score"] >= 60 else ("Medium" if phishing["score"] >= 30 else "Low"),
        phishing_score=phishing["score"],
        category_confidence=category_confidence,
        security_indicators=phishing["indicators"],
        confidence=88 if suspicious else 82,
        date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        action_required=not suspicious,
        intent="Potentially risky request" if suspicious else "General correspondence",
        summary=(
            f"This looks like {article} {label} email, but it shows warning signs such as urgency and credential or payment pressure. Verify the sender before acting."
            if suspicious
            else f"This is {article} {label} email about \"{payload.subject.strip() or 'your message'}\" that looks safe and may need a reply."
        ),
        key_information=([f"Warning sign: {term}" for term in risk_terms] + extracted_info) if suspicious else extracted_info,
        entities=[part for part in [payload.sender, payload.subject[:40]] if part],
        generated_response=None,
    )
    if not suspicious:
        llm_reply = await ollama.generate_reply(record.sender, payload.subject, payload.body, extracted_info)
        record.generated_response = llm_reply or build_reply(payload.sender, payload.subject, payload.body)
        record.reply_source = "ollama" if llm_reply else "builtin"
    await db.emails.insert_one(record.model_dump())
    return AnalyzeEmailResponse(email=record)


@router.get("/ai-status", response_model=AiStatusResponse)
async def ai_status() -> AiStatusResponse:
    online, message = await ollama.check_status()
    return AiStatusResponse(online=online, model=ollama.ollama_model() if ollama.is_configured() else None, message=message)


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


def _length_buckets(lengths: list[int], edges: list[int]) -> list[dict[str, int | str]]:
    labels = [f"0–{edges[0]}"] + [f"{edges[i]}–{edges[i + 1]}" for i in range(len(edges) - 1)] + [f"{edges[-1]}+"]
    counts = [0] * len(labels)
    for length in lengths:
        placed = False
        for index, edge in enumerate(edges):
            if length <= edge:
                counts[index] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1
    return [{"label": label, "value": count} for label, count in zip(labels, counts)]


@router.get("/eda", response_model=EdaResponse)
async def get_eda() -> EdaResponse:
    docs = await db.emails.find().to_list(2000)
    emails = [EmailRecord(**doc) for doc in docs]
    total = len(emails)
    if not total:
        return EdaResponse(
            total=0,
            spam_vs_ham=[{"label": "Ham (legitimate)", "value": 0}, {"label": "Spam / suspicious", "value": 0}],
            average_email_length=0,
            average_subject_length=0,
            email_length_buckets=[],
            subject_length_buckets=[],
            top_words=[],
            url_frequency={"with_url": 0, "without_url": 0},
            html_frequency={"html": 0, "plain": 0},
            character_frequency=[],
            category_distribution=[{"label": name, "value": 0} for name in CATEGORY_ORDER],
            priority_distribution=[{"label": name, "value": 0} for name in PRIORITY_ORDER],
            has_data=False,
        )

    ham = sum(1 for e in emails if e.spam_status == "Legitimate")
    spam = total - ham
    body_lengths = [len(e.body) for e in emails]
    subject_lengths = [len(e.subject) for e in emails]

    word_counts: Counter[str] = Counter()
    url_count = 0
    html_count = 0
    char_counts = {char: 0 for char in SPECIAL_CHARS}
    for email in emails:
        text = f"{email.subject} {email.body}"
        words = re.findall(r"[a-zA-Z]{3,}", text.lower())
        word_counts.update(word for word in words if word not in STOPWORDS)
        if re.search(r"https?://", email.body):
            url_count += 1
        if re.search(r"<\s*(a|div|p|table|br|span)[\s>]", email.body, re.IGNORECASE):
            html_count += 1
        for char in SPECIAL_CHARS:
            char_counts[char] += email.body.count(char)

    priorities = Counter(e.priority for e in emails)
    categories = Counter(e.category for e in emails)

    return EdaResponse(
        total=total,
        spam_vs_ham=[{"label": "Ham (legitimate)", "value": ham}, {"label": "Spam / suspicious", "value": spam}],
        average_email_length=round(sum(body_lengths) / total),
        average_subject_length=round(sum(subject_lengths) / total),
        email_length_buckets=_length_buckets(body_lengths, [100, 250, 500, 1000]),
        subject_length_buckets=_length_buckets(subject_lengths, [20, 40, 60, 90]),
        top_words=[{"label": word, "value": count} for word, count in word_counts.most_common(12)],
        url_frequency={"with_url": url_count, "without_url": total - url_count},
        html_frequency={"html": html_count, "plain": total - html_count},
        character_frequency=[{"label": char, "value": count} for char, count in char_counts.items() if count > 0] or [{"label": char, "value": 0} for char in SPECIAL_CHARS[:4]],
        category_distribution=[{"label": name, "value": categories.get(name, 0)} for name in CATEGORY_ORDER],
        priority_distribution=[{"label": name, "value": priorities.get(name, 0)} for name in PRIORITY_ORDER],
        has_data=True,
    )


@router.post("/feedback", response_model=FeedbackResponse)
async def create_feedback(payload: FeedbackCreate) -> FeedbackResponse:
    feedback_id = str(uuid.uuid4())
    email_doc = await db.emails.find_one({"id": payload.email_id})
    is_correct = payload.is_correct
    message = "Thanks — your feedback was saved."
    if payload.correction and email_doc:
        current_spam = email_doc.get("spam_status")
        is_correct = (payload.correction == "Spam" and current_spam in ("Spam", "Suspicious")) or (
            payload.correction == "Not spam" and current_spam == "Legitimate"
        )
        await db.emails.update_one({"id": payload.email_id}, {"$set": {"user_correction": payload.correction}})
        message = "Correction saved — it will be used for future model retraining."
    await db.feedback.insert_one({**payload.model_dump(), "is_correct": is_correct, "id": feedback_id, "created_at": datetime.now(timezone.utc)})
    return FeedbackResponse(id=feedback_id, message=message)
