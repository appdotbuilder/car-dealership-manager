import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/utils/trpc';
import type { CreatePartnerInput, PartnerType } from '../../../server/src/schema';

interface AddPartnerFormProps {
  onSuccess: () => void;
}

export function AddPartnerForm({ onSuccess }: AddPartnerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreatePartnerInput>({
    name: '',
    type: 'broker',
    contact_info: null,
    is_active: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await trpc.createPartner.mutate(formData);
      onSuccess();
      // Reset form
      setFormData({
        name: '',
        type: 'broker',
        contact_info: null,
        is_active: true
      });
    } catch (error) {
      console.error('Failed to create partner:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (key: keyof CreatePartnerInput, value: any) => {
    setFormData((prev: CreatePartnerInput) => ({
      ...prev,
      [key]: value === '' ? null : value
    }));
  };

  const getPartnerTypeDescription = (type: PartnerType): string => {
    switch (type) {
      case 'broker': return 'Car dealers and brokers';
      case 'workshop': return 'Repair and maintenance services';
      case 'salon': return 'Detailing and cosmetic services';
      case 'transport': return 'Car transport and delivery';
      case 'other': return 'Other service providers';
      default: return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <Label htmlFor="name">Partner Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            handleInputChange('name', e.target.value)
          }
          placeholder="e.g., Jakarta Auto Workshop"
          required
        />
      </div>

      {/* Type */}
      <div>
        <Label htmlFor="type">Partner Type *</Label>
        <Select
          value={formData.type}
          onValueChange={(value: PartnerType) => handleInputChange('type', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="broker">
              <div>
                <div className="font-medium">Broker</div>
                <div className="text-xs text-gray-500">{getPartnerTypeDescription('broker')}</div>
              </div>
            </SelectItem>
            <SelectItem value="workshop">
              <div>
                <div className="font-medium">Workshop</div>
                <div className="text-xs text-gray-500">{getPartnerTypeDescription('workshop')}</div>
              </div>
            </SelectItem>
            <SelectItem value="salon">
              <div>
                <div className="font-medium">Salon</div>
                <div className="text-xs text-gray-500">{getPartnerTypeDescription('salon')}</div>
              </div>
            </SelectItem>
            <SelectItem value="transport">
              <div>
                <div className="font-medium">Transport</div>
                <div className="text-xs text-gray-500">{getPartnerTypeDescription('transport')}</div>
              </div>
            </SelectItem>
            <SelectItem value="other">
              <div>
                <div className="font-medium">Other</div>
                <div className="text-xs text-gray-500">{getPartnerTypeDescription('other')}</div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contact Info */}
      <div>
        <Label htmlFor="contact_info">Contact Information (Optional)</Label>
        <Textarea
          id="contact_info"
          value={formData.contact_info || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
            handleInputChange('contact_info', e.target.value)
          }
          placeholder="Phone, email, address, or other contact details..."
          rows={3}
        />
      </div>

      {/* Active Status */}
      <div className="flex items-center justify-between py-2">
        <div>
          <Label htmlFor="is_active">Active Status</Label>
          <p className="text-sm text-gray-500">
            Inactive partners won't appear in transaction forms
          </p>
        </div>
        <Switch
          id="is_active"
          checked={formData.is_active || false}
          onCheckedChange={(checked: boolean) => handleInputChange('is_active', checked)}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Partner'}
        </Button>
      </div>
    </form>
  );
}