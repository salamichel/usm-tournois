import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import kingService from '@services/king.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Play, RotateCcw, Trophy } from 'lucide-react';

const AdminKingDashboard = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      loadDashboard();
    }
  }, [tournamentId]);

  const loadDashboard = async () => {
    if (!tournamentId) return;

    setIsLoading(true);
    try {
      const response = await kingService.getKingDashboard(tournamentId);
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement du dashboard King');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPhase1 = async () => {
    if (!tournamentId) return;

    try {
      const response = await kingService.startPhase1(tournamentId);
      if (response.success) {
        toast.success('Phase 1 démarrée !');
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du démarrage de la Phase 1');
    }
  };

  const handleStartPhase2 = async () => {
    if (!tournamentId) return;

    try {
      const response = await kingService.startPhase2(tournamentId);
      if (response.success) {
        toast.success('Phase 2 démarrée !');
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du démarrage de la Phase 2');
    }
  };

  const handleStartPhase3 = async () => {
    if (!tournamentId) return;

    try {
      const response = await kingService.startPhase3(tournamentId);
      if (response.success) {
        toast.success('Phase 3 (Finale) démarrée !');
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du démarrage de la Phase 3');
    }
  };

  const handleRecordMatchResult = async (matchId: string) => {
    if (!tournamentId) return;

    const setsWonTeam1 = prompt('Sets gagnés Équipe 1:');
    const setsWonTeam2 = prompt('Sets gagnés Équipe 2:');

    if (setsWonTeam1 === null || setsWonTeam2 === null) return;

    try {
      const response = await kingService.recordMatchResult(
        tournamentId,
        matchId,
        parseInt(setsWonTeam1),
        parseInt(setsWonTeam2)
      );

      if (response.success) {
        toast.success('Résultat enregistré !');
        loadDashboard();
      } else {
        toast.error(response.message || 'Erreur');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleResetPhase = async (phaseNumber: number) => {
    if (!tournamentId) return;
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser la Phase ${phaseNumber} ?`)) return;

    try {
      let response;
      if (phaseNumber === 1) {
        response = await kingService.resetPhase1(tournamentId);
      } else if (phaseNumber === 2) {
        response = await kingService.resetPhase2(tournamentId);
      } else {
        response = await kingService.resetPhase3(tournamentId);
      }

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

  const handleSetRandomScores = async () => {
    if (!tournamentId) return;
    if (!confirm('Voulez-vous définir des scores aléatoires pour tous les matchs non complétés de la phase actuelle ?')) return;

    try {
      const response = await kingService.setAllMatchesScores(tournamentId);
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

  if (!data) {
    return (
      <AdminLayout>
        <div>
          <p className="text-red-600">Erreur : Impossible de charger le dashboard King</p>
        </div>
      </AdminLayout>
    );
  }

  const { tournament, kingData, currentPhase } = data;
  const currentKingPhase = tournament.currentKingPhase || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mode King</h1>
            <p className="text-gray-600 mt-1">{tournament.name}</p>
          </div>
        </div>

        {/* Status Card */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Statut du Tournoi King</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Phase Actuelle</p>
              <p className="text-2xl font-bold text-primary-600">
                Phase {currentKingPhase === 0 ? 'Non démarrée' : currentKingPhase}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Statut</p>
              <p className="text-lg font-medium">
                {tournament.isKingPhaseCompleted ? (
                  <span className="badge badge-success">Complétée</span>
                ) : (
                  <span className="badge badge-warning">En cours</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Format</p>
              <p className="text-lg font-medium">4v4 → 3v3 → 2v2</p>
            </div>
          </div>
        </div>

        {/* Phase Controls */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Gestion des Phases</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <button
                onClick={handleStartPhase1}
                disabled={currentKingPhase !== 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Play size={18} />
                Démarrer Phase 1 (4v4)
              </button>
              {currentKingPhase >= 1 && (
                <button
                  onClick={() => handleResetPhase(1)}
                  className="btn-secondary text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} />
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleStartPhase2}
                disabled={currentKingPhase !== 1 || !tournament.isKingPhaseCompleted}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Play size={18} />
                Démarrer Phase 2 (3v3)
              </button>
              {currentKingPhase >= 2 && (
                <button
                  onClick={() => handleResetPhase(2)}
                  className="btn-secondary text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} />
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleStartPhase3}
                disabled={currentKingPhase !== 2 || !tournament.isKingPhaseCompleted}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Play size={18} />
                Démarrer Phase 3 (Finale 2v2)
              </button>
              {currentKingPhase >= 3 && (
                <button
                  onClick={() => handleResetPhase(3)}
                  className="btn-secondary text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} />
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          {/* Random Scores Button */}
          {currentKingPhase >= 1 && (
            <div className="mt-4">
              <button
                onClick={handleSetRandomScores}
                className="btn-secondary w-full md:w-auto flex items-center justify-center gap-2"
              >
                🎲 Scores Aléatoires (Test)
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Définir des scores aléatoires pour tous les matchs non complétés de la phase actuelle
              </p>
            </div>
          )}
        </div>

        {/* Current Phase Details */}
        {currentPhase && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Phase {currentPhase.phaseNumber} - {currentPhase.description}
            </h2>

            {currentPhase.pools && currentPhase.pools.length > 0 ? (
              <div className="space-y-6">
                {currentPhase.pools.map((pool: any) => (
                  <div key={pool.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-bold mb-4 text-primary-600">{pool.name}</h3>

                    {/* Players in Pool */}
                    {pool.players && pool.players.length > 0 && (
                      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">👥 Joueurs de la Poule ({pool.players.length})</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {pool.players.map((player: any, index: number) => (
                            <div key={player.id || index} className="bg-gray-50 p-2 rounded border-l-2 border-primary-500">
                              <p className="text-xs text-gray-700 truncate">{index + 1}. {player.pseudo || player.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pool.matches && pool.matches.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-white border-b">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Match</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Équipe 1</th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Score</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Équipe 2</th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Statut</th>
                              <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {pool.matches.map((match: any) => (
                              <tr key={match.id} className="hover:bg-white">
                                <td className="px-4 py-3 text-sm text-gray-600">{match.roundName || match.roundId}</td>
                                <td className="px-4 py-3 text-sm font-medium">{match.team1?.name || 'TBD'}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold">
                                  {match.status === 'completed' ? (
                                    <span className="text-primary-600">
                                      {match.setsWonTeam1 || 0} - {match.setsWonTeam2 || 0}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">- -</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium">{match.team2?.name || 'TBD'}</td>
                                <td className="px-4 py-3 text-center">
                                  {match.status === 'completed' ? (
                                    <span className="badge badge-success text-xs">Terminé</span>
                                  ) : (
                                    <span className="badge badge-warning text-xs">En attente</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleRecordMatchResult(match.id)}
                                    className="btn-primary text-xs"
                                  >
                                    {match.status === 'completed' ? 'Modifier' : 'Enregistrer'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">Aucun match dans cette poule</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Aucune poule créée pour cette phase</p>
            )}
          </div>
        )}

        {/* Global Ranking */}
        {kingData && kingData.ranking && kingData.ranking.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Classement Global</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Rang</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Joueur</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Victoires</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Sets +</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Sets -</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {kingData.ranking.slice(0, 10).map((player: any, index: number) => (
                    <tr key={index} className={index < 3 ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-3 text-sm font-bold">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{player.pseudo || player.name}</td>
                      <td className="px-4 py-3 text-sm text-center">{player.wins || 0}</td>
                      <td className="px-4 py-3 text-sm text-center">{player.setsWon || 0}</td>
                      <td className="px-4 py-3 text-sm text-center">{player.setsLost || 0}</td>
                      <td className={`px-4 py-3 text-sm text-center font-bold ${
                        (player.setsWon - player.setsLost) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(player.setsWon || 0) - (player.setsLost || 0) > 0 ? '+' : ''}
                        {(player.setsWon || 0) - (player.setsLost || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminKingDashboard;
