export function colorEstado(status: number): string {
  if (status >= 200 && status < 300) return 'teal';
  if (status === 401 || status === 403) return 'orange';
  if (status >= 400) return 'red';
  return 'gray';
}
