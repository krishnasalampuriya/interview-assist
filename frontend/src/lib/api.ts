const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export type HealthResponse = {
  status: string;
  app_name: string;
  version: string;
};

export type Question = {
  id: string;
  source: {
    platform: string;
    problem_id: string;
    title_slug: string;
    url: string;
    fetched_at: string;
    acceptance_rate: number;
    paid_only: boolean;
  };
  title: string;
  difficulty: "easy" | "medium" | "hard";
  target_levels: string[];
  role_tags: string[];
  skills: string[];
  time_limit_minutes: number;
  summary: string;
  sample_test_cases: Record<string, string>[];
  expected_approach: string;
  evaluation_rubric: string[];
};

export type RecommendedQuestion = {
  question: Question;
  match_score: number;
  fit_reasons: string[];
};

export type InterviewPlan = {
  candidate_level: string | null;
  target_difficulty: "easy" | "medium" | "hard" | null;
  role_type: string | null;
  primary_skills: string[];
  secondary_skills: string[];
  avoid_topics: string[];
  coding_question_focus: string[];
  discussion_question_focus: string[];
};

export type DiscussionQuestion = {
  question: string;
  reason: string;
  signal: string;
};

export type RecommendationResponse = {
  recommendations: RecommendedQuestion[];
  extracted_signals: string[];
  interview_plan: InterviewPlan;
  discussion_questions: DiscussionQuestion[];
};

export type InterviewSession = {
  id: string;
  resume_text: string;
  job_description: string;
  preferred_difficulty: "easy" | "medium" | "hard" | null;
  interview_plan: InterviewPlan;
  extracted_signals: string[];
  discussion_questions: DiscussionQuestion[];
  recommendations: RecommendedQuestion[];
  selected_question: Question | null;
  candidate_link: string | null;
  candidate_name: string | null;
  candidate_language: string;
  candidate_code: string;
  interviewer_notes: string;
  evaluation: InterviewEvaluation | null;
  timer_duration_seconds: number | null;
  timer_started_at: string | null;
  timer_status: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type InterviewEvaluation = {
  overall_score: number;
  recommendation: string;
  summary: string;
  correctness: string;
  code_quality: string;
  problem_solving: string;
  strengths: string[];
  concerns: string[];
  follow_up_questions: string[];
  generated_by: string;
};

export type InterviewSessionResponse = {
  session: InterviewSession;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with ${response.status}`);
  }

  return response.json();
}

export async function recommendQuestions(payload: {
  resume_text: string;
  job_description: string;
  preferred_difficulty?: "easy" | "medium" | "hard";
}): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/recommendations/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Recommendation failed with ${response.status}`);
  }

  return response.json();
}

export async function createInterviewSession(payload: {
  resume_text: string;
  job_description: string;
  preferred_difficulty?: "easy" | "medium" | "hard";
}): Promise<InterviewSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/interviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Interview creation failed with ${response.status}`);
  }

  return response.json();
}

export async function fetchInterviewSession(sessionId: string): Promise<InterviewSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}`);

  if (!response.ok) {
    throw new Error(`Interview session fetch failed with ${response.status}`);
  }

  return response.json();
}

export async function selectInterviewQuestion(
  sessionId: string,
  questionId: string,
  timerDurationMinutes?: number,
): Promise<InterviewSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/select-question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question_id: questionId,
      timer_duration_minutes: timerDurationMinutes,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Question selection failed with ${response.status}`);
  }

  return response.json();
}

export async function updateCandidateProfile(
  sessionId: string,
  candidateName: string,
): Promise<InterviewSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/candidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ candidate_name: candidateName }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Candidate profile update failed with ${response.status}`);
  }

  return response.json();
}

export async function endInterviewSession(sessionId: string): Promise<InterviewSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/end`, {
    method: "POST",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Interview end failed with ${response.status}`);
  }

  return response.json();
}

export async function evaluateInterviewSession(
  sessionId: string,
  interviewerNotes: string,
): Promise<InterviewSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ interviewer_notes: interviewerNotes }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Evaluation failed with ${response.status}`);
  }

  return response.json();
}

export type LiveSessionMessage = {
  type: "session_snapshot" | "code_update" | "timer_started" | "candidate_profile_updated" | "session_ended" | "pong";
  session_id?: string;
  candidate_code?: string;
  candidate_language?: string;
  candidate_name?: string | null;
  timer_duration_seconds?: number | null;
  timer_started_at?: string | null;
  timer_remaining_seconds?: number | null;
  timer_status?: string;
  status?: string;
  updated_at?: string;
};

export function createInterviewSocket(sessionId: string, role: "candidate" | "interviewer"): WebSocket {
  return new WebSocket(`${WS_BASE_URL}/ws/interviews/${sessionId}?role=${role}`);
}
