import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, auditLogsTable } from '../db/schema';
import { type CreatePartnerInput } from '../schema';
import { createPartner } from '../handlers/create_partner';
import { eq } from 'drizzle-orm';

// Basic test input
const testInput: CreatePartnerInput = {
  name: 'Test Partner',
  type: 'broker',
  contact_info: 'test@partner.com',
  is_active: true
};

describe('createPartner', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a partner with all fields', async () => {
    const result = await createPartner(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Partner');
    expect(result.type).toEqual('broker');
    expect(result.contact_info).toEqual('test@partner.com');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a partner with minimal fields', async () => {
    const minimalInput: CreatePartnerInput = {
      name: 'Minimal Partner',
      type: 'workshop'
    };

    const result = await createPartner(minimalInput);

    expect(result.name).toEqual('Minimal Partner');
    expect(result.type).toEqual('workshop');
    expect(result.contact_info).toBeNull();
    expect(result.is_active).toEqual(true); // Should default to true
    expect(result.id).toBeDefined();
  });

  it('should save partner to database', async () => {
    const result = await createPartner(testInput);

    // Query using proper drizzle syntax
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, result.id))
      .execute();

    expect(partners).toHaveLength(1);
    expect(partners[0].name).toEqual('Test Partner');
    expect(partners[0].type).toEqual('broker');
    expect(partners[0].contact_info).toEqual('test@partner.com');
    expect(partners[0].is_active).toEqual(true);
    expect(partners[0].created_at).toBeInstanceOf(Date);
    expect(partners[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create an audit log entry', async () => {
    const result = await createPartner(testInput);

    // Check audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, result.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    
    const auditLog = auditLogs[0];
    expect(auditLog.actor).toEqual('system');
    expect(auditLog.entity_type).toEqual('partner');
    expect(auditLog.entity_id).toEqual(result.id);
    expect(auditLog.action).toEqual('create');
    expect(auditLog.before_data).toBeNull();
    expect(auditLog.after_data).toEqual({
      id: result.id,
      name: result.name,
      type: result.type,
      contact_info: result.contact_info,
      is_active: result.is_active
    });
    expect(auditLog.created_at).toBeInstanceOf(Date);
  });

  it('should handle all partner types', async () => {
    const partnerTypes = ['broker', 'workshop', 'salon', 'transport', 'other'] as const;

    for (const type of partnerTypes) {
      const input: CreatePartnerInput = {
        name: `Test ${type} Partner`,
        type: type
      };

      const result = await createPartner(input);
      expect(result.type).toEqual(type);
      expect(result.name).toEqual(`Test ${type} Partner`);
    }
  });

  it('should handle null contact_info explicitly', async () => {
    const inputWithNullContact: CreatePartnerInput = {
      name: 'Partner No Contact',
      type: 'other',
      contact_info: null
    };

    const result = await createPartner(inputWithNullContact);
    expect(result.contact_info).toBeNull();
  });

  it('should handle is_active false', async () => {
    const inactiveInput: CreatePartnerInput = {
      name: 'Inactive Partner',
      type: 'salon',
      is_active: false
    };

    const result = await createPartner(inactiveInput);
    expect(result.is_active).toEqual(false);
  });

  it('should create multiple partners successfully', async () => {
    const partner1 = await createPartner({
      name: 'Partner One',
      type: 'broker'
    });

    const partner2 = await createPartner({
      name: 'Partner Two',
      type: 'workshop'
    });

    expect(partner1.id).not.toEqual(partner2.id);
    expect(partner1.name).toEqual('Partner One');
    expect(partner2.name).toEqual('Partner Two');

    // Verify both are in database
    const allPartners = await db.select()
      .from(partnersTable)
      .execute();

    expect(allPartners).toHaveLength(2);
  });

  it('should create unique audit logs for each partner', async () => {
    const partner1 = await createPartner({
      name: 'Partner One',
      type: 'broker'
    });

    const partner2 = await createPartner({
      name: 'Partner Two',
      type: 'workshop'
    });

    // Check audit logs were created for both partners
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .execute();

    expect(auditLogs).toHaveLength(2);
    
    const partner1Audit = auditLogs.find(log => log.entity_id === partner1.id);
    const partner2Audit = auditLogs.find(log => log.entity_id === partner2.id);

    expect(partner1Audit).toBeDefined();
    expect(partner2Audit).toBeDefined();
    
    expect(partner1Audit!.after_data).toEqual({
      id: partner1.id,
      name: 'Partner One',
      type: 'broker',
      contact_info: null,
      is_active: true
    });

    expect(partner2Audit!.after_data).toEqual({
      id: partner2.id,
      name: 'Partner Two',
      type: 'workshop', 
      contact_info: null,
      is_active: true
    });
  });
});