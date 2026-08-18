import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CardPurchasesController } from './card-purchases.controller';
import { CardPurchasesService } from './card-purchases.service';
import { CardPurchasesRepository } from './card-purchases.repository';
import { StatementExtractionService } from './statement-extraction.service';

@Module({
  imports: [AccountsModule],
  controllers: [CardPurchasesController],
  providers: [CardPurchasesService, CardPurchasesRepository, StatementExtractionService],
})
export class CardPurchasesModule {}
