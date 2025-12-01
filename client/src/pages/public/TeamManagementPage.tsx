import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import teamService from '@services/team.service';
import userService from '@services/user.service';
import type { Team, AddTeamMemberDto, AddVirtualMemberDto, UserLevel, User } from '@shared/types';
import toast from 'react-hot-toast';
import { Users, UserPlus, UserMinus, Settings, ArrowLeft, Search } from 'lucide-react';

const TeamManagementPage = () => {
  const { tournamentId, id } = useParams<{ tournamentId: string; id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showVirtualForm, setShowVirtualForm] = useState(false);
  const [addMemberFormData, setAddMemberFormData] = useState({
    memberId: '',
  });
  const [addVirtualMemberFormData, setAddVirtualMemberFormData] = useState({
    pseudo: '',
    level: 'Intermédiaire' as UserLevel,
    email: '',
  });
  const [settingsFormData, setSettingsFormData] = useState({
    recruitmentOpen: false,
  });

  useEffect(() => {
    if (id && tournamentId) {
      fetchTeam();
    }
  }, [id, tournamentId]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSearchUsers();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const response = await userService.searchUsers(searchQuery.trim(), false);
      if (response.success && response.data) {
        setSearchResults(response.data.users || []);
      }
    } catch (error: any) {
      console.error('Erreur lors de la recherche:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchTeam = async () => {
    if (!id || !tournamentId) return;
    try {
      setIsLoading(true);
      const response = await teamService.getTeamById(id, tournamentId);
      if (response.success && response.data) {
        const teamData = response.data.team;
        setTeam(teamData);
        setSettingsFormData({
          recruitmentOpen: teamData.recruitmentOpen || false,
        });
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de l\'équipe');
      navigate('/mon-compte');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !tournamentId || !addMemberFormData.memberId) return;

    try {
      setProcessingAction(true);
      const response = await teamService.addMember(id, {
        tournamentId,
        memberId: addMemberFormData.memberId,
      });
      if (response.success) {
        toast.success('Membre ajouté avec succès !');
        setShowAddMemberModal(false);
        setAddMemberFormData({ memberId: '' });
        setSearchQuery('');
        setSearchResults([]);
        fetchTeam();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors de l\'ajout du membre'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSelectUser = async (selectedUser: User) => {
    if (!id || !tournamentId) return;

    try {
      setProcessingAction(true);
      const response = await teamService.addMember(id, {
        tournamentId,
        memberId: selectedUser.id,
      });
      if (response.success) {
        toast.success(`${selectedUser.pseudo} ajouté avec succès !`);
        setShowAddMemberModal(false);
        setSearchQuery('');
        setSearchResults([]);
        setShowVirtualForm(false);
        fetchTeam();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors de l\'ajout du membre'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleAddVirtualMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !tournamentId || !addVirtualMemberFormData.pseudo) return;

    try {
      setProcessingAction(true);
      const response = await teamService.addVirtualMember(id, {
        tournamentId,
        pseudo: addVirtualMemberFormData.pseudo,
        level: addVirtualMemberFormData.level,
        email: addVirtualMemberFormData.email || undefined,
      });
      if (response.success) {
        toast.success('Membre virtuel ajouté avec succès !');
        setShowAddMemberModal(false);
        setAddVirtualMemberFormData({ pseudo: '', level: 'Intermédiaire' as UserLevel, email: '' });
        setSearchQuery('');
        setSearchResults([]);
        setShowVirtualForm(false);
        fetchTeam();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors de l\'ajout du membre virtuel'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleShowVirtualForm = () => {
    setShowVirtualForm(true);
    setAddVirtualMemberFormData({
      pseudo: searchQuery,
      level: 'Intermédiaire' as UserLevel,
      email: '',
    });
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id || !tournamentId || !confirm('Voulez-vous vraiment retirer ce membre ?')) return;

    try {
      setProcessingAction(true);
      const response = await teamService.removeMember(id, {
        tournamentId,
        memberId: userId,
      });
      if (response.success) {
        toast.success('Membre retiré avec succès !');
        fetchTeam();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors du retrait du membre'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !tournamentId) return;

    try {
      setProcessingAction(true);
      const response = await teamService.updateTeamSettings(id, {
        tournamentId,
        recruitmentOpen: settingsFormData.recruitmentOpen,
      });
      if (response.success) {
        toast.success('Paramètres mis à jour !');
        setShowSettingsModal(false);
        fetchTeam();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors de la mise à jour'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!team || team.captainId !== user?.uid) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-gray-500 text-lg">
            Vous n'avez pas les droits pour gérer cette équipe
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
      >
        <ArrowLeft size={20} />
        Retour
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
        <p className="text-gray-600 mt-2">
          Gérez les membres de votre équipe
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setShowAddMemberModal(true)}
          className="btn-primary"
        >
          <UserPlus size={20} className="mr-2" />
          Ajouter un membre
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="btn-secondary"
        >
          <Settings size={20} className="mr-2" />
          Paramètres
        </button>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Membres ({team.members?.length || 0})
        </h2>
        {team.members && team.members.length > 0 ? (
          <div className="space-y-3">
            {team.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {member.pseudo}
                      {member.userId === team.captainId && (
                        <span className="text-primary-600 ml-2 text-sm">(Capitaine)</span>
                      )}
                    </p>
                    {member.email && (
                      <p className="text-sm text-gray-500">{member.email}</p>
                    )}
                  </div>
                </div>
                {member.userId !== team.captainId && (
                  <button
                    onClick={() => handleRemoveMember(member.userId)}
                    disabled={processingAction}
                    className="btn-danger-outline"
                  >
                    <UserMinus size={16} className="mr-1" />
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Aucun membre pour le moment</p>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Ajouter un membre
            </h3>

            {!showVirtualForm ? (
              <div className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rechercher un joueur
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      className="input pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Nom ou email du joueur..."
                      autoFocus
                    />
                  </div>
                  {isSearching && (
                    <div className="absolute right-3 top-9 transform">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {searchQuery.trim().length >= 2 && (
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      <div className="divide-y">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            disabled={processingAction}
                            className="w-full p-3 hover:bg-gray-50 text-left transition-colors disabled:opacity-50"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {user.pseudo}
                                  {user.isVirtual && (
                                    <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                      Virtuel
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                                {user.level && (
                                  <p className="text-xs text-gray-400 mt-1">Niveau: {user.level}</p>
                                )}
                              </div>
                              <UserPlus size={18} className="text-primary-600" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : !isSearching ? (
                      <div className="p-4 text-center">
                        <p className="text-gray-500 mb-3">
                          Aucun joueur trouvé pour "{searchQuery}"
                        </p>
                        <button
                          onClick={handleShowVirtualForm}
                          className="btn-secondary w-full"
                        >
                          Créer un compte virtuel
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {searchQuery.trim().length < 2 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    Tapez au moins 2 caractères pour rechercher un joueur
                  </div>
                )}
              </div>
            ) : (
              /* Virtual Member Form */
              <form onSubmit={handleAddVirtualMember} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    Créer un compte virtuel pour un joueur qui n'a pas encore de compte
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pseudo du joueur *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={addVirtualMemberFormData.pseudo}
                    onChange={(e) =>
                      setAddVirtualMemberFormData({ ...addVirtualMemberFormData, pseudo: e.target.value })
                    }
                    placeholder="Nom du joueur"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Niveau *
                  </label>
                  <select
                    className="input"
                    value={addVirtualMemberFormData.level}
                    onChange={(e) =>
                      setAddVirtualMemberFormData({ ...addVirtualMemberFormData, level: e.target.value as UserLevel })
                    }
                    required
                  >
                    <option value="Débutant">Débutant</option>
                    <option value="Intermédiaire">Intermédiaire</option>
                    <option value="Confirmé">Confirmé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email (optionnel)
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={addVirtualMemberFormData.email}
                    onChange={(e) =>
                      setAddVirtualMemberFormData({ ...addVirtualMemberFormData, email: e.target.value })
                    }
                    placeholder="email@example.com"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVirtualForm(false);
                      setAddVirtualMemberFormData({ pseudo: '', level: 'Intermédiaire' as UserLevel, email: '' });
                    }}
                    className="btn-secondary flex-1"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={processingAction || !addVirtualMemberFormData.pseudo}
                    className="btn-primary flex-1"
                  >
                    {processingAction ? 'Ajout...' : 'Créer et ajouter'}
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={() => {
                setShowAddMemberModal(false);
                setSearchQuery('');
                setSearchResults([]);
                setShowVirtualForm(false);
                setAddMemberFormData({ memberId: '' });
                setAddVirtualMemberFormData({ pseudo: '', level: 'Intermédiaire' as UserLevel, email: '' });
              }}
              className="btn-secondary w-full mt-4"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Paramètres de l'équipe
            </h3>
            <form onSubmit={handleUpdateSettings}>
              <div className="mb-6">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settingsFormData.recruitmentOpen}
                    onChange={(e) =>
                      setSettingsFormData({
                        ...settingsFormData,
                        recruitmentOpen: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-gray-900">
                    Recrutement ouvert
                  </span>
                </label>
                <p className="text-sm text-gray-500 ml-8 mt-1">
                  Permet aux autres joueurs de rejoindre votre équipe
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={processingAction}
                  className="btn-primary flex-1"
                >
                  {processingAction ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
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

export default TeamManagementPage;
