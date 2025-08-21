import { db } from '../db';
import { partnersTable, auditLogsTable } from '../db/schema';
import { type UpdatePartnerInput, type Partner } from '../schema';
import { eq } from 'drizzle-orm';

export const updatePartner = async (input: UpdatePartnerInput): Promise<Partner> => {
  try {
    // First, check if partner exists and get current data for audit log
    const existingPartners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, input.id))
      .execute();

    if (existingPartners.length === 0) {
      throw new Error(`Partner with ID ${input.id} not found`);
    }

    const existingPartner = existingPartners[0];

    // Prepare update data - only include fields that are provided
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.type !== undefined) {
      updateData.type = input.type;
    }
    if (input.contact_info !== undefined) {
      updateData.contact_info = input.contact_info;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Update the partner
    const result = await db.update(partnersTable)
      .set(updateData)
      .where(eq(partnersTable.id, input.id))
      .returning()
      .execute();

    const updatedPartner = result[0];

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would be the current user
        entity_type: 'partner',
        entity_id: input.id,
        action: 'update',
        before_data: existingPartner,
        after_data: updatedPartner
      })
      .execute();

    return updatedPartner;
  } catch (error) {
    console.error('Partner update failed:', error);
    throw error;
  }
};