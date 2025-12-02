import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import teamKingService from '@services/teamKing.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Play, Check, Trophy, Users, Calendar } from 'lucide-react';
import type {
  TeamKingDashboardData,
  TeamKingPhase,
  TeamKingMatch,
  TeamKingRanking,
  TeamKingPhaseConfig,
} from '@shared/types/team-king.types';

const AdminTeamKingDashboard = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<TeamKingDashboardData | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<number>(1);

  // Configuration state for initialization
  const [phaseConfigs, setPhaseConfigs] = useState<TeamKingPhaseConfig[]>([
    {
      phaseNumber: 1,
      gameMode: '4v4',
      phaseFormat: 'kob',
      playersPerTeam: 4,
      totalTeams: 16,
      numberOfPools: 4,
      teamsPerPool: 4,
      qualifiedPerPool: 2,
      totalQualified: 8,
      fields: 2,
      estimatedRounds: 5,
      totalMatches: 40,
      estimatedTime: 200,
      setsPerMatch: 2,
      pointsPerSet: 21,
      tieBreakEnabled: false,
    },
    {
      phaseNumber: 2,
      gameMode: '3v3',
      phaseFormat: 'kob',
      playersPerTeam: 3,
      totalTeams: 8,
      numberOfPools: 2,
      teamsPerPool: 4,
      qualifiedPerPool: 2,
      totalQualified: 4,
      fields: 2,
      estimatedRounds: 5,
      totalMatches: 20,
      estimatedTime: 100,
      setsPerMatch: 2,
      pointsPerSet: 21,
      tieBreakEnabled: false,
    },
    {
      phaseNumber: 3,
      gameMode: '2v2',
      phaseFormat: 'kob',
      playersPerTeam: 2,
      totalTeams: 4,
      numberOfPools: 1,
      teamsPerPool: 4,
      qualifiedPerPool: 1,
      totalQualified: 1,
      fields: 2,
      estimatedRounds: 7,
      totalMatches: 14,
      estimatedTime: 70,
      setsPerMatch: 2,
      pointsPerSet: 21,
      tieBreakEnabled: false,
    },
  ]);

  useEffect(() => {
    loadDashboard();
  }, [tournamentId]);

  const loadDashboard = async () => {
    if (!tournamentId) return;

    try {
      setLoading(true);
      const response = await teamKingService.getTeamKingDashboard(tournamentId);

      if (response.data?.success) {
        setDashboardData(response.data.data);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Tournament exists but Team King not initialized yet
        console.log('Team King not initialized for this tournament');
      } else {
        toast.error('Erreur lors du chargement du dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    if (!tournamentId) return;

    try {
      setIsInitializing(true);
      await teamKingService.initializeTeamKing(tournamentId, phaseConfigs);
      toast.success('Mode Team King initialisé avec succès !');
      await loadDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'initialisation');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStartPhase = async (phaseNumber: number) => {
    if (!tournamentId) return;

    try {
      await teamKingService.startPhase(tournamentId, phaseNumber);
      toast.success(`Phase ${phaseNumber} démarrée !`);
      await loadDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du démarrage de la phase');
    }
  };

  const handleCompletePhase = async (phaseNumber: number) => {
    if (!tournamentId) return;

    try {
      const response = await teamKingService.completePhase(tournamentId, phaseNumber);
      toast.success(`Phase ${phaseNumber} terminée ! ${response.data?.data?.qualifiedTeamIds?.length || 0} équipes qualifiées`);
      await loadDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la complétion de la phase');
    }
  };

  const handleRecordResult = async (phaseNumber: number, matchId: string, setsTeam1: number, setsTeam2: number) => {
    if (!tournamentId) return;

    try {
      await teamKingService.recordMatchResult(tournamentId, phaseNumber, matchId, setsTeam1, setsTeam2);
      toast.success('Résultat enregistré !');
      await loadDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement du résultat');
    }
  };

  const handleSetRandomScores = async () => {
    if (!tournamentId) return;

    try {
      await teamKingService.setRandomScores(tournamentId);
      toast.success('Scores aléatoires générés !');
      await loadDashboard();
    } catch (error: any) {
      toast.error('Erreur lors de la génération des scores');
    }
  };

  const handleFreezeTournament = async () => {
    if (!tournamentId || !window.confirm('Êtes-vous sûr de vouloir geler le tournoi ? Cette action est irréversible.')) {
      return;
    }

    try {
      await teamKingService.freezeTournament(tournamentId);
      toast.success('Tournoi gelé ! Classement final généré.');
      await loadDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du gel du tournoi');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Chargement...</div>
        </div>
      </AdminLayout>
    );
  }

  // Not initialized yet - show initialization form
  if (!dashboardData) {
    return (
      <AdminLayout>
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Link
              to="/admin/tournaments"
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux tournois
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-3xl font-bold mb-6">🏆 Initialiser le Mode Team King</h1>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-purple-900">
                <strong>Mode Team King :</strong> Les équipes fixes (inscrites par un capitaine)
                s'affrontent dans un format progressif par phases. Chaque phase élimine des équipes
                jusqu'à désigner un champion.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h2 className="text-xl font-semibold">Configuration des phases</h2>
              {phaseConfigs.map((config, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">
                    Phase {config.phaseNumber} - {config.gameMode}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Équipes:</span> {config.totalTeams}
                    </div>
                    <div>
                      <span className="font-medium">Poules:</span> {config.numberOfPools}
                    </div>
                    <div>
                      <span className="font-medium">Qualifiés:</span> {config.totalQualified}
                    </div>
                    <div>
                      <span className="font-medium">Matchs:</span> {config.totalMatches}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold"
            >
              {isInitializing ? 'Initialisation...' : 'Initialiser le Mode Team King'}
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Team King initialized - show dashboard
  const currentPhase = dashboardData.teamKingData.phases.find(
    (p) => p.phaseNumber === selectedPhase
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/admin/tournaments"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux tournois
          </Link>

          <button
            onClick={handleSetRandomScores}
            className="text-sm bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
          >
            🎲 Scores aléatoires (test)
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">🏆 {dashboardData.tournament.name}</h1>
          <p className="text-gray-600">Mode Team King - Tournoi par équipes fixes</p>

          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{dashboardData.registeredTeamsCount} équipes inscrites</span>
            </div>
            {dashboardData.teamKingData.winnerTeam && (
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="font-semibold">
                  Champion: {dashboardData.teamKingData.winnerTeam.teamName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Phase selector */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2">
            {dashboardData.teamKingData.phases.map((phase) => (
              <button
                key={phase.phaseNumber}
                onClick={() => setSelectedPhase(phase.phaseNumber)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  selectedPhase === phase.phaseNumber
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Phase {phase.phaseNumber}
                {phase.status === 'completed' && ' ✓'}
                {phase.status === 'in_progress' && ' ⏳'}
              </button>
            ))}
          </div>
        </div>

        {/* Phase details */}
        {currentPhase && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  Phase {currentPhase.phaseNumber} - {currentPhase.config.gameMode}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    currentPhase.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : currentPhase.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {currentPhase.status === 'completed'
                    ? 'Terminée'
                    : currentPhase.status === 'in_progress'
                    ? 'En cours'
                    : 'Configurée'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Équipes</div>
                  <div className="text-xl font-bold">{currentPhase.config.totalTeams}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Poules</div>
                  <div className="text-xl font-bold">{currentPhase.config.numberOfPools}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Qualifiés</div>
                  <div className="text-xl font-bold">{currentPhase.config.totalQualified}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Matchs</div>
                  <div className="text-xl font-bold">
                    {currentPhase.matches?.filter((m) => m.status === 'completed').length || 0} /{' '}
                    {currentPhase.matches?.length || 0}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {currentPhase.status === 'configured' && (
                  <button
                    onClick={() => handleStartPhase(currentPhase.phaseNumber)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Démarrer la phase
                  </button>
                )}
                {currentPhase.status === 'in_progress' && (
                  <button
                    onClick={() => handleCompletePhase(currentPhase.phaseNumber)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Terminer la phase
                  </button>
                )}
              </div>
            </div>

            {/* Pools and matches */}
            {currentPhase.pools && currentPhase.pools.length > 0 && (
              <div className="space-y-4">
                {currentPhase.pools.map((pool) => (
                  <div key={pool.id} className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-xl font-bold mb-4">{pool.name}</h3>

                    {/* Teams in pool */}
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Équipes</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {pool.teams.map((team) => (
                          <div key={team.id} className="bg-gray-50 p-2 rounded text-sm">
                            {team.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Matches */}
                    <div>
                      <h4 className="font-semibold mb-2">Matchs</h4>
                      <div className="space-y-2">
                        {pool.matches.slice(0, 10).map((match) => (
                          <div
                            key={match.id}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{match.team1.name}</div>
                              <div className="text-sm text-gray-600">vs</div>
                              <div className="font-medium">{match.team2.name}</div>
                            </div>
                            <div className="text-center">
                              {match.status === 'completed' ? (
                                <div className="text-lg font-bold">
                                  {match.setsWonTeam1} - {match.setsWonTeam2}
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      handleRecordResult(currentPhase.phaseNumber, match.id, 2, 0)
                                    }
                                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                  >
                                    2-0
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRecordResult(currentPhase.phaseNumber, match.id, 2, 1)
                                    }
                                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                  >
                                    2-1
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRecordResult(currentPhase.phaseNumber, match.id, 1, 2)
                                    }
                                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                  >
                                    1-2
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRecordResult(currentPhase.phaseNumber, match.id, 0, 2)
                                    }
                                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                  >
                                    0-2
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {pool.matches.length > 10 && (
                          <div className="text-sm text-gray-500 text-center">
                            ... et {pool.matches.length - 10} autres matchs
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Freeze tournament button */}
        {dashboardData.teamKingData.phases.every((p) => p.status === 'completed') &&
          !dashboardData.teamKingData.winnerTeam && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h2 className="text-xl font-bold mb-4">Finaliser le tournoi</h2>
              <p className="text-gray-600 mb-4">
                Toutes les phases sont terminées. Vous pouvez maintenant geler le tournoi pour
                générer le classement final.
              </p>
              <button
                onClick={handleFreezeTournament}
                className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 font-semibold flex items-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                Geler le tournoi et générer le classement final
              </button>
            </div>
          )}
      </div>
    </AdminLayout>
  );
};

export default AdminTeamKingDashboard;
