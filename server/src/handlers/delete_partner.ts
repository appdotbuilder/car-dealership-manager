import { db } from '../db';
import { partnersTable, transactionsTable, auditLogsTable } from '../db/schema';
import { eq, and, count } from 'drizzle-orm';

export async function deletePartner(partnerId: number): Promise<{ success: boolean }> {
  try {
    // First, validate that the partner exists and is currently active
    const partnerResults = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, partnerId))
      .execute();

    if (partnerResults.length === 0) {
      throw new Error(`Partner with id ${partnerId} not found`);
    }

    const partner = partnerResults[0];
    
    if (!partner.is_active) {
      throw new Error(`Partner with id ${partnerId} is already inactive`);
    }

    // Check if partner has any active transactions
    const transactionCountResults = await db.select({
      count: count()
    })
      .from(transactionsTable)
      .where(eq(transactionsTable.partner_id, partnerId))
      .execute();

    const transactionCount = transactionCountResults[0].count;

    if (transactionCount > 0) {
      throw new Error(`Cannot delete partner with id ${partnerId} - has ${transactionCount} associated transactions`);
    }

    // Store the current data for audit log
    const beforeData = {
      id: partner.id,
      name: partner.name,
      type: partner.type,
      contact_info: partner.contact_info,
      is_active: partner.is_active,
      created_at: partner.created_at,
      updated_at: partner.updated_at
    };

    // Perform soft delete by setting is_active to false
    const updateResults = await db.update(partnersTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(partnersTable.id, partnerId))
      .returning()
      .execute();

    const updatedPartner = updateResults[0];

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would be the current user
        entity_type: 'partner',
        entity_id: partnerId,
        action: 'delete',
        before_data: beforeData,
        after_data: {
          id: updatedPartner.id,
          name: updatedPartner.name,
          type: updatedPartner.type,
          contact_info: updatedPartner.contact_info,
          is_active: updatedPartner.is_active,
          created_at: updatedPartner.created_at,
          updated_at: updatedPartner.updated_at
        }
      })
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Partner deletion failed:', error);
    throw error;
  }
}