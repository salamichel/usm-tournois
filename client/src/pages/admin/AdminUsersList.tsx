import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import clubService from '@services/club.service';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Shield, User, Users } from 'lucide-react';
import type { Club } from '@shared/types/club.types';

const AdminUsersList = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchUsers();
    loadClubs();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await adminService.getAllUsers();
      if (response.success && response.data) {
        setUsers(response.data.users);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClubs = async () => {
    try {
      const response = await clubService.getAllClubs();
      if (response.success && response.data) {
        setClubs(response.data.clubs);
      }
    } catch (error) {
      console.error('Error loading clubs:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

    try {
      setDeletingId(id);
      const response = await adminService.deleteUser(id);
      if (response.success) {
        toast.success('Utilisateur supprimé avec succès');
        fetchUsers();
      }
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Aucun utilisateur sélectionné');
      return;
    }

    try {
      setIsUpdating(true);
      const response = await adminService.bulkUpdateUsers(
        Array.from(selectedUsers),
        selectedClubId || null
      );

      if (response.success) {
        toast.success(response.message || 'Utilisateurs mis à jour avec succès');
        setShowBulkModal(false);
        setSelectedUsers(new Set());
        setSelectedClubId('');
        fetchUsers();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message || 'Erreur lors de la mise à jour'
      );
    } finally {
      setIsUpdating(false);
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
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
            <p className="text-gray-600 mt-2">Gérer les comptes utilisateurs</p>
          </div>
          <div className="flex gap-3">
            {selectedUsers.size > 0 && (
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={() => setShowBulkModal(true)}
              >
                <Users size={20} />
                Affecter un club ({selectedUsers.size})
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => navigate('/admin/users/new')}
            >
              <Plus size={20} className="mr-2" />
              Nouvel Utilisateur
            </button>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pseudo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Niveau</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Club</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => {
                  const userClub = clubs.find(c => c.id === user.clubId);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' ? (
                            <Shield className="text-orange-600" size={16} />
                          ) : (
                            <User className="text-gray-400" size={16} />
                          )}
                          <span className="font-medium text-gray-900">{user.pseudo}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.level || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {userClub ? (
                          <div className="flex items-center gap-2">
                            {userClub.logo && (
                              <img
                                src={userClub.logo}
                                alt={userClub.name}
                                className="h-5 w-5 object-contain"
                              />
                            )}
                            <span>{userClub.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Aucun</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          user.role === 'admin' ? 'badge-warning' : 'badge-default'
                        }`}>
                          {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Modifier l'utilisateur"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deletingId === user.id || user.role === 'admin'}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            title={user.role === 'admin' ? 'Impossible de supprimer un admin' : 'Supprimer'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Aucun utilisateur trouvé</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Update Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Affecter un club en masse
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedUsers.size} utilisateur(s) sélectionné(s)
            </p>

            <div className="mb-6">
              <label
                htmlFor="clubId"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Club
              </label>
              <select
                id="clubId"
                className="input w-full"
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
              >
                <option value="">Aucun club (retirer le club)</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setSelectedClubId('');
                }}
                className="btn-secondary"
                disabled={isUpdating}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleBulkUpdate}
                className="btn-primary"
                disabled={isUpdating}
              >
                {isUpdating ? 'Mise à jour...' : 'Affecter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsersList;
