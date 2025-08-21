import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, partnersTable, transactionsTable } from '../db/schema';
import { type ReportFilter } from '../schema';
import { getProfitReport, getExpenseReport, getStockAgingReport } from '../handlers/get_reports';

describe('getProfitReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return zero profit for no sold units', async () => {
    const filter: ReportFilter = {};
    const result = await getProfitReport(filter);

    expect(result.total_profit).toBe(0);
    expect(result.average_profit_per_unit).toBe(0);
    expect(result.units_sold).toBe(0);
    expect(result.period_start).toBeInstanceOf(Date);
    expect(result.period_end).toBeInstanceOf(Date);
  });

  it('should calculate profit for sold units correctly', async () => {
    // Create test car unit
    const carResult = await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'TC2020001',
      status: 'sold',
      sold_price: '25000.00'
    }).returning().execute();

    const carId = carResult[0].id;

    // Add acquisition cost
    await db.insert(transactionsTable).values({
      car_id: carId,
      type: 'acquisition',
      amount: '20000.00',
      date: new Date('2024-01-15')
    }).execute();

    // Add expenses
    await db.insert(transactionsTable).values([
      {
        car_id: carId,
        type: 'workshop',
        amount: '1500.00',
        date: new Date('2024-02-01')
      },
      {
        car_id: carId,
        type: 'detailing',
        amount: '500.00',
        date: new Date('2024-02-05')
      }
    ]).execute();

    const filter: ReportFilter = {};
    const result = await getProfitReport(filter);

    expect(result.units_sold).toBe(1);
    expect(result.total_profit).toBe(3000); // 25000 - (20000 + 1500 + 500)
    expect(result.average_profit_per_unit).toBe(3000);
  });

  it('should filter by date range correctly', async () => {
    // Create two sold units
    const car1Result = await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'TC2020001',
      status: 'sold',
      sold_price: '25000.00',
      updated_at: new Date('2024-01-15')
    }).returning().execute();

    const car2Result = await db.insert(carUnitsTable).values({
      brand: 'Honda',
      model: 'Civic',
      year: 2019,
      transmission: 'manual',
      odometer: 60000,
      color: 'Black',
      stock_code: 'HC2019001',
      status: 'sold',
      sold_price: '20000.00',
      updated_at: new Date('2024-03-15')
    }).returning().execute();

    // Add expenses for both cars
    await db.insert(transactionsTable).values([
      {
        car_id: car1Result[0].id,
        type: 'acquisition',
        amount: '20000.00',
        date: new Date('2024-01-10')
      },
      {
        car_id: car2Result[0].id,
        type: 'acquisition',
        amount: '18000.00',
        date: new Date('2024-03-10')
      }
    ]).execute();

    // Filter to include only first car
    const filter: ReportFilter = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-02-28')
    };

    const result = await getProfitReport(filter);

    expect(result.units_sold).toBe(1);
    expect(result.total_profit).toBe(5000); // 25000 - 20000
  });

  it('should exclude non-sold units', async () => {
    // Create unit that's not sold
    const carResult = await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'TC2020001',
      status: 'ready' // Not sold
    }).returning().execute();

    await db.insert(transactionsTable).values({
      car_id: carResult[0].id,
      type: 'acquisition',
      amount: '20000.00',
      date: new Date('2024-01-15')
    }).execute();

    const filter: ReportFilter = {};
    const result = await getProfitReport(filter);

    expect(result.units_sold).toBe(0);
    expect(result.total_profit).toBe(0);
  });
});

