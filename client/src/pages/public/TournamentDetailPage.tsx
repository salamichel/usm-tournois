import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import tournamentService from '@services/tournament.service';
import type { TournamentDetails, Team } from '@shared/types';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Trophy,
  UserPlus,
  UserMinus,
  AlertCircle,
  ArrowLeft,
  Share2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabType = 'teams' | 'players' | 'waitingList';
type ViewType = 'detail' | 'results';
type ResultsTabType = 'pools' | 'finals' | 'ranking';

const TournamentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('teams');
  const [activeView, setActiveView] = useState<ViewType>('detail');
  const [activeResultsTab, setActiveResultsTab] = useState<ResultsTabType>('pools');

  useEffect(() => {
    if (id) {
      fetchTournament();
    }
  }, [id]);

  const fetchTournament = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const response = await tournamentService.getTournamentById(id);
      if (response.success && response.data) {
        setTournament(response.data.tournament);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement du tournoi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterAsPlayer = async () => {
    if (!id || !isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      setProcessingAction(true);
      const response = await tournamentService.registerPlayer(id);
      if (response.success) {
        toast.success('Inscription réussie !');
        fetchTournament();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          "Erreur lors de l'inscription"
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleLeaveTournament = async () => {
    if (!id) return;

    try {
      setProcessingAction(true);
      const response = await tournamentService.leaveTournament(id);
      if (response.success) {
        toast.success('Vous avez quitté le tournoi');
        fetchTournament();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          'Erreur lors de la désinscription'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newTeamName.trim()) return;

    try {
      setProcessingAction(true);
      const response = await tournamentService.createTeam(id, newTeamName);
      if (response.success) {
        toast.success('Équipe créée avec succès !');
        setShowCreateTeamModal(false);
        setNewTeamName('');
        fetchTournament();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          "Erreur lors de la création de l'équipe"
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!id || !isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      setProcessingAction(true);
      const response = await tournamentService.joinTeam(id, teamId);
      if (response.success) {
        toast.success('Vous avez rejoint l\'équipe !');
        fetchTournament();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          "Erreur lors de l'adhésion à l'équipe"
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleJoinWaitingList = async () => {
    if (!id || !isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      setProcessingAction(true);
      const response = await tournamentService.joinWaitingList(id);
      if (response.success) {
        toast.success('Vous êtes sur la liste d\'attente');
        fetchTournament();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          "Erreur lors de l'inscription à la liste d'attente"
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: tournament?.name,
        text: tournament?.description || '',
        url: url,
      }).catch(() => {
        copyToClipboard(url);
      });
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Lien copié !');
    });
  };

  // Check if current user is registered
  const isUserRegistered = () => {
    if (!user || !tournament) return false;
    const isUnassigned = tournament.unassignedPlayers?.some(
      (p) => p.userId === user.uid
    );
    const isInTeam = tournament.teams?.some((team) =>
      team.members?.some((m) => m.userId === user.uid)
    );
    const isInWaitingList = tournament.waitingList?.some(
      (p) => p.userId === user.uid
    );
    return isUnassigned || isInTeam || isInWaitingList;
  };

  const getUserTeam = (): Team | null => {
    if (!user || !tournament) return null;
    return (
      tournament.teams?.find((team) =>
        team.members?.some((m) => m.userId === user.uid)
      ) || null
    );
  };

  const getCompleteTeamsCount = (): number => {
    if (!tournament) return 0;
    return (
      tournament.teams?.filter(
        (team) => (team.members?.length || 0) === tournament.playersPerTeam
      ).length || 0
    );
  };

  const getTotalPlayersCount = (): number => {
    if (!tournament) return 0;
    const teamPlayers = tournament.teams?.reduce(
      (sum, team) => sum + (team.members?.length || 0),
      0
    ) || 0;
    const unassignedPlayers = tournament.unassignedPlayers?.length || 0;
    return teamPlayers + unassignedPlayers;
  };

  const getAvailableTeams = (): Team[] => {
    if (!tournament) return [];
    return tournament.teams?.filter(
      (team) =>
        team.recruitmentOpen &&
        (team.members?.length || 0) < tournament.playersPerTeam
    ) || [];
  };

  const isTeamComplete = (team: Team): boolean => {
    return (team.members?.length || 0) === tournament?.playersPerTeam;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Tournoi introuvable</p>
        </div>
      </div>
    );
  }

  const userTeam = getUserTeam();
  const isRegistered = isUserRegistered();
  const completeTeams = getCompleteTeamsCount();
  const totalPlayers = getTotalPlayersCount();
  const maxPlayers = tournament.maxTeams * tournament.playersPerTeam;
  const availableTeams = getAvailableTeams();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={20} />
        <span>Retour</span>
      </button>

      {/* Tournament Header */}
      <div className="mb-6">
        {tournament.coverImage && (
          <img
            src={tournament.coverImage}
            alt={tournament.name}
            className="w-full h-64 object-cover rounded-lg mb-6"
          />
        )}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900">{tournament.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`badge ${
                tournament.status === 'Ouvert' ? 'badge-success' :
                tournament.status === 'Complet' ? 'badge-warning' :
                tournament.status === 'En cours' ? 'badge-info' :
                'badge-default'
              }`}>
                {tournament.status}
              </span>
              {tournament.type && (
                <span className="badge badge-default">{tournament.type}</span>
              )}
            </div>
          </div>
          <button
            onClick={handleShare}
            className="btn-secondary"
          >
            <Share2 size={20} className="mr-2" />
            Partager
          </button>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveView('detail')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeView === 'detail'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Détails
        </button>
        <button
          onClick={() => setActiveView('results')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeView === 'results'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Résultats
        </button>
      </div>

      {activeView === 'detail' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card text-center">
                <Calendar className="text-primary-600 mx-auto mb-2" size={24} />
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-semibold text-sm">
                  {tournament.date
                    ? format(new Date(tournament.date), 'PPP', { locale: fr })
                    : 'À confirmer'}
                </p>
              </div>
              <div className="card text-center">
                <Users className="text-primary-600 mx-auto mb-2" size={24} />
                <p className="text-sm text-gray-500">Équipes</p>
                <p className="font-semibold">
                  {tournament.teams?.length || 0} / {tournament.maxTeams}
                </p>
              </div>
              <div className="card text-center">
                <Trophy className="text-primary-600 mx-auto mb-2" size={24} />
                <p className="text-sm text-gray-500">Joueurs</p>
                <p className="font-semibold">
                  {totalPlayers} / {maxPlayers}
                </p>
              </div>
              <div className="card text-center">
                <DollarSign className="text-primary-600 mx-auto mb-2" size={24} />
                <p className="text-sm text-gray-500">Prix</p>
                <p className="font-semibold">{tournament.price}€</p>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-3">Progression des inscriptions</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Équipes complètes</span>
                    <span className="font-medium">
                      {completeTeams} / {tournament.maxTeams}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(completeTeams / tournament.maxTeams) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Joueurs inscrits</span>
                    <span className="font-medium">
                      {totalPlayers} / {maxPlayers}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(totalPlayers / maxPlayers) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {tournament.description && (
              <div className="card">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Description</h2>
                <div className="prose prose-sm max-w-none text-gray-600">
                  <ReactMarkdown>{tournament.description}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Registration Section */}
            {!isRegistered && tournament.status === 'Ouvert' && (
              <div className="card bg-primary-50 border-2 border-primary-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  S'inscrire au tournoi
                </h2>
                <p className="text-gray-600 mb-4">
                  Choisissez votre mode d'inscription
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={handleRegisterAsPlayer}
                    disabled={processingAction}
                    className="btn-primary"
                  >
                    <UserPlus size={20} className="mr-2" />
                    S'inscrire comme joueur
                  </button>
                  <button
                    onClick={() => setShowCreateTeamModal(true)}
                    disabled={processingAction}
                    className="btn-secondary"
                  >
                    <Trophy size={20} className="mr-2" />
                    Créer une équipe
                  </button>
                </div>
              </div>
            )}

            {/* User is registered */}
            {isRegistered && (
              <div className="card bg-green-50 border-2 border-green-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-green-600 flex-shrink-0" size={24} />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Vous êtes inscrit !
                    </h3>
                    {userTeam ? (
                      <p className="text-gray-600">
                        Équipe: <strong>{userTeam.name}</strong>
                      </p>
                    ) : (
                      <p className="text-gray-600">
                        Vous êtes inscrit comme joueur solo
                      </p>
                    )}

                    {/* WhatsApp QR Code for registered users */}
                    {tournament.whatsappGroupUrl && (
                      <div className="mt-4 p-4 bg-white rounded-lg border border-green-300">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Groupe WhatsApp du tournoi
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Scannez ce QR code pour rejoindre le groupe WhatsApp
                        </p>
                        <div className="bg-white p-2 inline-block rounded">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tournament.whatsappGroupUrl)}`}
                            alt="QR Code WhatsApp"
                            className="w-32 h-32"
                          />
                        </div>
                        <a
                          href={tournament.whatsappGroupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary mt-3 inline-block text-sm"
                        >
                          Ou cliquez ici pour rejoindre
                        </a>
                      </div>
                    )}

                    <button
                      onClick={handleLeaveTournament}
                      disabled={processingAction}
                      className="btn-danger mt-4"
                    >
                      <UserMinus size={20} className="mr-2" />
                      Se désinscrire
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tournament Full */}
            {tournament.status === 'Complet' && !isRegistered && (
              <div className="card bg-yellow-50 border-2 border-yellow-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Tournoi complet
                </h3>
                <p className="text-gray-600 mb-4">
                  Ce tournoi est complet. Vous pouvez vous inscrire sur la liste d'attente.
                </p>
                <button
                  onClick={handleJoinWaitingList}
                  disabled={processingAction}
                  className="btn-secondary"
                >
                  Rejoindre la liste d'attente
                </button>
              </div>
            )}

            {/* Tabs Navigation */}
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('teams')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'teams'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Équipes ({tournament.teams?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'players'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Joueurs sans équipe ({tournament.unassignedPlayers?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('waitingList')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'waitingList'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Liste d'attente ({tournament.waitingList?.length || 0})
              </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px]">
              {/* Teams Tab */}
              {activeTab === 'teams' && (
                <div>
                  {tournament.teams && tournament.teams.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tournament.teams.map((team) => (
                        <div key={team.id} className="card">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-gray-900">
                                {team.name}
                              </h3>
                              {isTeamComplete(team) ? (
                                <CheckCircle className="text-green-500" size={18} />
                              ) : (
                                <XCircle className="text-gray-400" size={18} />
                              )}
                            </div>
                            {team.recruitmentOpen && !isTeamComplete(team) && (
                              <span className="badge badge-success text-xs">Recrute</span>
                            )}
                          </div>
                          <div className="space-y-1 mb-4">
                            {team.members?.map((member, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <Users size={14} className="text-gray-400" />
                                <span>
                                  {member.pseudo}
                                  {member.userId === team.captainId && (
                                    <span className="text-primary-600 ml-1">(C)</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                              {team.members?.length || 0} / {tournament.playersPerTeam}{' '}
                              joueurs
                            </div>
                            {!isRegistered &&
                              team.recruitmentOpen &&
                              (team.members?.length || 0) < tournament.playersPerTeam && (
                                <button
                                  onClick={() => handleJoinTeam(team.id)}
                                  disabled={processingAction}
                                  className="btn-primary text-sm"
                                >
                                  Rejoindre
                                </button>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Aucune équipe inscrite pour le moment</p>
                  )}
                </div>
              )}

              {/* Players Tab */}
              {activeTab === 'players' && (
                <div>
                  {tournament.unassignedPlayers && tournament.unassignedPlayers.length > 0 ? (
                    <div className="card">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {tournament.unassignedPlayers.map((player) => (
                          <div
                            key={player.userId}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Users size={14} className="text-gray-400" />
                            <span>{player.pseudo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Aucun joueur sans équipe</p>
                  )}
                </div>
              )}

              {/* Waiting List Tab */}
              {activeTab === 'waitingList' && (
                <div>
                  {tournament.waitingList && tournament.waitingList.length > 0 ? (
                    <div className="card">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {tournament.waitingList.map((player, index) => (
                          <div
                            key={player.userId}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="text-gray-400">#{index + 1}</span>
                            <Users size={14} className="text-gray-400" />
                            <span>{player.pseudo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Liste d'attente vide</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Tournament Info */}
            <div className="card sticky top-4">
              <h3 className="font-bold text-gray-900 mb-4">Informations</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="text-gray-400 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-gray-500">Lieu</p>
                    <p className="font-medium text-gray-900">{tournament.location}</p>
                  </div>
                </div>

                {tournament.type && (
                  <div className="flex items-start gap-3">
                    <Trophy className="text-gray-400 flex-shrink-0" size={18} />
                    <div>
                      <p className="text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">{tournament.type}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Users className="text-gray-400 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-gray-500">Équipes maximum</p>
                    <p className="font-medium text-gray-900">{tournament.maxTeams}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="text-gray-400 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-gray-500">Joueurs par équipe</p>
                    <p className="font-medium text-gray-900">{tournament.playersPerTeam}</p>
                  </div>
                </div>

                {tournament.fields && (
                  <div className="flex items-start gap-3">
                    <MapPin className="text-gray-400 flex-shrink-0" size={18} />
                    <div>
                      <p className="text-gray-500">Terrains</p>
                      <p className="font-medium text-gray-900">{tournament.fields}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <DollarSign className="text-gray-400 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-gray-500">Prix par joueur</p>
                    <p className="font-medium text-gray-900">{tournament.price}€</p>
                  </div>
                </div>

                {tournament.registrationDeadline && (
                  <div className="flex items-start gap-3">
                    <Calendar className="text-gray-400 flex-shrink-0" size={18} />
                    <div>
                      <p className="text-gray-500">Date limite d'inscription</p>
                      <p className="font-medium text-gray-900">
                        {format(new Date(tournament.registrationDeadline), 'PPP', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">Liste d'attente</span>
                    <span className="font-medium text-gray-900">
                      {tournament.waitingList?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Available Teams to Join */}
            {!isRegistered && availableTeams.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-3">
                  Équipes qui recrutent
                </h3>
                <div className="space-y-2">
                  {availableTeams.slice(0, 3).map((team) => (
                    <div key={team.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{team.name}</span>
                        <span className="text-gray-500 text-xs">
                          {team.members?.length}/{tournament.playersPerTeam}
                        </span>
                      </div>
                    </div>
                  ))}
                  {availableTeams.length > 3 && (
                    <p className="text-xs text-gray-500 pt-2">
                      +{availableTeams.length - 3} autres équipes
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Results View
        <div>
          {/* Results Tabs */}
          <div className="flex gap-2 border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveResultsTab('pools')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeResultsTab === 'pools'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Poules
            </button>
            <button
              onClick={() => setActiveResultsTab('finals')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeResultsTab === 'finals'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Finales
            </button>
            <button
              onClick={() => setActiveResultsTab('ranking')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeResultsTab === 'ranking'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Classement
            </button>
          </div>

          {/* Results Content */}
          <div className="min-h-[400px]">
            {activeResultsTab === 'pools' && (
              <div className="card">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Phase de poules</h3>
                {tournament.pools && tournament.pools.length > 0 ? (
                  <div className="space-y-6">
                    {tournament.pools.map((pool: any) => (
                      <div key={pool.id}>
                        <h4 className="font-semibold text-gray-900 mb-3">{pool.name}</h4>
                        {pool.matches && pool.matches.length > 0 ? (
                          <div className="space-y-2">
                            {pool.matches.map((match: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <span className="font-medium">{match.team1?.name || 'TBD'}</span>
                                <span className="text-gray-500 mx-4">vs</span>
                                <span className="font-medium">{match.team2?.name || 'TBD'}</span>
                                {match.score && (
                                  <span className="ml-4 font-bold">{match.score}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">Aucun match planifié</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Les poules ne sont pas encore disponibles</p>
                )}
              </div>
            )}

            {activeResultsTab === 'finals' && (
              <div className="card">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Phase finale</h3>
                {tournament.eliminationMatches && tournament.eliminationMatches.length > 0 ? (
                  <div className="space-y-4">
                    {tournament.eliminationMatches.map((match: any, idx: number) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded">
                        <div className="text-sm text-gray-500 mb-2">{match.round}</div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{match.team1?.name || 'TBD'}</span>
                          <span className="text-gray-500 mx-4">vs</span>
                          <span className="font-medium">{match.team2?.name || 'TBD'}</span>
                          {match.score && (
                            <span className="ml-4 font-bold">{match.score}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">La phase finale n'est pas encore disponible</p>
                )}
              </div>
            )}

            {activeResultsTab === 'ranking' && (
              <div className="card">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Classement final</h3>
                {tournament.finalRanking && tournament.finalRanking.length > 0 ? (
                  <div className="space-y-2">
                    {tournament.finalRanking.map((team: any, idx: number) => (
                      <div
                        key={team.id}
                        className={`flex items-center gap-4 p-3 rounded ${
                          idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                          idx === 1 ? 'bg-gray-50 border border-gray-200' :
                          idx === 2 ? 'bg-orange-50 border border-orange-200' :
                          'bg-white border border-gray-100'
                        }`}
                      >
                        <div className={`text-2xl font-bold ${
                          idx === 0 ? 'text-yellow-600' :
                          idx === 1 ? 'text-gray-600' :
                          idx === 2 ? 'text-orange-600' :
                          'text-gray-400'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{team.name}</div>
                          {team.points !== undefined && (
                            <div className="text-sm text-gray-500">{team.points} points</div>
                          )}
                        </div>
                        {idx < 3 && (
                          <Trophy className={
                            idx === 0 ? 'text-yellow-500' :
                            idx === 1 ? 'text-gray-400' :
                            'text-orange-400'
                          } size={24} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Le classement n'est pas encore disponible</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Créer une équipe
            </h3>
            <form onSubmit={handleCreateTeam}>
              <div className="mb-4">
                <label
                  htmlFor="teamName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nom de l'équipe
                </label>
                <input
                  type="text"
                  id="teamName"
                  className="input"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                  placeholder="Les champions"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTeamModal(false);
                    setNewTeamName('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={processingAction}
                  className="btn-primary flex-1"
                >
                  {processingAction ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetailPage;
