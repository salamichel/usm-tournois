import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import clubService from '@services/club.service';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import type { ClubWithStats } from '@shared/types/club.types';

const AdminClubsList = () => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<ClubWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      setIsLoading(true);
      const response = await clubService.getAllClubs();
      if (response.success && response.data) {
        setClubs(response.data.clubs);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des clubs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce club ?')) return;

    try {
      setDeletingId(id);
      const response = await clubService.deleteClub(id);
      if (response.success) {
        toast.success('Club supprimé avec succès');
        fetchClubs();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(errorMessage);
    } finally {
      setDeletingId(null);
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
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Clubs</h1>
            <p className="text-gray-600 mt-2">Gérer les clubs et leurs logos</p>
          </div>
          <button
            className="btn-primary"
            onClick={() => navigate('/admin/clubs/new')}
          >
            <Plus size={20} className="mr-2" />
            Nouveau Club
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Logo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joueurs</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clubs.map((club) => (
                  <tr key={club.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {club.logo ? (
                        <img
                          src={club.logo}
                          alt={club.name}
                          className="h-10 w-10 object-contain rounded"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                          <Users size={20} className="text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{club.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-gray-400" />
                        <span>{club.playerCount} joueur{club.playerCount !== 1 ? 's' : ''}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/admin/clubs/${club.id}/edit`)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Modifier le club"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(club.id)}
                          disabled={deletingId === club.id || club.playerCount > 0}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title={club.playerCount > 0 ? 'Impossible de supprimer un club avec des joueurs' : 'Supprimer'}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clubs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Aucun club trouvé</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminClubsList;
