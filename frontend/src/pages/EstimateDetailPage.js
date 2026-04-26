import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRightLeft, Loader2,
  Car, PlusCircle, Globe, Gauge, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import DashboardLayout from '../components/DashboardLayout';
import EstimateItemCard from '../components/EstimateItemCard';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EstimateDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [converting, setConverting] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [drivingMode, setDrivingMode] = useState('normal'); // 'normal' or 'severe'

  useEffect(() => { fetchEstimate(); }, [id]);

  const fetchEstimate = async () => {
    try {
      const [estRes, vehRes] = await Promise.all([
        axios.get(`${API_URL}/estimates/${id}`, getAuthHeader()),
        axios.get(`${API_URL}/vehicles`, getAuthHeader()),
      ]);
      setData(estRes.data);
      setVehicles(vehRes.data || []);
      // Sync driving mode with stored schedule
      const sc = estRes.data?.estimate?.schedule_code;
      setDrivingMode(sc === 'SCHEDULE_2' ? 'severe' : 'normal');
    } catch {
      toast.error('Failed to load estimate');
      navigate('/estimates');
    } finally {
      setLoading(false);
    }
  };

  const handleDrivingModeChange = async (mode) => {
    if (mode === drivingMode || reanalyzing) return;
    setDrivingMode(mode);
    setReanalyzing(true);
    try {
      const scheduleCode = mode === 'severe' ? 'SCHEDULE_2' : 'SCHEDULE_1';
      const res = await axios.post(
        `${API_URL}/estimates/${id}/reanalyze`,
        { schedule_code: scheduleCode },
        getAuthHeader()
      );
      setData(res.data);
      toast.success(mode === 'severe' ? 'Updated for severe driving conditions' : 'Updated for normal driving');
    } catch {
      toast.error('Failed to update analysis');
      setDrivingMode(drivingMode === 'severe' ? 'normal' : 'severe'); // revert
    } finally {
      setReanalyzing(false);
    }
  };

  const toggleItem = (itemId) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAll = () => {
    const convertable = (data?.items || []).filter((i) => !i.converted_to_service);
    if (selectedItems.size === convertable.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(convertable.map((i) => i.id)));
  };

  const handleConvert = async (createVehicle = false) => {
    if (selectedItems.size === 0) { toast.error('Select at least one item'); return; }
    setConverting(true);
    try {
      await axios.post(`${API_URL}/estimates/${id}/convert`, {
        item_ids: Array.from(selectedItems),
        vehicle_id: selectedVehicleId || null,
        create_vehicle: createVehicle,
      }, getAuthHeader());
      toast.success(`${selectedItems.size} item(s) converted to service records`);
      setSelectedItems(new Set());
      setShowConvertDialog(false);
      setSelectedVehicleId('');
      fetchEstimate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to convert items');
    } finally {
      setConverting(false);
    }
  };

  const openConvertFlow = () => {
    if (selectedItems.size === 0) { toast.error('Select at least one item'); return; }
    const est = data?.estimate;
    const match = vehicles.find((v) => v.make === est?.make && v.model === est?.model);
    if (match) setSelectedVehicleId(match.id);
    setShowConvertDialog(true);
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

  if (!data) return null;

  const { estimate, items, summary } = data;
  const distUnit = estimate.distance_unit || (estimate.region_code === 'US' ? 'mi' : 'km');
  const isUS = estimate.region_code === 'US';

  return (
    <DashboardLayout>
      <div data-testid="estimate-detail-page" className="space-y-6">
        {/* Back + Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/estimates')} className="mb-3 -ml-2 text-muted-foreground" data-testid="back-to-estimates-btn">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Estimates
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">
                {estimate.provider || 'Repair Estimate'}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                <span>{estimate.vehicle_info}</span>
                {estimate.estimate_date && (
                  <span>{new Date(estimate.estimate_date).toLocaleDateString()}</span>
                )}
                {estimate.region_code && (
                  <Badge variant="outline" className="text-[10px] rounded-sm">
                    <Globe className="h-3 w-3 mr-1" />
                    {isUS ? 'United States' : 'Canada'}
                  </Badge>
                )}
                {estimate.current_mileage && (
                  <Badge variant="outline" className="text-[10px] rounded-sm">
                    <Gauge className="h-3 w-3 mr-1" />
                    {estimate.current_mileage.toLocaleString()} {distUnit}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Quoted</p>
              <p className="text-3xl font-heading font-bold font-mono" data-testid="estimate-total">
                ${(estimate.total_quoted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Detected Region Banner */}
        {estimate.detected_region && estimate.detected_region !== estimate.region_code && (
          <Card className="rounded-sm border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                We detected <strong>{estimate.detected_region === 'US' ? 'United States' : 'Canada'}</strong> from your estimate.
                You may want to re-upload with the correct region selected.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Driving Conditions Toggle (US only) */}
        {isUS && (
          <Card className="rounded-sm border-border">
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Driving Conditions</span>
                {reanalyzing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
              <div className="flex gap-2" data-testid="driving-conditions-toggle">
                <Button
                  variant={drivingMode === 'normal' ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-sm text-xs"
                  onClick={() => handleDrivingModeChange('normal')}
                  disabled={reanalyzing}
                  data-testid="driving-mode-normal"
                >
                  Normal driving
                </Button>
                <Button
                  variant={drivingMode === 'severe' ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-sm text-xs"
                  onClick={() => handleDrivingModeChange('severe')}
                  disabled={reanalyzing}
                  data-testid="driving-mode-severe"
                >
                  Short trips / extreme conditions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Required', count: summary.required_count, amount: summary.required_total, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Conditional', count: summary.conditional_count, amount: summary.conditional_total, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Not Required', count: summary.not_required_count, amount: summary.not_required_total, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Total Items', count: summary.total_items, amount: summary.total_quoted_amount, color: 'text-primary', bg: 'bg-primary/10' },
          ].map((card, idx) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
              <Card className="rounded-sm border-border">
                <CardContent className="p-4">
                  <p className={`text-xs uppercase tracking-wider font-medium ${card.color}`}>{card.label}</p>
                  <p className="text-2xl font-heading font-bold mt-1">{card.count}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    ${(card.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Convert Action Bar */}
        {items.some((i) => !i.converted_to_service) && (
          <Card className="rounded-sm border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Convert to Service Records</p>
                  <p className="text-xs text-muted-foreground">{selectedItems.size} item(s) selected</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-sm" onClick={selectAll} data-testid="select-all-items-btn">
                  {selectedItems.size === items.filter((i) => !i.converted_to_service).length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button size="sm" className="rounded-sm font-heading font-bold uppercase tracking-wider" onClick={openConvertFlow} disabled={converting || selectedItems.size === 0} data-testid="convert-items-btn">
                  {converting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Converting...</> : 'Convert Selected'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items List */}
        <div className="space-y-2">
          <h2 className="font-heading font-bold text-lg">Line Items</h2>
          {items.map((item, idx) => (
            <EstimateItemCard
              key={item.id}
              item={item}
              idx={idx}
              distUnit={distUnit}
              isSelected={selectedItems.has(item.id)}
              onToggle={toggleItem}
              isExpanded={expandedItem === item.id}
              onExpand={setExpandedItem}
            />
          ))}
        </div>

        {/* Convert Dialog */}
        <Dialog open={showConvertDialog} onOpenChange={(open) => { if (!converting) setShowConvertDialog(open); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold">Save as Service Records</DialogTitle>
              <DialogDescription>
                Choose where to save {selectedItems.size} item(s) for <strong>{estimate.vehicle_info}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {vehicles.filter((v) => v.make === estimate.make && v.model === estimate.model).length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Use existing vehicle</label>
                  <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId} disabled={converting}>
                    <SelectTrigger data-testid="convert-vehicle-select" className="rounded-sm"><SelectValue placeholder="Select a vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.filter((v) => v.make === estimate.make && v.model === estimate.model).map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedVehicleId && (
                <Button className="w-full rounded-sm font-heading font-bold uppercase tracking-wider" onClick={() => handleConvert(false)} disabled={converting} data-testid="convert-existing-btn">
                  {converting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                  Convert to Selected Vehicle
                </Button>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
              </div>

              <Button variant="outline" className="w-full rounded-sm" onClick={() => handleConvert(true)} disabled={converting} data-testid="convert-create-vehicle-btn">
                {converting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add "{estimate.vehicle_info}" to My Garage & Convert
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                This will add {estimate.vehicle_info} to your vehicles and save the selected items as service records.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default EstimateDetailPage;
