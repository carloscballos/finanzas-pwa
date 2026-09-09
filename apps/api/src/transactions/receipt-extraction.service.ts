import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export const SUPPORTED_RECEIPT_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ReceiptMediaType = (typeof SUPPORTED_RECEIPT_MEDIA_TYPES)[number];

export interface ExtractedReceipt {
  merchant: string;
  amount: number | null;
  purchaseDate: string | null;
  // Índice (0-based) dentro de la lista de categorías que se le pasó al
  // modelo — se resuelve al id real en TransactionsService, para que este
  // servicio no necesite saber nada de la BD.
  categoryIndex: number | null;
}

// additionalProperties: false requerido en cada objeto (limitación de
// structured outputs) — ver claude-api skill. type: [x, "null"] es la forma
// soportada de marcar un campo nullable.
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: {
      type: 'string',
      description: 'Nombre del comercio o negocio donde se hizo la compra, tal como aparece en la factura/recibo.',
    },
    amount: {
      type: ['number', 'null'],
      description:
        'Monto total pagado (el total final, incluyendo impuestos/propina si aplica). null si no se puede leer con confianza.',
    },
    purchaseDate: {
      type: ['string', 'null'],
      description: 'Fecha de la compra en formato YYYY-MM-DD, tal como aparece en la factura. null si no aparece.',
    },
    categoryIndex: {
      type: ['integer', 'null'],
      description:
        'Índice (0-based) de la categoría de la lista dada que mejor describe esta compra. null si ninguna aplica con confianza, o si no se dio ninguna lista.',
    },
  },
  required: ['merchant', 'amount', 'purchaseDate', 'categoryIndex'],
  additionalProperties: false,
} as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseExtractedDate(value: string | null): string | null {
  if (!value || !ISO_DATE_RE.test(value)) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

@Injectable()
export class ReceiptExtractionService {
  private readonly logger = new Logger(ReceiptExtractionService.name);
  private client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Anthropic {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('La lectura de facturas no está configurada — falta ANTHROPIC_API_KEY');
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async extractReceipt(
    imageBuffer: Buffer,
    mediaType: ReceiptMediaType,
    categories: { name: string; emoji: string | null }[],
  ): Promise<ExtractedReceipt> {
    const client = this.getClient();

    const categoryList =
      categories.length > 0
        ? categories.map((c, i) => `${i}: ${c.emoji ? `${c.emoji} ` : ''}${c.name}`).join('\n')
        : null;

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 2048,
        output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') },
              },
              {
                type: 'text',
                text:
                  'Esta es una foto de una factura o recibo de compra. Extrae el nombre del comercio (merchant), ' +
                  'el monto total pagado (amount — el total final) y la fecha de la compra si aparece ' +
                  '(purchaseDate).' +
                  (categoryList
                    ? ' Además, de esta lista de categorías de gasto del usuario, elige la que mejor describe la ' +
                      `compra por su índice (categoryIndex) — si ninguna aplica con confianza, usa null:\n${categoryList}`
                    : ' No hay categorías disponibles para sugerir — deja categoryIndex en null.'),
              },
            ],
          },
        ],
      });
    } catch (err) {
      this.logger.error(`Anthropic API error extracting receipt: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo procesar la foto — intenta de nuevo');
    }

    if (response.stop_reason === 'refusal') {
      throw new BadRequestException('No se pudo leer esta imagen — asegúrate de que sea la foto de una factura o recibo');
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new ServiceUnavailableException('La foto no devolvió resultados legibles — intenta de nuevo');
    }

    try {
      const parsed = JSON.parse(textBlock.text) as ExtractedReceipt;
      const categoryIndex =
        parsed.categoryIndex !== null && parsed.categoryIndex >= 0 && parsed.categoryIndex < categories.length
          ? parsed.categoryIndex
          : null;
      return {
        merchant: parsed.merchant,
        amount: parsed.amount,
        purchaseDate: parseExtractedDate(parsed.purchaseDate),
        categoryIndex,
      };
    } catch {
      throw new ServiceUnavailableException('No se pudo interpretar el resultado de la lectura — intenta de nuevo');
    }
  }
}
