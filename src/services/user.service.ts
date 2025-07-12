import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export interface CreateUserParams {
  externalId: string;
  displayName?: string;
  email?: string;
}

export interface UserInfo {
  id: string;
  externalId: string | null;
  displayName: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service for managing users across different gateways
 */
export class UserService {
  /**
   * Create a new user
   */
  async createUser(params: CreateUserParams): Promise<string> {
    try {
      const [createdUser] = await db
        .insert(users)
        .values({
          externalId: params.externalId,
          displayName: params.displayName,
          email: params.email,
        })
        .returning({ id: users.id });

      if (!createdUser) {
        throw new Error("Failed to create user - no result returned");
      }

      return createdUser.id;
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get or create a user based on external ID (from gateway platforms)
   */
  async getOrCreateUser(externalId: string, displayName?: string, email?: string): Promise<string> {
    try {
      // Look for existing user by external ID
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalId, externalId))
        .limit(1);

      if (existingUser) {
        return existingUser.id;
      }

      // Create new user with only defined values
      const createParams: CreateUserParams = { externalId };
      if (displayName) createParams.displayName = displayName;
      if (email) createParams.email = email;

      const userId = await this.createUser(createParams);
      return userId;
    } catch (error) {
      console.error("Error getting or creating user:", error);
      throw new Error(
        `Failed to get user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<UserInfo | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        externalId: user.externalId,
        displayName: user.displayName,
        email: user.email,
        isActive: user.isActive ?? true,
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? new Date(),
      };
    } catch (error) {
      console.error("Error fetching user:", error);
      throw new Error(
        `Failed to fetch user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get user by external ID
   */
  async getUserByExternalId(externalId: string): Promise<UserInfo | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.externalId, externalId)).limit(1);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        externalId: user.externalId,
        displayName: user.displayName,
        email: user.email,
        isActive: user.isActive ?? true,
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? new Date(),
      };
    } catch (error) {
      console.error("Error fetching user by external ID:", error);
      throw new Error(
        `Failed to fetch user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, updates: Partial<CreateUserParams>): Promise<void> {
    try {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
      if (updates.email !== undefined) updateData.email = updates.email;

      await db.update(users).set(updateData).where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating user:", error);
      throw new Error(
        `Failed to update user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(userId: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error deactivating user:", error);
      throw new Error(
        `Failed to deactivate user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
