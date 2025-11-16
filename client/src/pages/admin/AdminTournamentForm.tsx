import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Calendar, Users, MapPin, DollarSign, Settings } from 'lucide-react';

const AdminTournamentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    whatsappGroupLink: '',
    isActive: true,
    date: '',
    time: '',
    registrationStartDate: '',
    registrationStartTime: '',
    registrationEndDate: '',
    registrationEndTime: '',
    maxTeams: 16,
    minPlayersPerTeam: 2,
    playersPerTeam: 4,
    waitingListSize: 0,
    type: '4x4',
    tournamentFormat: 'classic',
    mixity: 'none',
    requiresFemalePlayer: false,
    setsPerMatchPool: 1,
    pointsPerSetPool: 21,
    matchFormat: 'aller',
    maxTeamsPerPool: 4,
    teamsQualifiedPerPool: 2,
    eliminationPhaseEnabled: true,
    setsPerMatchElimination: 3,
    pointsPerSetElimination: 21,
    tieBreakEnabledElimination: false,
    tieBreakEnabledPools: false,
    location: '',
    fields: 2,
    fee: 0,
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [currentCoverImage, setCurrentCoverImage] = useState<string>('');

  useEffect(() => {
    if (isEditMode) {
      loadTournament();
    }
  }, [id]);

  const loadTournament = async () => {
    try {
      setLoadingData(true);
      const response = await adminService.getTournamentById(id!);
      const tournament = response.tournament;

      setFormData({
        name: tournament.name || '',
        description: tournament.description || '',
        whatsappGroupLink: tournament.whatsappGroupLink || '',
        isActive: tournament.isActive ?? true,
        date: tournament.date || '',
        time: tournament.time || '',
        registrationStartDate: tournament.registrationStartDate || '',
        registrationStartTime: tournament.registrationStartTime || '',
        registrationEndDate: tournament.registrationEndDate || '',
        registrationEndTime: tournament.registrationEndTime || '',
        maxTeams: tournament.maxTeams || 16,
        minPlayersPerTeam: tournament.minPlayersPerTeam || 2,
        playersPerTeam: tournament.playersPerTeam || 4,
        waitingListSize: tournament.waitingListSize || 0,
        type: tournament.type || '4x4',
        tournamentFormat: tournament.tournamentFormat || 'classic',
        mixity: tournament.mixity || 'none',
        requiresFemalePlayer: tournament.requiresFemalePlayer || false,
        setsPerMatchPool: tournament.setsPerMatchPool || 1,
        pointsPerSetPool: tournament.pointsPerSetPool || 21,
        matchFormat: tournament.matchFormat || 'aller',
        maxTeamsPerPool: tournament.maxTeamsPerPool || 4,
        teamsQualifiedPerPool: tournament.teamsQualifiedPerPool || 2,
        eliminationPhaseEnabled: tournament.eliminationPhaseEnabled ?? true,
        setsPerMatchElimination: tournament.setsPerMatchElimination || 3,
        pointsPerSetElimination: tournament.pointsPerSetElimination || 21,
        tieBreakEnabledElimination: tournament.tieBreakEnabledElimination || false,
        tieBreakEnabledPools: tournament.tieBreakEnabledPools || false,
        location: tournament.location || '',
        fields: tournament.fields || 2,
        fee: tournament.fee || 0,
      });

      if (tournament.coverImage) {
        setCurrentCoverImage(tournament.coverImage);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement du tournoi');
      navigate('/admin/tournaments');
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const formDataToSend = new FormData();

      // Append all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          formDataToSend.append(key, value ? 'true' : 'false');
        } else {
          formDataToSend.append(key, value.toString());
        }
      });

      // Append cover image if selected
      if (coverImage) {
        formDataToSend.append('coverImage', coverImage);
      }

      if (isEditMode) {
        await adminService.updateTournament(id!, formDataToSend);
        toast.success('Tournoi mis à jour avec succès');
      } else {
        await adminService.createTournament(formDataToSend);
        toast.success('Tournoi créé avec succès');
      }

      navigate('/admin/tournaments');
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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/admin/tournaments"
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold">
              {isEditMode ? 'Modifier le Tournoi' : 'Créer un Tournoi'}
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations Générales */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Settings size={20} />
              Informations Générales
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du Tournoi *
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

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="whatsappGroupLink" className="block text-sm font-medium text-gray-700 mb-1">
                  Lien du groupe WhatsApp (optionnel)
                </label>
                <input
                  type="url"
                  id="whatsappGroupLink"
                  name="whatsappGroupLink"
                  value={formData.whatsappGroupLink}
                  onChange={handleChange}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm font-medium text-gray-700">
                  Tournoi Actif
                </label>
              </div>

              <div>
                <label htmlFor="coverImage" className="block text-sm font-medium text-gray-700 mb-1">
                  Photo de couverture
                </label>
                <input
                  type="file"
                  id="coverImage"
                  name="coverImage"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {currentCoverImage && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-1">Image actuelle :</p>
                    <img src={currentCoverImage} alt="Couverture" className="w-48 h-auto rounded-md" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dates et Inscriptions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Dates et Inscriptions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date du Tournoi *
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                  Heure du Tournoi
                </label>
                <input
                  type="time"
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="registrationStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début des inscriptions
                </label>
                <input
                  type="date"
                  id="registrationStartDate"
                  name="registrationStartDate"
                  value={formData.registrationStartDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="registrationStartTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Heure de début des inscriptions
                </label>
                <input
                  type="time"
                  id="registrationStartTime"
                  name="registrationStartTime"
                  value={formData.registrationStartTime}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="registrationEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin des inscriptions
                </label>
                <input
                  type="date"
                  id="registrationEndDate"
                  name="registrationEndDate"
                  value={formData.registrationEndDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="registrationEndTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Heure de fin des inscriptions
                </label>
                <input
                  type="time"
                  id="registrationEndTime"
                  name="registrationEndTime"
                  value={formData.registrationEndTime}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Règles du Tournoi */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users size={20} />
              Règles du Tournoi
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="maxTeams" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre maximum d'équipes *
                </label>
                <input
                  type="number"
                  id="maxTeams"
                  name="maxTeams"
                  value={formData.maxTeams}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="minPlayersPerTeam" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre minimum de joueurs par équipe *
                </label>
                <input
                  type="number"
                  id="minPlayersPerTeam"
                  name="minPlayersPerTeam"
                  value={formData.minPlayersPerTeam}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="playersPerTeam" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre maximum de joueurs par équipe *
                </label>
                <input
                  type="number"
                  id="playersPerTeam"
                  name="playersPerTeam"
                  value={formData.playersPerTeam}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="waitingListSize" className="block text-sm font-medium text-gray-700 mb-1">
                  Taille de la liste d'attente (0 pour désactiver)
                </label>
                <input
                  type="number"
                  id="waitingListSize"
                  name="waitingListSize"
                  value={formData.waitingListSize}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  Type de Tournoi *
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="4x4">4x4</option>
                  <option value="2x2">2x2</option>
                  <option value="6x6">6x6</option>
                </select>
              </div>

              <div>
                <label htmlFor="tournamentFormat" className="block text-sm font-medium text-gray-700 mb-1">
                  Format du tournoi *
                </label>
                <select
                  id="tournamentFormat"
                  name="tournamentFormat"
                  value={formData.tournamentFormat}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="classic">Classique</option>
                  <option value="king">King</option>
                </select>
              </div>

              <div>
                <label htmlFor="mixity" className="block text-sm font-medium text-gray-700 mb-1">
                  Mixité *
                </label>
                <select
                  id="mixity"
                  name="mixity"
                  value={formData.mixity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="none">Aucune</option>
                  <option value="male_female">Homme/Femme</option>
                  <option value="other">Autre</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center">
              <input
                type="checkbox"
                id="requiresFemalePlayer"
                name="requiresFemalePlayer"
                checked={formData.requiresFemalePlayer}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="requiresFemalePlayer" className="ml-2 block text-sm font-medium text-gray-700">
                Requiert une joueuse
              </label>
            </div>
          </div>

          {/* Paramètres des Matchs */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Paramètres des Matchs</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="setsPerMatchPool" className="block text-sm font-medium text-gray-700 mb-1">
                  Sets par match (Poules)
                </label>
                <input
                  type="number"
                  id="setsPerMatchPool"
                  name="setsPerMatchPool"
                  value={formData.setsPerMatchPool}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="pointsPerSetPool" className="block text-sm font-medium text-gray-700 mb-1">
                  Points par set (Poules)
                </label>
                <input
                  type="number"
                  id="pointsPerSetPool"
                  name="pointsPerSetPool"
                  value={formData.pointsPerSetPool}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="matchFormat" className="block text-sm font-medium text-gray-700 mb-1">
                  Format des matchs *
                </label>
                <select
                  id="matchFormat"
                  name="matchFormat"
                  value={formData.matchFormat}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="aller">Aller simple</option>
                  <option value="aller_retour">Aller/retour</option>
                </select>
              </div>

              <div>
                <label htmlFor="maxTeamsPerPool" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre maximum d'équipes par poule
                </label>
                <input
                  type="number"
                  id="maxTeamsPerPool"
                  name="maxTeamsPerPool"
                  value={formData.maxTeamsPerPool}
                  onChange={handleChange}
                  min="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="teamsQualifiedPerPool" className="block text-sm font-medium text-gray-700 mb-1">
                  Équipes qualifiées par poule
                </label>
                <input
                  type="number"
                  id="teamsQualifiedPerPool"
                  name="teamsQualifiedPerPool"
                  value={formData.teamsQualifiedPerPool}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="tieBreakEnabledPools"
                  name="tieBreakEnabledPools"
                  checked={formData.tieBreakEnabledPools}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="tieBreakEnabledPools" className="ml-2 block text-sm font-medium text-gray-700">
                  Activer le tie-break (Poules)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="eliminationPhaseEnabled"
                  name="eliminationPhaseEnabled"
                  checked={formData.eliminationPhaseEnabled}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="eliminationPhaseEnabled" className="ml-2 block text-sm font-medium text-gray-700">
                  Activer la phase d'élimination
                </label>
              </div>

              {formData.eliminationPhaseEnabled && (
                <div className="pl-6 space-y-4 border-l-2 border-blue-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="setsPerMatchElimination" className="block text-sm font-medium text-gray-700 mb-1">
                        Sets par match (Élimination)
                      </label>
                      <input
                        type="number"
                        id="setsPerMatchElimination"
                        name="setsPerMatchElimination"
                        value={formData.setsPerMatchElimination}
                        onChange={handleChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="pointsPerSetElimination" className="block text-sm font-medium text-gray-700 mb-1">
                        Points par set (Élimination)
                      </label>
                      <input
                        type="number"
                        id="pointsPerSetElimination"
                        name="pointsPerSetElimination"
                        value={formData.pointsPerSetElimination}
                        onChange={handleChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="tieBreakEnabledElimination"
                      name="tieBreakEnabledElimination"
                      checked={formData.tieBreakEnabledElimination}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="tieBreakEnabledElimination" className="ml-2 block text-sm font-medium text-gray-700">
                      Activer le tie-break (Élimination)
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Détails Logistiques et Financiers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin size={20} />
              Détails Logistiques et Financiers
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Lieu *
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="fields" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de terrains
                </label>
                <input
                  type="number"
                  id="fields"
                  name="fields"
                  value={formData.fields}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="fee" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign size={16} />
                  Frais d'inscription (€)
                </label>
                <input
                  type="number"
                  id="fee"
                  name="fee"
                  value={formData.fee}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              to="/admin/tournaments"
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

export default AdminTournamentForm;