describe('getExpenseReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for no expenses', async () => {
    const filter: ReportFilter = {};
    const result = await getExpenseReport(filter);

    expect(result).toHaveLength(0);
  });

  it('should group expenses by category and partner correctly', async () => {
    // Create partner
    const partnerResult = await db.insert(partnersTable).values({
      name: 'Test Workshop',
      type: 'workshop',
      is_active: true
    }).returning().execute();

    const partnerId = partnerResult[0].id;

    // Create test car
    const carResult = await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'TC2020001'
    }).returning().execute();

    const carId = carResult[0].id;

    // Add various expense transactions
    await db.insert(transactionsTable).values([
      {
        car_id: carId,
        partner_id: partnerId,
        type: 'workshop',
        amount: '1500.00',
        date: new Date('2024-01-15')
      },
      {
        car_id: carId,
        partner_id: partnerId,
        type: 'workshop',
        amount: '800.00',
        date: new Date('2024-01-20')
      },
      {
        car_id: carId,
        type: 'detailing',
        amount: '500.00',
        date: new Date('2024-01-25')
      }
    ]).execute();

    const filter: ReportFilter = {};
    const result = await getExpenseReport(filter);

    expect(result).toHaveLength(2); // workshop (with partner) and detailing (without partner)

    const workshopExpense = result.find(item => item.category === 'workshop');
    expect(workshopExpense).toBeDefined();
    expect(workshopExpense!.partner_name).toBe('Test Workshop');
    expect(workshopExpense!.total_amount).toBe(2300);
    expect(workshopExpense!.transaction_count).toBe(2);

    const detailingExpense = result.find(item => item.category === 'detailing');
    expect(detailingExpense).toBeDefined();
    expect(detailingExpense!.partner_name).toBe(null);
    expect(detailingExpense!.total_amount).toBe(500);
    expect(detailingExpense!.transaction_count).toBe(1);
  });

  it('should exclude income transactions', async () => {
    // Create test car
    const carResult = await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'TC2020001'
    }).returning().execute();

    const carId = carResult[0].id;

    // Add both expense and income transactions
    await db.insert(transactionsTable).values([
      {
        car_id: carId,
        type: 'workshop',
        amount: '1500.00',
        date: new Date('2024-01-15')
      },
      {
        car_id: carId,
        type: 'sale_income',
        amount: '25000.00',
        date: new Date('2024-01-20')
      },
      {
        car_id: carId,
        type: 'other_income',
        amount: '500.00',
        date: new Date('2024-01-25')
      }
    ]).execute();

    const filter: ReportFilter = {};
    const result = await getExpenseReport(filter);

    expect(result).toHaveLength(1); // Only workshop expense
    expect(result[0].category).toBe('workshop');
    expect(result[0].total_amount).toBe(1500);
  });

  it('should filter by date range correctly', async () => {
    // Create test car
    const carResult = await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'TC2020001'
    }).returning().execute();

    const carId = carResult[0].id;

    // Add transactions in different dates
    await db.insert(transactionsTable).values([
      {
        car_id: carId,
        type: 'workshop',
        amount: '1500.00',
        date: new Date('2024-01-15')
      },
      {
        car_id: carId,
        type: 'detailing',
        amount: '500.00',
        date: new Date('2024-03-15')
      }
    ]).execute();

    const filter: ReportFilter = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-02-28')
    };

    const result = await getExpenseReport(filter);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('workshop');
    expect(result[0].total_amount).toBe(1500);
  });

  it('should filter by partner correctly', async () => {
    // Create partners
    const partner1Result = await db.insert(partnersTable).values({
      name: 'Workshop A',
      type: 'workshop',
      is_active: true
    }).returning().execute();

    const partner2Result = await db.insert(partnersTable).values({
      name: 'Workshop B',
      type: 'workshop',
      is_active: true
    }).returning().execute();

    // Create test car
    const carResult = await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'TC2020001'
    }).returning().execute();

    const carId = carResult[0].id;

    // Add transactions with different partners
    await db.insert(transactionsTable).values([
      {
        car_id: carId,
        partner_id: partner1Result[0].id,
        type: 'workshop',
        amount: '1500.00',
        date: new Date('2024-01-15')
      },
      {
        car_id: carId,
        partner_id: partner2Result[0].id,
        type: 'workshop',
        amount: '800.00',
        date: new Date('2024-01-20')
      }
    ]).execute();

    const filter: ReportFilter = {
      partner_id: partner1Result[0].id
    };

    const result = await getExpenseReport(filter);

    expect(result).toHaveLength(1);
    expect(result[0].partner_name).toBe('Workshop A');
    expect(result[0].total_amount).toBe(1500);
  });
});

