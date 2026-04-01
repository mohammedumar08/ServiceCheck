import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileSearch, CheckCircle2, HelpCircle,
  DollarSign, Wrench, ChevronDown, ChevronUp, ArrowRightLeft, Loader2,
  ShieldCheck, ShieldAlert, ShieldQuestion, Car, Globe, Clock, Gauge, LogIn, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
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

const PublicEstimateResultPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const guestToken = searchParams.get('guest_token') || '';
  const navigate = useNavigate();
  const { user, token, getAuthHeader } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [reanalyzing, setReanalyzing] = useState(false);
  const [drivingMode, setDrivingMode] = useState('normal');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => { fetchEstimate(); }, [id, guestToken]);

  // Auto-claim estimate if user is logged in and estimate is unclaimed
  useEffect(() => {
    if (user && data?.estimate?.user_id === null && guestToken && !claiming) {
      claimEstimate();
    }
  }, [user, data?.estimate?.user_id]);

  const fetchEstimate = async () => {
    try {
      // Try public endpoint with guest_token
      const res = await axios.get(`${API_URL}/estimates/public/results/${id}?guest_token=${guestToken}`);
      setData(res.data);
      const sc = res.data?.estimate?.schedule_code;
      setDrivingMode(sc === 'SCHEDULE_2' ? 'severe' : 'normal');
    } catch {
      toast.error('Estimate not found or link expired');
      navigate('/estimate-checker');
    } finally {
      setLoading(false);
    }
  };

  const claimEstimate = async () => {
    if (!token || !guestToken) return;
    setClaiming(true);
    try {
      await axios.post(
        `${API_URL}/estimates/public/claim/${id}`,
        { guest_token: guestToken },
        getAuthHeader()
      );
      toast.success('Estimate linked to your account');
      // Redirect to the authenticated detail page
      navigate(`/estimates/${id}`, { replace: true });
    } catch (err) {
      // If already claimed, still navigate
      if (err.response?.status === 404) {
        navigate(`/estimates/${id}`, { replace: true });
      } else {
        toast.error('Failed to link estimate to your account');
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleDrivingModeChange = async (mode) => {
    if (mode === drivingMode || reanalyzing) return;
    setDrivingMode(mode);
    setReanalyzing(true);
    try {
      const scheduleCode = mode === 'severe' ? 'SCHEDULE_2' : 'SCHEDULE_1';
      const res = await axios.post(
        `${API_URL}/estimates/public/results/${id}/reanalyze?guest_token=${guestToken}`,
        { schedule_code: scheduleCode }
      );
      setData(res.data);
      toast.success(mode === 'severe' ? 'Updated for severe driving conditions' : 'Updated for normal driving');
    } catch {
      toast.error('Failed to update analysis');
      setDrivingMode(drivingMode === 'severe' ? 'normal' : 'severe');
    } finally {
      setReanalyzing(false);
    }
  };

  const toggleItem = (itemId) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const selectAll = () => {
    const convertable = (data?.items || []).filter(i => !i.converted_to_service);
    setSelectedItems(prev => prev.size === convertable.length ? new Set() : new Set(convertable.map(i => i.id)));
  };

  const handleConvertClick = () => {
    if (selectedItems.size === 0) { toast.error('Select at least one item'); return; }
    if (user) {
      // User is logged in - claim and redirect to authenticated page
      claimEstimate();
    } else {
      // Not logged in - redirect to login with return info
      const returnUrl = `/estimate-checker/${id}?guest_token=${guestToken}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
      toast.info('Sign in to save these as service records');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const { estimate, items, summary } = data;
  const distUnit = estimate.distance_unit || (estimate.region_code === 'US' ? 'mi' : 'km');
  const isUS = estimate.region_code === 'US';
  const recConfig = (rec) => RECOMMENDATION_CONFIG[rec] || RECOMMENDATION_CONFIG.cannot_determine;
  const catConfig = (cat) => CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.unknown;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-heading font-bold text-lg tracking-tight">ServiceCheck</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="font-heading font-semibold text-xs uppercase tracking-wider" data-testid="result-nav-dashboard">
                Dashboard
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate('/login')} className="rounded-sm font-heading font-bold text-xs uppercase tracking-wider" data-testid="result-nav-login">
                <LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8" data-testid="public-estimate-result-page">
        {/* Back + Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/estimate-checker')} className="-ml-2 mb-3 text-muted-foreground" data-testid="back-to-checker-btn">
            <ArrowLeft className="mr-1 h-4 w-4" /> New Estimate
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">
                {estimate.provider || 'Repair Estimate'}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                <span>{estimate.vehicle_info}</span>
                {estimate.estimate_date && <span>{new Date(estimate.estimate_date).toLocaleDateString()}</span>}
                {estimate.region_code && (
                  <Badge variant="outline" className="text-[10px] rounded-sm">
                    <Globe className="h-3 w-3 mr-1" />{isUS ? 'United States' : 'Canada'}
                  </Badge>
                )}
                {estimate.current_mileage && (
                  <Badge variant="outline" className="text-[10px] rounded-sm">
                    <Gauge className="h-3 w-3 mr-1" />{estimate.current_mileage.toLocaleString()} {distUnit}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Quoted</p>
              <p className="text-3xl font-heading font-bold font-mono" data-testid="public-estimate-total">
                ${(estimate.total_quoted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Detected Region Banner */}
        {estimate.detected_region && estimate.detected_region !== estimate.region_code && (
          <Card className="rounded-sm border-amber-500/30 bg-amber-500/5 mb-6">
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
          <Card className="rounded-sm border-border mb-6">
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Driving Conditions</span>
                {reanalyzing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
              <div className="flex gap-2" data-testid="public-driving-conditions-toggle">
                <Button variant={drivingMode === 'normal' ? 'default' : 'outline'} size="sm" className="rounded-sm text-xs" onClick={() => handleDrivingModeChange('normal')} disabled={reanalyzing} data-testid="public-driving-normal">
                  Normal driving
                </Button>
                <Button variant={drivingMode === 'severe' ? 'default' : 'outline'} size="sm" className="rounded-sm text-xs" onClick={() => handleDrivingModeChange('severe')} disabled={reanalyzing} data-testid="public-driving-severe">
                  Short trips / extreme conditions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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
        <Card className="rounded-sm border-primary/20 bg-primary/5 mb-6">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Save as Service Records</p>
                <p className="text-xs text-muted-foreground">
                  {user ? `${selectedItems.size} item(s) selected` : 'Sign in to save these to your garage'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-sm" onClick={selectAll} data-testid="public-select-all-btn">
                {selectedItems.size === items.filter(i => !i.converted_to_service).length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                size="sm"
                className="rounded-sm font-heading font-bold uppercase tracking-wider"
                onClick={handleConvertClick}
                disabled={claiming || selectedItems.size === 0}
                data-testid="public-convert-btn"
              >
                {claiming ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Linking...</>
                ) : user ? (
                  'Save to Garage'
                ) : (
                  <><LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign In to Save</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

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
                <Card className={`rounded-sm border-border transition-colors ${item.converted_to_service ? 'opacity-60' : ''}`} data-testid={`public-item-${item.id}`}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                      {!item.converted_to_service && (
                        <Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItem(item.id)} onClick={(e) => e.stopPropagation()} className="shrink-0" />
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

        {/* Sign-in CTA Banner (guests only) */}
        {!user && (
          <Card className="rounded-sm border-border mt-8 bg-card">
            <CardContent className="p-6 text-center">
              <h3 className="font-heading font-bold text-lg mb-2">Want to track your services?</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                Create a free account to save this estimate, convert items to service records, and track maintenance across all your vehicles.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button onClick={() => navigate(`/register?returnTo=${encodeURIComponent(`/estimate-checker/${id}?guest_token=${guestToken}`)}`)} className="rounded-sm font-heading font-bold uppercase tracking-wider" data-testid="public-result-register-btn">
                  Create Free Account
                </Button>
                <Button variant="outline" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(`/estimate-checker/${id}?guest_token=${guestToken}`)}`)} className="rounded-sm" data-testid="public-result-login-btn">
                  Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PublicEstimateResultPage;
