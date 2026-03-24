import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, Wrench, DollarSign, Bell, Plus, ChevronRight, Calendar, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-sm px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono font-bold text-sm">${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
    </div>
  );
};

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/stats/dashboard`, getAuthHeader());
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthlyHasData = stats?.monthly_expenses?.some(m => m.amount > 0);
  const maxMonthly = Math.max(...(stats?.monthly_expenses?.map(m => m.amount) || [0]));
  const currentMonth = new Date().toLocaleString('default', { month: 'short' });

  const monthChange = stats?.previous_month_spent > 0
    ? ((stats.current_month_spent - stats.previous_month_spent) / stats.previous_month_spent * 100).toFixed(0)
    : null;

  const statCards = [
    { title: 'Total Vehicles', value: stats?.total_vehicles || 0, icon: Car, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { title: 'Total Services', value: stats?.total_services || 0, icon: Wrench, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Total Spent', value: `$${(stats?.total_spent || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { title: 'Upcoming Reminders', value: stats?.upcoming_reminders || 0, icon: Bell, color: 'text-amber-500', bgColor: 'bg-amber-500/10' }
  ];

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
      <div data-testid="dashboard-page" className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your vehicle service history</p>
          </div>
          <Button
            data-testid="add-vehicle-btn"
            onClick={() => navigate('/vehicles')}
            className="rounded-sm font-heading font-bold uppercase tracking-wider"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Card className="rounded-sm border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium">{stat.title}</p>
                      <p className="text-xl lg:text-2xl font-heading font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 lg:p-3 rounded-sm ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 lg:h-5 lg:w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Expense Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly Expenses Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2"
          >
            <Card className="rounded-sm border-border h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="font-heading font-bold text-lg">Monthly Expenses</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date().getFullYear()}</p>
                </div>
                {monthChange !== null && (
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-mono font-bold ${
                    Number(monthChange) > 0 ? 'bg-red-500/10 text-red-400' : Number(monthChange) < 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
                  }`} data-testid="month-change-badge">
                    {Number(monthChange) > 0 ? <ArrowUpRight className="h-3 w-3" /> : Number(monthChange) < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {Math.abs(Number(monthChange))}% vs last month
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-2">
                {monthlyHasData ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.monthly_expenses} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.monthly_expenses.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.month === currentMonth ? '#ef4444' : entry.amount > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.05)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                    <DollarSign className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No expenses this year</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* This Month + Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="rounded-sm border-border h-full">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading font-bold text-lg">Spending Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* This Month Highlight */}
                <div className="p-4 rounded-sm bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">This Month</p>
                  <p className="text-3xl font-heading font-bold mt-1 font-mono" data-testid="current-month-spent">
                    ${(stats?.current_month_spent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  {monthChange !== null && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs">
                      {Number(monthChange) > 0 ? (
                        <><TrendingUp className="h-3 w-3 text-red-400" /><span className="text-red-400">{monthChange}% more than last month</span></>
                      ) : Number(monthChange) < 0 ? (
                        <><TrendingDown className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">{Math.abs(Number(monthChange))}% less than last month</span></>
                      ) : (
                        <span className="text-muted-foreground">Same as last month</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Top Categories */}
                {stats?.top_categories?.length > 0 ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Top Categories</p>
                    {stats.top_categories.map((cat, i) => {
                      const maxCat = stats.top_categories[0].amount;
                      const pct = maxCat > 0 ? (cat.amount / maxCat) * 100 : 0;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[140px]">{cat.name}</span>
                            <span className="font-mono font-bold text-muted-foreground">${cat.amount.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Yearly Expenses */}
        {stats?.yearly_expenses?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="rounded-sm border-border">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading font-bold text-lg">Year-over-Year</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 h-32">
                  {stats.yearly_expenses.map((yr, i) => {
                    const maxYearly = Math.max(...stats.yearly_expenses.map(y => y.amount));
                    const heightPct = maxYearly > 0 ? (yr.amount / maxYearly) * 100 : 0;
                    const isCurrentYear = yr.year === String(new Date().getFullYear());
                    return (
                      <div key={yr.year} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <span className="text-xs font-mono font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          ${yr.amount.toLocaleString()}
                        </span>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPct, 4)}%` }}
                          transition={{ delay: 0.6 + i * 0.15, duration: 0.6, ease: "easeOut" }}
                          className={`w-full max-w-16 rounded-t-sm ${isCurrentYear ? 'bg-primary' : 'bg-primary/30'}`}
                        />
                        <span className={`text-xs font-mono ${isCurrentYear ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                          {yr.year}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Vehicles */}
          <Card className="lg:col-span-2 rounded-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="font-heading font-bold text-lg">Your Vehicles</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/vehicles')} className="text-muted-foreground hover:text-foreground" data-testid="view-all-vehicles-btn">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {stats?.vehicles?.length > 0 ? (
                <div className="space-y-3">
                  {stats.vehicles.slice(0, 3).map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="flex items-center justify-between p-4 rounded-sm border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/vehicles')}
                      data-testid={`vehicle-card-${vehicle.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-sm bg-primary/10">
                          <Car className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                          <p className="text-sm text-muted-foreground font-mono">{vehicle.current_odometer?.toLocaleString() || 0} km</p>
                        </div>
                      </div>
                      {vehicle.license_plate && (
                        <span className="text-xs font-mono bg-secondary/50 px-2 py-1 rounded-sm">{vehicle.license_plate}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Car className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">No vehicles added yet</p>
                  <Button onClick={() => navigate('/vehicles')} className="rounded-sm font-heading font-bold uppercase tracking-wider" data-testid="empty-add-vehicle-btn">
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Vehicle
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Reminders */}
          <Card className="rounded-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="font-heading font-bold text-lg">Upcoming</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/reminders')} className="text-muted-foreground hover:text-foreground" data-testid="view-all-reminders-btn">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {stats?.reminders?.length > 0 ? (
                <div className="space-y-3">
                  {stats.reminders.map((reminder) => (
                    <div key={reminder.id} className="p-3 rounded-sm border border-border bg-muted/30" data-testid={`reminder-card-${reminder.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-sm bg-amber-500/10">
                          <Bell className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{reminder.service_type}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(reminder.due_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Bell className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No upcoming reminders</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Services */}
        <Card className="rounded-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="font-heading font-bold text-lg">Recent Services</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/services')} className="text-muted-foreground hover:text-foreground" data-testid="view-all-services-btn">
              View All <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recent_services?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-heading font-semibold text-sm text-muted-foreground">Service</th>
                      <th className="text-left py-3 px-4 font-heading font-semibold text-sm text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-heading font-semibold text-sm text-muted-foreground">Odometer</th>
                      <th className="text-right py-3 px-4 font-heading font-semibold text-sm text-muted-foreground">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_services.map((service) => (
                      <tr key={service.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => navigate('/services')} data-testid={`service-row-${service.id}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-sm bg-primary/10">
                              <Wrench className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="font-medium">{service.service_type}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{new Date(service.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-mono text-sm">{service.odometer?.toLocaleString()} km</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-500">${service.price?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">No service records yet</p>
                <Button onClick={() => navigate('/services')} className="rounded-sm font-heading font-bold uppercase tracking-wider" data-testid="empty-add-service-btn">
                  <Plus className="mr-2 h-4 w-4" /> Add Service Record
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
