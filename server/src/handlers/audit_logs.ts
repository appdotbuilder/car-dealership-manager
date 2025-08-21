import { db } from '../db';
import { auditLogsTable } from '../db/schema';
import { type CreateAuditLogInput, type AuditLog } from '../schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  try {
    // Insert audit log record
    const result = await db.insert(auditLogsTable)
      .values({
        actor: input.actor,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        before_data: input.before_data || null,
        after_data: input.after_data || null
      })
      .returning()
      .execute();

    // Convert the database result to match the schema expectations
    const dbResult = result[0];
    return {
      id: dbResult.id,
      actor: dbResult.actor,
      entity_type: dbResult.entity_type,
      entity_id: dbResult.entity_id,
      action: dbResult.action,
      before_data: dbResult.before_data as Record<string, any> | null,
      after_data: dbResult.after_data as Record<string, any> | null,
      created_at: dbResult.created_at
    };
  } catch (error) {
    console.error('Audit log creation failed:', error);
    throw error;
  }
}

export async function getAuditLogs(entityType?: string, entityId?: number): Promise<AuditLog[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (entityType !== undefined) {
      conditions.push(eq(auditLogsTable.entity_type, entityType));
    }

    if (entityId !== undefined) {
      conditions.push(eq(auditLogsTable.entity_id, entityId));
    }

    // Build query based on whether we have conditions
    const results = conditions.length > 0
      ? await db.select()
          .from(auditLogsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(auditLogsTable.created_at))
          .execute()
      : await db.select()
          .from(auditLogsTable)
          .orderBy(desc(auditLogsTable.created_at))
          .execute();
    
    // Convert database results to match schema expectations
    return results.map(dbResult => ({
      id: dbResult.id,
      actor: dbResult.actor,
      entity_type: dbResult.entity_type,
      entity_id: dbResult.entity_id,
      action: dbResult.action,
      before_data: dbResult.before_data as Record<string, any> | null,
      after_data: dbResult.after_data as Record<string, any> | null,
      created_at: dbResult.created_at
    }));
  } catch (error) {
    console.error('Audit logs retrieval failed:', error);
    throw error;
  }
}