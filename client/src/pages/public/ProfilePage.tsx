import { useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import userService from '@services/user.service';
import type { UserLevel } from '@shared/types';
import toast from 'react-hot-toast';
import { User, Mail, Award } from 'lucide-react';

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    pseudo: user?.pseudo || '',
    level: (user?.level || 'Intermédiaire') as UserLevel,
  });

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      const response = await userService.updateProfile(formData);
      if (response.success) {
        toast.success('Profil mis à jour avec succès !');
        await refreshUser();
        setIsEditing(false);
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors de la mise à jour du profil'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      pseudo: user.pseudo,
      level: user.level,
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mon Profil</h1>
        <p className="text-gray-600 mt-2">
          Gérez vos informations personnelles
        </p>
      </div>

      <div className="card">
        {!isEditing ? (
          <div>
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b">
                <div className="bg-primary-100 p-4 rounded-full">
                  <User className="text-primary-600" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user.pseudo}
                  </h2>
                  <p className="text-gray-500">{user.email}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="text-gray-400" size={20} />
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                </div>
                <p className="text-lg text-gray-900 ml-8">{user.email}</p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <User className="text-gray-400" size={20} />
                  <h3 className="text-sm font-medium text-gray-500">Pseudo</h3>
                </div>
                <p className="text-lg text-gray-900 ml-8">{user.pseudo}</p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Award className="text-gray-400" size={20} />
                  <h3 className="text-sm font-medium text-gray-500">Niveau</h3>
                </div>
                <p className="text-lg text-gray-900 ml-8">
                  {user.level}
                </p>
              </div>

              {user.role === 'admin' && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Award className="text-gray-400" size={20} />
                    <h3 className="text-sm font-medium text-gray-500">Rôle</h3>
                  </div>
                  <p className="text-lg text-gray-900 ml-8">
                    <span className="badge badge-primary">Administrateur</span>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary"
              >
                Modifier mon profil
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="input bg-gray-100 cursor-not-allowed"
                  value={user.email}
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  L'email ne peut pas être modifié
                </p>
              </div>

              <div>
                <label
                  htmlFor="pseudo"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Pseudo
                </label>
                <input
                  type="text"
                  id="pseudo"
                  className="input"
                  value={formData.pseudo}
                  onChange={(e) =>
                    setFormData({ ...formData, pseudo: e.target.value })
                  }
                  required
                  placeholder="Votre pseudo"
                />
              </div>

              <div>
                <label
                  htmlFor="level"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Niveau
                </label>
                <select
                  id="level"
                  className="input"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      level: e.target.value as UserLevel,
                    })
                  }
                  required
                >
                  <option value="Débutant">Débutant</option>
                  <option value="Intermédiaire">Intermédiaire</option>
                  <option value="Confirmé">Confirmé</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
