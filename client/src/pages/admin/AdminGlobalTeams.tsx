import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import {
  UsersRound,
  Search,
  Filter,
  Trophy,
  Users,
  Edit,
  Trash2,
  ChevronRight,
  UserCheck,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  captainId: string;
  captainPseudo?: string;
  members: any[];
  recruitmentOpen: boolean;
  poolId?: string;
  poolName?: string;
}

interface Tournament {
  id: string;
  name: string;
  date?: string;
  isActive: boolean;
  teams: Team[];
  playersPerTeam: number;
}

const AdminGlobalTeams = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTournament, setFilterTournament] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllTeams();
  }, []);

  const fetchAllTeams = async () => {
    try {
      setIsLoading(true);
      // Fetch all tournaments
      const tournamentsResponse = await adminService.getTournaments();

      if (tournamentsResponse.success && tournamentsResponse.data) {
        const tournamentsWithTeams: Tournament[] = [];

        // Fetch teams for each tournament
        for (const tournament of tournamentsResponse.data.tournaments || []) {
          try {
            const teamsResponse = await adminService.getTeams(tournament.id);
            if (teamsResponse.success && teamsResponse.data) {
              tournamentsWithTeams.push({
                id: tournament.id,
                name: tournament.name,
                date: tournament.date,
                isActive: tournament.isActive,
                teams: teamsResponse.data.teams || [],
                playersPerTeam: tournament.playersPerTeam || 4
              });
            }
          } catch {
            // Skip tournaments that fail to load teams
          }
        }

        setTournaments(tournamentsWithTeams);

        // Expand tournaments with teams by default
        const withTeams = new Set(
          tournamentsWithTeams
            .filter(t => t.teams.length > 0)
            .map(t => t.id)
        );
        setExpandedTournaments(withTeams);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des équipes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTeam = async (tournamentId: string, teamId: string, teamName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${teamName}" ?`)) {
      return;
    }

    try {
      const response = await adminService.deleteTeam(tournamentId, teamId);
      if (response.success) {
        toast.success('Équipe supprimée avec succès');
        fetchAllTeams();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const toggleTournament = (tournamentId: string) => {
    setExpandedTournaments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId);
      } else {
        newSet.add(tournamentId);
      }
      return newSet;
    });
  };

  // Filter tournaments and teams
  const filteredTournaments = tournaments
    .filter(tournament => {
      if (filterTournament !== 'all' && tournament.id !== filterTournament) {
        return false;
      }
      return true;
    })
    .map(tournament => ({
      ...tournament,
      teams: tournament.teams.filter(team => {
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
        if (filterStatus === 'complete') {
          return team.members?.length >= tournament.playersPerTeam;
        } else if (filterStatus === 'incomplete') {
          return team.members?.length < tournament.playersPerTeam;
        } else if (filterStatus === 'recruiting') {
          return team.recruitmentOpen;
        }

        return true;
      })
    }))
    .filter(tournament => tournament.teams.length > 0 || filterTournament === tournament.id);

  const totalTeams = filteredTournaments.reduce((sum, t) => sum + t.teams.length, 0);

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
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Équipes</h1>
            <p className="text-gray-600 mt-1">
              {totalTeams} équipe{totalTeams > 1 ? 's' : ''} dans {tournaments.length} tournoi{tournaments.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchAllTeams}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Actualiser
          </button>
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

            {/* Tournament Filter */}
            <div className="w-full md:w-48">
              <select
                value={filterTournament}
                onChange={(e) => setFilterTournament(e.target.value)}
                className="input w-full"
              >
                <option value="all">Tous les tournois</option>
                {tournaments.map(tournament => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-40">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input w-full"
              >
                <option value="all">Tous statuts</option>
                <option value="complete">Complètes</option>
                <option value="incomplete">Incomplètes</option>
                <option value="recruiting">En recrutement</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teams by Tournament */}
        {filteredTournaments.length > 0 ? (
          <div className="space-y-4">
            {filteredTournaments.map(tournament => (
              <div key={tournament.id} className="card">
                {/* Tournament Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleTournament(tournament.id)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      size={20}
                      className={`text-gray-400 transition-transform ${
                        expandedTournaments.has(tournament.id) ? 'rotate-90' : ''
                      }`}
                    />
                    <Trophy size={20} className="text-primary-500" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{tournament.name}</h3>
                      <p className="text-sm text-gray-500">
                        {tournament.teams.length} équipe{tournament.teams.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${tournament.isActive ? 'badge-success' : 'badge-default'}`}>
                      {tournament.isActive ? 'Actif' : 'Inactif'}
                    </span>
                    <Link
                      to={`/admin/tournaments/${tournament.id}/teams`}
                      className="btn-sm btn-secondary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Gérer
                    </Link>
                  </div>
                </div>

                {/* Teams List */}
                {expandedTournaments.has(tournament.id) && tournament.teams.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-sm text-gray-500 border-b">
                            <th className="pb-2 font-medium">Équipe</th>
                            <th className="pb-2 font-medium">Capitaine</th>
                            <th className="pb-2 font-medium">Membres</th>
                            <th className="pb-2 font-medium">Statut</th>
                            <th className="pb-2 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {tournament.teams.map(team => (
                            <tr key={team.id} className="hover:bg-gray-50">
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <UsersRound size={16} className="text-gray-400" />
                                  <span className="font-medium">{team.name}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1">
                                  <UserCheck size={14} className="text-yellow-500" />
                                  <span className="text-sm">{team.captainPseudo || 'N/A'}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1">
                                  <Users size={14} className="text-gray-400" />
                                  <span className={`text-sm ${
                                    team.members?.length >= tournament.playersPerTeam
                                      ? 'text-green-600'
                                      : 'text-orange-600'
                                  }`}>
                                    {team.members?.length || 0}/{tournament.playersPerTeam}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="flex flex-wrap gap-1">
                                  {team.members?.length >= tournament.playersPerTeam ? (
                                    <span className="badge badge-success text-xs">Complète</span>
                                  ) : (
                                    <span className="badge badge-warning text-xs">Incomplète</span>
                                  )}
                                  {team.recruitmentOpen && (
                                    <span className="badge badge-info text-xs">Recrute</span>
                                  )}
                                  {team.poolId && (
                                    <span className="badge badge-default text-xs">En poule</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Link
                                    to={`/admin/tournaments/${tournament.id}/teams/${team.id}/edit`}
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Modifier"
                                  >
                                    <Edit size={16} />
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteTeam(tournament.id, team.id, team.name)}
                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {expandedTournaments.has(tournament.id) && tournament.teams.length === 0 && (
                  <div className="mt-4 border-t pt-4 text-center text-gray-500 py-4">
                    <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
                    <p>Aucune équipe dans ce tournoi</p>
                    <Link
                      to={`/admin/tournaments/${tournament.id}/teams/new`}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Créer une équipe
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <UsersRound size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune équipe trouvée</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || filterStatus !== 'all'
                ? 'Aucune équipe ne correspond à vos critères de recherche'
                : 'Il n\'y a pas encore d\'équipes dans les tournois'}
            </p>
            {(searchQuery || filterStatus !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterTournament('all');
                }}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminGlobalTeams;
