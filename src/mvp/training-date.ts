const DAY_MS = 86_400_000;

export function parseLocalDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('La fecha local no es válida.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (formatLocalDate(date) !== value) throw new Error('La fecha local no existe.');
  return date;
}

export function formatLocalDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function addLocalDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  return formatLocalDate(new Date(date.getTime() + days * DAY_MS));
}

export function mondayOfLocalWeek(value: string): string {
  const date = parseLocalDate(value);
  const weekday = date.getUTCDay() || 7;
  return addLocalDays(value, 1 - weekday);
}

export function goalEffectiveMonday(
  today: string,
  choice: 'current' | 'next',
): string {
  const current = mondayOfLocalWeek(today);
  return choice === 'current' ? current : addLocalDays(current, 7);
}

export function monthKey(value: string): string {
  parseLocalDate(`${value}-01`);
  return value;
}

export function moveMonth(value: string, delta: number): string {
  monthKey(value);
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + delta, 1));
  return formatLocalDate(date).slice(0, 7);
}

export interface CalendarDay {
  localDate: string;
  inMonth: boolean;
  dayNumber: number;
}

export function calendarMonth(value: string): CalendarDay[] {
  const first = `${monthKey(value)}-01`;
  const start = mondayOfLocalWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const localDate = addLocalDays(start, index);
    return {
      localDate,
      inMonth: localDate.startsWith(value),
      dayNumber: Number(localDate.slice(-2)),
    };
  });
}

export function madridToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
}
