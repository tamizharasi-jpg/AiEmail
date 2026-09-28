export type Priority = "Critical" | "High" | "Medium" | "Low" | "Informational";
export type Category = "Work" | "Finance" | "Career" | "Education" | "Personal" | "Shopping" | "Travel";
export type SpamStatus = "Legitimate" | "Spam" | "Suspicious";

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
  generated_response: string | null;
  reply_source: "ollama" | "builtin" | null;
  user_correction: "Spam" | "Not spam" | null;
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

export interface AnalyzeResponse {
  email: EmailRecord;
}
export interface AiStatusResponse {
  online: boolean;
  model: string | null;
  message: string;
}
