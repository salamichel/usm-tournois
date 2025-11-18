import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Users } from 'lucide-react';

const AdminTeamForm = () => {
  const { tournamentId, teamId } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!teamId;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [formData, setFormData] = useState({
    name: '',
    members: [] as any[],
    captainId: '',
    captainPseudo: '',
    recruitmentOpen: true,
  });

  useEffect(() => {
    if (isEditMode) {
      loadTeam();
    }
  }, [teamId]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (isEditMode) {
        await adminService.updateTeam(tournamentId!, teamId!, formData);
        toast.success('Équipe mise à jour avec succès');
      } else {
        await adminService.createTeam(tournamentId!, formData);
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
      <div className="max-w-2xl mx-auto">
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

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
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

          {isEditMode && formData.members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Membres actuels ({formData.members.length})
              </label>
              <div className="border border-gray-300 rounded-md divide-y divide-gray-200">
                {formData.members.map((member, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{member.pseudo || member.name || 'Joueur'}</span>
                      {member.level && (
                        <span className="text-xs text-gray-500">({member.level})</span>
                      )}
                    </div>
                    {member.userId === formData.captainId && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                        Capitaine
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {formData.captainPseudo && (
                <p className="mt-2 text-sm text-gray-500">
                  Capitaine : {formData.captainPseudo}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-4">
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
