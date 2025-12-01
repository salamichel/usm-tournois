import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Users, Trash2, Plus, Crown, UserMinus, UserPlus } from 'lucide-react';

interface Member {
  userId: string;
  pseudo: string;
  level: string;
}

interface UnassignedPlayer {
  id: string;
  odisplay: string;
  pseudo: string;
  level: string;
}

const AdminTeamForm = () => {
  const { tournamentId, teamId } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!teamId;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [unassignedPlayers, setUnassignedPlayers] = useState<UnassignedPlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    members: [] as Member[],
    captainId: '',
    captainPseudo: '',
    recruitmentOpen: true,
  });

  useEffect(() => {
    if (isEditMode && tournamentId) {
      loadTeam();
      loadUnassignedPlayers();
    }
  }, [teamId, tournamentId, isEditMode]);

  const loadTeam = async () => {
    try {
      setLoadingData(true);
      const response = await adminService.getTeams(tournamentId!);

      if (response.success && response.data && response.data.teams) {
        const team = response.data.teams.find((t: any) => t.id === teamId);

        if (team) {
          setFormData({
            name: team.name || '',
            members: team.members || [],
            captainId: team.captainId || '',
            captainPseudo: team.captainPseudo || '',
            recruitmentOpen: team.recruitmentOpen !== false,
          });
        } else {
          toast.error('Équipe non trouvée');
          navigate(`/admin/tournaments/${tournamentId}/teams`);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
      navigate(`/admin/tournaments/${tournamentId}/teams`);
    } finally {
      setLoadingData(false);
    }
  };

  const loadUnassignedPlayers = async () => {
    try {
      const response = await adminService.getUnassignedPlayers(tournamentId!);
      if (response.success && response.data) {
        setUnassignedPlayers(response.data.players || []);
      }
    } catch (error) {
      console.error('Error loading unassigned players:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === formData.captainId) {
      toast.error('Impossible de retirer le capitaine. Transférez d\'abord le capitanat.');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir retirer ce membre ?')) {
      return;
    }

    try {
      // Update team with member removed
      const updatedMembers = formData.members.filter(m => m.userId !== memberId);
      await adminService.updateTeam(tournamentId!, teamId!, {
        members: updatedMembers
      });

      setFormData(prev => ({
        ...prev,
        members: updatedMembers
      }));

      // Refresh unassigned players
      loadUnassignedPlayers();
      toast.success('Membre retiré avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du retrait du membre');
    }
  };

  const handleAddMember = async () => {
    if (!selectedPlayerId) {
      toast.error('Veuillez sélectionner un joueur');
      return;
    }

    const player = unassignedPlayers.find(p => p.id === selectedPlayerId);
    if (!player) return;

    try {
      const newMember: Member = {
        userId: player.id,
        pseudo: player.pseudo,
        level: player.level || 'N/A'
      };

      const updatedMembers = [...formData.members, newMember];
      await adminService.updateTeam(tournamentId!, teamId!, {
        members: updatedMembers
      });

      setFormData(prev => ({
        ...prev,
        members: updatedMembers
      }));

      setSelectedPlayerId('');
      loadUnassignedPlayers();
      toast.success('Membre ajouté avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'ajout du membre');
    }
  };

  const handleTransferCaptain = async (newCaptainId: string) => {
    const member = formData.members.find(m => m.userId === newCaptainId);
    if (!member) return;

    if (!confirm(`Transférer le capitanat à ${member.pseudo} ?`)) {
      return;
    }

    try {
      await adminService.updateTeam(tournamentId!, teamId!, {
        captainId: newCaptainId,
        captainPseudo: member.pseudo
      });

      setFormData(prev => ({
        ...prev,
        captainId: newCaptainId,
        captainPseudo: member.pseudo
      }));

      toast.success('Capitanat transféré avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du transfert');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (isEditMode) {
        await adminService.updateTeam(tournamentId!, teamId!, {
          name: formData.name,
          recruitmentOpen: formData.recruitmentOpen
        });
        toast.success('Équipe mise à jour avec succès');
      } else {
        await adminService.createTeam(tournamentId!, {
          name: formData.name,
          recruitmentOpen: formData.recruitmentOpen
        });
        toast.success('Équipe créée avec succès');
      }

      navigate(`/admin/tournaments/${tournamentId}/teams`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
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
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            to={`/admin/tournaments/${tournamentId}/teams`}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users size={28} />
            {isEditMode ? 'Modifier l\'équipe' : 'Nouvelle équipe'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Informations générales</h2>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'équipe *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {isEditMode && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="recruitmentOpen"
                  name="recruitmentOpen"
                  checked={formData.recruitmentOpen}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="recruitmentOpen" className="ml-2 block text-sm text-gray-700">
                  Recrutement ouvert
                </label>
              </div>
            )}
          </div>

          {/* Members Card - Only in edit mode */}
          {isEditMode && (
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">
                Membres ({formData.members.length})
              </h2>

              {formData.members.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {formData.members.map((member) => (
                    <div key={member.userId} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="font-medium">{member.pseudo}</span>
                          {member.level && (
                            <span className="text-xs text-gray-500 ml-2">({member.level})</span>
                          )}
                        </div>
                        {member.userId === formData.captainId && (
                          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
                            <Crown size={12} />
                            Capitaine
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {member.userId !== formData.captainId && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTransferCaptain(member.userId)}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                              title="Nommer capitaine"
                            >
                              <Crown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.userId)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Retirer de l'équipe"
                            >
                              <UserMinus size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucun membre dans l'équipe</p>
              )}

              {/* Add Member Section */}
              {unassignedPlayers.length > 0 && (
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ajouter un membre
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un joueur...</option>
                      {unassignedPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.pseudo} {player.level ? `(${player.level})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={!selectedPlayerId}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <UserPlus size={18} />
                      Ajouter
                    </button>
                  </div>
                </div>
              )}

              {unassignedPlayers.length === 0 && (
                <p className="text-sm text-gray-500 italic">
                  Aucun joueur non assigné disponible
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              to={`/admin/tournaments/${tournamentId}/teams`}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={18} />
              {loading ? 'Enregistrement...' : (isEditMode ? 'Mettre à jour' : 'Créer')}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminTeamForm;
