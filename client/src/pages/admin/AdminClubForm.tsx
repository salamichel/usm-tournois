import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import clubService from '@services/club.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Upload, X } from 'lucide-react';

const AdminClubForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [formData, setFormData] = useState({
    name: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    if (isEditMode) {
      loadClub();
    }
  }, [id]);

  const loadClub = async () => {
    try {
      setLoadingData(true);
      const response = await clubService.getClubById(id!);
      const club = response.data.club;

      setFormData({
        name: club.name || '',
      });

      if (club.logo) {
        setLogoPreview(club.logo);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement du club');
      navigate('/admin/clubs');
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner une image');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 5MB');
        return;
      }

      setLogoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Le nom du club est requis');
      return;
    }

    try {
      setLoading(true);

      if (isEditMode) {
        await clubService.updateClub(id!, formData.name, logoFile || undefined);
        toast.success('Club mis à jour avec succès');
      } else {
        await clubService.createClub(formData.name, logoFile || undefined);
        toast.success('Club créé avec succès');
      }

      navigate('/admin/clubs');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de l\'enregistrement';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/clubs" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Modifier le club' : 'Nouveau club'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEditMode ? 'Modifier les informations du club' : 'Créer un nouveau club'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nom du club <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Ex: Volley Club Paris"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo du club (optionnel)
            </label>

            {logoPreview ? (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-32 w-32 object-contain rounded-lg border-2 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  Cliquez sur l'icône X pour retirer le logo
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="logo"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-2 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF, WebP (MAX. 5MB)</p>
                  </div>
                  <input
                    id="logo"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoChange}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={20} />
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <Link to="/admin/clubs" className="btn-outline">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminClubForm;
