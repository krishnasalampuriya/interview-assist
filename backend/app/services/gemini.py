import json
import re

import httpx

from app.core.config import settings


GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"


def generate_gemini_text(prompt: str, timeout_seconds: int = 45) -> str:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(
            GEMINI_INTERACTIONS_URL,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": settings.gemini_api_key,
            },
            json={
                "model": settings.gemini_model,
                "input": prompt,
            },
        )
        response.raise_for_status()

    return extract_interaction_text(response.json())


def generate_gemini_json(prompt: str, timeout_seconds: int = 45) -> dict:
    return extract_json_object(generate_gemini_text(prompt, timeout_seconds=timeout_seconds))


def extract_interaction_text(payload: dict) -> str:
    if payload.get("output_text"):
        return payload["output_text"]

    text_blocks: list[str] = []
    for step in payload.get("steps", []):
        if step.get("type") != "model_output":
            continue

        for content in step.get("content", []):
            if content.get("type") == "text" and content.get("text"):
                text_blocks.append(content["text"])

    return "\n".join(text_blocks)


def extract_json_object(text: str) -> dict:
    cleaned = text.strip()

    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned)
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))
