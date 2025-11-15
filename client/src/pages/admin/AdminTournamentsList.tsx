import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Copy, Eye, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AdminTournamentsList = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setIsLoading(true);
      const response = await adminService.getAllTournaments();
      if (response.success && response.data) {
        setTournaments(response.data.tournaments);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des tournois');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce tournoi ?')) return;

    try {
      setDeletingId(id);
      const response = await adminService.deleteTournament(id);
      if (response.success) {
        toast.success('Tournoi supprimé avec succès');
        fetchTournaments();
      }
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClone = async (id: string) => {
    if (!confirm('Voulez-vous cloner ce tournoi ?')) return;

    try {
      const response = await adminService.cloneTournament(id);
      if (response.success) {
        toast.success('Tournoi cloné avec succès');
        fetchTournaments();
      }
    } catch (error: any) {
      toast.error('Erreur lors du clonage');
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Tournois</h1>
            <p className="text-gray-600 mt-2">Créer, modifier et gérer les tournois</p>
          </div>
          <Link to="/admin/tournaments/new" className="btn-primary">
            <Plus size={20} className="mr-2" />
            Nouveau Tournoi
          </Link>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lieu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Équipes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tournaments.map((tournament) => (
                  <tr key={tournament.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{tournament.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tournament.date
                        ? format(new Date(tournament.date), 'dd/MM/yyyy', { locale: fr })
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{tournament.location}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tournament.registeredTeamsCount || 0} / {tournament.maxTeams}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${
                        tournament.isActive ? 'badge-success' : 'badge-default'
                      }`}>
                        {tournament.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/tournoi/${tournament.id}`}
                          className="text-gray-600 hover:text-gray-900"
                          title="Voir"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link
                          to={`/admin/tournaments/${tournament.id}/king`}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Mode King"
                        >
                          <Crown size={18} />
                        </Link>
                        <Link
                          to={`/admin/tournaments/${tournament.id}/edit`}
                          className="text-blue-600 hover:text-blue-900"
                          title="Modifier"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleClone(tournament.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Cloner"
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(tournament.id)}
                          disabled={deletingId === tournament.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
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
            {tournaments.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Aucun tournoi trouvé</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTournamentsList;
