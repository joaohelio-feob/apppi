export default function Carregando() {
  return (
    <div role="status" aria-label="Carregando página" className="space-y-4">
      <p className="text-sm text-tinta/70">Carregando…</p>
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        <div className="h-8 w-48 bg-casca" />
        {[0, 1, 2].map((linha) => (
          <div key={linha} className="h-12 border-b border-linha bg-casca/50" />
        ))}
      </div>
    </div>
  );
}
