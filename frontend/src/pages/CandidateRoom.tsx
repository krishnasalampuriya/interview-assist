import { type FormEvent, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Clock } from "lucide-react";

import { StatusPill } from "../components/StatusPill";
import {
  createInterviewSocket,
  fetchInterviewSession,
  type InterviewSession,
  updateCandidateProfile,
} from "../lib/api";

export function CandidateRoom() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const sessionId = pathParts[pathParts.length - 1] ?? "";
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("Python");
  const [candidateName, setCandidateName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "offline">("offline");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const selectedQuestion = session?.selected_question;

  useEffect(() => {
    if (!sessionId) {
      setError("Missing interview session id.");
      setIsLoading(false);
      return;
    }

    fetchInterviewSession(sessionId)
      .then((response) => {
        setSession(response.session);
        setCode(response.session.candidate_code || defaultCode);
        setLanguage(response.session.candidate_language || "Python");
        setCandidateName(response.session.candidate_name || "");
        setRemainingSeconds(getRemainingSeconds(response.session.timer_started_at, response.session.timer_duration_seconds));
        setError(null);
      })
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setIsLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !selectedQuestion) {
      return;
    }

    setSocketStatus("connecting");
    const socket = createInterviewSocket(sessionId, "candidate");
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketStatus("connected");
      sendCodeUpdate(socket, code, language, candidateName);
    };
    socket.onclose = () => setSocketStatus("offline");
    socket.onerror = () => setSocketStatus("offline");
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "pong") {
        return;
      }

      if (message.timer_started_at || message.timer_duration_seconds || message.status || message.candidate_name) {
        setSession((currentSession) =>
          currentSession
            ? {
                ...currentSession,
                candidate_name: message.candidate_name ?? currentSession.candidate_name,
                timer_started_at: message.timer_started_at ?? currentSession.timer_started_at,
                timer_duration_seconds: message.timer_duration_seconds ?? currentSession.timer_duration_seconds,
                timer_status: message.timer_status ?? currentSession.timer_status,
                status: message.status ?? currentSession.status,
              }
            : currentSession,
        );
        setRemainingSeconds(message.timer_remaining_seconds ?? null);
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [sessionId, selectedQuestion?.id]);

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

  function handleCodeChange(nextCode: string) {
    setCode(nextCode);
    sendCodeUpdate(socketRef.current, nextCode, language, candidateName);
  }

  function handleLanguageChange(nextLanguage: string) {
    setLanguage(nextLanguage);
    sendCodeUpdate(socketRef.current, code, nextLanguage, candidateName);
  }

  async function handleCandidateNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = candidateName.trim();

    if (!trimmedName) {
      return;
    }

    setIsSavingName(true);
    setError(null);

    try {
      const response = await updateCandidateProfile(sessionId, trimmedName);
      setSession(response.session);
      sendCodeUpdate(socketRef.current, code, language, trimmedName);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save candidate name.");
    } finally {
      setIsSavingName(false);
    }
  }

  return (
    <main className="app-bg">
      <header className="topbar">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="brand-mark">IA</div>
            <div>
              <p className="text-sm font-semibold text-mint">Interview Assist</p>
              <h1 className="text-lg font-semibold sm:text-xl">Candidate coding room</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {session?.candidate_name ? <StatusPill label={session.candidate_name} tone="neutral" /> : null}
            <StatusPill label={language} tone="neutral" />
            <StatusPill label={socketStatus === "connected" ? "Live" : "Offline"} tone={socketStatus === "connected" ? "success" : "warning"} />
            <StatusPill label={remainingSeconds !== null ? formatSeconds(remainingSeconds) : "Waiting"} tone="warning" />
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="surface-card text-sm text-zinc-600">Loading interview room...</div>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">{error}</div>
        </div>
      ) : null}

      {!isLoading && !error && !selectedQuestion ? (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="surface-card">
            <h2 className="text-lg font-semibold">Waiting for interviewer</h2>
            <p className="mt-2 text-sm text-zinc-600">The interviewer has not selected a coding question yet.</p>
          </div>
        </div>
      ) : null}

      {!isLoading && !error && selectedQuestion ? (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:py-8">
        <aside className="space-y-6">
          {!session?.candidate_name ? (
            <form onSubmit={handleCandidateNameSubmit} className="surface-card">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Your name</span>
                <input
                  value={candidateName}
                  onChange={(event) => setCandidateName(event.target.value)}
                  className="input-surface"
                  placeholder="Enter your name"
                />
              </label>
              <button
                className="button-primary mt-4 w-full"
                disabled={isSavingName || candidateName.trim().length === 0}
                type="submit"
              >
                {isSavingName ? "Saving..." : "Save Name"}
              </button>
            </form>
          ) : null}

          <div className="surface-card">
            <div className="mb-4 flex items-center justify-between">
              <StatusPill label={toTitleCase(selectedQuestion.difficulty)} tone={selectedQuestion.difficulty === "hard" ? "accent" : "neutral"} />
              <span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600">
                <Clock className="h-4 w-4" />
                {selectedQuestion.time_limit_minutes} min
              </span>
            </div>
            <h2 className="text-xl font-semibold">{selectedQuestion.title}</h2>
            <p className="mt-4 text-sm leading-6 text-zinc-700">{selectedQuestion.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedQuestion.skills.map((skill) => (
                <span key={skill} className="tag">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="soft-panel">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Evaluation Focus</h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-700">
              {selectedQuestion.evaluation_rubric.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="code-panel">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#181b24] px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Solution Editor</h2>
              <p className="text-xs text-zinc-400">{session.status === "ended" ? "Interview ended" : "Changes are shared live"}</p>
            </div>
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              className="rounded-md border border-zinc-700 bg-[#11131a] px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-mint"
            >
              <option>Python</option>
              <option>C++</option>
              <option>Pseudocode</option>
            </select>
          </div>

          <div className="h-[520px] overflow-hidden bg-[#15171f]">
            <Editor
              height="520px"
              language={toMonacoLanguage(language)}
              theme="vs-dark"
              value={code}
              onChange={(value) => handleCodeChange(value ?? "")}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                readOnly: session.status === "ended" || session.status === "evaluated",
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
            />
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 bg-[#181b24] px-5 py-4 text-sm text-zinc-300">
            <span>{session.status === "ended" ? "The interviewer ended this interview." : "Your code is visible to the interviewer live."}</span>
            <StatusPill label={session.status} tone="neutral" />
          </div>
        </section>
      </section>
      ) : null}
    </main>
  );
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const defaultCode = `# Start your solution here\n`;

function sendCodeUpdate(socket: WebSocket | null, code: string, language: string, candidateName?: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "code_update",
      code,
      language,
      candidate_name: candidateName?.trim() || undefined,
    }),
  );
}

function toMonacoLanguage(language: string) {
  if (language === "C++") {
    return "cpp";
  }

  if (language === "Pseudocode") {
    return "plaintext";
  }

  return "python";
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
