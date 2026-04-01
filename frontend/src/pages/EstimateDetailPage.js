import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileSearch, CheckCircle2, AlertTriangle, HelpCircle, XCircle,
  DollarSign, Wrench, ChevronDown, ChevronUp, ArrowRightLeft, Loader2,
  ShieldCheck, ShieldAlert, ShieldQuestion, Car, PlusCircle, Globe, Clock, Gauge, RefreshCw, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RECOMMENDATION_CONFIG = {
  recommended_now: { label: 'Recommended', icon: ShieldCheck, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-500' },
  maybe_needed: { label: 'Maybe Needed', icon: ShieldQuestion, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dotColor: 'bg-amber-500' },
  likely_optional: { label: 'Likely Optional', icon: HelpCircle, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dotColor: 'bg-blue-500' },
  cannot_determine: { label: 'Info', icon: HelpCircle, color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', dotColor: 'bg-zinc-500' },
};

const CATEGORY_CONFIG = {
  required: { label: 'Required', color: 'text-emerald-400' },
  conditional: { label: 'Conditional', color: 'text-amber-400' },
  not_required: { label: 'Not Required', color: 'text-blue-400' },
  informational: { label: 'Informational', color: 'text-zinc-400' },
  unknown: { label: 'Unknown', color: 'text-zinc-400' },
};

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
  const recConfig = (rec) => RECOMMENDATION_CONFIG[rec] || RECOMMENDATION_CONFIG.cannot_determine;
  const catConfig = (cat) => CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.unknown;

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
          {items.map((item, idx) => {
            const rec = recConfig(item.default_recommendation_code);
            const cat = catConfig(item.category);
            const isExpanded = expandedItem === item.id;
            const RecIcon = rec.icon;

            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <Card className={`rounded-sm border-border transition-colors ${item.converted_to_service ? 'opacity-60' : ''}`} data-testid={`estimate-item-${item.id}`}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                      {!item.converted_to_service && (
                        <Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItem(item.id)} onClick={(e) => e.stopPropagation()} data-testid={`checkbox-item-${item.id}`} className="shrink-0" />
                      )}
                      {item.converted_to_service && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{item.display_name || item.raw_text}</span>
                          <Badge variant="outline" className={`text-[10px] rounded-sm px-1.5 py-0 ${rec.color}`}>
                            <RecIcon className="h-3 w-3 mr-0.5" />{rec.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] rounded-sm px-1.5 py-0 ${cat.color}`}>{cat.label}</Badge>
                          {item.due_status && item.due_status !== 'unknown' && item.due_status !== 'schedule_known' && (
                            <Badge variant="outline" className={`text-[10px] rounded-sm px-1.5 py-0 ${
                              item.due_status === 'due_now' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                              item.due_status === 'due_soon' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                              item.due_status === 'not_due' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                              item.due_status === 'condition_based' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                              'bg-zinc-500/15 text-zinc-400'
                            }`}>
                              <Clock className="h-3 w-3 mr-0.5" />
                              {item.due_status === 'condition_based' ? 'oil life' : item.due_status.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        {item.raw_text !== item.display_name && item.display_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">Original: {item.raw_text}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold">${(item.quoted_price || 0).toFixed(2)}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                          <div className="space-y-2">
                            {item.recommendation_text && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Recommendation</p>
                                <p className="text-sm font-medium mt-0.5">{item.recommendation_text}</p>
                              </div>
                            )}
                            {item.user_explanation && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Details</p>
                                <p className="text-sm mt-0.5 text-muted-foreground">{item.user_explanation}</p>
                              </div>
                            )}
                            {item.description && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                                <p className="text-sm mt-0.5 text-muted-foreground">{item.description}</p>
                              </div>
                            )}
                            {item.notes && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
                                <p className="text-sm mt-0.5">{item.notes}</p>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            {(item.interval_value || item.interval_km || item.interval_miles) && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Service Interval</p>
                                <p className="text-sm font-mono mt-0.5">
                                  {(item.interval_value || item.interval_km || item.interval_miles || 0).toLocaleString()} {item.interval_unit || distUnit}
                                </p>
                              </div>
                            )}
                            {item.due_status && item.due_status !== 'unknown' && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Due Status</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className={`text-[10px] rounded-sm ${
                                    item.due_status === 'due_now' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                    item.due_status === 'due_soon' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                    item.due_status === 'not_due' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                    item.due_status === 'condition_based' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                                    'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                                  }`}>
                                    <Clock className="h-3 w-3 mr-0.5" />
                                    {item.due_status === 'condition_based' ? 'Based on oil life indicator' : item.due_status.replace(/_/g, ' ')}
                                  </Badge>
                                  {item.miles_remaining != null && (
                                    <span className="text-xs font-mono text-muted-foreground">
                                      {item.miles_remaining.toLocaleString()} {item.interval_unit || distUnit} remaining
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {item.schedule_notes && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Source</p>
                                <p className="text-sm mt-0.5 text-muted-foreground">{item.schedule_notes}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Match Confidence</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${(item.match_confidence || 0) >= 0.8 ? 'bg-emerald-500' : (item.match_confidence || 0) >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${(item.match_confidence || 0) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono">{((item.match_confidence || 0) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
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
