# MailMind AI living spec

## Product
Desktop-first MailMind AI demo: a premium dark AI email intelligence and data science platform. The first screen is a minimal landing page with the product name and a Start button; there is no authentication or login flow.

## Working flows
- Start from `/` into `/dashboard`.
- Dashboard reads `/api/overview` and presents simulated demo analytics, KPI drilldowns, health score, priority/category breakdowns, and recent analysis.
- Inbox reads `/api/emails` with search and filters. Selecting an email opens `/inbox/:id` with email content, AI intelligence, confidence, influencing factors, and a response draft.
- Analyze reads `/api/analysis` and stores a new simulated analysis in MongoDB. Paste sender, subject, and body; the processing timeline and result are shown in the same flow.
- Analytics reads `/api/analytics`; Model Insights reads `/api/model-insights`.
- Feedback posts to `/api/feedback`.

## Data model
Mongo collections: `emails` (string UUID/id, content, category, priority, spam/phishing classification, confidence, explanation factors, `is_simulated=true`), and `feedback`.

## Demo-data boundary
The seeded email set, overview totals, analytics, and model evaluation metrics are simulated presentation data and are labeled in the UI and API with `is_simulated=true`. No real ML model, LLM, semantic search, email provider, file upload storage, or auth integration is connected in this iteration.

## Routes
`/`, `/dashboard`, `/inbox`, `/inbox/:id`, `/analyze`, `/analytics`, `/model-insights`.
## Update — simplification pass
- No auth, no seeded demo emails: inbox/dashboard/analytics are computed from emails the user analyzes (`/api/overview`, `/api/emails`, `/api/analytics` aggregate real DB docs).
- First page `/` = minimal splash (MailMind AI + tagline + Start → /dashboard). Topbar has no user name/avatar.
- Analyze page: paste form + .eml/.txt drop (Ctrl+Enter submits). Analysis pipeline animation, explainable-AI/SHAP factor panel and model jargon removed from the user-facing flow. Model Insights keeps simulated evaluation metrics.
- Replies: `build_reply()` in backend/routers/mailmind.py drafts a rule-based reply from the sender name, subject and body intent (meeting / interview / invoice / review / question) and echoes any deadline. Suspicious/spam emails get `generated_response = null` and the UI shows a "no reply suggested" notice.
