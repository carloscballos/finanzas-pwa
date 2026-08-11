import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserSearchResultDto } from './dto/user-search-result.dto';

@ApiTags('Users')
@Auth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  @ApiOperation({
    summary:
      'Buscar usuarios por email o nombre (para agregar amigos, invitar a una cuenta, o crear una deuda)',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Mínimo 2 caracteres' })
  @ApiResponse({ status: 200, type: [UserSearchResultDto] })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q: string,
  ): Promise<UserSearchResultDto[]> {
    return this.usersService.search(user.id, q);
  }
}
