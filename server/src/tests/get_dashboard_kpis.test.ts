import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, carUnitsTable, transactionsTable } from '../db/schema';
import { getDashboardKpis } from '../handlers/get_dashboard_kpis';
import { type CreatePartnerInput, type CreateCarUnitInput, type CreateTransactionInput } from '../schema';

// Test data
const testPartner: CreatePartnerInput = {
  name: 'Test Broker',
  type: 'broker',
  contact_info: 'broker@test.com',
  is_active: true
};

const testCarUnit1: CreateCarUnitInput = {
  brand: 'Toyota',
  model: 'Camry',
  year: 2020,
  transmission: 'automatic',
  odometer: 50000,
  color: 'White',
  stock_code: 'TC2020001',
  status: 'draft'
};

const testCarUnit2: CreateCarUnitInput = {
  brand: 'Honda',
  model: 'Civic',
  year: 2019,
  transmission: 'manual',
  odometer: 30000,
  color: 'Black',
  stock_code: 'HC2019001',
  status: 'sold'
};

const testCarUnit3: CreateCarUnitInput = {
  brand: 'Ford',
  model: 'Focus',
  year: 2021,
  transmission: 'automatic',
  odometer: 20000,
  color: 'Blue',
  stock_code: 'FF2021001',
  status: 'archived'
};

