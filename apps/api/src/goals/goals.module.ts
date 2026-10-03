import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { TransfersModule } from '../transfers/transfers.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalsRepository } from './goals.repository';

@Module({
  imports: [AccountsModule, TransfersModule],
  controllers: [GoalsController],
  providers: [GoalsService, GoalsRepository],
})
export class GoalsModule {}
