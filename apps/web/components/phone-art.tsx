export function PhoneArt({ colour = "#3B3B3F", className }: { colour?: string | null; className?: string }) {
  const c = colour ?? "#3B3B3F";
  return (
    <svg viewBox="0 0 120 200" className={className} aria-hidden>
      <defs>
        <linearGradient id={`g${c.slice(1)}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c} />
          <stop offset="1" stopColor={c} stopOpacity=".75" />
        </linearGradient>
      </defs>
      <rect x="14" y="6" width="92" height="188" rx="18" fill={`url(#g${c.slice(1)})`} />
      <rect x="18" y="10" width="84" height="180" rx="15" fill="none" stroke="white" strokeOpacity=".25" />
      <rect x="24" y="18" width="34" height="40" rx="10" fill="black" fillOpacity=".2" />
      <circle cx="35" cy="30" r="7" fill="#111" stroke="white" strokeOpacity=".3" />
      <circle cx="35" cy="47" r="7" fill="#111" stroke="white" strokeOpacity=".3" />
      <circle cx="49" cy="38" r="3" fill="white" fillOpacity=".6" />
    </svg>
  );
}
