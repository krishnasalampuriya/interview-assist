import { Github } from "lucide-react";

export function CreatorNote() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
      <div className="rounded-lg border border-white/70 bg-white/[0.72] px-4 py-3 text-sm text-zinc-600 shadow-sm backdrop-blur">
        <span className="font-semibold text-ink">Created by Krishna Salampuriya.</span>{" "}
        <span>If you liked the app, please like the LinkedIn post.</span>{" "}
        <a
          className="inline-flex items-center gap-1 font-semibold text-mint hover:text-teal-900"
          href="https://github.com/krishnasalampuriya/interview-assist"
          target="_blank"
          rel="noreferrer"
        >
          Source code is available on GitHub
          <Github className="h-3.5 w-3.5" />
        </a>
        .
      </div>
    </div>
  );
}
