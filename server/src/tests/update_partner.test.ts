import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, auditLogsTable } from '../db/schema';
import { type UpdatePartnerInput, type CreatePartnerInput } from '../schema';
import { updatePartner } from '../handlers/update_partner';
import { eq } from 'drizzle-orm';

// Test data
const testPartner: CreatePartnerInput = {
  name: 'Test Partner',
  type: 'broker',
  contact_info: 'test@example.com',
  is_active: true
};

const createTestPartner = async (data: CreatePartnerInput) => {
  const result = await db.insert(partnersTable)
    .values({
      name: data.name,
      type: data.type,
      contact_info: data.contact_info,
      is_active: data.is_active ?? true
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('updatePartner', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all partner fields', async () => {
    // Create a test partner first
    const createdPartner = await createTestPartner(testPartner);

    const updateInput: UpdatePartnerInput = {
      id: createdPartner.id,
      name: 'Updated Partner Name',
      type: 'workshop',
      contact_info: 'updated@example.com',
      is_active: false
    };

    const result = await updatePartner(updateInput);

    // Verify updated fields
    expect(result.id).toEqual(createdPartner.id);
    expect(result.name).toEqual('Updated Partner Name');
    expect(result.type).toEqual('workshop');
    expect(result.contact_info).toEqual('updated@example.com');
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at).toEqual(createdPartner.created_at);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdPartner.updated_at.getTime());
  });

  it('should update only provided fields', async () => {
    // Create a test partner first
    const createdPartner = await createTestPartner(testPartner);

    const updateInput: UpdatePartnerInput = {
      id: createdPartner.id,
      name: 'Partially Updated Name'
    };

    const result = await updatePartner(updateInput);

    // Verify only name was updated, other fields remain unchanged
    expect(result.name).toEqual('Partially Updated Name');
    expect(result.type).toEqual(createdPartner.type);
    expect(result.contact_info).toEqual(createdPartner.contact_info);
    expect(result.is_active).toEqual(createdPartner.is_active);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdPartner.updated_at.getTime());
  });

  it('should save updated partner to database', async () => {
    // Create a test partner first
    const createdPartner = await createTestPartner(testPartner);

    const updateInput: UpdatePartnerInput = {
      id: createdPartner.id,
      name: 'Database Updated Name',
      type: 'salon'
    };

    const result = await updatePartner(updateInput);

    // Query database directly to verify changes were persisted
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, result.id))
      .execute();

    expect(partners).toHaveLength(1);
    const dbPartner = partners[0];
    expect(dbPartner.name).toEqual('Database Updated Name');
    expect(dbPartner.type).toEqual('salon');
    expect(dbPartner.contact_info).toEqual(createdPartner.contact_info); // Unchanged
    expect(dbPartner.updated_at).toBeInstanceOf(Date);
  });

  it('should create audit log entry for update', async () => {
    // Create a test partner first
    const createdPartner = await createTestPartner(testPartner);

    const updateInput: UpdatePartnerInput = {
      id: createdPartner.id,
      name: 'Audited Update',
      type: 'transport'
    };

    await updatePartner(updateInput);

    // Check that audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, createdPartner.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    const auditLog = auditLogs[0];
    expect(auditLog.entity_type).toEqual('partner');
    expect(auditLog.entity_id).toEqual(createdPartner.id);
    expect(auditLog.action).toEqual('update');
    expect(auditLog.actor).toEqual('system');
    expect(auditLog.before_data).toBeDefined();
    expect(auditLog.after_data).toBeDefined();
    expect(auditLog.created_at).toBeInstanceOf(Date);

    // Verify audit log contains correct before/after data
    expect((auditLog.before_data as any).name).toEqual('Test Partner');
    expect((auditLog.after_data as any).name).toEqual('Audited Update');
    expect((auditLog.after_data as any).type).toEqual('transport');
  });

  it('should handle null contact_info update', async () => {
    // Create a test partner with contact info
    const createdPartner = await createTestPartner(testPartner);

    const updateInput: UpdatePartnerInput = {
      id: createdPartner.id,
      contact_info: null
    };

    const result = await updatePartner(updateInput);

    expect(result.contact_info).toBeNull();

    // Verify in database
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, result.id))
      .execute();

    expect(partners[0].contact_info).toBeNull();
  });

  it('should throw error when partner does not exist', async () => {
    const updateInput: UpdatePartnerInput = {
      id: 99999, // Non-existent ID
      name: 'Should Not Work'
    };

    await expect(updatePartner(updateInput)).rejects.toThrow(/Partner with ID 99999 not found/i);
  });

  it('should handle boolean is_active field correctly', async () => {
    // Create active partner
    const createdPartner = await createTestPartner({
      ...testPartner,
      is_active: true
    });

    // Update to inactive
    const updateInput: UpdatePartnerInput = {
      id: createdPartner.id,
      is_active: false
    };

    const result = await updatePartner(updateInput);

    expect(result.is_active).toEqual(false);

    // Update back to active
    const updateInput2: UpdatePartnerInput = {
      id: createdPartner.id,
      is_active: true
    };

    const result2 = await updatePartner(updateInput2);
    expect(result2.is_active).toEqual(true);
  });

  it('should update multiple different field types together', async () => {
    // Create a test partner
    const createdPartner = await createTestPartner(testPartner);

    const updateInput: UpdatePartnerInput = {
      id: createdPartner.id,
      name: 'Multi Field Update',
      type: 'other',
      contact_info: null,
      is_active: false
    };

    const result = await updatePartner(updateInput);

    expect(result.name).toEqual('Multi Field Update');
    expect(result.type).toEqual('other');
    expect(result.contact_info).toBeNull();
    expect(result.is_active).toEqual(false);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdPartner.updated_at.getTime());

    // Verify all changes were persisted
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, result.id))
      .execute();

    const dbPartner = partners[0];
    expect(dbPartner.name).toEqual('Multi Field Update');
    expect(dbPartner.type).toEqual('other');
    expect(dbPartner.contact_info).toBeNull();
    expect(dbPartner.is_active).toEqual(false);
  });
});