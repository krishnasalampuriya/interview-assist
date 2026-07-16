type AppLogoProps = {
  subtitle: string;
};

export function AppLogo({ subtitle }: AppLogoProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="logo-mark" aria-hidden="true">
        <span className="logo-mark-dot" />
        <span className="logo-mark-text">IA</span>
      </div>
      <div className="min-w-0">
        <div className="logo-wordmark">
          <span>Interview</span>
          <span className="text-mint">Assist</span>
        </div>
        <h1 className="truncate text-sm font-semibold text-ink sm:text-base">{subtitle}</h1>
        <p className="mt-0.5 text-xs font-medium text-zinc-500">Created by Krishna Salampuriya</p>
      </div>
    </div>
  );
}
