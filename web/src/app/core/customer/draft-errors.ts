import { usesHttpApi } from '../api/feature-flags';
import { SiteContent, SiteHours } from '../models/domain';

/**
 * `allowDataImages`: `data:image/` só é aceito no modo mock (sem API HTTP); em produção
 * a foto precisa ser http(s) ou caminho do site — a API recusa outros esquemas.
 */
export function siteDraftErrors(
  content: SiteContent,
  options: { allowDataImages?: boolean } = {},
): string[] {
  const allowDataImages = options.allowDataImages ?? !usesHttpApi;
  const errors: string[] = [];
  if (!content.businessName.trim() || !content.profile.nome.trim()) {
    errors.push('Informe o nome do negócio.');
  }
  if (content.profile.uf?.trim() && !/^[A-Za-z]{2}$/.test(content.profile.uf.trim())) {
    errors.push('Informe a UF com duas letras.');
  }
  if (content.whatsapp && content.whatsapp.numero.replace(/\D/g, '').length < 10) {
    errors.push('O WhatsApp precisa ter DDD e número.');
  }
  for (const row of Array.isArray(content.hours) ? content.hours : []) {
    if (!hourComplete(row)) {
      errors.push(`Horário incompleto em ${row.dias || 'um dia'}.`);
    }
  }
  for (const item of content.gallery ?? []) {
    const url = typeof item === 'string' ? item : item?.url;
    const dataImage = allowDataImages && url?.startsWith('data:image/');
    if (url && !/^https?:\/\//i.test(url) && !/^\/(?!\/)/.test(url) && !dataImage) {
      errors.push('A foto precisa ser um endereço http ou um arquivo do site.');
    }
  }
  const colors = [content.theme?.p1, content.theme?.p2, content.theme?.p3].filter(
    (value): value is string => !!value,
  );
  if (!colors.every(hexColor)) {
    errors.push('As cores precisam estar em hexadecimal.');
  }
  return errors;
}

function hourComplete(row: SiteHours): boolean {
  if (row.fechado) {
    return true;
  }
  return /^\d{2}:\d{2}$/.test(row.abre ?? '') && /^\d{2}:\d{2}$/.test(row.fecha ?? '');
}

function hexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
