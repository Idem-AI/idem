import { UserModel } from "../userModel";

/**
 * Builder for UserModel
 */
export class UserBuilder {
  /**
   * Creates an empty UserModel with all required properties
   */
  static createEmpty(): UserModel {
    return {
      uid: "",
      email: "",
      subscription: "free",
      createdAt: new Date(),
      lastLogin: new Date(),
      quota: {
        dailyUsage: 0,
        weeklyUsage: 0,
        lastResetDaily: new Date().toISOString(),
        lastResetWeekly: new Date().toISOString(),
        quotaUpdatedAt: new Date(),
      },
      roles: [],
    };
  }

  /**
   * Creates a partial UserModel with specified properties
   */
  static createPartial(data: Partial<UserModel>): UserModel {
    return { ...this.createEmpty(), ...data };
  }
}
