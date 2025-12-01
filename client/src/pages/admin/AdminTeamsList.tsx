import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Users, Trash2, Edit } from 'lucide-react';

const AdminTeamsList = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (teamId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette équipe ?')) return;

    try {
      await adminService.deleteTeam(tournamentId!, teamId);
      toast.success('Équipe supprimée avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold">
              Équipes - {tournament?.name}
            </h1>
          </div>
          <Link
            to={`/admin/tournaments/${tournamentId}/teams/new`}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Nouvelle Équipe
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom de l'équipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capitaine
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joueurs
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.map(team => (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users size={18} className="text-gray-400 mr-2" />
                      <span className="font-medium text-gray-900">{team.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {team.captain?.pseudo || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                    {team.members?.length || 0} / {tournament?.playersPerTeam || 4}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      team.isComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {team.isComplete ? 'Complète' : 'Incomplète'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/admin/tournaments/${tournamentId}/teams/${team.id}/edit`}
                        className="text-blue-600 hover:text-blue-900"
                        title="Modifier"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(team.id)}
                        className="text-red-600 hover:text-red-900"
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

          {teams.length === 0 && (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Aucune équipe inscrite</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTeamsList;
