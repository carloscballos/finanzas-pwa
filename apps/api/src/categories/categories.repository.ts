import { Injectable } from '@nestjs/common';
import { Category, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  }

  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  findByNameAndType(userId: string, name: string, type: TransactionType): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { userId_name_type: { userId, name, type } },
    });
  }

  create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({ data: { ...dto, userId } });
  }

  update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async countReferences(categoryId: string): Promise<{ transactions: number; budgets: number }> {
    const [transactions, budgets] = await Promise.all([
      this.prisma.transaction.count({ where: { categoryId } }),
      this.prisma.budget.count({ where: { categoryId } }),
    ]);
    return { transactions, budgets };
  }
}
