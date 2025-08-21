import { db } from '../db';
import { carUnitsTable, transactionsTable } from '../db/schema';
import { type DashboardKpi } from '../schema';
import { eq, ne, and, sql, sum, avg, desc, asc, gte } from 'drizzle-orm';

export async function getDashboardKpis(): Promise<DashboardKpi> {
  try {
    // Calculate active stock count (not sold or archived)
    const activeStockResult = await db
      .select({ count: sql<string>`count(*)` })
      .from(carUnitsTable)
      .where(
        and(
          ne(carUnitsTable.status, 'sold'),
          ne(carUnitsTable.status, 'archived')
        )
      )
      .execute();

    const activeStockCount = parseInt(activeStockResult[0].count);

    // Calculate average days to sale
    const avgDaysResult = await db
      .select({
        avg_days: sql<string>`avg(extract(epoch from (updated_at - created_at)) / 86400)`
      })
      .from(carUnitsTable)
      .where(eq(carUnitsTable.status, 'sold'))
      .execute();

    const averageDaysToSale = avgDaysResult[0].avg_days 
      ? parseFloat(avgDaysResult[0].avg_days) 
      : null;

    // Calculate profit for each car and aggregate totals
    const profitQuery = await db
      .select({
        car_id: transactionsTable.car_id,
        brand: carUnitsTable.brand,
        model: carUnitsTable.model,
        sold_price: carUnitsTable.sold_price,
        total_expenses: sql<string>`coalesce(sum(case 
          when ${transactionsTable.type} in ('acquisition', 'broker_fee', 'workshop', 'detailing', 'transport', 'admin', 'tax', 'other_expense') 
          then ${transactionsTable.amount} 
          else 0 
        end), 0)`,
        total_income: sql<string>`coalesce(sum(case 
          when ${transactionsTable.type} in ('sale_income', 'other_income') 
          then ${transactionsTable.amount} 
          else 0 
        end), 0)`
      })
      .from(transactionsTable)
      .innerJoin(carUnitsTable, eq(transactionsTable.car_id, carUnitsTable.id))
      .groupBy(transactionsTable.car_id, carUnitsTable.id, carUnitsTable.brand, carUnitsTable.model, carUnitsTable.sold_price)
      .execute();

    // Process profit data
    const profitData = profitQuery.map(row => {
      const totalExpenses = parseFloat(row.total_expenses);
      const totalIncome = parseFloat(row.total_income);
      const soldPrice = row.sold_price ? parseFloat(row.sold_price) : 0;
      
      // Profit = sold_price + other_income - expenses
      const profit = soldPrice + totalIncome - totalExpenses;
      
      return {
        id: row.car_id,
        brand: row.brand,
        model: row.model,
        profit
      };
    });

    // Calculate total period profit (sum of all profits)
    const totalPeriodProfit = profitData.reduce((sum, car) => sum + car.profit, 0);

    // Find top profit unit (highest profit)
    const topProfitUnit = profitData.length > 0
      ? profitData.reduce((max, car) => car.profit > max.profit ? car : max)
      : null;

    // Find bottom profit unit (lowest profit that's still positive)
    const positiveProfitUnits = profitData.filter(car => car.profit > 0);
    const bottomProfitUnit = positiveProfitUnits.length > 0
      ? positiveProfitUnits.reduce((min, car) => car.profit < min.profit ? car : min)
      : null;

    return {
      active_stock_count: activeStockCount,
      average_days_to_sale: averageDaysToSale,
      total_period_profit: totalPeriodProfit,
      top_profit_unit: topProfitUnit,
      bottom_profit_unit: bottomProfitUnit
    };
  } catch (error) {
    console.error('Dashboard KPIs calculation failed:', error);
    throw error;
  }
}