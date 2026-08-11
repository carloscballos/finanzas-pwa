import { forwardRef, Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  imports: [forwardRef(() => FriendsModule)],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
