import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ExchangeRateDto } from './dto/exchange-rate.dto';

// TRM oficial del Banco de la República, vía la API pública (sin key) de
// datos.gov.co. Se publica una vez al día — no es un mercado en vivo — así
// que cachear unas horas no pierde precisión real.
const TRM_URL = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface TrmEntry {
  valor: string;
  vigenciadesde: string;
}

interface CachedRate {
  rate: number;
  date: string;
  fetchedAt: number;
}

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private cache: CachedRate | null = null;

  async getUsdToCop(): Promise<ExchangeRateDto> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return { rate: this.cache.rate, date: this.cache.date, source: 'trm-banrep' };
    }

    try {
      const res = await fetch(TRM_URL);
      if (!res.ok) {
        throw new Error(`TRM API respondió ${res.status}`);
      }
      const [entry] = (await res.json()) as TrmEntry[];
      if (!entry) {
        throw new Error('Respuesta vacía de la TRM');
      }

      const rate = Number(entry.valor);
      this.cache = { rate, date: entry.vigenciadesde, fetchedAt: Date.now() };
      return { rate, date: entry.vigenciadesde, source: 'trm-banrep' };
    } catch (error) {
      this.logger.error(`No se pudo obtener la TRM: ${(error as Error).message}`);
      if (this.cache) {
        return { rate: this.cache.rate, date: this.cache.date, source: 'trm-banrep' };
      }
      throw new ServiceUnavailableException(
        'No se pudo obtener la tasa de cambio automática. Ingresa una tasa manual.',
      );
    }
  }
}
