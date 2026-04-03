export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="py-16">
      <div className="text-center p-8 rounded-xl bg-surface">
        <h3 className="text-warning text-base mb-1">
          We couldn&apos;t finish this section
        </h3>
        <p className="text-text-muted text-sm">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 border border-border rounded-lg text-accent text-sm hover:border-accent transition-colors"
        >
          Retry &rarr;
        </button>
      </div>
    </div>
  );
}
