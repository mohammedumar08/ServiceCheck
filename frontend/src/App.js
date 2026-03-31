import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AuthCallback from "./components/AuthCallback";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import VehiclesPage from "./pages/VehiclesPage";
import ServiceRecordsPage from "./pages/ServiceRecordsPage";
import RemindersPage from "./pages/RemindersPage";
import ExportPage from "./pages/ExportPage";
import EstimatesPage from "./pages/EstimatesPage";
import EstimateDetailPage from "./pages/EstimateDetailPage";
import MatchDebugPage from "./pages/MatchDebugPage";
import "./App.css";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  // If user data passed from AuthCallback, use it
  if (location.state?.user) {
    return children;
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Router component that handles OAuth callback detection
const AppRouter = () => {
  const location = useLocation();
  
  // Check URL fragment for session_id (OAuth callback) - synchronous check before render
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><ServiceRecordsPage /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><RemindersPage /></ProtectedRoute>} />
      <Route path="/export" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
      <Route path="/estimates" element={<ProtectedRoute><EstimatesPage /></ProtectedRoute>} />
      <Route path="/estimates/:id" element={<ProtectedRoute><EstimateDetailPage /></ProtectedRoute>} />
      <Route path="/match-debug" element={<ProtectedRoute><MatchDebugPage /></ProtectedRoute>} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
