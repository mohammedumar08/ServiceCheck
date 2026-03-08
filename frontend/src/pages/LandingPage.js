import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Wrench, Bell, FileText, ChevronRight, Shield, Camera } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: Camera,
      title: 'AI-Powered OCR',
      description: 'Upload service receipts and let AI extract all the details automatically.'
    },
    {
      icon: Car,
      title: 'Multi-Vehicle Support',
      description: 'Track service records for your entire fleet in one place.'
    },
    {
      icon: Bell,
      title: 'Smart Reminders',
      description: 'Never miss a service appointment with intelligent notifications.'
    },
    {
      icon: FileText,
      title: 'Export Reports',
      description: 'Download your service history as CSV or PDF anytime.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Wrench className="h-6 w-6 text-primary" />
              <span className="font-heading font-bold text-xl tracking-tight">ServiceTrack</span>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Button 
                  data-testid="nav-dashboard-btn"
                  onClick={() => navigate('/dashboard')}
                  className="rounded-sm font-heading font-bold uppercase tracking-wider"
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Link to="/login">
                    <Button 
                      data-testid="nav-login-btn"
                      variant="ghost" 
                      className="font-heading font-semibold uppercase tracking-wider"
                    >
                      Login
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button 
                      data-testid="nav-register-btn"
                      className="rounded-sm font-heading font-bold uppercase tracking-wider"
                    >
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 grid-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div 
              className="lg:col-span-7"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-primary/10 text-primary text-sm font-mono mb-6">
                <Shield className="h-4 w-4" />
                <span>Trusted by 10,000+ car owners</span>
              </div>
              <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-7xl tracking-tight leading-none mb-6">
                Your Vehicle's<br />
                <span className="text-primary">Service History</span><br />
                In One Place
              </h1>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl mb-8">
                Track every oil change, tire rotation, and repair. Upload receipts with AI-powered extraction or enter records manually. Stay on top of maintenance with smart reminders.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  data-testid="hero-get-started-btn"
                  size="lg"
                  onClick={() => navigate(user ? '/dashboard' : '/register')}
                  className="rounded-sm font-heading font-bold uppercase tracking-wider text-base px-8"
                >
                  Start Tracking
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  data-testid="hero-learn-more-btn"
                  size="lg"
                  variant="outline"
                  className="rounded-sm font-heading font-bold uppercase tracking-wider text-base px-8"
                >
                  Learn More
                </Button>
              </div>
            </motion.div>
            <motion.div 
              className="lg:col-span-5 relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative rounded-sm overflow-hidden border border-border shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1758411897888-3ca658535fdf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA0MTJ8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBjYXIlMjBpbnRlcmlvciUyMGRhc2hib2FyZHxlbnwwfHx8fDE3NzMwMDIzODB8MA&ixlib=rb-4.1.0&q=85&w=800"
                  alt="Modern car dashboard"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              Powerful features to keep your vehicles running smoothly
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-sm border border-border bg-background hover:border-primary/50 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="relative rounded-sm border border-border bg-card p-8 md:p-12 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative z-10 max-w-2xl">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight mb-4">
                Ready to Take Control?
              </h2>
              <p className="text-muted-foreground text-base md:text-lg mb-8">
                Join thousands of car owners who trust ServiceTrack to manage their vehicle maintenance.
              </p>
              <Button 
                data-testid="cta-get-started-btn"
                size="lg"
                onClick={() => navigate(user ? '/dashboard' : '/register')}
                className="rounded-sm font-heading font-bold uppercase tracking-wider"
              >
                Get Started Free
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <span className="font-heading font-bold text-lg">ServiceTrack</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2025 ServiceTrack. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
