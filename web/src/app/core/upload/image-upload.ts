import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

import { API_PORT, CustomerUploadPresign } from '../api/api-port';

/** Mesmo limite e tipos da API (api/src/reseller/sites/upload.service.ts). */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Quem pede o presign: admin, revendedor ou cliente (Estúdio). */
export type UploadScope = 'admin' | 'reseller' | 'customer';

/** square = foto de perfil (crop central 1:1); cover = capa 16:9; photo = galeria/catálogo. */
export type ImageKind = 'square' | 'cover' | 'photo';

const TARGET: Record<ImageKind, { w: number; h: number | null }> = {
  square: { w: 512, h: 512 },
  cover: { w: 1280, h: 720 },
  photo: { w: 1200, h: null },
};

export function validateImageFile(file: File): void {
  if (!UPLOAD_ALLOWED_TYPES.has(file.type)) {
    throw new Error('Formato inválido. Use foto JPEG, PNG ou WebP.');
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new Error('Arquivo muito grande. O tamanho máximo é 5 MB.');
  }
  if (file.size === 0) {
    throw new Error('Arquivo vazio.');
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/**
 * Recorte central + redução no navegador (canvas). Capa → 16:9, perfil → quadrado.
 * Se algo falhar, devolve o arquivo original (já validado).
 */
export async function processImage(file: File, kind: ImageKind): Promise<Blob> {
  try {
    const img = await loadImage(file);
    const target = TARGET[kind];
    const ratio = target.h ? target.w / target.h : img.naturalWidth / img.naturalHeight;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (sw / sh > ratio) {
      sw = Math.round(sh * ratio);
    } else {
      sh = Math.round(sw / ratio);
    }
    const sx = Math.round((img.naturalWidth - sw) / 2);
    const sy = Math.round((img.naturalHeight - sh) / 2);
    const outW = Math.min(target.w, sw);
    const outH = Math.round(outW / ratio);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const blob =
      (await canvasToBlob(canvas, 'image/webp', 0.85)) ??
      (await canvasToBlob(canvas, 'image/jpeg', 0.85));
    if (!blob || !UPLOAD_ALLOWED_TYPES.has(blob.type) || blob.size > UPLOAD_MAX_BYTES) {
      return file;
    }
    return blob;
  } catch {
    return file;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.readAsDataURL(blob);
  });
}

function apiMessage(error: unknown): string | null {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 503) {
      return 'Upload de fotos indisponível no momento. Cole o link da imagem.';
    }
    const body = error.error as { message?: string } | null;
    return body?.message ?? null;
  }
  const body = (error as { error?: { message?: string } } | null)?.error;
  return body?.message ?? null;
}

/**
 * Upload de imagem do biosite: valida (tipo/tamanho), recorta, pede presign
 * no endpoint do papel e envia direto ao storage (fetch, sem o interceptor de auth).
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly api = inject(API_PORT);
  private readonly platformId = inject(PLATFORM_ID);

  async upload(file: File, scope: UploadScope, kind: ImageKind): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Upload disponível só no navegador.');
    }
    validateImageFile(file);
    const blob = await processImage(file, kind);
    const contentType = blob.type || file.type;
    const ext = contentType === 'image/webp' ? 'webp' : contentType === 'image/png' ? 'png' : 'jpg';
    const body = {
      contentType,
      contentLength: blob.size,
      filename: `${kind}-${Date.now()}.${ext}`,
    };
    let presign: CustomerUploadPresign;
    try {
      presign = await firstValueFrom(this.presign(scope, body));
    } catch (error) {
      throw new Error(apiMessage(error) ?? 'Não foi possível preparar o upload.');
    }
    // Mock local (sem storage): devolve data URL da imagem já reduzida.
    if (presign.uploadUrl.includes('.example.local')) {
      return blobToDataUrl(blob);
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(presign.fields ?? {})) {
      form.append(key, value);
    }
    form.append('file', blob, body.filename);
    let ok = false;
    try {
      const response = await fetch(presign.uploadUrl, { method: 'POST', body: form });
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      throw new Error('Falha ao enviar a foto. Tente de novo.');
    }
    return presign.publicUrl;
  }

  private presign(
    scope: UploadScope,
    body: { contentType: string; contentLength: number; filename?: string },
  ): Observable<CustomerUploadPresign> {
    switch (scope) {
      case 'admin':
        return this.api.presignAdminUpload(body);
      case 'customer':
        return this.api.presignCustomerUpload(body);
      default:
        return this.api.presignResellerUpload(body);
    }
  }
}
