import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { archiveCarUnit } from '../handlers/archive_car_unit';
import { eq } from 'drizzle-orm';

// Test helper to create a car unit with specific status
const createTestCar = async (status: 'draft' | 'sold' | 'listed' = 'sold') => {
  const cars = await db.insert(carUnitsTable)
    .values({
      brand: 'Test Brand',
      model: 'Test Model',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'Blue',
      stock_code: `TEST${Date.now()}`, // Unique stock code
      status: status,
      sold_price: status === 'sold' ? '25000.00' : null
    })
    .returning()
    .execute();
  
  return cars[0];
};

describe('archiveCarUnit', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should archive a sold car unit', async () => {
    // Create a sold car unit
    const testCar = await createTestCar('sold');

    const result = await archiveCarUnit(testCar.id);

    // Verify the returned car unit
    expect(result.id).toEqual(testCar.id);
    expect(result.status).toEqual('archived');
    expect(result.brand).toEqual('Test Brand');
    expect(result.model).toEqual('Test Model');
    expect(result.sold_price).toEqual(25000); // Numeric conversion
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > testCar.updated_at).toBe(true); // Updated timestamp should be newer
  });

  it('should update car unit in database', async () => {
    const testCar = await createTestCar('sold');

    await archiveCarUnit(testCar.id);

    // Verify database was updated
    const updatedCars = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, testCar.id))
      .execute();

    expect(updatedCars).toHaveLength(1);
    expect(updatedCars[0].status).toEqual('archived');
    expect(updatedCars[0].updated_at).toBeInstanceOf(Date);
    expect(updatedCars[0].updated_at > testCar.updated_at).toBe(true);
  });

  it('should create audit log entry for archiving', async () => {
    const testCar = await createTestCar('sold');

    await archiveCarUnit(testCar.id);

    // Verify audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, testCar.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    
    const auditLog = auditLogs[0];
    expect(auditLog.actor).toEqual('system');
    expect(auditLog.entity_type).toEqual('car_unit');
    expect(auditLog.entity_id).toEqual(testCar.id);
    expect(auditLog.action).toEqual('status_change');
    expect(auditLog.before_data).toEqual({ status: 'sold' });
    expect(auditLog.after_data).toEqual({ status: 'archived' });
    expect(auditLog.created_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent car unit', async () => {
    const nonExistentId = 99999;

    await expect(archiveCarUnit(nonExistentId)).rejects.toThrow(/Car unit with ID 99999 not found/);
  });

  it('should throw error when trying to archive non-sold car (draft status)', async () => {
    const testCar = await createTestCar('draft');

    await expect(archiveCarUnit(testCar.id)).rejects.toThrow(
      /Cannot archive car unit with status 'draft'. Only 'sold' cars can be archived/
    );
  });

  it('should throw error when trying to archive non-sold car (listed status)', async () => {
    const testCar = await createTestCar('listed');

    await expect(archiveCarUnit(testCar.id)).rejects.toThrow(
      /Cannot archive car unit with status 'listed'. Only 'sold' cars can be archived/
    );
  });

  it('should handle car unit with null sold_price correctly', async () => {
    // Create a sold car without sold_price (edge case)
    const cars = await db.insert(carUnitsTable)
      .values({
        brand: 'Test Brand',
        model: 'Test Model',
        year: 2020,
        transmission: 'manual',
        odometer: 75000,
        color: 'Red',
        stock_code: `NULL${Date.now()}`,
        status: 'sold',
        sold_price: null // Sold but price not set
      })
      .returning()
      .execute();

    const testCar = cars[0];
    const result = await archiveCarUnit(testCar.id);

    expect(result.sold_price).toBeNull();
    expect(result.status).toEqual('archived');
  });

  it('should preserve all other car unit fields when archiving', async () => {
    // Create a car with comprehensive data
    const cars = await db.insert(carUnitsTable)
      .values({
        brand: 'Honda',
        model: 'Civic',
        year: 2019,
        transmission: 'cvt',
        odometer: 30000,
        color: 'White',
        vin: 'VIN123456789',
        stock_code: `PRESERVE${Date.now()}`,
        location: 'Lot A',
        notes: 'Excellent condition',
        primary_photo_url: 'https://example.com/photo.jpg',
        gallery_urls: ['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg'],
        documents: ['registration.pdf', 'inspection.pdf'],
        status: 'sold',
        sold_price: '18500.50'
      })
      .returning()
      .execute();

    const testCar = cars[0];
    const result = await archiveCarUnit(testCar.id);

    // Verify all fields are preserved except status and updated_at
    expect(result.brand).toEqual('Honda');
    expect(result.model).toEqual('Civic');
    expect(result.year).toEqual(2019);
    expect(result.transmission).toEqual('cvt');
    expect(result.odometer).toEqual(30000);
    expect(result.color).toEqual('White');
    expect(result.vin).toEqual('VIN123456789');
    expect(result.stock_code).toEqual(testCar.stock_code);
    expect(result.location).toEqual('Lot A');
    expect(result.notes).toEqual('Excellent condition');
    expect(result.primary_photo_url).toEqual('https://example.com/photo.jpg');
    expect(result.gallery_urls).toEqual(['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg']);
    expect(result.documents).toEqual(['registration.pdf', 'inspection.pdf']);
    expect(result.sold_price).toEqual(18500.5); // Numeric conversion
    expect(result.status).toEqual('archived');
    expect(result.created_at).toEqual(testCar.created_at);
  });
});