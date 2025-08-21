import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { 
  BarChart3, 
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign
} from 'lucide-react';
import type { ProfitReport, ExpenseReportItem, ReportFilter, UnitStatus } from '../../../server/src/schema';

export function Reports() {
  const [profitReport, setProfitReport] = useState<ProfitReport | null>(null);
  const [expenseReport, setExpenseReport] = useState<ExpenseReportItem[]>([]);
  const [stockAging, setStockAging] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [filters, setFilters] = useState<ReportFilter>({
    start_date: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end_date: new Date()
  });

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profit, expense, aging] = await Promise.all([
        trpc.getProfitReport.query(filters),
        trpc.getExpenseReport.query(filters),
        trpc.getStockAgingReport.query()
      ]);
      
      setProfitReport(profit);
      setExpenseReport(expense);
      setStockAging(aging);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleFilterChange = (key: keyof ReportFilter, value: any) => {
    setFilters((prev: ReportFilter) => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }));
  };

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleExportProfit = async () => {
    try {
      const csvData = await trpc.exportProfitReportToCsv.query(filters);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profit-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export profit report:', error);
    }
  };

  const handleExportTransactions = async () => {
    try {
      const csvData = await trpc.exportTransactionsToCsv.query(filters);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export transactions report:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Reports & Analytics
          </h1>
          <p className="text-gray-600 mt-1">Generate and analyze business performance reports</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadReports}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formatDateForInput(filters.start_date)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  handleFilterChange('start_date', new Date(e.target.value))
                }
              />
            </div>

            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formatDateForInput(filters.end_date)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  handleFilterChange('end_date', new Date(e.target.value))
                }
              />
            </div>

            <div>
              <Label htmlFor="status">Status Filter</Label>
              <Select
                value={filters.status || ''}
                onValueChange={(value: string) => handleFilterChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="sold">Sold Only</SelectItem>
                  <SelectItem value="listed">Listed Only</SelectItem>
                  <SelectItem value="ready">Ready Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Generating reports...</p>
        </div>
      ) : (
        <>
          {/* Profit Report */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Profit Analysis
                </CardTitle>
                <Button variant="outline" onClick={handleExportProfit}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {profitReport ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className={`text-center p-6 rounded-lg ${
                    profitReport.total_profit >= 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className={`flex items-center justify-center mb-2 ${
                      profitReport.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {profitReport.total_profit >= 0 ? 
                        <TrendingUp className="h-6 w-6" /> : 
                        <TrendingDown className="h-6 w-6" />
                      }
                    </div>
                    <p className={`text-2xl font-bold ${
                      profitReport.total_profit >= 0 ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {formatCurrency(profitReport.total_profit)}
                    </p>
                    <p className="text-sm text-gray-600">Total Profit</p>
                  </div>

                  <div className="text-center p-6 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-800">
                      {formatCurrency(profitReport.average_profit_per_unit)}
                    </p>
                    <p className="text-sm text-gray-600">Avg. Profit per Unit</p>
                  </div>

                  <div className="text-center p-6 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-800">
                      {profitReport.units_sold}
                    </p>
                    <p className="text-sm text-gray-600">Units Sold</p>
                  </div>

                  <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Report Period</p>
                    <p className="text-sm font-medium">
                      {new Date(profitReport.period_start).toLocaleDateString()} - {' '}
                      {new Date(profitReport.period_end).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No profit data available for the selected period</p>
              )}
            </CardContent>
          </Card>

          {/* Expense Report */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Expense Breakdown</CardTitle>
                <Button variant="outline" onClick={handleExportTransactions}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Transactions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {expenseReport.length > 0 ? (
                <div className="space-y-4">
                  {expenseReport.map((expense: ExpenseReportItem, index: number) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="capitalize">
                            {expense.category.replace('_', ' ')}
                          </Badge>
                          {expense.partner_name && (
                            <span className="text-sm text-gray-600">
                              Partner: {expense.partner_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {expense.transaction_count} transaction{expense.transaction_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{formatCurrency(expense.total_amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No expense data available for the selected period</p>
              )}
            </CardContent>
          </Card>

          {/* Stock Aging Report */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Aging Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {stockAging.length > 0 ? (
                <div className="space-y-4">
                  {stockAging.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{item.brand} {item.model}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">{item.status}</Badge>
                          <span className="text-sm text-gray-600">
                            {item.days_in_inventory} days in inventory
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Stock Code</p>
                        <p className="font-medium">{item.stock_code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No stock aging data available</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}