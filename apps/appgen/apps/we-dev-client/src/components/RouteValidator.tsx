import React, { useEffect, useState } from 'react';
import { parseDataFromUrl } from '../utils/parseDataFromUrl';

interface RouteValidatorProps {
  children: React.ReactNode;
}

const RouteValidator: React.FC<RouteValidatorProps> = ({ children }) => {
  const [isValidRoute, setIsValidRoute] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateRoute = () => {
      try {
        const { projectId } = parseDataFromUrl();
        
        // Check if projectId exists in URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const projectIdFromUrl = urlParams.get('projectId') || projectId;
        
        if (!projectIdFromUrl) {
          console.warn('No projectId found in URL. Redirecting to login.');
          // window.location.href = 'http://localhost:4200/login';
          return;
        }
        
        setIsValidRoute(true);
      } catch (error) {
        console.error('Route validation failed:', error);
        // window.location.href = 'http://localhost:4200/login';
      } finally {
        setIsLoading(false);
      }
    };

    validateRoute();
  }, []);

  if (isLoading) {
    return <div>Validating route...</div>;
  }

  if (!isValidRoute) {
    return null; // Will redirect, so don't render anything
  }

  return <>{children}</>;
};

export default RouteValidator;
