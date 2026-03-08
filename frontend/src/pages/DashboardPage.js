import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, Wrench, DollarSign, Bell, Plus, ChevronRight, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

  const statCards = [
    {
      title: 'Total Vehicles',
      value: stats?.total_vehicles || 0,
      icon: Car,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Total Services',
      value: stats?.total_services || 0,
      icon: Wrench,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'Total Spent',
      value: `$${(stats?.total_spent || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Upcoming Reminders',
      value: stats?.upcoming_reminders || 0,
      icon: Bell,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    }
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
      <div data-testid="dashboard-page" className="space-y-8">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="rounded-sm border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                      <p className="text-2xl font-heading font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-sm ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vehicles */}
          <Card className="lg:col-span-2 rounded-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="font-heading font-bold text-lg">Your Vehicles</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/vehicles')}
                className="text-muted-foreground hover:text-foreground"
                data-testid="view-all-vehicles-btn"
              >
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
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
                          <p className="text-sm text-muted-foreground font-mono">
                            {vehicle.current_odometer?.toLocaleString() || 0} km
                          </p>
                        </div>
                      </div>
                      {vehicle.license_plate && (
                        <span className="text-xs font-mono bg-secondary/50 px-2 py-1 rounded-sm">
                          {vehicle.license_plate}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Car className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">No vehicles added yet</p>
                  <Button 
                    onClick={() => navigate('/vehicles')}
                    className="rounded-sm font-heading font-bold uppercase tracking-wider"
                    data-testid="empty-add-vehicle-btn"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Vehicle
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Reminders */}
          <Card className="rounded-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="font-heading font-bold text-lg">Upcoming</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/reminders')}
                className="text-muted-foreground hover:text-foreground"
                data-testid="view-all-reminders-btn"
              >
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {stats?.reminders?.length > 0 ? (
                <div className="space-y-3">
                  {stats.reminders.map((reminder) => (
                    <div 
                      key={reminder.id}
                      className="p-3 rounded-sm border border-border bg-muted/30"
                      data-testid={`reminder-card-${reminder.id}`}
                    >
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
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/services')}
              className="text-muted-foreground hover:text-foreground"
              data-testid="view-all-services-btn"
            >
              View All
              <ChevronRight className="ml-1 h-4 w-4" />
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
                      <tr 
                        key={service.id} 
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate('/services')}
                        data-testid={`service-row-${service.id}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-sm bg-primary/10">
                              <Wrench className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="font-medium">{service.service_type}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(service.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm">
                          {service.odometer?.toLocaleString()} km
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-500">
                          ${service.price?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">No service records yet</p>
                <Button 
                  onClick={() => navigate('/services')}
                  className="rounded-sm font-heading font-bold uppercase tracking-wider"
                  data-testid="empty-add-service-btn"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service Record
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
