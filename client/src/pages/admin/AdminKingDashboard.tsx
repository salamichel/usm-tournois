import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import kingService from '@services/king.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Play, RotateCcw, Trophy, Users, Target, Award, TrendingUp } from 'lucide-react';

const AdminKingDashboard = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhaseNumber, setSelectedPhaseNumber] = useState<number | null>(null);

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
        // Auto-select current phase by default
        if (response.data.tournament.currentKingPhase > 0) {
          setSelectedPhaseNumber(response.data.tournament.currentKingPhase);
        }
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

  const { tournament, kingData, allPhases, stats, unassignedPlayers } = data;
  const currentKingPhase = tournament.currentKingPhase || 0;

  // Get the selected phase to display
  const displayPhase = allPhases?.find((p: any) => p.phaseNumber === selectedPhaseNumber);

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

        {/* Unassigned Players Card */}
        {unassignedPlayers && unassignedPlayers.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="text-green-500" size={24} />
              Joueurs Libres Inscrits ({unassignedPlayers.length})
            </h2>
            {currentKingPhase === 0 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  Ces joueurs seront utilisés pour générer les équipes de la Phase 1.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {unassignedPlayers.map((player: any, index: number) => (
                <div key={player.id} className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-900 truncate">{player.pseudo || 'Inconnu'}</p>
                  <p className="text-xs text-gray-500">{player.level || player.niveau || 'N/A'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Players Warning */}
        {currentKingPhase === 0 && (!unassignedPlayers || unassignedPlayers.length === 0) && (
          <div className="card bg-yellow-50 border-yellow-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="text-yellow-500" size={24} />
              Aucun Joueur Inscrit
            </h2>
            <p className="text-yellow-700">
              Aucun joueur libre n'est inscrit à ce tournoi. Les joueurs doivent s'inscrire en mode aléatoire pour participer au Mode King.
            </p>
          </div>
        )}

        {/* Statistics Card */}
        {stats && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={24} />
              Statistiques Globales
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="text-blue-600" size={18} />
                  <p className="text-xs text-blue-600 font-medium">Total Matchs</p>
                </div>
                <p className="text-2xl font-bold text-blue-700">{stats.totalMatches}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="text-green-600" size={18} />
                  <p className="text-xs text-green-600 font-medium">Complétés</p>
                </div>
                <p className="text-2xl font-bold text-green-700">{stats.completedMatches}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="text-orange-600" size={18} />
                  <p className="text-xs text-orange-600 font-medium">En Attente</p>
                </div>
                <p className="text-2xl font-bold text-orange-700">{stats.pendingMatches}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="text-purple-600" size={18} />
                  <p className="text-xs text-purple-600 font-medium">Poules</p>
                </div>
                <p className="text-2xl font-bold text-purple-700">{stats.totalPools}</p>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg border border-pink-200">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="text-pink-600" size={18} />
                  <p className="text-xs text-pink-600 font-medium">Tournées</p>
                </div>
                <p className="text-2xl font-bold text-pink-700">{stats.totalRounds}</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="text-indigo-600" size={18} />
                  <p className="text-xs text-indigo-600 font-medium">Progression</p>
                </div>
                <p className="text-2xl font-bold text-indigo-700">
                  {stats.totalMatches > 0 ? Math.round((stats.completedMatches / stats.totalMatches) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        )}

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

        {/* Phase Selector */}
        {allPhases && allPhases.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Sélectionner une Phase</h2>
            <div className="flex flex-wrap gap-2">
              {allPhases.map((phase: any) => (
                <button
                  key={phase.phaseNumber}
                  onClick={() => setSelectedPhaseNumber(phase.phaseNumber)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPhaseNumber === phase.phaseNumber
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Phase {phase.phaseNumber}
                  {phase.phaseNumber === currentKingPhase && (
                    <span className="ml-2 text-xs bg-white text-primary-600 px-2 py-0.5 rounded-full">
                      En cours
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Phase Details */}
        {displayPhase && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Phase {displayPhase.phaseNumber} - {displayPhase.description}
            </h2>

            {displayPhase.pools && displayPhase.pools.length > 0 ? (
              <div className="space-y-6">
                {displayPhase.pools.map((pool: any) => (
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
                                ({round.matches.filter((m: any) => m.status === 'completed').length}/{round.matches.length} complétés)
                              </span>
                            </h4>

                            <div className="space-y-3">
                              {round.matches.map((match: any) => (
                                <div key={match.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition">
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                    {/* Team 1 */}
                                    <div className="md:col-span-5">
                                      <div className="font-medium text-gray-900 mb-1">{match.team1?.name || 'TBD'}</div>
                                      {match.team1?.members && (
                                        <div className="flex flex-wrap gap-1">
                                          {match.team1.members.map((player: any, idx: number) => (
                                            <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
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
                                          <span className={`text-lg font-bold ${
                                            (match.setsWonTeam1 || 0) > (match.setsWonTeam2 || 0) ? 'text-green-600' : 'text-gray-600'
                                          }`}>
                                            {match.setsWonTeam1 || 0}
                                          </span>
                                          <span className="text-gray-400">-</span>
                                          <span className={`text-lg font-bold ${
                                            (match.setsWonTeam2 || 0) > (match.setsWonTeam1 || 0) ? 'text-green-600' : 'text-gray-600'
                                          }`}>
                                            {match.setsWonTeam2 || 0}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">vs</span>
                                      )}
                                    </div>

                                    {/* Team 2 */}
                                    <div className="md:col-span-5">
                                      <div className="font-medium text-gray-900 mb-1">{match.team2?.name || 'TBD'}</div>
                                      {match.team2?.members && (
                                        <div className="flex flex-wrap gap-1">
                                          {match.team2.members.map((player: any, idx: number) => (
                                            <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
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
                                    {displayPhase.phaseNumber === currentKingPhase && (
                                      <button
                                        onClick={() => handleRecordMatchResult(match.id)}
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
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Aucune poule créée pour cette phase</p>
            )}
          </div>
        )}

        {/* Global Ranking */}
        {kingData && kingData.ranking && kingData.ranking.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Award className="text-yellow-500" />
              Classement Global
              {currentKingPhase === 3 && tournament.isKingPhaseCompleted && (
                <span className="ml-2 text-lg">👑 KING</span>
              )}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Rang</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Joueur</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Victoires</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Défaites</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Sets +</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Sets -</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {kingData.ranking.map((player: any, index: number) => (
                    <tr
                      key={player.playerId || index}
                      className={`${index === 0 ? 'bg-yellow-50 border-2 border-yellow-400' : index < 3 ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-bold">
                        {index === 0 && <span className="text-2xl">👑</span>}
                        {index === 0 && ' '}
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && (index + 1)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {player.playerPseudo || player.pseudo || player.name || `Joueur ${player.playerId}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-bold text-green-600">{player.wins || 0}</td>
                      <td className="px-4 py-3 text-sm text-center text-red-600">{player.losses || 0}</td>
                      <td className="px-4 py-3 text-sm text-center">{player.setsWon || 0}</td>
                      <td className="px-4 py-3 text-sm text-center">{player.setsLost || 0}</td>
                      <td className={`px-4 py-3 text-sm text-center font-bold ${
                        ((player.setsWon || 0) - (player.setsLost || 0)) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {((player.setsWon || 0) - (player.setsLost || 0)) > 0 ? '+' : ''}
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
