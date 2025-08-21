import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { CreateCarUnitInput, Partner, UnitStatus, Transmission } from '../../../server/src/schema';

interface AddCarFormProps {
  partners: Partner[];
  onSuccess: () => void;
}

export function AddCarForm({ partners, onSuccess }: AddCarFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateCarUnitInput>({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    transmission: 'manual',
    odometer: 0,
    color: '',
    stock_code: '',
    vin: null,
    location: null,
    notes: null,
    primary_photo_url: null,
    gallery_urls: null,
    documents: null,
    status: 'draft',
    sold_price: null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await trpc.createCarUnit.mutate(formData);
      onSuccess();
      // Reset form
      setFormData({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        transmission: 'manual',
        odometer: 0,
        color: '',
        stock_code: '',
        vin: null,
        location: null,
        notes: null,
        primary_photo_url: null,
        gallery_urls: null,
        documents: null,
        status: 'draft',
        sold_price: null
      });
    } catch (error) {
      console.error('Failed to create car:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (key: keyof CreateCarUnitInput, value: any) => {
    setFormData((prev: CreateCarUnitInput) => ({
      ...prev,
      [key]: value === '' ? null : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[600px] overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand */}
        <div>
          <Label htmlFor="brand">Brand *</Label>
          <Input
            id="brand"
            value={formData.brand}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('brand', e.target.value)
            }
            placeholder="e.g., Toyota, Honda"
            required
          />
        </div>

        {/* Model */}
        <div>
          <Label htmlFor="model">Model *</Label>
          <Input
            id="model"
            value={formData.model}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('model', e.target.value)
            }
            placeholder="e.g., Avanza, Civic"
            required
          />
        </div>

        {/* Year */}
        <div>
          <Label htmlFor="year">Year *</Label>
          <Input
            id="year"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            value={formData.year}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('year', parseInt(e.target.value))
            }
            required
          />
        </div>

        {/* Transmission */}
        <div>
          <Label htmlFor="transmission">Transmission *</Label>
          <Select
            value={formData.transmission}
            onValueChange={(value: Transmission) => handleInputChange('transmission', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="automatic">Automatic</SelectItem>
              <SelectItem value="cvt">CVT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Odometer */}
        <div>
          <Label htmlFor="odometer">Odometer (km) *</Label>
          <Input
            id="odometer"
            type="number"
            min="0"
            value={formData.odometer}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('odometer', parseInt(e.target.value) || 0)
            }
            required
          />
        </div>

        {/* Color */}
        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={formData.color}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('color', e.target.value)
            }
            placeholder="e.g., Silver, Black"
            required
          />
        </div>

        {/* Stock Code */}
        <div>
          <Label htmlFor="stock_code">Stock Code *</Label>
          <Input
            id="stock_code"
            value={formData.stock_code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('stock_code', e.target.value)
            }
            placeholder="e.g., AVZ001"
            required
          />
        </div>

        {/* VIN */}
        <div>
          <Label htmlFor="vin">VIN (Optional)</Label>
          <Input
            id="vin"
            value={formData.vin || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('vin', e.target.value)
            }
            placeholder="17-character VIN"
          />
        </div>

        {/* Location */}
        <div>
          <Label htmlFor="location">Location (Optional)</Label>
          <Input
            id="location"
            value={formData.location || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('location', e.target.value)
            }
            placeholder="e.g., Lot A, Workshop"
          />
        </div>

        {/* Status */}
        <div>
          <Label htmlFor="status">Initial Status</Label>
          <Select
            value={formData.status || 'draft'}
            onValueChange={(value: UnitStatus) => handleInputChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="bought">Bought</SelectItem>
              <SelectItem value="recond">Reconditioning</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="listed">Listed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Primary Photo URL */}
        <div className="md:col-span-2">
          <Label htmlFor="primary_photo_url">Primary Photo URL (Optional)</Label>
          <Input
            id="primary_photo_url"
            type="url"
            value={formData.primary_photo_url || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              handleInputChange('primary_photo_url', e.target.value)
            }
            placeholder="https://example.com/car-photo.jpg"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
            handleInputChange('notes', e.target.value)
          }
          placeholder="Additional notes about this car..."
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Car Unit'}
        </Button>
      </div>
    </form>
  );
}