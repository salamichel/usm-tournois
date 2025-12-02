import ReactGA from 'react-ga4';

class AnalyticsService {
  private initialized = false;

  /**
   * Initialize Google Analytics with the provided measurement ID
   */
  initialize(): void {
    const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;

    if (!measurementId) {
      console.warn('Google Analytics Measurement ID not found. Analytics will not be tracked.');
      return;
    }

    if (this.initialized) {
      return;
    }

    try {
      ReactGA.initialize(measurementId, {
        gaOptions: {
          anonymizeIp: true, // Anonymize IP addresses for privacy
        },
      });
      this.initialized = true;
      console.log('Google Analytics initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Analytics:', error);
    }
  }

  /**
   * Track a page view
   */
  trackPageView(path: string, title?: string): void {
    if (!this.initialized) {
      return;
    }

    try {
      ReactGA.send({
        hitType: 'pageview',
        page: path,
        title: title || document.title,
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }

  /**
   * Track a custom event
   */
  trackEvent(category: string, action: string, label?: string, value?: number): void {
    if (!this.initialized) {
      return;
    }

    try {
      ReactGA.event({
        category,
        action,
        label,
        value,
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Track user interactions
   */
  trackUserInteraction(action: string, label?: string): void {
    this.trackEvent('User Interaction', action, label);
  }

  /**
   * Track tournament interactions
   */
  trackTournamentEvent(action: string, tournamentId?: string): void {
    this.trackEvent('Tournament', action, tournamentId);
  }

  /**
   * Track authentication events
   */
  trackAuthEvent(action: string): void {
    this.trackEvent('Authentication', action);
  }
}

// Export a singleton instance
export const analyticsService = new AnalyticsService();
