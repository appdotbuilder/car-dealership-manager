import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, partnersTable, transactionsTable } from '../db/schema';
import { getFinancialSummaryByCarId, getAllFinancialSummaries } from '../handlers/get_financial_summary';

// Test data
const testCarUnit = {
  brand: 'Toyota',
  model: 'Camry',
  year: 2020,
  transmission: 'automatic' as const,
  odometer: 50000,
  color: 'Silver',
  stock_code: 'TOY-001',
  status: 'bought' as const
};

const testPartner = {
  name: 'Test Workshop',
  type: 'workshop' as const,
  is_active: true
};

describe('getFinancialSummaryByCarId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should calculate financial summary with mixed transactions', async () => {
    // Create test partner
    const partnerResult = await db.insert(partnersTable)
      .values(testPartner)
      .returning()
      .execute();
    const partnerId = partnerResult[0].id;

    // Create test car unit
    const carResult = await db.insert(carUnitsTable)
      .values(testCarUnit)
      .returning()
      .execute();
    const carId = carResult[0].id;

    // Add various transactions
    await db.insert(transactionsTable)
      .values([
        {
          car_id: carId,
          partner_id: partnerId,
          type: 'acquisition',
          amount: '25000.00',
          description: 'Car purchase'
        },
        {
          car_id: carId,
          partner_id: partnerId,
          type: 'workshop',
          amount: '1500.50',
          description: 'Engine repair'
        },
        {
          car_id: carId,
          type: 'detailing',
          amount: '300.00',
          description: 'Car cleaning'
        },
        {
          car_id: carId,
          type: 'sale_income',
          amount: '28000.00',
          description: 'Car sale'
        },
        {
          car_id: carId,
          type: 'other_income',
          amount: '200.00',
          description: 'Extended warranty refund'
        }
      ])
      .execute();

    const result = await getFinancialSummaryByCarId(carId);

    expect(result.car_id).toEqual(carId);
    expect(result.total_acquisition).toEqual(25000);
    expect(result.total_expenses).toEqual(1800.50); // 1500.50 + 300.00
    expect(result.total_incomes).toEqual(28200); // 28000 + 200
    expect(result.profit).toEqual(1399.50); // 28200 - 25000 - 1800.50
    expect(result.sold_price).toEqual(28000); // From sale_income
  });

  it('should handle car with sold_price in car unit table', async () => {
    // Create car unit with sold_price
    const carResult = await db.insert(carUnitsTable)
      .values({
        ...testCarUnit,
        sold_price: '30000.00',
        status: 'sold'
      })
      .returning()
      .execute();
    const carId = carResult[0].id;

    // Add transactions including different sale_income
    await db.insert(transactionsTable)
      .values([
        {
          car_id: carId,
          type: 'acquisition',
          amount: '25000.00',
          description: 'Car purchase'
        },
        {
          car_id: carId,
          type: 'sale_income',
          amount: '28000.00',
          description: 'Partial payment'
        }
      ])
      .execute();

    const result = await getFinancialSummaryByCarId(carId);

    // Should prefer car unit's sold_price over sale_income total
    expect(result.sold_price).toEqual(30000);
    expect(result.total_acquisition).toEqual(25000);
    expect(result.total_incomes).toEqual(28000);
    expect(result.profit).toEqual(3000); // 28000 - 25000
  });

  it('should handle car with no transactions', async () => {
    // Create car unit without transactions
    const carResult = await db.insert(carUnitsTable)
      .values(testCarUnit)
      .returning()
      .execute();
    const carId = carResult[0].id;

    const result = await getFinancialSummaryByCarId(carId);

    expect(result.car_id).toEqual(carId);
    expect(result.total_acquisition).toEqual(0);
    expect(result.total_expenses).toEqual(0);
    expect(result.total_incomes).toEqual(0);
    expect(result.profit).toEqual(0);
    expect(result.sold_price).toBeNull();
  });

  it('should categorize all expense transaction types correctly', async () => {
    // Create car unit
    const carResult = await db.insert(carUnitsTable)
      .values(testCarUnit)
      .returning()
      .execute();
    const carId = carResult[0].id;

    // Add all types of expense transactions
    await db.insert(transactionsTable)
      .values([
        { car_id: carId, type: 'broker_fee', amount: '500.00', description: 'Broker fee' },
        { car_id: carId, type: 'workshop', amount: '1000.00', description: 'Workshop' },
        { car_id: carId, type: 'detailing', amount: '200.00', description: 'Detailing' },
        { car_id: carId, type: 'transport', amount: '150.00', description: 'Transport' },
        { car_id: carId, type: 'admin', amount: '100.00', description: 'Admin' },
        { car_id: carId, type: 'tax', amount: '300.00', description: 'Tax' },
        { car_id: carId, type: 'other_expense', amount: '250.00', description: 'Other expense' }
      ])
      .execute();

    const result = await getFinancialSummaryByCarId(carId);

    expect(result.total_expenses).toEqual(2500); // Sum of all expenses
    expect(result.total_acquisition).toEqual(0);
    expect(result.total_incomes).toEqual(0);
    expect(result.profit).toEqual(-2500); // Negative profit due to expenses only
  });

  it('should handle multiple sale_income transactions', async () => {
    // Create car unit
    const carResult = await db.insert(carUnitsTable)
      .values(testCarUnit)
      .returning()
      .execute();
    const carId = carResult[0].id;

    // Add multiple sale_income transactions (installment payments)
    await db.insert(transactionsTable)
      .values([
        { car_id: carId, type: 'acquisition', amount: '20000.00', description: 'Purchase' },
        { car_id: carId, type: 'sale_income', amount: '15000.00', description: 'Down payment' },
        { car_id: carId, type: 'sale_income', amount: '10000.00', description: 'Final payment' }
      ])
      .execute();

    const result = await getFinancialSummaryByCarId(carId);

    expect(result.total_incomes).toEqual(25000); // 15000 + 10000
    expect(result.sold_price).toEqual(25000); // Sum of sale_income transactions
    expect(result.profit).toEqual(5000); // 25000 - 20000
  });

  it('should handle percentage-based transactions', async () => {
    // Create partner and car unit
    const partnerResult = await db.insert(partnersTable)
      .values(testPartner)
      .returning()
      .execute();
    const partnerId = partnerResult[0].id;

    const carResult = await db.insert(carUnitsTable)
      .values(testCarUnit)
      .returning()
      .execute();
    const carId = carResult[0].id;

    // Add transaction with percentage (should still use amount for calculation)
    await db.insert(transactionsTable)
      .values([
        {
          car_id: carId,
          partner_id: partnerId,
          type: 'broker_fee',
          amount: '1000.00',
          percentage: '5.00',
          description: 'Broker fee (5% of sale)'
        }
      ])
      .execute();

    const result = await getFinancialSummaryByCarId(carId);

    expect(result.total_expenses).toEqual(1000); // Uses amount, not percentage
  });

  it('should throw error for non-existent car', async () => {
    const nonExistentCarId = 99999;

    await expect(getFinancialSummaryByCarId(nonExistentCarId))
      .rejects.toThrow(/Car unit with id 99999 not found/i);
  });
});

