import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { 
  Search, 
  Plus, 
  Eye, 
  Copy, 
  Archive,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import type { CarUnit, InventoryFilter, UnitStatus, Transmission, Partner } from '../../../server/src/schema';
import { AddCarForm } from '@/components/AddCarForm';

interface InventoryProps {
  onViewCar: (carId: number) => void;
}

const statusColors: Record<UnitStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  bought: 'bg-blue-100 text-blue-800',
  recond: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  listed: 'bg-purple-100 text-purple-800',
  sold: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-100 text-slate-800'
};

export function Inventory({ onViewCar }: InventoryProps) {
  const [cars, setCars] = useState<CarUnit[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20 });
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<InventoryFilter>({
    page: 1,
    limit: 20
  });

  const loadCars = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.getCarUnits.query(filters);
      setCars(result.units);
      setPagination({
        total: result.total,
        page: result.page,
        limit: result.limit
      });
    } catch (error) {
      console.error('Failed to load cars:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadPartners = useCallback(async () => {
    try {
      const result = await trpc.getPartners.query();
      setPartners(result);
    } catch (error) {
      console.error('Failed to load partners:', error);
    }
  }, []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const handleFilterChange = (key: keyof InventoryFilter, value: any) => {
    setFilters((prev: InventoryFilter) => ({
      ...prev,
      [key]: value === '' ? undefined : value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const handleDuplicateCar = async (carId: number) => {
    try {
      await trpc.duplicateCarUnit.mutate({ carId });
      loadCars(); // Refresh the list
    } catch (error) {
      console.error('Failed to duplicate car:', error);
    }
  };

  const handleArchiveCar = async (carId: number) => {
    try {
      await trpc.archiveCarUnit.mutate({ carId });
      loadCars(); // Refresh the list
    } catch (error) {
      console.error('Failed to archive car:', error);
    }
  };

  const handleExportToCsv = async () => {
    try {
      const csvData = await trpc.exportInventoryToCsv.query(filters);
      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export inventory:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 20
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Manage your car units throughout their lifecycle</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={loadCars}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add New Car
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Car Unit</DialogTitle>
              </DialogHeader>
              <AddCarForm 
                partners={partners}
                onSuccess={() => {
                  setShowAddForm(false);
                  loadCars();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Search & Filter</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by brand, model, stock code, VIN..."
              value={filters.search || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                handleFilterChange('search', e.target.value)
              }
              className="pl-10"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value: string) => handleFilterChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="bought">Bought</SelectItem>
                    <SelectItem value="recond">Reconditioning</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="listed">Listed</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Transmission</label>
                <Select
                  value={filters.transmission || ''}
                  onValueChange={(value: string) => handleFilterChange('transmission', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="automatic">Automatic</SelectItem>
                    <SelectItem value="cvt">CVT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Year Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.year_min || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      handleFilterChange('year_min', parseInt(e.target.value) || undefined)
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.year_max || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      handleFilterChange('year_max', parseInt(e.target.value) || undefined)
                    }
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Inventory ({cars.length} of {pagination.total} units)
            </CardTitle>
            {pagination.total > pagination.limit && (
              <div className="text-sm text-gray-500">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading inventory...</p>
            </div>
          ) : cars.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No cars found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Car Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Transmission</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Sold Price</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cars.map((car: CarUnit) => (
                    <TableRow key={car.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {car.brand} {car.model}
                          </div>
                          <div className="text-sm text-gray-500">
                            Stock: {car.stock_code}
                          </div>
                          {car.vin && (
                            <div className="text-xs text-gray-400">
                              VIN: {car.vin}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[car.status]} capitalize`}>
                          {car.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{car.year}</TableCell>
                      <TableCell className="capitalize">{car.transmission}</TableCell>
                      <TableCell>{car.odometer.toLocaleString()} km</TableCell>
                      <TableCell>{formatCurrency(car.sold_price)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewCar(car.id)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicateCar(car.id)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {car.status !== 'archived' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArchiveCar(car.id)}
                            >
                              <Archive className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} units
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('page', pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('page', pagination.page + 1)}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}