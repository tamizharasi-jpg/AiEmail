from datetime import datetime, timezone
from typing import Literal
import uuid

from pydantic import BaseModel, Field


Category = Literal["Work", "Finance", "Career", "Education", "Personal", "Shopping", "Travel"]
Priority = Literal["Critical", "High", "Medium", "Low", "Informational"]
SpamStatus = Literal["Legitimate", "Spam", "Suspicious"]
Verdict = Literal["safe", "suspicious", "dangerous"]
RecommendedAction = Literal["reply", "ignore", "report", "verify_sender"]


class ActionItem(BaseModel):
    task: str
    deadline: str | None = None


class EvidenceItem(BaseModel):
    quote: str
    why: str


class EmailRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender: str
    sender_email: str
    subject: str
    preview: str
    body: str
    category: Category
    priority: Priority
    spam_status: SpamStatus
    spam_probability: int
    phishing_risk: Literal["Low", "Medium", "High"]
    phishing_score: int = 0
    category_confidence: int = 50
    security_indicators: list[str] = Field(default_factory=list)
    confidence: int
    date: str
    model_version: str = "Demo model v1.0"
    action_required: bool
    intent: str
    summary: str
    key_information: list[str]
    entities: list[str]
    verdict: Verdict = "safe"
    reason: str = ""
    action_items: list[ActionItem] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    recommended_action: RecommendedAction = "reply"
    recommendation_text: str = ""
    low_content: bool = False
    generated_response: str | None = None
    reply_subject: str = ""
    reply_tone: str = "professional"
    engine: Literal["ollama", "builtin"] = "builtin"
    user_correction: Literal["Safe", "Spam", "Phishing"] | None = None
    is_simulated: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EmailListResponse(BaseModel):
    items: list[EmailRecord]
    total: int
    page: int
    page_size: int
    is_simulated: bool = True


class OverviewResponse(BaseModel):
    emails_analyzed: int
    month_change: float
    spam_detected: int
    spam_rate: float
    high_priority: int
    action_required: int
    phishing_risk: int
    inbox_health: int
    health_breakdown: list[str]
    volume_trend: list[dict[str, int | str]]
    priority_distribution: list[dict[str, int | str]]
    category_distribution: list[dict[str, int | str]]
    recent_analysis: list[EmailRecord]
    is_simulated: bool = True


class AnalyticsResponse(BaseModel):
    period: Literal["7d", "30d", "90d", "all"]
    volume: list[dict[str, int | str]]
    confidence_distribution: list[dict[str, int | str]]
    response_rate: int
    low_confidence: int
    corrections: int
    is_simulated: bool = True


class ModelMetric(BaseModel):
    name: str
    accuracy: float
    precision: float
    recall: float
    f1: float
    roc_auc: float


class ModelInsightsResponse(BaseModel):
    dataset_size: int
    spam_records: int
    legitimate_records: int
    missing_values: int
    duplicate_records: int
    average_email_length: int
    metrics: list[ModelMetric]
    confusion_matrix: list[list[int]]
    feature_importance: list[dict[str, int | str]]
    pipeline: list[dict[str, str]]
    is_simulated: bool = True


class EdaResponse(BaseModel):
    total: int
    spam_vs_ham: list[dict[str, int | str]]
    average_email_length: int
    average_subject_length: int
    email_length_buckets: list[dict[str, int | str]]
    subject_length_buckets: list[dict[str, int | str]]
    top_words: list[dict[str, int | str]]
    url_frequency: dict[str, int]
    html_frequency: dict[str, int]
    character_frequency: list[dict[str, int | str]]
    category_distribution: list[dict[str, int | str]]
    priority_distribution: list[dict[str, int | str]]
    has_data: bool


class ThreatCell(BaseModel):
    key: str
    label: str
    spam_axis: Literal["low", "high"]
    risk_axis: Literal["low", "high"]
    count: int
    description: str


class IndicatorStat(BaseModel):
    label: str
    count: int
    explanation: str


class SecurityResponse(BaseModel):
    total: int
    legitimate: int
    spam: int
    suspicious: int
    phishing_risk: int
    needs_review: int
    threat_matrix: list[ThreatCell]
    indicators: list[IndicatorStat]
    items: list[EmailRecord]
    has_data: bool


class FeatureStat(BaseModel):
    name: str
    unit: str
    minimum: float
    maximum: float
    mean: float
    median: float


class DatasetRow(BaseModel):
    id: str
    sender: str
    subject: str
    category: str
    priority: str
    label: str
    body_length: int
    url_count: int
    spam_probability: int


class DatasetResponse(BaseModel):
    total_records: int
    spam_records: int
    legitimate_records: int
    missing_values: int
    duplicate_records: int
    average_email_length: int
    unique_senders: int
    feature_stats: list[FeatureStat]
    rows: list[DatasetRow]
    has_data: bool


class AnalyzeEmailRequest(BaseModel):
    sender: str = "Unknown sender"
    recipients: str = ""
    subject: str
    body: str


class AiStatusResponse(BaseModel):
    online: bool
    model: str | None
    message: str


class AnalyzeEmailResponse(BaseModel):
    email: EmailRecord


class FeedbackCreate(BaseModel):
    email_id: str
    is_correct: bool = True
    correction: Literal["Safe", "Spam", "Phishing"] | None = None
    corrected_category: str | None = None
    undo: bool = False


class RegenerateReplyRequest(BaseModel):
    tone: Literal["professional", "formal", "friendly", "short"] = "professional"


class RegenerateReplyResponse(BaseModel):
    id: str
    generated_response: str | None
    reply_subject: str
    reply_tone: str
    engine: Literal["ollama", "builtin"]


class FeedbackResponse(BaseModel):
    id: str
    message: str
    is_simulated: bool = True