describe('getStockAgingReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return zero counts for no active inventory', async () => {
    const result = await getStockAgingReport();

    expect(result).toHaveLength(4);
    expect(result.every(range => range.count === 0 && range.total_value === 0)).toBe(true);
    expect(result.map(r => r.age_range)).toEqual([
      '0-30 days',
      '31-60 days', 
      '61-90 days',
      '90+ days'
    ]);
  });

  it('should categorize units by age correctly', async () => {
    const now = new Date();
    
    // Create units of different ages
    const units = [
      { age_days: 15, stock_code: 'NEW001' },
      { age_days: 45, stock_code: 'MID001' },
      { age_days: 75, stock_code: 'OLD001' },
      { age_days: 120, stock_code: 'VOLD001' }
    ];

    for (const unit of units) {
      const createdDate = new Date(now.getTime() - (unit.age_days * 24 * 60 * 60 * 1000));
      
      const carResult = await db.insert(carUnitsTable).values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2020,
        transmission: 'automatic',
        odometer: 50000,
        color: 'White',
        stock_code: unit.stock_code,
        status: 'ready', // Active status
        created_at: createdDate
      }).returning().execute();

      // Add acquisition cost
      await db.insert(transactionsTable).values({
        car_id: carResult[0].id,
        type: 'acquisition',
        amount: '20000.00',
        date: createdDate
      }).execute();
    }

    const result = await getStockAgingReport();

    expect(result).toHaveLength(4);

    const range0_30 = result.find(r => r.age_range === '0-30 days');
    expect(range0_30!.count).toBe(1);
    expect(range0_30!.total_value).toBe(20000);

    const range31_60 = result.find(r => r.age_range === '31-60 days');
    expect(range31_60!.count).toBe(1);
    expect(range31_60!.total_value).toBe(20000);

    const range61_90 = result.find(r => r.age_range === '61-90 days');
    expect(range61_90!.count).toBe(1);
    expect(range61_90!.total_value).toBe(20000);

    const range90_plus = result.find(r => r.age_range === '90+ days');
    expect(range90_plus!.count).toBe(1);
    expect(range90_plus!.total_value).toBe(20000);
  });

  it('should exclude sold and archived units', async () => {
    const now = new Date();
    const createdDate = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)); // 15 days ago

    // Create units with different statuses
    const statuses = [
      { status: 'ready', stock_code: 'READY001' }, // Should be included
      { status: 'sold', stock_code: 'SOLD001' }, // Should be excluded
      { status: 'archived', stock_code: 'ARCH001' }, // Should be excluded
      { status: 'listed', stock_code: 'LIST001' } // Should be included
    ];

    for (const unitStatus of statuses) {
      const carResult = await db.insert(carUnitsTable).values({
        brand: 'Toyota',
        model: 'Camry',
        year: 2020,
        transmission: 'automatic',
        odometer: 50000,
        color: 'White',
        stock_code: unitStatus.stock_code,
        status: unitStatus.status as any,
        created_at: createdDate
      }).returning().execute();

      // Add acquisition cost
      await db.insert(transactionsTable).values({
        car_id: carResult[0].id,
        type: 'acquisition',
        amount: '20000.00',
        date: createdDate
      }).execute();
    }

    const result = await getStockAgingReport();

    expect(result).toHaveLength(4);

    const range0_30 = result.find(r => r.age_range === '0-30 days');
    expect(range0_30!.count).toBe(2); // Only ready and listed units
    expect(range0_30!.total_value).toBe(40000); // 2 * 20000
  });

  it('should handle units without acquisition transactions', async () => {
    const now = new Date();
    const createdDate = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)); // 15 days ago

    // Create unit without acquisition transaction
    await db.insert(carUnitsTable).values({
      brand: 'Toyota',
      model: 'Camry',
      year: 2020,
      transmission: 'automatic',
      odometer: 50000,
      color: 'White',
      stock_code: 'NOACQ001',
      status: 'ready',
      created_at: createdDate
    }).execute();

    const result = await getStockAgingReport();

    const range0_30 = result.find(r => r.age_range === '0-30 days');
    expect(range0_30!.count).toBe(1);
    expect(range0_30!.total_value).toBe(0); // No acquisition cost
  });
});