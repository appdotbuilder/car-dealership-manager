import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, partnersTable, transactionsTable } from '../db/schema';
import { type CreateCarUnitInput } from '../schema';
import { getCarUnitById } from '../handlers/get_car_unit_by_id';

// Complete test input with all required fields
const testCarInput: CreateCarUnitInput = {
  brand: 'Toyota',
  model: 'Camry',
  year: 2020,
  transmission: 'automatic',
  odometer: 45000,
  color: 'Silver',
  stock_code: 'TOY-CAM-2020-001',
  vin: '1HGBH41JXMN109186',
  location: 'Main Lot',
  notes: 'Excellent condition',
  primary_photo_url: 'https://example.com/photo.jpg',
  gallery_urls: ['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg'],
  documents: ['title.pdf', 'inspection.pdf'],
  status: 'ready',
  sold_price: 25000.00
};

describe('getCarUnitById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return car unit when found', async () => {
    // Create test car unit
    const insertResult = await db.insert(carUnitsTable)
      .values({
        ...testCarInput,
        sold_price: testCarInput.sold_price?.toString(), // Convert to string for DB
        gallery_urls: testCarInput.gallery_urls || null,
        documents: testCarInput.documents || null
      })
      .returning()
      .execute();

    const createdCarId = insertResult[0].id;

    // Retrieve car unit
    const result = await getCarUnitById(createdCarId);

    // Validate result
    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdCarId);
    expect(result!.brand).toBe('Toyota');
    expect(result!.model).toBe('Camry');
    expect(result!.year).toBe(2020);
    expect(result!.transmission).toBe('automatic');
    expect(result!.odometer).toBe(45000);
    expect(result!.color).toBe('Silver');
    expect(result!.stock_code).toBe('TOY-CAM-2020-001');
    expect(result!.vin).toBe('1HGBH41JXMN109186');
    expect(result!.location).toBe('Main Lot');
    expect(result!.notes).toBe('Excellent condition');
    expect(result!.primary_photo_url).toBe('https://example.com/photo.jpg');
    expect(result!.gallery_urls).toEqual(['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg']);
    expect(result!.documents).toEqual(['title.pdf', 'inspection.pdf']);
    expect(result!.status).toBe('ready');
    expect(result!.sold_price).toBe(25000.00); // Should be converted back to number
    expect(typeof result!.sold_price).toBe('number');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when car unit not found', async () => {
    const result = await getCarUnitById(99999);
    expect(result).toBeNull();
  });

  it('should handle car unit with null optional fields', async () => {
    // Create minimal car unit
    const minimalCarInput = {
      brand: 'Honda',
      model: 'Civic',
      year: 2019,
      transmission: 'manual' as const,
      odometer: 30000,
      color: 'Blue',
      stock_code: 'HON-CIV-2019-001'
    };

    const insertResult = await db.insert(carUnitsTable)
      .values(minimalCarInput)
      .returning()
      .execute();

    const createdCarId = insertResult[0].id;

    // Retrieve car unit
    const result = await getCarUnitById(createdCarId);

    // Validate result with null fields
    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdCarId);
    expect(result!.brand).toBe('Honda');
    expect(result!.model).toBe('Civic');
    expect(result!.year).toBe(2019);
    expect(result!.transmission).toBe('manual');
    expect(result!.odometer).toBe(30000);
    expect(result!.color).toBe('Blue');
    expect(result!.stock_code).toBe('HON-CIV-2019-001');
    expect(result!.vin).toBeNull();
    expect(result!.location).toBeNull();
    expect(result!.notes).toBeNull();
    expect(result!.primary_photo_url).toBeNull();
    expect(result!.gallery_urls).toBeNull();
    expect(result!.documents).toBeNull();
    expect(result!.status).toBe('draft'); // Default status
    expect(result!.sold_price).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should handle car unit with sold status and sold_price', async () => {
    const soldCarInput = {
      ...testCarInput,
      status: 'sold' as const,
      sold_price: 22500.50
    };

    const insertResult = await db.insert(carUnitsTable)
      .values({
        ...soldCarInput,
        sold_price: soldCarInput.sold_price.toString() // Convert to string for DB
      })
      .returning()
      .execute();

    const createdCarId = insertResult[0].id;

    // Retrieve sold car unit
    const result = await getCarUnitById(createdCarId);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('sold');
    expect(result!.sold_price).toBe(22500.50);
    expect(typeof result!.sold_price).toBe('number');
  });

  it('should handle different transmission types', async () => {
    // Test CVT transmission
    const cvtCarInput = {
      brand: 'Nissan',
      model: 'Altima',
      year: 2021,
      transmission: 'cvt' as const,
      odometer: 15000,
      color: 'White',
      stock_code: 'NIS-ALT-2021-001'
    };

    const insertResult = await db.insert(carUnitsTable)
      .values(cvtCarInput)
      .returning()
      .execute();

    const createdCarId = insertResult[0].id;

    const result = await getCarUnitById(createdCarId);

    expect(result).not.toBeNull();
    expect(result!.transmission).toBe('cvt');
    expect(result!.brand).toBe('Nissan');
    expect(result!.model).toBe('Altima');
  });

  it('should handle various unit statuses', async () => {
    const statuses = ['draft', 'bought', 'recond', 'ready', 'listed', 'sold', 'archived'] as const;
    
    for (const status of statuses) {
      const statusCarInput = {
        brand: 'Ford',
        model: 'Focus',
        year: 2018,
        transmission: 'automatic' as const,
        odometer: 50000,
        color: 'Red',
        stock_code: `FORD-${status.toUpperCase()}-001`,
        status
      };

      const insertResult = await db.insert(carUnitsTable)
        .values(statusCarInput)
        .returning()
        .execute();

      const createdCarId = insertResult[0].id;
      const result = await getCarUnitById(createdCarId);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(status);
      expect(result!.stock_code).toBe(`FORD-${status.toUpperCase()}-001`);
    }
  });

  it('should handle numeric precision correctly', async () => {
    const precisionTestInput = {
      brand: 'BMW',
      model: 'X3',
      year: 2022,
      transmission: 'automatic' as const,
      odometer: 8500,
      color: 'Black',
      stock_code: 'BMW-X3-2022-001',
      sold_price: 45999.99 // Test decimal precision
    };

    const insertResult = await db.insert(carUnitsTable)
      .values({
        ...precisionTestInput,
        sold_price: precisionTestInput.sold_price.toString()
      })
      .returning()
      .execute();

    const createdCarId = insertResult[0].id;
    const result = await getCarUnitById(createdCarId);

    expect(result).not.toBeNull();
    expect(result!.sold_price).toBe(45999.99);
    expect(typeof result!.sold_price).toBe('number');
  });
});