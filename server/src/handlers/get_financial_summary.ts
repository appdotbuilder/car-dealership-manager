import { db } from '../db';
import { carUnitsTable, transactionsTable } from '../db/schema';
import { type FinancialSummary } from '../schema';
import { eq, sum } from 'drizzle-orm';

export async function getFinancialSummaryByCarId(carId: number): Promise<FinancialSummary> {
  try {
    // Get car unit to access sold_price
    const carUnit = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .limit(1)
      .execute();

    if (carUnit.length === 0) {
      throw new Error(`Car unit with id ${carId} not found`);
    }

    // Get all transactions for this car
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.car_id, carId))
      .execute();

    // Calculate financial components
    let total_acquisition = 0;
    let total_expenses = 0;
    let total_incomes = 0;
    let sale_income_total = 0;

    // Categorize transaction types
    const expenseTypes = [
      'broker_fee', 'workshop', 'detailing', 'transport', 
      'admin', 'tax', 'other_expense'
    ];
    const incomeTypes = ['sale_income', 'other_income'];

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      
      if (transaction.type === 'acquisition') {
        total_acquisition += amount;
      } else if (expenseTypes.includes(transaction.type)) {
        total_expenses += amount;
      } else if (incomeTypes.includes(transaction.type)) {
        total_incomes += amount;
        if (transaction.type === 'sale_income') {
          sale_income_total += amount;
        }
      }
    });

    // Determine sold_price: prefer car unit's sold_price, fallback to sale_income total
    const sold_price = carUnit[0].sold_price 
      ? parseFloat(carUnit[0].sold_price) 
      : (sale_income_total > 0 ? sale_income_total : null);

    // Calculate profit: total_incomes - total_acquisition - total_expenses
    const profit = total_incomes - total_acquisition - total_expenses;

    return {
      car_id: carId,
      total_acquisition,
      total_expenses,
      total_incomes,
      profit,
      sold_price
    };
  } catch (error) {
    console.error('Financial summary calculation failed:', error);
    throw error;
  }
}

export async function getAllFinancialSummaries(): Promise<FinancialSummary[]> {
  try {
    // Get all car units
    const carUnits = await db.select()
      .from(carUnitsTable)
      .execute();

    // Calculate financial summary for each car unit
    const summaries: FinancialSummary[] = [];
    
    for (const carUnit of carUnits) {
      try {
        const summary = await getFinancialSummaryByCarId(carUnit.id);
        summaries.push(summary);
      } catch (error) {
        console.error(`Failed to calculate summary for car ${carUnit.id}:`, error);
        // Continue with other cars even if one fails
      }
    }

    return summaries;
  } catch (error) {
    console.error('All financial summaries calculation failed:', error);
    throw error;
  }
}