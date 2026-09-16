import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';

// Código que el frontend usa para distinguir "hay que pedir contraseña" (422)
// de una contraseña incorrecta (400). Ver AccountTransactionsPage.
export const PDF_PASSWORD_REQUIRED = 'PDF_PASSWORD_REQUIRED';

/**
 * Descifra extractos PDF protegidos con contraseña ANTES de mandarlos a la IA.
 *
 * `mupdf` es ESM-only y su WASM usa top-level await, así que no se puede
 * `require()` desde este módulo CommonJS — se carga con `import()` dinámico
 * (preservado tal cual por `module: nodenext`) y se cachea la promesa.
 */
@Injectable()
export class PdfDecryptService {
  private readonly logger = new Logger(PdfDecryptService.name);
  private mupdfPromise: Promise<typeof import('mupdf')> | null = null;

  private loadMupdf(): Promise<typeof import('mupdf')> {
    if (!this.mupdfPromise) {
      this.mupdfPromise = import('mupdf');
    }
    return this.mupdfPromise;
  }

  /**
   * Devuelve el PDF listo para procesar:
   * - Si no está cifrado, devuelve el buffer original sin tocarlo (ruta feliz,
   *   byte a byte igual a lo que subió el usuario).
   * - Si está cifrado y la contraseña es correcta, devuelve una copia descifrada.
   * - Si está cifrado y no se dio contraseña, lanza 422 con code PDF_PASSWORD_REQUIRED.
   * - Si está cifrado y la contraseña es incorrecta, lanza 400.
   */
  async decryptIfNeeded(pdfBuffer: Buffer, password?: string): Promise<Buffer> {
    const mupdf = await this.loadMupdf();

    let doc: import('mupdf').Document;
    try {
      doc = mupdf.Document.openDocument(new Uint8Array(pdfBuffer), 'application/pdf');
    } catch (err) {
      // No se pudo abrir como PDF — no es tarea de este servicio validar el
      // formato; que la extracción (Anthropic) devuelva el error de siempre.
      this.logger.warn(`No se pudo abrir el PDF para revisar cifrado: ${(err as Error).message}`);
      return pdfBuffer;
    }

    try {
      if (!doc.needsPassword()) {
        return pdfBuffer;
      }
      if (!password) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: PDF_PASSWORD_REQUIRED,
          message: 'Este PDF está protegido con contraseña. Ingrésala para poder leer el extracto.',
        });
      }
      // authenticatePassword devuelve 0 si falla, un bitfield > 0 si autentica.
      const authenticated = doc.authenticatePassword(password);
      if (!authenticated) {
        throw new BadRequestException('La contraseña del PDF es incorrecta.');
      }
      const pdf = doc.asPDF();
      if (!pdf) {
        // needsPassword() era true pero no es un PDF estándar — muy raro; deja
        // pasar el original y que la extracción decida.
        return pdfBuffer;
      }
      const decrypted = pdf.saveToBuffer('encrypt=none').asUint8Array();
      return Buffer.from(decrypted);
    } finally {
      doc.destroy();
    }
  }
}
