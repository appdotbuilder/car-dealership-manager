import { db } from '../db';
import { transactionsTable, carUnitsTable, auditLogsTable, partnersTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq } from 'drizzle-orm';

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  try {
    // Validate that the car exists
    const carExists = await db.select({ id: carUnitsTable.id })
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, input.car_id))
      .execute();

    if (carExists.length === 0) {
      throw new Error(`Car with ID ${input.car_id} does not exist`);
    }

    // Validate partner exists if partner_id is provided
    if (input.partner_id !== null && input.partner_id !== undefined) {
      const partnerExists = await db.select({ id: partnersTable.id })
        .from(partnersTable)
        .where(eq(partnersTable.id, input.partner_id))
        .execute();

      if (partnerExists.length === 0) {
        throw new Error(`Partner with ID ${input.partner_id} does not exist`);
      }
    }

    // Handle percentage-based amount calculation for broker fees
    let finalAmount = input.amount;
    if (input.type === 'broker_fee' && input.percentage !== null && input.percentage !== undefined) {
      // If percentage is provided for broker fee, calculate amount based on car's sale price
      const car = await db.select({ sold_price: carUnitsTable.sold_price })
        .from(carUnitsTable)
        .where(eq(carUnitsTable.id, input.car_id))
        .execute();

      if (car[0].sold_price) {
        const soldPrice = parseFloat(car[0].sold_price);
        finalAmount = (soldPrice * input.percentage) / 100;
      }
    }

    // Insert transaction record
    const result = await db.insert(transactionsTable)
      .values({
        car_id: input.car_id,
        partner_id: input.partner_id || null,
        type: input.type,
        amount: finalAmount.toString(), // Convert number to string for numeric column
        percentage: input.percentage?.toString() || null, // Convert number to string for numeric column
        description: input.description || null,
        date: input.date || new Date()
      })
      .returning()
      .execute();

    const transaction = result[0];

    // Update car's sold_price if this is a sale_income transaction
    if (input.type === 'sale_income') {
      await db.update(carUnitsTable)
        .set({ 
          sold_price: finalAmount.toString(), // Convert number to string for numeric column
          updated_at: new Date()
        })
        .where(eq(carUnitsTable.id, input.car_id))
        .execute();
    }

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would come from authenticated user context
        entity_type: 'transaction',
        entity_id: transaction.id,
        action: 'create',
        before_data: null,
        after_data: {
          id: transaction.id,
          car_id: transaction.car_id,
          partner_id: transaction.partner_id,
          type: transaction.type,
          amount: parseFloat(transaction.amount),
          percentage: transaction.percentage ? parseFloat(transaction.percentage) : null,
          description: transaction.description,
          date: transaction.date
        }
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...transaction,
      amount: parseFloat(transaction.amount), // Convert string back to number
      percentage: transaction.percentage ? parseFloat(transaction.percentage) : null // Convert string back to number
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
}