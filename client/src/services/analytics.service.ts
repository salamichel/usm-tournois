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

  // ==================== AUTHENTICATION EVENTS ====================

  /**
   * Track user login
   */
  trackLogin(method: 'email' | 'virtual_account' = 'email'): void {
    this.trackEvent('Authentication', 'Login', method);
  }

  /**
   * Track user signup
   */
  trackSignup(hasVirtualAccount: boolean = false): void {
    this.trackEvent('Authentication', 'Signup', hasVirtualAccount ? 'with_virtual_account' : 'new_user');
  }

  /**
   * Track user logout
   */
  trackLogout(): void {
    this.trackEvent('Authentication', 'Logout');
  }

  /**
   * Track password reset request
   */
  trackPasswordResetRequest(): void {
    this.trackEvent('Authentication', 'Password Reset Request');
  }

  /**
   * Track password reset completion
   */
  trackPasswordResetComplete(): void {
    this.trackEvent('Authentication', 'Password Reset Complete');
  }

  /**
   * Track password change
   */
  trackPasswordChange(): void {
    this.trackEvent('Authentication', 'Password Change');
  }

  /**
   * Track virtual account claim
   */
  trackVirtualAccountClaim(): void {
    this.trackEvent('Authentication', 'Virtual Account Claim');
  }

  // ==================== TOURNAMENT EVENTS ====================

  /**
   * Track tournament view
   */
  trackTournamentView(tournamentId: string, tournamentName?: string): void {
    this.trackEvent('Tournament', 'View', tournamentName || tournamentId);
  }

  /**
   * Track tournament list view
   */
  trackTournamentListView(): void {
    this.trackEvent('Tournament', 'List View');
  }

  /**
   * Track tournament search
   */
  trackTournamentSearch(query: string): void {
    this.trackEvent('Tournament', 'Search', query);
  }

  /**
   * Track tournament filter
   */
  trackTournamentFilter(filterType: 'type' | 'status' | 'search', filterValue: string): void {
    this.trackEvent('Tournament', 'Filter', `${filterType}: ${filterValue}`);
  }

  /**
   * Track tournament share
   */
  trackTournamentShare(tournamentId: string, method: 'native' | 'clipboard'): void {
    this.trackEvent('Tournament', 'Share', `${tournamentId} (${method})`);
  }

  /**
   * Track tournament registration as player
   */
  trackTournamentRegisterPlayer(tournamentId: string): void {
    this.trackEvent('Tournament', 'Register as Player', tournamentId);
  }

  /**
   * Track tournament leave
   */
  trackTournamentLeave(tournamentId: string): void {
    this.trackEvent('Tournament', 'Leave Tournament', tournamentId);
  }

  /**
   * Track waiting list join
   */
  trackWaitingListJoin(tournamentId: string): void {
    this.trackEvent('Tournament', 'Join Waiting List', tournamentId);
  }

  /**
   * Track tournament create
   */
  trackTournamentCreate(tournamentName: string, format: string): void {
    this.trackEvent('Tournament', 'Create', `${tournamentName} (${format})`);
  }

  /**
   * Track tournament edit
   */
  trackTournamentEdit(tournamentId: string): void {
    this.trackEvent('Tournament', 'Edit', tournamentId);
  }

  /**
   * Track tournament delete
   */
  trackTournamentDelete(tournamentId: string): void {
    this.trackEvent('Tournament', 'Delete', tournamentId);
  }

  /**
   * Track tournament view switch (details/results)
   */
  trackTournamentViewSwitch(view: 'detail' | 'results', tournamentId: string): void {
    this.trackEvent('Tournament', 'Switch View', `${view} - ${tournamentId}`);
  }

  /**
   * Track tournament results tab switch
   */
  trackTournamentResultsTab(tab: 'pools' | 'finals' | 'ranking', tournamentId: string): void {
    this.trackEvent('Tournament', 'Results Tab', `${tab} - ${tournamentId}`);
  }

  // ==================== TEAM EVENTS ====================

  /**
   * Track team creation
   */
  trackTeamCreate(tournamentId: string, teamName: string): void {
    this.trackEvent('Team', 'Create', `${teamName} - ${tournamentId}`);
  }

  /**
   * Track team join
   */
  trackTeamJoin(tournamentId: string, teamId: string): void {
    this.trackEvent('Team', 'Join', `${teamId} - ${tournamentId}`);
  }

  /**
   * Track team leave
   */
  trackTeamLeave(tournamentId: string, teamId: string): void {
    this.trackEvent('Team', 'Leave', `${teamId} - ${tournamentId}`);
  }

  /**
   * Track team management access
   */
  trackTeamManagementView(tournamentId: string, teamId: string): void {
    this.trackEvent('Team', 'Management View', `${teamId} - ${tournamentId}`);
  }

  /**
   * Track team edit
   */
  trackTeamEdit(teamId: string): void {
    this.trackEvent('Team', 'Edit', teamId);
  }

  /**
   * Track team delete
   */
  trackTeamDelete(teamId: string): void {
    this.trackEvent('Team', 'Delete', teamId);
  }

  /**
   * Track team player add
   */
  trackTeamPlayerAdd(teamId: string, playerPseudo?: string): void {
    this.trackEvent('Team', 'Add Player', `${teamId} - ${playerPseudo || 'unknown'}`);
  }

  /**
   * Track team player remove
   */
  trackTeamPlayerRemove(teamId: string, playerPseudo?: string): void {
    this.trackEvent('Team', 'Remove Player', `${teamId} - ${playerPseudo || 'unknown'}`);
  }

  /**
   * Track team recruitment toggle
   */
  trackTeamRecruitmentToggle(teamId: string, isOpen: boolean): void {
    this.trackEvent('Team', 'Toggle Recruitment', `${teamId} - ${isOpen ? 'open' : 'closed'}`);
  }

  // ==================== MATCH EVENTS ====================

  /**
   * Track match view
   */
  trackMatchView(matchId: string, tournamentId: string): void {
    this.trackEvent('Match', 'View', `${matchId} - ${tournamentId}`);
  }

  /**
   * Track match score submission
   */
  trackMatchScoreSubmit(matchId: string, matchType: 'pool' | 'elimination'): void {
    this.trackEvent('Match', 'Submit Score', `${matchId} (${matchType})`);
  }

  /**
   * Track match score edit
   */
  trackMatchScoreEdit(matchId: string, matchType: 'pool' | 'elimination'): void {
    this.trackEvent('Match', 'Edit Score', `${matchId} (${matchType})`);
  }

  // ==================== PROFILE & USER EVENTS ====================

  /**
   * Track profile view
   */
  trackProfileView(): void {
    this.trackEvent('Profile', 'View');
  }

  /**
   * Track profile edit start
   */
  trackProfileEditStart(): void {
    this.trackEvent('Profile', 'Edit Start');
  }

  /**
   * Track profile update
   */
  trackProfileUpdate(fields: string[]): void {
    this.trackEvent('Profile', 'Update', fields.join(', '));
  }

  /**
   * Track dashboard view
   */
  trackDashboardView(): void {
    this.trackEvent('User', 'Dashboard View');
  }

  // ==================== PLAYER RANKING EVENTS ====================

  /**
   * Track player ranking view
   */
  trackPlayerRankingView(): void {
    this.trackEvent('Player Ranking', 'View');
  }

  /**
   * Track player ranking filter
   */
  trackPlayerRankingFilter(filterType: 'season' | 'search', filterValue: string): void {
    this.trackEvent('Player Ranking', 'Filter', `${filterType}: ${filterValue}`);
  }

  /**
   * Track player ranking sort
   */
  trackPlayerRankingSort(sortBy: string): void {
    this.trackEvent('Player Ranking', 'Sort', sortBy);
  }

  // ==================== ADMIN EVENTS ====================

  /**
   * Track admin dashboard view
   */
  trackAdminDashboardView(): void {
    this.trackEvent('Admin', 'Dashboard View');
  }

  /**
   * Track admin tournament list view
   */
  trackAdminTournamentListView(): void {
    this.trackEvent('Admin', 'Tournament List View');
  }

  /**
   * Track admin tournament form view
   */
  trackAdminTournamentFormView(mode: 'create' | 'edit', tournamentId?: string): void {
    this.trackEvent('Admin', 'Tournament Form View', `${mode} - ${tournamentId || 'new'}`);
  }

  /**
   * Track admin pools management view
   */
  trackAdminPoolsView(tournamentId: string): void {
    this.trackEvent('Admin', 'Pools Management View', tournamentId);
  }

  /**
   * Track admin pools generation
   */
  trackAdminPoolsGenerate(tournamentId: string): void {
    this.trackEvent('Admin', 'Generate Pools', tournamentId);
  }

  /**
   * Track admin elimination view
   */
  trackAdminEliminationView(tournamentId: string): void {
    this.trackEvent('Admin', 'Elimination Management View', tournamentId);
  }

  /**
   * Track admin user management
   */
  trackAdminUserManagement(action: 'list' | 'create' | 'edit' | 'delete', userId?: string): void {
    this.trackEvent('Admin', `User ${action}`, userId);
  }

  /**
   * Track admin team management
   */
  trackAdminTeamManagement(action: 'list' | 'create' | 'edit' | 'delete', teamId?: string): void {
    this.trackEvent('Admin', `Team ${action}`, teamId);
  }

  /**
   * Track admin club management
   */
  trackAdminClubManagement(action: 'list' | 'create' | 'edit' | 'delete', clubId?: string): void {
    this.trackEvent('Admin', `Club ${action}`, clubId);
  }

  /**
   * Track admin season management
   */
  trackAdminSeasonManagement(action: 'list' | 'create' | 'edit' | 'delete', seasonId?: string): void {
    this.trackEvent('Admin', `Season ${action}`, seasonId);
  }

  // ==================== KING & FLEXIBLE KING EVENTS ====================

  /**
   * Track King dashboard view
   */
  trackKingDashboardView(tournamentId: string): void {
    this.trackEvent('King', 'Dashboard View', tournamentId);
  }

  /**
   * Track Flexible King dashboard view
   */
  trackFlexibleKingDashboardView(tournamentId: string): void {
    this.trackEvent('Flexible King', 'Dashboard View', tournamentId);
  }

  /**
   * Track King configuration
   */
  trackKingConfiguration(tournamentId: string, action: 'create' | 'update'): void {
    this.trackEvent('King', `Configuration ${action}`, tournamentId);
  }

  /**
   * Track Flexible King configuration
   */
  trackFlexibleKingConfiguration(tournamentId: string, action: 'create' | 'update'): void {
    this.trackEvent('Flexible King', `Configuration ${action}`, tournamentId);
  }

  // ==================== UI INTERACTION EVENTS ====================

  /**
   * Track button click
   */
  trackButtonClick(buttonName: string, context?: string): void {
    this.trackEvent('UI', 'Button Click', context ? `${buttonName} - ${context}` : buttonName);
  }

  /**
   * Track form submission
   */
  trackFormSubmit(formName: string, success: boolean): void {
    this.trackEvent('UI', 'Form Submit', `${formName} - ${success ? 'success' : 'error'}`);
  }

  /**
   * Track modal open
   */
  trackModalOpen(modalName: string): void {
    this.trackEvent('UI', 'Modal Open', modalName);
  }

  /**
   * Track modal close
   */
  trackModalClose(modalName: string): void {
    this.trackEvent('UI', 'Modal Close', modalName);
  }

  /**
   * Track tab switch
   */
  trackTabSwitch(tabName: string, context?: string): void {
    this.trackEvent('UI', 'Tab Switch', context ? `${tabName} - ${context}` : tabName);
  }

  /**
   * Track navigation
   */
  trackNavigation(from: string, to: string): void {
    this.trackEvent('Navigation', 'Navigate', `${from} -> ${to}`);
  }

  // ==================== ERROR TRACKING ====================

  /**
   * Track errors
   */
  trackError(errorType: string, errorMessage: string, context?: string): void {
    this.trackEvent('Error', errorType, context ? `${errorMessage} - ${context}` : errorMessage);
  }

  /**
   * Track API errors
   */
  trackApiError(endpoint: string, statusCode: number, errorMessage: string): void {
    this.trackEvent('API Error', endpoint, `${statusCode} - ${errorMessage}`);
  }
}

// Export a singleton instance
export const analyticsService = new AnalyticsService();
