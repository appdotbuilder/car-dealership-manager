import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable } from '../db/schema';
import { type CreatePartnerInput } from '../schema';
import { getPartners, type GetPartnersFilters } from '../handlers/get_partners';

// Test partner data
const testPartners: CreatePartnerInput[] = [
  {
    name: 'Auto Broker Pro',
    type: 'broker',
    contact_info: 'broker@example.com',
    is_active: true
  },
  {
    name: 'Quick Workshop',
    type: 'workshop',
    contact_info: 'workshop@example.com',
    is_active: true
  },
  {
    name: 'Luxury Salon',
    type: 'salon',
    contact_info: null,
    is_active: false
  },
  {
    name: 'Fast Transport',
    type: 'transport',
    contact_info: 'transport@example.com',
    is_active: true
  },
  {
    name: 'Inactive Broker',
    type: 'broker',
    contact_info: 'inactive@example.com',
    is_active: false
  }
];

describe('getPartners', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all partners when no filters provided', async () => {
    // Insert test data
    await db.insert(partnersTable).values(testPartners).execute();

    const result = await getPartners();

    expect(result).toHaveLength(5);
    expect(result.every(partner => typeof partner.id === 'number')).toBe(true);
    expect(result.every(partner => partner.created_at instanceof Date)).toBe(true);
    expect(result.every(partner => partner.updated_at instanceof Date)).toBe(true);
    
    // Verify all test partners are included
    const names = result.map(p => p.name);
    expect(names).toContain('Auto Broker Pro');
    expect(names).toContain('Quick Workshop');
    expect(names).toContain('Luxury Salon');
    expect(names).toContain('Fast Transport');
    expect(names).toContain('Inactive Broker');
  });

  it('should return empty array when no partners exist', async () => {
    const result = await getPartners();

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should filter partners by type', async () => {
    // Insert test data
    await db.insert(partnersTable).values(testPartners).execute();

    const filters: GetPartnersFilters = { type: 'broker' };
    const result = await getPartners(filters);

    expect(result).toHaveLength(2);
    expect(result.every(partner => partner.type === 'broker')).toBe(true);
    
    const names = result.map(p => p.name);
    expect(names).toContain('Auto Broker Pro');
    expect(names).toContain('Inactive Broker');
  });

  it('should filter partners by active status', async () => {
    // Insert test data
    await db.insert(partnersTable).values(testPartners).execute();

    const filters: GetPartnersFilters = { is_active: true };
    const result = await getPartners(filters);

    expect(result).toHaveLength(3);
    expect(result.every(partner => partner.is_active === true)).toBe(true);
    
    const names = result.map(p => p.name);
    expect(names).toContain('Auto Broker Pro');
    expect(names).toContain('Quick Workshop');
    expect(names).toContain('Fast Transport');
  });

  it('should filter partners by inactive status', async () => {
    // Insert test data
    await db.insert(partnersTable).values(testPartners).execute();

    const filters: GetPartnersFilters = { is_active: false };
    const result = await getPartners(filters);

    expect(result).toHaveLength(2);
    expect(result.every(partner => partner.is_active === false)).toBe(true);
    
    const names = result.map(p => p.name);
    expect(names).toContain('Luxury Salon');
    expect(names).toContain('Inactive Broker');
  });

  it('should filter partners by both type and active status', async () => {
    // Insert test data
    await db.insert(partnersTable).values(testPartners).execute();

    const filters: GetPartnersFilters = { type: 'broker', is_active: true };
    const result = await getPartners(filters);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('broker');
    expect(result[0].is_active).toBe(true);
    expect(result[0].name).toBe('Auto Broker Pro');
  });

  it('should return empty array when filter matches no partners', async () => {
    // Insert test data
    await db.insert(partnersTable).values(testPartners).execute();

    const filters: GetPartnersFilters = { type: 'salon', is_active: true };
    const result = await getPartners(filters);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should filter by specific partner types correctly', async () => {
    // Insert test data
    await db.insert(partnersTable).values(testPartners).execute();

    // Test workshop filter
    const workshopResult = await getPartners({ type: 'workshop' });
    expect(workshopResult).toHaveLength(1);
    expect(workshopResult[0].name).toBe('Quick Workshop');

    // Test transport filter
    const transportResult = await getPartners({ type: 'transport' });
    expect(transportResult).toHaveLength(1);
    expect(transportResult[0].name).toBe('Fast Transport');

    // Test salon filter
    const salonResult = await getPartners({ type: 'salon' });
    expect(salonResult).toHaveLength(1);
    expect(salonResult[0].name).toBe('Luxury Salon');
  });

  it('should preserve all partner fields in results', async () => {
    // Insert test data with specific values
    const testPartner: CreatePartnerInput = {
      name: 'Test Partner',
      type: 'other',
      contact_info: 'test@example.com',
      is_active: true
    };

    await db.insert(partnersTable).values([testPartner]).execute();

    const result = await getPartners();
    
    expect(result).toHaveLength(1);
    const partner = result[0];
    
    expect(partner.id).toBeDefined();
    expect(typeof partner.id).toBe('number');
    expect(partner.name).toBe('Test Partner');
    expect(partner.type).toBe('other');
    expect(partner.contact_info).toBe('test@example.com');
    expect(partner.is_active).toBe(true);
    expect(partner.created_at).toBeInstanceOf(Date);
    expect(partner.updated_at).toBeInstanceOf(Date);
  });
});