import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileSearch, CheckCircle2, AlertTriangle, HelpCircle, XCircle,
  DollarSign, Wrench, ChevronDown, ChevronUp, ArrowRightLeft, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RECOMMENDATION_CONFIG = {
  required: { label: 'Required', icon: ShieldAlert, color: 'bg-red-500/15 text-red-400 border-red-500/30', dotColor: 'bg-red-500' },
  recommended: { label: 'Recommended', icon: ShieldCheck, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dotColor: 'bg-amber-500' },
  conditional: { label: 'Conditional', icon: ShieldQuestion, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dotColor: 'bg-amber-500' },
  optional: { label: 'Optional', icon: HelpCircle, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dotColor: 'bg-blue-500' },
  not_required: { label: 'Not Required', icon: XCircle, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-500' },
  cannot_determine: { label: 'Unknown', icon: HelpCircle, color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', dotColor: 'bg-zinc-500' },
};

const CATEGORY_CONFIG = {
  safety: { label: 'Safety', color: 'text-red-400' },
  essential: { label: 'Essential', color: 'text-amber-400' },
  preventive: { label: 'Preventive', color: 'text-blue-400' },
  comfort: { label: 'Comfort', color: 'text-purple-400' },
  cosmetic: { label: 'Cosmetic', color: 'text-teal-400' },
  diagnostic: { label: 'Diagnostic', color: 'text-cyan-400' },
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

  useEffect(() => {
    fetchEstimate();
  }, [id]);

  const fetchEstimate = async () => {
    try {
      const res = await axios.get(`${API_URL}/estimates/${id}`, getAuthHeader());
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load estimate');
      navigate('/estimates');
    } finally {
      setLoading(false);
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
    if (selectedItems.size === convertable.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(convertable.map((i) => i.id)));
    }
  };

  const handleConvert = async () => {
    if (selectedItems.size === 0) {
      toast.error('Select at least one item');
      return;
    }
    setConverting(true);
    try {
      await axios.post(
        `${API_URL}/estimates/${id}/convert`,
        { item_ids: Array.from(selectedItems) },
        getAuthHeader()
      );
      toast.success(`${selectedItems.size} item(s) converted to service records`);
      setSelectedItems(new Set());
      fetchEstimate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to convert items');
    } finally {
      setConverting(false);
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

  if (!data) return null;

  const { estimate, items, summary } = data;
  const recConfig = (rec) => RECOMMENDATION_CONFIG[rec] || RECOMMENDATION_CONFIG.cannot_determine;
  const catConfig = (cat) => CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.unknown;

  return (
    <DashboardLayout>
      <div data-testid="estimate-detail-page" className="space-y-6">
        {/* Back Button + Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/estimates')}
            className="mb-3 -ml-2 text-muted-foreground"
            data-testid="back-to-estimates-btn"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Estimates
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Required', count: summary.required_count, amount: summary.required_total, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Conditional', count: summary.conditional_count, amount: summary.conditional_total, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Not Required', count: summary.not_required_count, amount: summary.not_required_total, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Total Items', count: summary.total_items, amount: summary.total_quoted_amount, color: 'text-primary', bg: 'bg-primary/10' },
          ].map((card, idx) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
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
                  <p className="text-xs text-muted-foreground">
                    {selectedItems.size} item(s) selected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-sm"
                  onClick={selectAll}
                  data-testid="select-all-items-btn"
                >
                  {selectedItems.size === items.filter((i) => !i.converted_to_service).length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  size="sm"
                  className="rounded-sm font-heading font-bold uppercase tracking-wider"
                  onClick={handleConvert}
                  disabled={converting || selectedItems.size === 0}
                  data-testid="convert-items-btn"
                >
                  {converting ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Converting...</>
                  ) : (
                    'Convert Selected'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items List */}
        <div className="space-y-2">
          <h2 className="font-heading font-bold text-lg">Line Items</h2>
          {items.map((item, idx) => {
            const rec = recConfig(item.recommendation);
            const cat = catConfig(item.category);
            const isExpanded = expandedItem === item.id;
            const RecIcon = rec.icon;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card
                  className={`rounded-sm border-border transition-colors ${item.converted_to_service ? 'opacity-60' : ''}`}
                  data-testid={`estimate-item-${item.id}`}
                >
                  <CardContent className="p-0">
                    {/* Main Row */}
                    <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                      {!item.converted_to_service && (
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => toggleItem(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-item-${item.id}`}
                          className="shrink-0"
                        />
                      )}
                      {item.converted_to_service && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{item.display_name || item.raw_text}</span>
                          <Badge variant="outline" className={`text-[10px] rounded-sm px-1.5 py-0 ${rec.color}`}>
                            <RecIcon className="h-3 w-3 mr-0.5" />
                            {rec.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] rounded-sm px-1.5 py-0 ${cat.color}`}>
                            {cat.label}
                          </Badge>
                        </div>
                        {item.raw_text !== item.display_name && item.display_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">Original: {item.raw_text}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold">
                          ${(item.quoted_price || 0).toFixed(2)}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Matched Service</p>
                              <p className="text-sm font-medium mt-0.5">{item.service_key?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unmatched'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Match Confidence</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden max-w-32">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${(item.match_confidence || 0) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono">{((item.match_confidence || 0) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            {item.notes && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
                                <p className="text-sm mt-0.5">{item.notes}</p>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Severity</p>
                              <p className="text-sm font-medium mt-0.5 capitalize">{item.severity || 'N/A'}</p>
                            </div>
                            {item.interval_km && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Service Interval</p>
                                <p className="text-sm font-mono mt-0.5">{item.interval_km.toLocaleString()} km</p>
                              </div>
                            )}
                            {item.explanation && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Recommendation</p>
                                <p className="text-sm mt-0.5">{item.explanation}</p>
                              </div>
                            )}
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
      </div>
    </DashboardLayout>
  );
};

export default EstimateDetailPage;
