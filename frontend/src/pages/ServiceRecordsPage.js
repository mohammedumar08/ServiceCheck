import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, Plus, Camera, Upload, Pencil, Trash2, Loader2, Calendar as CalendarIcon, X, MapPin, DollarSign, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { format } from 'date-fns';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICE_TYPES_MAP = {
  "engine_oil_change": "Engine Oil Change",
  "oil_filter_replacement": "Oil Filter Replacement",
  "tire_rotation": "Tire Rotation",
  "wheel_alignment": "Wheel Alignment",
  "tire_balance": "Tire Balancing",
  "tire_replacement": "Tire Replacement",
  "cabin_air_filter_replacement": "Cabin Air Filter Replacement",
  "engine_air_filter_replacement": "Engine Air Filter Replacement",
  "spark_plug_replacement": "Spark Plug Replacement",
  "ignition_coil_replacement": "Ignition Coil Replacement",
  "brake_pad_replacement": "Brake Pad Replacement",
  "brake_rotor_replacement": "Brake Rotor Replacement",
  "brake_caliper_service": "Brake Caliper Service",
  "brake_fluid_flush": "Brake Fluid Flush",
  "brake_inspection": "Brake Inspection",
  "brake_cleaning_lubrication": "Brake Cleaning and Lubrication",
  "battery_replacement": "Battery Replacement",
  "battery_inspection": "Battery Inspection",
  "battery_terminal_cleaning": "Battery Terminal Cleaning",
  "alternator_replacement": "Alternator Replacement",
  "starter_replacement": "Starter Motor Replacement",
  "engine_coolant_replacement": "Engine Coolant Replacement",
  "radiator_repair": "Radiator Repair",
  "water_pump_replacement": "Water Pump Replacement",
  "transmission_fluid_change": "Transmission Fluid Change",
  "transmission_repair": "Transmission Repair",
  "differential_fluid_change": "Differential Fluid Change",
  "transfer_case_fluid_change": "Transfer Case Fluid Change",
  "power_steering_fluid_change": "Power Steering Fluid Change",
  "ac_recharge": "AC Refrigerant Recharge",
  "ac_compressor_replacement": "AC Compressor Replacement",
  "ac_service": "Air Conditioning Service",
  "oxygen_sensor_replacement": "Oxygen Sensor Replacement",
  "mass_airflow_sensor_cleaning": "Mass Airflow Sensor Cleaning",
  "fuel_pump_replacement": "Fuel Pump Replacement",
  "fuel_injector_replacement": "Fuel Injector Replacement",
  "fuel_injector_cleaning": "Fuel Injector Cleaning",
  "throttle_body_cleaning": "Throttle Body Cleaning",
  "engine_decarbon_service": "Engine Decarbon Service",
  "suspension_repair": "Suspension Repair",
  "shock_strut_replacement": "Shock/Strut Replacement",
  "wheel_bearing_replacement": "Wheel Bearing Replacement",
  "exhaust_repair": "Exhaust System Repair",
  "timing_belt_replacement": "Timing Belt Replacement",
  "drive_belt_replacement": "Drive Belt Replacement",
  "wiper_blade_replacement": "Wiper Blade Replacement",
  "engine_diagnostic": "Engine Diagnostic Service",
  "multi_point_inspection": "Multi-Point Inspection",
  "other": "Other"
};

const SERVICE_CATEGORIES = {
  "Oil & Filters": ["engine_oil_change", "oil_filter_replacement", "cabin_air_filter_replacement", "engine_air_filter_replacement"],
  "Tires & Wheels": ["tire_rotation", "wheel_alignment", "tire_balance", "tire_replacement"],
  "Brakes": ["brake_pad_replacement", "brake_rotor_replacement", "brake_caliper_service", "brake_fluid_flush", "brake_inspection", "brake_cleaning_lubrication"],
  "Battery & Electrical": ["battery_replacement", "battery_inspection", "battery_terminal_cleaning", "alternator_replacement", "starter_replacement"],
  "Engine": ["spark_plug_replacement", "ignition_coil_replacement", "throttle_body_cleaning", "engine_decarbon_service", "engine_diagnostic"],
  "Cooling": ["engine_coolant_replacement", "radiator_repair", "water_pump_replacement"],
  "Transmission & Drivetrain": ["transmission_fluid_change", "transmission_repair", "differential_fluid_change", "transfer_case_fluid_change", "power_steering_fluid_change"],
  "AC & Climate": ["ac_recharge", "ac_compressor_replacement", "ac_service"],
  "Fuel System": ["fuel_pump_replacement", "fuel_injector_replacement", "fuel_injector_cleaning"],
  "Sensors": ["oxygen_sensor_replacement", "mass_airflow_sensor_cleaning"],
  "Suspension & Steering": ["suspension_repair", "shock_strut_replacement", "wheel_bearing_replacement"],
  "Belts & Exhaust": ["timing_belt_replacement", "drive_belt_replacement", "exhaust_repair"],
  "Other": ["wiper_blade_replacement", "multi_point_inspection", "other"]
};

