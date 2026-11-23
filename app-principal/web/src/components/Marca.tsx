export function Marca({
  size = 26,
  variant = 'default',
}: {
  size?: number;
  variant?: 'default' | 'light';
}) {
  const claro = variant === 'light';
  const tile = claro ? '#ffffff' : '#4a68c9';
  const caraSup = claro ? '#283593' : '#ffffff';
  const caraIzq = claro ? '#4a68c9' : 'rgba(255,255,255,0.78)';
  const caraDer = claro ? '#7b92dd' : 'rgba(255,255,255,0.56)';
  const orbita = claro ? '#283593' : '#ffffff';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="QuantumWare"
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill={tile} />
      <polygon points="16,7.2 23.2,11.3 16,15.4 8.8,11.3" fill={caraSup} />
      <polygon points="8.8,11.3 16,15.4 16,24 8.8,19.9" fill={caraIzq} />
      <polygon points="16,15.4 23.2,11.3 23.2,19.9 16,24" fill={caraDer} />
      <ellipse
        cx="16"
        cy="16.2"
        rx="12.2"
        ry="4.4"
        fill="none"
        stroke={orbita}
        strokeWidth="1.3"
        transform="rotate(-24 16 16.2)"
        opacity="0.9"
      />
      <circle cx="26.4" cy="10.9" r="1.9" fill={orbita} />
    </svg>
  );
}
