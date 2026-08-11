import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { UsersModule } from '../users/users.module';
import { AccountInvitationsController } from './account-invitations.controller';
import { AccountInvitationsService } from './account-invitations.service';
import { AccountInvitationsRepository } from './account-invitations.repository';

@Module({
  imports: [AccountsModule, UsersModule],
  controllers: [AccountInvitationsController],
  providers: [AccountInvitationsService, AccountInvitationsRepository],
})
export class AccountInvitationsModule {}
