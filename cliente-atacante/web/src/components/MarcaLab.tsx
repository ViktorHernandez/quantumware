export function MarcaLab({
  size = 26,
  variant = 'default',
}: {
  size?: number;
  variant?: 'default' | 'outline';
}) {
  const conTile = variant === 'default';
  const trazo = conTile ? '#ffffff' : '#e24f57';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="QuantumWare Laboratorio"
    >
      {conTile && (
        <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#c31a26" />
      )}
      <circle
        cx="16"
        cy="16"
        r="8.6"
        fill="none"
        stroke={trazo}
        strokeWidth="1.7"
      />
      <path
        d="M16 4.5v4.2M16 23.3v4.2M4.5 16h4.2M23.3 16h4.2"
        stroke={trazo}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M10.6 16h2.6l1.4-3.2 2.4 6.4 1.6-3.2h2.8"
        fill="none"
        stroke={trazo}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="1.6" fill={trazo} />
    </svg>
  );
}
