export function normalizeEan(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidEan(value: string): boolean {
  const digits = normalizeEan(value);
  if (digits.length !== 8 && digits.length !== 13) return false;
  const values = [...digits].map(Number);
  const check = values.pop();
  if (check === undefined) return false;
  const sum = values.reduce((total, digit, index) => {
    const fromRight = values.length - index;
    return total + digit * (fromRight % 2 === 1 ? 3 : 1);
  }, 0);
  return (10 - (sum % 10)) % 10 === check;
}
