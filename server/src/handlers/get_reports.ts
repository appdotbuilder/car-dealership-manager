import { db } from '../db';
import { carUnitsTable, transactionsTable, partnersTable } from '../db/schema';
import { type ReportFilter, type ProfitReport, type ExpenseReportItem } from '../schema';
import { and, eq, gte, lte, sql, isNull, ne, SQL } from 'drizzle-orm';

export async function getProfitReport(filter: ReportFilter): Promise<ProfitReport> {
  try {
    const conditions: SQL<unknown>[] = [];
    
    // Only include sold units
    conditions.push(eq(carUnitsTable.status, 'sold'));
    conditions.push(ne(isNull(carUnitsTable.sold_price), true));

    // Apply date filters
    if (filter.start_date) {
      conditions.push(gte(carUnitsTable.updated_at, filter.start_date));
    }
    if (filter.end_date) {
      conditions.push(lte(carUnitsTable.updated_at, filter.end_date));
    }

    // Build and execute query
    const soldUnits = await db
      .select({
        car_id: carUnitsTable.id,
        sold_price: carUnitsTable.sold_price,
        created_at: carUnitsTable.created_at,
        updated_at: carUnitsTable.updated_at
      })
      .from(carUnitsTable)
      .where(and(...conditions))
      .execute();

    if (soldUnits.length === 0) {
      return {
        total_profit: 0,
        average_profit_per_unit: 0,
        units_sold: 0,
        period_start: filter.start_date || new Date(),
        period_end: filter.end_date || new Date()
      };
    }

    // Calculate profit for each unit
    let totalProfit = 0;
    
    for (const unit of soldUnits) {
      const soldPrice = parseFloat(unit.sold_price || '0');

      // Get total expenses for this unit
      const expenseResult = await db
        .select({
          total_expenses: sql<string>`COALESCE(SUM(CAST(${transactionsTable.amount} AS NUMERIC)), 0)`
        })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.car_id, unit.car_id),
            ne(transactionsTable.type, 'sale_income'),
            ne(transactionsTable.type, 'other_income')
          )
        )
        .execute();

      const totalExpenses = parseFloat(expenseResult[0].total_expenses);
      const unitProfit = soldPrice - totalExpenses;
      totalProfit += unitProfit;
    }

    const unitsCount = soldUnits.length;
    const averageProfit = unitsCount > 0 ? totalProfit / unitsCount : 0;

    return {
      total_profit: totalProfit,
      average_profit_per_unit: averageProfit,
      units_sold: unitsCount,
      period_start: filter.start_date || new Date(),
      period_end: filter.end_date || new Date()
    };
  } catch (error) {
    console.error('Profit report generation failed:', error);
    throw error;
  }
}

export async function getExpenseReport(filter: ReportFilter): Promise<ExpenseReportItem[]> {
  try {
    const conditions: SQL<unknown>[] = [];

    // Only include expense types (exclude income types)
    conditions.push(ne(transactionsTable.type, 'sale_income'));
    conditions.push(ne(transactionsTable.type, 'other_income'));

    // Apply date filters
    if (filter.start_date) {
      conditions.push(gte(transactionsTable.date, filter.start_date));
    }
    if (filter.end_date) {
      conditions.push(lte(transactionsTable.date, filter.end_date));
    }

    // Apply partner filter
    if (filter.partner_id) {
      conditions.push(eq(transactionsTable.partner_id, filter.partner_id));
    }

    // Build and execute query with left join to partners
    const transactions = await db
      .select({
        type: transactionsTable.type,
        partner_name: partnersTable.name,
        amount: transactionsTable.amount,
        date: transactionsTable.date
      })
      .from(transactionsTable)
      .leftJoin(partnersTable, eq(transactionsTable.partner_id, partnersTable.id))
      .where(and(...conditions))
      .execute();

    // Group by category and partner
    const grouped = new Map<string, {
      category: string;
      partner_name: string | null;
      total_amount: number;
      transaction_count: number;
    }>();

    transactions.forEach(transaction => {
      const key = `${transaction.type}|${transaction.partner_name || 'NO_PARTNER'}`;
      const amount = parseFloat(transaction.amount);

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.total_amount += amount;
        existing.transaction_count += 1;
      } else {
        grouped.set(key, {
          category: transaction.type,
          partner_name: transaction.partner_name,
          total_amount: amount,
          transaction_count: 1
        });
      }
    });

    // Convert to array and format
    return Array.from(grouped.values()).map(item => ({
      category: item.category as any,
      partner_name: item.partner_name,
      total_amount: item.total_amount,
      transaction_count: item.transaction_count
    }));
  } catch (error) {
    console.error('Expense report generation failed:', error);
    throw error;
  }
}

export async function getStockAgingReport(): Promise<Array<{
  age_range: string;
  count: number;
  total_value: number;
}>> {
  try {
    // Get active inventory with acquisition costs
    const activeUnits = await db
      .select({
        car_id: carUnitsTable.id,
        created_at: carUnitsTable.created_at
      })
      .from(carUnitsTable)
      .where(
        and(
          ne(carUnitsTable.status, 'sold'),
          ne(carUnitsTable.status, 'archived')
        )
      )
      .execute();

    if (activeUnits.length === 0) {
      return [
        { age_range: '0-30 days', count: 0, total_value: 0 },
        { age_range: '31-60 days', count: 0, total_value: 0 },
        { age_range: '61-90 days', count: 0, total_value: 0 },
        { age_range: '90+ days', count: 0, total_value: 0 }
      ];
    }

    // Initialize age ranges with explicit type
    type AgeRange = '0-30 days' | '31-60 days' | '61-90 days' | '90+ days';
    const ageRanges: Record<AgeRange, { count: number; total_value: number }> = {
      '0-30 days': { count: 0, total_value: 0 },
      '31-60 days': { count: 0, total_value: 0 },
      '61-90 days': { count: 0, total_value: 0 },
      '90+ days': { count: 0, total_value: 0 }
    };

    const now = new Date();

    // Process each unit
    for (const unit of activeUnits) {
      const ageInDays = Math.floor((now.getTime() - unit.created_at.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get acquisition cost for this unit
      const acquisitionResult = await db
        .select({
          total_acquisition: sql<string>`COALESCE(SUM(CAST(${transactionsTable.amount} AS NUMERIC)), 0)`
        })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.car_id, unit.car_id),
            eq(transactionsTable.type, 'acquisition')
          )
        )
        .execute();

      const acquisitionValue = parseFloat(acquisitionResult[0].total_acquisition);

      // Determine age range
      let ageRange: AgeRange;
      if (ageInDays <= 30) {
        ageRange = '0-30 days';
      } else if (ageInDays <= 60) {
        ageRange = '31-60 days';
      } else if (ageInDays <= 90) {
        ageRange = '61-90 days';
      } else {
        ageRange = '90+ days';
      }

      // Update counts and values
      ageRanges[ageRange].count += 1;
      ageRanges[ageRange].total_value += acquisitionValue;
    }

    // Convert to array format
    return Object.entries(ageRanges).map(([age_range, data]) => ({
      age_range,
      count: data.count,
      total_value: data.total_value
    }));
  } catch (error) {
    console.error('Stock aging report generation failed:', error);
    throw error;
  }
}