import { SiteWeeklyHours, WeekdayKey } from '../../core/models/domain';

export type OpenNowStatus =
  | { kind: 'open'; label: string; closesAt: string }
  | { kind: 'closed'; label: string; opensLabel: string }
  | { kind: 'unknown'; label: string };

const WEEKDAY_ORDER: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const WEEKDAY_PT: Record<WeekdayKey, string> = {
  mon: 'segunda',
  tue: 'terça',
  wed: 'quarta',
  thu: 'quinta',
  fri: 'sexta',
  sat: 'sábado',
  sun: 'domingo',
};

function partsInZone(date: Date, timeZone: string): { weekday: WeekdayKey; hm: string } {
  const weekdayRaw = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, WeekdayKey> = {
    Sun: 'sun',
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
  };
  const weekday = map[weekdayRaw] ?? 'mon';
  const hm = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return { weekday, hm };
}

function toMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((n) => Number(n));
  return (h ?? 0) * 60 + (m ?? 0);
}

function nextOpen(
  weekly: SiteWeeklyHours,
  from: WeekdayKey,
): { day: WeekdayKey; open: string } | null {
  const start = WEEKDAY_ORDER.indexOf(from);
  for (let offset = 1; offset <= 7; offset++) {
    const day = WEEKDAY_ORDER[(start + offset) % 7]!;
    const slot = weekly[day];
    if (slot?.open) {
      return { day, open: slot.open };
    }
  }
  return null;
}

export function openNowStatus(
  weekly: SiteWeeklyHours | undefined,
  timeZone = 'America/Sao_Paulo',
  now = new Date(),
): OpenNowStatus {
  if (!weekly || !Object.values(weekly).some(Boolean)) {
    return { kind: 'unknown', label: 'Consulte os horários' };
  }
  const { weekday, hm } = partsInZone(now, timeZone);
  const today = weekly[weekday];
  const nowMin = toMinutes(hm);

  if (today?.open && today.close) {
    const openMin = toMinutes(today.open);
    const closeMin = toMinutes(today.close);
    if (nowMin >= openMin && nowMin < closeMin) {
      return {
        kind: 'open',
        label: `Aberto agora · Fecha às ${today.close}`,
        closesAt: today.close,
      };
    }
  }

  if (today?.open && nowMin < toMinutes(today.open)) {
    return {
      kind: 'closed',
      label: `Fechado · Abre hoje às ${today.open}`,
      opensLabel: `hoje às ${today.open}`,
    };
  }

  const upcoming = nextOpen(weekly, weekday);
  if (!upcoming) {
    return { kind: 'closed', label: 'Fechado', opensLabel: '' };
  }
  return {
    kind: 'closed',
    label: `Fechado · Abre ${WEEKDAY_PT[upcoming.day]} às ${upcoming.open}`,
    opensLabel: `${WEEKDAY_PT[upcoming.day]} às ${upcoming.open}`,
  };
}
