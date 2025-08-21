import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, carUnitsTable, transactionsTable, auditLogsTable } from '../db/schema';
import { deleteTransaction } from '../handlers/delete_transaction';
import { eq, and } from 'drizzle-orm';

describe('deleteTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a transaction successfully', async () => {
    // Create test partner
    const [partner] = await db.insert(partnersTable)
      .values({
        name: 'Test Workshop',
        type: 'workshop',
        contact_info: 'test@example.com',
        is_active: true
      })
      .returning()
      .execute();

    // Create test car
    const [car] = await db.insert(carUnitsTable)
      .values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2020,
        transmission: 'automatic',
        odometer: 50000,
        color: 'Silver',
        stock_code: 'TOY001',
        status: 'bought'
      })
      .returning()
      .execute();

    // Create test transaction
    const [transaction] = await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        partner_id: partner.id,
        type: 'workshop',
        amount: '1500.00',
        description: 'Brake service',
        date: new Date()
      })
      .returning()
      .execute();

    // Delete the transaction
    const result = await deleteTransaction(transaction.id);

    expect(result.success).toBe(true);

    // Verify transaction is deleted
    const deletedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transaction.id))
      .execute();

    expect(deletedTransaction).toHaveLength(0);
  });

  it('should create audit log entry when deleting transaction', async () => {
    // Create test car
    const [car] = await db.insert(carUnitsTable)
      .values({
        brand: 'Honda',
        model: 'Civic',
        year: 2019,
        transmission: 'manual',
        odometer: 60000,
        color: 'Blue',
        stock_code: 'HON001',
        status: 'bought'
      })
      .returning()
      .execute();

    // Create test transaction
    const [transaction] = await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        type: 'acquisition',
        amount: '15000.00',
        description: 'Purchase price',
        date: new Date()
      })
      .returning()
      .execute();

    // Delete the transaction
    await deleteTransaction(transaction.id);

    // Verify audit log entry was created
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(
        and(
          eq(auditLogsTable.entity_type, 'transaction'),
          eq(auditLogsTable.entity_id, transaction.id),
          eq(auditLogsTable.action, 'delete')
        )
      )
      .execute();

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actor).toEqual('system');
    expect(auditLogs[0].before_data).toBeDefined();
    expect(auditLogs[0].after_data).toBeNull();

    // Verify before_data contains transaction details
    const beforeData = auditLogs[0].before_data as any;
    expect(beforeData.car_id).toEqual(car.id);
    expect(beforeData.type).toEqual('acquisition');
    expect(beforeData.amount).toEqual(15000.00);
  });

  it('should recalculate sold_price when deleting sale_income transaction', async () => {
    // Create test car
    const [car] = await db.insert(carUnitsTable)
      .values({
        brand: 'Ford',
        model: 'Focus',
        year: 2018,
        transmission: 'automatic',
        odometer: 80000,
        color: 'Red',
        stock_code: 'FOR001',
        status: 'sold',
        sold_price: '18000.00'
      })
      .returning()
      .execute();

    // Create multiple sale_income transactions
    const [transaction1] = await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        type: 'sale_income',
        amount: '15000.00',
        description: 'Initial payment',
        date: new Date()
      })
      .returning()
      .execute();

    await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        type: 'sale_income',
        amount: '3000.00',
        description: 'Final payment',
        date: new Date()
      })
      .returning()
      .execute();

    // Delete one sale_income transaction
    await deleteTransaction(transaction1.id);

    // Verify car's sold_price was recalculated
    const updatedCar = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, car.id))
      .execute();

    expect(parseFloat(updatedCar[0].sold_price!)).toEqual(3000.00);
  });

  it('should set sold_price to null when deleting last sale_income transaction', async () => {
    // Create test car
    const [car] = await db.insert(carUnitsTable)
      .values({
        brand: 'Nissan',
        model: 'Altima',
        year: 2021,
        transmission: 'cvt',
        odometer: 30000,
        color: 'Black',
        stock_code: 'NIS001',
        status: 'sold',
        sold_price: '22000.00'
      })
      .returning()
      .execute();

    // Create single sale_income transaction
    const [transaction] = await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        type: 'sale_income',
        amount: '22000.00',
        description: 'Sale payment',
        date: new Date()
      })
      .returning()
      .execute();

    // Delete the sale_income transaction
    await deleteTransaction(transaction.id);

    // Verify car's sold_price was set to null
    const updatedCar = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, car.id))
      .execute();

    expect(updatedCar[0].sold_price).toBeNull();
  });

  it('should not affect sold_price when deleting non-sale_income transaction', async () => {
    // Create test car
    const [car] = await db.insert(carUnitsTable)
      .values({
        brand: 'BMW',
        model: '320i',
        year: 2022,
        transmission: 'automatic',
        odometer: 20000,
        color: 'White',
        stock_code: 'BMW001',
        status: 'sold',
        sold_price: '35000.00'
      })
      .returning()
      .execute();

    // Create sale_income transaction (to establish sold_price)
    await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        type: 'sale_income',
        amount: '35000.00',
        description: 'Sale payment',
        date: new Date()
      })
      .returning()
      .execute();

    // Create workshop transaction
    const [workshopTransaction] = await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        type: 'workshop',
        amount: '800.00',
        description: 'Oil change',
        date: new Date()
      })
      .returning()
      .execute();

    // Delete the workshop transaction
    await deleteTransaction(workshopTransaction.id);

    // Verify car's sold_price was not affected
    const updatedCar = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, car.id))
      .execute();

    expect(parseFloat(updatedCar[0].sold_price!)).toEqual(35000.00);
  });

  it('should throw error when transaction does not exist', async () => {
    const nonExistentId = 99999;

    await expect(deleteTransaction(nonExistentId))
      .rejects.toThrow(/Transaction with ID 99999 not found/i);
  });

  it('should handle transaction with null partner_id', async () => {
    // Create test car
    const [car] = await db.insert(carUnitsTable)
      .values({
        brand: 'Mazda',
        model: 'CX-5',
        year: 2020,
        transmission: 'automatic',
        odometer: 45000,
        color: 'Gray',
        stock_code: 'MAZ001',
        status: 'recond'
      })
      .returning()
      .execute();

    // Create transaction without partner
    const [transaction] = await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        partner_id: null,
        type: 'admin',
        amount: '200.00',
        description: 'Documentation fees',
        date: new Date()
      })
      .returning()
      .execute();

    // Delete the transaction
    const result = await deleteTransaction(transaction.id);

    expect(result.success).toBe(true);

    // Verify transaction is deleted
    const deletedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transaction.id))
      .execute();

    expect(deletedTransaction).toHaveLength(0);

    // Verify audit log was created with correct data
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(
        and(
          eq(auditLogsTable.entity_type, 'transaction'),
          eq(auditLogsTable.entity_id, transaction.id)
        )
      )
      .execute();

    expect(auditLogs).toHaveLength(1);
    const beforeData = auditLogs[0].before_data as any;
    expect(beforeData.partner_id).toBeNull();
  });

  it('should handle transaction with percentage field', async () => {
    // Create test partner
    const [partner] = await db.insert(partnersTable)
      .values({
        name: 'Test Broker',
        type: 'broker',
        contact_info: 'broker@example.com',
        is_active: true
      })
      .returning()
      .execute();

    // Create test car
    const [car] = await db.insert(carUnitsTable)
      .values({
        brand: 'Audi',
        model: 'A4',
        year: 2019,
        transmission: 'automatic',
        odometer: 55000,
        color: 'Silver',
        stock_code: 'AUD001',
        status: 'listed'
      })
      .returning()
      .execute();

    // Create transaction with percentage
    const [transaction] = await db.insert(transactionsTable)
      .values({
        car_id: car.id,
        partner_id: partner.id,
        type: 'broker_fee',
        amount: '1000.00',
        percentage: '5.00',
        description: 'Broker commission',
        date: new Date()
      })
      .returning()
      .execute();

    // Delete the transaction
    const result = await deleteTransaction(transaction.id);

    expect(result.success).toBe(true);

    // Verify audit log captures percentage correctly
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(
        and(
          eq(auditLogsTable.entity_type, 'transaction'),
          eq(auditLogsTable.entity_id, transaction.id)
        )
      )
      .execute();

    const beforeData = auditLogs[0].before_data as any;
    expect(beforeData.percentage).toEqual(5.00);
    expect(typeof beforeData.percentage).toBe('number');
  });
});