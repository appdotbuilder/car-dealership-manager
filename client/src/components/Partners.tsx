import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { 
  Plus, 
  Edit, 
  Trash2,
  RefreshCw,
  Search,
  Users
} from 'lucide-react';
import type { Partner, PartnerType } from '../../../server/src/schema';
import { AddPartnerForm } from '@/components/AddPartnerForm';

const partnerTypeColors: Record<PartnerType, string> = {
  broker: 'bg-blue-100 text-blue-800',
  workshop: 'bg-yellow-100 text-yellow-800',
  salon: 'bg-green-100 text-green-800',
  transport: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800'
};

export function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadPartners = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.getPartners.query();
      setPartners(result);
      setFilteredPartners(result);
    } catch (error) {
      console.error('Failed to load partners:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    const filtered = partners.filter((partner: Partner) => 
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (partner.contact_info && partner.contact_info.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredPartners(filtered);
  }, [partners, searchTerm]);

  const handleDeletePartner = async (partnerId: number) => {
    if (!confirm('Are you sure you want to delete this partner?')) return;
    
    try {
      await trpc.deletePartner.mutate({ partnerId });
      loadPartners(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete partner:', error);
    }
  };

  const handleToggleActive = async (partner: Partner) => {
    try {
      await trpc.updatePartner.mutate({
        id: partner.id,
        is_active: !partner.is_active
      });
      loadPartners(); // Refresh the list
    } catch (error) {
      console.error('Failed to update partner:', error);
    }
  };

  const getPartnerTypeLabel = (type: PartnerType): string => {
    switch (type) {
      case 'broker': return 'Broker';
      case 'workshop': return 'Workshop';
      case 'salon': return 'Salon';
      case 'transport': return 'Transport';
      case 'other': return 'Other';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-8 w-8" />
            Partners Management
          </h1>
          <p className="text-gray-600 mt-1">Manage your business partners and service providers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadPartners}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Partner</DialogTitle>
              </DialogHeader>
              <AddPartnerForm 
                onSuccess={() => {
                  setShowAddForm(false);
                  loadPartners();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search partners by name, type, or contact info..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Partners ({filteredPartners.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading partners...</p>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No partners found matching your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPartners.map((partner: Partner) => (
                    <TableRow key={partner.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {partner.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${partnerTypeColors[partner.type]} capitalize`}>
                          {getPartnerTypeLabel(partner.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {partner.contact_info || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(partner)}
                          className={partner.is_active ? 
                            'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 
                            'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          }
                        >
                          {partner.is_active ? 'Active' : 'Inactive'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {new Date(partner.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePartner(partner.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {partners.filter((p: Partner) => p.type === 'broker').length}
            </div>
            <p className="text-sm text-gray-600">Brokers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {partners.filter((p: Partner) => p.type === 'workshop').length}
            </div>
            <p className="text-sm text-gray-600">Workshops</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {partners.filter((p: Partner) => p.type === 'salon').length}
            </div>
            <p className="text-sm text-gray-600">Salons</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {partners.filter((p: Partner) => p.is_active).length}
            </div>
            <p className="text-sm text-gray-600">Active Partners</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}