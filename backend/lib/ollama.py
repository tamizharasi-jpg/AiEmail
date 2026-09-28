"""Optional Ollama integration: the backend calls a user-supplied Ollama server
(usually an ngrok tunnel to http://localhost:11434). If it is not configured or
unreachable, callers fall back to the rule-based analysis/draft."""
import json
import os

import httpx

TIMEOUT = httpx.Timeout(connect=4.0, read=30.0, write=4.0, pool=1.0)

SYSTEM_PROMPT = """You are MailMind, an email analysis assistant. You read one email and return
a structured analysis and a suggested reply. Output ONLY valid JSON. No
markdown, no text outside the JSON.
RULES
1. Base everything on the email text. Never invent facts, names, dates,
   links, amounts or commitments. If something is missing, use a
   placeholder like [date] or [your name].
2. You receive hints from an ML classifier (category, spam probability,
   phishing signals). Treat them as evidence, not truth. If the email text
   clearly contradicts them, say so in "reason".
3. verdict is one of "safe", "suspicious", "dangerous". Any credential
   request, payment request, urgent threat, or mismatched sender domain
   means the verdict cannot be "safe".
4. If verdict is "suspicious" or "dangerous": do NOT write a friendly reply.
   Set recommended_action to "report" or "ignore" and suggested_reply.body
   to "".
5. If the email is empty, meaningless, or under 5 words, set
   "low_content": true, keep the summary short, and write a reply that asks
   the sender for more details.
6. Greeting: use the sender's first name. If unknown, use "Hi there,".
   Never write "Unknown".
7. The reply must address the sender's specific points, be under 120 words,
   match the requested tone, and end with the user's name or [your name].
8. "evidence" quotes must be exact substrings copied from the email.
OUTPUT SCHEMA
{
  "verdict": "safe|suspicious|dangerous",
  "category": "string",
  "priority": "low|medium|high",
  "reason": "one sentence explaining the verdict in plain language",
  "summary": "one sentence: what the sender wants",
  "action_items": [{"task": "string", "deadline": "string or null"}],
  "evidence": [{"quote": "exact text from email", "why": "short reason"}],
  "recommended_action": "reply|ignore|report|verify_sender",
  "recommendation_text": "specific next step for the user",
  "low_content": false,
  "suggested_reply": {"tone": "string", "subject": "string", "body": "string"}
}"""


def ollama_url() -> str:
    return os.environ.get("OLLAMA_URL", "").strip().rstrip("/")


def ollama_model() -> str:
    return os.environ.get("OLLAMA_MODEL", "llama3.2:3b").strip() or "llama3.2:3b"


def is_configured() -> bool:
    return bool(ollama_url())


async def _call(system: str, prompt: str, num_predict: int, json_mode: bool) -> str | None:
    base = ollama_url()
    if not base:
        return None
    payload: dict = {
        "model": ollama_model(),
        "system": system,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.25, "num_predict": num_predict},
    }
    if json_mode:
        payload["format"] = "json"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, trust_env=False) as client:
            response = await client.post(f"{base}/api/generate", json=payload)
            response.raise_for_status()
            return str(response.json().get("response", "")).strip() or None
    except Exception:
        return None


def _build_analysis_prompt(sender_name: str, sender_email: str, category: str, category_confidence: int,
                            spam_probability: int, phishing_signals: list[str], subject: str, body: str,
                            user_name: str, tone: str) -> str:
    signals = ", ".join(phishing_signals) if phishing_signals else "none"
    return (
        "CLASSIFIER HINTS\n"
        f"category: {category} (confidence {category_confidence}%)\n"
        f"spam_probability: {spam_probability}%\n"
        f"phishing_signals: {signals}\n\n"
        "SENDER\n"
        f"name: {sender_name or 'unknown'}\n"
        f"address: {sender_email}\n\n"
        "USER\n"
        f"name: {user_name}\n"
        f"requested_tone: {tone}\n\n"
        "EMAIL\n"
        f"Subject: {subject}\n"
        f"Body:\n{body[:6000]}\n"
    )


async def analyze_email(sender_name: str, sender_email: str, subject: str, body: str, hints: dict,
                         tone: str = "professional", user_name: str = "[your name]") -> dict | None:
    """Runs the full MailMind system prompt against the email + ML hints. Returns the
    parsed JSON dict on success, or None so the caller can fall back to the rule-based
    analysis (Ollama not configured, unreachable, or returned invalid JSON)."""
    prompt = _build_analysis_prompt(
        sender_name, sender_email, hints.get("category", "Work"), hints.get("category_confidence", 50),
        hints.get("spam_probability", 0), hints.get("phishing_indicators", []), subject, body, user_name, tone,
    )
    text = await _call(SYSTEM_PROMPT, prompt, num_predict=800, json_mode=True)
    if not text:
        return None
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict) or "verdict" not in data:
        return None
    return data


async def generate_reply(sender: str, subject: str, body: str, key_information: list[str] | None = None,
                          tone: str = "professional") -> str | None:
    """Return an LLM-written reply body in the requested tone, or None when Ollama is
    unavailable. Used to (re)generate just the reply without re-running the full analysis."""
    if not is_configured():
        return None
    facts_block = ""
    if key_information:
        facts_block = "Facts already extracted from the email (ground your reply in these, do not restate them verbatim):\n" + "\n".join(f"- {fact}" for fact in key_information) + "\n\n"
    prompt = (
        "You are drafting a reply to the email below.\n"
        f"Write only the reply body (60-110 words) in a {tone} tone.\n"
        "Address the sender by first name if one is given. Respond to the specific "
        "points raised in the email. Do not invent facts, prices or commitments. "
        "Do not add a subject line or any commentary.\n\n"
        f"{facts_block}"
        f"From: {sender or 'unknown sender'}\n"
        f"Subject: {subject}\n"
        f"Body:\n{body[:6000]}\n"
    )
    return await _call("", prompt, num_predict=220, json_mode=False)


async def check_status() -> tuple[bool, str]:
    """(online, message) for the /api/ai-status endpoint."""
    base = ollama_url()
    if not base:
        return False, "Ollama not configured — analysis uses the built-in rule engine."
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0), trust_env=False) as client:
            response = await client.get(f"{base}/api/tags")
            response.raise_for_status()
            models = [m.get("name", "") for m in response.json().get("models", [])]
    except Exception:
        return False, "Ollama server unreachable — analysis uses the built-in rule engine."
    if ollama_model() not in models:
        return False, f"Ollama is reachable but model '{ollama_model()}' is not pulled. Run: ollama pull {ollama_model()}"
    return True, f"Ollama online — analysis powered by {ollama_model()}."
