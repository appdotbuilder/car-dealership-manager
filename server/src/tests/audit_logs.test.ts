import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { auditLogsTable } from '../db/schema';
import { type CreateAuditLogInput } from '../schema';
import { createAuditLog, getAuditLogs } from '../handlers/audit_logs';
import { eq } from 'drizzle-orm';

// Test input for creating audit logs
const testCreateInput: CreateAuditLogInput = {
  actor: 'test-user@example.com',
  entity_type: 'car_unit',
  entity_id: 123,
  action: 'create',
  before_data: null,
  after_data: { name: 'Test Car', brand: 'Toyota' }
};

const testUpdateInput: CreateAuditLogInput = {
  actor: 'admin@example.com',
  entity_type: 'partner',
  entity_id: 456,
  action: 'update',
  before_data: { name: 'Old Name', active: true },
  after_data: { name: 'New Name', active: false }
};

describe('createAuditLog', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an audit log entry', async () => {
    const result = await createAuditLog(testCreateInput);

    // Basic field validation
    expect(result.actor).toEqual('test-user@example.com');
    expect(result.entity_type).toEqual('car_unit');
    expect(result.entity_id).toEqual(123);
    expect(result.action).toEqual('create');
    expect(result.before_data).toBeNull();
    expect(result.after_data).toEqual({ name: 'Test Car', brand: 'Toyota' });
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save audit log to database', async () => {
    const result = await createAuditLog(testCreateInput);

    // Query database to verify record was saved
    const auditLogs = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.id, result.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actor).toEqual('test-user@example.com');
    expect(auditLogs[0].entity_type).toEqual('car_unit');
    expect(auditLogs[0].entity_id).toEqual(123);
    expect(auditLogs[0].action).toEqual('create');
    expect(auditLogs[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle audit log with update action and both before/after data', async () => {
    const result = await createAuditLog(testUpdateInput);

    expect(result.actor).toEqual('admin@example.com');
    expect(result.entity_type).toEqual('partner');
    expect(result.entity_id).toEqual(456);
    expect(result.action).toEqual('update');
    expect(result.before_data).toEqual({ name: 'Old Name', active: true });
    expect(result.after_data).toEqual({ name: 'New Name', active: false });
  });

  it('should handle audit log with delete action', async () => {
    const deleteInput: CreateAuditLogInput = {
      actor: 'admin@example.com',
      entity_type: 'transaction',
      entity_id: 789,
      action: 'delete',
      before_data: { amount: 1000, type: 'expense' },
      after_data: null
    };

    const result = await createAuditLog(deleteInput);

    expect(result.action).toEqual('delete');
    expect(result.before_data).toEqual({ amount: 1000, type: 'expense' });
    expect(result.after_data).toBeNull();
  });

  it('should handle audit log with status_change action', async () => {
    const statusChangeInput: CreateAuditLogInput = {
      actor: 'manager@example.com',
      entity_type: 'car_unit',
      entity_id: 100,
      action: 'status_change',
      before_data: { status: 'draft' },
      after_data: { status: 'bought' }
    };

    const result = await createAuditLog(statusChangeInput);

    expect(result.action).toEqual('status_change');
    expect(result.entity_type).toEqual('car_unit');
    expect(result.before_data).toEqual({ status: 'draft' });
    expect(result.after_data).toEqual({ status: 'bought' });
  });
});

