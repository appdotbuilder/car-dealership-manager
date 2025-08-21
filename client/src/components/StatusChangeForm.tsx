import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { UnitStatus, ChangeStatusInput } from '../../../server/src/schema';

interface StatusChangeFormProps {
  carId: number;
  currentStatus: UnitStatus;
  onSuccess: () => void;
}

// Define allowed status transitions
const statusTransitions: Record<UnitStatus, UnitStatus[]> = {
  draft: ['bought'],
  bought: ['recond', 'ready'],
  recond: ['ready', 'bought'], // Can go back to bought
  ready: ['listed', 'recond'], // Can go back to recond
  listed: ['sold', 'recond'], // Can go back to recond
  sold: ['archived'],
  archived: [] // Cannot change from archived
};

export function StatusChangeForm({ carId, currentStatus, onSuccess }: StatusChangeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ChangeStatusInput>({
    car_id: carId,
    new_status: currentStatus,
    notes: ''
  });

  const allowedStatuses = statusTransitions[currentStatus] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await trpc.changeCarStatus.mutate(formData);
      onSuccess();
    } catch (error) {
      console.error('Failed to change status:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusLabel = (status: UnitStatus): string => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'bought': return 'Bought';
      case 'recond': return 'Reconditioning';
      case 'ready': return 'Ready';
      case 'listed': return 'Listed';
      case 'sold': return 'Sold';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  const getStatusDescription = (status: UnitStatus): string => {
    switch (status) {
      case 'draft': return 'Initial planning stage';
      case 'bought': return 'Unit purchased, ready for processing';
      case 'recond': return 'Under reconditioning/repair';
      case 'ready': return 'Ready for sale';
      case 'listed': return 'Listed for sale';
      case 'sold': return 'Sold to customer';
      case 'archived': return 'Archived/Completed';
      default: return '';
    }
  };

  if (allowedStatuses.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-600 mb-4">
          No status changes available from "{getStatusLabel(currentStatus)}"
        </p>
        <Button variant="outline" onClick={onSuccess}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-1">Current Status</p>
        <p className="font-medium text-gray-900">{getStatusLabel(currentStatus)}</p>
        <p className="text-xs text-gray-500">{getStatusDescription(currentStatus)}</p>
      </div>

      <div>
        <Label htmlFor="new_status">New Status *</Label>
        <Select
          value={formData.new_status}
          onValueChange={(value: UnitStatus) => 
            setFormData((prev: ChangeStatusInput) => ({ ...prev, new_status: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedStatuses.map((status: UnitStatus) => (
              <SelectItem key={status} value={status}>
                <div>
                  <div className="font-medium">{getStatusLabel(status)}</div>
                  <div className="text-xs text-gray-500">{getStatusDescription(status)}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
            setFormData((prev: ChangeStatusInput) => ({ ...prev, notes: e.target.value }))
          }
          placeholder="Reason for status change or additional notes..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || formData.new_status === currentStatus}
        >
          {isSubmitting ? 'Changing...' : 'Change Status'}
        </Button>
      </div>
    </form>
  );
}