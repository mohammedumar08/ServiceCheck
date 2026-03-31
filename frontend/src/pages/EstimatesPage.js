import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSearch, Upload, Plus, Trash2, ChevronRight, Calendar, DollarSign, Car, Loader2, AlertCircle, CheckCircle2, HelpCircle, X, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RECOMMENDATION_COLORS = {
  required: 'bg-red-500/15 text-red-400 border-red-500/30',
  recommended: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  conditional: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  optional: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  not_required: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cannot_determine: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const EstimatesPage = () => {
  const [estimates, setEstimates] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [supportedVehicles, setSupportedVehicles] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [estRes, vehRes, supRes] = await Promise.all([
        axios.get(`${API_URL}/estimates`, getAuthHeader()),
        axios.get(`${API_URL}/vehicles`, getAuthHeader()),
        axios.get(`${API_URL}/estimates/supported-vehicles`, getAuthHeader()),
      ]);
      setEstimates(estRes.data.estimates || []);
      setVehicles(vehRes.data || []);
      setSupportedVehicles(supRes.data.supported_vehicles || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedVehicle) {
      toast.error('Please select a vehicle and a file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('vehicle_id', selectedVehicle);
      const res = await axios.post(`${API_URL}/estimates`, formData, {
        ...getAuthHeader(),
        headers: { ...getAuthHeader().headers, 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      toast.success('Estimate analyzed successfully');
      setDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedVehicle('');
      navigate(`/estimates/${res.data.estimate.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to analyze estimate');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e, estimateId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/estimates/${estimateId}`, getAuthHeader());
      setEstimates((prev) => prev.filter((est) => est.id !== estimateId));
      toast.success('Estimate deleted');
    } catch (err) {
      toast.error('Failed to delete estimate');
    }
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
      <div data-testid="estimates-page" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">Repair Estimates</h1>
            <p className="text-muted-foreground mt-1">Upload and analyze mechanic quotes</p>
          </div>
          <Button
            data-testid="upload-estimate-btn"
            onClick={() => {
              if (vehicles.length === 0) {
                toast.error('Add a vehicle first');
                return;
              }
              setDialogOpen(true);
            }}
            className="rounded-sm font-heading font-bold uppercase tracking-wider"
          >
            <Plus className="mr-2 h-4 w-4" />
            Upload Estimate
          </Button>
        </div>

        {/* Estimates List */}
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
                onClick={() => {
                  if (vehicles.length === 0) {
                    toast.error('Add a vehicle first');
                    return;
                  }
                  setDialogOpen(true);
                }}
                className="rounded-sm font-heading font-bold uppercase tracking-wider"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Your First Estimate
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {estimates.map((est, idx) => (
              <motion.div
                key={est.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
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
                            <Badge variant="outline" className="text-xs rounded-sm shrink-0">
                              {est.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Car className="h-3.5 w-3.5" />
                              {est.vehicle_info}
                            </span>
                            {est.estimate_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(est.estimate_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-mono font-bold text-lg">
                            ${(est.total_quoted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">quoted</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
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

        {/* Upload Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!uploading) setDialogOpen(open); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold">Upload Repair Estimate</DialogTitle>
              <DialogDescription>Upload an image or PDF of a mechanic's quote for analysis.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Vehicle</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle} disabled={uploading}>
                  <SelectTrigger data-testid="estimate-vehicle-select" className="rounded-sm">
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => {
                      const isSupported = supportedVehicles.some(
                        (sv) => sv.make === v.make && sv.model === v.model
                      );
                      return (
                        <SelectItem key={v.id} value={v.id} disabled={!isSupported}>
                          {v.year} {v.make} {v.model}
                          {!isSupported && ' (not supported)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {vehicles.length > 0 && !vehicles.some((v) => supportedVehicles.some((sv) => sv.make === v.make && sv.model === v.model)) && (
                  <p className="text-xs text-amber-400 mt-1.5">
                    Estimate Checker currently supports Mazda CX-5 only. Add a Mazda CX-5 vehicle to use this feature.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Estimate Document</label>
                {selectedFile ? (
                  <div className="border border-border rounded-sm p-3 space-y-2">
                    {previewUrl && (
                      <img src={previewUrl} alt="Preview" className="w-full max-h-40 object-contain rounded-sm bg-muted" />
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-sm"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="estimate-file-picker-btn"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose File
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-sm"
                      onClick={() => cameraInputRef.current?.click()}
                      data-testid="estimate-camera-btn"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <p className="text-xs text-muted-foreground mt-1.5">JPEG, PNG, WebP, or PDF (max 20MB)</p>
              </div>

              <Button
                className="w-full rounded-sm font-heading font-bold uppercase tracking-wider"
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !selectedVehicle}
                data-testid="submit-estimate-btn"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileSearch className="mr-2 h-4 w-4" />
                    Analyze Estimate
                  </>
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
