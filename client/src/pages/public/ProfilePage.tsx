import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import userService from '@services/user.service';
import clubService from '@services/club.service';
import type { UserLevel } from '@shared/types';
import type { Club } from '@shared/types/club.types';
import toast from 'react-hot-toast';
import { User, Mail, Award, Building2, Camera } from 'lucide-react';
import { analyticsService } from '@services/analytics.service';

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    pseudo: user?.pseudo || '',
    level: (user?.level || 'Intermédiaire') as UserLevel,
    clubId: user?.clubId || '',
  });

  useEffect(() => {
    analyticsService.trackProfileView();
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      setLoadingClubs(true);
      const response = await clubService.getAllClubs();
      if (response.success && response.data) {
        setClubs(response.data.clubs);
      }
    } catch (error) {
      console.error('Error loading clubs:', error);
    } finally {
      setLoadingClubs(false);
    }
  };

  if (!user) return null;

  const userClub = clubs.find(c => c.id === user.clubId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      const response = await userService.updateProfile(formData);
      if (response.success) {
        const changedFields = [];
        if (formData.pseudo !== user.pseudo) changedFields.push('pseudo');
        if (formData.level !== user.level) changedFields.push('level');
        if (formData.clubId !== user.clubId) changedFields.push('club');
        analyticsService.trackProfileUpdate(changedFields);
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
      clubId: user.clubId || '',
    });
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image valide');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La taille de l\'image ne doit pas dépasser 5MB');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const response = await userService.uploadAvatar(file);
      if (response.success) {
        toast.success('Photo de profil mise à jour avec succès !');
        await refreshUser();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors de l\'upload de la photo de profil'
      );
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
                <div className="relative group">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.pseudo}
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary-200"
                    />
                  ) : (
                    <div className="bg-primary-100 p-4 rounded-full w-20 h-20 flex items-center justify-center">
                      <User className="text-primary-600" size={32} />
                    </div>
                  )}
                  <button
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-full flex items-center justify-center transition-all duration-200"
                    title="Changer la photo de profil"
                  >
                    <Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                  </button>
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user.pseudo}
                  </h2>
                  <p className="text-gray-500">{user.email}</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />

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

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="text-gray-400" size={20} />
                  <h3 className="text-sm font-medium text-gray-500">Club</h3>
                </div>
                <div className="ml-8 flex items-center gap-2">
                  {userClub ? (
                    <>
                      {userClub.logo && (
                        <img
                          src={userClub.logo}
                          alt={userClub.name}
                          className="h-6 w-6 object-contain"
                        />
                      )}
                      <p className="text-lg text-gray-900">{userClub.name}</p>
                    </>
                  ) : (
                    <p className="text-lg text-gray-500 italic">Aucun club</p>
                  )}
                </div>
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
                onClick={() => {
                  analyticsService.trackProfileEditStart();
                  setIsEditing(true);
                }}
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

              <div>
                <label
                  htmlFor="clubId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Club (optionnel)
                </label>
                {loadingClubs ? (
                  <p className="text-sm text-gray-500">Chargement des clubs...</p>
                ) : (
                  <select
                    id="clubId"
                    className="input"
                    value={formData.clubId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        clubId: e.target.value,
                      })
                    }
                  >
                    <option value="">Aucun club</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                )}
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
