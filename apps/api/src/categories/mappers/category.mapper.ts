import { Category } from '@prisma/client';
import { CategoryResponseDto } from '../dto/category-response.dto';

export class CategoryMapper {
  static toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      type: category.type,
      emoji: category.emoji,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  static toResponseList(categories: Category[]): CategoryResponseDto[] {
    return categories.map(CategoryMapper.toResponse);
  }
}
