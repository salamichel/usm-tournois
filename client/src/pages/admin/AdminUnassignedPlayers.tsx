import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, UserMinus, Trash2, Shuffle } from 'lucide-react';

const AdminUnassignedPlayers = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, playersRes] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getUnassignedPlayers(tournamentId!),
      ]);

      setTournament(tournamentRes.data?.tournament);
      setPlayers(playersRes.data?.players || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePlayer = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce joueur ?')) return;

    try {
      await adminService.removeUnassignedPlayer(tournamentId!, userId);
      toast.success('Joueur retiré avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleGenerateRandomTeams = async () => {
    if (!confirm(`Voulez-vous générer les équipes équilibrées avec ${players.length} joueur(s) ?\n\nCette action créera des équipes de ${tournament.playersPerTeam} joueurs équilibrées par niveau.`)) {
      return;
    }

    try {
      setGenerating(true);
      const response = await adminService.generateRandomTeams(tournamentId!);
      toast.success(response.message || 'Équipes générées avec succès');

      if (response.data?.remainingPlayers > 0) {
        toast.success(`${response.data.remainingPlayers} joueur(s) restant(s) non assigné(s)`, { duration: 5000 });
      }

      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération des équipes');
    } finally {
      setGenerating(false);
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserMinus size={28} />
            Joueurs non assignés - {tournament?.name}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">
              {tournament?.registrationMode === 'random'
                ? `${players.length} joueur(s) inscrit(s). Les équipes seront générées de manière équilibrée par niveau.`
                : 'Ces joueurs se sont inscrits au tournoi mais n\'ont pas encore rejoint ou créé d\'équipe.'}
            </p>
            {tournament?.registrationMode === 'random' && players.length > 0 && (
              <button
                onClick={handleGenerateRandomTeams}
                disabled={generating || players.length < tournament.playersPerTeam}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={players.length < tournament.playersPerTeam ? `Besoin d'au moins ${tournament.playersPerTeam} joueurs` : 'Générer les équipes équilibrées par niveau'}
              >
                <Shuffle size={18} />
                {generating ? 'Génération...' : 'Générer les équipes équilibrées'}
              </button>
            )}
          </div>

          {players.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pseudo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sexe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Niveau
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.map(player => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{player.pseudo}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {player.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {player.sexe === 'femme' ? 'F' : 'H'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          player.level?.toLowerCase() === 'débutant' ? 'bg-gray-100 text-gray-800' :
                          player.level?.toLowerCase() === 'intermédiaire' ? 'bg-blue-100 text-blue-800' :
                          player.level?.toLowerCase() === 'confirmé' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {player.level || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleRemovePlayer(player.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Retirer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UserMinus size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Aucun joueur non assigné</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUnassignedPlayers;
