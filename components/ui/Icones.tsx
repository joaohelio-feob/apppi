import type { ReactNode } from "react";

type PropriedadesIcone = {
  className?: string;
};

function BaseIcone({
  className = "h-4 w-4",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export function IconeCaderno({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 3v18" />
      <path d="M12 8h4" />
      <path d="M12 12h4" />
    </BaseIcone>
  );
}

export function IconeSemana({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </BaseIcone>
  );
}

export function IconeQuadro({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="10" rx="1" />
      <rect x="17" y="4" width="4" height="13" rx="1" />
    </BaseIcone>
  );
}

export function IconeCalendario({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </BaseIcone>
  );
}

export function IconeEntregas({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <path d="M3 8l2-4h14l2 4H3Z" />
      <path d="M10 13h4" />
    </BaseIcone>
  );
}

export function IconeRevisoes({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M9 11l3 3L21 5" />
      <path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />
    </BaseIcone>
  );
}

export function IconeAtribuicoes({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <path d="M9 6v12" />
    </BaseIcone>
  );
}

export function IconeEquipe({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.5a4.5 4.5 0 0 1 5 4.5" />
    </BaseIcone>
  );
}

export function IconeFrentes({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="M4 12l8 4.5 8-4.5" />
      <path d="M4 16.5L12 21l8-4.5" />
    </BaseIcone>
  );
}

export function IconeCodigo({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M8 8l-4 4 4 4" />
      <path d="M16 8l4 4-4 4" />
      <path d="M13 5l-2 14" />
    </BaseIcone>
  );
}

export function IconeTrilha({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M6 8.5v7" />
      <path d="M11 6h9M11 12h9M11 18h9" />
    </BaseIcone>
  );
}

export function IconeReunioes({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M21 14a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9Z" />
    </BaseIcone>
  );
}

export function IconeSprint({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l4-4 3 2 5-6" />
    </BaseIcone>
  );
}

export function IconeLote({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </BaseIcone>
  );
}

export function IconeAjuda({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.8.8c0 1.7-2.3 2-2.3 3.7" />
      <path d="M12 17.5h.01" />
    </BaseIcone>
  );
}

export function IconeSair({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </BaseIcone>
  );
}

export function IconeMais({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M12 5v14M5 12h14" />
    </BaseIcone>
  );
}

export function IconeBusca({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </BaseIcone>
  );
}

export function IconeFiltro({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
    </BaseIcone>
  );
}

export function IconeAlerta({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M12 3L2.5 19.5h19L12 3Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17h.01" />
    </BaseIcone>
  );
}

export function IconeRelogio({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </BaseIcone>
  );
}

export function IconeCheck({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </BaseIcone>
  );
}

export function IconeGit({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M6 8.5v7" />
      <path d="M15.5 8H11a5 5 0 0 0-5 5" />
    </BaseIcone>
  );
}

export function IconeRetorno({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M9 14l-5-5 5-5" />
      <path d="M4 9h10a5 5 0 0 1 0 10h-3" />
    </BaseIcone>
  );
}

export function IconeAnexo({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3 3 0 0 1 4.2 4.2L9.8 17a1 1 0 0 1-1.4-1.4l7.8-7.8" />
    </BaseIcone>
  );
}

export function IconeSetaDireita({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </BaseIcone>
  );
}

export function IconeFechar({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </BaseIcone>
  );
}

export function IconeArquivo({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M10 13h4" />
    </BaseIcone>
  );
}

export function IconeDica({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8.5 14.5C7 13.3 6 11.5 6 9.5a6 6 0 1 1 12 0c0 2-1 3.8-2.5 5-.5.4-.8 1-.9 1.5H9.4c-.1-.5-.4-1.1-.9-1.5Z" />
    </BaseIcone>
  );
}

export function IconeLista({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </BaseIcone>
  );
}

export function IconeDownload({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </BaseIcone>
  );
}

export function IconeImpressora({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M7 8V4h10v4" />
      <rect x="4" y="8" width="16" height="8" rx="2" />
      <path d="M7 14h10v6H7v-6Z" />
    </BaseIcone>
  );
}

export function IconeUsuario({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </BaseIcone>
  );
}

export function IconeChevron({ className }: PropriedadesIcone) {
  return (
    <BaseIcone className={className}>
      <path d="M6 9l6 6 6-6" />
    </BaseIcone>
  );
}
