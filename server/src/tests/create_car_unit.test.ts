import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type CreateCarUnitInput } from '../schema';
import { createCarUnit } from '../handlers/create_car_unit';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateCarUnitInput = {
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
  transmission: 'automatic',
  odometer: 25000,
  color: 'Silver',
  vin: '1HGBH41JXMN109186',
  stock_code: 'TC001',
  location: 'Lot A',
  notes: 'Good condition vehicle',
  primary_photo_url: 'https://example.com/photo.jpg',
  gallery_urls: ['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg'],
  documents: ['https://example.com/title.pdf', 'https://example.com/inspection.pdf'],
  status: 'bought',
  sold_price: 18500.50
};

// Minimal required input
const minimalInput: CreateCarUnitInput = {
  brand: 'Honda',
  model: 'Civic',
  year: 2019,
  transmission: 'manual',
  odometer: 30000,
  color: 'Blue',
  stock_code: 'HC001'
};

describe('createCarUnit', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a car unit with all fields', async () => {
    const result = await createCarUnit(testInput);

    // Validate all fields are correctly set
    expect(result.brand).toEqual('Toyota');
    expect(result.model).toEqual('Corolla');
    expect(result.year).toEqual(2020);
    expect(result.transmission).toEqual('automatic');
    expect(result.odometer).toEqual(25000);
    expect(result.color).toEqual('Silver');
    expect(result.vin).toEqual('1HGBH41JXMN109186');
    expect(result.stock_code).toEqual('TC001');
    expect(result.location).toEqual('Lot A');
    expect(result.notes).toEqual('Good condition vehicle');
    expect(result.primary_photo_url).toEqual('https://example.com/photo.jpg');
    expect(result.gallery_urls).toEqual(['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg']);
    expect(result.documents).toEqual(['https://example.com/title.pdf', 'https://example.com/inspection.pdf']);
    expect(result.status).toEqual('bought');
    expect(result.sold_price).toEqual(18500.50);
    expect(typeof result.sold_price).toEqual('number');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a car unit with minimal fields and defaults', async () => {
    const result = await createCarUnit(minimalInput);

    // Validate required fields
    expect(result.brand).toEqual('Honda');
    expect(result.model).toEqual('Civic');
    expect(result.year).toEqual(2019);
    expect(result.transmission).toEqual('manual');
    expect(result.odometer).toEqual(30000);
    expect(result.color).toEqual('Blue');
    expect(result.stock_code).toEqual('HC001');

    // Validate defaults and nulls
    expect(result.vin).toBeNull();
    expect(result.location).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.primary_photo_url).toBeNull();
    expect(result.gallery_urls).toBeNull();
    expect(result.documents).toBeNull();
    expect(result.status).toEqual('draft'); // Default status
    expect(result.sold_price).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save car unit to database correctly', async () => {
    const result = await createCarUnit(testInput);

    // Query the database directly
    const savedUnits = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, result.id))
      .execute();

    expect(savedUnits).toHaveLength(1);
    const savedUnit = savedUnits[0];

    expect(savedUnit.brand).toEqual('Toyota');
    expect(savedUnit.model).toEqual('Corolla');
    expect(savedUnit.year).toEqual(2020);
    expect(savedUnit.transmission).toEqual('automatic');
    expect(savedUnit.odometer).toEqual(25000);
    expect(savedUnit.color).toEqual('Silver');
    expect(savedUnit.vin).toEqual('1HGBH41JXMN109186');
    expect(savedUnit.stock_code).toEqual('TC001');
    expect(savedUnit.location).toEqual('Lot A');
    expect(savedUnit.notes).toEqual('Good condition vehicle');
    expect(savedUnit.status).toEqual('bought');
    expect(parseFloat(savedUnit.sold_price!)).toEqual(18500.50); // Check numeric conversion
    expect(savedUnit.created_at).toBeInstanceOf(Date);
    expect(savedUnit.updated_at).toBeInstanceOf(Date);
  });

  it('should create audit log entry', async () => {
    const result = await createCarUnit(testInput);

    // Check audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, result.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    const auditLog = auditLogs[0];

    expect(auditLog.actor).toEqual('system');
    expect(auditLog.entity_type).toEqual('car_unit');
    expect(auditLog.entity_id).toEqual(result.id);
    expect(auditLog.action).toEqual('create');
    expect(auditLog.before_data).toBeNull();
    expect(auditLog.after_data).toBeDefined();
    expect(auditLog.after_data).toHaveProperty('brand', 'Toyota');
    expect(auditLog.after_data).toHaveProperty('stock_code', 'TC001');
    expect(auditLog.created_at).toBeInstanceOf(Date);
  });

  it('should reject duplicate stock codes', async () => {
    // Create first car unit
    await createCarUnit(testInput);

    // Try to create another with same stock code
    const duplicateInput = {
      ...minimalInput,
      stock_code: 'TC001' // Same as testInput
    };

    expect(createCarUnit(duplicateInput)).rejects.toThrow(/stock code.*already exists/i);
  });

  it('should handle null optional fields correctly', async () => {
    const inputWithNulls: CreateCarUnitInput = {
      ...minimalInput,
      vin: null,
      location: null,
      notes: null,
      primary_photo_url: null,
      gallery_urls: null,
      documents: null,
      sold_price: null
    };

    const result = await createCarUnit(inputWithNulls);

    expect(result.vin).toBeNull();
    expect(result.location).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.primary_photo_url).toBeNull();
    expect(result.gallery_urls).toBeNull();
    expect(result.documents).toBeNull();
    expect(result.sold_price).toBeNull();
  });

  it('should handle various transmission types', async () => {
    const manualInput = { ...minimalInput, stock_code: 'MANUAL001', transmission: 'manual' as const };
    const automaticInput = { ...minimalInput, stock_code: 'AUTO001', transmission: 'automatic' as const };
    const cvtInput = { ...minimalInput, stock_code: 'CVT001', transmission: 'cvt' as const };

    const manualResult = await createCarUnit(manualInput);
    const automaticResult = await createCarUnit(automaticInput);
    const cvtResult = await createCarUnit(cvtInput);

    expect(manualResult.transmission).toEqual('manual');
    expect(automaticResult.transmission).toEqual('automatic');
    expect(cvtResult.transmission).toEqual('cvt');
  });

  it('should handle various status types', async () => {
    const draftInput = { ...minimalInput, stock_code: 'DRAFT001', status: 'draft' as const };
    const boughtInput = { ...minimalInput, stock_code: 'BOUGHT001', status: 'bought' as const };
    const soldInput = { ...minimalInput, stock_code: 'SOLD001', status: 'sold' as const };

    const draftResult = await createCarUnit(draftInput);
    const boughtResult = await createCarUnit(boughtInput);
    const soldResult = await createCarUnit(soldInput);

    expect(draftResult.status).toEqual('draft');
    expect(boughtResult.status).toEqual('bought');
    expect(soldResult.status).toEqual('sold');
  });

  it('should handle sold_price numeric conversion correctly', async () => {
    const inputWithPrice: CreateCarUnitInput = {
      ...minimalInput,
      stock_code: 'PRICE001',
      sold_price: 15000.75
    };

    const result = await createCarUnit(inputWithPrice);

    // Verify return value is a number
    expect(typeof result.sold_price).toEqual('number');
    expect(result.sold_price).toEqual(15000.75);

    // Verify database storage is correct
    const savedUnits = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, result.id))
      .execute();

    const savedUnit = savedUnits[0];
    expect(typeof savedUnit.sold_price).toEqual('string'); // Database stores as string
    expect(parseFloat(savedUnit.sold_price!)).toEqual(15000.75);
  });
});