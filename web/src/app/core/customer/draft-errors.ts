import { SiteContent, SiteHours } from '../models/domain';

export function siteDraftErrors(content: SiteContent): string[] {
  const errors: string[] = [];
  if (!content.businessName.trim() || !content.profile.nome.trim()) {
    errors.push('Informe o nome do negócio.');
  }
  if (!content.profile.cidade.trim()) {
    errors.push('Informe a cidade.');
  }
  if (!/^[A-Za-z]{2}$/.test(content.profile.uf.trim())) {
    errors.push('Informe a UF com duas letras.');
  }
  if (content.whatsapp && content.whatsapp.numero.replace(/\D/g, '').length < 10) {
    errors.push('O WhatsApp precisa ter DDD e número.');
  }
  for (const row of content.hours ?? []) {
    if (!hourComplete(row)) {
      errors.push(`Horário incompleto em ${row.dias || 'um dia'}.`);
    }
  }
  for (const url of content.gallery ?? []) {
    if (url && !/^https?:\/\//.test(url) && !url.startsWith('/')) {
      errors.push('A foto precisa ser um endereço http ou um arquivo do site.');
    }
  }
  if (![content.theme.p1, content.theme.p2, content.theme.p3].every(hexColor)) {
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
