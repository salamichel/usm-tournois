import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserCog, Link as LinkIcon, Users, ArrowLeft, UserPlus, CheckSquare, Square, Trash2 } from 'lucide-react';
import type { UserLevel } from '@shared/types';

interface VirtualUser {
  id: string;
  pseudo: string;
  email: string;
  level: string;
  isVirtual: boolean;
  createdAt: string;
  teams: {
    teamId: string;
    teamName: string;
    tournamentId: string;
    tournamentName: string;
    isCaptain: boolean;
  }[];
}

interface RealUser {
  id: string;
  pseudo: string;
  email: string;
  level: string;
}

const AdminVirtualUsers = () => {
  const [virtualUsers, setVirtualUsers] = useState<VirtualUser[]>([]);
  const [realUsers, setRealUsers] = useState<RealUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVirtualUsers, setSelectedVirtualUsers] = useState<VirtualUser[]>([]);
  const [selectedRealUserId, setSelectedRealUserId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for creating new real user
  const [newUserForm, setNewUserForm] = useState({
    pseudo: '',
    email: '',
    password: '',
    level: 'Intermédiaire' as UserLevel,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch virtual users
      const virtualResponse = await fetch('/api/admin/virtual-users', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!virtualResponse.ok) throw new Error('Failed to fetch virtual users');
      const virtualData = await virtualResponse.json();

      // Fetch all users to get real users
      const usersResponse = await fetch('/api/admin/users', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!usersResponse.ok) throw new Error('Failed to fetch users');
      const usersData = await usersResponse.json();

      setVirtualUsers(virtualData.data.virtualUsers);
      setRealUsers(usersData.data.users.filter((u: any) => !u.isVirtual));
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectUser = (user: VirtualUser) => {
    setSelectedVirtualUsers((prev) => {
      const isSelected = prev.some((u) => u.id === user.id);
      if (isSelected) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const selectAll = () => {
    if (selectedVirtualUsers.length === filteredUsers.length) {
      setSelectedVirtualUsers([]);
    } else {
      setSelectedVirtualUsers([...filteredUsers]);
    }
  };

  const handleLinkClick = () => {
    if (selectedVirtualUsers.length === 0) {
      toast.error('Sélectionnez au moins un compte virtuel');
      return;
    }
    setShowLinkModal(true);
  };

  const handleLink = async () => {
    if (selectedVirtualUsers.length === 0 || !selectedRealUserId) return;

    try {
      setProcessing(true);

      // Link each virtual user to the real user
      for (const virtualUser of selectedVirtualUsers) {
        const response = await fetch('/api/admin/virtual-users/link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            virtualUserId: virtualUser.id,
            realUserId: selectedRealUserId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `Erreur lors de la liaison de ${virtualUser.pseudo}`);
        }
      }

      toast.success(`${selectedVirtualUsers.length} compte(s) virtuel(s) lié(s) avec succès !`);
      setShowLinkModal(false);
      setSelectedVirtualUsers([]);
      setSelectedRealUserId('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la liaison des comptes');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserForm.pseudo || !newUserForm.email || !newUserForm.password) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (newUserForm.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      setProcessing(true);

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pseudo: newUserForm.pseudo,
          email: newUserForm.email,
          password: newUserForm.password,
          level: newUserForm.level,
          role: 'player',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erreur lors de la création');
      }

      const result = await response.json();

      toast.success('Compte réel créé avec succès !');
      setShowCreateModal(false);
      setNewUserForm({ pseudo: '', email: '', password: '', level: 'Intermédiaire' });

      // Refresh data and auto-select the new user
      await fetchData();
      setSelectedRealUserId(result.data.id);

      // If there were selected virtual users, ask if they want to link now
      if (selectedVirtualUsers.length > 0) {
        setShowLinkModal(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du compte');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateAndLink = () => {
    // Pre-fill the form with the first selected virtual user's info
    if (selectedVirtualUsers.length > 0) {
      const firstUser = selectedVirtualUsers[0];
      setNewUserForm({
        pseudo: firstUser.pseudo,
        email: '',
        password: '',
        level: firstUser.level as UserLevel,
      });
    }
    setShowCreateModal(true);
  };

  const handleDelete = async (user: VirtualUser) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le compte virtuel "${user.pseudo}" ?\n\nCette action est irréversible et supprimera également ce joueur de toutes les équipes.`)) {
      return;
    }

    try {
      setDeletingId(user.id);

      const response = await fetch(`/api/admin/virtual-users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erreur lors de la suppression');
      }

      toast.success(`Compte virtuel "${user.pseudo}" supprimé avec succès`);

      // Remove from selected users if it was selected
      setSelectedVirtualUsers((prev) => prev.filter((u) => u.id !== user.id));

      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression du compte');
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter users based on search
  const filteredUsers = virtualUsers.filter(
    (user) =>
      user.pseudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.teams.some((t) => t.teamName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/admin"
        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
      >
        <ArrowLeft size={20} />
        Retour au dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <UserCog size={32} />
          Gestion des comptes virtuels
        </h1>
        <p className="text-gray-600 mt-2">
          Consolidez les comptes virtuels en les liant à un compte réel pour unifier les points
        </p>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Comment consolider les comptes ?</h3>
        <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
          <li>Sélectionnez les comptes virtuels qui appartiennent à la même personne</li>
          <li>Créez un compte réel pour cette personne (ou sélectionnez-en un existant)</li>
          <li>Liez tous les comptes virtuels sélectionnés à ce compte réel</li>
        </ol>
        <p className="text-sm text-blue-700 mt-2">
          Les points seront automatiquement consolidés sur le compte réel.
        </p>
      </div>

      {virtualUsers.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg">Aucun compte virtuel trouvé</p>
        </div>
      ) : (
        <>
          {/* Search and actions bar */}
          <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <input
              type="text"
              placeholder="Rechercher par pseudo, email ou équipe..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="flex gap-2 flex-wrap">
              {selectedVirtualUsers.length > 0 && (
                <>
                  <span className="text-sm text-gray-600 self-center">
                    {selectedVirtualUsers.length} sélectionné(s)
                  </span>
                  <button
                    onClick={handleCreateAndLink}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <UserPlus size={16} />
                    Créer un compte réel
                  </button>
                  <button
                    onClick={handleLinkClick}
                    className="btn-primary flex items-center gap-2"
                  >
                    <LinkIcon size={16} />
                    Lier à un compte existant
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Comptes virtuels ({filteredUsers.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={selectAll}
                        className="text-gray-500 hover:text-gray-700"
                        title={selectedVirtualUsers.length === filteredUsers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      >
                        {selectedVirtualUsers.length === filteredUsers.length && filteredUsers.length > 0 ? (
                          <CheckSquare size={20} />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pseudo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Niveau
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Équipes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedVirtualUsers.some((u) => u.id === user.id);
                    return (
                      <tr
                        key={user.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleSelectUser(user)}
                      >
                        <td className="px-4 py-4">
                          {isSelected ? (
                            <CheckSquare size={20} className="text-primary-600" />
                          ) : (
                            <Square size={20} className="text-gray-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{user.pseudo}</div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {user.level}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.teams.length > 0 ? (
                            <div className="text-sm text-gray-900">
                              {user.teams.map((team, idx) => (
                                <div key={idx} className="mb-1">
                                  {team.teamName} ({team.tournamentName})
                                  {team.isCaptain && (
                                    <span className="ml-2 text-xs text-primary-600 font-semibold">
                                      Capitaine
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Aucune équipe</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedVirtualUsers([user]);
                                setShowLinkModal(true);
                              }}
                              className="btn-primary-outline flex items-center gap-2"
                            >
                              <LinkIcon size={16} />
                              Lier
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={deletingId === user.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Supprimer le compte virtuel"
                            >
                              {deletingId === user.id ? (
                                <div className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Link Modal */}
      {showLinkModal && selectedVirtualUsers.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Lier {selectedVirtualUsers.length} compte(s) virtuel(s)
            </h3>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg max-h-48 overflow-y-auto">
              <h4 className="font-semibold text-gray-900 mb-2">Comptes virtuels à lier :</h4>
              {selectedVirtualUsers.map((user) => (
                <div key={user.id} className="text-sm text-gray-700 mb-2 pb-2 border-b border-blue-100 last:border-0">
                  <strong>{user.pseudo}</strong> ({user.level})
                  {user.teams.length > 0 && (
                    <span className="text-gray-500 ml-2">
                      - {user.teams.map((t) => t.teamName).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sélectionner le compte réel de destination
              </label>
              <select
                className="input"
                value={selectedRealUserId}
                onChange={(e) => setSelectedRealUserId(e.target.value)}
              >
                <option value="">-- Choisir un utilisateur --</option>
                {realUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.pseudo} ({user.email}) - {user.level}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  handleCreateAndLink();
                }}
                className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
              >
                <UserPlus size={16} />
                Ou créer un nouveau compte réel
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLink}
                disabled={processing || !selectedRealUserId}
                className="btn-primary flex-1"
              >
                {processing ? 'Liaison en cours...' : 'Lier les comptes'}
              </button>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSelectedRealUserId('');
                }}
                disabled={processing}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus size={24} />
              Créer un compte réel
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label htmlFor="pseudo" className="block text-sm font-medium text-gray-700 mb-1">
                  Pseudo *
                </label>
                <input
                  type="text"
                  id="pseudo"
                  className="input"
                  value={newUserForm.pseudo}
                  onChange={(e) => setNewUserForm({ ...newUserForm, pseudo: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  className="input"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  required
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe * (min. 6 caractères)
                </label>
                <input
                  type="password"
                  id="password"
                  className="input"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                  Niveau
                </label>
                <select
                  id="level"
                  className="input"
                  value={newUserForm.level}
                  onChange={(e) => setNewUserForm({ ...newUserForm, level: e.target.value as UserLevel })}
                >
                  <option value="Débutant">Débutant</option>
                  <option value="Intermédiaire">Intermédiaire</option>
                  <option value="Confirmé">Confirmé</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={processing}
                  className="btn-primary flex-1"
                >
                  {processing ? 'Création...' : 'Créer le compte'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewUserForm({ pseudo: '', email: '', password: '', level: 'Intermédiaire' });
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVirtualUsers;
