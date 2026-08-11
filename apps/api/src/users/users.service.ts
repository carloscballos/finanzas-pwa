import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { FriendsRepository } from '../friends/friends.repository';
import { UserSearchResultDto } from './dto/user-search-result.dto';

const SALT_ROUNDS = 10;
const SEARCH_LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly friendsRepository: FriendsRepository,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async create(input: { email: string; name: string; password: string }): Promise<User> {
    const existing = await this.usersRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.usersRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
  }

  // Usada para sugerir contactos al agregar un amigo, invitar a una cuenta
  // compartida, o crear una deuda — nunca revela más que nombre/email.
  async search(userId: string, query: string): Promise<UserSearchResultDto[]> {
    const trimmed = query?.trim() ?? '';
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const [matches, friendIds] = await Promise.all([
      this.usersRepository.search(trimmed, userId, SEARCH_LIMIT),
      this.friendsRepository.listFriendUserIds(userId),
    ]);

    return matches
      .map((u) => ({ id: u.id, name: u.name, email: u.email, isFriend: friendIds.has(u.id) }))
      .sort((a, b) => Number(b.isFriend) - Number(a.isFriend));
  }
}
