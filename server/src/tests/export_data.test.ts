import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { carUnitsTable, partnersTable, transactionsTable } from '../db/schema';
import { 
  exportInventoryToCsv, 
  exportTransactionsToCsv, 
  exportProfitReportToCsv 
} from '../handlers/export_data';
import { type InventoryFilter, type ReportFilter } from '../schema';

// Test data
const testPartner = {
  name: 'Test Workshop',
  type: 'workshop' as const,
  contact_info: 'test@workshop.com',
  is_active: true
};

const testCarUnit = {
  brand: 'Toyota',
  model: 'Camry',
  year: 2020,
  transmission: 'automatic' as const,
  odometer: 50000,
  color: 'Silver',
  vin: 'TEST123456789',
  stock_code: 'TC001',
  location: 'Lot A',
  notes: 'Good condition',
  status: 'ready' as const,
  sold_price: '25000.00'
};

const testTransaction = {
  type: 'acquisition' as const,
  amount: '20000.00',
  description: 'Car purchase',
  date: new Date('2024-01-15')
};

// Helper to parse CSV and return rows
function parseCsv(csvString: string): Record<string, string>[] {
  const lines = csvString.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current); // Add last value
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

describe('Export Data Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('exportInventoryToCsv', () => {
    it('should export inventory data to CSV format', async () => {
      // Create test data
      const carResult = await db.insert(carUnitsTable)
        .values(testCarUnit)
        .returning()
        .execute();

      const csv = await exportInventoryToCsv();
      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');

      // Parse and validate CSV
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row['Brand']).toBe('Toyota');
      expect(row['Model']).toBe('Camry');
      expect(row['Year']).toBe('2020');
      expect(row['Status']).toBe('ready');
      expect(row['Stock Code']).toBe('TC001');
      expect(row['Sold Price']).toBe('25000');
    });

    it('should handle empty inventory', async () => {
      const csv = await exportInventoryToCsv();
      expect(csv).toBeDefined();
      
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(0);
      
      // Should still have headers
      expect(csv.includes('ID,Brand,Model')).toBe(true);
    });

    it('should apply status filter', async () => {
      // Create cars with different statuses
      await db.insert(carUnitsTable)
        .values([
          { ...testCarUnit, stock_code: 'TC001', status: 'ready' },
          { ...testCarUnit, stock_code: 'TC002', status: 'sold' }
        ])
        .execute();

      const filter: InventoryFilter = { status: 'ready' };
      const csv = await exportInventoryToCsv(filter);
      
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]['Status']).toBe('ready');
      expect(rows[0]['Stock Code']).toBe('TC001');
    });

    it('should apply year range filters', async () => {
      await db.insert(carUnitsTable)
        .values([
          { ...testCarUnit, stock_code: 'TC001', year: 2018 },
          { ...testCarUnit, stock_code: 'TC002', year: 2020 },
          { ...testCarUnit, stock_code: 'TC003', year: 2022 }
        ])
        .execute();

      const filter: InventoryFilter = { year_min: 2019, year_max: 2021 };
      const csv = await exportInventoryToCsv(filter);
      
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]['Year']).toBe('2020');
    });

    it('should apply search filter', async () => {
      await db.insert(carUnitsTable)
        .values([
          { ...testCarUnit, stock_code: 'TC001', brand: 'Toyota' },
          { ...testCarUnit, stock_code: 'TC002', brand: 'Honda' }
        ])
        .execute();

      const filter: InventoryFilter = { search: 'Toy' };
      const csv = await exportInventoryToCsv(filter);
      
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]['Brand']).toBe('Toyota');
    });

    it('should handle special characters in CSV data', async () => {
      const specialCarUnit = {
        ...testCarUnit,
        stock_code: 'TC001',
        notes: 'Has "quotes" and, commas\nand newlines',
        location: 'Lot "A"'
      };

      await db.insert(carUnitsTable)
        .values(specialCarUnit)
        .execute();

      const csv = await exportInventoryToCsv();
      expect(csv).toContain('""quotes""');
      expect(csv).toContain('"Lot ""A"""');
    });
  });

  describe('exportTransactionsToCsv', () => {
    let carId: number;
    let partnerId: number;

    beforeEach(async () => {
      // Create prerequisite data
      const partnerResult = await db.insert(partnersTable)
        .values(testPartner)
        .returning()
        .execute();
      partnerId = partnerResult[0].id;

      const carResult = await db.insert(carUnitsTable)
        .values(testCarUnit)
        .returning()
        .execute();
      carId = carResult[0].id;
    });

    it('should export transactions with car and partner details', async () => {
      await db.insert(transactionsTable)
        .values({
          ...testTransaction,
          car_id: carId,
          partner_id: partnerId
        })
        .execute();

      const csv = await exportTransactionsToCsv();
      expect(csv).toBeDefined();

      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row['Car Brand']).toBe('Toyota');
      expect(row['Car Model']).toBe('Camry');
      expect(row['Partner Name']).toBe('Test Workshop');
      expect(row['Transaction Type']).toBe('acquisition');
      expect(row['Amount']).toBe('20000');
    });

    it('should handle transactions without partners', async () => {
      await db.insert(transactionsTable)
        .values({
          ...testTransaction,
          car_id: carId,
          partner_id: null
        })
        .execute();

      const csv = await exportTransactionsToCsv();
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      
      const row = rows[0];
      expect(row['Partner Name']).toBe('');
      expect(row['Partner Type']).toBe('');
    });

    it('should apply date range filters', async () => {
      await db.insert(transactionsTable)
        .values([
          {
            ...testTransaction,
            car_id: carId,
            date: new Date('2024-01-10')
          },
          {
            ...testTransaction,
            car_id: carId,
            date: new Date('2024-01-20'),
            amount: '15000.00'
          }
        ])
        .execute();

      const filter: ReportFilter = {
        start_date: new Date('2024-01-15'),
        end_date: new Date('2024-01-25')
      };

      const csv = await exportTransactionsToCsv(filter);
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]['Amount']).toBe('15000');
    });

    it('should apply partner filter', async () => {
      // Create another partner
      const partner2Result = await db.insert(partnersTable)
        .values({
          name: 'Other Partner',
          type: 'broker' as const,
          is_active: true
        })
        .returning()
        .execute();

      await db.insert(transactionsTable)
        .values([
          {
            ...testTransaction,
            car_id: carId,
            partner_id: partnerId,
            amount: '10000.00'
          },
          {
            ...testTransaction,
            car_id: carId,
            partner_id: partner2Result[0].id,
            amount: '15000.00'
          }
        ])
        .execute();

      const filter: ReportFilter = { partner_id: partnerId };
      const csv = await exportTransactionsToCsv(filter);
      
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]['Partner Name']).toBe('Test Workshop');
      expect(rows[0]['Amount']).toBe('10000');
    });
  });

  describe('exportProfitReportToCsv', () => {
    let carId: number;
    let partnerId: number;

    beforeEach(async () => {
      // Create prerequisite data
      const partnerResult = await db.insert(partnersTable)
        .values(testPartner)
        .returning()
        .execute();
      partnerId = partnerResult[0].id;

      const carResult = await db.insert(carUnitsTable)
        .values({
          ...testCarUnit,
          status: 'sold' as const,
          sold_price: '30000.00',
          created_at: new Date('2024-06-01') // Ensure it's within our test date range
        })
        .returning()
        .execute();
      carId = carResult[0].id;
    });

    it('should calculate profit correctly', async () => {
      // Create various transactions
      await db.insert(transactionsTable)
        .values([
          {
            car_id: carId,
            type: 'acquisition' as const,
            amount: '20000.00',
            description: 'Purchase cost',
            date: new Date('2024-01-01')
          },
          {
            car_id: carId,
            type: 'workshop' as const,
            amount: '2000.00',
            description: 'Repairs',
            date: new Date('2024-01-05'),
            partner_id: partnerId
          },
          {
            car_id: carId,
            type: 'sale_income' as const,
            amount: '30000.00',
            description: 'Sale',
            date: new Date('2024-01-10')
          }
        ])
        .execute();

      const filter: ReportFilter = {};
      const csv = await exportProfitReportToCsv(filter);
      
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row['Acquisition Cost']).toBe('20000');
      expect(row['Total Expenses']).toBe('2000');
      expect(row['Total Cost']).toBe('22000');
      expect(row['Sale Price']).toBe('30000');
      expect(row['Total Revenue']).toBe('60000'); // Sale price + sale income
      expect(row['Profit']).toBe('38000'); // 60000 - 22000
    });

    it('should handle cars without transactions', async () => {
      const filter: ReportFilter = {};
      const csv = await exportProfitReportToCsv(filter);
      
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row['Acquisition Cost']).toBe('0');
      expect(row['Total Expenses']).toBe('0');
      expect(row['Sale Price']).toBe('30000');
      expect(row['Profit']).toBe('30000');
    });

    it('should apply date filters', async () => {
      // Create cars with different creation dates
      await db.insert(carUnitsTable)
        .values([
          {
            ...testCarUnit,
            stock_code: 'OLD001',
            created_at: new Date('2023-12-01')
          },
          {
            ...testCarUnit,
            stock_code: 'NEW001',
            created_at: new Date('2024-02-01')
          }
        ])
        .execute();

      const filter: ReportFilter = {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const csv = await exportProfitReportToCsv(filter);
      const rows = parseCsv(csv);
      
      // Should include original car (TC001 from beforeEach) + new car (2 total), excluding old car
      expect(rows).toHaveLength(2);
      
      const stockCodes = rows.map(row => row['Stock Code']);
      expect(stockCodes).toContain('TC001');
      expect(stockCodes).toContain('NEW001');
      expect(stockCodes).not.toContain('OLD001');
    });

    it('should calculate profit margin correctly', async () => {
      await db.insert(transactionsTable)
        .values([
          {
            car_id: carId,
            type: 'acquisition' as const,
            amount: '10000.00',
            description: 'Low cost purchase',
            date: new Date('2024-01-01')
          }
        ])
        .execute();

      const filter: ReportFilter = {};
      const csv = await exportProfitReportToCsv(filter);
      
      const rows = parseCsv(csv);
      const row = rows[0];
      
      // Total revenue: 30000 (sold_price), Total cost: 10000
      // Profit: 20000, Margin: (20000/30000) * 100 = 66.67%
      expect(row['Profit Margin %']).toBe('66.67');
    });
  });
});