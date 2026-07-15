import { CandidateRoom } from "./pages/CandidateRoom";
import { InterviewerDashboard } from "./pages/InterviewerDashboard";

export default function App() {
  const path = window.location.pathname;

  if (path.startsWith("/candidate/")) {
    return <CandidateRoom />;
  }

  return <InterviewerDashboard />;
}
