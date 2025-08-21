import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, carUnitsTable, transactionsTable } from '../db/schema';
import { type CreatePartnerInput, type CreateCarUnitInput, type CreateTransactionInput } from '../schema';
import { getTransactionsByCarId, getAllTransactions } from '../handlers/get_transactions';

// Test data
const testPartner: CreatePartnerInput = {
  name: 'Test Workshop',
  type: 'workshop',
  contact_info: 'test@workshop.com',
  is_active: true
};

const testCarUnit: CreateCarUnitInput = {
  brand: 'Honda',
  model: 'Civic',
  year: 2020,
  transmission: 'manual',
  odometer: 50000,
  color: 'Blue',
  stock_code: 'HC2020001',
  status: 'bought'
};

const testTransaction1: CreateTransactionInput = {
  car_id: 1,
  partner_id: 1,
  type: 'acquisition',
  amount: 15000.50,
  percentage: 10.5,
  description: 'Car purchase',
  date: new Date('2024-01-15')
};

const testTransaction2: CreateTransactionInput = {
  car_id: 1,
  partner_id: null,
  type: 'workshop',
  amount: 500.75,
  description: 'Engine service',
  date: new Date('2024-01-20')
};

const testTransaction3: CreateTransactionInput = {
  car_id: 2, // Different car
  partner_id: 1,
  type: 'broker_fee',
  amount: 200.00,
  percentage: 5.0,
  description: 'Broker commission',
  date: new Date('2024-01-10')
};

describe('getTransactionsByCarId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return transactions for a specific car sorted by date descending', async () => {
    // Create test data
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: testPartner.name,
        type: testPartner.type,
        contact_info: testPartner.contact_info,
        is_active: testPartner.is_active ?? true
      })
      .returning()
      .execute();

    const carResult = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit.brand,
        model: testCarUnit.model,
        year: testCarUnit.year,
        transmission: testCarUnit.transmission,
        odometer: testCarUnit.odometer,
        color: testCarUnit.color,
        stock_code: testCarUnit.stock_code,
        status: testCarUnit.status ?? 'draft'
      })
      .returning()
      .execute();

    // Create transactions with different dates
    await db.insert(transactionsTable)
      .values([
        {
          car_id: carResult[0].id,
          partner_id: partnerResult[0].id,
          type: testTransaction1.type,
          amount: testTransaction1.amount.toString(),
          percentage: testTransaction1.percentage?.toString() ?? null,
          description: testTransaction1.description,
          date: testTransaction1.date ?? new Date()
        },
        {
          car_id: carResult[0].id,
          partner_id: null,
          type: testTransaction2.type,
          amount: testTransaction2.amount.toString(),
          description: testTransaction2.description,
          date: testTransaction2.date ?? new Date()
        }
      ])
      .execute();

    const result = await getTransactionsByCarId(carResult[0].id);

    expect(result).toHaveLength(2);
    
    // Check ordering (newest first)
    expect(result[0].date).toEqual(new Date('2024-01-20'));
    expect(result[1].date).toEqual(new Date('2024-01-15'));

    // Check first transaction (newer)
    expect(result[0].car_id).toBe(carResult[0].id);
    expect(result[0].partner_id).toBeNull();
    expect(result[0].type).toBe('workshop');
    expect(result[0].amount).toBe(500.75);
    expect(typeof result[0].amount).toBe('number');
    expect(result[0].percentage).toBeNull();
    expect(result[0].description).toBe('Engine service');

    // Check second transaction (older)
    expect(result[1].car_id).toBe(carResult[0].id);
    expect(result[1].partner_id).toBe(partnerResult[0].id);
    expect(result[1].type).toBe('acquisition');
    expect(result[1].amount).toBe(15000.50);
    expect(typeof result[1].amount).toBe('number');
    expect(result[1].percentage).toBe(10.5);
    expect(typeof result[1].percentage).toBe('number');
    expect(result[1].description).toBe('Car purchase');
  });

  it('should return empty array for car with no transactions', async () => {
    // Create car without transactions
    const carResult = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit.brand,
        model: testCarUnit.model,
        year: testCarUnit.year,
        transmission: testCarUnit.transmission,
        odometer: testCarUnit.odometer,
        color: testCarUnit.color,
        stock_code: testCarUnit.stock_code,
        status: testCarUnit.status ?? 'draft'
      })
      .returning()
      .execute();

    const result = await getTransactionsByCarId(carResult[0].id);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent car', async () => {
    const result = await getTransactionsByCarId(9999);

    expect(result).toHaveLength(0);
  });

  it('should only return transactions for the specified car', async () => {
    // Create test data
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: testPartner.name,
        type: testPartner.type,
        contact_info: testPartner.contact_info,
        is_active: testPartner.is_active ?? true
      })
      .returning()
      .execute();

    // Create two different cars
    const car1Result = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit.brand,
        model: testCarUnit.model,
        year: testCarUnit.year,
        transmission: testCarUnit.transmission,
        odometer: testCarUnit.odometer,
        color: testCarUnit.color,
        stock_code: testCarUnit.stock_code,
        status: testCarUnit.status ?? 'draft'
      })
      .returning()
      .execute();

    const car2Result = await db.insert(carUnitsTable)
      .values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2021,
        transmission: 'automatic',
        odometer: 30000,
        color: 'Red',
        stock_code: 'TC2021001',
        status: 'ready'
      })
      .returning()
      .execute();

    // Create transactions for both cars
    await db.insert(transactionsTable)
      .values([
        {
          car_id: car1Result[0].id,
          partner_id: partnerResult[0].id,
          type: 'acquisition',
          amount: '15000.00',
          description: 'Car 1 purchase'
        },
        {
          car_id: car2Result[0].id,
          partner_id: partnerResult[0].id,
          type: 'broker_fee',
          amount: '200.00',
          description: 'Car 2 broker fee'
        }
      ])
      .execute();

    const car1Transactions = await getTransactionsByCarId(car1Result[0].id);
    const car2Transactions = await getTransactionsByCarId(car2Result[0].id);

    expect(car1Transactions).toHaveLength(1);
    expect(car1Transactions[0].car_id).toBe(car1Result[0].id);
    expect(car1Transactions[0].description).toBe('Car 1 purchase');

    expect(car2Transactions).toHaveLength(1);
    expect(car2Transactions[0].car_id).toBe(car2Result[0].id);
    expect(car2Transactions[0].description).toBe('Car 2 broker fee');
  });
});

