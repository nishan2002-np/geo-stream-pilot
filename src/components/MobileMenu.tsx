import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Menu, Search, Bell, MapPin, Settings, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MobileMenuProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  alerts?: any[];
  currentPage?: string;
}

const MobileMenu = ({ searchQuery, onSearchChange, alerts = [], currentPage }: MobileMenuProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle className="text-left">GPS Tracker Pro</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col gap-4 mt-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2">
            <Link to="/" onClick={() => setOpen(false)}>
              <Button variant={currentPage === 'dashboard' ? 'default' : 'ghost'} className="w-full justify-start">
                <MapPin className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            
            <Link to="/vehicle/1" onClick={() => setOpen(false)}>
              <Button variant={currentPage === 'vehicle' ? 'default' : 'ghost'} className="w-full justify-start">
                <MapPin className="h-4 w-4 mr-2" />
                Vehicle Details
              </Button>
            </Link>

            <Button variant="ghost" className="w-full justify-start">
              <Bell className="h-4 w-4 mr-2" />
              Alerts
              {alerts.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {alerts.length}
                </Badge>
              )}
            </Button>

            <Button variant="ghost" className="w-full justify-start">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>

            <Button variant="ghost" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>

          {/* Recent Alerts */}
          {alerts.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Recent Alerts</h3>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert, index) => (
                  <div key={index} className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-xs font-medium">{alert.title || 'Alert'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {alert.message || 'No details available'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;