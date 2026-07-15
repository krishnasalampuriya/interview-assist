import json
import re
from collections import Counter
from functools import lru_cache
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.core.config import settings
from app.models.question import Question
from app.models.recommendation import DiscussionQuestion, InterviewPlan, RecommendedQuestion
from app.services.gemini import generate_gemini_json
from app.services.question_bank import load_questions


SENIORITY_TERMS = {
    "fresher": {"fresher", "intern", "entry", "graduate", "trainee"},
    "junior": {"junior", "1 year", "2 years", "associate"},
    "mid": {"mid", "3 years", "4 years", "5 years", "experienced"},
    "senior": {"senior", "lead", "principal", "staff", "architect", "6 years", "7 years", "8 years"},
}

DIFFICULTY_BY_LEVEL = {
    "fresher": "easy",
    "junior": "easy",
    "mid": "medium",
    "senior": "hard",
}

ROLE_TERMS = {
    "backend": {"backend", "api", "apis", "fastapi", "django", "flask", "microservice", "microservices"},
    "frontend": {"frontend", "react", "angular", "vue", "javascript", "typescript", "ui"},
    "fullstack": {"fullstack", "full-stack", "frontend", "backend"},
    "data": {"data", "sql", "etl", "pipeline", "analytics", "spark"},
}

DISCUSSION_FOCUS_TERMS = {
    "production debugging": {"debug", "debugging", "incident", "production", "issue", "failure"},
    "API ownership": {"api", "apis", "rest", "fastapi", "microservice", "service"},
    "database decisions": {"sql", "database", "postgres", "mysql", "query", "schema"},
    "frontend delivery": {"react", "ui", "component", "typescript", "javascript"},
    "system design depth": {"system", "architecture", "scalable", "distributed", "design"},
    "testing practices": {"test", "testing", "pytest", "unit", "integration"},
}

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "with",
}


class RecommendationState(TypedDict, total=False):
    resume_text: str
    job_description: str
    preferred_difficulty: str | None
    token_counts: Counter[str]
    plan: InterviewPlan
    candidate_recommendations: list[RecommendedQuestion]
    recommendations: list[RecommendedQuestion]
    extracted_signals: list[str]
    discussion_questions: list[DiscussionQuestion]


def recommend_questions(
    resume_text: str,
    job_description: str,
    preferred_difficulty: str | None = None,
    limit: int = 3,
) -> tuple[list[RecommendedQuestion], list[str], InterviewPlan, list[DiscussionQuestion]]:
    result = _recommendation_graph().invoke(
        {
            "resume_text": resume_text,
            "job_description": job_description,
            "preferred_difficulty": preferred_difficulty,
        }
    )

    recommendations = result["recommendations"][:limit]
    return (
        recommendations,
        result["extracted_signals"],
        result["plan"],
        result["discussion_questions"],
    )


@lru_cache
def _recommendation_graph():
    graph = StateGraph(RecommendationState)
    graph.add_node("create_interview_plan", _create_interview_plan)
    graph.add_node("retrieve_coding_questions", _retrieve_coding_questions)
    graph.add_node("rerank_coding_questions", _rerank_coding_questions)
    graph.add_node("generate_discussion_questions", _generate_discussion_questions)

    graph.add_edge(START, "create_interview_plan")
    graph.add_edge("create_interview_plan", "retrieve_coding_questions")
    graph.add_edge("retrieve_coding_questions", "rerank_coding_questions")
    graph.add_edge("rerank_coding_questions", "generate_discussion_questions")
    graph.add_edge("generate_discussion_questions", END)

    return graph.compile()


def _create_interview_plan(state: RecommendationState) -> dict:
    combined_text = f"{state['resume_text']}\n{state['job_description']}"
    token_counts = Counter(_tokenize(combined_text))
    plan = _fallback_interview_plan(state, token_counts)

    if settings.gemini_api_key:
        try:
            plan = _create_interview_plan_with_gemini(state, plan)
        except Exception:
            pass

    return {
        "token_counts": token_counts,
        "plan": plan,
        "extracted_signals": _extract_signals(token_counts, plan),
    }


def _retrieve_coding_questions(state: RecommendationState) -> dict:
    token_counts = state["token_counts"]
    plan = state["plan"]
    scored_questions = [_score_question(question, token_counts, plan) for question in load_questions()]
    scored_questions.sort(key=lambda recommendation: recommendation.match_score, reverse=True)
    return {"candidate_recommendations": scored_questions[:10]}


