import { useState } from 'react';
import { Search, Loader2, ArrowRight, ChevronDown, ChevronUp, Globe, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MatchDebugPage = () => {
  const [inputText, setInputText] = useState('');
  const [regionCode, setRegionCode] = useState('CA');
  const [scheduleCode, setScheduleCode] = useState('SCHEDULE_1');
  const [currentMileage, setCurrentMileage] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const { getAuthHeader } = useAuth();

  const handleTest = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        input_line_text: inputText.trim(),
        region_code: regionCode,
        schedule_code: scheduleCode,
      };
      if (currentMileage) payload.current_mileage = parseInt(currentMileage);
      const res = await axios.post(
        `${API_URL}/estimates/debug/match`,
        payload,
        getAuthHeader()
      );
      setResult(res.data);
    } catch (err) {
      setResult({ error: err.response?.data?.detail || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  const catColor = (cat) => ({
    required: 'text-emerald-400', conditional: 'text-amber-400',
    not_required: 'text-blue-400', informational: 'text-zinc-400', unknown: 'text-red-400',
  }[cat] || 'text-zinc-400');

  const recColor = (code) => ({
    recommended_now: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    maybe_needed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    likely_optional: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    cannot_determine: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  }[code] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30');

  return (
    <DashboardLayout>
      <div data-testid="match-debug-page" className="space-y-6 max-w-3xl">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">Match Debugger</h1>
          <p className="text-muted-foreground mt-1">Paste a dealer estimate line to see how the matching pipeline processes it.</p>
        </div>

        <Card className="rounded-sm border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                data-testid="debug-input"
                placeholder="e.g. FU03 Fuel Injectors - Clean - REC EVERY16MTH/32K"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                className="rounded-sm font-mono text-sm"
                disabled={loading}
              />
              <Button
                data-testid="debug-submit-btn"
                onClick={handleTest}
                disabled={loading || !inputText.trim()}
                className="rounded-sm shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={regionCode} onValueChange={(v) => { setRegionCode(v); if (v !== 'US') setScheduleCode('SCHEDULE_1'); }}>
                <SelectTrigger data-testid="debug-region-select" className="rounded-sm w-40">
                  <Globe className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>
              {regionCode === 'US' && (
                <Select value={scheduleCode} onValueChange={setScheduleCode}>
                  <SelectTrigger data-testid="debug-schedule-select" className="rounded-sm w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULE_1">Schedule 1 - Normal</SelectItem>
                    <SelectItem value="SCHEDULE_2">Schedule 2 - Severe</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  data-testid="debug-mileage-input"
                  type="number"
                  placeholder={regionCode === 'US' ? 'Mileage (mi)' : 'Odometer (km)'}
                  value={currentMileage}
                  onChange={(e) => setCurrentMileage(e.target.value)}
                  className="rounded-sm w-36 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {result?.error && (
          <Card className="rounded-sm border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-red-400 text-sm">{result.error}</CardContent>
          </Card>
        )}

        {result && !result.error && (
          <div className="space-y-4">
            {/* Pipeline Steps */}
            <Card className="rounded-sm border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading">Pipeline Steps</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <Step num="1" label="Input" value={result.input_line_text} />
                <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                <Step num="2" label="Normalized" value={result.normalized_text} mono />
                <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                <Step num="3" label="Matched Synonym" value={result.match.matched_synonym || '(none)'} />
                <div className="flex items-center gap-3 pl-8">
                  <span className="text-xs text-muted-foreground">Strategy:</span>
                  <Badge variant="outline" className="text-[10px] rounded-sm capitalize">{result.match.match_strategy.replace('_', ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">Confidence:</span>
                  <span className="text-xs font-mono">{(result.match.confidence * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Result */}
            <Card className="rounded-sm border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading">Classification Result</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="service_key" value={result.match.service_key || 'null'} mono muted={!result.match.service_key} />
                  <Field label="display_name" value={result.classification.display_name || 'null'} muted={!result.classification.display_name} />
                  <Field label="category" value={result.classification.category}>
                    <span className={`font-medium capitalize ${catColor(result.classification.category)}`}>
                      {result.classification.category}
                    </span>
                  </Field>
                  <Field label="severity" value={result.classification.severity}>
                    <span className="font-medium capitalize">{result.classification.severity}</span>
                  </Field>
                  <Field label="default_recommendation_code" value={result.classification.default_recommendation_code}>
                    <Badge variant="outline" className={`text-[10px] rounded-sm ${recColor(result.classification.default_recommendation_code)}`}>
                      {result.classification.default_recommendation_code}
                    </Badge>
                  </Field>
                </div>
                <div className="mt-4 space-y-3">
                  <Field label="recommendation_text" value={result.classification.recommendation_text || 'null'} block />
                  <Field label="user_explanation" value={result.classification.user_explanation || 'null'} block />
                  {result.classification.description && (
                    <Field label="description" value={result.classification.description} block />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Verdict & Schedule */}
            {result.verdict && (
              <Card className="rounded-sm border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    Verdict
                    <Badge variant="outline" className="text-[10px] rounded-sm">
                      <Globe className="h-3 w-3 mr-0.5" />{result.region_code}
                    </Badge>
                    {result.schedule_code && result.region_code === 'US' && (
                      <Badge variant="outline" className="text-[10px] rounded-sm">{result.schedule_code}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="due_status" value={result.verdict.due_status}>
                      <Badge variant="outline" className={`text-[10px] rounded-sm ${
                        result.verdict.due_status === 'due_now' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                        result.verdict.due_status === 'due_soon' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                        result.verdict.due_status === 'not_due' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                        result.verdict.due_status === 'condition_based' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                        'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                      }`}>{result.verdict.due_status?.replace(/_/g, ' ')}</Badge>
                    </Field>
                    <Field label="schedule_used" value={result.verdict.schedule_used || 'N/A'} mono />
                    <Field label="interval" value={result.verdict.interval_value != null ? `${result.verdict.interval_value?.toLocaleString()} ${result.distance_unit}` : 'N/A'} mono />
                    {result.verdict.miles_remaining != null && (
                      <Field label="remaining" value={`${result.verdict.miles_remaining?.toLocaleString()} ${result.distance_unit}`} mono />
                    )}
                    {result.verdict.trigger_type && (
                      <Field label="trigger" value={result.verdict.trigger_type} mono />
                    )}
                    {result.verdict.severe_only && (
                      <Field label="severe_only" value="true">
                        <Badge variant="outline" className="text-[10px] rounded-sm bg-red-500/15 text-red-400">severe only</Badge>
                      </Field>
                    )}
                  </div>
                  {result.verdict.schedule_notes && (
                    <div className="mt-3">
                      <Field label="schedule_notes" value={result.verdict.schedule_notes} block />
                    </div>
                  )}
                  {result.verdict.source_reference && (
                    <div className="mt-2">
                      <Field label="source" value={result.verdict.source_reference} block />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Rule Trace */}
            {result.rule_trace && (
              <Card className="rounded-sm border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading">Rule Trace</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="rules_found" value={result.rule_trace.rules_found} mono />
                    <Field label="rule_selected" value={result.rule_trace.rule_selected || 'none'} mono />
                    <Field label="engine_filter" value={result.rule_trace.engine_filter || 'none'} mono />
                    <Field label="engine_matched" value={result.rule_trace.engine_matched || 'none'} mono />
                    <Field label="schedule_code" value={result.rule_trace.schedule_code || 'N/A'} mono />
                    <Field label="mileage_provided" value={result.rule_trace.mileage_provided ? 'yes' : 'no'} mono />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Raw JSON toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
              onClick={() => setShowRaw(!showRaw)}
            >
              {showRaw ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              Raw JSON
            </Button>
            {showRaw && (
              <pre className="bg-muted/50 rounded-sm p-4 text-xs font-mono overflow-x-auto text-muted-foreground max-h-80">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

const Step = ({ num, label, value, mono }) => (
  <div className="flex items-start gap-3">
    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{num}</span>
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm mt-0.5 ${mono ? 'font-mono text-muted-foreground' : ''}`}>{value}</p>
    </div>
  </div>
);

const Field = ({ label, value, mono, muted, block, children }) => (
  <div className={block ? '' : ''}>
    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</p>
    {children || (
      <p className={`text-sm mt-0.5 ${mono ? 'font-mono' : ''} ${muted ? 'text-muted-foreground italic' : ''}`}>{value}</p>
    )}
  </div>
);

export default MatchDebugPage;
