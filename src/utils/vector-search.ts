import { sql, and, SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { VectorSearchResult } from '../types/index.js';

/**
 * Generic helper to perform pgvector cosine-distance searches on any table.
 *
 * Example usage:
 *   vectorSearch<Memory>({
 *     table: memories,
 *     embeddingColumn: memories.embedding,
 *     selectColumns: {
 *       id: memories.id,
 *       content: memories.content,
 *       // …other columns you need back
 *     },
 *     where: [eq(memories.userId, userId), eq(memories.projectId, projectId)],
 *     queryEmbedding,
 *     limit: 5,
 *   });
 */
export async function vectorSearch<T>(params: {
  table: any; // Drizzle table reference
  embeddingColumn: any; // column reference holding the vector
  selectColumns: Record<string, any>; // columns to return (without distance/sim)
  where: SQL[]; // additional where conditions
  queryEmbedding: number[];
  limit?: number;
}): Promise<VectorSearchResult<T>[]> {
  const { table, embeddingColumn, selectColumns, where, queryEmbedding, limit = 5 } = params;

  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  // Build vector expression strings
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const distanceExpr = sql`(${embeddingColumn} <=> ${vectorStr}::vector)`;
  const similarityExpr = sql`(1 - (${embeddingColumn} <=> ${vectorStr}::vector))`;

  // Combine mandatory and extra where conditions
  const finalWhere = and(sql`${embeddingColumn} IS NOT NULL`, ...where);

  // Execute query
  const rows = await db
    .select({
      ...selectColumns,
      distance: distanceExpr,
      similarity: similarityExpr,
    })
    .from(table)
    .where(finalWhere)
    .orderBy(distanceExpr)
    .limit(limit);

  // Map to VectorSearchResult<T>
  return (rows as any[]).map((row) => {
    const { distance, similarity, ...item } = row as any;
    return {
      item: item as T,
      distance: Number(distance),
      similarity: Number(similarity),
    } as VectorSearchResult<T>;
  });
} 