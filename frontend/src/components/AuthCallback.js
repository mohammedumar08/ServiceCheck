import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { handleGoogleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        // Extract session_id from URL hash
        const hash = window.location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          toast.error('Invalid authentication response');
          navigate('/login');
          return;
        }

        const sessionId = sessionIdMatch[1];
        
        // Exchange session_id for user session
        const user = await handleGoogleCallback(sessionId);
        
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        
        toast.success(`Welcome, ${user.name}!`);
        navigate('/dashboard', { replace: true, state: { user } });
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('Authentication failed. Please try again.');
        navigate('/login');
      }
    };

    processCallback();
  }, [handleGoogleCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
