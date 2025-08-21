import { db } from '../db';
import { partnersTable, auditLogsTable } from '../db/schema';
import { type CreatePartnerInput, type Partner } from '../schema';

export const createPartner = async (input: CreatePartnerInput): Promise<Partner> => {
  try {
    // Insert partner record
    const result = await db.insert(partnersTable)
      .values({
        name: input.name,
        type: input.type,
        contact_info: input.contact_info || null,
        is_active: input.is_active ?? true
      })
      .returning()
      .execute();

    const partner = result[0];

    // Create audit log entry for partner creation
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would be the current user
        entity_type: 'partner',
        entity_id: partner.id,
        action: 'create',
        before_data: null,
        after_data: {
          id: partner.id,
          name: partner.name,
          type: partner.type,
          contact_info: partner.contact_info,
          is_active: partner.is_active
        }
      })
      .execute();

    return partner;
  } catch (error) {
    console.error('Partner creation failed:', error);
    throw error;
  }
};