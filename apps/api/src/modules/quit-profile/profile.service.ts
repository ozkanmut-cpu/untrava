import { GoalSchema, QuitProfileSchema, type Goal, type QuitProfile } from '@untrava/contracts';

export interface ProfileRepository {
  saveProfile(profile: QuitProfile): Promise<QuitProfile>;
  createGoal(goal: Goal): Promise<Goal>;
  endGoal(userId: string, goalId: string, endsAt: string): Promise<Goal | null>;
}

export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  createProfile(input: QuitProfile): Promise<QuitProfile> {
    return this.repository.saveProfile(QuitProfileSchema.parse(input));
  }

  startGoal(input: Goal): Promise<Goal> {
    return this.repository.createGoal(GoalSchema.parse(input));
  }

  endGoal(userId: string, goalId: string, endsAt: string): Promise<Goal | null> {
    return this.repository.endGoal(userId, goalId, endsAt);
  }
}
