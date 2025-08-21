import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type UpdateCarUnitInput, type CarUnit } from '../schema';
import { eq, and, ne } from 'drizzle-orm';

export const updateCarUnit = async (input: UpdateCarUnitInput): Promise<CarUnit> => {
  try {
    // First, get the current car unit data for audit logging
    const existingCarUnits = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, input.id))
      .execute();

    if (existingCarUnits.length === 0) {
      throw new Error(`Car unit with id ${input.id} not found`);
    }

    const existingCarUnit = existingCarUnits[0];

    // Check stock_code uniqueness if it's being updated
    if (input.stock_code && input.stock_code !== existingCarUnit.stock_code) {
      const duplicateStockCode = await db.select()
        .from(carUnitsTable)
        .where(and(
          eq(carUnitsTable.stock_code, input.stock_code),
          ne(carUnitsTable.id, input.id)
        ))
        .execute();

      if (duplicateStockCode.length > 0) {
        throw new Error(`Stock code ${input.stock_code} already exists`);
      }
    }

    // Prepare update data - only include fields that are provided
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.brand !== undefined) updateData.brand = input.brand;
    if (input.model !== undefined) updateData.model = input.model;
    if (input.year !== undefined) updateData.year = input.year;
    if (input.transmission !== undefined) updateData.transmission = input.transmission;
    if (input.odometer !== undefined) updateData.odometer = input.odometer;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.vin !== undefined) updateData.vin = input.vin;
    if (input.stock_code !== undefined) updateData.stock_code = input.stock_code;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.primary_photo_url !== undefined) updateData.primary_photo_url = input.primary_photo_url;
    if (input.gallery_urls !== undefined) updateData.gallery_urls = input.gallery_urls;
    if (input.documents !== undefined) updateData.documents = input.documents;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.sold_price !== undefined) updateData.sold_price = input.sold_price?.toString();

    // Update the car unit
    const result = await db.update(carUnitsTable)
      .set(updateData)
      .where(eq(carUnitsTable.id, input.id))
      .returning()
      .execute();

    const updatedCarUnit = result[0];

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would be the authenticated user
        entity_type: 'car_unit',
        entity_id: input.id,
        action: 'update',
        before_data: {
          brand: existingCarUnit.brand,
          model: existingCarUnit.model,
          year: existingCarUnit.year,
          transmission: existingCarUnit.transmission,
          odometer: existingCarUnit.odometer,
          color: existingCarUnit.color,
          vin: existingCarUnit.vin,
          stock_code: existingCarUnit.stock_code,
          location: existingCarUnit.location,
          notes: existingCarUnit.notes,
          primary_photo_url: existingCarUnit.primary_photo_url,
          gallery_urls: existingCarUnit.gallery_urls,
          documents: existingCarUnit.documents,
          status: existingCarUnit.status,
          sold_price: existingCarUnit.sold_price
        },
        after_data: {
          brand: updatedCarUnit.brand,
          model: updatedCarUnit.model,
          year: updatedCarUnit.year,
          transmission: updatedCarUnit.transmission,
          odometer: updatedCarUnit.odometer,
          color: updatedCarUnit.color,
          vin: updatedCarUnit.vin,
          stock_code: updatedCarUnit.stock_code,
          location: updatedCarUnit.location,
          notes: updatedCarUnit.notes,
          primary_photo_url: updatedCarUnit.primary_photo_url,
          gallery_urls: updatedCarUnit.gallery_urls,
          documents: updatedCarUnit.documents,
          status: updatedCarUnit.status,
          sold_price: updatedCarUnit.sold_price
        }
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedCarUnit,
      sold_price: updatedCarUnit.sold_price ? parseFloat(updatedCarUnit.sold_price) : null
    };
  } catch (error) {
    console.error('Car unit update failed:', error);
    throw error;
  }
};