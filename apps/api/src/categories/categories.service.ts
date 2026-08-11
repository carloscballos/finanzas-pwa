import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { CategoriesRepository } from './categories.repository';
import { CategoryMapper } from './mappers/category.mapper';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findAllForUser(userId: string): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesRepository.findAllForUser(userId);
    return CategoryMapper.toResponseList(categories);
  }

  async findOne(userId: string, id: string): Promise<CategoryResponseDto> {
    const category = await this.getOwnedCategory(userId, id);
    return CategoryMapper.toResponse(category);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.categoriesRepository.findByNameAndType(userId, dto.name, dto.type);
    if (existing) {
      throw new ConflictException(`Ya tienes una categoría "${dto.name}" de este tipo`);
    }
    const created = await this.categoriesRepository.create(userId, dto);
    return CategoryMapper.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.getOwnedCategory(userId, id);
    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoriesRepository.findByNameAndType(
        userId,
        dto.name,
        category.type,
      );
      if (existing) {
        throw new ConflictException(`Ya tienes una categoría "${dto.name}" de este tipo`);
      }
    }
    const updated = await this.categoriesRepository.update(id, dto);
    return CategoryMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedCategory(userId, id);
    const { transactions, budgets } = await this.categoriesRepository.countReferences(id);
    if (transactions > 0 || budgets > 0) {
      throw new ConflictException(
        `No puedes eliminar esta categoría: tiene ${transactions} movimiento(s) y ${budgets} presupuesto(s) asociados`,
      );
    }
    await this.categoriesRepository.delete(id);
  }

  // Usado por Transactions/Budgets para validar que una categoría existe,
  // es del usuario, y coincide con el tipo esperado (ingreso/gasto).
  async getOwnedCategory(userId: string, id: string): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);
    if (!category || category.userId !== userId) {
      throw new NotFoundException(`Categoría ${id} no encontrada`);
    }
    return category;
  }
}
