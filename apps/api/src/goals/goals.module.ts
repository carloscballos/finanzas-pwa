import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalsRepository } from './goals.repository';

@Module({
  imports: [AccountsModule],
  controllers: [GoalsController],
  providers: [GoalsService, GoalsRepository],
})
export class GoalsModule {}
