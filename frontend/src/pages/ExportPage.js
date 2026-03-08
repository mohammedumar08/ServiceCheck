import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, FileText, Loader2, Car, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { saveAs } from 'file-saver';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ExportPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const { getAuthHeader, token } = useAuth();

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API_URL}/vehicles`, getAuthHeader());
      setVehicles(response.data);
    } catch (error) {
      toast.error('Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting('csv');
    try {
      const params = selectedVehicle !== 'all' ? `?vehicle_id=${selectedVehicle}` : '';
      const response = await axios.get(`${API_URL}/export/csv${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      saveAs(new Blob([response.data], { type: 'text/csv' }), 'service_records.csv');
      toast.success('CSV downloaded!');
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error('Failed to export CSV');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const params = selectedVehicle !== 'all' ? `?vehicle_id=${selectedVehicle}` : '';
      const response = await axios.get(`${API_URL}/export/pdf${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      saveAs(new Blob([response.data], { type: 'application/pdf' }), 'service_records.pdf');
      toast.success('PDF downloaded!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(null);
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
      <div data-testid="export-page" className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">Export Data</h1>
          <p className="text-muted-foreground mt-1">Download your service records</p>
        </div>

        {/* Filter */}
        <Card className="rounded-sm border-border">
          <CardHeader>
            <CardTitle className="font-heading font-bold text-lg">Export Options</CardTitle>
            <CardDescription>Select which data to export</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vehicle Filter</Label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger className="w-full sm:w-80 rounded-sm" data-testid="export-vehicle-filter">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        All Vehicles
                      </div>
                    </SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="rounded-sm border-border hover:border-primary/50 transition-colors h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-sm bg-emerald-500/10">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="font-heading font-bold text-lg">CSV Export</CardTitle>
                    <CardDescription>Spreadsheet-compatible format</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Export your service records as a CSV file. Perfect for importing into Excel, Google Sheets, or any spreadsheet application.
                </p>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Compatible with Excel & Google Sheets
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Easy to analyze and chart
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Includes all service details
                  </li>
                </ul>
                <Button
                  onClick={handleExportCSV}
                  className="w-full rounded-sm font-heading font-bold uppercase tracking-wider"
                  disabled={exporting !== null}
                  data-testid="export-csv-btn"
                >
                  {exporting === 'csv' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="rounded-sm border-border hover:border-primary/50 transition-colors h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-sm bg-red-500/10">
                    <FileText className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <CardTitle className="font-heading font-bold text-lg">PDF Export</CardTitle>
                    <CardDescription>Formatted report document</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate a professional PDF report of your service history. Perfect for printing or sharing.
                </p>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-500" />
                    Professional formatted report
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-500" />
                    Ready to print or share
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-500" />
                    Includes summary statistics
                  </li>
                </ul>
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="w-full rounded-sm font-heading font-bold uppercase tracking-wider"
                  disabled={exporting !== null}
                  data-testid="export-pdf-btn"
                >
                  {exporting === 'pdf' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Info Card */}
        <Card className="rounded-sm border-border bg-muted/30">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Your exported data includes all service records with dates, costs, odometer readings, and locations.
              {selectedVehicle !== 'all' && ' Filtered by selected vehicle.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExportPage;
