import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import {
  Trophy,
  Users,
  Calendar,
  TrendingUp,
  UserCog,
  Plus,
  Settings,
  Crown,
  Edit,
  Building2,
  UserPlus,
  ListChecks,
  Zap,
  BarChart3,
  UsersRound,
  UserCheck,
  Search,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTournaments: 0,
    activeTournaments: 0,
    totalTeams: 0,
  });
  const [recentTournaments, setRecentTournaments] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await adminService.getDashboard();
      if (response.success && response.data) {
        setStats(response.data.stats);
        setRecentTournaments(response.data.recentTournaments || []);
        setRecentUsers(response.data.recentUsers || []);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement du dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrateur</h1>
          <p className="text-gray-600 mt-2">Vue d'ensemble de la plateforme</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Utilisateurs</p>
                <p className="text-3xl font-bold mt-2">{stats.totalUsers}</p>
              </div>
              <Users className="text-blue-200" size={40} />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Tournois Total</p>
                <p className="text-3xl font-bold mt-2">{stats.totalTournaments}</p>
              </div>
              <Trophy className="text-green-200" size={40} />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Tournois Actifs</p>
                <p className="text-3xl font-bold mt-2">{stats.activeTournaments}</p>
              </div>
              <Calendar className="text-purple-200" size={40} />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Équipes</p>
                <p className="text-3xl font-bold mt-2">{stats.totalTeams}</p>
              </div>
              <TrendingUp className="text-orange-200" size={40} />
            </div>
          </div>
        </div>

        {/* Recent Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tournaments */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Tournois Récents</h2>
              <Link to="/admin/tournaments" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Voir tout
              </Link>
            </div>
            <div className="space-y-3">
              {recentTournaments.length > 0 ? (
                recentTournaments.map((tournament) => (
                  <div key={tournament.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{tournament.name}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>
                          {tournament.date
                            ? format(new Date(tournament.date), 'PPP', { locale: fr })
                            : 'Date à confirmer'}
                        </span>
                        {tournament.teamCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Trophy size={12} />
                            {tournament.teamCount} éq.
                          </span>
                        )}
                        {tournament.playerCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            {tournament.playerCount} j.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`badge ${
                        tournament.isActive ? 'badge-success' : 'badge-default'
                      }`}>
                        {tournament.isActive ? 'Actif' : 'Inactif'}
                      </span>
                      <div className="flex gap-1">
                        <Link
                          to={`/admin/tournaments/${tournament.id}/edit`}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit size={16} />
                        </Link>
                        {tournament.mode === 'king' && (
                          <Link
                            to={`/admin/tournaments/${tournament.id}/king`}
                            className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                            title="Mode King"
                          >
                            <Crown size={16} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Aucun tournoi récent</p>
              )}
            </div>
          </div>

          {/* Recent Users */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Utilisateurs Récents</h2>
              <Link to="/admin/users" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Voir tout
              </Link>
            </div>
            <div className="space-y-3">
              {recentUsers.length > 0 ? (
                recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{user.pseudo}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <span className={`badge ${
                      user.role === 'admin' ? 'badge-warning' : 'badge-default'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Aucun utilisateur récent</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions - Organized by Category */}
        <div className="space-y-4">
          {/* Primary Actions */}
          <div className="card border-l-4 border-primary-500">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="text-primary-500" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Actions Rapides</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <Link to="/admin/tournaments/new" className="flex flex-col items-center gap-2 p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors text-primary-700 font-medium">
                <Plus size={24} />
                <span className="text-sm text-center">Nouveau Tournoi</span>
              </Link>
              <Link to="/admin/users/new" className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-blue-700 font-medium">
                <UserPlus size={24} />
                <span className="text-sm text-center">Nouvel Utilisateur</span>
              </Link>
              <Link to="/admin/clubs/new" className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-purple-700 font-medium">
                <Building2 size={24} />
                <span className="text-sm text-center">Nouveau Club</span>
              </Link>
              <Link to="/admin/teams" className="flex flex-col items-center gap-2 p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-red-700 font-medium">
                <UsersRound size={24} />
                <span className="text-sm text-center">Gérer Équipes</span>
              </Link>
              <Link to="/admin/tournaments" className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-green-700 font-medium">
                <ListChecks size={24} />
                <span className="text-sm text-center">Gérer Tournois</span>
              </Link>
              <Link to="/admin/users" className="flex flex-col items-center gap-2 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-orange-700 font-medium">
                <Users size={24} />
                <span className="text-sm text-center">Gérer Utilisateurs</span>
              </Link>
              <Link to="/admin/clubs" className="flex flex-col items-center gap-2 p-4 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors text-pink-700 font-medium">
                <Building2 size={24} />
                <span className="text-sm text-center">Gérer Clubs</span>
              </Link>
              <Link to="/admin/teams/search" className="flex flex-col items-center gap-2 p-4 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors text-teal-700 font-medium">
                <Search size={24} />
                <span className="text-sm text-center">Rechercher Équipes</span>
              </Link>
            </div>
          </div>

          {/* System Tools */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="text-gray-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Outils Système</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to="/admin/users" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700">
                <Users size={18} className="text-gray-500" />
                <span className="text-sm font-medium">Liste Utilisateurs</span>
              </Link>
              <Link to="/admin/clubs" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700">
                <Building2 size={18} className="text-gray-500" />
                <span className="text-sm font-medium">Liste Clubs</span>
              </Link>
              <Link to="/admin/tournaments" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700">
                <BarChart3 size={18} className="text-gray-500" />
                <span className="text-sm font-medium">Tous les Tournois</span>
              </Link>
              <Link to="/admin/teams" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700">
                <UsersRound size={18} className="text-gray-500" />
                <span className="text-sm font-medium">Toutes les Équipes</span>
              </Link>
              <Link to="/admin/virtual-users" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700">
                <UserCog size={18} className="text-gray-500" />
                <span className="text-sm font-medium">Comptes Virtuels</span>
              </Link>
              <Link to="/admin/teams/stats" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700">
                <ClipboardList size={18} className="text-gray-500" />
                <span className="text-sm font-medium">Stats Équipes</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
