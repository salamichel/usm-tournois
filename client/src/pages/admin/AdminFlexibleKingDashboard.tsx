import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import flexibleKingService from '@services/flexibleKing.service';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Play, Settings, CheckCircle, RotateCcw, Trophy, TrendingUp, Users, BarChart3, Award } from 'lucide-react';
import type { FlexibleKingPhase } from '@shared/types';
import FlexibleKingConfigModal from '@components/FlexibleKingConfigModal';
import MatchResultModal from '@components/MatchResultModal';

const AdminFlexibleKingDashboard = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhaseNumber, setSelectedPhaseNumber] = useState<number | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [registeredPlayersCount, setRegisteredPlayersCount] = useState(0);

  useEffect(() => {
    if (tournamentId) {
      loadDashboard();
    }
  }, [tournamentId]);

  const loadDashboard = async () => {
    if (!tournamentId) return;

    setIsLoading(true);
    try {
      const response = await flexibleKingService.getDashboard(tournamentId);
      if (response.success && response.data) {
        setData(response.data);
        setRegisteredPlayersCount(response.data.registeredPlayersCount || 0);
        // Auto-select current phase
        if (response.data.kingData?.currentPhaseNumber) {
          setSelectedPhaseNumber(response.data.kingData.currentPhaseNumber);
        } else if (response.data.kingData?.phases?.length > 0) {
          setSelectedPhaseNumber(response.data.kingData.phases[0].phaseNumber);
        }
      }
    } catch (error: any) {
      // If King Mode not initialized, show config modal but still try to get player count
      if (error.response?.status === 404) {
        setShowConfigModal(true);
        // Get tournament data from regular API to know player count
        try {
          const tournamentResponse = await adminService.getTournamentById(tournamentId);
          if (tournamentResponse.success && tournamentResponse.data) {
            const unassignedPlayers = tournamentResponse.data.unassignedPlayers || [];
            setRegisteredPlayersCount(unassignedPlayers.length);
            console.log(`[Flexible King] Found ${unassignedPlayers.length} unassigned players`);
          }
        } catch (err) {
          // Even if this fails, we still show the modal with 0 players
          console.error('Could not fetch player count:', err);
        }
      } else {
        toast.error('Erreur lors du chargement du dashboard');
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitialize = async (phases: any[]) => {
    if (!tournamentId) return;

    try {
      const response = await flexibleKingService.initialize(tournamentId, { phases });
      if (response.success) {
        toast.success('Mode King flexible initialisé !');
        setShowConfigModal(false);
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'initialisation');
    }
  };

  const handleStartPhase = async (phaseNumber: number) => {
    if (!tournamentId) return;

    try {
      const response = await flexibleKingService.startPhase(tournamentId, phaseNumber);
      if (response.success) {
        toast.success(`Phase ${phaseNumber} démarrée !`);
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Erreur lors du démarrage de la Phase ${phaseNumber}`);
    }
  };

  const handleCompletePhase = async (phaseNumber: number) => {
    if (!tournamentId) return;
    if (!confirm(`Êtes-vous sûr de vouloir terminer la Phase ${phaseNumber} ?`)) return;

    try {
      const response = await flexibleKingService.completePhase(tournamentId, phaseNumber);
      if (response.success) {
        toast.success(`Phase ${phaseNumber} terminée ! ${response.data.qualifiedCount} joueurs qualifiés`);
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la complétion');
    }
  };

  const handleResetPhase = async (phaseNumber: number) => {
    if (!tournamentId) return;
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser la Phase ${phaseNumber} ?`)) return;

    try {
      const response = await flexibleKingService.resetPhase(tournamentId, phaseNumber);
      if (response.success) {
        toast.success(`Phase ${phaseNumber} réinitialisée !`);
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la réinitialisation');
    }
  };

  const handleRecordMatchResult = (phaseNumber: number, match: any) => {
    setSelectedMatch({ phaseNumber, match });
    setShowMatchModal(true);
  };

  const handleSaveMatchResult = async (setsWonTeam1: number, setsWonTeam2: number) => {
    if (!tournamentId || !selectedMatch) return;

    try {
      const response = await flexibleKingService.recordMatchResult(
        tournamentId,
        selectedMatch.phaseNumber,
        selectedMatch.match.id,
        { setsWonTeam1, setsWonTeam2 }
      );

      if (response.success) {
        toast.success('Résultat enregistré !');
        setShowMatchModal(false);
        setSelectedMatch(null);
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleSetRandomScores = async () => {
    if (!tournamentId) return;
    if (!confirm('Voulez-vous définir des scores aléatoires pour tous les matchs non complétés de la phase actuelle ?')) return;

    try {
      const response = await flexibleKingService.setRandomScores(tournamentId);
      if (response.success) {
        toast.success(response.message || 'Scores aléatoires définis !');
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la définition des scores');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  // Show configuration modal if King Mode not initialized
  if (showConfigModal && !data) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mode King Flexible</h1>
              <p className="text-gray-600 mt-1">Initialisation requise</p>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Mode King Flexible non initialisé</h2>
            <p className="text-gray-600 mb-4">
              Configurez les phases du tournoi King pour commencer.
            </p>
            <button onClick={() => setShowConfigModal(true)} className="btn-primary">
              <Settings className="inline mr-2" size={18} />
              Configurer le Mode King
            </button>
          </div>

          <FlexibleKingConfigModal
            isOpen={showConfigModal}
            onClose={() => setShowConfigModal(false)}
            onSave={handleInitialize}
            registeredPlayersCount={registeredPlayersCount}
          />
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout>
        <div>
          <p className="text-red-600">Erreur : Impossible de charger le dashboard</p>
        </div>
      </AdminLayout>
    );
  }

  const { tournament, kingData } = data;
  const playerCount = data.registeredPlayersCount || registeredPlayersCount;
  const phases: FlexibleKingPhase[] = kingData?.phases || [];
  const currentPhaseNumber = kingData?.currentPhaseNumber;

  // Get the selected phase to display
  const displayPhase = phases.find(p => p.phaseNumber === selectedPhaseNumber);

  // Helper function to group matches by round
  const groupMatchesByRound = (matches: any[]) => {
    if (!matches || matches.length === 0) return [];

    const roundsMap = new Map<string, { id: string; name: string; matches: any[] }>();

    matches.forEach(match => {
      const roundId = match.roundId || 'unknown';
      const roundName = match.roundName || `Tournée ${roundId}`;

      if (!roundsMap.has(roundId)) {
        roundsMap.set(roundId, {
          id: roundId,
          name: roundName,
          matches: []
        });
      }

      roundsMap.get(roundId)!.matches.push(match);
    });

    // Sort rounds by their ID (which contains the round number)
    return Array.from(roundsMap.values()).sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  };

  // Transform pools to include rounds
  const transformedPools = displayPhase?.pools?.map(pool => ({
    ...pool,
    rounds: groupMatchesByRound(pool.matches || [])
  })) || [];

  const getPhaseStatusBadge = (status: string) => {
    switch (status) {
      case 'not_configured':
        return <span className="badge badge-secondary">Non configurée</span>;
      case 'configured':
        return <span className="badge badge-info">Configurée</span>;
      case 'in_progress':
        return <span className="badge badge-warning">En cours</span>;
      case 'completed':
        return <span className="badge badge-success">Terminée</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Mode King Flexible</h1>
            <p className="text-gray-600 mt-1">{tournament.name}</p>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Settings size={18} />
            Reconfigurer
          </button>
        </div>

        {/* Status Card */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Statut du Tournoi</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Phase Actuelle</p>
              <p className="text-2xl font-bold text-primary-600">
                {currentPhaseNumber ? `Phase ${currentPhaseNumber}` : 'Non démarrée'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Joueurs Inscrits</p>
              <p className="text-2xl font-bold">{playerCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phases Totales</p>
              <p className="text-2xl font-bold">{phases.length}</p>
            </div>
          </div>

          {/* Random Scores Button */}
          {currentPhaseNumber && phases.find(p => p.phaseNumber === currentPhaseNumber)?.status === 'in_progress' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleSetRandomScores}
                className="btn-secondary text-sm flex items-center gap-2"
                title="Définir des scores aléatoires pour tous les matchs non complétés de la phase actuelle"
              >
                🎲 Scores Aléatoires (Test)
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Définir des scores aléatoires pour tous les matchs non complétés de la phase actuelle
              </p>
            </div>
          )}
        </div>

        {/* Tournament Winner Card - Show when last phase is completed */}
        {phases.length > 0 && phases[phases.length - 1].status === 'completed' && phases[phases.length - 1].ranking && (
          <div className="card bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-400">
            <div className="text-center">
              <Trophy className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-yellow-800 mb-2">Tournoi Terminé !</h2>
              <p className="text-lg text-yellow-700 mb-4">Le King du Tournoi est :</p>
              <div className="bg-white rounded-lg p-4 inline-block shadow-lg">
                <p className="text-3xl font-bold text-primary-600">
                  🏆 {phases[phases.length - 1].ranking[0]?.playerPseudo || 'Vainqueur'}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {phases[phases.length - 1].ranking[0]?.wins || 0} victoires - {phases[phases.length - 1].ranking[0]?.losses || 0} défaites
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Phases Overview */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500" />
            Phases du Tournoi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {phases.map((phase) => (
              <div
                key={phase.id}
                className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                  selectedPhaseNumber === phase.phaseNumber
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPhaseNumber(phase.phaseNumber)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">Phase {phase.phaseNumber}</h3>
                  {getPhaseStatusBadge(phase.status)}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">Format:</span> {phase.config.gameMode.toUpperCase()}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Type:</span>{' '}
                    {phase.config.phaseFormat === 'round-robin' ? 'Round Robin' : 'King of the Beach'}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Poules:</span> {phase.config.numberOfPools}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Qualifiés:</span> {phase.config.totalQualified} joueurs
                  </p>
                </div>

                {/* Phase Actions */}
                <div className="mt-3 flex gap-2">
                  {phase.status === 'configured' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartPhase(phase.phaseNumber);
                      }}
                      className="btn-primary text-xs flex-1"
                      disabled={currentPhaseNumber && currentPhaseNumber !== phase.phaseNumber - 1}
                    >
                      <Play size={14} className="inline mr-1" />
                      Démarrer
                    </button>
                  )}
                  {phase.status === 'in_progress' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompletePhase(phase.phaseNumber);
                      }}
                      className="btn-success text-xs flex-1"
                    >
                      <CheckCircle size={14} className="inline mr-1" />
                      Terminer
                    </button>
                  )}
                  {(phase.status === 'in_progress' || phase.status === 'completed') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetPhase(phase.phaseNumber);
                      }}
                      className="btn-secondary text-xs"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase Details */}
        {displayPhase && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-500" />
              Phase {displayPhase.phaseNumber} - Détails
            </h2>

            {/* Phase Summary Statistics - At the top */}
            {transformedPools && transformedPools.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4 bg-white mb-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="text-purple-500" />
                  Statistiques de la Phase
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-2xl font-bold text-primary-600">
                      {transformedPools.reduce((sum: number, pool: any) => sum + (pool.matches?.length || 0), 0)}
                    </p>
                    <p className="text-xs text-gray-600">Matchs Total</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-2xl font-bold text-green-600">
                      {transformedPools.reduce((sum: number, pool: any) =>
                        sum + (pool.matches?.filter((m: any) => m.status === 'completed').length || 0), 0)}
                    </p>
                    <p className="text-xs text-gray-600">Matchs Terminés</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-2xl font-bold text-blue-600">
                      {transformedPools.reduce((sum: number, pool: any) => sum + (pool.players?.length || 0), 0)}
                    </p>
                    <p className="text-xs text-gray-600">Joueurs</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-2xl font-bold text-purple-600">
                      {transformedPools.length}
                    </p>
                    <p className="text-xs text-gray-600">Poules</p>
                  </div>
                </div>
              </div>
            )}

            {transformedPools && transformedPools.length > 0 ? (
              <div className="space-y-6">
                {transformedPools.map((pool: any) => (
                  <div key={pool.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-primary-600">{pool.name}</h3>
                      {/* Pool Statistics */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                          <Users size={14} />
                          {pool.players?.length || 0} joueurs
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <BarChart3 size={14} />
                          {pool.matches?.filter((m: any) => m.status === 'completed').length || 0}/
                          {pool.matches?.length || 0} matchs
                        </span>
                      </div>
                    </div>

                    {/* Players in Pool */}
                    {pool.players && pool.players.length > 0 && (
                      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <Users size={16} />
                          Joueurs de la Poule ({pool.players.length})
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {pool.players.map((player: any, index: number) => (
                            <div
                              key={player.id || index}
                              className="bg-gray-50 p-2 rounded border-l-2 border-primary-500"
                            >
                              <p className="text-xs text-gray-700 truncate">
                                {index + 1}. {player.pseudo || player.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rounds with Matches */}
                    {pool.rounds && pool.rounds.length > 0 ? (
                      <div className="space-y-4">
                        {pool.rounds.map((round: any) => (
                          <div key={round.id} className="bg-white rounded-lg border border-gray-300 p-4">
                            <h4 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                              <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm">
                                {round.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({round.matches.filter((m: any) => m.status === 'completed').length}/
                                {round.matches.length} complétés)
                              </span>
                            </h4>

                            <div className="space-y-3">
                              {round.matches.map((match: any) => (
                                <div
                                  key={match.id}
                                  className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                    {/* Team 1 */}
                                    <div className="md:col-span-5">
                                      <div className="font-medium text-gray-900 mb-1">
                                        {match.team1?.name || 'TBD'}
                                      </div>
                                      {match.team1?.members && (
                                        <div className="flex flex-wrap gap-1">
                                          {match.team1.members.map((player: any, idx: number) => (
                                            <span
                                              key={idx}
                                              className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                                            >
                                              {player.pseudo || player.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Score */}
                                    <div className="md:col-span-2 text-center">
                                      {match.status === 'completed' ? (
                                        <div className="flex items-center justify-center gap-2">
                                          <span
                                            className={`text-lg font-bold ${
                                              (match.setsWonTeam1 || 0) > (match.setsWonTeam2 || 0)
                                                ? 'text-green-600'
                                                : 'text-gray-600'
                                            }`}
                                          >
                                            {match.setsWonTeam1 || 0}
                                          </span>
                                          <span className="text-gray-400">-</span>
                                          <span
                                            className={`text-lg font-bold ${
                                              (match.setsWonTeam2 || 0) > (match.setsWonTeam1 || 0)
                                                ? 'text-green-600'
                                                : 'text-gray-600'
                                            }`}
                                          >
                                            {match.setsWonTeam2 || 0}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">vs</span>
                                      )}
                                    </div>

                                    {/* Team 2 */}
                                    <div className="md:col-span-5">
                                      <div className="font-medium text-gray-900 mb-1">
                                        {match.team2?.name || 'TBD'}
                                      </div>
                                      {match.team2?.members && (
                                        <div className="flex flex-wrap gap-1">
                                          {match.team2.members.map((player: any, idx: number) => (
                                            <span
                                              key={idx}
                                              className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
                                            >
                                              {player.pseudo || player.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="mt-3 flex items-center justify-between">
                                    <div>
                                      {match.status === 'completed' ? (
                                        <span className="badge badge-success text-xs">Terminé</span>
                                      ) : (
                                        <span className="badge badge-warning text-xs">En attente</span>
                                      )}
                                    </div>
                                    {displayPhase.status === 'in_progress' && (
                                      <button
                                        onClick={() => handleRecordMatchResult(displayPhase.phaseNumber, match)}
                                        className="btn-primary text-xs px-3 py-1"
                                      >
                                        {match.status === 'completed' ? 'Modifier' : 'Enregistrer'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">Aucune tournée dans cette poule</p>
                    )}
                  </div>
                ))}

                {/* Provisional Ranking */}
                {displayPhase.ranking && displayPhase.ranking.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white mt-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <TrendingUp className="text-blue-500" />
                      Classement Provisoire
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Joueur</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">V</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">D</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayPhase.ranking.slice(0, 20).map((player: any, index: number) => (
                            <tr
                              key={player.playerId || index}
                              className={`border-b ${index < displayPhase.config.totalQualified ? 'bg-green-50' : ''}`}
                            >
                              <td className="px-3 py-2 font-medium">
                                {index + 1}
                                {index < 3 && (
                                  <span className="ml-1">
                                    {index === 0 && '🥇'}
                                    {index === 1 && '🥈'}
                                    {index === 2 && '🥉'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">{player.playerPseudo || player.playerId}</td>
                              <td className="px-3 py-2 text-center text-green-600 font-medium">{player.wins || 0}</td>
                              <td className="px-3 py-2 text-center text-red-600 font-medium">{player.losses || 0}</td>
                              <td className="px-3 py-2 text-center">
                                {player.wins + player.losses > 0
                                  ? Math.round((player.wins / (player.wins + player.losses)) * 100)
                                  : 0}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {displayPhase.ranking.length > 20 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Affichage des 20 premiers sur {displayPhase.ranking.length} joueurs
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Les {displayPhase.config.totalQualified} premiers joueurs (en vert) seront qualifiés pour la phase suivante
                    </p>
                  </div>
                )}

                {/* Qualified Players or Final Podium */}
                {displayPhase.qualifiedIds && displayPhase.qualifiedIds.length > 0 && (
                  displayPhase.phaseNumber === phases.length ? (
                    // Final Phase - Show Podium
                    <div className="border border-yellow-300 rounded-lg p-4 bg-yellow-50 mt-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Trophy className="text-yellow-600" />
                        Podium Final
                      </h3>
                      <div className="flex flex-wrap justify-center gap-4">
                        {displayPhase.ranking?.slice(0, 3).map((player: any, index: number) => (
                          <div
                            key={player.playerId}
                            className={`p-4 rounded-lg text-center ${
                              index === 0 ? 'bg-yellow-200 border-2 border-yellow-400' :
                              index === 1 ? 'bg-gray-200 border-2 border-gray-400' :
                              'bg-orange-200 border-2 border-orange-400'
                            }`}
                          >
                            <p className="text-3xl mb-2">
                              {index === 0 && '🥇'}
                              {index === 1 && '🥈'}
                              {index === 2 && '🥉'}
                            </p>
                            <p className="font-bold">{player.playerPseudo || player.playerId}</p>
                            <p className="text-sm text-gray-600">
                              {player.wins}V - {player.losses}D
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Not final phase - Show qualified players
                    <div className="border border-green-200 rounded-lg p-4 bg-green-50 mt-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Award className="text-green-600" />
                        Joueurs Qualifiés pour la Phase Suivante ({displayPhase.qualifiedIds.length})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {displayPhase.qualifiedIds.map((playerId: string, index: number) => {
                          // Try to find player info from ranking
                          const playerInfo = displayPhase.ranking?.find((p: any) => p.playerId === playerId);
                          return (
                            <div
                              key={playerId}
                              className="bg-white p-2 rounded border border-green-300 text-center"
                            >
                              <p className="text-xs font-medium text-green-700 truncate">
                                {index + 1}. {playerInfo?.playerPseudo || playerId.slice(0, 8)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}

              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Aucune poule créée pour cette phase</p>
                {displayPhase.status === 'configured' && (
                  <button onClick={() => handleStartPhase(displayPhase.phaseNumber)} className="btn-primary">
                    <Play size={18} className="inline mr-2" />
                    Démarrer la Phase {displayPhase.phaseNumber}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <FlexibleKingConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSave={handleInitialize}
          registeredPlayersCount={playerCount}
          existingPhases={phases.map(p => p.config)}
        />

        {showMatchModal && selectedMatch && (
          <MatchResultModal
            isOpen={showMatchModal}
            onClose={() => {
              setShowMatchModal(false);
              setSelectedMatch(null);
            }}
            onSave={handleSaveMatchResult}
            match={selectedMatch.match}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminFlexibleKingDashboard;
