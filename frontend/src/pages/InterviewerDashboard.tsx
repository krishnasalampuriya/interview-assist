import { useEffect, useState } from "react";
import { ArrowRight, Copy, ExternalLink, FileUp, Sparkles, Timer } from "lucide-react";

import { AppLogo } from "../components/AppLogo";
import { CreatorNote } from "../components/CreatorNote";
import { StatusPill } from "../components/StatusPill";
import {
  createInterviewSession,
  createInterviewSocket,
  endInterviewSession,
  evaluateInterviewSession,
  extractDocumentText,
  fetchHealth,
  type DiscussionQuestion,
  type HealthResponse,
  type InterviewPlan,
  type InterviewSession,
  type LiveSessionMessage,
  type RecommendedQuestion,
  selectInterviewQuestion,
} from "../lib/api";

export function InterviewerDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [jdFileName, setJdFileName] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<"resume" | "jd" | null>(null);
  const [preferredDifficulty, setPreferredDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [recommendations, setRecommendations] = useState<RecommendedQuestion[]>([]);
  const [interviewPlan, setInterviewPlan] = useState<InterviewPlan | null>(null);
  const [discussionQuestions, setDiscussionQuestions] = useState<DiscussionQuestion[]>([]);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectingQuestionId, setSelectingQuestionId] = useState<string | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [interviewerNotes, setInterviewerNotes] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [didCopyLink, setDidCopyLink] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "offline">("offline");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((error: Error) => setHealthError(error.message));
  }, []);

  useEffect(() => {
    if (!session?.id || !session.selected_question) {
      return;
    }

    setSocketStatus("connecting");
    const socket = createInterviewSocket(session.id, "interviewer");

    socket.onopen = () => setSocketStatus("connected");
    socket.onclose = () => setSocketStatus("offline");
    socket.onerror = () => setSocketStatus("offline");
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as LiveSessionMessage;

      if (message.type === "pong") {
        return;
      }

      setSession((currentSession) => {
        if (!currentSession) {
          return currentSession;
        }

        return {
          ...currentSession,
          candidate_code: message.candidate_code ?? currentSession.candidate_code,
          candidate_language: message.candidate_language ?? currentSession.candidate_language,
          candidate_name: message.candidate_name ?? currentSession.candidate_name,
          timer_duration_seconds: message.timer_duration_seconds ?? currentSession.timer_duration_seconds,
          timer_started_at: message.timer_started_at ?? currentSession.timer_started_at,
          timer_status: message.timer_status ?? currentSession.timer_status,
          status: message.status ?? currentSession.status,
          updated_at: message.updated_at ?? currentSession.updated_at,
        };
      });

      if (message.timer_remaining_seconds !== undefined) {
        setRemainingSeconds(message.timer_remaining_seconds);
      }
    };

    return () => socket.close();
  }, [session?.id, session?.selected_question?.id]);

  useEffect(() => {
    if (!session?.timer_started_at || !session.timer_duration_seconds) {
      setRemainingSeconds(session?.timer_duration_seconds ?? null);
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(session.timer_started_at, session.timer_duration_seconds));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [session?.timer_started_at, session?.timer_duration_seconds]);

  async function handleGenerateQuestions() {
    setIsGenerating(true);
    setRecommendationError(null);

    try {
      const response = await createInterviewSession({
        resume_text: resumeText,
        job_description: jobDescription,
        preferred_difficulty: preferredDifficulty || undefined,
      });
      const createdSession = response.session;

      setSession(createdSession);
      setRecommendations(createdSession.recommendations);
      setInterviewPlan(createdSession.interview_plan);
      setDiscussionQuestions(createdSession.discussion_questions);
      setTimerMinutes(createdSession.recommendations[0]?.question.time_limit_minutes ?? 30);
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "Unable to generate recommendations.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSelectQuestion(questionId: string) {
    if (!session) {
      return;
    }

    setSelectingQuestionId(questionId);
    setRecommendationError(null);

    try {
      const selectedTimerMinutes = clampTimerMinutes(timerMinutes);
      setTimerMinutes(selectedTimerMinutes);
      const response = await selectInterviewQuestion(session.id, questionId, selectedTimerMinutes);
      setSession(response.session);
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "Unable to select question.");
    } finally {
      setSelectingQuestionId(null);
    }
  }

  async function handleEvaluate() {
    if (!session) {
      return;
    }

    setIsEvaluating(true);
    setRecommendationError(null);

    try {
      const response = await evaluateInterviewSession(session.id, interviewerNotes);
      setSession(response.session);
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "Unable to generate evaluation.");
    } finally {
      setIsEvaluating(false);
    }
  }

  async function handleEndInterview() {
    if (!session) {
      return;
    }

    setIsEndingInterview(true);
    setRecommendationError(null);

    try {
      const response = await endInterviewSession(session.id);
      setSession(response.session);
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "Unable to end interview.");
    } finally {
      setIsEndingInterview(false);
    }
  }

  async function handleCopyCandidateLink() {
    if (!session?.candidate_link) {
      return;
    }

    await navigator.clipboard.writeText(session.candidate_link);
    setDidCopyLink(true);
    window.setTimeout(() => setDidCopyLink(false), 1600);
  }

  async function handleDocumentUpload(field: "resume" | "jd", file: File | null) {
    if (!file) {
      return;
    }

    setUploadingField(field);
    setRecommendationError(null);

    try {
      const extracted = await extractDocumentText(file);

      if (field === "resume") {
        setResumeText(extracted.text);
        setResumeFileName(extracted.filename);
      } else {
        setJobDescription(extracted.text);
        setJdFileName(extracted.filename);
      }
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "Unable to extract text from uploaded file.");
    } finally {
      setUploadingField(null);
    }
  }

  const canGenerate = resumeText.trim().length >= 20 && jobDescription.trim().length >= 20 && !isGenerating;

  return (
    <main className="app-bg">
      <header className="topbar">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <AppLogo subtitle="AI-powered live coding interview workspace" />
          <StatusPill
            label={health ? `${health.app_name} online` : healthError ? "API offline" : "Checking API"}
            tone={health ? "success" : healthError ? "warning" : "neutral"}
          />
        </div>
      </header>

      <section className="page-grid">
        <div className="space-y-6">
          <div className="surface-card">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create Interview</h2>
                <p className="mt-1 text-sm text-zinc-600">Paste resume and JD text to recommend a role-fit coding round.</p>
              </div>
              <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-2 text-plum">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium">Candidate resume text</span>
                  <UploadControl
                    id="resume-upload"
                    label={uploadingField === "resume" ? "Extracting..." : "Upload Resume"}
                    disabled={uploadingField !== null}
                    fileName={resumeFileName}
                    onFileSelect={(file) => handleDocumentUpload("resume", file)}
                  />
                </div>
                <textarea
                  value={resumeText}
                  onChange={(event) => setResumeText(event.target.value)}
                  className="input-surface min-h-44 resize-y p-4"
                  placeholder="Upload resume or paste the text from resume directly here..."
                />
              </label>

              <label className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium">Job description</span>
                  <UploadControl
                    id="jd-upload"
                    label={uploadingField === "jd" ? "Extracting..." : "Upload JD"}
                    disabled={uploadingField !== null}
                    fileName={jdFileName}
                    onFileSelect={(file) => handleDocumentUpload("jd", file)}
                  />
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  className="input-surface min-h-36 resize-y p-4"
                  placeholder="Upload JD or paste the text from JD directly here..."
                />
              </label>

              <label className="grid gap-2 md:max-w-64">
                <span className="text-sm font-medium">Preferred question level</span>
                <select
                  value={preferredDifficulty}
                  onChange={(event) => setPreferredDifficulty(event.target.value as "" | "easy" | "medium" | "hard")}
                  className="input-surface"
                >
                  <option value="">Let AI decide</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>

              {recommendationError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {recommendationError}
                </div>
              ) : null}

              <button
                className="button-primary py-3"
                disabled={!canGenerate}
                onClick={handleGenerateQuestions}
              >
                {isGenerating ? "Preparing interview..." : "Start Interview Process"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {recommendations.length === 0 ? (
              <div className="empty-state md:col-span-3">
                Recommendations will appear here after you paste resume and JD text.
              </div>
            ) : null}

            {recommendations.map((recommendation) => (
              <article key={recommendation.question.id} className="question-card">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <StatusPill
                    label={toTitleCase(recommendation.question.difficulty)}
                    tone={recommendation.question.difficulty === "hard" ? "accent" : "neutral"}
                  />
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                    <Timer className="h-3.5 w-3.5" />
                    {recommendation.question.time_limit_minutes} min
                  </span>
                </div>
                <h3 className="text-sm font-semibold leading-5">{recommendation.question.title}</h3>
                <p className="mt-3 text-xs leading-5 text-zinc-600">{recommendation.question.summary}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {recommendation.question.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="tag">
                      {skill}
                    </span>
                  ))}
                </div>
                <ul className="mt-4 space-y-2 text-xs leading-5 text-zinc-600">
                  {recommendation.fit_reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-xs font-semibold text-zinc-500">Score {recommendation.match_score}</span>
                  <div className="flex items-center gap-3">
                    <a
                      className="inline-flex items-center gap-1 text-xs font-semibold text-mint hover:text-teal-900"
                      href={recommendation.question.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:bg-zinc-400"
                      disabled={!session || selectingQuestionId !== null}
                      onClick={() => handleSelectQuestion(recommendation.question.id)}
                    >
                      {session?.selected_question?.id === recommendation.question.id
                        ? "Selected"
                        : selectingQuestionId === recommendation.question.id
                          ? "Selecting..."
                          : "Select"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {discussionQuestions.length > 0 ? (
            <section className="surface-card">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Resume Discussion Questions</h2>
                  <p className="mt-1 text-sm text-zinc-600">Use these before the coding round to probe resume depth.</p>
                </div>
                <StatusPill label={`${discussionQuestions.length} prompts`} tone="success" />
              </div>
              <div className="grid gap-3">
                {discussionQuestions.map((item) => (
                  <article key={item.question} className="rounded-md border border-line/70 bg-white/75 p-4 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusPill label={item.signal} tone="neutral" />
                    </div>
                    <h3 className="text-sm font-semibold leading-6">{item.question}</h3>
                    <p className="mt-2 text-xs leading-5 text-zinc-600">{item.reason}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {interviewPlan ? (
            <div className="surface-card">
              <h2 className="text-lg font-semibold">Interview Plan</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <PlanRow label="Level" value={interviewPlan.candidate_level ?? "Auto"} />
                <PlanRow label="Difficulty" value={interviewPlan.target_difficulty ?? "Auto"} />
                <PlanRow label="Role" value={interviewPlan.role_type ?? "General"} />
              </div>
              <div className="mt-5 space-y-4">
                <PlanTags label="Coding focus" values={interviewPlan.coding_question_focus} />
                <PlanTags label="Discussion focus" values={interviewPlan.discussion_question_focus} />
              </div>
            </div>
          ) : null}

          {recommendations.length > 0 ? (
            <div className="surface-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Timer</h2>
                  <p className="mt-1 text-sm text-zinc-600">Set before selecting the question.</p>
                </div>
                <Timer className="h-5 w-5 text-mint" />
              </div>
              <label className="mt-4 grid gap-2">
                <span className="text-sm font-semibold">Interview duration</span>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={timerMinutes}
                  onChange={(event) => setTimerMinutes(Number(event.target.value))}
                  onBlur={() => setTimerMinutes(clampTimerMinutes(timerMinutes))}
                  className="input-surface"
                />
              </label>
            </div>
          ) : null}

          {session?.candidate_link ? (
            <div className="rounded-lg border border-teal-200/80 bg-[linear-gradient(135deg,#ecfdf5_0%,#f0fdfa_100%)] p-6 shadow-[0_18px_45px_rgba(15,118,110,0.12)]">
              <h2 className="text-lg font-semibold text-teal-950">Candidate Link Ready</h2>
              <p className="mt-2 text-sm text-teal-800">Share this link after confirming the question and timer with the candidate.</p>
              <code className="link-box">
                {session.candidate_link}
              </code>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  className="button-mint"
                  onClick={handleCopyCandidateLink}
                >
                  <Copy className="h-4 w-4" />
                  {didCopyLink ? "Copied" : "Copy Link"}
                </button>
                <a
                  className="button-secondary border-teal-200 text-teal-950 hover:bg-teal-50"
                  href={session.candidate_link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Candidate Room
                </a>
              </div>
            </div>
          ) : null}

          {session?.selected_question ? (
            <div className="surface-card">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Live Candidate Workspace</h2>
                  <p className="mt-1 text-sm text-zinc-600">{session.selected_question.title}</p>
                </div>
                <StatusPill label={socketStatus === "connected" ? "Live" : "Offline"} tone={socketStatus === "connected" ? "success" : "warning"} />
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusPill label={session.candidate_name || "Candidate pending"} tone="neutral" />
                <StatusPill label={session.candidate_language || "Python"} tone="neutral" />
                <StatusPill label={session.status} tone="neutral" />
                <StatusPill label={remainingSeconds !== null ? formatSeconds(remainingSeconds) : "Timer waiting"} tone="warning" />
              </div>
              <pre className="code-panel max-h-[360px] min-h-48 p-4 text-xs leading-5 text-zinc-100">{session.candidate_code || "Waiting for candidate to start typing..."}</pre>
              <label className="mt-5 grid gap-2">
                <span className="text-sm font-semibold">Interviewer notes</span>
                <textarea
                  value={interviewerNotes}
                  onChange={(event) => setInterviewerNotes(event.target.value)}
                  className="input-surface min-h-28 resize-y p-3"
                  placeholder="Add observations about communication, hints, debugging, and edge cases..."
                />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  className="button-secondary"
                  disabled={isEndingInterview || session.status === "ended" || session.status === "evaluated"}
                  onClick={handleEndInterview}
                >
                  {isEndingInterview ? "Ending..." : "End Interview"}
                </button>
                <button
                  className="button-primary"
                  disabled={isEvaluating}
                  onClick={handleEvaluate}
                >
                  {isEvaluating ? "Generating Report..." : "Generate Final Report"}
                </button>
              </div>
            </div>
          ) : null}

          {session?.evaluation ? (
            <div className="surface-card">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Final Evaluation</h2>
                  <p className="mt-1 text-sm text-zinc-600">{session.evaluation.generated_by}</p>
                </div>
                <div className="rounded-md bg-ink px-4 py-3 text-center text-white shadow-[0_12px_28px_rgba(21,23,31,0.20)]">
                  <div className="text-xl font-semibold">{session.evaluation.overall_score}</div>
                  <div className="text-[11px] uppercase tracking-wide">Score</div>
                </div>
              </div>
              <StatusPill label={session.evaluation.recommendation} tone={session.evaluation.overall_score >= 70 ? "success" : "warning"} />
              <p className="mt-4 text-sm leading-6 text-zinc-700">{session.evaluation.summary}</p>
              <EvaluationBlock title="Correctness" text={session.evaluation.correctness} />
              <EvaluationBlock title="Code Quality" text={session.evaluation.code_quality} />
              <EvaluationBlock title="Problem Solving" text={session.evaluation.problem_solving} />
              <EvaluationList title="Strengths" items={session.evaluation.strengths} />
              <EvaluationList title="Concerns" items={session.evaluation.concerns} />
              <EvaluationList title="Follow-up Questions" items={session.evaluation.follow_up_questions} />
            </div>
          ) : null}

        </aside>
      </section>
      <CreatorNote />
    </main>
  );
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clampTimerMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return 30;
  }

  return Math.min(180, Math.max(5, Math.round(value)));
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2 last:border-b-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold capitalize">{value}</span>
    </div>
  );
}

function PlanTags({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</h3>
      <div className="flex flex-wrap gap-1.5">
        {(values.length > 0 ? values : ["Auto"]).map((value) => (
          <span key={value} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function UploadControl({
  id,
  label,
  disabled,
  fileName,
  onFileSelect,
}: {
  id: string;
  label: string;
  disabled: boolean;
  fileName: string | null;
  onFileSelect: (file: File | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {fileName ? <span className="max-w-48 truncate text-xs font-medium text-zinc-500">{fileName}</span> : null}
      <input
        id={id}
        type="file"
        accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.rtf,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onFileSelect(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:bg-zinc-100 aria-disabled:text-zinc-400"
        aria-disabled={disabled}
      >
        <FileUp className="h-3.5 w-3.5" />
        {label}
      </label>
    </div>
  );
}

function EvaluationBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{text}</p>
    </div>
  );
}

function EvaluationList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function getRemainingSeconds(startedAt: string | null, durationSeconds: number | null): number | null {
  if (!durationSeconds) {
    return null;
  }

  if (!startedAt) {
    return durationSeconds;
  }

  const startedMs = new Date(startedAt).getTime();
  const elapsedSeconds = Math.floor((Date.now() - startedMs) / 1000);
  return Math.max(durationSeconds - elapsedSeconds, 0);
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
