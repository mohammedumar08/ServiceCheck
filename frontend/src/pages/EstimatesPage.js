import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, Upload, Plus, Trash2, ChevronRight, Calendar, Car, Loader2, X, Camera, Globe } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REGION_META = {
  US: { label: 'United States', unit: 'miles', placeholder: 'e.g. 42,000', helper: 'We use your vehicle\'s oil life system when applicable' },
  CA: { label: 'Canada', unit: 'km', placeholder: 'e.g. 65,000', helper: 'Based on mileage and typical Canadian driving conditions' },
};

const detectDefaultRegion = () => {
  const stored = localStorage.getItem('servicecheck_region');
  if (stored && REGION_META[stored]) return stored;
  const lang = (navigator.language || '').toLowerCase();
  if (lang.includes('us') || lang === 'en') return 'US';
  if (lang.includes('ca')) return 'CA';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('America/') && !tz.includes('Toronto') && !tz.includes('Vancouver') && !tz.includes('Montreal') && !tz.includes('Edmonton') && !tz.includes('Winnipeg')) return 'US';
  } catch {}
  return 'CA';
};

const EstimatesPage = () => {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState('');
  const [garageVehicleId, setGarageVehicleId] = useState('');
  const [selMake, setSelMake] = useState('');
  const [selModel, setSelModel] = useState('');
  const [selYear, setSelYear] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [regionCode, setRegionCode] = useState(detectDefaultRegion);
  const [currentMileage, setCurrentMileage] = useState('');
  const [supportedVehicles, setSupportedVehicles] = useState([]);
  const [garageVehicles, setGarageVehicles] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [estRes, supRes, garRes] = await Promise.all([
        axios.get(`${API_URL}/estimates`, getAuthHeader()),
        axios.get(`${API_URL}/estimates/supported-vehicles`, getAuthHeader()),
        axios.get(`${API_URL}/vehicles`, getAuthHeader()),
      ]);
      setEstimates(estRes.data.estimates || []);
      setSupportedVehicles(supRes.data.supported_vehicles || []);
      setGarageVehicles(garRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const supportedSet = new Set(supportedVehicles.map((sv) => `${sv.make}|${sv.model}|${sv.year}`));
  const garageSupported = garageVehicles.filter((v) => supportedSet.has(`${v.make}|${v.model}|${v.year}`));
  const makes = [...new Set(supportedVehicles.map((sv) => sv.make))].sort();
  const models = selMake ? [...new Set(supportedVehicles.filter((sv) => sv.make === selMake).map((sv) => sv.model))].sort() : [];
  const years = (selMake && selModel) ? [...new Set(supportedVehicles.filter((sv) => sv.make === selMake && sv.model === selModel).map((sv) => String(sv.year)))].sort() : [];

  const getSelection = () => {
    if (pickerMode === 'garage' && garageVehicleId) {
      const v = garageVehicles.find((g) => g.id === garageVehicleId);
      return v ? { make: v.make, model: v.model, year: v.year } : null;
    }
    if (selMake && selModel && selYear) return { make: selMake, model: selModel, year: parseInt(selYear) };
    return null;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const handleRegionChange = (v) => {
    setRegionCode(v);
    setCurrentMileage('');
    localStorage.setItem('servicecheck_region', v);
  };

  const handleUpload = async () => {
    const selection = getSelection();
    if (!selectedFile || !selection) {
      toast.error('Please select a vehicle and upload a file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('make', selection.make);
      formData.append('model', selection.model);
      formData.append('year', selection.year);
      formData.append('region_code', regionCode);
      formData.append('schedule_code', 'SCHEDULE_1');
      if (currentMileage) formData.append('current_mileage', parseInt(currentMileage));
      const res = await axios.post(`${API_URL}/estimates`, formData, {
        ...getAuthHeader(),
        headers: { ...getAuthHeader().headers, 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      toast.success('Estimate analyzed successfully');
      setDialogOpen(false);
      resetDialog();
      navigate(`/estimates/${res.data.estimate.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to analyze estimate');
    } finally {
      setUploading(false);
    }
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPickerMode('');
    setGarageVehicleId('');
    setSelMake('');
    setSelModel('');
    setSelYear('');
    setCurrentMileage('');
  };

  const handleDelete = async (e, estimateId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/estimates/${estimateId}`, getAuthHeader());
      setEstimates((prev) => prev.filter((est) => est.id !== estimateId));
      toast.success('Estimate deleted');
    } catch {
      toast.error('Failed to delete estimate');
    }
  };

  const isReady = !!getSelection();
  const rm = REGION_META[regionCode] || REGION_META.CA;

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
      <div data-testid="estimates-page" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">Estimate Analysis</h1>
            <p className="text-muted-foreground mt-1">Upload a mechanic quote and get instant recommendations</p>
          </div>
          <Button
            data-testid="upload-estimate-btn"
            onClick={() => setDialogOpen(true)}
            className="rounded-sm font-heading font-bold uppercase tracking-wider"
          >
            <Plus className="mr-2 h-4 w-4" />
            Analyze Estimate
          </Button>
        </div>

        {estimates.length === 0 ? (
          <Card className="rounded-sm border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileSearch className="h-14 w-14 text-muted-foreground/40 mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">No estimates yet</h3>
              <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
                Upload a repair estimate or mechanic quote to get an instant analysis with recommendations.
              </p>
              <Button
                data-testid="empty-upload-estimate-btn"
                onClick={() => setDialogOpen(true)}
                className="rounded-sm font-heading font-bold uppercase tracking-wider"
              >
                <Upload className="mr-2 h-4 w-4" /> Upload Your First Estimate
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {estimates.map((est, idx) => (
              <motion.div key={est.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card
                  className="rounded-sm border-border hover:border-primary/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/estimates/${est.id}`)}
                  data-testid={`estimate-card-${est.id}`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="p-2.5 rounded-sm bg-primary/10 shrink-0">
                          <FileSearch className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{est.provider || 'Unknown Provider'}</p>
                            <Badge variant="outline" className="text-xs rounded-sm shrink-0">{est.status}</Badge>
                            {est.region_code && (
                              <Badge variant="outline" className="text-xs rounded-sm shrink-0">
                                <Globe className="h-3 w-3 mr-1" />{est.region_code === 'US' ? 'US' : 'CA'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{est.vehicle_info}</span>
                            {est.estimate_date && (
                              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(est.estimate_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-mono font-bold text-lg">${(est.total_quoted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          <p className="text-xs text-muted-foreground">quoted</p>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={(e) => handleDelete(e, est.id)}
                          data-testid={`delete-estimate-${est.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Upload Dialog — Simplified */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!uploading) { setDialogOpen(open); if (!open) resetDialog(); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold">Estimate Analysis</DialogTitle>
              <DialogDescription>Upload a mechanic's quote to see what's needed, what's optional, and what to skip.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Region */}
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Region</label>
                <Select value={regionCode} onValueChange={handleRegionChange} disabled={uploading}>
                  <SelectTrigger data-testid="estimate-region-select" className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CA"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Canada</span></SelectItem>
                    <SelectItem value="US"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />United States</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle */}
              {garageSupported.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant={pickerMode === 'garage' ? 'default' : 'outline'}
                    size="sm" className="flex-1 rounded-sm text-xs"
                    onClick={() => { setPickerMode('garage'); setSelMake(''); setSelModel(''); setSelYear(''); }}
                    disabled={uploading} data-testid="picker-garage-btn"
                  >
                    <Car className="mr-1.5 h-3.5 w-3.5" /> From My Garage
                  </Button>
                  <Button
                    variant={pickerMode === 'manual' ? 'default' : 'outline'}
                    size="sm" className="flex-1 rounded-sm text-xs"
                    onClick={() => { setPickerMode('manual'); setGarageVehicleId(''); }}
                    disabled={uploading} data-testid="picker-manual-btn"
                  >
                    Select Manually
                  </Button>
                </div>
              )}

              {(pickerMode === 'garage' && garageSupported.length > 0) && (
                <Select value={garageVehicleId} onValueChange={setGarageVehicleId} disabled={uploading}>
                  <SelectTrigger data-testid="estimate-garage-select" className="rounded-sm">
                    <SelectValue placeholder="Select from garage" />
                  </SelectTrigger>
                  <SelectContent>
                    {garageSupported.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(pickerMode === 'manual' || (pickerMode === '' && garageSupported.length === 0)) && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Make</label>
                    <Select value={selMake} onValueChange={(v) => { setSelMake(v); setSelModel(''); setSelYear(''); }} disabled={uploading}>
                      <SelectTrigger data-testid="estimate-make-select" className="rounded-sm"><SelectValue placeholder="Make" /></SelectTrigger>
                      <SelectContent>{makes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Model</label>
                    <Select value={selModel} onValueChange={(v) => { setSelModel(v); setSelYear(''); }} disabled={uploading || !selMake}>
                      <SelectTrigger data-testid="estimate-model-select" className="rounded-sm"><SelectValue placeholder="Model" /></SelectTrigger>
                      <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Year</label>
                    <Select value={selYear} onValueChange={setSelYear} disabled={uploading || !selModel}>
                      <SelectTrigger data-testid="estimate-year-select" className="rounded-sm"><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Mileage — always visible, label adapts to region */}
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">
                  {regionCode === 'US' ? 'Current Mileage' : 'Current Odometer'} <span className="opacity-60">(optional)</span>
                </label>
                <Input
                  data-testid="estimate-mileage-input"
                  type="number"
                  placeholder={rm.placeholder}
                  value={currentMileage}
                  onChange={(e) => setCurrentMileage(e.target.value)}
                  disabled={uploading}
                  className="rounded-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{rm.helper}</p>
              </div>

              {/* File Picker */}
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Estimate Document</label>
                {selectedFile ? (
                  <div className="border border-border rounded-sm p-3 space-y-2">
                    {previewUrl && <img src={previewUrl} alt="Preview" className="w-full max-h-40 object-contain rounded-sm bg-muted" />}
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} disabled={uploading}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-sm" onClick={() => fileInputRef.current?.click()} data-testid="estimate-file-picker-btn">
                      <Upload className="mr-2 h-4 w-4" /> Choose File
                    </Button>
                    <Button variant="outline" className="rounded-sm" onClick={() => cameraInputRef.current?.click()} data-testid="estimate-camera-btn">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG, WebP, or PDF (max 20MB)</p>
              </div>

              <Button
                className="w-full rounded-sm font-heading font-bold uppercase tracking-wider"
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !isReady}
                data-testid="submit-estimate-btn"
              >
                {uploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><FileSearch className="mr-2 h-4 w-4" /> Analyze Estimate</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default EstimatesPage;
