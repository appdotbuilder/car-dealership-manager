import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, carUnitsTable, partnersTable, auditLogsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testCarId: number;
  let testPartnerId: number;

  beforeEach(async () => {
    // Create test car
    const carResult = await db.insert(carUnitsTable)
      .values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2020,
        transmission: 'automatic',
        odometer: 50000,
        color: 'White',
        stock_code: 'TOY001',
        status: 'bought',
        sold_price: '25000.00' // Set as string for numeric column
      })
      .returning({ id: carUnitsTable.id })
      .execute();
    testCarId = carResult[0].id;

    // Create test partner
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: 'Test Broker',
        type: 'broker',
        contact_info: 'test@broker.com',
        is_active: true
      })
      .returning({ id: partnersTable.id })
      .execute();
    testPartnerId = partnerResult[0].id;
  });

  it('should create a basic transaction', async () => {
    const input: CreateTransactionInput = {
      car_id: testCarId,
      type: 'workshop',
      amount: 500.00,
      description: 'Engine repair'
    };

    const result = await createTransaction(input);

    expect(result.id).toBeDefined();
    expect(result.car_id).toEqual(testCarId);
    expect(result.partner_id).toBeNull();
    expect(result.type).toEqual('workshop');
    expect(result.amount).toEqual(500.00);
    expect(typeof result.amount).toBe('number');
    expect(result.percentage).toBeNull();
    expect(result.description).toEqual('Engine repair');
    expect(result.date).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create transaction with partner', async () => {
    const input: CreateTransactionInput = {
      car_id: testCarId,
      partner_id: testPartnerId,
      type: 'broker_fee',
      amount: 1000.00,
      percentage: 4.00,
      description: 'Broker commission'
    };

    const result = await createTransaction(input);

    expect(result.partner_id).toEqual(testPartnerId);
    expect(result.percentage).toEqual(4.00);
    expect(typeof result.percentage).toBe('number');
  });

  it('should save transaction to database', async () => {
    const input: CreateTransactionInput = {
      car_id: testCarId,
      type: 'transport',
      amount: 200.00
    };

    const result = await createTransaction(input);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].car_id).toEqual(testCarId);
    expect(parseFloat(transactions[0].amount)).toEqual(200.00);
    expect(transactions[0].type).toEqual('transport');
  });

  it('should calculate broker fee based on percentage when car has sold_price', async () => {
    const input: CreateTransactionInput = {
      car_id: testCarId,
      partner_id: testPartnerId,
      type: 'broker_fee',
      amount: 0, // This should be overridden by percentage calculation
      percentage: 5.00 // 5% of 25000 = 1250
    };

    const result = await createTransaction(input);

    expect(result.amount).toEqual(1250.00);
    expect(result.percentage).toEqual(5.00);
  });

  it('should update car sold_price for sale_income transaction', async () => {
    const salePrice = 24000.00;
    const input: CreateTransactionInput = {
      car_id: testCarId,
      type: 'sale_income',
      amount: salePrice,
      description: 'Car sale'
    };

    await createTransaction(input);

    const car = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, testCarId))
      .execute();

    expect(parseFloat(car[0].sold_price!)).toEqual(salePrice);
  });

  it('should create audit log entry', async () => {
    const input: CreateTransactionInput = {
      car_id: testCarId,
      type: 'detailing',
      amount: 150.00
    };

    const result = await createTransaction(input);

    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entity_id, result.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].entity_type).toEqual('transaction');
    expect(auditLogs[0].action).toEqual('create');
    expect(auditLogs[0].actor).toEqual('system');
    expect(auditLogs[0].before_data).toBeNull();
    expect(auditLogs[0].after_data).toBeDefined();
    
    const afterData = auditLogs[0].after_data as any;
    expect(afterData.amount).toEqual(150.00);
    expect(afterData.type).toEqual('detailing');
  });

  it('should use current date when date not provided', async () => {
    const beforeCreate = new Date();
    
    const input: CreateTransactionInput = {
      car_id: testCarId,
      type: 'admin',
      amount: 50.00
    };

    const result = await createTransaction(input);
    const afterCreate = new Date();

    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.date.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  it('should use provided date when specified', async () => {
    const specificDate = new Date('2023-06-15T10:00:00Z');
    
    const input: CreateTransactionInput = {
      car_id: testCarId,
      type: 'tax',
      amount: 75.00,
      date: specificDate
    };

    const result = await createTransaction(input);

    expect(result.date).toEqual(specificDate);
  });

  it('should throw error when car does not exist', async () => {
    const input: CreateTransactionInput = {
      car_id: 99999, // Non-existent car
      type: 'workshop',
      amount: 500.00
    };

    expect(createTransaction(input)).rejects.toThrow(/Car with ID 99999 does not exist/i);
  });

  it('should throw error when partner does not exist', async () => {
    const input: CreateTransactionInput = {
      car_id: testCarId,
      partner_id: 99999, // Non-existent partner
      type: 'broker_fee',
      amount: 1000.00
    };

    expect(createTransaction(input)).rejects.toThrow(/Partner with ID 99999 does not exist/i);
  });

  it('should handle null partner_id correctly', async () => {
    const input: CreateTransactionInput = {
      car_id: testCarId,
      partner_id: null,
      type: 'other_expense',
      amount: 300.00
    };

    const result = await createTransaction(input);

    expect(result.partner_id).toBeNull();
  });

  it('should handle all transaction types', async () => {
    const transactionTypes = [
      'acquisition', 'broker_fee', 'workshop', 'detailing', 'transport',
      'admin', 'tax', 'other_expense', 'sale_income', 'other_income'
    ] as const;

    for (const type of transactionTypes) {
      const input: CreateTransactionInput = {
        car_id: testCarId,
        type: type,
        amount: 100.00,
        description: `Test ${type}`
      };

      const result = await createTransaction(input);
      expect(result.type).toEqual(type);
    }
  });
});