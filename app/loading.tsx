export default function Carregando() {
  return (
    <div role="status" aria-label="Carregando página" className="space-y-5">
      <div className="cartao p-6 motion-safe:animate-pulse">
        <div className="h-4 w-28 rounded-full bg-casca" />
        <div className="mt-3 h-8 w-64 rounded-lg bg-casca" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-casca/70" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 motion-safe:animate-pulse">
        {[0, 1, 2, 3].map((cartao) => (
          <div key={cartao} className="cartao h-24 bg-papel/80 p-4">
            <div className="h-3 w-20 rounded bg-casca" />
            <div className="mt-3 h-7 w-12 rounded bg-casca" />
          </div>
        ))}
      </div>
      <div className="cartao space-y-3 p-5 motion-safe:animate-pulse">
        {[0, 1, 2].map((linha) => (
          <div
            key={linha}
            className="h-12 rounded-lg border border-linha/50 bg-casca/50"
          />
        ))}
      </div>
    </div>
  );
}
