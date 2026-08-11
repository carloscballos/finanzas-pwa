import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FriendsRepository } from './friends.repository';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsRepository],
  // FriendsRepository (no FriendsService) se expone a UsersModule, que la
  // usa en /users/search para marcar isFriend — evita un ciclo de
  // proveedores (FriendsService ya depende de UsersService).
  exports: [FriendsRepository],
})
export class FriendsModule {}
