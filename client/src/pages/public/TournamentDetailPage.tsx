import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import tournamentService from '@services/tournament.service';
import matchService from '@services/match.service';
import type { TournamentDetails, Team } from '@shared/types';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import TournamentBracket from '@components/TournamentBracket';
import MatchScoreModal from '@components/admin/MatchScoreModal';
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
  Settings,
  Edit,
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
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [matchContext, setMatchContext] = useState<{ type: 'pool' | 'elimination'; poolId?: string } | null>(null);

  const fetchTournament = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const response = await tournamentService.getTournamentById(id);
      if (response.success && response.data) {
        // Merge tournament data with additional arrays
        const tournamentData: any = {
          ...response.data.tournament,
          teams: response.data.teams || [],
          unassignedPlayers: response.data.unassignedPlayers || [],
          waitingList: response.data.waitingList || [],
          pools: response.data.pools || [],
          eliminationMatches: response.data.eliminationMatches || [],
          finalRanking: response.data.finalRanking || [],
        };
        setTournament(tournamentData);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement du tournoi');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchTournament();
    }
  }, [id, fetchTournament]);

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

  // Check if user is captain of a team in a match
  const isCaptainInMatch = (match: any): boolean => {
    if (!user || !tournament) return false;

    const team1 = tournament.teams?.find(t => t.id === match.team1?.id);
    const team2 = tournament.teams?.find(t => t.id === match.team2?.id);

    return (team1?.captainId === user.uid) || (team2?.captainId === user.uid);
  };

  // Check if ranking is frozen
  const isRankingFrozen = (): boolean => {
    return tournament?.finalRanking && tournament.finalRanking.length > 0;
  };

  // Open score modal for a match
  const handleOpenScoreModal = (match: any, type: 'pool' | 'elimination', poolId?: string) => {
    if (isRankingFrozen()) {
      toast.error('Le classement est figé. Vous ne pouvez plus modifier les scores.');
      return;
    }

    setSelectedMatch(match);
    setMatchContext({ type, poolId });
    setShowScoreModal(true);
  };

  // Submit match scores
  const handleSubmitScores = async (sets: any[]) => {
    if (!id || !selectedMatch || !matchContext) return;

    try {
      const response = await matchService.submitScores(id, selectedMatch.id, {
        sets,
        matchType: matchContext.type,
        poolId: matchContext.poolId,
      });

      if (response.success) {
        toast.success('Scores enregistrés avec succès !');
        setShowScoreModal(false);
        setSelectedMatch(null);
        setMatchContext(null);
        fetchTournament();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message || 'Erreur lors de l\'enregistrement des scores'
      );
      throw error;
    }
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
    // A team is complete if it has at least minPlayersPerTeam members
    const minPlayers = tournament.minPlayersPerTeam || tournament.playersPerTeam;
    return (
      tournament.teams?.filter(
        (team) => (team.members?.length || 0) >= minPlayers
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
    // A team is complete if it has at least minPlayersPerTeam members
    const minPlayers = tournament?.minPlayersPerTeam || tournament?.playersPerTeam;
    return (team.members?.length || 0) >= minPlayers;
  };

  // Calculate if tournament is full based on complete teams
  const isFullByCompleteTeams = (): boolean => {
    if (!tournament) return false;
    return getCompleteTeamsCount() >= tournament.maxTeams;
  };

  // Calculate if tournament is full based on total teams (for waiting list)
  const isFullByTotalTeams = (): boolean => {
    if (!tournament) return false;
    return (tournament.teams?.length || 0) >= tournament.maxTeams;
  };

  // Check if registrations are open based on date windows
  const areRegistrationsOpen = (): boolean => {
    if (!tournament) return false;
    const now = new Date();
    const registrationStarts = tournament.registrationStartDateTime
      ? new Date(tournament.registrationStartDateTime)
      : new Date(0);
    const registrationEnds = tournament.registrationEndDateTime
      ? new Date(tournament.registrationEndDateTime)
      : new Date(8640000000000000);
    return now >= registrationStarts && now <= registrationEnds;
  };

  // Determine what buttons to show based on tournament state
  const getRegistrationButtons = () => {
    if (!tournament || !user) return { showRegister: false, showWaitingList: false };

    const registrationsOpen = areRegistrationsOpen();
    const fullByComplete = isFullByCompleteTeams();
    const fullByTotal = isFullByTotalTeams();

    // If user is already registered or on waiting list, don't show registration buttons
    if (isUserRegistered()) {
      return { showRegister: false, showWaitingList: false };
    }

    // If registrations are not open, don't show any buttons
    if (!registrationsOpen) {
      return { showRegister: false, showWaitingList: false };
    }

    // If full by complete teams, check if waiting list is available
    if (fullByComplete) {
      const showWaitingList = tournament.waitingListEnabled &&
                              (tournament.waitingListSize || 0) > 0 &&
                              !fullByTotal;
      return { showRegister: false, showWaitingList };
    }

    // Otherwise, show registration buttons
    return { showRegister: true, showWaitingList: false };
  };

  // Get registration status message for display
  const getRegistrationStatusMessage = (): { message: string; type: 'info' | 'warning' | 'error' } | null => {
    if (!tournament) return null;

    const now = new Date();
    const registrationStarts = tournament.registrationStartDateTime
      ? new Date(tournament.registrationStartDateTime)
      : new Date(0);
    const registrationEnds = tournament.registrationEndDateTime
      ? new Date(tournament.registrationEndDateTime)
      : new Date(8640000000000000);
    const tournamentDate = tournament.date ? new Date(tournament.date) : null;

    // Check if tournament is finished
    if (tournamentDate && now > tournamentDate) {
      return {
        message: 'Ce tournoi est terminé.',
        type: 'info'
      };
    }

    // Check if registrations haven't started yet
    if (now < registrationStarts) {
      return {
        message: `Les inscriptions ouvriront le ${format(registrationStarts, 'PPP', { locale: fr })} à ${format(registrationStarts, 'HH:mm', { locale: fr })}`,
        type: 'info'
      };
    }

    // Check if registrations are closed
    if (now > registrationEnds) {
      return {
        message: `Les inscriptions pour ce tournoi sont fermées depuis le ${format(registrationEnds, 'PPP', { locale: fr })} à ${format(registrationEnds, 'HH:mm', { locale: fr })}`,
        type: 'warning'
      };
    }

    // Check if tournament is completely full (no waiting list available)
    if (isFullByCompleteTeams() && !registrationButtons.showWaitingList) {
      return {
        message: 'Le tournoi est complet.',
        type: 'warning'
      };
    }

    return null;
  };

  // Calculate match winner based on sets
  const getMatchWinner = (match: any): { winner: string | null; team1Wins: number; team2Wins: number } => {
    if (!match.sets || match.sets.length === 0) {
      return { winner: null, team1Wins: 0, team2Wins: 0 };
    }

    let team1Wins = 0;
    let team2Wins = 0;

    match.sets.forEach((set: any) => {
      if (set.score1 !== null && set.score2 !== null) {
        if (set.score1 > set.score2) {
          team1Wins++;
        } else if (set.score2 > set.score1) {
          team2Wins++;
        }
      }
    });

    let winner = null;
    if (match.status === 'completed') {
      if (team1Wins > team2Wins) {
        winner = match.team1Name || match.team1?.name;
      } else if (team2Wins > team1Wins) {
        winner = match.team2Name || match.team2?.name;
      }
    }

    return { winner, team1Wins, team2Wins };
  };

  // Format match sets score
  const formatSetsScore = (match: any): string => {
    if (!match.sets || match.sets.length === 0) return 'N/A';

    return match.sets
      .filter((set: any) => set.score1 !== null && set.score2 !== null)
      .map((set: any) => `${set.score1}-${set.score2}`)
      .join(', ');
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
  const registrationButtons = getRegistrationButtons();
  const registrationStatusMessage = getRegistrationStatusMessage();

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
                tournament.status === 'Avenir' ? 'badge-info' :
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
                <p className="text-sm text-gray-500">Équipes complètes</p>
                <p className="font-semibold">
                  {completeTeams} / {tournament.maxTeams}
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
                <div className="markdown-content">
                  <ReactMarkdown>{tournament.description}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Login Prompt for Non-Authenticated Users */}
            {!isAuthenticated && areRegistrationsOpen() && !isFullByCompleteTeams() && (
              <div className="card bg-gray-50 border-2 border-gray-300">
                <p className="text-gray-700 mb-4 text-center">
                  Vous devez être connecté pour vous inscrire à ce tournoi
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full"
                >
                  Se connecter
                </button>
              </div>
            )}

            {/* Registration Status Message */}
            {!isRegistered && registrationStatusMessage && (
              <div className={`card ${
                registrationStatusMessage.type === 'info' ? 'bg-blue-50 border-2 border-blue-200' :
                registrationStatusMessage.type === 'warning' ? 'bg-yellow-50 border-2 border-yellow-200' :
                'bg-red-50 border-2 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={
                    registrationStatusMessage.type === 'info' ? 'text-blue-600' :
                    registrationStatusMessage.type === 'warning' ? 'text-yellow-600' :
                    'text-red-600'
                  } size={24} />
                  <p className="text-gray-700">{registrationStatusMessage.message}</p>
                </div>
              </div>
            )}

            {/* Registration Section */}
            {registrationButtons.showRegister && (
              <div className="card bg-primary-50 border-2 border-primary-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  S'inscrire au tournoi
                </h2>
                <p className="text-gray-600 mb-4">
                  {tournament?.registrationMode === 'random' || tournament?.tournamentFormat === 'king'
                    ? 'Inscrivez-vous comme joueur. Les équipes seront générées de manière équilibrée par niveau par l\'admin.'
                    : 'Choisissez votre mode d\'inscription'}
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
                  {tournament?.registrationMode !== 'random' && tournament?.tournamentFormat !== 'king' && (
                    <button
                      onClick={() => setShowCreateTeamModal(true)}
                      disabled={processingAction}
                      className="btn-secondary"
                    >
                      <Trophy size={20} className="mr-2" />
                      Créer une équipe
                    </button>
                  )}
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

                    <div className="flex gap-3 mt-4">
                      {userTeam && userTeam.captainId === user?.uid && (
                        <button
                          onClick={() => navigate(`/gestion-equipe/${tournament.id}/${userTeam.id}`)}
                          className="btn-primary"
                        >
                          <Settings size={20} className="mr-2" />
                          Gérer mon équipe
                        </button>
                      )}
                      <button
                        onClick={handleLeaveTournament}
                        disabled={processingAction}
                        className="btn-danger"
                      >
                        <UserMinus size={20} className="mr-2" />
                        Se désinscrire
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tournament Full - Show waiting list option */}
            {registrationButtons.showWaitingList && (
              <div className="card bg-yellow-50 border-2 border-yellow-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Tournoi complet
                </h3>
                <p className="text-gray-600 mb-4">
                  Le tournoi est complet (nombre maximum d'équipes complètes atteint), mais vous pouvez rejoindre la liste d'attente.
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
                      {tournament.teams.map((team) => {
                        const teamComplete = isTeamComplete(team);
                        return (
                        <div
                          key={team.id}
                          className={`card ${teamComplete ? 'border-2 border-green-500 bg-green-50' : 'border border-gray-200'}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-gray-900">
                                {team.name}
                              </h3>
                              {teamComplete ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="text-green-600" size={20} />
                                  <span className="text-xs font-semibold text-green-700">Complète</span>
                                </div>
                              ) : (
                                <XCircle className="text-gray-400" size={18} />
                              )}
                            </div>
                            {team.recruitmentOpen && !teamComplete && (
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
                            <div className="flex gap-2">
                              {user?.uid === team.captainId && (
                                <button
                                  onClick={() => navigate(`/gestion-equipe/${tournament.id}/${team.id}`)}
                                  className="btn-secondary text-sm"
                                >
                                  <Settings size={16} className="mr-1" />
                                  Gérer
                                </button>
                              )}
                              {registrationButtons.showRegister &&
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
                        </div>
                        );
                      })}
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

            {/* WhatsApp QR Code for registered users */}
            {isRegistered && tournament.whatsappGroupLink && (
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-3">
                  Groupe WhatsApp
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Scannez ou cliquez sur le QR code pour rejoindre le groupe du tournoi :
                </p>
                <a
                  href={tournament.whatsappGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex justify-center p-2 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tournament.whatsappGroupLink)}`}
                    alt="QR Code Groupe WhatsApp"
                    className="w-36 h-36"
                  />
                </a>
              </div>
            )}

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
              <div>
                {tournament.pools && tournament.pools.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {tournament.pools.map((pool: any) => (
                      <div key={pool.id} className="card">
                        <h3 className="text-2xl font-bold text-center mb-4">{pool.name}</h3>

                        {pool.teams && pool.teams.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-bold mb-3">Équipes:</h4>
                            <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                              {pool.teams.map((team: any, idx: number) => (
                                <li key={idx}>{team.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {pool.matches && pool.matches.length > 0 ? (
                          <div className="mb-6">
                            <h4 className="font-bold mb-3">Matchs</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="p-3 text-left rounded-l-lg">Match</th>
                                    <th className="p-3 text-center">Score</th>
                                    <th className="p-3 text-center">Statut</th>
                                    <th className="p-3 text-center">Gagnant</th>
                                    {isAuthenticated && <th className="p-3 text-center rounded-r-lg">Actions</th>}
                                  </tr>
                                </thead>
                                <tbody className="text-gray-700">
                                  {pool.matches.map((match: any, idx: number) => {
                                    const { winner } = getMatchWinner(match);
                                    const score = formatSetsScore(match);
                                    const canEditScore = isCaptainInMatch(match) && !isRankingFrozen();

                                    return (
                                      <tr key={idx} className="border-b border-gray-200">
                                        <td className="p-3 text-sm">
                                          {match.team1Name || match.team1?.name || 'TBD'} vs {match.team2Name || match.team2?.name || 'TBD'}
                                        </td>
                                        <td className="text-center">
                                          <span className="font-bold">{score}</span>
                                        </td>
                                        <td className="text-center">
                                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            match.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {match.status}
                                          </span>
                                        </td>
                                        <td className="p-3 text-sm text-center">
                                          {winner ? (
                                            <span className="font-bold text-green-600">{winner}</span>
                                          ) : match.status === 'completed' ? (
                                            <span>Match nul</span>
                                          ) : (
                                            <span>N/A</span>
                                          )}
                                        </td>
                                        {isAuthenticated && (
                                          <td className="p-3 text-center">
                                            {canEditScore ? (
                                              <button
                                                onClick={() => handleOpenScoreModal(match, 'pool', pool.id)}
                                                className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1"
                                                title="Saisir le score"
                                              >
                                                <Edit size={14} />
                                                Saisir
                                              </button>
                                            ) : (
                                              <span className="text-gray-400 text-xs">-</span>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm italic">Aucun match généré pour cette poule.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">Aucune poule configurée pour ce tournoi.</p>
                )}
              </div>
            )}

            {activeResultsTab === 'finals' && (
              <div className="card">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Phase d'Élimination</h2>
                {tournament.eliminationMatches && tournament.eliminationMatches.length > 0 ? (
                  <TournamentBracket
                    matches={tournament.eliminationMatches}
                    user={user}
                    teams={tournament.teams}
                    onEditScore={(match) => handleOpenScoreModal(match, 'elimination')}
                    isRankingFrozen={isRankingFrozen()}
                  />
                ) : (
                  <p className="text-gray-500 text-center py-8">Aucune phase d'élimination configurée pour ce tournoi.</p>
                )}
              </div>
            )}

            {activeResultsTab === 'ranking' && (
              <div className="card max-w-lg mx-auto">
                <h3 className="text-2xl font-bold mb-6 text-center">Classement Final</h3>
                {tournament.finalRanking && tournament.finalRanking.length > 0 ? (
                  <ol className="space-y-3">
                    {tournament.finalRanking.map((team: any, index: number) => (
                      <li
                        key={team.id || index}
                        className="card p-4 flex flex-col items-start bg-white border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center w-full mb-2">
                          <span className="text-3xl mr-4 min-w-[40px] text-center">
                            {index === 0 ? (
                              <Trophy className="text-yellow-400 inline" size={32} />
                            ) : index === 1 ? (
                              <Trophy className="text-gray-300 inline" size={28} />
                            ) : index === 2 ? (
                              <Trophy className="text-orange-400 inline" size={28} />
                            ) : (
                              <span className="font-bold text-gray-400">{index + 1}.</span>
                            )}
                          </span>
                          <span className="flex-grow font-bold text-lg text-gray-900">
                            {team.teamName || team.name}
                          </span>
                          <span className="text-xl font-bold text-primary-600 ml-auto">
                            {team.points || 0} pts
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-gray-500 text-center">Aucun classement final disponible pour le moment.</p>
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

      {/* Match Score Modal */}
      {selectedMatch && matchContext && (
        <MatchScoreModal
          isOpen={showScoreModal}
          onClose={() => {
            setShowScoreModal(false);
            setSelectedMatch(null);
            setMatchContext(null);
          }}
          onSave={handleSubmitScores}
          match={selectedMatch}
          setsToWin={
            matchContext.type === 'pool'
              ? tournament?.setsPerMatchPool || 1
              : tournament?.setsPerMatchElimination || 3
          }
          pointsPerSet={
            matchContext.type === 'pool'
              ? tournament?.pointsPerSetPool || 21
              : tournament?.pointsPerSetElimination || 21
          }
        />
      )}
    </div>
  );
};

export default TournamentDetailPage;
