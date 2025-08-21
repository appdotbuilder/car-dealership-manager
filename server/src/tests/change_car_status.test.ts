import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type ChangeStatusInput, type CreateCarUnitInput } from '../schema';
import { changeCarStatus } from '../handlers/change_car_status';
import { eq } from 'drizzle-orm';

// Test helper to create a car unit
const createTestCar = async (status: 'draft' | 'bought' | 'recond' | 'ready' | 'listed' | 'sold' = 'draft'): Promise<number> => {
  const carInput: CreateCarUnitInput = {
    brand: 'Toyota',
    model: 'Camry',
    year: 2020,
    transmission: 'automatic',
    odometer: 50000,
    color: 'White',
    stock_code: `TEST-${Date.now()}`,
    status: status
  };

  const result = await db.insert(carUnitsTable)
    .values({
      ...carInput,
      sold_price: carInput.sold_price ? carInput.sold_price.toString() : null
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('changeCarStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully change status from draft to bought', async () => {
    const carId = await createTestCar('draft');
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'bought',
      notes: 'Purchased from dealer'
    };

    const result = await changeCarStatus(input);

    expect(result.id).toEqual(carId);
    expect(result.status).toEqual('bought');
    expect(result.notes).toEqual('Purchased from dealer');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should successfully change status from bought to ready (skipping recond)', async () => {
    const carId = await createTestCar('bought');
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'ready'
    };

    const result = await changeCarStatus(input);

    expect(result.id).toEqual(carId);
    expect(result.status).toEqual('ready');
  });

  it('should successfully change status from listed to recond (backward transition)', async () => {
    const carId = await createTestCar('listed');
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'recond',
      notes: 'Needs additional work'
    };

    const result = await changeCarStatus(input);

    expect(result.id).toEqual(carId);
    expect(result.status).toEqual('recond');
    expect(result.notes).toEqual('Needs additional work');
  });

  it('should create audit log entry for status change', async () => {
    const carId = await createTestCar('draft');
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'bought'
    };

    await changeCarStatus(input);

    // Check audit log was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, carId))
      .execute();

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].entity_type).toEqual('car_unit');
    expect(auditLogs[0].action).toEqual('status_change');
    expect(auditLogs[0].actor).toEqual('system');
    expect(auditLogs[0].before_data).toEqual({ status: 'draft', notes: null });
    expect(auditLogs[0].after_data).toEqual({ status: 'bought', notes: null });
    expect(auditLogs[0].created_at).toBeInstanceOf(Date);
  });

  it('should update car in database', async () => {
    const carId = await createTestCar('bought');
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'ready',
      notes: 'Ready for sale'
    };

    await changeCarStatus(input);

    // Verify database was updated
    const cars = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    expect(cars).toHaveLength(1);
    expect(cars[0].status).toEqual('ready');
    expect(cars[0].notes).toEqual('Ready for sale');
  });

  it('should throw error for non-existent car', async () => {
    const input: ChangeStatusInput = {
      car_id: 99999,
      new_status: 'bought'
    };

    expect(changeCarStatus(input)).rejects.toThrow(/not found/i);
  });

  it('should throw error for invalid status transition', async () => {
    const carId = await createTestCar('draft');
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'listed' // Invalid: can't go from draft to listed
    };

    expect(changeCarStatus(input)).rejects.toThrow(/invalid status transition/i);
  });

  it('should throw error when trying to transition from archived', async () => {
    const carId = await createTestCar();
    
    // First change to archived
    await changeCarStatus({
      car_id: carId,
      new_status: 'archived'
    });
    
    // Then try to change from archived (should fail)
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'bought'
    };

    expect(changeCarStatus(input)).rejects.toThrow(/invalid status transition/i);
  });

  it('should throw error when changing to same status', async () => {
    const carId = await createTestCar('bought');
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'bought'
    };

    expect(changeCarStatus(input)).rejects.toThrow(/already in status/i);
  });

  it('should preserve existing notes when no new notes provided', async () => {
    // Create car with existing notes
    const carInput: CreateCarUnitInput = {
      brand: 'Honda',
      model: 'Civic',
      year: 2019,
      transmission: 'manual',
      odometer: 30000,
      color: 'Blue',
      stock_code: `NOTES-${Date.now()}`,
      status: 'bought',
      notes: 'Original notes'
    };

    const result = await db.insert(carUnitsTable)
      .values({
        ...carInput,
        sold_price: carInput.sold_price ? carInput.sold_price.toString() : null
      })
      .returning()
      .execute();

    const carId = result[0].id;
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'ready'
      // No notes provided
    };

    const updatedCar = await changeCarStatus(input);

    expect(updatedCar.notes).toEqual('Original notes');
  });

  it('should handle sold_price conversion correctly', async () => {
    // Create car with sold_price
    const carInput: CreateCarUnitInput = {
      brand: 'BMW',
      model: 'X3',
      year: 2021,
      transmission: 'automatic',
      odometer: 25000,
      color: 'Black',
      stock_code: `PRICE-${Date.now()}`,
      status: 'ready',
      sold_price: 45000.50
    };

    const result = await db.insert(carUnitsTable)
      .values({
        ...carInput,
        sold_price: carInput.sold_price ? carInput.sold_price.toString() : null
      })
      .returning()
      .execute();

    const carId = result[0].id;
    
    const input: ChangeStatusInput = {
      car_id: carId,
      new_status: 'sold'
    };

    const updatedCar = await changeCarStatus(input);

    expect(typeof updatedCar.sold_price).toBe('number');
    expect(updatedCar.sold_price).toEqual(45000.50);
  });

  it('should validate all allowed transitions correctly', async () => {
    // Test draft -> bought
    const draftCarId = await createTestCar('draft');
    await expect(changeCarStatus({ car_id: draftCarId, new_status: 'bought' })).resolves.toBeDefined();
    
    // Test bought -> recond
    const boughtCarId = await createTestCar('bought');
    await expect(changeCarStatus({ car_id: boughtCarId, new_status: 'recond' })).resolves.toBeDefined();
    
    // Test recond -> ready
    const recondCarId = await createTestCar('recond');
    await expect(changeCarStatus({ car_id: recondCarId, new_status: 'ready' })).resolves.toBeDefined();
    
    // Test ready -> listed
    const readyCarId = await createTestCar('ready');
    await expect(changeCarStatus({ car_id: readyCarId, new_status: 'listed' })).resolves.toBeDefined();
    
    // Test listed -> sold
    const listedCarId = await createTestCar('listed');
    await expect(changeCarStatus({ car_id: listedCarId, new_status: 'sold' })).resolves.toBeDefined();
  });
});