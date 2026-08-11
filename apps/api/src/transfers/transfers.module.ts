import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { TransfersRepository } from './transfers.repository';

@Module({
  imports: [AccountsModule, ExchangeRatesModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransfersRepository],
})
export class TransfersModule {}