describe('getAllFinancialSummaries', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return summaries for all car units', async () => {
    // Create multiple car units
    const car1Result = await db.insert(carUnitsTable)
      .values({
        ...testCarUnit,
        stock_code: 'CAR-001'
      })
      .returning()
      .execute();
    
    const car2Result = await db.insert(carUnitsTable)
      .values({
        ...testCarUnit,
        stock_code: 'CAR-002',
        brand: 'Honda'
      })
      .returning()
      .execute();

    const car1Id = car1Result[0].id;
    const car2Id = car2Result[0].id;

    // Add transactions to both cars
    await db.insert(transactionsTable)
      .values([
        { car_id: car1Id, type: 'acquisition', amount: '20000.00' },
        { car_id: car1Id, type: 'sale_income', amount: '25000.00' },
        { car_id: car2Id, type: 'acquisition', amount: '15000.00' },
        { car_id: car2Id, type: 'workshop', amount: '500.00' }
      ])
      .execute();

    const result = await getAllFinancialSummaries();

    expect(result).toHaveLength(2);
    
    // Find summaries by car_id
    const car1Summary = result.find(s => s.car_id === car1Id);
    const car2Summary = result.find(s => s.car_id === car2Id);

    expect(car1Summary).toBeDefined();
    expect(car1Summary!.profit).toEqual(5000); // 25000 - 20000
    
    expect(car2Summary).toBeDefined();
    expect(car2Summary!.profit).toEqual(-15500); // 0 - 15000 - 500
  });

  it('should return empty array when no car units exist', async () => {
    const result = await getAllFinancialSummaries();

    expect(result).toHaveLength(0);
  });

  it('should continue processing other cars if one fails', async () => {
    // Create car units
    const car1Result = await db.insert(carUnitsTable)
      .values({
        ...testCarUnit,
        stock_code: 'CAR-001'
      })
      .returning()
      .execute();
    
    const car2Result = await db.insert(carUnitsTable)
      .values({
        ...testCarUnit,
        stock_code: 'CAR-002'
      })
      .returning()
      .execute();

    const car1Id = car1Result[0].id;
    const car2Id = car2Result[0].id;

    // Add transactions
    await db.insert(transactionsTable)
      .values([
        { car_id: car1Id, type: 'acquisition', amount: '20000.00' },
        { car_id: car2Id, type: 'acquisition', amount: '15000.00' }
      ])
      .execute();

    const result = await getAllFinancialSummaries();

    // Should return summaries for all cars (no failures expected in this case)
    expect(result).toHaveLength(2);
  });
});