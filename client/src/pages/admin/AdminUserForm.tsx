import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import clubService from '@services/club.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, User } from 'lucide-react';
import type { UserLevel } from '@shared/types';
import type { Club } from '@shared/types/club.types';

const AdminUserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [formData, setFormData] = useState({
    pseudo: '',
    email: '',
    level: 'Intermédiaire' as UserLevel,
    password: '',
    confirmPassword: '',
    isAdmin: false,
    clubId: '',
  });

  useEffect(() => {
    loadClubs();
    if (isEditMode) {
      loadUser();
    }
  }, [id]);

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

  const loadUser = async () => {
    try {
      setLoadingData(true);
      const response = await adminService.getUserById(id!);
      const user = response.data?.user;

      if (!user) {
        throw new Error('User not found');
      }

      setFormData({
        pseudo: user.pseudo || '',
        email: user.email || '',
        level: (user.level || 'Intermédiaire') as UserLevel,
        password: '',
        confirmPassword: '',
        isAdmin: user.role === 'admin',
        clubId: user.clubId || '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
      navigate('/admin/users');
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation du mot de passe
    if (!isEditMode || formData.password) {
      if (formData.password !== formData.confirmPassword) {
        toast.error('Les mots de passe ne correspondent pas');
        return;
      }

      if (!isEditMode && formData.password.length < 6) {
        toast.error('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
    }

    try {
      setLoading(true);

      const dataToSend: any = {
        pseudo: formData.pseudo,
        email: formData.email,
        level: formData.level,
        role: formData.isAdmin ? 'admin' : 'player',
        clubId: formData.clubId || null,
      };

      // Ajouter le mot de passe seulement s'il est renseigné
      if (formData.password) {
        dataToSend.password = formData.password;
      }

      if (isEditMode) {
        await adminService.updateUser(id!, dataToSend);
        toast.success('Utilisateur mis à jour avec succès');
      } else {
        await adminService.createUser(dataToSend);
        toast.success('Utilisateur créé avec succès');
      }

      navigate('/admin/users');
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
          <Link to="/admin/users" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User size={28} />
            {isEditMode ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pseudo" className="block text-sm font-medium text-gray-700 mb-1">
                Pseudo *
              </label>
              <input
                type="text"
                id="pseudo"
                name="pseudo"
                value={formData.pseudo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                Niveau *
              </label>
              <select
                id="level"
                name="level"
                value={formData.level}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Débutant">Débutant</option>
                <option value="Intermédiaire">Intermédiaire</option>
                <option value="Confirmé">Confirmé</option>
              </select>
            </div>

            <div>
              <label htmlFor="clubId" className="block text-sm font-medium text-gray-700 mb-1">
                Club (optionnel)
              </label>
              <select
                id="clubId"
                name="clubId"
                value={formData.clubId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Aucun club</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe {isEditMode ? '(laisser vide pour ne pas changer)' : '*'}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={!isEditMode}
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe {isEditMode ? '' : '*'}
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={!isEditMode}
                minLength={6}
              />
            </div>
          </div>

          <div className="flex items-center pt-2">
            <input
              type="checkbox"
              id="isAdmin"
              name="isAdmin"
              checked={formData.isAdmin}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isAdmin" className="ml-2 block text-sm font-medium text-gray-700">
              Administrateur
            </label>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            <Link
              to="/admin/users"
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

export default AdminUserForm;
