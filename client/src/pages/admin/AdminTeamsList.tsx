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
  Award,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpCircle,
  Clock3
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
  isWaitingList?: boolean;
  waitingListOrder?: number;
  waitingListJoinedAt?: string;
}

const AdminTeamsList = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'registered' | 'waitingList'>('registered');
  const [actionLoading, setActionLoading] = useState(false);

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
    if (
      !confirm(
        `Recalculer le ranking de toutes les équipes ?\n\nCela mettra à jour le total des points de chaque équipe en fonction des points actuels de leurs membres.`
      )
    ) {
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

  const handleMoveToWaitingList = async (teamId: string, teamName: string) => {
    if (!confirm(`Basculer l'équipe "${teamName}" en liste d'attente ?\n\nSi elle est déjà assignée à une poule, elle en sera retirée.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await adminService.moveToWaitingList(tournamentId!, teamId);
      if (response.success) {
        toast.success(response.message || 'Équipe placée en liste d\'attente');
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteFromWaitingList = async (teamId: string, teamName: string) => {
    if (!confirm(`Intégrer l'équipe "${teamName}" au tournoi principal ?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await adminService.promoteFromWaitingList(tournamentId!, teamId);
      if (response.success) {
        toast.success(response.message || 'Équipe intégrée au tournoi principal');
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveUp = async (index: number, waitingList: Team[]) => {
    if (index <= 0) return;
    const newOrder = [...waitingList];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;

    try {
      setActionLoading(true);
      await adminService.reorderWaitingList(tournamentId!, newOrder.map((t) => t.id));
      toast.success('Ordre de la liste d\'attente mis à jour');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.message || 'Erreur lors du réordonnancement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveDown = async (index: number, waitingList: Team[]) => {
    if (index >= waitingList.length - 1) return;
    const newOrder = [...waitingList];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;

    try {
      setActionLoading(true);
      await adminService.reorderWaitingList(tournamentId!, newOrder.map((t) => t.id));
      toast.success('Ordre de la liste d\'attente mis à jour');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.message || 'Erreur lors du réordonnancement');
    } finally {
      setActionLoading(false);
    }
  };

  // Split teams between registered and waiting list
  const registeredTeams = teams.filter((t) => !t.isWaitingList);
  const waitingTeams = teams
    .filter((t) => t.isWaitingList)
    .sort((a, b) => {
      const orderA = a.waitingListOrder ?? 9999;
      const orderB = b.waitingListOrder ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.waitingListJoinedAt || 0).getTime() - new Date(b.waitingListJoinedAt || 0).getTime();
    });

  const currentTabTeams = activeTab === 'registered' ? registeredTeams : waitingTeams;

  // Filter current tab teams
  const filteredTeams = currentTabTeams.filter((team) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = team.name.toLowerCase().includes(query);
      const matchesCaptain = team.captainPseudo?.toLowerCase().includes(query);
      const matchesMember = team.members?.some((m) => m.pseudo?.toLowerCase().includes(query));
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
  const maxTeams = tournament?.maxTeams || 0;
  const waitingListSize = tournament?.waitingListSize || 0;

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
              <h1 className="text-3xl font-bold text-gray-900">Équipes - {tournament?.name}</h1>
              <p className="text-gray-600 mt-1">
                {registeredTeams.length}/{maxTeams} équipes inscrites • {waitingTeams.length}/{waitingListSize} en liste d'attente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={actionLoading}
              className="btn-secondary flex items-center gap-2"
              title="Actualiser"
            >
              <RefreshCw size={18} className={actionLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleRecalculateRanking}
              disabled={actionLoading}
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

        {/* Tabs for Registered vs Waiting List */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab('registered');
              setSearchQuery('');
              setFilterStatus('all');
            }}
            className={`flex items-center gap-2 py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'registered'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UsersRound size={18} />
            <span>Équipes inscrites</span>
            <span
              className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                registeredTeams.length >= maxTeams
                  ? 'bg-green-100 text-green-800 font-semibold'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {registeredTeams.length}/{maxTeams}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('waitingList');
              setSearchQuery('');
              setFilterStatus('all');
            }}
            className={`flex items-center gap-2 py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'waitingList'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock size={18} />
            <span>Liste d'attente</span>
            <span
              className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                waitingTeams.length > 0
                  ? 'bg-amber-100 text-amber-800 font-semibold'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {waitingTeams.length}/{waitingListSize}
            </span>
          </button>
        </div>

        {/* Notice if waiting list size is 0 */}
        {activeTab === 'waitingList' && waitingListSize === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock3 size={18} className="text-amber-600 flex-shrink-0" />
              <span>
                La taille de la liste d'attente est actuellement définie à 0 dans les paramètres de ce tournoi.
              </span>
            </div>
            <Link
              to={`/admin/tournaments/${tournamentId}/edit`}
              className="text-amber-900 font-semibold underline hover:text-amber-700"
            >
              Modifier le tournoi
            </Link>
          </div>
        )}

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
                {activeTab === 'registered' && <option value="assigned">En poule</option>}
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
                    {activeTab === 'waitingList' && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        Rang
                      </th>
                    )}
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
                  {filteredTeams.map((team, index) => (
                    <tr key={team.id} className="hover:bg-gray-50">
                      {activeTab === 'waitingList' && (
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            #{team.waitingListOrder || index + 1}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UsersRound size={18} className="text-gray-400" />
                          <span className="font-medium text-gray-900">{team.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <UserCheck size={14} className="text-yellow-500" />
                          <span className="text-sm text-gray-600">{team.captainPseudo || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Users size={14} className="text-gray-400" />
                          <span
                            className={`text-sm font-medium ${
                              team.members?.length >= playersPerTeam ? 'text-green-600' : 'text-orange-600'
                            }`}
                          >
                            {team.members?.length || 0}/{playersPerTeam}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-medium text-gray-700">{team.weight || '-'}</span>
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
                          {team.recruitmentOpen && <span className="badge badge-info text-xs">Recrute</span>}
                          {team.isAssigned && <span className="badge badge-default text-xs">En poule</span>}
                          {team.isWaitingList && (
                            <span className="badge bg-amber-100 text-amber-800 border-amber-300 text-xs">
                              En attente
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Reordering buttons in waiting list */}
                          {activeTab === 'waitingList' && (
                            <>
                              <button
                                onClick={() => handleMoveUp(index, filteredTeams)}
                                disabled={index === 0 || actionLoading}
                                className={`p-1.5 rounded transition-colors ${
                                  index === 0 || actionLoading
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title="Monter dans la liste d'attente"
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                onClick={() => handleMoveDown(index, filteredTeams)}
                                disabled={index === filteredTeams.length - 1 || actionLoading}
                                className={`p-1.5 rounded transition-colors ${
                                  index === filteredTeams.length - 1 || actionLoading
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title="Descendre dans la liste d'attente"
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                onClick={() => handlePromoteFromWaitingList(team.id, team.name)}
                                disabled={actionLoading}
                                className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                title="Intégrer au tournoi principal"
                              >
                                <ArrowUpCircle size={18} />
                              </button>
                            </>
                          )}

                          {/* Move to waiting list button in registered list */}
                          {activeTab === 'registered' && (
                            <button
                              onClick={() => handleMoveToWaitingList(team.id, team.name)}
                              disabled={actionLoading}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                              title="Basculer en liste d'attente"
                            >
                              <Clock size={18} />
                            </button>
                          )}

                          <Link
                            to={`/admin/tournaments/${tournamentId}/teams/${team.id}/edit`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Edit size={18} />
                          </Link>
                          <button
                            onClick={() => handleDelete(team.id, team.name)}
                            disabled={actionLoading}
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
                  <p className="text-gray-500 mb-4">Aucune équipe ne correspond à vos critères de recherche</p>
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
              ) : activeTab === 'waitingList' ? (
                <>
                  <p className="text-gray-600 mb-2">Aucune équipe en liste d'attente</p>
                  <p className="text-sm text-gray-400">
                    Les équipes inscrites quand le tournoi est complet apparaîtront ici.
                  </p>
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
