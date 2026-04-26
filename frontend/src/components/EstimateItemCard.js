import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, HelpCircle, ChevronDown, ChevronUp,
  ShieldCheck, ShieldQuestion, Clock
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';

const STATUS_CONFIG = {
  recommended_now: { label: 'Recommended', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: ShieldCheck },
  maybe_needed: { label: 'Maybe Needed', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: ShieldQuestion },
  likely_optional: { label: 'Not Required', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: HelpCircle },
  cannot_determine: { label: 'Info', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', icon: HelpCircle },
};

const DUE_STATUS_CONFIG = {
  due_now: { label: 'Overdue', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  due_soon: { label: 'Due Soon', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  not_due: { label: 'Not Due', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  condition_based: { label: 'Condition Based', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
};

const getConfidenceLevel = (confidence) => {
  if (confidence >= 0.8) return { label: 'High Confidence', color: 'text-emerald-400', dot: 'bg-emerald-500' };
  if (confidence >= 0.5) return { label: 'Medium Confidence', color: 'text-amber-400', dot: 'bg-amber-500' };
  return { label: 'Low Confidence', color: 'text-red-400', dot: 'bg-red-500' };
};

const EstimateItemCard = ({ item, idx, distUnit, isSelected, onToggle, isExpanded, onExpand, vehicleStatus, isGuest }) => {
  const status = STATUS_CONFIG[item.default_recommendation_code] || STATUS_CONFIG.cannot_determine;
  const StatusIcon = status.icon;
  const confidence = item.match_confidence || 0;
  const confLevel = getConfidenceLevel(confidence);
  const dueConfig = DUE_STATUS_CONFIG[item.due_status];
  const hasDueStatus = item.due_status && item.due_status !== 'unknown' && item.due_status !== 'schedule_known';
  const hasInterval = item.interval_value || item.interval_km || item.interval_miles;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
      <Card className={`rounded-sm border-border transition-colors ${item.converted_to_service ? 'opacity-60' : ''}`} data-testid={`estimate-item-${item.id}`}>
        <CardContent className="p-0">
          {/* Collapsed Header */}
          <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => onExpand(isExpanded ? null : item.id)}>
            {!item.converted_to_service && (
              <Checkbox checked={isSelected} onCheckedChange={() => onToggle(item.id)} onClick={(e) => e.stopPropagation()} className="shrink-0" />
            )}
            {item.converted_to_service && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{item.display_name || item.raw_text}</span>
                <Badge variant="outline" className={`text-[10px] rounded-sm px-1.5 py-0 ${status.color}`}>
                  <StatusIcon className="h-3 w-3 mr-0.5" />{status.label}
                </Badge>
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

          {/* Expanded Detail */}
          {isExpanded && (
            <div className="px-4 pb-5 pt-0 border-t border-border/50">
              <div className="space-y-4 pt-4">

                {/* Status / Decision */}
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Status / Decision</p>
                  <Badge variant="outline" className={`text-xs rounded-sm px-2 py-0.5 ${status.color}`}>
                    <StatusIcon className="h-3.5 w-3.5 mr-1" />{status.label}
                  </Badge>
                </div>

                {/* Recommendation */}
                {item.recommendation_text && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Recommendation</p>
                    <p className="text-sm font-medium">{item.recommendation_text}</p>
                  </div>
                )}

                {/* Why this matters */}
                {(item.user_explanation || item.description) && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Why this matters</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.user_explanation || item.description}</p>
                  </div>
                )}

                {/* Manufacturer Recommendation */}
                {(hasInterval || item.schedule_notes) && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Manufacturer Recommendation</p>
                    <div className="space-y-0.5">
                      {hasInterval && (
                        <p className="text-sm font-mono">
                          Every {(item.interval_value || item.interval_km || item.interval_miles || 0).toLocaleString()} {item.interval_unit || distUnit}
                        </p>
                      )}
                      {item.schedule_notes && (
                        <p className="text-xs text-muted-foreground">{item.schedule_notes}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Your Vehicle Status */}
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Your Vehicle Status</p>
                  {isGuest ? (
                    <p className="text-sm text-muted-foreground">Sign in to check your service history.</p>
                  ) : vehicleStatus ? (
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs rounded-sm px-2 py-0.5 ${
                          vehicleStatus.status === 'overdue' ? 'bg-red-500/10 border-red-500/30' :
                          vehicleStatus.status === 'due_soon' ? 'bg-amber-500/10 border-amber-500/30' :
                          vehicleStatus.status === 'not_due' ? 'bg-emerald-500/10 border-emerald-500/30' :
                          'bg-zinc-500/10 border-zinc-500/30'
                        }`}>
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          <span className={
                            vehicleStatus.status === 'overdue' ? 'text-red-400' :
                            vehicleStatus.status === 'due_soon' ? 'text-amber-400' :
                            vehicleStatus.status === 'not_due' ? 'text-emerald-400' :
                            'text-zinc-400'
                          }>
                            {vehicleStatus.status === 'overdue' ? 'Overdue' :
                             vehicleStatus.status === 'due_soon' ? 'Due Soon' :
                             vehicleStatus.status === 'not_due' ? 'Not Due' : 'Unknown'}
                          </span>
                        </Badge>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-xs text-muted-foreground">
                          Last serviced: <span className="text-foreground font-medium">
                            {vehicleStatus.last_service_date ? new Date(vehicleStatus.last_service_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                          </span>
                          {vehicleStatus.last_service_odometer ? (
                            <span> at <span className="font-mono font-medium text-foreground">{vehicleStatus.last_service_odometer.toLocaleString()} {distUnit}</span></span>
                          ) : null}
                        </p>
                        {vehicleStatus.months_since != null && (
                          <p className="text-xs text-muted-foreground">
                            {vehicleStatus.months_since} month{vehicleStatus.months_since !== 1 ? 's' : ''} ago
                            {vehicleStatus.distance_since != null && (
                              <span> / {vehicleStatus.distance_since.toLocaleString()} {distUnit} since last service</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : hasDueStatus && dueConfig ? (
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs rounded-sm px-2 py-0.5 ${dueConfig.bg}`}>
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          <span className={dueConfig.color}>{dueConfig.label}</span>
                        </Badge>
                        {item.miles_remaining != null && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {item.miles_remaining.toLocaleString()} {item.interval_unit || distUnit} remaining
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Based on mileage + time</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No service history found for this item.</p>
                  )}
                </div>

                {/* Match Confidence */}
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Match Confidence</p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${confLevel.dot}`}></span>
                    <span className={`text-sm font-medium ${confLevel.color}`}>{confLevel.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">({(confidence * 100).toFixed(0)}%)</span>
                  </div>
                </div>

              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default EstimateItemCard;
