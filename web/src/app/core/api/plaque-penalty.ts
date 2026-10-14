export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export interface PlaquePenaltyQuote {
  plaqueValueCentavos: number;
  plaquePenaltyPct: number;
  diasRestantes: number;
  mesesRestantes: number;
  multaCentavos: number;
}

export function toCivilDate(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const instant = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function diffCivilDays(endDate: string, startDate: string): number {
  return Math.round((utcMidnight(endDate) - utcMidnight(startDate)) / 86_400_000);
}

/**
 * mesesRestantes rounds up. The amount stays in integer cents (truncates, does not round money up).
 * multaCentavos = floor(plaqueValueCentavos × mesesRestantes × plaquePenaltyPct / 1200)
 */
export function calculatePlaquePenalty(
  plaqueFidelityEndsAt: string | null,
  today: Date,
  plaqueValueCentavos: number,
  plaquePenaltyPct: number,
): PlaquePenaltyQuote {
  if (!plaqueFidelityEndsAt) {
    return {
      plaqueValueCentavos,
      plaquePenaltyPct,
      diasRestantes: 0,
      mesesRestantes: 0,
      multaCentavos: 0,
    };
  }

  const diasRestantes = diffCivilDays(toCivilDate(plaqueFidelityEndsAt), toCivilDate(today));
  if (diasRestantes <= 0) {
    return {
      plaqueValueCentavos,
      plaquePenaltyPct,
      diasRestantes,
      mesesRestantes: 0,
      multaCentavos: 0,
    };
  }

  const mesesRestantes = Math.ceil(diasRestantes / 30);
  const multaCentavos = Math.floor(
    (plaqueValueCentavos * mesesRestantes * plaquePenaltyPct) / 1200,
  );

  return {
    plaqueValueCentavos,
    plaquePenaltyPct,
    diasRestantes,
    mesesRestantes,
    multaCentavos,
  };
}

function utcMidnight(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  return Date.UTC(year, month - 1, day);
}
