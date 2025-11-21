import { useState, useEffect } from 'react';
import AdminLayout from '@components/AdminLayout';
import seasonService from '@services/season.service';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Calendar, Check, X, Star } from 'lucide-react';
import type { Season } from '@shared/types/season.types';

const AdminSeasonsList = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setIsLoading(true);
      const response = await seasonService.getAllSeasons();
      if (response.success && response.data) {
        setSeasons(response.data.seasons);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des saisons');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateForInput = (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const formatDateForDisplay = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error('Tous les champs sont requis');
      return;
    }

    try {
      const response = await seasonService.createSeason({
        name: formData.name,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
      });

      if (response.success) {
        toast.success('Saison créée avec succès');
        setIsCreating(false);
        setFormData({ name: '', startDate: '', endDate: '' });
        fetchSeasons();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la création';
      toast.error(errorMessage);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error('Tous les champs sont requis');
      return;
    }

    try {
      const response = await seasonService.updateSeason(id, {
        name: formData.name,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
      });

      if (response.success) {
        toast.success('Saison mise à jour avec succès');
        setEditingId(null);
        setFormData({ name: '', startDate: '', endDate: '' });
        fetchSeasons();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette saison ?')) return;

    try {
      setDeletingId(id);
      const response = await seasonService.deleteSeason(id);
      if (response.success) {
        toast.success('Saison supprimée avec succès');
        fetchSeasons();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const response = await seasonService.updateSeason(id, { isActive: true });
      if (response.success) {
        toast.success('Saison définie comme active');
        fetchSeasons();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
    }
  };

  const startEdit = (season: Season) => {
    setEditingId(season.id);
    setIsCreating(false);
    setFormData({
      name: season.name,
      startDate: formatDateForInput(season.startDate),
      endDate: formatDateForInput(season.endDate),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: '', startDate: '', endDate: '' });
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({ name: '', startDate: '', endDate: '' });
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
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Saisons</h1>
            <p className="text-gray-600 mt-2">Gérer les périodes de classement</p>
          </div>
          {!isCreating && (
            <button className="btn-primary" onClick={startCreate}>
              <Plus size={20} className="mr-2" />
              Nouvelle Saison
            </button>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date Début
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date Fin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Create new season row */}
                {isCreating && (
                  <tr className="bg-green-50">
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="ex: 2025-2026"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400 text-sm">Nouvelle</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleCreate}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                          title="Créer"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Annuler"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Existing seasons */}
                {seasons.map((season) => (
                  <tr key={season.id} className={`hover:bg-gray-50 ${season.isActive ? 'bg-yellow-50' : ''}`}>
                    {editingId === season.id ? (
                      <>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          {season.isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                              <Star size={12} />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleUpdate(season.id)}
                              className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                              title="Sauvegarder"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                              title="Annuler"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span className="font-medium text-gray-900">{season.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateForDisplay(season.startDate)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateForDisplay(season.endDate)}
                        </td>
                        <td className="px-6 py-4">
                          {season.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                              <Star size={12} />
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetActive(season.id)}
                              className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
                            >
                              Définir comme active
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => startEdit(season)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Modifier"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(season.id)}
                              disabled={deletingId === season.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              title="Supprimer"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {seasons.length === 0 && !isCreating && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Aucune saison créée. Cliquez sur "Nouvelle Saison" pour commencer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Help section */}
        <div className="card p-6 bg-blue-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Information</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <strong>Saison active :</strong> La saison affichée par défaut dans le classement des joueurs.
            </li>
            <li>
              <strong>Attribution automatique :</strong> Quand un tournoi est "figé", les points sont automatiquement attribués à la saison correspondant à la date du tournoi.
            </li>
            <li>
              <strong>Pas de chevauchement :</strong> Les dates des saisons ne peuvent pas se chevaucher.
            </li>
            <li>
              <strong>Re-freeze :</strong> Vous pouvez relancer le freeze d'un tournoi pour réattribuer les points (utile si vous avez créé la saison après le freeze).
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSeasonsList;
