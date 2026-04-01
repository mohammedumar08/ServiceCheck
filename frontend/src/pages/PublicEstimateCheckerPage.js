import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileSearch, Upload, Camera, Loader2, X, Globe, Wrench, ArrowLeft, Gauge } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REGION_META = {
  US: { label: 'United States', unit: 'miles', placeholder: 'e.g. 42,000', helper: "We use your vehicle's oil life system when applicable" },
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

const PublicEstimateCheckerPage = () => {
  const [uploading, setUploading] = useState(false);
  const [selMake, setSelMake] = useState('');
  const [selModel, setSelModel] = useState('');
  const [selYear, setSelYear] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [regionCode, setRegionCode] = useState(detectDefaultRegion);
  const [currentMileage, setCurrentMileage] = useState('');
  const [supportedVehicles, setSupportedVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    axios.get(`${API_URL}/estimates/public/supported-vehicles`)
      .then(res => setSupportedVehicles(res.data.supported_vehicles || []))
      .catch(() => toast.error('Failed to load vehicle data'))
      .finally(() => setLoadingVehicles(false));
  }, []);

  const makes = [...new Set(supportedVehicles.map(sv => sv.make))].sort();
  const models = selMake ? [...new Set(supportedVehicles.filter(sv => sv.make === selMake).map(sv => sv.model))].sort() : [];
  const years = (selMake && selModel) ? [...new Set(supportedVehicles.filter(sv => sv.make === selMake && sv.model === selModel).map(sv => String(sv.year)))].sort() : [];
  const isReady = selMake && selModel && selYear && selectedFile;
  const rm = REGION_META[regionCode] || REGION_META.CA;

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
    if (!selectedFile || !selMake || !selModel || !selYear) {
      toast.error('Please select a vehicle and upload a file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('make', selMake);
      formData.append('model', selModel);
      formData.append('year', parseInt(selYear));
      formData.append('region_code', regionCode);
      if (currentMileage) formData.append('current_mileage', parseInt(currentMileage));

      const res = await axios.post(`${API_URL}/estimates/public/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      const { estimate, guest_token } = res.data;
      toast.success('Estimate analyzed successfully');
      navigate(`/estimate-checker/${estimate.id}?guest_token=${guest_token}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to analyze estimate');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-heading font-bold text-lg tracking-tight">ServiceCheck</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="font-heading font-semibold text-xs uppercase tracking-wider" data-testid="nav-dashboard-link">
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="font-heading font-semibold text-xs uppercase tracking-wider" data-testid="nav-login-link">
                  Login
                </Button>
                <Button size="sm" onClick={() => navigate('/register')} className="rounded-sm font-heading font-bold text-xs uppercase tracking-wider" data-testid="nav-register-link">
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="-ml-2 mb-4 text-muted-foreground" data-testid="back-to-home-btn">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-primary/10 text-primary text-sm font-heading font-bold uppercase tracking-wider mb-3">
              <FileSearch className="h-4 w-4" /> Free Estimate Check
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight mb-2">
              Check Your Repair Estimate
            </h1>
            <p className="text-muted-foreground text-sm">
              Upload a mechanic's quote and instantly see what's needed, optional, or likely an upsell. No account required.
            </p>
          </div>

          <Card className="rounded-sm border-border">
            <CardContent className="p-5 sm:p-6 space-y-5">
              {/* Region */}
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Region</label>
                <Select value={regionCode} onValueChange={handleRegionChange} disabled={uploading}>
                  <SelectTrigger data-testid="public-region-select" className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CA"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Canada</span></SelectItem>
                    <SelectItem value="US"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />United States</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle Select */}
              {loadingVehicles ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Make</label>
                    <Select value={selMake} onValueChange={(v) => { setSelMake(v); setSelModel(''); setSelYear(''); }} disabled={uploading}>
                      <SelectTrigger data-testid="public-make-select" className="rounded-sm"><SelectValue placeholder="Make" /></SelectTrigger>
                      <SelectContent>{makes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Model</label>
                    <Select value={selModel} onValueChange={(v) => { setSelModel(v); setSelYear(''); }} disabled={uploading || !selMake}>
                      <SelectTrigger data-testid="public-model-select" className="rounded-sm"><SelectValue placeholder="Model" /></SelectTrigger>
                      <SelectContent>{models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Year</label>
                    <Select value={selYear} onValueChange={setSelYear} disabled={uploading || !selModel}>
                      <SelectTrigger data-testid="public-year-select" className="rounded-sm"><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Mileage */}
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                  {regionCode === 'US' ? 'Current Mileage' : 'Current Odometer'} <span className="opacity-60">(optional)</span>
                </label>
                <Input
                  data-testid="public-mileage-input"
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
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Estimate Document</label>
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
                    <Button variant="outline" className="flex-1 rounded-sm" onClick={() => fileInputRef.current?.click()} data-testid="public-file-picker-btn">
                      <Upload className="mr-2 h-4 w-4" /> Choose File
                    </Button>
                    <Button variant="outline" className="rounded-sm" onClick={() => cameraInputRef.current?.click()} data-testid="public-camera-btn">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG, WebP, or PDF (max 20MB)</p>
              </div>

              <Button
                className="w-full rounded-sm font-heading font-bold uppercase tracking-wider h-11"
                onClick={handleUpload}
                disabled={uploading || !isReady}
                data-testid="public-submit-estimate-btn"
              >
                {uploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><FileSearch className="mr-2 h-4 w-4" /> Analyze Estimate</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicEstimateCheckerPage;
