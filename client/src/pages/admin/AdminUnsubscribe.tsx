import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  UserMinus,
  Search,
  RefreshCw,
  Users,
  UserX,
  UsersRound,
  Crown,
  Filter,
} from 'lucide-react';

interface RegisteredPlayer {
  id: string;
  odocId?: string;
  userId: string;
  pseudo: string;
  email: string;
  level: string;
  sexe: string;
  isVirtual?: boolean;
  totalPoints: number;
  source: 'unassigned' | 'team';
  teamId: string | null;
  teamName: string | null;
  isCaptain?: boolean;
}

interface Stats {
  totalPlayers: number;
  unassignedCount: number;
  teamPlayersCount: number;
  teamsCount: number;
}

const AdminUnsubscribe = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [players, setPlayers] = useState<RegisteredPlayer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'unassigned' | 'team'>('all');
  const [unsubscribing, setUnsubscribing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, playersRes] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getAllRegisteredPlayers(tournamentId!),
      ]);

      setTournament(tournamentRes.data?.tournament);
      setPlayers(playersRes.data?.players || []);
      setStats(playersRes.data?.stats || null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (player: RegisteredPlayer) => {
    const confirmMessage = player.source === 'team'
      ? `Voulez-vous vraiment désinscrire "${player.pseudo}" du tournoi ?\n\nCe joueur sera retiré de l'équipe "${player.teamName}".${player.isCaptain ? '\n\nAttention: Ce joueur est capitaine de son équipe. La capitainerie sera transférée au premier membre restant.' : ''}`
      : `Voulez-vous vraiment désinscrire "${player.pseudo}" du tournoi ?`;

    if (!confirm(confirmMessage)) return;

    try {
      setUnsubscribing(player.id);
      const response = await adminService.unsubscribePlayerFromTournament(tournamentId!, player.userId);
      toast.success(response.message || 'Joueur désinscrit avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la désinscription');
    } finally {
      setUnsubscribing(null);
    }
  };

  const handleRemoveFromTeam = async (player: RegisteredPlayer, moveToUnassigned: boolean) => {
    const action = moveToUnassigned ? 'retirer de l\'équipe (et garder inscrit)' : 'retirer de l\'équipe (et désinscrire)';
    if (!confirm(`Voulez-vous ${action} "${player.pseudo}" ?`)) return;

    try {
      setUnsubscribing(player.id);

      if (moveToUnassigned) {
        // Remove from team and move to unassigned
        const response = await adminService.removePlayerFromTeam(
          tournamentId!,
          player.teamId!,
          player.userId,
          true
        );
        toast.success(response.message || 'Joueur retiré de l\'équipe');
      } else {
        // Completely unsubscribe
        const response = await adminService.unsubscribePlayerFromTournament(tournamentId!, player.userId);
        toast.success(response.message || 'Joueur désinscrit avec succès');
      }

      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'opération');
    } finally {
      setUnsubscribing(null);
    }
  };

  // Filter players
  const filteredPlayers = players.filter((player) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesPseudo = player.pseudo?.toLowerCase().includes(query);
      const matchesEmail = player.email?.toLowerCase().includes(query);
      const matchesTeam = player.teamName?.toLowerCase().includes(query);
      if (!matchesPseudo && !matchesEmail && !matchesTeam) {
        return false;
      }
    }

    // Source filter
    if (filterSource !== 'all' && player.source !== filterSource) {
      return false;
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
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <UserMinus size={28} />
                Désinscriptions - {tournament?.name}
              </h1>
              <p className="text-gray-600 mt-1">
                Gérer les désinscriptions des joueurs du tournoi
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="btn-secondary flex items-center gap-2"
            title="Actualiser"
          >
            <RefreshCw size={18} />
            Actualiser
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total inscrits</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPlayers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <UserMinus size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Non assignés</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.unassignedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UsersRound size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dans équipes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.teamPlayersCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <UsersRound size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Équipes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.teamsCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher par pseudo, email ou équipe..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
            </div>

            {/* Source Filter */}
            <div className="w-full md:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as any)}
                  className="input pl-10 w-full"
                >
                  <option value="all">Tous les joueurs</option>
                  <option value="unassigned">Non assignés</option>
                  <option value="team">Dans une équipe</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredPlayers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joueur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Niveau
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
                  {filteredPlayers.map((player) => (
                    <tr key={`${player.source}-${player.id}-${player.teamId || 'none'}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{player.pseudo}</span>
                          {player.isCaptain && (
                            <span title="Capitaine">
                              <Crown size={14} className="text-yellow-500" />
                            </span>
                          )}
                          {player.isVirtual && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Virtuel</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {player.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          player.level?.toLowerCase() === 'débutant' ? 'bg-gray-100 text-gray-800' :
                          player.level?.toLowerCase() === 'intermédiaire' ? 'bg-blue-100 text-blue-800' :
                          player.level?.toLowerCase() === 'confirmé' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {player.level || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {player.source === 'team' ? (
                          <div className="flex items-center gap-2">
                            <span className="badge badge-success text-xs">En équipe</span>
                            <span className="text-sm text-gray-600">{player.teamName}</span>
                          </div>
                        ) : (
                          <span className="badge badge-warning text-xs">Non assigné</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {player.source === 'team' ? (
                            <>
                              <button
                                onClick={() => handleRemoveFromTeam(player, true)}
                                disabled={unsubscribing === player.id || player.isVirtual}
                                className="px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Retirer de l'équipe (garder inscrit)"
                              >
                                Retirer équipe
                              </button>
                              <button
                                onClick={() => handleUnsubscribe(player)}
                                disabled={unsubscribing === player.id}
                                className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Désinscrire complètement du tournoi"
                              >
                                <UserX size={14} />
                                Désinscrire
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleUnsubscribe(player)}
                              disabled={unsubscribing === player.id}
                              className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              title="Désinscrire du tournoi"
                            >
                              <UserX size={14} />
                              Désinscrire
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UserMinus size={48} className="mx-auto text-gray-300 mb-4" />
              {searchQuery || filterSource !== 'all' ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun joueur trouvé</h3>
                  <p className="text-gray-500 mb-4">
                    Aucun joueur ne correspond à vos critères de recherche
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterSource('all');
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Réinitialiser les filtres
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun joueur inscrit</h3>
                  <p className="text-gray-500">
                    Il n'y a aucun joueur inscrit à ce tournoi
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Actions disponibles</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>Retirer équipe</strong> : Retire le joueur de son équipe mais le garde inscrit au tournoi (dans les joueurs non assignés)</li>
            <li><strong>Désinscrire</strong> : Retire complètement le joueur du tournoi (de l'équipe ou des non assignés)</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUnsubscribe;
