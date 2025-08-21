import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { 
  TrendingUp, 
  TrendingDown, 
  Car, 
  Clock, 
  DollarSign,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type { DashboardKpi, ExpenseReportItem } from '../../../server/src/schema';

interface DashboardProps {
  onViewInventory: () => void;
}

export function Dashboard({ onViewInventory }: DashboardProps) {
  const [kpis, setKpis] = useState<DashboardKpi | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [kpiData, expenseReport] = await Promise.all([
        trpc.getDashboardKpis.query(),
        trpc.getExpenseReport.query({})
      ]);
      
      setKpis(kpiData);
      setExpenseData(expenseReport);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg">
        <h1 className="text-3xl font-bold mb-2">Welcome to Your Dealership Dashboard</h1>
        <p className="text-blue-100">Track your inventory, monitor profits, and manage your car business efficiently.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {kpis?.active_stock_count ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Units in inventory</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Car className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Days to Sale</p>
                <p className="text-2xl font-bold text-gray-900">
                  {kpis?.average_days_to_sale ? Math.round(kpis.average_days_to_sale) : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Days on market</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Period Profit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(kpis?.total_period_profit ?? 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </div>
              <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                (kpis?.total_period_profit ?? 0) >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <DollarSign className={`h-6 w-6 ${
                  (kpis?.total_period_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onViewInventory}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Quick Action</p>
                <p className="text-lg font-semibold text-blue-600">View Inventory</p>
                <p className="text-xs text-gray-500 mt-1">Manage your stock</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <TrendingUp className="h-5 w-5" />
              Top Profit Unit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis?.top_profit_unit ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {kpis.top_profit_unit.brand} {kpis.top_profit_unit.model}
                  </span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    ID #{kpis.top_profit_unit.id}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(kpis.top_profit_unit.profit)}
                </div>
                <p className="text-sm text-gray-600">Best performing unit in your portfolio</p>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No sold units yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Performer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <TrendingDown className="h-5 w-5" />
              Lowest Profit Unit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis?.bottom_profit_unit ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {kpis.bottom_profit_unit.brand} {kpis.bottom_profit_unit.model}
                  </span>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    ID #{kpis.bottom_profit_unit.id}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(kpis.bottom_profit_unit.profit)}
                </div>
                <p className="text-sm text-gray-600">Needs attention for better profitability</p>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No sold units yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {expenseData.length > 0 ? (
            <div className="space-y-4">
              {expenseData.slice(0, 8).map((expense: ExpenseReportItem) => (
                <div key={expense.category} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">
                        {expense.category.replace('_', ' ')}
                      </Badge>
                      {expense.partner_name && (
                        <span className="text-sm text-gray-600">({expense.partner_name})</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {expense.transaction_count} transaction{expense.transaction_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(expense.total_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No expense data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onViewInventory} className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Manage Inventory
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Refresh Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}