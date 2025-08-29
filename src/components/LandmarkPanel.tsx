import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  Navigation,
  Save,
  X 
} from 'lucide-react';

interface Landmark {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  category: 'fuel' | 'parking' | 'service' | 'restaurant' | 'office' | 'other';
  description?: string;
}

interface LandmarkPanelProps {
  landmarks: Landmark[];
  onAddLandmark: (landmark: Omit<Landmark, 'id'>) => void;
  onEditLandmark: (id: number, landmark: Partial<Landmark>) => void;
  onDeleteLandmark: (id: number) => void;
  onNavigateToLandmark: (landmark: Landmark) => void;
}

const LandmarkPanel: React.FC<LandmarkPanelProps> = ({
  landmarks,
  onAddLandmark,
  onEditLandmark,
  onDeleteLandmark,
  onNavigateToLandmark,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newLandmark, setNewLandmark] = useState({
    name: '',
    latitude: 27.7172,
    longitude: 85.3240,
    category: 'other' as const,
    description: '',
  });

  const getCategoryIcon = (category: string) => {
    const icons = {
      fuel: '⛽',
      parking: '🅿️',
      service: '🔧',
      restaurant: '🍽️',
      office: '🏢',
      other: '📍',
    };
    return icons[category as keyof typeof icons] || '📍';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      fuel: 'bg-red-100 text-red-700 border-red-200',
      parking: 'bg-blue-100 text-blue-700 border-blue-200',
      service: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      restaurant: 'bg-green-100 text-green-700 border-green-200',
      office: 'bg-purple-100 text-purple-700 border-purple-200',
      other: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const handleSave = () => {
    if (newLandmark.name.trim()) {
      onAddLandmark(newLandmark);
      setNewLandmark({
        name: '',
        latitude: 27.7172,
        longitude: 85.3240,
        category: 'other',
        description: '',
      });
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Landmarks</h3>
        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          variant={isAdding ? 'outline' : 'default'}
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isAdding ? 'Cancel' : 'Add'}
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add New Landmark</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Name</label>
                  <Input
                    value={newLandmark.name}
                    onChange={(e) => setNewLandmark(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Landmark name"
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Latitude</label>
                    <Input
                      type="number"
                      step="any"
                      value={newLandmark.latitude}
                      onChange={(e) => setNewLandmark(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Longitude</label>
                    <Input
                      type="number"
                      step="any"
                      value={newLandmark.longitude}
                      onChange={(e) => setNewLandmark(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium">Category</label>
                  <select
                    value={newLandmark.category}
                    onChange={(e) => setNewLandmark(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full mt-1 p-2 border rounded-md bg-background"
                  >
                    <option value="fuel">Fuel Station</option>
                    <option value="parking">Parking</option>
                    <option value="service">Service Center</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="office">Office</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium">Description (Optional)</label>
                  <Input
                    value={newLandmark.description}
                    onChange={(e) => setNewLandmark(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Additional notes"
                    className="mt-1"
                  />
                </div>

                <Button onClick={handleSave} className="w-full" size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save Landmark
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {landmarks.map((landmark) => (
          <motion.div
            key={landmark.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-card border rounded-lg space-y-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCategoryIcon(landmark.category)}</span>
                  <h4 className="font-medium">{landmark.name}</h4>
                  <Badge className={`text-xs ${getCategoryColor(landmark.category)}`}>
                    {landmark.category}
                  </Badge>
                </div>
                
                <p className="text-xs text-muted-foreground mt-1">
                  {landmark.latitude.toFixed(6)}, {landmark.longitude.toFixed(6)}
                </p>
                
                {landmark.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {landmark.description}
                  </p>
                )}
              </div>
              
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigateToLandmark(landmark)}
                  className="h-6 w-6 p-0"
                  title="Navigate to landmark"
                >
                  <Navigation className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(landmark.id)}
                  className="h-6 w-6 p-0"
                  title="Edit landmark"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteLandmark(landmark.id)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  title="Delete landmark"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
        
        {landmarks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No landmarks added yet</p>
            <p className="text-xs">Click "Add" to create your first landmark</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandmarkPanel;