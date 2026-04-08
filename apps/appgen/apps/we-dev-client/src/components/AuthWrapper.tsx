import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '../api/persistence/db';
import { Loading } from './loading';
import { redirectToLogin } from '../hooks/useAuth';

interface AuthWrapperProps {
  children: React.ReactNode;
  intent?: string;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children, intent }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const user = await getCurrentUser();
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated === false) {
      redirectToLogin(intent);
    }
  }, [isAuthenticated, intent]);

  if (isLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default AuthWrapper;
