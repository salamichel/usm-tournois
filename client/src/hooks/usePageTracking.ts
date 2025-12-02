import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '@services/analytics.service';

/**
 * Custom hook to track page views with Google Analytics
 * Automatically tracks page changes when the location changes
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view whenever the location changes
    analyticsService.trackPageView(location.pathname + location.search);
  }, [location]);
};
