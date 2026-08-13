import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { LoansRepository } from './loans.repository';

@Module({
  imports: [AccountsModule],
  controllers: [LoansController],
  providers: [LoansService, LoansRepository],
})
export class LoansModule {}
