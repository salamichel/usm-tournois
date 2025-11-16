import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Edit2, Trash2, Users, Trophy } from 'lucide-react';

const AdminPoolsManagement = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [pools, setPools] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPoolName, setNewPoolName] = useState('');

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, poolsRes, teamsRes] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getPools(tournamentId!),
        adminService.getTeams(tournamentId!),
      ]);

      setTournament(tournamentRes.tournament);
      setPools(poolsRes.pools || []);
      setTeams(teamsRes.teams || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoolName.trim()) return;

    try {
      await adminService.createPool(tournamentId!, { name: newPoolName });
      toast.success('Poule créée avec succès');
      setNewPoolName('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleGenerateMatches = async (poolId: string) => {
    if (!confirm('Ceci va supprimer tous les matchs existants et en générer de nouveaux. Continuer ?')) return;

    try {
      await adminService.generatePoolMatches(tournamentId!, poolId);
      toast.success('Matchs générés avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération');
    }
  };

  const handleAssignTeams = async (poolId: string, selectedTeamIds: string[]) => {
    try {
      await adminService.assignTeamsToPool(tournamentId!, poolId, selectedTeamIds);
      toast.success('Équipes assignées avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'assignation');
    }
  };

  const handleGenerateElimination = async () => {
    if (!confirm('Voulez-vous vraiment générer les matchs d\'élimination ? Cette action est irréversible.')) return;

    try {
      await adminService.generateEliminationBracket(tournamentId!);
      toast.success('Matchs d\'élimination générés avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Chargement...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold">
            Gestion des Poules - {tournament?.name}
          </h1>
        </div>

        {/* Créer une nouvelle poule */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Créer une nouvelle Poule</h2>
          <form onSubmit={handleCreatePool} className="flex gap-4">
            <input
              type="text"
              value={newPoolName}
              onChange={(e) => setNewPoolName(e.target.value)}
              placeholder="Nom de la poule (ex: Poule A)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Plus size={18} />
              Créer la Poule
            </button>
          </form>
        </div>

        {/* Phase d'élimination */}
        {tournament?.eliminationPhaseEnabled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy size={20} />
              Phase d'Élimination
            </h2>
            <p className="text-gray-700 mb-4">
              Générez les matchs pour la phase d'élimination en fonction des résultats des poules.
            </p>
            <div className="flex gap-4">
              <Link
                to={`/admin/tournaments/${tournamentId}/elimination`}
                className="btn-primary"
              >
                Accéder aux Matchs d'Élimination
              </Link>
              <button
                onClick={handleGenerateElimination}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md"
              >
                Générer/Régénérer les Matchs
              </button>
            </div>
          </div>
        )}

        {/* Liste des poules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pools.map((pool, index) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              teams={teams}
              tournamentId={tournamentId!}
              colorIndex={index}
              onGenerateMatches={handleGenerateMatches}
              onAssignTeams={handleAssignTeams}
            />
          ))}
        </div>

        {pools.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600">Aucune poule créée pour ce tournoi</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

interface PoolCardProps {
  pool: any;
  teams: any[];
  tournamentId: string;
  colorIndex: number;
  onGenerateMatches: (poolId: string) => void;
  onAssignTeams: (poolId: string, teamIds: string[]) => void;
}

const PoolCard = ({ pool, teams, tournamentId, colorIndex, onGenerateMatches, onAssignTeams }: PoolCardProps) => {
  const colors = ['bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-red-50', 'bg-yellow-50'];
  const borderColors = ['border-blue-200', 'border-green-200', 'border-purple-200', 'border-red-200', 'border-yellow-200'];
  const colorClass = colors[colorIndex % colors.length];
  const borderClass = borderColors[colorIndex % borderColors.length];

  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    pool.teams?.map((t: any) => t.id) || []
  );

  const handleToggleTeam = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssignTeams(pool.id, selectedTeams);
  };

  return (
    <div className={`${colorClass} border ${borderClass} rounded-lg p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold">{pool.name}</h3>
        <button className="text-red-600 hover:text-red-800">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Classement */}
      {pool.ranking && pool.ranking.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-2">Classement</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-3 text-left">Équipe</th>
                  <th className="py-2 px-2 text-center">V</th>
                  <th className="py-2 px-2 text-center">D</th>
                  <th className="py-2 px-2 text-center">Sets</th>
                </tr>
              </thead>
              <tbody>
                {pool.ranking.map((team: any, idx: number) => (
                  <tr key={idx} className="border-t border-gray-200">
                    <td className="py-2 px-3">{team.name}</td>
                    <td className="py-2 px-2 text-center">{team.wins || 0}</td>
                    <td className="py-2 px-2 text-center">{team.losses || 0}</td>
                    <td className="py-2 px-2 text-center">{team.setsWon || 0}-{team.setsLost || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignation des équipes */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2">
          Équipes ({pool.teams?.length || 0})
        </h4>
        <form onSubmit={handleSubmit}>
          <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto mb-3">
            {teams.map(team => {
              const isInThisPool = pool.teams?.some((t: any) => t.id === team.id);
              const isInOtherPool = team.isAssigned && !isInThisPool;

              return (
                <label
                  key={team.id}
                  className={`flex items-center gap-2 mb-2 cursor-pointer ${isInOtherPool ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(team.id)}
                    onChange={() => handleToggleTeam(team.id)}
                    disabled={isInOtherPool}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    {team.name}
                    {isInOtherPool && <span className="text-gray-500 ml-1">(Assignée)</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <button type="submit" className="btn-primary text-sm">
            Mettre à jour les équipes
          </button>
        </form>
      </div>

      {/* Génération des matchs */}
      <div>
        <h4 className="text-lg font-semibold mb-2">Matchs</h4>
        <button
          onClick={() => onGenerateMatches(pool.id)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm mb-3"
        >
          Générer les Matchs
        </button>

        {pool.matches && pool.matches.length > 0 && (
          <div className="text-sm space-y-2">
            {pool.matches.slice(0, 5).map((match: any, idx: number) => (
              <div key={idx} className="bg-white p-2 rounded border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs">{match.team1?.name || 'Équipe 1'}</span>
                  <span className="text-xs font-semibold">vs</span>
                  <span className="text-xs">{match.team2?.name || 'Équipe 2'}</span>
                </div>
                {match.status === 'completed' && (
                  <div className="text-center text-xs text-gray-600 mt-1">
                    Score: {match.score1}-{match.score2}
                  </div>
                )}
              </div>
            ))}
            {pool.matches.length > 5 && (
              <p className="text-xs text-gray-600 text-center">
                +{pool.matches.length - 5} autres matchs
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPoolsManagement;
