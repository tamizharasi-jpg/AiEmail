export type Priority = "Critical" | "High" | "Medium" | "Low" | "Informational";
export type Category = "Work" | "Finance" | "Career" | "Education" | "Personal" | "Shopping" | "Travel";
export type SpamStatus = "Legitimate" | "Spam" | "Suspicious";
export type Verdict = "safe" | "suspicious" | "dangerous";
export type RecommendedAction = "reply" | "ignore" | "report" | "verify_sender";

export interface ActionItem {
  task: string;
  deadline: string | null;
}

export interface EvidenceItem {
  quote: string;
  why: string;
}

export interface EmailRecord {
  id: string;
  sender: string;
  sender_email: string;
  subject: string;
  preview: string;
  body: string;
  category: Category;
  priority: Priority;
  spam_status: SpamStatus;
  spam_probability: number;
  phishing_risk: "Low" | "Medium" | "High";
  phishing_score: number;
  category_confidence: number;
  security_indicators: string[];
  confidence: number;
  date: string;
  model_version: string;
  action_required: boolean;
  intent: string;
  summary: string;
  key_information: string[];
  entities: string[];
  verdict: Verdict;
  reason: string;
  action_items: ActionItem[];
  evidence: EvidenceItem[];
  recommended_action: RecommendedAction;
  recommendation_text: string;
  low_content: boolean;
  generated_response: string | null;
  reply_subject: string;
  reply_tone: string;
  engine: "ollama" | "builtin";
  user_correction: "Safe" | "Spam" | "Phishing" | null;
  is_simulated: boolean;
  created_at: string;
}

export interface OverviewResponse {
  emails_analyzed: number;
  month_change: number;
  spam_detected: number;
  spam_rate: number;
  high_priority: number;
  action_required: number;
  phishing_risk: number;
  inbox_health: number;
  health_breakdown: string[];
  volume_trend: Array<{ label: string; value: number }>;
  priority_distribution: Array<{ label: string; value: number }>;
  category_distribution: Array<{ label: string; value: number }>;
  recent_analysis: EmailRecord[];
  is_simulated: boolean;
}

export interface EmailListResponse {
  items: EmailRecord[];
  total: number;
  page: number;
  page_size: number;
  is_simulated: boolean;
}

export interface AnalyticsResponse {
  period: "7d" | "30d" | "90d" | "all";
  volume: Array<{ label: string; analyzed: number; spam: number; priority: number }>;
  confidence_distribution: Array<{ label: string; value: number }>;
  response_rate: number;
  low_confidence: number;
  corrections: number;
  is_simulated: boolean;
}

export interface ModelMetric {
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
}

export interface ModelInsightsResponse {
  dataset_size: number;
  spam_records: number;
  legitimate_records: number;
  missing_values: number;
  duplicate_records: number;
  average_email_length: number;
  metrics: ModelMetric[];
  confusion_matrix: number[][];
  feature_importance: Array<{ label: string; value: number }>;
  pipeline: Array<{ name: string; detail: string }>;
  is_simulated: boolean;
}

export interface EdaResponse {
  total: number;
  spam_vs_ham: Array<{ label: string; value: number }>;
  average_email_length: number;
  average_subject_length: number;
  email_length_buckets: Array<{ label: string; value: number }>;
  subject_length_buckets: Array<{ label: string; value: number }>;
  top_words: Array<{ label: string; value: number }>;
  url_frequency: { with_url: number; without_url: number };
  html_frequency: { html: number; plain: number };
  character_frequency: Array<{ label: string; value: number }>;
  category_distribution: Array<{ label: string; value: number }>;
  priority_distribution: Array<{ label: string; value: number }>;
  has_data: boolean;
}

export interface AnalyzeResponse {
  email: EmailRecord;
}
export interface AiStatusResponse {
  online: boolean;
  model: string | null;
  message: string;
}

export interface RegenerateReplyResponse {
  id: string;
  generated_response: string | null;
  reply_subject: string;
  reply_tone: string;
  engine: "ollama" | "builtin";
}

export interface ThreatCell {
  key: string;
  label: string;
  spam_axis: "low" | "high";
  risk_axis: "low" | "high";
  count: number;
  description: string;
}

export interface IndicatorStat {
  label: string;
  count: number;
  explanation: string;
}

export interface SecurityResponse {
  total: number;
  legitimate: number;
  spam: number;
  suspicious: number;
  phishing_risk: number;
  needs_review: number;
  threat_matrix: ThreatCell[];
  indicators: IndicatorStat[];
  items: EmailRecord[];
  has_data: boolean;
}

export interface FeatureStat {
  name: string;
  unit: string;
  minimum: number;
  maximum: number;
  mean: number;
  median: number;
}

export interface DatasetRow {
  id: string;
  sender: string;
  subject: string;
  category: string;
  priority: string;
  label: string;
  body_length: number;
  url_count: number;
  spam_probability: number;
}

export interface DatasetResponse {
  total_records: number;
  spam_records: number;
  legitimate_records: number;
  missing_values: number;
  duplicate_records: number;
  average_email_length: number;
  unique_senders: number;
  feature_stats: FeatureStat[];
  rows: DatasetRow[];
  has_data: boolean;
}
