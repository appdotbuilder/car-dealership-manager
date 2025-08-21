import { useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Inventory } from '@/components/Inventory';
import { Partners } from '@/components/Partners';
import { Reports } from '@/components/Reports';
import { CarUnitDetail } from '@/components/CarUnitDetail';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Car, 
  Users, 
  BarChart3, 
  LayoutDashboard,
  Settings
} from 'lucide-react';

type View = 'dashboard' | 'inventory' | 'partners' | 'reports' | 'car-detail';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);

  const handleViewCar = (carId: number) => {
    setSelectedCarId(carId);
    setCurrentView('car-detail');
  };

  const handleBackToInventory = () => {
    setSelectedCarId(null);
    setCurrentView('inventory');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewInventory={() => setCurrentView('inventory')} />;
      case 'inventory':
        return <Inventory onViewCar={handleViewCar} />;
      case 'partners':
        return <Partners />;
      case 'reports':
        return <Reports />;
      case 'car-detail':
        return selectedCarId ? (
          <CarUnitDetail carId={selectedCarId} onBack={handleBackToInventory} />
        ) : null;
      default:
        return <Dashboard onViewInventory={() => setCurrentView('inventory')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <Card className="rounded-none border-b shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              🚗 Car Dealership Manager
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant={currentView === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-2"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Button>
              <Button
                variant={currentView === 'inventory' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('inventory')}
                className="flex items-center gap-2"
              >
                <Car size={16} />
                Inventory
              </Button>
              <Button
                variant={currentView === 'partners' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('partners')}
                className="flex items-center gap-2"
              >
                <Users size={16} />
                Partners
              </Button>
              <Button
                variant={currentView === 'reports' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('reports')}
                className="flex items-center gap-2"
              >
                <BarChart3 size={16} />
                Reports
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <main className="container mx-auto p-6 max-w-7xl">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;