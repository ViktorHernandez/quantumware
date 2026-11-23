import { Group, Stack, Text } from '@mantine/core';

const PALETA = ['#4a68c9', '#2fb2a4', '#8a63d2', '#e8a33d', '#e0575b'];

export function Donut({
  datos,
  tamano = 150,
}: {
  datos: { etiqueta: string; valor: number }[];
  tamano?: number;
}) {
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const radio = tamano / 2 - 12;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  return (
    <Group align="center" gap="lg" wrap="nowrap">
      <svg width={tamano} height={tamano} role="img">
        <g transform={`translate(${tamano / 2}, ${tamano / 2}) rotate(-90)`}>
          <circle r={radio} fill="none" stroke="#edeff3" strokeWidth={16} />
          {total > 0 &&
            datos.map((d, i) => {
              const fraccion = d.valor / total;
              const dash = fraccion * circunferencia;
              const el = (
                <circle
                  key={d.etiqueta}
                  r={radio}
                  fill="none"
                  stroke={PALETA[i % PALETA.length]}
                  strokeWidth={16}
                  strokeDasharray={`${dash} ${circunferencia - dash}`}
                  strokeDashoffset={-acumulado}
                />
              );
              acumulado += dash;
              return el;
            })}
        </g>
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="#1f2430"
        >
          {total}
        </text>
        <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="#8a909c">
          total
        </text>
      </svg>
      <Stack gap={6}>
        {datos.length === 0 && (
          <Text size="sm" c="dimmed">
            Sin datos
          </Text>
        )}
        {datos.map((d, i) => (
          <Group key={d.etiqueta} gap={8} wrap="nowrap">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: PALETA[i % PALETA.length],
                display: 'inline-block',
              }}
            />
            <Text size="sm" tt="capitalize">
              {d.etiqueta}
            </Text>
            <Text size="sm" fw={600} c="dimmed">
              {d.valor}
            </Text>
          </Group>
        ))}
      </Stack>
    </Group>
  );
}

export function Barras({
  datos,
  alto = 120,
}: {
  datos: { etiqueta: string; valor: number }[];
  alto?: number;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const anchoBarra = 100 / Math.max(datos.length, 1);

  return (
    <div>
      <svg width="100%" height={alto} preserveAspectRatio="none" role="img">
        {datos.map((d, i) => {
          const h = (d.valor / max) * (alto - 24);
          return (
            <g key={d.etiqueta}>
              <rect
                x={`${i * anchoBarra + anchoBarra * 0.22}%`}
                y={alto - 18 - h}
                width={`${anchoBarra * 0.56}%`}
                height={Math.max(h, 2)}
                rx="3"
                fill="#4a68c9"
                opacity={d.valor === 0 ? 0.25 : 1}
              />
              <text
                x={`${i * anchoBarra + anchoBarra * 0.5}%`}
                y={alto - 4}
                textAnchor="middle"
                fontSize="10"
                fill="#8a909c"
              >
                {d.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