describe('getDashboardKpis', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return zero KPIs for empty database', async () => {
    const result = await getDashboardKpis();

    expect(result.active_stock_count).toEqual(0);
    expect(result.average_days_to_sale).toBeNull();
    expect(result.total_period_profit).toEqual(0);
    expect(result.top_profit_unit).toBeNull();
    expect(result.bottom_profit_unit).toBeNull();
  });

  it('should calculate active stock count correctly', async () => {
    // Create test cars with different statuses
    await db.insert(carUnitsTable).values({
      brand: testCarUnit1.brand,
      model: testCarUnit1.model,
      year: testCarUnit1.year,
      transmission: testCarUnit1.transmission,
      odometer: testCarUnit1.odometer,
      color: testCarUnit1.color,
      stock_code: testCarUnit1.stock_code,
      status: 'ready'
    }).execute();

    await db.insert(carUnitsTable).values({
      brand: testCarUnit2.brand,
      model: testCarUnit2.model,
      year: testCarUnit2.year,
      transmission: testCarUnit2.transmission,
      odometer: testCarUnit2.odometer,
      color: testCarUnit2.color,
      stock_code: testCarUnit2.stock_code,
      status: 'sold'
    }).execute();

    await db.insert(carUnitsTable).values({
      brand: testCarUnit3.brand,
      model: testCarUnit3.model,
      year: testCarUnit3.year,
      transmission: testCarUnit3.transmission,
      odometer: testCarUnit3.odometer,
      color: testCarUnit3.color,
      stock_code: testCarUnit3.stock_code,
      status: 'archived'
    }).execute();

    const result = await getDashboardKpis();

    // Only one car should be counted as active (not sold or archived)
    expect(result.active_stock_count).toEqual(1);
  });

  it('should calculate average days to sale', async () => {
    // Create sold car with specific dates
    const createdDate = new Date('2023-01-01');
    const soldDate = new Date('2023-01-31'); // 30 days later

    await db.insert(carUnitsTable).values({
      brand: testCarUnit2.brand,
      model: testCarUnit2.model,
      year: testCarUnit2.year,
      transmission: testCarUnit2.transmission,
      odometer: testCarUnit2.odometer,
      color: testCarUnit2.color,
      stock_code: testCarUnit2.stock_code,
      status: 'sold',
      created_at: createdDate,
      updated_at: soldDate
    }).execute();

    const result = await getDashboardKpis();

    expect(result.average_days_to_sale).toBeCloseTo(30, 1);
  });

  it('should calculate profit and find top/bottom units', async () => {
    // Create partner
    const partnerResult = await db.insert(partnersTable)
      .values(testPartner)
      .returning()
      .execute();
    const partnerId = partnerResult[0].id;

    // Create cars
    const car1Result = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        stock_code: testCarUnit1.stock_code,
        sold_price: '25000.00' // Convert to string for numeric field
      })
      .returning()
      .execute();
    const car1Id = car1Result[0].id;

    const car2Result = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit2.brand,
        model: testCarUnit2.model,
        year: testCarUnit2.year,
        transmission: testCarUnit2.transmission,
        odometer: testCarUnit2.odometer,
        color: testCarUnit2.color,
        stock_code: testCarUnit2.stock_code,
        sold_price: '18000.00'
      })
      .returning()
      .execute();
    const car2Id = car2Result[0].id;

    // Create transactions for car 1 (high profit)
    await db.insert(transactionsTable).values({
      car_id: car1Id,
      partner_id: partnerId,
      type: 'acquisition',
      amount: '20000.00', // Convert to string for numeric field
      date: new Date('2023-01-01')
    }).execute();

    await db.insert(transactionsTable).values({
      car_id: car1Id,
      partner_id: partnerId,
      type: 'workshop',
      amount: '1000.00',
      date: new Date('2023-01-15')
    }).execute();

    // Create transactions for car 2 (lower profit)
    await db.insert(transactionsTable).values({
      car_id: car2Id,
      partner_id: partnerId,
      type: 'acquisition',
      amount: '16000.00',
      date: new Date('2023-02-01')
    }).execute();

    await db.insert(transactionsTable).values({
      car_id: car2Id,
      partner_id: partnerId,
      type: 'detailing',
      amount: '500.00',
      date: new Date('2023-02-10')
    }).execute();

    const result = await getDashboardKpis();

    // Car 1 profit: 25000 - 20000 - 1000 = 4000
    // Car 2 profit: 18000 - 16000 - 500 = 1500
    expect(result.total_period_profit).toEqual(5500);

    // Top profit unit should be car 1
    expect(result.top_profit_unit).toBeDefined();
    expect(result.top_profit_unit!.id).toEqual(car1Id);
    expect(result.top_profit_unit!.brand).toEqual('Toyota');
    expect(result.top_profit_unit!.model).toEqual('Camry');
    expect(result.top_profit_unit!.profit).toEqual(4000);

    // Bottom profit unit should be car 2
    expect(result.bottom_profit_unit).toBeDefined();
    expect(result.bottom_profit_unit!.id).toEqual(car2Id);
    expect(result.bottom_profit_unit!.brand).toEqual('Honda');
    expect(result.bottom_profit_unit!.model).toEqual('Civic');
    expect(result.bottom_profit_unit!.profit).toEqual(1500);
  });

  it('should handle cars with other income transactions', async () => {
    // Create partner
    const partnerResult = await db.insert(partnersTable)
      .values(testPartner)
      .returning()
      .execute();
    const partnerId = partnerResult[0].id;

    // Create car
    const carResult = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        stock_code: testCarUnit1.stock_code,
        sold_price: '20000.00'
      })
      .returning()
      .execute();
    const carId = carResult[0].id;

    // Create transactions including other income
    await db.insert(transactionsTable).values([
      {
        car_id: carId,
        partner_id: partnerId,
        type: 'acquisition',
        amount: '18000.00',
        date: new Date('2023-01-01')
      },
      {
        car_id: carId,
        partner_id: partnerId,
        type: 'other_income',
        amount: '500.00',
        date: new Date('2023-01-10')
      },
      {
        car_id: carId,
        partner_id: partnerId,
        type: 'workshop',
        amount: '800.00',
        date: new Date('2023-01-15')
      }
    ]).execute();

    const result = await getDashboardKpis();

    // Profit: sold_price (20000) + other_income (500) - expenses (18000 + 800) = 1700
    expect(result.total_period_profit).toEqual(1700);
    expect(result.top_profit_unit!.profit).toEqual(1700);
  });

  it('should exclude negative profit units from bottom calculation', async () => {
    // Create partner
    const partnerResult = await db.insert(partnersTable)
      .values(testPartner)
      .returning()
      .execute();
    const partnerId = partnerResult[0].id;

    // Create cars - one profitable, one at loss
    const car1Result = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        stock_code: testCarUnit1.stock_code,
        sold_price: '15000.00'
      })
      .returning()
      .execute();
    const car1Id = car1Result[0].id;

    const car2Result = await db.insert(carUnitsTable)
      .values({
        brand: testCarUnit2.brand,
        model: testCarUnit2.model,
        year: testCarUnit2.year,
        transmission: testCarUnit2.transmission,
        odometer: testCarUnit2.odometer,
        color: testCarUnit2.color,
        stock_code: testCarUnit2.stock_code,
        sold_price: '10000.00'
      })
      .returning()
      .execute();
    const car2Id = car2Result[0].id;

    // Car 1 transactions (profit: 15000 - 12000 = 3000)
    await db.insert(transactionsTable).values({
      car_id: car1Id,
      partner_id: partnerId,
      type: 'acquisition',
      amount: '12000.00',
      date: new Date('2023-01-01')
    }).execute();

    // Car 2 transactions (loss: 10000 - 15000 = -5000)
    await db.insert(transactionsTable).values({
      car_id: car2Id,
      partner_id: partnerId,
      type: 'acquisition',
      amount: '15000.00',
      date: new Date('2023-02-01')
    }).execute();

    const result = await getDashboardKpis();

    // Total profit should be -2000 (3000 + (-5000))
    expect(result.total_period_profit).toEqual(-2000);

    // Top profit unit should be car 1
    expect(result.top_profit_unit!.id).toEqual(car1Id);
    expect(result.top_profit_unit!.profit).toEqual(3000);

    // Bottom profit unit should also be car 1 (only positive profit)
    expect(result.bottom_profit_unit!.id).toEqual(car1Id);
    expect(result.bottom_profit_unit!.profit).toEqual(3000);
  });

  it('should handle multiple active status types', async () => {
    // Create cars with various active statuses
    await db.insert(carUnitsTable).values([
      {
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        status: 'draft',
        stock_code: 'DRAFT001'
      },
      {
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        status: 'bought',
        stock_code: 'BOUGHT001'
      },
      {
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        status: 'recond',
        stock_code: 'RECOND001'
      },
      {
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        status: 'ready',
        stock_code: 'READY001'
      },
      {
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        status: 'listed',
        stock_code: 'LISTED001'
      },
      {
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        status: 'sold',
        stock_code: 'SOLD001'
      },
      {
        brand: testCarUnit1.brand,
        model: testCarUnit1.model,
        year: testCarUnit1.year,
        transmission: testCarUnit1.transmission,
        odometer: testCarUnit1.odometer,
        color: testCarUnit1.color,
        status: 'archived',
        stock_code: 'ARCHIVED001'
      }
    ]).execute();

    const result = await getDashboardKpis();

    // Should count 5 active units (all except sold and archived)
    expect(result.active_stock_count).toEqual(5);
  });
});