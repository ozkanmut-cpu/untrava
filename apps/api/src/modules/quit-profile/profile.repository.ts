import type { PrismaClient } from '@prisma/client';
import { GoalSchema, QuitProfileSchema, type Goal, type QuitProfile } from '@untrava/contracts';
import type { ProfileRepository } from './profile.service';

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveProfile(profile: QuitProfile): Promise<QuitProfile> {
    const row = await this.prisma.quitProfile.upsert({
      where: { userId: profile.userId },
      create: {
        userId: profile.userId, strategy: profile.strategy, quitDate: profile.quitDate ? new Date(profile.quitDate) : null,
        createdAt: new Date(profile.createdAt), updatedAt: new Date(profile.updatedAt),
        products: { create: profile.products },
      },
      update: {
        strategy: profile.strategy, quitDate: profile.quitDate ? new Date(profile.quitDate) : null,
        updatedAt: new Date(profile.updatedAt), products: { deleteMany: {}, create: profile.products },
      }, include: { products: true },
    });
    return QuitProfileSchema.parse({ ...row, quitDate: row.quitDate?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), products: row.products.map((item) => ({ product: item.product, dailyQuantity: item.dailyQuantity })) });
  }

  async createGoal(goal: Goal): Promise<Goal> {
    const row = await this.prisma.goal.create({ data: {
      goalId: goal.goalId, userId: goal.userId, type: goal.type, startsAt: new Date(goal.startsAt), endsAt: goal.endsAt ? new Date(goal.endsAt) : null,
      reductionProduct: goal.reductionTarget?.product, reductionDailyQuantity: goal.reductionTarget?.dailyQuantity,
    } });
    return this.toGoal(row);
  }

  async endGoal(userId: string, goalId: string, endsAt: string): Promise<Goal | null> {
    const existing = await this.prisma.goal.findFirst({ where: { goalId, userId } });
    if (!existing) return null;
    return this.toGoal(await this.prisma.goal.update({ where: { goalId }, data: { endsAt: new Date(endsAt) } }));
  }

  private toGoal(row: { goalId: string; userId: string; type: string; startsAt: Date; endsAt: Date | null; reductionProduct: string | null; reductionDailyQuantity: number | null }): Goal {
    return GoalSchema.parse({ goalId: row.goalId, userId: row.userId, type: row.type, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt?.toISOString() ?? null, ...(row.reductionProduct && row.reductionDailyQuantity !== null ? { reductionTarget: { product: row.reductionProduct, dailyQuantity: row.reductionDailyQuantity } } : {}) });
  }
}
