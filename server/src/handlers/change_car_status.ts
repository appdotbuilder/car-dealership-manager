import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type ChangeStatusInput, type CarUnit, type UnitStatus } from '../schema';
import { eq } from 'drizzle-orm';

// Define allowed status transitions
const ALLOWED_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  'draft': ['bought', 'archived'],
  'bought': ['recond', 'ready', 'archived'],
  'recond': ['ready', 'listed', 'archived'],
  'ready': ['listed', 'sold', 'archived'],
  'listed': ['sold', 'recond', 'archived'],
  'sold': ['archived'],
  'archived': [] // No transitions allowed from archived
};

export async function changeCarStatus(input: ChangeStatusInput): Promise<CarUnit> {
  try {
    // First, get the current car unit
    const existingCar = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, input.car_id))
      .execute();

    if (existingCar.length === 0) {
      throw new Error(`Car unit with id ${input.car_id} not found`);
    }

    const currentCar = existingCar[0];
    const currentStatus = currentCar.status as UnitStatus;

    // Validate status transition
    if (currentStatus === input.new_status) {
      throw new Error(`Car is already in status: ${input.new_status}`);
    }

    const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStatuses.includes(input.new_status)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${input.new_status}`);
    }

    // Prepare update data
    const updateData: any = {
      status: input.new_status,
      updated_at: new Date()
    };

    // Add notes if provided
    if (input.notes) {
      updateData.notes = input.notes;
    }

    // Auto-set sold_price when changing to 'sold' status if not already set
    if (input.new_status === 'sold' && !currentCar.sold_price) {
      // For now, we'll leave sold_price as null - it should be set manually
      // In a real application, you might want to require sold_price as input
      // or calculate it based on transactions
    }

    // Update the car unit
    const updatedCars = await db.update(carUnitsTable)
      .set(updateData)
      .where(eq(carUnitsTable.id, input.car_id))
      .returning()
      .execute();

    const updatedCar = updatedCars[0];

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would be the current user
        entity_type: 'car_unit',
        entity_id: input.car_id,
        action: 'status_change',
        before_data: { 
          status: currentStatus,
          notes: currentCar.notes 
        },
        after_data: { 
          status: input.new_status,
          notes: updateData.notes || currentCar.notes 
        }
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedCar,
      sold_price: updatedCar.sold_price ? parseFloat(updatedCar.sold_price) : null
    };

  } catch (error) {
    console.error('Status change failed:', error);
    throw error;
  }
}