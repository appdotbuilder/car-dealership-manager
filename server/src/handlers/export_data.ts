import { db } from '../db';
import { carUnitsTable, transactionsTable, partnersTable } from '../db/schema';
import { type InventoryFilter, type ReportFilter } from '../schema';
import { eq, and, gte, lte, like, between, sum, SQL } from 'drizzle-orm';

// Helper function to escape CSV values
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

// Helper function to convert array of objects to CSV
function arrayToCsv(data: Record<string, any>[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => escapeCsvValue(row[header])).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

export async function exportInventoryToCsv(filter?: InventoryFilter): Promise<string> {
  try {
    // Build the base query for car units
    const baseQuery = db.select({
      id: carUnitsTable.id,
      brand: carUnitsTable.brand,
      model: carUnitsTable.model,
      year: carUnitsTable.year,
      transmission: carUnitsTable.transmission,
      odometer: carUnitsTable.odometer,
      color: carUnitsTable.color,
      vin: carUnitsTable.vin,
      stock_code: carUnitsTable.stock_code,
      location: carUnitsTable.location,
      notes: carUnitsTable.notes,
      status: carUnitsTable.status,
      sold_price: carUnitsTable.sold_price,
      created_at: carUnitsTable.created_at,
      updated_at: carUnitsTable.updated_at
    }).from(carUnitsTable);

    // Apply filters
    const conditions: SQL<unknown>[] = [];

    if (filter?.status) {
      conditions.push(eq(carUnitsTable.status, filter.status));
    }

    if (filter?.year_min !== undefined) {
      conditions.push(gte(carUnitsTable.year, filter.year_min));
    }

    if (filter?.year_max !== undefined) {
      conditions.push(lte(carUnitsTable.year, filter.year_max));
    }

    if (filter?.transmission) {
      conditions.push(eq(carUnitsTable.transmission, filter.transmission));
    }

    if (filter?.search) {
      const searchTerm = `%${filter.search}%`;
      conditions.push(
        like(carUnitsTable.brand, searchTerm)
      );
    }

    // Apply where clause if conditions exist
    const query = conditions.length > 0 
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    const results = await query.execute();

    // Convert numeric fields and format data
    const inventoryData = results.map(unit => ({
      ID: unit.id,
      Brand: unit.brand,
      Model: unit.model,
      Year: unit.year,
      Transmission: unit.transmission,
      Odometer: unit.odometer,
      Color: unit.color,
      VIN: unit.vin,
      'Stock Code': unit.stock_code,
      Location: unit.location,
      Notes: unit.notes,
      Status: unit.status,
      'Sold Price': unit.sold_price ? parseFloat(unit.sold_price) : null,
      'Created At': unit.created_at.toISOString(),
      'Updated At': unit.updated_at.toISOString()
    }));

    const headers = [
      'ID', 'Brand', 'Model', 'Year', 'Transmission', 'Odometer', 
      'Color', 'VIN', 'Stock Code', 'Location', 'Notes', 'Status', 
      'Sold Price', 'Created At', 'Updated At'
    ];

    return arrayToCsv(inventoryData, headers);
  } catch (error) {
    console.error('Inventory CSV export failed:', error);
    throw error;
  }
}

export async function exportTransactionsToCsv(filter?: ReportFilter): Promise<string> {
  try {
    // Build query with joins to get car and partner information
    const baseQuery = db.select({
      transaction_id: transactionsTable.id,
      car_id: transactionsTable.car_id,
      car_brand: carUnitsTable.brand,
      car_model: carUnitsTable.model,
      car_stock_code: carUnitsTable.stock_code,
      partner_id: transactionsTable.partner_id,
      partner_name: partnersTable.name,
      partner_type: partnersTable.type,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      percentage: transactionsTable.percentage,
      description: transactionsTable.description,
      date: transactionsTable.date,
      created_at: transactionsTable.created_at
    })
    .from(transactionsTable)
    .innerJoin(carUnitsTable, eq(transactionsTable.car_id, carUnitsTable.id))
    .leftJoin(partnersTable, eq(transactionsTable.partner_id, partnersTable.id));

    // Apply filters
    const conditions: SQL<unknown>[] = [];

    if (filter?.start_date) {
      conditions.push(gte(transactionsTable.date, filter.start_date));
    }

    if (filter?.end_date) {
      conditions.push(lte(transactionsTable.date, filter.end_date));
    }

    if (filter?.status) {
      conditions.push(eq(carUnitsTable.status, filter.status));
    }

    if (filter?.partner_id) {
      conditions.push(eq(transactionsTable.partner_id, filter.partner_id));
    }

    // Apply where clause if conditions exist
    const query = conditions.length > 0 
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    const results = await query.execute();

    // Format the data for CSV export
    const transactionData = results.map(transaction => ({
      'Transaction ID': transaction.transaction_id,
      'Car ID': transaction.car_id,
      'Car Brand': transaction.car_brand,
      'Car Model': transaction.car_model,
      'Stock Code': transaction.car_stock_code,
      'Partner ID': transaction.partner_id,
      'Partner Name': transaction.partner_name,
      'Partner Type': transaction.partner_type,
      'Transaction Type': transaction.type,
      'Amount': parseFloat(transaction.amount),
      'Percentage': transaction.percentage ? parseFloat(transaction.percentage) : null,
      'Description': transaction.description,
      'Date': transaction.date.toISOString(),
      'Created At': transaction.created_at.toISOString()
    }));

    const headers = [
      'Transaction ID', 'Car ID', 'Car Brand', 'Car Model', 'Stock Code',
      'Partner ID', 'Partner Name', 'Partner Type', 'Transaction Type',
      'Amount', 'Percentage', 'Description', 'Date', 'Created At'
    ];

    return arrayToCsv(transactionData, headers);
  } catch (error) {
    console.error('Transactions CSV export failed:', error);
    throw error;
  }
}

export async function exportProfitReportToCsv(filter: ReportFilter): Promise<string> {
  try {
    // Build a comprehensive profit analysis query
    const baseQuery = db.select({
      car_id: carUnitsTable.id,
      brand: carUnitsTable.brand,
      model: carUnitsTable.model,
      year: carUnitsTable.year,
      stock_code: carUnitsTable.stock_code,
      status: carUnitsTable.status,
      sold_price: carUnitsTable.sold_price,
      created_at: carUnitsTable.created_at,
      updated_at: carUnitsTable.updated_at
    })
    .from(carUnitsTable);

    // Apply filters
    const conditions: SQL<unknown>[] = [];

    if (filter.start_date) {
      conditions.push(gte(carUnitsTable.created_at, filter.start_date));
    }

    if (filter.end_date) {
      conditions.push(lte(carUnitsTable.created_at, filter.end_date));
    }

    if (filter.status) {
      conditions.push(eq(carUnitsTable.status, filter.status));
    }

    const query = conditions.length > 0 
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    const cars = await query.execute();

    // For each car, calculate profit breakdown
    const profitData = [];

    for (const car of cars) {
      // Get all transactions for this car
      const transactions = await db.select({
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        partner_name: partnersTable.name
      })
      .from(transactionsTable)
      .leftJoin(partnersTable, eq(transactionsTable.partner_id, partnersTable.id))
      .where(eq(transactionsTable.car_id, car.car_id))
      .execute();

      // Calculate totals
      let totalAcquisition = 0;
      let totalExpenses = 0;
      let totalIncomes = 0;

      transactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount);
        
        if (transaction.type === 'acquisition') {
          totalAcquisition += amount;
        } else if (['broker_fee', 'workshop', 'detailing', 'transport', 'admin', 'tax', 'other_expense'].includes(transaction.type)) {
          totalExpenses += amount;
        } else if (['sale_income', 'other_income'].includes(transaction.type)) {
          totalIncomes += amount;
        }
      });

      const soldPrice = car.sold_price ? parseFloat(car.sold_price) : 0;
      const totalCost = totalAcquisition + totalExpenses;
      const totalRevenue = totalIncomes + soldPrice;
      const profit = totalRevenue - totalCost;

      profitData.push({
        'Car ID': car.car_id,
        'Brand': car.brand,
        'Model': car.model,
        'Year': car.year,
        'Stock Code': car.stock_code,
        'Status': car.status,
        'Acquisition Cost': totalAcquisition,
        'Total Expenses': totalExpenses,
        'Total Cost': totalCost,
        'Sale Price': soldPrice,
        'Other Income': totalIncomes,
        'Total Revenue': totalRevenue,
        'Profit': profit,
        'Profit Margin %': totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : '0.00',
        'Created At': car.created_at.toISOString(),
        'Updated At': car.updated_at.toISOString()
      });
    }

    const headers = [
      'Car ID', 'Brand', 'Model', 'Year', 'Stock Code', 'Status',
      'Acquisition Cost', 'Total Expenses', 'Total Cost', 'Sale Price',
      'Other Income', 'Total Revenue', 'Profit', 'Profit Margin %',
      'Created At', 'Updated At'
    ];

    return arrayToCsv(profitData, headers);
  } catch (error) {
    console.error('Profit report CSV export failed:', error);
    throw error;
  }
}