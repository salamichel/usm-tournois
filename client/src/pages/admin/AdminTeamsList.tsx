import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Users,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  UsersRound,
  UserCheck,
  Award
} from 'lucide-react';

interface Member {
  userId: string;
  pseudo: string;
  level: string;
  totalPoints?: number;
}

interface Team {
  id: string;
  name: string;
  captainId: string;
  captainPseudo?: string;
  members: Member[];
  recruitmentOpen: boolean;
  isAssigned?: boolean;
  weight?: number;
  globalRanking?: number;
}

const AdminTeamsList = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, teamsRes] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getTeams(tournamentId!),
      ]);

      setTournament(tournamentRes.data?.tournament);
      setTeams(teamsRes.data?.teams || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${teamName}" ?`)) return;

    try {
      await adminService.deleteTeam(tournamentId!, teamId);
      toast.success('Équipe supprimée avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleRecalculateRanking = async () => {
    if (!confirm(`Recalculer le ranking de toutes les équipes ?\n\nCela mettra à jour le total des points de chaque équipe en fonction des points actuels de leurs membres.`)) {
      return;
    }

    try {
      const response = await adminService.recalculateTeamsRanking(tournamentId!);
      if (response.success) {
        toast.success(response.message || 'Ranking recalculé avec succès');
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du recalcul');
    }
  };

  // Filter teams
  const filteredTeams = teams.filter(team => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = team.name.toLowerCase().includes(query);
      const matchesCaptain = team.captainPseudo?.toLowerCase().includes(query);
      const matchesMember = team.members?.some(m =>
        m.pseudo?.toLowerCase().includes(query)
      );
      if (!matchesName && !matchesCaptain && !matchesMember) {
        return false;
      }
    }

    // Status filter
    const playersPerTeam = tournament?.playersPerTeam || 4;
    if (filterStatus === 'complete') {
      return team.members?.length >= playersPerTeam;
    } else if (filterStatus === 'incomplete') {
      return team.members?.length < playersPerTeam;
    } else if (filterStatus === 'recruiting') {
      return team.recruitmentOpen;
    } else if (filterStatus === 'assigned') {
      return team.isAssigned;
    }

    return true;
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  const playersPerTeam = tournament?.playersPerTeam || 4;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Équipes - {tournament?.name}
              </h1>
              <p className="text-gray-600 mt-1">
                {filteredTeams.length} équipe{filteredTeams.length > 1 ? 's' : ''}
                {searchQuery || filterStatus !== 'all' ? ` (${teams.length} au total)` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="btn-secondary flex items-center gap-2"
              title="Actualiser"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={handleRecalculateRanking}
              className="btn-secondary flex items-center gap-2"
              title="Recalculer le ranking de toutes les équipes"
            >
              <Award size={18} />
              Recalculer Ranking
            </button>
            <Link
              to={`/admin/tournaments/${tournamentId}/teams/new`}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              Nouvelle Équipe
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher une équipe, capitaine ou membre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input w-full"
              >
                <option value="all">Tous les statuts</option>
                <option value="complete">Complètes</option>
                <option value="incomplete">Incomplètes</option>
                <option value="recruiting">En recrutement</option>
                <option value="assigned">En poule</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teams Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredTeams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Équipe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Capitaine
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Membres
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Poids
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ranking
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTeams.map(team => (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UsersRound size={18} className="text-gray-400" />
                          <span className="font-medium text-gray-900">{team.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <UserCheck size={14} className="text-yellow-500" />
                          <span className="text-sm text-gray-600">
                            {team.captainPseudo || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Users size={14} className="text-gray-400" />
                          <span className={`text-sm font-medium ${
                            team.members?.length >= playersPerTeam
                              ? 'text-green-600'
                              : 'text-orange-600'
                          }`}>
                            {team.members?.length || 0}/{playersPerTeam}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-medium text-gray-700">
                          {team.weight || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {(team.globalRanking ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700">
                            <Award size={14} />
                            {team.globalRanking}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {team.members?.length >= playersPerTeam ? (
                            <span className="badge badge-success text-xs">Complète</span>
                          ) : (
                            <span className="badge badge-warning text-xs">Incomplète</span>
                          )}
                          {team.recruitmentOpen && (
                            <span className="badge badge-info text-xs">Recrute</span>
                          )}
                          {team.isAssigned && (
                            <span className="badge badge-default text-xs">En poule</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/admin/tournaments/${tournamentId}/teams/${team.id}/edit`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Edit size={18} />
                          </Link>
                          <button
                            onClick={() => handleDelete(team.id, team.name)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UsersRound size={48} className="mx-auto text-gray-300 mb-4" />
              {searchQuery || filterStatus !== 'all' ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune équipe trouvée</h3>
                  <p className="text-gray-500 mb-4">
                    Aucune équipe ne correspond à vos critères de recherche
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterStatus('all');
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Réinitialiser les filtres
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">Aucune équipe inscrite</p>
                  <Link
                    to={`/admin/tournaments/${tournamentId}/teams/new`}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Créer une équipe
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTeamsList;
