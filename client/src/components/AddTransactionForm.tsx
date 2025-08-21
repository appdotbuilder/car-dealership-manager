import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { CreateTransactionInput, Partner, TransactionType } from '../../../server/src/schema';

interface AddTransactionFormProps {
  carId: number;
  partners: Partner[];
  onSuccess: () => void;
}

export function AddTransactionForm({ carId, partners, onSuccess }: AddTransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateTransactionInput>({
    car_id: carId,
    partner_id: null,
    type: 'acquisition',
    amount: 0,
    percentage: null,
    description: null,
    date: new Date()
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await trpc.createTransaction.mutate(formData);
      onSuccess();
      // Reset form
      setFormData({
        car_id: carId,
        partner_id: null,
        type: 'acquisition',
        amount: 0,
        percentage: null,
        description: null,
        date: new Date()
      });
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (key: keyof CreateTransactionInput, value: any) => {
    setFormData((prev: CreateTransactionInput) => ({
      ...prev,
      [key]: value === '' ? null : value
    }));
  };

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Transaction Type */}
      <div>
        <Label htmlFor="type">Transaction Type *</Label>
        <Select
          value={formData.type}
          onValueChange={(value: TransactionType) => handleInputChange('type', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="acquisition">Acquisition</SelectItem>
            <SelectItem value="broker_fee">Broker Fee</SelectItem>
            <SelectItem value="workshop">Workshop</SelectItem>
            <SelectItem value="detailing">Detailing</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="tax">Tax</SelectItem>
            <SelectItem value="other_expense">Other Expense</SelectItem>
            <SelectItem value="sale_income">Sale Income</SelectItem>
            <SelectItem value="other_income">Other Income</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Partner */}
      <div>
        <Label htmlFor="partner">Partner (Optional)</Label>
        <Select
          value={formData.partner_id?.toString() || ''}
          onValueChange={(value: string) => 
            handleInputChange('partner_id', value === '' ? null : parseInt(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a partner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No Partner</SelectItem>
            {partners.map((partner: Partner) => (
              <SelectItem key={partner.id} value={partner.id.toString()}>
                {partner.name} ({partner.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount */}
      <div>
        <Label htmlFor="amount">Amount (IDR) *</Label>
        <Input
          id="amount"
          type="number"
          step="1000"
          min="0"
          value={formData.amount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            handleInputChange('amount', parseFloat(e.target.value) || 0)
          }
          placeholder="e.g., 50000000"
          required
        />
      </div>

      {/* Percentage (for broker fees) */}
      {formData.type === 'broker_fee' && (
        <div>
          <Label htmlFor="percentage">Percentage (Optional)</Label>
          <Input
            id="percentage"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.percentage || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('percentage', parseFloat(e.target.value) || null)
            }
            placeholder="e.g., 2.5"
          />
        </div>
      )}

      {/* Date */}
      <div>
        <Label htmlFor="date">Date *</Label>
        <Input
          id="date"
          type="date"
          value={formatDateForInput(formData.date || new Date())}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            handleInputChange('date', new Date(e.target.value))
          }
          required
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
            handleInputChange('description', e.target.value)
          }
          placeholder="Additional details about this transaction..."
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Transaction'}
        </Button>
      </div>
    </form>
  );
}