def _rerank_coding_questions(state: RecommendationState) -> dict:
    if settings.gemini_api_key:
        try:
            return {"recommendations": _rerank_questions_with_gemini(state)}
        except Exception:
            pass

    return {"recommendations": state["candidate_recommendations"][:3]}


def _generate_discussion_questions(state: RecommendationState) -> dict:
    if settings.gemini_api_key:
        try:
            return {"discussion_questions": _generate_discussion_questions_with_gemini(state)}
        except Exception:
            pass

    return {"discussion_questions": _fallback_discussion_questions(state)}


def _fallback_interview_plan(state: RecommendationState, token_counts: Counter[str]) -> InterviewPlan:
    combined_text = f"{state['resume_text']}\n{state['job_description']}"
    inferred_level = _infer_seniority(combined_text)
    target_difficulty = state.get("preferred_difficulty") or DIFFICULTY_BY_LEVEL.get(inferred_level)
    role_type = _infer_role(token_counts)
    primary_skills = _extract_question_skill_matches(token_counts)[:6]
    secondary_skills = _extract_common_terms(token_counts, excluded=set(primary_skills))[:6]
    discussion_focus = _extract_discussion_focus(token_counts)

    return InterviewPlan(
        candidate_level=inferred_level,
        target_difficulty=target_difficulty,
        role_type=role_type,
        primary_skills=primary_skills,
        secondary_skills=secondary_skills,
        avoid_topics=_infer_avoid_topics(inferred_level, target_difficulty),
        coding_question_focus=_build_coding_focus(primary_skills, role_type),
        discussion_question_focus=discussion_focus,
    )


def _create_interview_plan_with_gemini(state: RecommendationState, fallback_plan: InterviewPlan) -> InterviewPlan:
    prompt = f"""
You are creating a structured coding interview search plan from a candidate resume and job description.

Return ONLY valid JSON with this exact shape:
{{
  "candidate_level": "fresher | junior | mid | senior | staff",
  "target_difficulty": "easy | medium | hard",
  "role_type": "backend | frontend | fullstack | data | mobile | devops | general",
  "primary_skills": ["..."],
  "secondary_skills": ["..."],
  "avoid_topics": ["..."],
  "coding_question_focus": ["..."],
  "discussion_question_focus": ["..."]
}}

Use the resume and JD together. Prefer practical interview fit over keyword stuffing.
If a difficulty override exists, respect it.

Difficulty override: {state.get("preferred_difficulty") or "none"}
Fallback plan hint: {fallback_plan.model_dump_json()}

Resume:
```text
{state["resume_text"]}
```

Job description:
```text
{state["job_description"]}
```
""".strip()
    payload = generate_gemini_json(prompt)

    if state.get("preferred_difficulty"):
        payload["target_difficulty"] = state["preferred_difficulty"]

    for key in ("candidate_level", "target_difficulty", "role_type"):
        if isinstance(payload.get(key), str):
            payload[key] = payload[key].strip().lower().replace("-", "")

    return InterviewPlan.model_validate(payload)


def _rerank_questions_with_gemini(state: RecommendationState) -> list[RecommendedQuestion]:
    candidates = [
        {
            "id": recommendation.question.id,
            "title": recommendation.question.title,
            "difficulty": recommendation.question.difficulty,
            "skills": recommendation.question.skills,
            "target_levels": recommendation.question.target_levels,
            "role_tags": recommendation.question.role_tags,
            "summary": recommendation.question.summary,
            "expected_approach": recommendation.question.expected_approach,
            "fallback_score": recommendation.match_score,
        }
        for recommendation in state["candidate_recommendations"]
    ]
    prompt = f"""
You are selecting the best 3 coding interview questions from retrieved candidates.

Use the interview plan, resume/JD context, and candidate question metadata. Pick questions that are appropriate for the role and candidate level, not simply the hardest question.

Return ONLY valid JSON:
{{
  "selected": [
    {{
      "id": "question id",
      "fit_reasons": ["specific reason 1", "specific reason 2", "specific reason 3"]
    }}
  ]
}}

Rules:
- Select exactly 3 ids from the candidates list.
- Reasons must explain role/candidate fit.
- Do not invent ids.

Interview plan:
{state["plan"].model_dump_json()}

Resume:
```text
{state["resume_text"]}
```

Job description:
```text
{state["job_description"]}
```

Candidates:
{json.dumps(candidates, indent=2)}
""".strip()
    payload = generate_gemini_json(prompt)
    by_id = {recommendation.question.id: recommendation for recommendation in state["candidate_recommendations"]}
    selected: list[RecommendedQuestion] = []

    for index, item in enumerate(payload.get("selected", [])):
        recommendation = by_id.get(item.get("id"))

        if recommendation is None:
            continue

        reasons = item.get("fit_reasons") or recommendation.fit_reasons
        selected.append(
            RecommendedQuestion(
                question=recommendation.question,
                match_score=round(max(recommendation.match_score, 100 - (index * 5)), 2),
                fit_reasons=[str(reason) for reason in reasons][:4],
            )
        )

    for recommendation in state["candidate_recommendations"]:
        if len(selected) == 3:
            break
        if all(existing.question.id != recommendation.question.id for existing in selected):
            selected.append(recommendation)

    return selected[:3]


