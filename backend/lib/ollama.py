"""Optional Ollama integration: the backend calls a user-supplied Ollama server
(usually an ngrok tunnel to http://localhost:11434). If it is not configured or
unreachable, callers fall back to the rule-based draft."""
import os

import httpx

TIMEOUT = httpx.Timeout(connect=4.0, read=24.0, write=4.0, pool=1.0)


def ollama_url() -> str:
    return os.environ.get("OLLAMA_URL", "").strip().rstrip("/")


def ollama_model() -> str:
    return os.environ.get("OLLAMA_MODEL", "llama3.2:3b").strip() or "llama3.2:3b"


def is_configured() -> bool:
    return bool(ollama_url())


async def generate_reply(sender: str, subject: str, body: str, key_information: list[str] | None = None) -> str | None:
    """Return an LLM-written reply body, or None when Ollama is unavailable."""
    base = ollama_url()
    if not base:
        return None
    facts_block = ""
    if key_information:
        facts_block = "Facts already extracted from the email (ground your reply in these, do not restate them verbatim):\n" + "\n".join(f"- {fact}" for fact in key_information) + "\n\n"
    prompt = (
        "You are drafting a reply to the email below.\n"
        "Write only the reply body (60-110 words), professional and warm.\n"
        "Address the sender by first name if one is given. Respond to the specific "
        "points raised in the email. Do not invent facts, prices or commitments. "
        "Do not add a subject line or any commentary.\n\n"
        f"{facts_block}"
        f"From: {sender or 'unknown sender'}\n"
        f"Subject: {subject}\n"
        f"Body:\n{body[:6000]}\n"
    )
    payload = {
        "model": ollama_model(),
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 220},
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, trust_env=False) as client:
            response = await client.post(f"{base}/api/generate", json=payload)
            response.raise_for_status()
            text = str(response.json().get("response", "")).strip()
    except Exception:
        return None
    return text or None


async def check_status() -> tuple[bool, str]:
    """(online, message) for the /api/ai-status endpoint."""
    base = ollama_url()
    if not base:
        return False, "Ollama not configured — replies use the built-in draft writer."
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0), trust_env=False) as client:
            response = await client.get(f"{base}/api/tags")
            response.raise_for_status()
            models = [m.get("name", "") for m in response.json().get("models", [])]
    except Exception:
        return False, "Ollama server unreachable — replies use the built-in draft writer."
    if ollama_model() not in models:
        return False, f"Ollama is reachable but model '{ollama_model()}' is not pulled. Run: ollama pull {ollama_model()}"
    return True, f"Ollama online — replies written by {ollama_model()}."
