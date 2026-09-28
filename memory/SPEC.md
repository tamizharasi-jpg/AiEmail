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

**EDA dashboard (`/eda`, sidebar "EDA")**: `GET /api/eda` aggregates real stats from every stored `emails` doc (no fabricated numbers, `has_data=false` empty-state when the DB is empty): spam-vs-ham counts, avg email/subject length, length-bucket histograms, top words (stopword-filtered), URL/HTML markup frequency, special-character frequency, and category/priority distribution. Frontend page reuses existing donut/bar-list/feature-track CSS patterns from Dashboard/ModelInsights for visual consistency.

**LLM-driven analysis pipeline (major rework)**: `POST /api/analysis` now runs the full MailMind system prompt (verdict/category/priority/reason/summary/action_items/evidence/recommended_action/recommendation_text/low_content/suggested_reply) against Ollama, with the existing rule-based heuristics (category match, spam keyword score, phishing indicators) passed in as "classifier hints" per the prompt's rules. When Ollama is unset/unreachable/returns invalid JSON, `_builtin_analysis()` in `routers/mailmind.py` produces the exact same JSON shape deterministically — every email always carries an `engine: "ollama"|"builtin"` field shown as a badge, and analysis never blocks on Ollama being down. Verdict maps to `spam_status` (safe→Legitimate, suspicious→Suspicious, dangerous→Spam). Evidence quotes are validated as real substrings of the email text before being stored (rule 8 of the prompt) — never fabricated. `POST /api/emails/{id}/reply` regenerates just the reply (tone: professional/formal/friendly/short) without re-running the whole analysis.

**Email detail page (`/inbox/:id`) — single-column, sticky verdict banner**: replaced the old two-column split view with the requested section order: (1) sticky verdict banner (safe=green/suspicious=amber/dangerous=red) with reason + category/priority chips, (2) "Why we think so" evidence list, (3) "What this email wants" summary + action-item checklist with deadline chips, (4) recommended action card with verdict-specific buttons, (5) suggested reply (only when `recommended_action==="reply"`) with tone chips, regenerate + skeleton loader, copy, "Use this draft", (6) collapsed technical details (risk-colored spam/phishing bars, neutral category/model confidence bars), (7) feedback — Safe/Spam/Phishing buttons + category dropdown + "Thanks, saved" + Undo. `POST /api/feedback` now accepts `{correction: Safe|Spam|Phishing, corrected_category?, undo?}` and persists the correction (and category override) on the email doc for future retraining.

**Classification card (email detail, redesigned)**: `EmailRecord` now carries real, rule-based signals instead of a single confidence number — `phishing_score` (0-100, derived from detected indicators: suspicious URL, credential request, urgency pattern, financial request, sender/brand mismatch) and `category_confidence` (0-100, derived from keyword-match strength for the assigned category), plus `security_indicators: string[]` (the actual matched phishing indicators, shown as a dedicated "Security signals" list so phishing mail can be identified, not just labelled). The AI intelligence panel's `classification-card` shows: eyebrow "Classification" → big spam_status title, priority badge top-right, one-line description, then 3 colored progress bars (Spam probability / Phishing supporting signal / Category confidence — risk bars redden as they rise, confidence bars redden as they drop). Feedback UI was replaced: "Correct this prediction" with "Not spam"/"Spam" buttons calls `POST /api/feedback` with `{email_id, correction}`; backend computes `is_correct` against the stored `spam_status`, persists `user_correction` on the email doc, and stores the row in `feedback` for future retraining.

## Demo-data boundary
The seeded email set, overview totals, analytics, and model evaluation metrics are simulated presentation data and are labeled in the UI and API with `is_simulated=true`. No real ML model, LLM, semantic search, email provider, file upload storage, or auth integration is connected in this iteration.

## Routes
`/`, `/dashboard`, `/inbox`, `/inbox/:id`, `/analyze`, `/analytics`, `/model-insights`.
## Update — simplification pass
- No auth, no seeded demo emails: inbox/dashboard/analytics are computed from emails the user analyzes (`/api/overview`, `/api/emails`, `/api/analytics` aggregate real DB docs).
- First page `/` = minimal splash (MailMind AI + tagline + Start → /dashboard). Topbar has no user name/avatar.
- Analyze page: paste form + .eml/.txt drop (Ctrl+Enter submits). Analysis pipeline animation, explainable-AI/SHAP factor panel and model jargon removed from the user-facing flow. Model Insights keeps simulated evaluation metrics.
- Replies: `build_reply()` in backend/routers/mailmind.py drafts a rule-based reply from the sender name, subject and body intent (meeting / interview / invoice / review / question) and echoes any deadline. Suspicious/spam emails get `generated_response = null` and the UI shows a "no reply suggested" notice.

## Ollama reply engine (optional)
- `backend/lib/ollama.py` calls a user-supplied Ollama server: `POST {OLLAMA_URL}/api/generate` (stream=false, timeouts 4/24/4s) for legitimate emails; on any failure/unset URL it falls back to `build_reply()`.
- Env: `OLLAMA_URL` (tunnel root, no path — empty = disabled), `OLLAMA_MODEL` (default llama3.2:3b) in backend/.env; restart backend after changing.
- `GET /api/ai-status` reports online/model/message (checks `/api/tags` and that the model is pulled); shown as a chip on the Analyze page. `EmailRecord.reply_source` = "ollama" | "builtin" and the detail panel labels LLM-written drafts.
- Spam/suspicious emails never get a reply generated (no LLM call either).

## Removals (user request)
- Inbox page and Analytics page deleted (`/inbox` now redirects to `/dashboard`; unknown routes → `/`). EmailTable component removed. Email detail lives at `/inbox/:id`, opened from the dashboard "Recent analysis" table; its back link goes to the overview.
- Sidebar nav is now Overview / Analyze email / Model insights. Top bar keeps only the breadcrumb — global search box, notifications bell, help icon and theme toggle removed (Ctrl+K palette still works).
- First page `/` shows only the MailMind AI name and a Start button.
