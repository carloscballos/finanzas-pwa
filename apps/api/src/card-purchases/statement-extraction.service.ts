import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic, { APIError } from '@anthropic-ai/sdk';

export interface ExtractedStatementPurchase {
  merchant: string;
  installmentAmount: number;
  originalAmount: number | null;
  installmentCurrent: number | null;
  installmentTotal: number | null;
}

// additionalProperties: false requerido en cada objeto (limitación de
// structured outputs) — ver claude-api skill. type: [x, "null"] es la forma
// soportada de marcar un campo nullable.
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    purchases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          merchant: {
            type: 'string',
            description: 'Nombre del comercio o descripción del cargo, tal como aparece en el extracto',
          },
          installmentAmount: {
            type: 'number',
            description: 'Monto de esta línea en el extracto (el valor de la cuota si es una compra a cuotas, o el monto total si es un pago único)',
          },
          originalAmount: {
            type: ['number', 'null'],
            description: 'Monto original total de la compra, SOLO si aparece explícito en el extracto (ej. junto a "Compra original"). null si no aparece.',
          },
          installmentCurrent: {
            type: ['integer', 'null'],
            description: 'Número de la cuota actual, ej. 3 en un texto como "CUOTA 3/12" o "3 DE 12". null si la compra no es a cuotas (pago único).',
          },
          installmentTotal: {
            type: ['integer', 'null'],
            description: 'Número total de cuotas, ej. 12 en "CUOTA 3/12". null si la compra no es a cuotas (pago único).',
          },
        },
        required: ['merchant', 'installmentAmount', 'originalAmount', 'installmentCurrent', 'installmentTotal'],
        additionalProperties: false,
      },
    },
  },
  required: ['purchases'],
  additionalProperties: false,
} as const;

@Injectable()
export class StatementExtractionService {
  private readonly logger = new Logger(StatementExtractionService.name);
  private client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Anthropic {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'La extracción de extractos no está configurada — falta ANTHROPIC_API_KEY',
      );
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async extractPurchases(pdfBuffer: Buffer): Promise<ExtractedStatementPurchase[]> {
    const client = this.getClient();

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 8192,
        output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
              },
              {
                type: 'text',
                text:
                  'Este es un extracto de tarjeta de crédito. Extrae cada compra o cargo que aparezca, ' +
                  'incluyendo las que están a cuotas (busca patrones como "CUOTA 3/12", "3 DE 12", "03/12") ' +
                  'y las de pago único. No incluyas pagos hechos a la tarjeta, intereses, ni el total del extracto.',
              },
            ],
          },
        ],
      });
    } catch (err) {
      if (err instanceof APIError && err.status === 400 && /password protected/i.test(err.message)) {
        throw new BadRequestException(
          'Este PDF tiene contraseña. Ábrelo con tu contraseña y expórtalo o imprímelo como un PDF nuevo (sin protección) antes de subirlo.',
        );
      }
      this.logger.error(`Anthropic API error extracting statement: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo procesar el extracto — intenta de nuevo');
    }

    if (response.stop_reason === 'refusal') {
      throw new BadRequestException('No se pudo leer este PDF — asegúrate de que sea un extracto de tarjeta de crédito');
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new ServiceUnavailableException('El extracto no devolvió resultados legibles — intenta de nuevo');
    }

    try {
      const parsed = JSON.parse(textBlock.text) as { purchases: ExtractedStatementPurchase[] };
      return parsed.purchases;
    } catch {
      throw new ServiceUnavailableException('No se pudo interpretar el resultado de la extracción — intenta de nuevo');
    }
  }
}
