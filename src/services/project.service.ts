import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projects, projectMembers } from '../db/schema.js';
import type { GatewayType } from '../types/index.js';

export interface CreateProjectParams {
  name: string;
  description?: string;
  ownerId: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service for managing projects and their memberships
 */
export class ProjectService {
  
  /**
   * Create a new project with owner membership
   */
  async createProject(params: CreateProjectParams): Promise<string> {
    try {
      // Create project
      const [createdProject] = await db.insert(projects).values({
        name: params.name,
        description: params.description,
      }).returning({ id: projects.id });

      if (!createdProject) {
        throw new Error('Failed to create project - no result returned');
      }

      // Add owner to project members
      await db.insert(projectMembers).values({
        projectId: createdProject.id,
        userId: params.ownerId,
        role: 'owner',
      });

      return createdProject.id;
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create a default project for a user
   * Used when messages come from platforms where project context isn't clear
   */
  async getOrCreateDefaultProject(userId: string, gatewayType: GatewayType): Promise<string> {
    try {
      // Look for user's existing projects
      const existingMembership = await db
        .select({
          projectId: projectMembers.projectId,
        })
        .from(projectMembers)
        .where(eq(projectMembers.userId, userId))
        .limit(1);

      if (existingMembership.length > 0 && existingMembership[0]?.projectId) {
        return existingMembership[0].projectId;
      }

      // Create a default project for this user
      const projectName = `${gatewayType.charAt(0).toUpperCase() + gatewayType.slice(1)} Personal`;
      const projectId = await this.createProject({
        name: projectName,
        description: `Default project for ${gatewayType} messages`,
        ownerId: userId,
      });

      return projectId;
    } catch (error) {
      console.error('Error getting or creating default project:', error);
      throw new Error(`Failed to get default project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<ProjectInfo | null> {
    try {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return null;
      }

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        isActive: project.isActive ?? true,
        createdAt: project.createdAt ?? new Date(),
        updatedAt: project.updatedAt ?? new Date(),
      };
    } catch (error) {
      console.error('Error fetching project:', error);
      throw new Error(`Failed to fetch project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a member to a project
   */
  async addMember(projectId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<void> {
    try {
      await db.insert(projectMembers).values({
        projectId,
        userId,
        role,
      }).onConflictDoNothing(); // Ignore if membership already exists
    } catch (error) {
      console.error('Error adding project member:', error);
      throw new Error(`Failed to add member: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user is a member of a project
   */
  async isMember(projectId: string, userId: string): Promise<boolean> {
    try {
      const [membership] = await db
        .select()
        .from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        ))
        .limit(1);

      return !!membership;
    } catch (error) {
      console.error('Error checking project membership:', error);
      return false;
    }
  }
} 