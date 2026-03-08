import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Plus, Check, Pencil, Trash2, Loader2, Calendar as CalendarIcon, Car } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { Badge } from '../components/ui/badge';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICE_TYPES = [
  'Oil Change',
  'Tire Rotation',
  'Brake Service',
  'Air Filter',
  'Transmission Service',
  'Coolant Flush',
  'Battery Replacement',
  'Spark Plugs',
  'Wheel Alignment',
  'Inspection',
  'Other'
];

const RemindersPage = () => {
  const [reminders, setReminders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [date, setDate] = useState(new Date());
  const [formData, setFormData] = useState({
    vehicle_id: '',
    service_type: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    due_odometer: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    fetchData();
  }, [showCompleted]);

  const fetchData = async () => {
    try {
      const [remindersRes, vehiclesRes] = await Promise.all([
        axios.get(`${API_URL}/reminders?completed=${showCompleted}`, getAuthHeader()),
        axios.get(`${API_URL}/vehicles`, getAuthHeader())
      ]);
      setReminders(remindersRes.data);
      setVehicles(vehiclesRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedReminder(null);
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    setDate(futureDate);
    setFormData({
      vehicle_id: vehicles[0]?.id || '',
      service_type: '',
      due_date: format(futureDate, 'yyyy-MM-dd'),
      due_odometer: '',
      notes: ''
    });
    setDialogOpen(true);
  };

  const openEditDialog = (reminder) => {
    setSelectedReminder(reminder);
    setDate(new Date(reminder.due_date));
    setFormData({
      vehicle_id: reminder.vehicle_id,
      service_type: reminder.service_type,
      due_date: reminder.due_date,
      due_odometer: reminder.due_odometer?.toString() || '',
      notes: reminder.notes || ''
    });
    setDialogOpen(true);
  };

  const handleDateSelect = (selectedDate) => {
    if (selectedDate) {
      setDate(selectedDate);
      setFormData({...formData, due_date: format(selectedDate, 'yyyy-MM-dd')});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_id || !formData.service_type || !formData.due_date) {
      toast.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);
    const submitData = {
      ...formData,
      due_odometer: formData.due_odometer ? parseInt(formData.due_odometer) : null
    };

    try {
      if (selectedReminder) {
        await axios.put(`${API_URL}/reminders/${selectedReminder.id}`, submitData, getAuthHeader());
        toast.success('Reminder updated');
      } else {
        await axios.post(`${API_URL}/reminders`, submitData, getAuthHeader());
        toast.success('Reminder created');
      }
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (reminder) => {
    try {
      await axios.put(`${API_URL}/reminders/${reminder.id}`, { completed: true }, getAuthHeader());
      toast.success('Reminder marked as complete');
      fetchData();
    } catch (error) {
      toast.error('Failed to update reminder');
    }
  };

  const handleDelete = async () => {
    if (!selectedReminder) return;
    
    try {
      await axios.delete(`${API_URL}/reminders/${selectedReminder.id}`, getAuthHeader());
      toast.success('Reminder deleted');
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete reminder');
    }
  };

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown';
  };

  const getDueBadge = (dueDate) => {
    const date = new Date(dueDate);
    const days = differenceInDays(date, new Date());
    
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive" className="rounded-sm">Overdue</Badge>;
    }
    if (isToday(date)) {
      return <Badge className="bg-amber-500 text-white rounded-sm">Due Today</Badge>;
    }
    if (isTomorrow(date)) {
      return <Badge className="bg-amber-500/80 text-white rounded-sm">Tomorrow</Badge>;
    }
    if (days <= 7) {
      return <Badge variant="outline" className="rounded-sm text-amber-500 border-amber-500">This Week</Badge>;
    }
    if (days <= 30) {
      return <Badge variant="outline" className="rounded-sm">This Month</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div data-testid="reminders-page" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">Service Reminders</h1>
            <p className="text-muted-foreground mt-1">Never miss scheduled maintenance</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={showCompleted ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className="rounded-sm"
              data-testid="toggle-completed-btn"
            >
              {showCompleted ? 'Show Active' : 'Show Completed'}
            </Button>
            <Button
              data-testid="add-reminder-btn"
              onClick={openAddDialog}
              className="rounded-sm font-heading font-bold uppercase tracking-wider"
              disabled={vehicles.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Reminder
            </Button>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <Card className="rounded-sm border-border">
            <CardContent className="py-16 text-center">
              <Bell className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-heading font-bold text-xl mb-2">Add a Vehicle First</h3>
              <p className="text-muted-foreground">You need to add a vehicle before creating reminders</p>
            </CardContent>
          </Card>
        ) : reminders.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {reminders.map((reminder, index) => (
                <motion.div
                  key={reminder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card 
                    className={`rounded-sm border-border hover:border-primary/50 transition-colors group ${
                      reminder.completed ? 'opacity-60' : ''
                    }`}
                    data-testid={`reminder-card-${reminder.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-sm ${reminder.completed ? 'bg-muted' : 'bg-amber-500/10'}`}>
                            <Bell className={`h-5 w-5 ${reminder.completed ? 'text-muted-foreground' : 'text-amber-500'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{reminder.service_type}</h3>
                              {!reminder.completed && getDueBadge(reminder.due_date)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Car className="h-3.5 w-3.5" />
                              <span>{getVehicleName(reminder.vehicle_id)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarIcon className="h-4 w-4" />
                              {format(new Date(reminder.due_date), 'PPP')}
                            </div>
                            {reminder.due_odometer && (
                              <span className="font-mono text-muted-foreground">
                                @ {reminder.due_odometer.toLocaleString()} km
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!reminder.completed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleComplete(reminder)}
                                data-testid={`complete-reminder-${reminder.id}`}
                                className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(reminder)}
                              data-testid={`edit-reminder-${reminder.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedReminder(reminder);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`delete-reminder-${reminder.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="rounded-sm border-border">
            <CardContent className="py-16 text-center">
              <Bell className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-heading font-bold text-xl mb-2">
                {showCompleted ? 'No Completed Reminders' : 'No Active Reminders'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {showCompleted ? 'Complete some reminders to see them here' : 'Set up reminders to stay on top of maintenance'}
              </p>
              {!showCompleted && (
                <Button
                  onClick={openAddDialog}
                  className="rounded-sm font-heading font-bold uppercase tracking-wider"
                  data-testid="empty-add-reminder-btn"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Reminder
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-xl">
                {selectedReminder ? 'Edit Reminder' : 'Add Reminder'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle *</Label>
                <Select 
                  value={formData.vehicle_id} 
                  onValueChange={(value) => setFormData({...formData, vehicle_id: value})}
                >
                  <SelectTrigger className="rounded-sm" data-testid="reminder-vehicle-select">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_type">Service Type *</Label>
                <Select 
                  value={formData.service_type} 
                  onValueChange={(value) => setFormData({...formData, service_type: value})}
                >
                  <SelectTrigger className="rounded-sm" data-testid="reminder-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal rounded-sm"
                      data-testid="reminder-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_odometer">Due at Odometer (km)</Label>
                <Input
                  id="due_odometer"
                  data-testid="reminder-odometer-input"
                  type="number"
                  value={formData.due_odometer}
                  onChange={(e) => setFormData({...formData, due_odometer: e.target.value})}
                  placeholder="Optional - e.g., 60000"
                  className="rounded-sm font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  data-testid="reminder-notes-input"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes..."
                  className="rounded-sm"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-sm font-heading font-bold uppercase tracking-wider"
                  disabled={submitting}
                  data-testid="reminder-submit-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : selectedReminder ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading font-bold">Delete Reminder?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm"
                data-testid="confirm-delete-reminder-btn"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default RemindersPage;
