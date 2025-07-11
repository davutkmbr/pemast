import { eq, and, desc } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/client.js';
import { files } from '../db/schema.js';
import type { NewFile, FileType, GatewayType } from '../types/index.js';

// Supabase clients
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'pemast-files';

// Use service role for uploads (bypasses RLS), anon for reads
const supabaseService = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : createClient(supabaseUrl, supabaseAnonKey);
  
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Service for managing file records and Supabase Storage operations
 */
export class FileService {

  /**
   * Create a new file record and upload to Supabase Storage
   */
  async createFile(fileData: NewFile, fileBuffer?: ArrayBuffer): Promise<string> {
    try {
      let storagePath = fileData.storagePath;
      
      // If file buffer is provided, upload to Supabase Storage
      if (fileBuffer) {
        storagePath = await this.uploadToStorage(fileData.originalName, fileBuffer, fileData.mimeType);
      }

      const [savedFile] = await db.insert(files).values({
        originalName: fileData.originalName,
        storagePath: storagePath,
        mimeType: fileData.mimeType,
        fileSize: fileData.fileSize,
        fileType: fileData.fileType,
        gatewayFileId: fileData.gatewayFileId,
        gatewayType: fileData.gatewayType,
        checksum: fileData.checksum,
        isProcessed: fileData.isProcessed || false,
      }).returning({ id: files.id });

      if (!savedFile) {
        throw new Error('Failed to create file - no result returned');
      }

      console.log('Created file record:', {
        id: savedFile.id,
        name: fileData.originalName,
        type: fileData.fileType,
        size: fileData.fileSize,
        gateway: fileData.gatewayType,
        storagePath: storagePath
      });

      return savedFile.id;
    } catch (error) {
      console.error('Error creating file:', error);
      throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload file to Supabase Storage using service role (bypasses RLS)
   */
  async uploadToStorage(fileName: string, fileBuffer: ArrayBuffer, mimeType: string): Promise<string> {
    try {
      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `files/${timestamp}_${sanitizedFileName}`;

      // Upload using service role client (bypasses RLS)
      const { data, error } = await supabaseService.storage
        .from(storageBucket)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        console.error('Supabase Storage upload error:', error);
        
        // If service role fails, try with public bucket policy
        if (error.message.includes('row-level security') || error.message.includes('Unauthorized')) {
          console.log('🔄 Service role failed, trying with anon key...');
          const { data: fallbackData, error: fallbackError } = await supabasePublic.storage
            .from(storageBucket)
            .upload(storagePath, fileBuffer, {
              contentType: mimeType,
              upsert: false,
            });
            
          if (fallbackError) {
            throw new Error(`Storage upload failed with both service and anon keys: ${fallbackError.message}`);
          }
          
          if (!fallbackData?.path) {
            throw new Error('No storage path returned from fallback upload');
          }
          
          console.log(`✅ File uploaded to storage (fallback): ${fallbackData.path}`);
          return fallbackData.path;
        }
        
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      if (!data?.path) {
        throw new Error('No storage path returned from upload');
      }

      console.log(`✅ File uploaded to storage: ${data.path}`);
      return data.path;
      
    } catch (error) {
      console.error('Error uploading to storage:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId: string) {
    try {
      return await db.query.files.findFirst({
        where: eq(files.id, fileId),
      });
    } catch (error) {
      console.error('Error fetching file by ID:', error);
      throw new Error(`Failed to fetch file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file by gateway file ID
   */
  async getFileByGatewayId(gatewayFileId: string, gatewayType: GatewayType) {
    try {
      return await db.query.files.findFirst({
        where: and(
          eq(files.gatewayFileId, gatewayFileId),
          eq(files.gatewayType, gatewayType)
        ),
      });
    } catch (error) {
      console.error('Error fetching file by gateway ID:', error);
      throw new Error(`Failed to fetch file by gateway ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file download URL from Supabase Storage
   */
  async getFileUrl(fileId: string): Promise<string | null> {
    try {
      const file = await this.getFileById(fileId);
      if (!file?.storagePath) {
        return null;
      }

      const { data } = await supabasePublic.storage
        .from(storageBucket)
        .createSignedUrl(file.storagePath, 3600); // 1 hour expiry

      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting file URL:', error);
      return null;
    }
  }

  /**
   * Download file buffer from Supabase Storage
   */
  async downloadFile(fileId: string): Promise<ArrayBuffer | null> {
    try {
      const file = await this.getFileById(fileId);
      if (!file?.storagePath) {
        return null;
      }

      const { data, error } = await supabasePublic.storage
        .from(storageBucket)
        .download(file.storagePath);

      if (error) {
        console.error('Error downloading file:', error);
        return null;
      }

      return await data.arrayBuffer();
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }

  /**
   * Get recent files by type
   */
  async getRecentFilesByType(fileType: FileType, limit: number = 10) {
    try {
      return await db.query.files.findMany({
        where: eq(files.fileType, fileType),
        orderBy: desc(files.createdAt),
        limit,
      });
    } catch (error) {
      console.error('Error fetching recent files:', error);
      throw new Error(`Failed to fetch recent files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark file as processed
   */
  async markFileAsProcessed(fileId: string): Promise<void> {
    try {
      await db.update(files)
        .set({ 
          isProcessed: true,
        })
        .where(eq(files.id, fileId));

      console.log('Marked file as processed:', fileId);
    } catch (error) {
      console.error('Error marking file as processed:', error);
      throw new Error(`Failed to mark file as processed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update file storage path (for Supabase Storage integration)
   */
  async updateStoragePath(fileId: string, storagePath: string): Promise<void> {
    try {
      await db.update(files)
        .set({ 
          storagePath,
        })
        .where(eq(files.id, fileId));

      console.log('Updated file storage path:', { fileId, storagePath });
    } catch (error) {
      console.error('Error updating file storage path:', error);
      throw new Error(`Failed to update storage path: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from both database and storage
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      // Get file info first
      const file = await this.getFileById(fileId);
      
      // Delete from storage if path exists
      if (file?.storagePath) {
        const { error } = await supabaseService.storage
          .from(storageBucket)
          .remove([file.storagePath]);
          
        if (error) {
          console.error('Error deleting from storage:', error);
          // Continue with database deletion even if storage deletion fails
        } else {
          console.log(`✅ File deleted from storage: ${file.storagePath}`);
        }
      }

      // Delete from database
      await db.delete(files).where(eq(files.id, fileId));
      console.log('Deleted file record:', fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create file with buffer upload (main method for processors)
   */
  async createFileWithUpload(
    originalName: string,
    fileBuffer: ArrayBuffer,
    mimeType: string,
    fileType: FileType,
    gatewayFileId?: string,
    gatewayType?: GatewayType
  ): Promise<string> {
    const fileData: NewFile = {
      originalName,
      mimeType,
      fileSize: fileBuffer.byteLength,
      fileType,
      gatewayFileId,
      gatewayType,
      isProcessed: true,
    };

    return await this.createFile(fileData, fileBuffer);
  }

  /**
   * Get file statistics
   */
  async getFileStats(): Promise<{
    totalFiles: number;
    filesByType: { type: FileType; count: number }[];
    processedFiles: number;
    totalSize: number;
  }> {
    try {
      const allFiles = await db.query.files.findMany();
      
      const totalFiles = allFiles.length;
      const processedFiles = allFiles.filter(f => f.isProcessed).length;
      const totalSize = allFiles.reduce((sum, f) => sum + (f.fileSize || 0), 0);
      
      // Group by file type
      const typeGroups = new Map<FileType, number>();
      allFiles.forEach(file => {
        typeGroups.set(file.fileType, (typeGroups.get(file.fileType) || 0) + 1);
      });
      
      const filesByType = Array.from(typeGroups.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalFiles,
        filesByType,
        processedFiles,
        totalSize
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      throw new Error(`Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 