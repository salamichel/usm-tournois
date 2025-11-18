import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { Trophy, Users, Calendar, TrendingUp, UserCog } from 'lucide-react';
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
                  <div key={tournament.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{tournament.name}</p>
                      <p className="text-sm text-gray-500">
                        {tournament.date
                          ? format(new Date(tournament.date), 'PPP', { locale: fr })
                          : 'Date à confirmer'}
                      </p>
                    </div>
                    <span className={`badge ${
                      tournament.isActive ? 'badge-success' : 'badge-default'
                    }`}>
                      {tournament.isActive ? 'Actif' : 'Inactif'}
                    </span>
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

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Actions Rapides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/admin/tournaments/new" className="btn-primary text-center">
              <Trophy size={20} className="inline mr-2" />
              Créer un Tournoi
            </Link>
            <Link to="/admin/users/new" className="btn-secondary text-center">
              <Users size={20} className="inline mr-2" />
              Créer un Utilisateur
            </Link>
            <Link to="/admin/tournaments" className="btn-secondary text-center">
              <Calendar size={20} className="inline mr-2" />
              Gérer les Tournois
            </Link>
            <Link to="/admin/virtual-users" className="btn-secondary text-center">
              <UserCog size={20} className="inline mr-2" />
              Comptes Virtuels
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