describe('getAllTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all transactions across all cars sorted by date descending', async () => {
    // Create test data
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: testPartner.name,
        type: testPartner.type,
        contact_info: testPartner.contact_info,
        is_active: testPartner.is_active ?? true
      })
      .returning()
      .execute();

    // Create two cars
    const car1Result = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit.brand,
        model: testCarUnit.model,
        year: testCarUnit.year,
        transmission: testCarUnit.transmission,
        odometer: testCarUnit.odometer,
        color: testCarUnit.color,
        stock_code: testCarUnit.stock_code,
        status: testCarUnit.status ?? 'draft'
      })
      .returning()
      .execute();

    const car2Result = await db.insert(carUnitsTable)
      .values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2021,
        transmission: 'automatic',
        odometer: 30000,
        color: 'Red',
        stock_code: 'TC2021001',
        status: 'ready'
      })
      .returning()
      .execute();

    // Create transactions with different dates for both cars
    await db.insert(transactionsTable)
      .values([
        {
          car_id: car1Result[0].id,
          partner_id: partnerResult[0].id,
          type: 'acquisition',
          amount: '15000.50',
          percentage: '10.5',
          description: 'Car 1 purchase',
          date: new Date('2024-01-15')
        },
        {
          car_id: car1Result[0].id,
          partner_id: null,
          type: 'workshop',
          amount: '500.75',
          description: 'Car 1 service',
          date: new Date('2024-01-20')
        },
        {
          car_id: car2Result[0].id,
          partner_id: partnerResult[0].id,
          type: 'broker_fee',
          amount: '200.00',
          percentage: '5.0',
          description: 'Car 2 broker fee',
          date: new Date('2024-01-10')
        }
      ])
      .execute();

    const result = await getAllTransactions();

    expect(result).toHaveLength(3);
    
    // Check ordering (newest first)
    expect(result[0].date).toEqual(new Date('2024-01-20'));
    expect(result[1].date).toEqual(new Date('2024-01-15'));
    expect(result[2].date).toEqual(new Date('2024-01-10'));

    // Check that all cars' transactions are included
    const carIds = result.map(t => t.car_id).sort();
    expect(carIds).toEqual([car1Result[0].id, car1Result[0].id, car2Result[0].id].sort());

    // Check numeric conversions
    result.forEach(transaction => {
      expect(typeof transaction.amount).toBe('number');
      if (transaction.percentage !== null) {
        expect(typeof transaction.percentage).toBe('number');
      }
    });

    // Check specific transaction details
    const workshopTransaction = result.find(t => t.type === 'workshop');
    expect(workshopTransaction?.amount).toBe(500.75);
    expect(workshopTransaction?.percentage).toBeNull();

    const acquisitionTransaction = result.find(t => t.type === 'acquisition');
    expect(acquisitionTransaction?.amount).toBe(15000.50);
    expect(acquisitionTransaction?.percentage).toBe(10.5);
  });

  it('should return empty array when no transactions exist', async () => {
    const result = await getAllTransactions();

    expect(result).toHaveLength(0);
  });

  it('should handle transactions with null percentage values correctly', async () => {
    // Create minimal test data
    const carResult = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit.brand,
        model: testCarUnit.model,
        year: testCarUnit.year,
        transmission: testCarUnit.transmission,
        odometer: testCarUnit.odometer,
        color: testCarUnit.color,
        stock_code: testCarUnit.stock_code,
        status: testCarUnit.status ?? 'draft'
      })
      .returning()
      .execute();

    await db.insert(transactionsTable)
      .values([
        {
          car_id: carResult[0].id,
          partner_id: null,
          type: 'workshop',
          amount: '500.00',
          percentage: null, // Explicitly null
          description: 'Service without percentage'
        },
        {
          car_id: carResult[0].id,
          partner_id: null,
          type: 'broker_fee',
          amount: '200.00',
          percentage: '2.5',
          description: 'Fee with percentage'
        }
      ])
      .execute();

    const result = await getAllTransactions();

    expect(result).toHaveLength(2);
    
    const workshopTx = result.find(t => t.type === 'workshop');
    const brokerTx = result.find(t => t.type === 'broker_fee');

    expect(workshopTx?.percentage).toBeNull();
    expect(brokerTx?.percentage).toBe(2.5);
    expect(typeof brokerTx?.percentage).toBe('number');
  });
});