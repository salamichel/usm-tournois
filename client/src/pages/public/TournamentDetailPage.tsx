import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import tournamentService from '@services/tournament.service';
import type { TournamentDetails, Team } from '@shared/types';
import toast from 'react-hot-toast';
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Trophy,
  UserPlus,
  UserMinus,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const TournamentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

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

  // Check if current user is registered
  const isUserRegistered = () => {
    if (!user || !tournament) return false;
    // Check in unassigned players
    const isUnassigned = tournament.unassignedPlayers?.some(
      (p) => p.userId === user.uid
    );
    // Check in teams
    const isInTeam = tournament.teams?.some((team) =>
      team.members?.some((m) => m.userId === user.uid)
    );
    return isUnassigned || isInTeam;
  };

  const getUserTeam = (): Team | null => {
    if (!user || !tournament) return null;
    return (
      tournament.teams?.find((team) =>
        team.members?.some((m) => m.userId === user.uid)
      ) || null
    );
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tournament Header */}
      <div className="mb-8">
        {tournament.coverImage && (
          <img
            src={tournament.coverImage}
            alt={tournament.name}
            className="w-full h-64 object-cover rounded-lg mb-6"
          />
        )}
        <h1 className="text-4xl font-bold text-gray-900">{tournament.name}</h1>
        {tournament.description && (
          <p className="text-gray-600 mt-2">{tournament.description}</p>
        )}
      </div>

      {/* Tournament Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-3">
            <Calendar className="text-primary-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-semibold">
                {format(new Date(tournament.date), 'PPP', { locale: fr })}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <MapPin className="text-primary-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Lieu</p>
              <p className="font-semibold">{tournament.location}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <Users className="text-primary-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Équipes</p>
              <p className="font-semibold">
                {tournament.teams?.length || 0} / {tournament.maxTeams}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <DollarSign className="text-primary-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Prix</p>
              <p className="font-semibold">{tournament.price}€</p>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Section */}
      {!isRegistered && tournament.status === 'Ouvert' && (
        <div className="card mb-8 bg-primary-50 border-2 border-primary-200">
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
        <div className="card mb-8 bg-green-50 border-2 border-green-200">
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
        <div className="card mb-8 bg-yellow-50 border-2 border-yellow-200">
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

      {/* Teams List */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Équipes inscrites ({tournament.teams?.length || 0})
        </h2>
        {tournament.teams && tournament.teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournament.teams.map((team) => (
              <div key={team.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    {team.name}
                  </h3>
                  {team.recruitmentOpen && (
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
                      className="btn-primary mt-3 w-full text-sm"
                    >
                      Rejoindre
                    </button>
                  )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Aucune équipe inscrite pour le moment</p>
        )}
      </div>

      {/* Unassigned Players */}
      {tournament.unassignedPlayers &&
        tournament.unassignedPlayers.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Joueurs sans équipe ({tournament.unassignedPlayers.length})
            </h2>
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
