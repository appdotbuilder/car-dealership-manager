import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type CarUnit } from '../schema';
import { eq } from 'drizzle-orm';

export async function archiveCarUnit(carId: number): Promise<CarUnit> {
  try {
    // First, fetch the current car unit to validate it exists and can be archived
    const existingCars = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    if (existingCars.length === 0) {
      throw new Error(`Car unit with ID ${carId} not found`);
    }

    const existingCar = existingCars[0];

    // Validate that the car can be archived (must be 'sold' to archive)
    if (existingCar.status !== 'sold') {
      throw new Error(`Cannot archive car unit with status '${existingCar.status}'. Only 'sold' cars can be archived.`);
    }

    // Update the car unit status to 'archived'
    const updatedCars = await db.update(carUnitsTable)
      .set({
        status: 'archived',
        updated_at: new Date()
      })
      .where(eq(carUnitsTable.id, carId))
      .returning()
      .execute();

    const updatedCar = updatedCars[0];

    // Create audit log entry for the archiving action
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real system, this would be the authenticated user
        entity_type: 'car_unit',
        entity_id: carId,
        action: 'status_change',
        before_data: {
          status: existingCar.status
        },
        after_data: {
          status: 'archived'
        }
      })
      .execute();

    // Return the updated car with proper numeric field conversions
    return {
      ...updatedCar,
      sold_price: updatedCar.sold_price ? parseFloat(updatedCar.sold_price) : null
    };
  } catch (error) {
    console.error('Car unit archiving failed:', error);
    throw error;
  }
}