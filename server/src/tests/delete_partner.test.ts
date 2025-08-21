import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, transactionsTable, auditLogsTable, carUnitsTable } from '../db/schema';
import { deletePartner } from '../handlers/delete_partner';
import { eq } from 'drizzle-orm';

describe('deletePartner', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete an active partner with no transactions', async () => {
    // Create a test partner
    const partnerResults = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        type: 'broker',
        contact_info: 'test@example.com',
        is_active: true
      })
      .returning()
      .execute();

    const partnerId = partnerResults[0].id;

    // Delete the partner
    const result = await deletePartner(partnerId);

    // Verify successful deletion
    expect(result.success).toBe(true);

    // Verify partner is now inactive in database
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, partnerId))
      .execute();

    expect(partners).toHaveLength(1);
    expect(partners[0].is_active).toBe(false);
    expect(partners[0].name).toBe('Test Partner'); // Other fields should remain unchanged
    expect(partners[0].type).toBe('broker');

    // Verify audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, partnerId))
      .execute();

    expect(auditLogs).toHaveLength(1);
    const auditLog = auditLogs[0];
    expect(auditLog.actor).toBe('system');
    expect(auditLog.entity_type).toBe('partner');
    expect(auditLog.action).toBe('delete');
    expect(auditLog.before_data).toBeDefined();
    expect(auditLog.after_data).toBeDefined();
    
    // Verify before_data shows partner was active
    expect((auditLog.before_data as any).is_active).toBe(true);
    // Verify after_data shows partner is now inactive
    expect((auditLog.after_data as any).is_active).toBe(false);
  });

  it('should throw error when partner does not exist', async () => {
    const nonExistentId = 999;

    await expect(deletePartner(nonExistentId))
      .rejects.toThrow(/Partner with id 999 not found/i);

    // Verify no audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, nonExistentId))
      .execute();

    expect(auditLogs).toHaveLength(0);
  });

  it('should throw error when partner is already inactive', async () => {
    // Create an inactive partner
    const partnerResults = await db.insert(partnersTable)
      .values({
        name: 'Inactive Partner',
        type: 'workshop',
        contact_info: null,
        is_active: false
      })
      .returning()
      .execute();

    const partnerId = partnerResults[0].id;

    await expect(deletePartner(partnerId))
      .rejects.toThrow(/Partner with id \d+ is already inactive/i);

    // Verify no audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, partnerId))
      .execute();

    expect(auditLogs).toHaveLength(0);
  });

  it('should throw error when partner has associated transactions', async () => {
    // Create a test partner
    const partnerResults = await db.insert(partnersTable)
      .values({
        name: 'Partner With Transactions',
        type: 'broker',
        contact_info: 'broker@example.com',
        is_active: true
      })
      .returning()
      .execute();

    const partnerId = partnerResults[0].id;

    // Create a car unit first (required for transaction foreign key)
    const carResults = await db.insert(carUnitsTable)
      .values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2020,
        transmission: 'automatic',
        odometer: 50000,
        color: 'White',
        stock_code: 'TEST001',
        status: 'bought'
      })
      .returning()
      .execute();

    const carId = carResults[0].id;

    // Create a transaction associated with this partner
    await db.insert(transactionsTable)
      .values({
        car_id: carId,
        partner_id: partnerId,
        type: 'broker_fee',
        amount: '500.00',
        description: 'Broker commission'
      })
      .execute();

    await expect(deletePartner(partnerId))
      .rejects.toThrow(/Cannot delete partner with id \d+ - has 1 associated transactions/i);

    // Verify partner is still active
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, partnerId))
      .execute();

    expect(partners[0].is_active).toBe(true);

    // Verify no audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, partnerId))
      .execute();

    expect(auditLogs).toHaveLength(0);
  });

  it('should handle partner with multiple transactions correctly', async () => {
    // Create a test partner
    const partnerResults = await db.insert(partnersTable)
      .values({
        name: 'Partner With Multiple Transactions',
        type: 'workshop',
        contact_info: 'workshop@example.com',
        is_active: true
      })
      .returning()
      .execute();

    const partnerId = partnerResults[0].id;

    // Create multiple car units
    const car1Results = await db.insert(carUnitsTable)
      .values({
        brand: 'Honda',
        model: 'Civic',
        year: 2019,
        transmission: 'manual',
        odometer: 30000,
        color: 'Blue',
        stock_code: 'TEST002',
        status: 'bought'
      })
      .returning()
      .execute();

    const car2Results = await db.insert(carUnitsTable)
      .values({
        brand: 'Ford',
        model: 'Focus',
        year: 2021,
        transmission: 'automatic',
        odometer: 15000,
        color: 'Red',
        stock_code: 'TEST003',
        status: 'recond'
      })
      .returning()
      .execute();

    // Create multiple transactions for this partner
    await db.insert(transactionsTable)
      .values([
        {
          car_id: car1Results[0].id,
          partner_id: partnerId,
          type: 'workshop',
          amount: '800.00',
          description: 'Repair work'
        },
        {
          car_id: car2Results[0].id,
          partner_id: partnerId,
          type: 'workshop',
          amount: '1200.00',
          description: 'Reconditioning'
        }
      ])
      .execute();

    await expect(deletePartner(partnerId))
      .rejects.toThrow(/Cannot delete partner with id \d+ - has 2 associated transactions/i);

    // Verify partner is still active
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, partnerId))
      .execute();

    expect(partners[0].is_active).toBe(true);
  });

  it('should preserve all partner data except is_active and updated_at', async () => {
    // Create a partner with all fields populated
    const originalData = {
      name: 'Complete Partner Data',
      type: 'transport' as const,
      contact_info: 'Complete contact information',
      is_active: true
    };

    const partnerResults = await db.insert(partnersTable)
      .values(originalData)
      .returning()
      .execute();

    const partnerId = partnerResults[0].id;
    const originalCreatedAt = partnerResults[0].created_at;
    const originalUpdatedAt = partnerResults[0].updated_at;

    // Delete the partner
    await deletePartner(partnerId);

    // Verify all fields are preserved except is_active and updated_at
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, partnerId))
      .execute();

    const updatedPartner = partners[0];
    expect(updatedPartner.name).toBe(originalData.name);
    expect(updatedPartner.type).toBe(originalData.type);
    expect(updatedPartner.contact_info).toBe(originalData.contact_info);
    expect(updatedPartner.is_active).toBe(false); // This should change
    expect(updatedPartner.created_at).toEqual(originalCreatedAt); // Should not change
    expect(updatedPartner.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime()); // Should be updated
  });
});