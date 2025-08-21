import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type UpdateCarUnitInput, type CreateCarUnitInput } from '../schema';
import { updateCarUnit } from '../handlers/update_car_unit';
import { eq } from 'drizzle-orm';

// Helper function to create a test car unit
const createTestCarUnit = async (overrides: Partial<CreateCarUnitInput> = {}) => {
  const testCarUnit: CreateCarUnitInput = {
    brand: 'Test Brand',
    model: 'Test Model',
    year: 2020,
    transmission: 'manual',
    odometer: 50000,
    color: 'Blue',
    vin: 'TEST123456789',
    stock_code: 'TEST001',
    location: 'Warehouse A',
    notes: 'Test notes',
    primary_photo_url: 'https://example.com/photo.jpg',
    gallery_urls: ['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg'],
    documents: ['title.pdf', 'inspection.pdf'],
    status: 'draft',
    sold_price: null,
    ...overrides
  };

  const result = await db.insert(carUnitsTable)
    .values({
      ...testCarUnit,
      sold_price: testCarUnit.sold_price?.toString()
    })
    .returning()
    .execute();

  return {
    ...result[0],
    sold_price: result[0].sold_price ? parseFloat(result[0].sold_price) : null
  };
};

describe('updateCarUnit', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update basic car unit fields', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      brand: 'Updated Brand',
      model: 'Updated Model',
      year: 2022,
      transmission: 'automatic',
      odometer: 75000,
      color: 'Red'
    };

    const result = await updateCarUnit(updateInput);

    // Verify updated fields
    expect(result.id).toEqual(existingCarUnit.id);
    expect(result.brand).toEqual('Updated Brand');
    expect(result.model).toEqual('Updated Model');
    expect(result.year).toEqual(2022);
    expect(result.transmission).toEqual('automatic');
    expect(result.odometer).toEqual(75000);
    expect(result.color).toEqual('Red');

    // Verify unchanged fields
    expect(result.vin).toEqual(existingCarUnit.vin);
    expect(result.stock_code).toEqual(existingCarUnit.stock_code);
    expect(result.location).toEqual(existingCarUnit.location);
    expect(result.notes).toEqual(existingCarUnit.notes);
    expect(result.status).toEqual(existingCarUnit.status);

    // Verify timestamps
    expect(result.created_at).toEqual(existingCarUnit.created_at);
    expect(result.updated_at).not.toEqual(existingCarUnit.updated_at);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update stock code and validate uniqueness', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      stock_code: 'NEW_STOCK_001'
    };

    const result = await updateCarUnit(updateInput);

    expect(result.stock_code).toEqual('NEW_STOCK_001');
    expect(result.brand).toEqual(existingCarUnit.brand); // Other fields unchanged
  });

  it('should handle nullable fields correctly', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      vin: null,
      location: null,
      notes: null,
      primary_photo_url: null,
      gallery_urls: null,
      documents: null,
      sold_price: null
    };

    const result = await updateCarUnit(updateInput);

    expect(result.vin).toBeNull();
    expect(result.location).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.primary_photo_url).toBeNull();
    expect(result.gallery_urls).toBeNull();
    expect(result.documents).toBeNull();
    expect(result.sold_price).toBeNull();
  });

  it('should handle array fields correctly', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      gallery_urls: ['https://example.com/new1.jpg', 'https://example.com/new2.jpg', 'https://example.com/new3.jpg'],
      documents: ['new_title.pdf', 'new_inspection.pdf', 'warranty.pdf']
    };

    const result = await updateCarUnit(updateInput);

    expect(result.gallery_urls).toEqual(['https://example.com/new1.jpg', 'https://example.com/new2.jpg', 'https://example.com/new3.jpg']);
    expect(result.documents).toEqual(['new_title.pdf', 'new_inspection.pdf', 'warranty.pdf']);
  });

  it('should handle numeric sold_price correctly', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      sold_price: 25000.50,
      status: 'sold'
    };

    const result = await updateCarUnit(updateInput);

    expect(result.sold_price).toEqual(25000.50);
    expect(typeof result.sold_price).toBe('number');
    expect(result.status).toEqual('sold');
  });

  it('should update status correctly', async () => {
    const existingCarUnit = await createTestCarUnit({ status: 'draft' });

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      status: 'ready'
    };

    const result = await updateCarUnit(updateInput);

    expect(result.status).toEqual('ready');
  });

  it('should save changes to database', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      brand: 'Database Test Brand',
      model: 'Database Test Model'
    };

    await updateCarUnit(updateInput);

    // Verify in database
    const carUnitsFromDb = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, existingCarUnit.id))
      .execute();

    expect(carUnitsFromDb).toHaveLength(1);
    expect(carUnitsFromDb[0].brand).toEqual('Database Test Brand');
    expect(carUnitsFromDb[0].model).toEqual('Database Test Model');
  });

  it('should create audit log entry', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      brand: 'Audit Test Brand',
      status: 'ready'
    };

    await updateCarUnit(updateInput);

    // Check audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, existingCarUnit.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    
    const auditLog = auditLogs[0];
    expect(auditLog.entity_type).toEqual('car_unit');
    expect(auditLog.action).toEqual('update');
    expect(auditLog.actor).toEqual('system');
    expect(auditLog.before_data).toBeDefined();
    expect(auditLog.after_data).toBeDefined();
    
    // Verify before_data contains original values
    expect(auditLog.before_data).toMatchObject({
      brand: existingCarUnit.brand,
      status: existingCarUnit.status
    });
    
    // Verify after_data contains updated values
    expect(auditLog.after_data).toMatchObject({
      brand: 'Audit Test Brand',
      status: 'ready'
    });
  });

  it('should throw error when car unit not found', async () => {
    const updateInput: UpdateCarUnitInput = {
      id: 999999, // Non-existent ID
      brand: 'Non-existent Brand'
    };

    await expect(updateCarUnit(updateInput)).rejects.toThrow(/Car unit with id 999999 not found/i);
  });

  it('should throw error when stock_code already exists', async () => {
    // Create two car units
    const carUnit1 = await createTestCarUnit({ stock_code: 'EXISTING001' });
    const carUnit2 = await createTestCarUnit({ stock_code: 'EXISTING002' });

    // Try to update carUnit2 with carUnit1's stock_code
    const updateInput: UpdateCarUnitInput = {
      id: carUnit2.id,
      stock_code: 'EXISTING001'
    };

    await expect(updateCarUnit(updateInput)).rejects.toThrow(/Stock code EXISTING001 already exists/i);
  });

  it('should allow updating stock_code to same value', async () => {
    const existingCarUnit = await createTestCarUnit({ stock_code: 'SAME001' });

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      stock_code: 'SAME001', // Same stock code
      brand: 'Updated Brand'
    };

    const result = await updateCarUnit(updateInput);

    expect(result.stock_code).toEqual('SAME001');
    expect(result.brand).toEqual('Updated Brand');
  });

  it('should handle partial updates correctly', async () => {
    const existingCarUnit = await createTestCarUnit();

    // Update only one field
    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      notes: 'Only notes updated'
    };

    const result = await updateCarUnit(updateInput);

    // Verify only notes changed
    expect(result.notes).toEqual('Only notes updated');
    expect(result.brand).toEqual(existingCarUnit.brand);
    expect(result.model).toEqual(existingCarUnit.model);
    expect(result.year).toEqual(existingCarUnit.year);
    expect(result.odometer).toEqual(existingCarUnit.odometer);
  });

  it('should handle complex update with multiple field types', async () => {
    const existingCarUnit = await createTestCarUnit();

    const updateInput: UpdateCarUnitInput = {
      id: existingCarUnit.id,
      brand: 'Complex Brand',
      year: 2023,
      transmission: 'cvt',
      odometer: 10000,
      vin: 'COMPLEX123456789',
      gallery_urls: ['https://complex.com/photo1.jpg'],
      documents: ['complex_doc.pdf'],
      status: 'listed',
      sold_price: 35000.75,
      location: 'New Location',
      notes: 'Complex update notes'
    };

    const result = await updateCarUnit(updateInput);

    expect(result.brand).toEqual('Complex Brand');
    expect(result.year).toEqual(2023);
    expect(result.transmission).toEqual('cvt');
    expect(result.odometer).toEqual(10000);
    expect(result.vin).toEqual('COMPLEX123456789');
    expect(result.gallery_urls).toEqual(['https://complex.com/photo1.jpg']);
    expect(result.documents).toEqual(['complex_doc.pdf']);
    expect(result.status).toEqual('listed');
    expect(result.sold_price).toEqual(35000.75);
    expect(typeof result.sold_price).toBe('number');
    expect(result.location).toEqual('New Location');
    expect(result.notes).toEqual('Complex update notes');
  });
});