describe('getAuditLogs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all audit logs when no filters provided', async () => {
    // Create multiple audit logs
    await createAuditLog(testCreateInput);
    await createAuditLog(testUpdateInput);
    await createAuditLog({
      actor: 'user3@example.com',
      entity_type: 'transaction',
      entity_id: 789,
      action: 'delete'
    });

    const results = await getAuditLogs();

    expect(results).toHaveLength(3);
    // Should be ordered by created_at descending (newest first)
    expect(results[0].entity_type).toEqual('transaction');
    expect(results[1].entity_type).toEqual('partner');
    expect(results[2].entity_type).toEqual('car_unit');
  });

  it('should filter by entity type', async () => {
    // Create audit logs for different entity types
    await createAuditLog(testCreateInput); // car_unit
    await createAuditLog(testUpdateInput); // partner
    await createAuditLog({
      actor: 'user3@example.com',
      entity_type: 'car_unit',
      entity_id: 999,
      action: 'update'
    });

    const results = await getAuditLogs('car_unit');

    expect(results).toHaveLength(2);
    results.forEach(log => {
      expect(log.entity_type).toEqual('car_unit');
    });
    // Should be ordered by created_at descending
    expect(results[0].entity_id).toEqual(999);
    expect(results[1].entity_id).toEqual(123);
  });

  it('should filter by entity ID', async () => {
    // Create audit logs for different entity IDs
    await createAuditLog(testCreateInput); // entity_id: 123
    await createAuditLog(testUpdateInput); // entity_id: 456
    await createAuditLog({
      actor: 'user3@example.com',
      entity_type: 'car_unit',
      entity_id: 123,
      action: 'update'
    });

    const results = await getAuditLogs(undefined, 123);

    expect(results).toHaveLength(2);
    results.forEach(log => {
      expect(log.entity_id).toEqual(123);
    });
    // Should be ordered by created_at descending
    expect(results[0].action).toEqual('update');
    expect(results[1].action).toEqual('create');
  });

  it('should filter by both entity type and ID', async () => {
    // Create audit logs with various combinations
    await createAuditLog(testCreateInput); // car_unit, 123
    await createAuditLog(testUpdateInput); // partner, 456
    await createAuditLog({
      actor: 'user3@example.com',
      entity_type: 'car_unit',
      entity_id: 123,
      action: 'update'
    }); // car_unit, 123
    await createAuditLog({
      actor: 'user4@example.com',
      entity_type: 'car_unit',
      entity_id: 789,
      action: 'delete'
    }); // car_unit, 789

    const results = await getAuditLogs('car_unit', 123);

    expect(results).toHaveLength(2);
    results.forEach(log => {
      expect(log.entity_type).toEqual('car_unit');
      expect(log.entity_id).toEqual(123);
    });
    // Should be ordered by created_at descending
    expect(results[0].action).toEqual('update');
    expect(results[1].action).toEqual('create');
  });

  it('should return empty array when no matching logs found', async () => {
    await createAuditLog(testCreateInput);
    await createAuditLog(testUpdateInput);

    const results = await getAuditLogs('nonexistent_type');

    expect(results).toHaveLength(0);
  });

  it('should handle entity ID of 0', async () => {
    const zeroIdInput: CreateAuditLogInput = {
      actor: 'system@example.com',
      entity_type: 'system',
      entity_id: 0,
      action: 'create'
    };

    await createAuditLog(zeroIdInput);
    await createAuditLog(testCreateInput);

    const results = await getAuditLogs(undefined, 0);

    expect(results).toHaveLength(1);
    expect(results[0].entity_id).toEqual(0);
    expect(results[0].entity_type).toEqual('system');
  });

  it('should preserve chronological order across multiple queries', async () => {
    // Create logs with slight delays to ensure different timestamps
    const log1 = await createAuditLog({
      actor: 'user1@example.com',
      entity_type: 'car_unit',
      entity_id: 1,
      action: 'create'
    });
    
    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const log2 = await createAuditLog({
      actor: 'user2@example.com',
      entity_type: 'car_unit',
      entity_id: 1,
      action: 'update'
    });

    const results = await getAuditLogs('car_unit', 1);

    expect(results).toHaveLength(2);
    // Most recent should be first
    expect(results[0].id).toEqual(log2.id);
    expect(results[0].action).toEqual('update');
    expect(results[1].id).toEqual(log1.id);
    expect(results[1].action).toEqual('create');
  });
});