import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@contexts/AuthContext';
import { TournamentProvider } from '@contexts/TournamentContext';
import Layout from '@components/layout/Layout';
import ProtectedRoute from '@components/common/ProtectedRoute';
import AdminRoute from '@components/common/AdminRoute';
import { analyticsService } from '@services/analytics.service';
import { usePageTracking } from '@hooks/usePageTracking';

// Public pages
import HomePage from '@pages/public/HomePage';
import TournamentDetailPage from '@pages/public/TournamentDetailPage';
import LoginPage from '@pages/public/LoginPage';
import ResetPasswordPage from '@pages/public/ResetPasswordPage';
import ProfilePage from '@pages/public/ProfilePage';
import DashboardPage from '@pages/public/DashboardPage';
import TeamManagementPage from '@pages/public/TeamManagementPage';
import ChangePasswordPage from '@pages/public/ChangePasswordPage';
import PlayerRankingPage from '@pages/public/PlayerRankingPage';
import NotFoundPage from '@pages/public/NotFoundPage';

// Admin pages
import AdminDashboard from '@pages/admin/AdminDashboard';
import AdminTournamentsList from '@pages/admin/AdminTournamentsList';
import AdminTournamentForm from '@pages/admin/AdminTournamentForm';
import AdminPoolsManagement from '@pages/admin/AdminPoolsManagement';
import AdminEliminationManagement from '@pages/admin/AdminEliminationManagement';
import AdminKingDashboard from '@pages/admin/AdminKingDashboard';
import AdminFlexibleKingDashboard from '@pages/admin/AdminFlexibleKingDashboard';
import AdminTeamKingDashboard from '@pages/admin/AdminTeamKingDashboard';
import AdminTeamsList from '@pages/admin/AdminTeamsList';
import AdminTeamForm from '@pages/admin/AdminTeamForm';
import AdminGlobalTeams from '@pages/admin/AdminGlobalTeams';
import AdminTeamSearch from '@pages/admin/AdminTeamSearch';
import AdminUsersList from '@pages/admin/AdminUsersList';
import AdminUserForm from '@pages/admin/AdminUserForm';
import AdminUnassignedPlayers from '@pages/admin/AdminUnassignedPlayers';
import AdminVirtualUsers from '@pages/admin/AdminVirtualUsers';
import AdminClubsList from '@pages/admin/AdminClubsList';
import AdminClubForm from '@pages/admin/AdminClubForm';
import AdminSeasonsList from '@pages/admin/AdminSeasonsList';

// Demo pages
import KingConfigDemo from '@pages/KingConfigDemo';

function App() {
  // Initialize Google Analytics on app mount
  useEffect(() => {
    analyticsService.initialize();
  }, []);

  // Track page views
  usePageTracking();

  return (
    <AuthProvider>
      <TournamentProvider>
        <Layout>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/tournoi/:id" element={<TournamentDetailPage />} />
            <Route path="/classement" element={<PlayerRankingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes */}
            <Route
              path="/mon-profil"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mon-compte"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestion-equipe/:tournamentId/:id"
              element={
                <ProtectedRoute>
                  <TeamManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/changer-mot-de-passe"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments"
              element={
                <AdminRoute>
                  <AdminTournamentsList />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/new"
              element={
                <AdminRoute>
                  <AdminTournamentForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:id/edit"
              element={
                <AdminRoute>
                  <AdminTournamentForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/pools"
              element={
                <AdminRoute>
                  <AdminPoolsManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/elimination"
              element={
                <AdminRoute>
                  <AdminEliminationManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/king"
              element={
                <AdminRoute>
                  <AdminKingDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/flexible-king"
              element={
                <AdminRoute>
                  <AdminFlexibleKingDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/team-king"
              element={
                <AdminRoute>
                  <AdminTeamKingDashboard />
                </AdminRoute>
              }
            />
            {/* Global Teams Management */}
            <Route
              path="/admin/teams"
              element={
                <AdminRoute>
                  <AdminGlobalTeams />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/teams/search"
              element={
                <AdminRoute>
                  <AdminTeamSearch />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/teams/stats"
              element={
                <AdminRoute>
                  <AdminGlobalTeams />
                </AdminRoute>
              }
            />
            {/* Tournament-specific Teams */}
            <Route
              path="/admin/tournaments/:tournamentId/teams"
              element={
                <AdminRoute>
                  <AdminTeamsList />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/teams/new"
              element={
                <AdminRoute>
                  <AdminTeamForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/teams/:teamId/edit"
              element={
                <AdminRoute>
                  <AdminTeamForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsersList />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users/new"
              element={
                <AdminRoute>
                  <AdminUserForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users/:id/edit"
              element={
                <AdminRoute>
                  <AdminUserForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tournaments/:tournamentId/unassigned-players"
              element={
                <AdminRoute>
                  <AdminUnassignedPlayers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/virtual-users"
              element={
                <AdminRoute>
                  <AdminVirtualUsers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/clubs"
              element={
                <AdminRoute>
                  <AdminClubsList />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/clubs/new"
              element={
                <AdminRoute>
                  <AdminClubForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/clubs/:id/edit"
              element={
                <AdminRoute>
                  <AdminClubForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/seasons"
              element={
                <AdminRoute>
                  <AdminSeasonsList />
                </AdminRoute>
              }
            />

            {/* Demo pages */}
            <Route path="/demo/king-config" element={<KingConfigDemo />} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#4ade80',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Layout>
      </TournamentProvider>
    </AuthProvider>
  );
}

export default App;
