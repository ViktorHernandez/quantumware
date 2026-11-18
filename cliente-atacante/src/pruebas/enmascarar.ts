export function enmascararToken(token: string | null): string | null {
  if (!token) {
    return null;
  }
  if (token.length <= 18) {
    return '***';
  }
  return `${token.slice(0, 10)}…${token.slice(-6)} [enmascarado]`;
}
