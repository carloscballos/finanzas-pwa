import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { FriendsRepository } from './friends.repository';
import { FriendRequestMapper, FriendRequestWithRelations } from './mappers/friend-request.mapper';
import { FriendRequestResponseDto } from './dto/friend-request-response.dto';
import { FriendResponseDto } from './dto/friend-response.dto';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';

@Injectable()
export class FriendsService {
  constructor(
    private readonly friendsRepository: FriendsRepository,
    private readonly usersService: UsersService,
  ) {}

  async findReceived(userId: string): Promise<FriendRequestResponseDto[]> {
    const requests = await this.friendsRepository.findReceived(userId, 'PENDING');
    return FriendRequestMapper.toResponseList(requests);
  }

  async findSent(userId: string): Promise<FriendRequestResponseDto[]> {
    const requests = await this.friendsRepository.findSent(userId, 'PENDING');
    return FriendRequestMapper.toResponseList(requests);
  }

  async findFriends(userId: string): Promise<FriendResponseDto[]> {
    const accepted = await this.friendsRepository.findAccepted(userId);
    return accepted.map((request) =>
      FriendRequestMapper.toFriend(
        request.requestedByUserId === userId ? request.requestedTo : request.requestedBy,
      ),
    );
  }

  async create(userId: string, dto: CreateFriendRequestDto): Promise<FriendRequestResponseDto> {
    const target = await this.usersService.findByEmail(dto.email);
    if (!target) {
      throw new NotFoundException('No existe un usuario registrado con ese email');
    }
    if (target.id === userId) {
      throw new BadRequestException('No puedes agregarte a ti mismo');
    }

    const existing = await this.friendsRepository.findBetween(userId, target.id);
    if (existing) {
      throw new ConflictException(
        existing.status === 'ACCEPTED'
          ? 'Ya son amigos'
          : 'Ya existe una solicitud pendiente entre ustedes',
      );
    }

    const created = await this.friendsRepository.create(userId, target.id);
    return FriendRequestMapper.toResponse(created);
  }

  async accept(userId: string, id: string): Promise<FriendRequestResponseDto> {
    const request = await this.getReceived(userId, id);
    if (request.status !== 'PENDING') {
      throw new ConflictException('Esta solicitud ya no está pendiente');
    }
    const updated = await this.friendsRepository.updateStatus(id, 'ACCEPTED');
    return FriendRequestMapper.toResponse(updated);
  }

  async decline(userId: string, id: string): Promise<FriendRequestResponseDto> {
    const request = await this.getReceived(userId, id);
    if (request.status !== 'PENDING') {
      throw new ConflictException('Esta solicitud ya no está pendiente');
    }
    const updated = await this.friendsRepository.updateStatus(id, 'DECLINED');
    return FriendRequestMapper.toResponse(updated);
  }

  async cancel(userId: string, id: string): Promise<FriendRequestResponseDto> {
    const request = await this.friendsRepository.findById(id);
    if (!request || request.requestedByUserId !== userId) {
      throw new NotFoundException(`Solicitud ${id} no encontrada`);
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('Esta solicitud ya no está pendiente');
    }
    const updated = await this.friendsRepository.updateStatus(id, 'CANCELED');
    return FriendRequestMapper.toResponse(updated);
  }

  async remove(userId: string, friendUserId: string): Promise<void> {
    const request = await this.friendsRepository.findBetween(userId, friendUserId);
    if (!request || request.status !== 'ACCEPTED') {
      throw new NotFoundException('No son amigos');
    }
    await this.friendsRepository.delete(request.id);
  }

  private async getReceived(userId: string, id: string): Promise<FriendRequestWithRelations> {
    const request = await this.friendsRepository.findById(id);
    if (!request || request.requestedToUserId !== userId) {
      throw new NotFoundException(`Solicitud ${id} no encontrada`);
    }
    return request;
  }
}
