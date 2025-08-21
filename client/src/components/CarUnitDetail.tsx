import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import { 
  ArrowLeft, 
  Edit, 
  Plus, 
  Trash2,
  RefreshCw,
  Calendar,
  MapPin,
  Gauge,
  Palette,
  Settings
} from 'lucide-react';
import type { CarUnit, Transaction, FinancialSummary, Partner } from '../../../server/src/schema';
import { AddTransactionForm } from '@/components/AddTransactionForm';
import { StatusChangeForm } from '@/components/StatusChangeForm';

interface CarUnitDetailProps {
  carId: number;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  bought: 'bg-blue-100 text-blue-800',
  recond: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  listed: 'bg-purple-100 text-purple-800',
  sold: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-100 text-slate-800'
};

const transactionTypeColors: Record<string, string> = {
  acquisition: 'bg-blue-100 text-blue-800',
  broker_fee: 'bg-orange-100 text-orange-800',
  workshop: 'bg-yellow-100 text-yellow-800',
  detailing: 'bg-green-100 text-green-800',
  transport: 'bg-purple-100 text-purple-800',
  admin: 'bg-gray-100 text-gray-800',
  tax: 'bg-red-100 text-red-800',
  other_expense: 'bg-slate-100 text-slate-800',
  sale_income: 'bg-emerald-100 text-emerald-800',
  other_income: 'bg-teal-100 text-teal-800'
};

export function CarUnitDetail({ carId, onBack }: CarUnitDetailProps) {
  const [car, setCar] = useState<CarUnit | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const loadCarDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const [carData, transactionData, financialData, partnersData] = await Promise.all([
        trpc.getCarUnitById.query({ carId }),
        trpc.getTransactionsByCarId.query({ carId }),
        trpc.getFinancialSummaryByCarId.query({ carId }),
        trpc.getPartners.query()
      ]);

      setCar(carData);
      setTransactions(transactionData);
      setFinancialSummary(financialData);
      setPartners(partnersData);
    } catch (error) {
      console.error('Failed to load car details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [carId]);

  useEffect(() => {
    loadCarDetails();
  }, [loadCarDetails]);

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      await trpc.deleteTransaction.mutate({ transactionId });
      loadCarDetails(); // Refresh all data
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>Loading car details...</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="text-center py-12">
        <p>Car not found</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {car.brand} {car.model}
            </h1>
            <p className="text-gray-600">Stock Code: {car.stock_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={showStatusChange} onOpenChange={setShowStatusChange}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Change Status
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Car Status</DialogTitle>
              </DialogHeader>
              <StatusChangeForm
                carId={carId}
                currentStatus={car.status}
                onSuccess={() => {
                  setShowStatusChange(false);
                  loadCarDetails();
                }}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={loadCarDetails}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Car Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Car Information</CardTitle>
                <Badge className={`${statusColors[car.status]} capitalize text-sm`}>
                  {car.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Year</p>
                      <p className="font-medium">{car.year}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Transmission</p>
                      <p className="font-medium capitalize">{car.transmission}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Gauge className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Odometer</p>
                      <p className="font-medium">{car.odometer.toLocaleString()} km</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Color</p>
                      <p className="font-medium">{car.color}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {car.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Location</p>
                        <p className="font-medium">{car.location}</p>
                      </div>
                    </div>
                  )}
                  
                  {car.vin && (
                    <div>
                      <p className="text-sm text-gray-600">VIN</p>
                      <p className="font-medium text-xs">{car.vin}</p>
                    </div>
                  )}
                </div>
              </div>

              {car.notes && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-gray-600 mb-2">Notes</p>
                  <p className="text-gray-900">{car.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Primary Photo */}
          {car.primary_photo_url && (
            <Card>
              <CardHeader>
                <CardTitle>Primary Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <img 
                  src={car.primary_photo_url} 
                  alt={`${car.brand} ${car.model}`}
                  className="w-full max-w-md mx-auto rounded-lg shadow-sm"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {financialSummary ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Acquisition</p>
                    <p className="text-xl font-bold text-blue-800">
                      {formatCurrency(financialSummary.total_acquisition)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                    <p className="text-xl font-bold text-red-800">
                      {formatCurrency(financialSummary.total_expenses)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Total Incomes</p>
                    <p className="text-xl font-bold text-green-800">
                      {formatCurrency(financialSummary.total_incomes)}
                    </p>
                  </div>
                  
                  <div className={`text-center p-4 rounded-lg ${
                    financialSummary.profit >= 0 ? 'bg-emerald-50' : 'bg-orange-50'
                  }`}>
                    <p className={`text-sm font-medium ${
                      financialSummary.profit >= 0 ? 'text-emerald-600' : 'text-orange-600'
                    }`}>
                      Net Profit
                    </p>
                    <p className={`text-xl font-bold ${
                      financialSummary.profit >= 0 ? 'text-emerald-800' : 'text-orange-800'
                    }`}>
                      {formatCurrency(financialSummary.profit)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No financial data available</p>
              )}
            </CardContent>
          </Card>

          {car.sold_price && (
            <Card>
              <CardHeader>
                <CardTitle>Sale Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6 bg-emerald-50 rounded-lg">
                  <p className="text-sm text-emerald-600 font-medium">Sold Price</p>
                  <p className="text-3xl font-bold text-emerald-800">
                    {formatCurrency(car.sold_price)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Sold on {formatDate(car.updated_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {/* Add Transaction Button */}
          <div className="flex justify-end">
            <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Transaction</DialogTitle>
                </DialogHeader>
                <AddTransactionForm
                  carId={carId}
                  partners={partners}
                  onSuccess={() => {
                    setShowAddTransaction(false);
                    loadCarDetails();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History ({transactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No transactions recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction: Transaction) => {
                        const partner = partners.find((p: Partner) => p.id === transaction.partner_id);
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>{formatDate(transaction.date)}</TableCell>
                            <TableCell>
                              <Badge 
                                className={`${transactionTypeColors[transaction.type]} capitalize text-xs`}
                              >
                                {transaction.type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {partner ? partner.name : 'N/A'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(transaction.amount)}
                              {transaction.percentage && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({transaction.percentage}%)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {transaction.description || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTransaction(transaction.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}