def _generate_discussion_questions_with_gemini(state: RecommendationState) -> list[DiscussionQuestion]:
    prompt = f"""
You are preparing non-coding interview discussion questions from a candidate resume and job description.

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "question to ask",
      "reason": "why this is worth asking",
      "signal": "resume/JD signal"
    }}
  ]
}}

Rules:
- Generate exactly 4 questions.
- Questions must be non-coding and conversational.
- Probe project depth, ownership, production/debugging experience, architecture, and claimed skills.
- Avoid generic questions that could be asked to anyone.

Interview plan:
{state["plan"].model_dump_json()}

Resume:
```text
{state["resume_text"]}
```

Job description:
```text
{state["job_description"]}
```
""".strip()
    payload = generate_gemini_json(prompt)
    questions = payload.get("questions", [])
    return [DiscussionQuestion.model_validate(question) for question in questions[:4]]


def _fallback_discussion_questions(state: RecommendationState) -> list[DiscussionQuestion]:
    plan = state["plan"]
    role_type = plan.role_type or "the target role"
    primary_skill = plan.primary_skills[0] if plan.primary_skills else "your strongest technical skill"
    secondary_skill = plan.secondary_skills[0] if plan.secondary_skills else "recent project work"
    focus = plan.discussion_question_focus[0] if plan.discussion_question_focus else "project depth"

    questions = [
        DiscussionQuestion(
            question=f"Can you walk me through a recent project where you used {primary_skill}, and what part you personally owned?",
            reason="Checks whether the resume skill reflects hands-on ownership rather than surface familiarity.",
            signal=primary_skill,
        ),
        DiscussionQuestion(
            question=f"What was the hardest technical issue you debugged in a {role_type} project, and how did you isolate the root cause?",
            reason="Reveals practical debugging ability and production-thinking maturity.",
            signal=role_type,
        ),
        DiscussionQuestion(
            question=f"Tell me about a tradeoff you made involving {secondary_skill}. What alternatives did you reject?",
            reason="Tests design judgment and whether the candidate can reason beyond implementation.",
            signal=secondary_skill,
        ),
        DiscussionQuestion(
            question=f"If you joined this role, which part of your experience best maps to our need for {focus}?",
            reason="Connects the candidate resume directly to the JD instead of asking generic background questions.",
            signal=focus,
        ),
    ]

    return questions