const SERVICE_TYPE_LABELS = Object.values(SERVICE_TYPES_MAP);

const ServiceRecordsPage = () => {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('all');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [formData, setFormData] = useState({
    vehicle_id: '',
    service_type: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    price: '',
    location: '',
    odometer: '',
    notes: '',
    provider: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [extractedServices, setExtractedServices] = useState([]);
  const [showExtractedDialog, setShowExtractedDialog] = useState(false);
  const [extractedMeta, setExtractedMeta] = useState({});
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const { getAuthHeader, token } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [recordsRes, vehiclesRes] = await Promise.all([
        axios.get(`${API_URL}/service-records`, getAuthHeader()),
        axios.get(`${API_URL}/vehicles`, getAuthHeader())
      ]);
      setRecords(recordsRes.data);
      setVehicles(vehiclesRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedRecord(null);
    setDate(new Date());
    setFormData({
      vehicle_id: vehicles[0]?.id || '',
      service_type: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      price: '',
      location: '',
      odometer: '',
      notes: '',
      provider: ''
    });
    setDialogOpen(true);
  };

  const openEditDialog = (record) => {
    setSelectedRecord(record);
    setDate(new Date(record.date));
    setFormData({
      vehicle_id: record.vehicle_id,
      service_type: record.service_type,
      date: record.date,
      price: record.price.toString(),
      location: record.location || '',
      odometer: record.odometer.toString(),
      notes: record.notes || '',
      provider: record.provider || ''
    });
    setDialogOpen(true);
  };

  const handleDateSelect = (selectedDate) => {
    if (selectedDate) {
      setDate(selectedDate);
      setFormData({...formData, date: format(selectedDate, 'yyyy-MM-dd')});
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, WebP image or PDF file');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setOcrLoading(true);
    const formDataObj = new FormData();
    formDataObj.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/ocr/extract`, formDataObj, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = response.data;
      
      if (data.confidence === 'low' && (!data.services || data.services.length === 0)) {
        toast.warning('Could not extract services. Please add manually.');
        return;
      }
      
      // Check if multiple services extracted
      if (data.services && data.services.length > 0) {
        const mappedServices = data.services.map(svc => {
          // Check if OCR returned a valid service type label
          const isValidType = SERVICE_TYPE_LABELS.includes(svc.service_type);
          
          return {
            ...svc,
            service_type: isValidType ? svc.service_type : 'Other',
            original_type: svc.service_type,
            selected: svc.price > 0
          };
        });
        
        setExtractedServices(mappedServices);
        setExtractedMeta({
          date: data.date,
          location: data.location,
          odometer: data.odometer,
          provider: data.provider
        });
        
        if (data.date) {
          setDate(new Date(data.date));
        }
        
        toast.success(`Found ${mappedServices.length} services! Review and add them.`);
        setDialogOpen(false);
        setShowExtractedDialog(true);
      } else {
        toast.warning('No services found. Please add manually.');
      }
    } catch (error) {
      toast.error('Failed to process file');
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  const handleAddExtractedServices = async () => {
    const selectedServices = extractedServices.filter(s => s.selected && s.price > 0);
    
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }
    
    if (!formData.vehicle_id) {
      toast.error('Please select a vehicle');
      return;
    }
    
    if (!extractedMeta.odometer && !formData.odometer) {
      toast.error('Please enter odometer reading');
      return;
    }
    
    setSubmitting(true);
    let addedCount = 0;
    
    for (const service of selectedServices) {
      try {
        const submitData = {
          vehicle_id: formData.vehicle_id,
          service_type: service.service_type,
          date: extractedMeta.date || formData.date,
          price: parseFloat(service.price),
          location: extractedMeta.location || '',
          odometer: parseInt(extractedMeta.odometer || formData.odometer),
          notes: service.notes || service.original_type,
          provider: extractedMeta.provider || ''
        };
        
        await axios.post(`${API_URL}/service-records`, submitData, getAuthHeader());
        addedCount++;
      } catch (error) {
        console.error('Error adding service:', error);
      }
    }
    
    setSubmitting(false);
    setShowExtractedDialog(false);
    setExtractedServices([]);
    
    if (addedCount > 0) {
      toast.success(`Added ${addedCount} service record${addedCount > 1 ? 's' : ''}!`);
      fetchData();
    } else {
      toast.error('Failed to add services');
    }
  };

  const toggleServiceSelection = (index) => {
    setExtractedServices(prev => prev.map((s, i) => 
      i === index ? { ...s, selected: !s.selected } : s
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_id || !formData.service_type || !formData.price || !formData.odometer) {
      toast.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);
    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      odometer: parseInt(formData.odometer)
    };

    try {
      if (selectedRecord) {
        await axios.put(`${API_URL}/service-records/${selectedRecord.id}`, submitData, getAuthHeader());
        toast.success('Service record updated');
      } else {
        await axios.post(`${API_URL}/service-records`, submitData, getAuthHeader());
        toast.success('Service record added');
      }
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    
    try {
      await axios.delete(`${API_URL}/service-records/${selectedRecord.id}`, getAuthHeader());
      toast.success('Service record deleted');
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const filteredRecords = selectedVehicleFilter === 'all' 
    ? records 
    : records.filter(r => r.vehicle_id === selectedVehicleFilter);

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown';
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
      <div data-testid="services-page" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">Service Records</h1>
            <p className="text-muted-foreground mt-1">Track your vehicle maintenance history</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedVehicleFilter} onValueChange={setSelectedVehicleFilter}>
              <SelectTrigger className="w-48 rounded-sm" data-testid="vehicle-filter">
                <SelectValue placeholder="Filter by vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              data-testid="add-service-btn"
              onClick={openAddDialog}
              className="rounded-sm font-heading font-bold uppercase tracking-wider"
              disabled={vehicles.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <Card className="rounded-sm border-border">
            <CardContent className="py-16 text-center">
              <Wrench className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-heading font-bold text-xl mb-2">Add a Vehicle First</h3>
              <p className="text-muted-foreground">You need to add a vehicle before adding service records</p>
            </CardContent>
          </Card>
        ) : filteredRecords.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredRecords.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card 
                    className="rounded-sm border-border hover:border-primary/50 transition-colors group"
                    data-testid={`service-card-${record.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-sm bg-primary/10">
                            <Wrench className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{record.service_type}</h3>
                            <p className="text-sm text-muted-foreground">
                              {getVehicleName(record.vehicle_id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden sm:flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarIcon className="h-4 w-4" />
                              {new Date(record.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Gauge className="h-4 w-4" />
                              <span className="font-mono">{record.odometer?.toLocaleString()} km</span>
                            </div>
                            {record.location && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span className="max-w-32 truncate">{record.location}</span>
                              </div>
                            )}
                          </div>
                          <div className="font-mono font-bold text-emerald-500">
                            ${record.price?.toFixed(2)}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(record)}
                              data-testid={`edit-service-${record.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedRecord(record);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`delete-service-${record.id}`}
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
              <Wrench className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-heading font-bold text-xl mb-2">No Service Records</h3>
              <p className="text-muted-foreground mb-6">Start tracking your vehicle maintenance</p>
              <Button
                onClick={openAddDialog}
                className="rounded-sm font-heading font-bold uppercase tracking-wider"
                data-testid="empty-add-service-btn"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Service Record
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-xl">
                {selectedRecord ? 'Edit Service Record' : 'Add Service Record'}
              </DialogTitle>
            </DialogHeader>
            
            {!selectedRecord && (
              <div className="mb-4 space-y-3">
                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="ocr-upload"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="camera-capture"
                />
                
                {/* Upload buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-sm border-dashed border-2 h-20 flex-col gap-1"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={ocrLoading}
                    data-testid="camera-capture-btn"
                  >
                    {ocrLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-5 w-5" />
                        <span className="text-xs">Take Photo</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-sm border-dashed border-2 h-20 flex-col gap-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={ocrLoading}
                    data-testid="ocr-upload-btn"
                  >
                    {ocrLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">Upload File</span>
                      </>
                    )}
                  </Button>
                </div>
                
                {ocrLoading && (
                  <p className="text-sm text-center text-muted-foreground">
                    Processing with AI... This may take a few seconds.
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground text-center">
                  Supports JPEG, PNG, WebP, PDF. AI will extract service details automatically.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle *</Label>
                <Select 
                  value={formData.vehicle_id} 
                  onValueChange={(value) => setFormData({...formData, vehicle_id: value})}
                >
                  <SelectTrigger className="rounded-sm" data-testid="service-vehicle-select">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service_type">Service Type *</Label>
                  <Select 
                    value={formData.service_type} 
                    onValueChange={(value) => setFormData({...formData, service_type: value})}
                  >
                    <SelectTrigger className="rounded-sm" data-testid="service-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Object.entries(SERVICE_CATEGORIES).map(([category, keys]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</div>
                          {keys.map(key => (
                            <SelectItem key={key} value={SERVICE_TYPES_MAP[key]}>{SERVICE_TYPES_MAP[key]}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal rounded-sm"
                        data-testid="service-date-picker"
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="price"
                      data-testid="service-price-input"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      placeholder="0.00"
                      className="pl-9 rounded-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer (km) *</Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="odometer"
                      data-testid="service-odometer-input"
                      type="number"
                      value={formData.odometer}
                      onChange={(e) => setFormData({...formData, odometer: e.target.value})}
                      placeholder="50000"
                      className="pl-9 rounded-sm font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    data-testid="service-location-input"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Service center address"
                    className="pl-9 rounded-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Service Provider</Label>
                <Input
                  id="provider"
                  data-testid="service-provider-input"
                  value={formData.provider}
                  onChange={(e) => setFormData({...formData, provider: e.target.value})}
                  placeholder="Shop name"
                  className="rounded-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  data-testid="service-notes-input"
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
                  data-testid="service-submit-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : selectedRecord ? 'Update' : 'Add Record'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading font-bold">Delete Service Record?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm"
                data-testid="confirm-delete-service-btn"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Extracted Services Dialog */}
        <Dialog open={showExtractedDialog} onOpenChange={setShowExtractedDialog}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-xl">
                Extracted Services ({extractedServices.filter(s => s.selected).length} selected)
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Vehicle Selection */}
              <div className="space-y-2">
                <Label>Vehicle *</Label>
                <Select 
                  value={formData.vehicle_id} 
                  onValueChange={(value) => setFormData({...formData, vehicle_id: value})}
                >
                  <SelectTrigger className="rounded-sm">
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

              {/* Extracted Meta Info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-sm">
                <div className="text-sm">
                  <span className="text-muted-foreground">Date:</span>{' '}
                  <span className="font-medium">{extractedMeta.date || 'Not found'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Odometer:</span>{' '}
                  <span className="font-mono font-medium">
                    {extractedMeta.odometer ? `${extractedMeta.odometer.toLocaleString()} km` : 'Not found'}
                  </span>
                </div>
                <div className="text-sm col-span-2">
                  <span className="text-muted-foreground">Provider:</span>{' '}
                  <span className="font-medium">{extractedMeta.provider || 'Not found'}</span>
                </div>
              </div>

              {/* Odometer input if not found */}
              {!extractedMeta.odometer && (
                <div className="space-y-2">
                  <Label>Odometer (km) *</Label>
                  <Input
                    type="number"
                    value={formData.odometer}
                    onChange={(e) => setFormData({...formData, odometer: e.target.value})}
                    placeholder="Enter odometer reading"
                    className="rounded-sm font-mono"
                  />
                </div>
              )}

              {/* Services List */}
              <div className="space-y-2">
                <Label>Services Found</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {extractedServices.map((service, index) => (
                    <div 
                      key={index}
                      onClick={() => toggleServiceSelection(index)}
                      className={`p-3 rounded-sm border cursor-pointer transition-colors ${
                        service.selected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={service.selected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded"
                          />
                          <div>
                            <p className="font-medium">{service.service_type}</p>
                            {service.notes && (
                              <p className="text-xs text-muted-foreground">{service.notes}</p>
                            )}
                          </div>
                        </div>
                        <span className={`font-mono font-bold ${service.price > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          ${service.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowExtractedDialog(false);
                  setExtractedServices([]);
                }}
                className="rounded-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddExtractedServices}
                className="rounded-sm font-heading font-bold uppercase tracking-wider"
                disabled={submitting || extractedServices.filter(s => s.selected).length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add {extractedServices.filter(s => s.selected).length} Service{extractedServices.filter(s => s.selected).length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ServiceRecordsPage;
