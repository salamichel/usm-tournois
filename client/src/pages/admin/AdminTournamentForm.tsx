import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Calendar, Users, MapPin, DollarSign, Settings } from 'lucide-react';
import KingConfigAssistant from '@components/KingConfigAssistant';
import { KingConfiguration } from '@utils/kingConfigSuggestions';

// Helper function to format ISO date string to YYYY-MM-DD (UTC, no timezone conversion)
const formatDateForInput = (isoString: string | undefined | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    // Use UTC components to avoid timezone conversion
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

// Helper function to format ISO date string to HH:MM (UTC, no timezone conversion)
const formatTimeForInput = (isoString: string | undefined | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    // Use UTC components to avoid timezone conversion
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
};

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
    isClubInternal: false,
    date: '',
    time: '',
    registrationStartDate: '',
    registrationStartTime: '',
    registrationEndDate: '',
    registrationEndTime: '',
    maxTeams: 16,
    minPlayersPerTeam: 2,
    playersPerTeam: 4,
    minPlayers: 0,
    maxPlayers: 0,
    waitingListSize: 0,
    type: '4x4',
    tournamentFormat: 'standard',
    registrationMode: 'teams',
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
  const [kingConfig, setKingConfig] = useState<KingConfiguration | null>(null);

  useEffect(() => {
    if (isEditMode) {
      loadTournament();
    }
  }, [id]);

  const loadTournament = async () => {
    try {
      setLoadingData(true);
      const response = await adminService.getTournamentById(id!);
      const tournament = response.data?.tournament;

      if (!tournament) {
        throw new Error('Tournoi non trouvé');
      }

      setFormData({
        name: tournament.name || '',
        description: tournament.description || '',
        whatsappGroupLink: tournament.whatsappGroupLink || '',
        isActive: tournament.isActive ?? true,
        isClubInternal: tournament.isClubInternal ?? false,
        date: formatDateForInput(tournament.date),
        time: formatTimeForInput(tournament.date),
        registrationStartDate: formatDateForInput(tournament.registrationStartDateTime),
        registrationStartTime: formatTimeForInput(tournament.registrationStartDateTime),
        registrationEndDate: formatDateForInput(tournament.registrationEndDateTime),
        registrationEndTime: formatTimeForInput(tournament.registrationEndDateTime),
        maxTeams: tournament.maxTeams || 16,
        minPlayersPerTeam: tournament.minPlayersPerTeam || 2,
        playersPerTeam: tournament.playersPerTeam || 4,
        minPlayers: tournament.minPlayers || 0,
        maxPlayers: tournament.maxPlayers || 0,
        waitingListSize: tournament.waitingListSize || 0,
        type: tournament.type || '4x4',
        tournamentFormat: tournament.tournamentFormat || 'standard',
        registrationMode: tournament.registrationMode || 'teams',
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

      // Combine date and time fields into ISO datetime strings (treating as UTC to avoid timezone conversion)
      const combineDateAndTime = (dateStr: string, timeStr: string): string => {
        if (!dateStr) return '';
        // Add 'Z' to indicate UTC timezone and avoid local timezone conversion
        const dateTime = timeStr ? `${dateStr}T${timeStr}:00Z` : `${dateStr}T00:00:00Z`;
        return dateTime;
      };

      // Add combined datetime fields
      if (formData.date) {
        formDataToSend.append('date', combineDateAndTime(formData.date, formData.time));
      }
      if (formData.registrationStartDate) {
        formDataToSend.append('registrationStartDateTime',
          combineDateAndTime(formData.registrationStartDate, formData.registrationStartTime));
      }
      if (formData.registrationEndDate) {
        formDataToSend.append('registrationEndDateTime',
          combineDateAndTime(formData.registrationEndDate, formData.registrationEndTime));
      }

      // Append all other form fields (excluding date/time pairs)
      Object.entries(formData).forEach(([key, value]) => {
        // Skip the individual date/time fields as we've already combined them
        if (['date', 'time', 'registrationStartDate', 'registrationStartTime',
             'registrationEndDate', 'registrationEndTime'].includes(key)) {
          return;
        }

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

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isClubInternal"
                  name="isClubInternal"
                  checked={formData.isClubInternal}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isClubInternal" className="ml-2 block text-sm font-medium text-gray-700">
                  Tournoi interne à un club
                </label>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                Si coché, les logos de club ne seront pas affichés pour ce tournoi
              </p>

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

              <div className="col-span-2">
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
                  <option value="standard">Standard (Poules + Élimination directe)</option>
                  <option value="king">King (Rotation d'équipes par phases)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.tournamentFormat === 'standard'
                    ? '📋 Format classique avec équipes fixes, phase de poules et phase d\'élimination'
                    : '👑 Format King avec équipes changeantes et phases progressives'}
                </p>
              </div>
            </div>

            {/* Configuration spécifique au mode Standard */}
            {formData.tournamentFormat === 'standard' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ⚙️ Configuration Mode Standard
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="registrationMode" className="block text-sm font-medium text-gray-700 mb-1">
                      Mode d'inscription *
                    </label>
                    <select
                      id="registrationMode"
                      name="registrationMode"
                      value={formData.registrationMode}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="teams">👥 Équipes pré-constituées</option>
                      <option value="random">🎲 Équipes aléatoires (générées par l'admin)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.registrationMode === 'teams'
                        ? 'Les joueurs s\'inscrivent en créant ou rejoignant une équipe'
                        : 'Les joueurs s\'inscrivent individuellement, l\'admin génère les équipes'}
                    </p>
                  </div>

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
                      Minimum de joueurs par équipe *
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
                      Maximum de joueurs par équipe *
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
                </div>
              </div>
            )}

            {/* Configuration spécifique au mode King */}
            {formData.tournamentFormat === 'king' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  👑 Configuration Mode King
                </h3>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-900">
                    ℹ️ <strong>Mode King :</strong> Les joueurs s'inscrivent individuellement.
                    Les équipes sont générées automatiquement à chaque phase selon le format défini
                    (4v4, 2v2, etc.). La configuration des phases se fait après la création du tournoi.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="minPlayers" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre minimum de joueurs
                    </label>
                    <input
                      type="number"
                      id="minPlayers"
                      name="minPlayers"
                      value={formData.minPlayers}
                      onChange={handleChange}
                      min="0"
                      placeholder="Optionnel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Laissez à 0 pour aucune limite minimum
                    </p>
                  </div>

                  <div>
                    <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre maximum de joueurs
                    </label>
                    <input
                      type="number"
                      id="maxPlayers"
                      name="maxPlayers"
                      value={formData.maxPlayers}
                      onChange={handleChange}
                      min="0"
                      placeholder="Optionnel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Laissez à 0 pour aucune limite maximum
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Options communes aux deux modes */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🎯 Options Communes
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <option value="none">Aucune restriction</option>
                    <option value="male_female">Homme/Femme</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="waitingListSize" className="block text-sm font-medium text-gray-700 mb-1">
                    Taille de la liste d'attente
                  </label>
                  <input
                    type="number"
                    id="waitingListSize"
                    name="waitingListSize"
                    value={formData.waitingListSize}
                    onChange={handleChange}
                    min="0"
                    placeholder="0 = désactivée"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    0 pour désactiver la liste d'attente
                  </p>
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
                  Requiert au moins une joueuse {formData.tournamentFormat === 'standard' ? 'par équipe' : ''}
                </label>
              </div>
            </div>
          </div>

          {/* Paramètres des Matchs - Seulement en mode Standard */}
          {formData.tournamentFormat === 'standard' && (
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
          )}

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