def _score_question(question: Question, token_counts: Counter[str], plan: InterviewPlan) -> RecommendedQuestion:
    score = 0.0
    reasons: list[str] = []

    skill_matches = _matches(question.skills, token_counts)
    role_matches = _matches(question.role_tags, token_counts)
    title_matches = _matches([question.title], token_counts)
    summary_matches = _matches([question.summary], token_counts)
    plan_skill_matches = _case_insensitive_overlap(question.skills, plan.primary_skills + plan.coding_question_focus)

    if skill_matches:
        score += 4.0 * len(skill_matches)
        reasons.append(f"Matches resume/JD skills: {', '.join(skill_matches[:4])}.")

    if plan_skill_matches:
        score += 3.0 * len(plan_skill_matches)
        reasons.append(f"Matches interview plan focus: {', '.join(plan_skill_matches[:4])}.")

    if role_matches:
        score += 2.5 * len(role_matches)
        reasons.append(f"Matches role focus: {', '.join(role_matches[:3])}.")

    if title_matches:
        score += 1.5 * len(title_matches)

    if summary_matches:
        score += min(3.0, 0.75 * len(summary_matches))

    if plan.candidate_level and plan.candidate_level in question.target_levels:
        score += 3.0
        reasons.append(f"Fits inferred seniority: {plan.candidate_level}.")

    if plan.target_difficulty and plan.target_difficulty == question.difficulty:
        score += 3.0
        reasons.append(f"Difficulty aligns with interview plan: {question.difficulty}.")

    if plan.role_type and plan.role_type in question.role_tags:
        score += 2.0

    if not reasons:
        reasons.append("Provides a balanced coding exercise from the curated bank.")

    return RecommendedQuestion(
        question=question,
        match_score=round(score, 2),
        fit_reasons=reasons[:4],
    )


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", text.lower())
    tokens = [word for word in words if word not in STOP_WORDS and len(word) > 1]

    expanded: list[str] = []
    for token in tokens:
        expanded.append(token)
        expanded.extend(part for part in re.split(r"[-/.]", token) if len(part) > 1)

    return expanded


def _matches(values: list[str], token_counts: Counter[str]) -> list[str]:
    matches: list[str] = []
    token_set = set(token_counts)

    for value in values:
        value_tokens = set(_tokenize(value))
        if value_tokens and value_tokens.intersection(token_set):
            matches.append(value)

    return matches


def _case_insensitive_overlap(left: list[str], right: list[str]) -> list[str]:
    right_tokens = {item.lower() for item in right}
    return [item for item in left if item.lower() in right_tokens]


def _infer_seniority(text: str) -> str | None:
    normalized = text.lower()

    for level, terms in SENIORITY_TERMS.items():
        if any(term in normalized for term in terms):
            return level

    return None


def _infer_role(token_counts: Counter[str]) -> str | None:
    best_role: str | None = None
    best_score = 0

    for role, terms in ROLE_TERMS.items():
        score = sum(token_counts[term] for term in terms)
        if score > best_score:
            best_role = role
            best_score = score

    return best_role


def _extract_question_skill_matches(token_counts: Counter[str]) -> list[str]:
    skill_names = []
    for question in load_questions():
        skill_names.extend(question.skills)

    unique_skills = sorted(set(skill_names))
    return _matches(unique_skills, token_counts)


def _extract_common_terms(token_counts: Counter[str], excluded: set[str] | None = None) -> list[str]:
    excluded_lower = {item.lower() for item in excluded or set()}
    blocked = {
        "application",
        "candidate",
        "developer",
        "engineer",
        "experience",
        "fresher",
        "junior",
        "mid",
        "role",
        "senior",
        "software",
        "staff",
    }

    return [
        token
        for token, _count in token_counts.most_common(16)
        if token not in blocked and token.lower() not in excluded_lower
    ]


def _extract_discussion_focus(token_counts: Counter[str]) -> list[str]:
    focus = []

    for label, terms in DISCUSSION_FOCUS_TERMS.items():
        if any(token_counts[term] for term in terms):
            focus.append(label)

    return focus[:4] or ["project depth", "technical ownership", "debugging experience"]


def _infer_avoid_topics(candidate_level: str | None, target_difficulty: str | None) -> list[str]:
    if candidate_level in {"fresher", "junior"} or target_difficulty == "easy":
        return ["advanced dynamic programming", "complex graph algorithms"]

    return []


def _build_coding_focus(primary_skills: list[str], role_type: str | None) -> list[str]:
    focus = list(primary_skills)

    if role_type == "backend":
        focus.extend(["Hash Table", "Array", "String"])
    elif role_type == "frontend":
        focus.extend(["String", "Array"])
    elif role_type == "data":
        focus.extend(["Array", "Hash Table", "Sorting"])

    deduped = []
    for item in focus:
        if item and item not in deduped:
            deduped.append(item)

    return deduped[:8]


def _extract_signals(token_counts: Counter[str], plan: InterviewPlan) -> list[str]:
    signals = _extract_common_terms(token_counts)[:6]

    if plan.role_type:
        signals.insert(0, f"role:{plan.role_type}")

    if plan.candidate_level:
        signals.insert(0, f"seniority:{plan.candidate_level}")

    if plan.target_difficulty:
        signals.insert(0, f"difficulty:{plan.target_difficulty}")

    return signals[:8]
