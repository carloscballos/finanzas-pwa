import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic, { APIError } from '@anthropic-ai/sdk';

export interface ExtractedStatementPurchase {
  merchant: string;
  installmentAmount: number;
  originalAmount: number | null;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  purchaseDate: string | null;
}

export interface ExtractedStatement {
  statementDate: string | null;
  purchases: ExtractedStatementPurchase[];
}

// additionalProperties: false requerido en cada objeto (limitación de
// structured outputs) — ver claude-api skill. type: [x, "null"] es la forma
// soportada de marcar un campo nullable.
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    statementDate: {
      type: ['string', 'null'],
      description:
        'Fecha de corte o período de facturación del extracto, en formato YYYY-MM-DD. Si el extracto muestra un rango, usa la fecha de corte/cierre. null si no aparece en ninguna parte.',
    },
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
          purchaseDate: {
            type: ['string', 'null'],
            description:
              'Fecha de esta transacción tal como aparece en su propia línea del extracto, en formato YYYY-MM-DD. null si esa línea no muestra una fecha propia.',
          },
        },
        required: [
          'merchant',
          'installmentAmount',
          'originalAmount',
          'installmentCurrent',
          'installmentTotal',
          'purchaseDate',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['statementDate', 'purchases'],
  additionalProperties: false,
} as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseExtractedDate(value: string | null): string | null {
  if (!value || !ISO_DATE_RE.test(value)) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

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

  async extractPurchases(pdfBuffer: Buffer): Promise<ExtractedStatement> {
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
                  'y las de pago único. No incluyas pagos hechos a la tarjeta, intereses, ni el total del extracto. ' +
                  'Además extrae la fecha de corte/período del extracto (statementDate), y si cada línea muestra ' +
                  'su propia fecha de transacción, inclúyela también en purchaseDate.',
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
      const parsed = JSON.parse(textBlock.text) as {
        statementDate: string | null;
        purchases: ExtractedStatementPurchase[];
      };
      return {
        statementDate: parseExtractedDate(parsed.statementDate),
        purchases: parsed.purchases.map((p) => ({ ...p, purchaseDate: parseExtractedDate(p.purchaseDate) })),
      };
    } catch {
      throw new ServiceUnavailableException('No se pudo interpretar el resultado de la extracción — intenta de nuevo');
    }
  }
}
