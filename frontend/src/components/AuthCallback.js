import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AuthCallback = () => {
  const { handleGoogleCallback } = useAuth();
  const hasProcessed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        // Extract session_id from URL hash
        const hash = window.location.hash;
        console.log('Processing OAuth callback, hash:', hash);
        
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          setError('Invalid authentication response - no session_id found');
          toast.error('Authentication failed - invalid response');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }

        const sessionId = sessionIdMatch[1];
        console.log('Session ID found:', sessionId.substring(0, 20) + '...');
        
        // Exchange session_id for user session
        const user = await handleGoogleCallback(sessionId);
        console.log('User authenticated:', user?.name);
        
        toast.success(`Welcome, ${user.name}!`);
        
        // Use hard redirect to ensure clean state
        window.location.href = '/dashboard';
      } catch (error) {
        console.error('Auth callback error:', error);
        setError(error.response?.data?.detail || 'Authentication failed');
        toast.error('Authentication failed. Please try again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    };

    processCallback();
  }, [handleGoogleCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-destructive text-lg mb-4">Authentication Failed</div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Signing you in...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
