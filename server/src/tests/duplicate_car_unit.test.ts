import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { duplicateCarUnit } from '../handlers/duplicate_car_unit';
import { eq } from 'drizzle-orm';

describe('duplicateCarUnit', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestCarUnit = async () => {
    const result = await db.insert(carUnitsTable)
      .values({
        brand: 'Toyota',
        model: 'Corolla',
        year: 2020,
        transmission: 'automatic',
        odometer: 50000,
        color: 'Blue',
        vin: 'TEST123456789',
        stock_code: 'TOY001',
        location: 'Lot A',
        notes: 'Original car notes',
        primary_photo_url: 'https://example.com/photo.jpg',
        gallery_urls: ['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg'],
        documents: ['registration.pdf', 'inspection.pdf'],
        status: 'ready',
        sold_price: '25000.00'
      })
      .returning()
      .execute();

    return result[0];
  };

  it('should duplicate a car unit successfully', async () => {
    const originalCar = await createTestCarUnit();
    
    const duplicatedCar = await duplicateCarUnit(originalCar.id);

    // Should have a new ID
    expect(duplicatedCar.id).not.toEqual(originalCar.id);
    expect(duplicatedCar.id).toBeGreaterThan(0);

    // Should copy most fields from original
    expect(duplicatedCar.brand).toEqual('Toyota');
    expect(duplicatedCar.model).toEqual('Corolla');
    expect(duplicatedCar.year).toEqual(2020);
    expect(duplicatedCar.transmission).toEqual('automatic');
    expect(duplicatedCar.odometer).toEqual(50000);
    expect(duplicatedCar.color).toEqual('Blue');
    expect(duplicatedCar.vin).toEqual('TEST123456789');
    expect(duplicatedCar.location).toEqual('Lot A');
    expect(duplicatedCar.notes).toEqual('Original car notes');
    expect(duplicatedCar.primary_photo_url).toEqual('https://example.com/photo.jpg');
    expect(duplicatedCar.gallery_urls).toEqual(['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg']);
    expect(duplicatedCar.documents).toEqual(['registration.pdf', 'inspection.pdf']);

    // Should have different stock_code
    expect(duplicatedCar.stock_code).not.toEqual(originalCar.stock_code);
    expect(duplicatedCar.stock_code).toMatch(/^TOY001-DUP-\d+$/);

    // Should always be draft status
    expect(duplicatedCar.status).toEqual('draft');

    // Should not copy sold_price (always null for drafts)
    expect(duplicatedCar.sold_price).toBeNull();

    // Should have creation timestamps
    expect(duplicatedCar.created_at).toBeInstanceOf(Date);
    expect(duplicatedCar.updated_at).toBeInstanceOf(Date);
  });

  it('should save duplicated car to database', async () => {
    const originalCar = await createTestCarUnit();
    
    const duplicatedCar = await duplicateCarUnit(originalCar.id);

    // Verify it was saved to database
    const savedCars = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, duplicatedCar.id))
      .execute();

    expect(savedCars).toHaveLength(1);
    const savedCar = savedCars[0];
    
    expect(savedCar.brand).toEqual('Toyota');
    expect(savedCar.model).toEqual('Corolla');
    expect(savedCar.stock_code).toMatch(/^TOY001-DUP-\d+$/);
    expect(savedCar.status).toEqual('draft');
    expect(savedCar.sold_price).toBeNull();
  });

  it('should create audit log entry for duplication', async () => {
    const originalCar = await createTestCarUnit();
    
    const duplicatedCar = await duplicateCarUnit(originalCar.id);

    // Check audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, duplicatedCar.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    const auditLog = auditLogs[0];
    
    expect(auditLog.actor).toEqual('system');
    expect(auditLog.entity_type).toEqual('car_unit');
    expect(auditLog.entity_id).toEqual(duplicatedCar.id);
    expect(auditLog.action).toEqual('create');
    expect(auditLog.before_data).toBeNull();
    expect(auditLog.after_data).toEqual({
      action: 'duplicate',
      original_car_id: originalCar.id,
      duplicated_car_id: duplicatedCar.id,
      new_stock_code: duplicatedCar.stock_code
    });
  });

  it('should handle car with minimal data', async () => {
    // Create car with only required fields
    const minimalCar = await db.insert(carUnitsTable)
      .values({
        brand: 'Honda',
        model: 'Civic',
        year: 2018,
        transmission: 'manual',
        odometer: 75000,
        color: 'White',
        stock_code: 'HON001',
        status: 'bought'
      })
      .returning()
      .execute();

    const originalCar = minimalCar[0];
    const duplicatedCar = await duplicateCarUnit(originalCar.id);

    expect(duplicatedCar.brand).toEqual('Honda');
    expect(duplicatedCar.model).toEqual('Civic');
    expect(duplicatedCar.vin).toBeNull();
    expect(duplicatedCar.location).toBeNull();
    expect(duplicatedCar.notes).toBeNull();
    expect(duplicatedCar.primary_photo_url).toBeNull();
    expect(duplicatedCar.gallery_urls).toBeNull();
    expect(duplicatedCar.documents).toBeNull();
    expect(duplicatedCar.status).toEqual('draft');
    expect(duplicatedCar.sold_price).toBeNull();
  });

  it('should generate unique stock codes for multiple duplications', async () => {
    const originalCar = await createTestCarUnit();
    
    // Create multiple duplicates
    const duplicate1 = await duplicateCarUnit(originalCar.id);
    const duplicate2 = await duplicateCarUnit(originalCar.id);
    const duplicate3 = await duplicateCarUnit(originalCar.id);

    // All should have different stock codes
    const stockCodes = [duplicate1.stock_code, duplicate2.stock_code, duplicate3.stock_code];
    const uniqueStockCodes = new Set(stockCodes);
    
    expect(uniqueStockCodes.size).toEqual(3);
    
    // All should follow the pattern
    stockCodes.forEach(code => {
      expect(code).toMatch(/^TOY001-DUP-\d+$/);
    });
  });

  it('should throw error when car not found', async () => {
    await expect(duplicateCarUnit(999999)).rejects.toThrow(/Car unit with id 999999 not found/i);
  });

  it('should handle different car statuses correctly', async () => {
    // Test with sold car
    const soldCar = await db.insert(carUnitsTable)
      .values({
        brand: 'Ford',
        model: 'Focus',
        year: 2019,
        transmission: 'automatic',
        odometer: 60000,
        color: 'Black',
        stock_code: 'FORD001',
        status: 'sold',
        sold_price: '18000.50'
      })
      .returning()
      .execute();

    const duplicatedCar = await duplicateCarUnit(soldCar[0].id);

    // Even though original was sold with sold_price, duplicate should be draft with no sold_price
    expect(duplicatedCar.status).toEqual('draft');
    expect(duplicatedCar.sold_price).toBeNull();
  });
});