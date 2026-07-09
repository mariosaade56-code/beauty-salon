// Single-line butterfly matching the Divine Skin logo mark
export default function Butterfly({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* left wing — big loop */}
      <path d="M30 34 C 20 30, 8 26, 6 16 C 5 10, 10 7, 15 10 C 22 14, 27 24, 30 32" />
      {/* left wing — inner loop */}
      <path d="M29 33 C 23 31, 15 29, 13 23 C 12 19, 16 18, 19 21 C 23 24, 27 29, 29 32" />
      {/* right wing sweep */}
      <path d="M31 33 C 34 24, 39 13, 46 9 C 51 6.5, 55 10, 52 15 C 48 22, 38 29, 32 33" />
      {/* antennae */}
      <path d="M31 32 C 33 27, 36 22, 41 19" />
      {/* trailing flourish */}
      <path d="M30 34 C 26 39, 20 43, 12 44" />
    </svg>
  );
}
