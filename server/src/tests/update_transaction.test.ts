import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, carUnitsTable, partnersTable, auditLogsTable } from '../db/schema';
import { type UpdateTransactionInput } from '../schema';
import { updateTransaction } from '../handlers/update_transaction';
import { eq, and } from 'drizzle-orm';

describe('updateTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let carId: number;
  let partnerId: number;
  let transactionId: number;

  beforeEach(async () => {
    // Create test car
    const carResult = await db.insert(carUnitsTable)
      .values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2020,
        transmission: 'automatic',
        odometer: 50000,
        color: 'Blue',
        stock_code: 'TOY001',
        status: 'ready'
      })
      .returning()
      .execute();
    carId = carResult[0].id;

    // Create test partner
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: 'Test Workshop',
        type: 'workshop',
        contact_info: 'test@workshop.com',
        is_active: true
      })
      .returning()
      .execute();
    partnerId = partnerResult[0].id;

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        car_id: carId,
        partner_id: partnerId,
        type: 'workshop',
        amount: '500.00',
        percentage: '10.00',
        description: 'Initial repair work',
        date: new Date('2024-01-01')
      })
      .returning()
      .execute();
    transactionId = transactionResult[0].id;
  });

  it('should update transaction basic fields', async () => {
    const input: UpdateTransactionInput = {
      id: transactionId,
      type: 'detailing',
      amount: 750.50,
      description: 'Updated detailing work',
      percentage: 15.5
    };

    const result = await updateTransaction(input);

    expect(result.id).toEqual(transactionId);
    expect(result.type).toEqual('detailing');
    expect(result.amount).toEqual(750.50);
    expect(result.description).toEqual('Updated detailing work');
    expect(result.percentage).toEqual(15.5);
    expect(result.car_id).toEqual(carId);
    expect(result.partner_id).toEqual(partnerId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update transaction in database', async () => {
    const input: UpdateTransactionInput = {
      id: transactionId,
      amount: 1000,
      description: 'Updated transaction'
    };

    await updateTransaction(input);

    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    expect(updatedTransaction).toHaveLength(1);
    expect(parseFloat(updatedTransaction[0].amount)).toEqual(1000);
    expect(updatedTransaction[0].description).toEqual('Updated transaction');
    expect(updatedTransaction[0].type).toEqual('workshop'); // Should remain unchanged
  });

  it('should handle null partner_id update', async () => {
    const input: UpdateTransactionInput = {
      id: transactionId,
      partner_id: null,
      amount: 300
    };

    const result = await updateTransaction(input);

    expect(result.partner_id).toBeNull();
    expect(result.amount).toEqual(300);
  });

  it('should handle date update', async () => {
    const newDate = new Date('2024-02-15');
    const input: UpdateTransactionInput = {
      id: transactionId,
      date: newDate,
      amount: 400
    };

    const result = await updateTransaction(input);

    expect(result.date).toEqual(newDate);
    expect(result.amount).toEqual(400);
  });

  it('should create audit log entry', async () => {
    const input: UpdateTransactionInput = {
      id: transactionId,
      type: 'admin',
      amount: 250,
      description: 'Admin fee update'
    };

    await updateTransaction(input);

    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.entity_type, 'transaction'),
        eq(auditLogsTable.entity_id, transactionId),
        eq(auditLogsTable.action, 'update')
      ))
      .execute();

    expect(auditLogs).toHaveLength(1);
    
    const auditLog = auditLogs[0];
    expect(auditLog.actor).toEqual('system');
    expect(auditLog.before_data).toBeDefined();
    expect(auditLog.after_data).toBeDefined();
    
    // Check before data
    const beforeData = auditLog.before_data as any;
    const afterData = auditLog.after_data as any;
    
    expect(beforeData.type).toEqual('workshop');
    expect(beforeData.amount).toEqual(500);
    expect(beforeData.description).toEqual('Initial repair work');
    
    // Check after data
    expect(afterData.type).toEqual('admin');
    expect(afterData.amount).toEqual(250);
    expect(afterData.description).toEqual('Admin fee update');
  });

  it('should recalculate sold_price when updating sale_income transaction', async () => {
    // Create a sale_income transaction
    const saleTransactionResult = await db.insert(transactionsTable)
      .values({
        car_id: carId,
        type: 'sale_income',
        amount: '25000.00',
        description: 'Car sale'
      })
      .returning()
      .execute();

    const saleTransactionId = saleTransactionResult[0].id;

    // Update the sale_income amount
    const input: UpdateTransactionInput = {
      id: saleTransactionId,
      amount: 27000
    };

    await updateTransaction(input);

    // Check that car's sold_price was updated
    const car = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    expect(parseFloat(car[0].sold_price!)).toEqual(27000);
  });

  it('should recalculate sold_price when changing transaction type to sale_income', async () => {
    const input: UpdateTransactionInput = {
      id: transactionId,
      type: 'sale_income',
      amount: 30000
    };

    await updateTransaction(input);

    // Check that car's sold_price was set
    const car = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    expect(parseFloat(car[0].sold_price!)).toEqual(30000);
  });

  it('should handle multiple sale_income transactions for same car', async () => {
    // Create first sale_income transaction
    const saleTransaction1 = await db.insert(transactionsTable)
      .values({
        car_id: carId,
        type: 'sale_income',
        amount: '20000.00',
        description: 'Initial payment'
      })
      .returning()
      .execute();

    // Create second sale_income transaction
    const saleTransaction2 = await db.insert(transactionsTable)
      .values({
        car_id: carId,
        type: 'sale_income',
        amount: '5000.00',
        description: 'Final payment'
      })
      .returning()
      .execute();

    // Update the second transaction
    const input: UpdateTransactionInput = {
      id: saleTransaction2[0].id,
      amount: 7000
    };

    await updateTransaction(input);

    // Check that car's sold_price is the sum of both transactions
    const car = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    expect(parseFloat(car[0].sold_price!)).toEqual(27000); // 20000 + 7000
  });

  it('should throw error when transaction not found', async () => {
    const input: UpdateTransactionInput = {
      id: 999999, // Non-existent ID
      amount: 100
    };

    await expect(updateTransaction(input)).rejects.toThrow(/not found/i);
  });

  it('should throw error when updating car_id to non-existent car', async () => {
    const input: UpdateTransactionInput = {
      id: transactionId,
      car_id: 999999, // Non-existent car ID
      amount: 100
    };

    await expect(updateTransaction(input)).rejects.toThrow(/Car.*not found/i);
  });

  it('should allow updating car_id to existing car', async () => {
    // Create another car
    const anotherCarResult = await db.insert(carUnitsTable)
      .values({
        brand: 'Honda',
        model: 'Civic',
        year: 2019,
        transmission: 'manual',
        odometer: 60000,
        color: 'Red',
        stock_code: 'HON001',
        status: 'ready'
      })
      .returning()
      .execute();

    const anotherCarId = anotherCarResult[0].id;

    const input: UpdateTransactionInput = {
      id: transactionId,
      car_id: anotherCarId,
      amount: 600
    };

    const result = await updateTransaction(input);

    expect(result.car_id).toEqual(anotherCarId);
    expect(result.amount).toEqual(600);
  });

  it('should handle percentage field updates correctly', async () => {
    const input: UpdateTransactionInput = {
      id: transactionId,
      percentage: null, // Remove percentage
      amount: 800
    };

    const result = await updateTransaction(input);

    expect(result.percentage).toBeNull();
    expect(result.amount).toEqual(800);

    // Test setting percentage to a new value
    const input2: UpdateTransactionInput = {
      id: transactionId,
      percentage: 25.75
    };

    const result2 = await updateTransaction(input2);

    expect(result2.percentage).toEqual(25.75);
  });

  it('should set sold_price to null when removing all sale_income transactions', async () => {
    // Create a sale_income transaction
    const saleTransactionResult = await db.insert(transactionsTable)
      .values({
        car_id: carId,
        type: 'sale_income',
        amount: '25000.00',
        description: 'Car sale'
      })
      .returning()
      .execute();

    // Change the transaction type from sale_income to something else
    const input: UpdateTransactionInput = {
      id: saleTransactionResult[0].id,
      type: 'other_expense',
      amount: 1000
    };

    await updateTransaction(input);

    // Check that car's sold_price was set to null
    const car = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    expect(car[0].sold_price).toBeNull();
  });
});