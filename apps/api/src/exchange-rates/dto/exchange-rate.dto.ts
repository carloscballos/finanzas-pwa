import { ApiProperty } from '@nestjs/swagger';

export class ExchangeRateDto {
  @ApiProperty({ example: 3900.5, description: '1 USD en COP' })
  rate: number;

  @ApiProperty({ example: '2026-08-11T00:00:00.000', description: 'Fecha de vigencia de la TRM oficial' })
  date: string;

  @ApiProperty({ example: 'trm-banrep', description: 'TRM oficial del Banco de la República (datos.gov.co)' })
  source: string;
}
