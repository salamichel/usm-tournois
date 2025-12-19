import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import tournamentService from '@services/tournament.service';
import matchService from '@services/match.service';
import type { TournamentDetails, Team } from '@shared/types';
import toast from 'react-hot-toast';
import MatchScoreModal from '@components/admin/MatchScoreModal';
import {
  ArrowLeft,
  Trophy,
  Edit,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface MatchWithContext {
  match: any;
  type: 'pool' | 'elimination';
  poolId?: string;
  poolName?: string;
  roundName?: string;
}

const MyMatchesPage = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [myMatches, setMyMatches] = useState<MatchWithContext[]>([]);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithContext | null>(null);

  const fetchTournament = useCallback(async () => {
    if (!tournamentId) return;
    try {
      setIsLoading(true);
      const response = await tournamentService.getTournamentById(tournamentId);
      if (response.success && response.data) {
        const tournamentData: any = {
          ...response.data.tournament,
          teams: response.data.teams || [],
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
  }, [tournamentId]);

  useEffect(() => {
    if (tournamentId) {
      fetchTournament();
    }
  }, [tournamentId, fetchTournament]);

  // Find user's team and their matches
  useEffect(() => {
    if (!tournament || !user) return;

    // Find user's team
    const team = tournament.teams?.find((t) =>
      t.members?.some((m) => m.userId === user.uid)
    ) || null;
    setUserTeam(team);

    if (!team) {
      setMyMatches([]);
      return;
    }

    const matches: MatchWithContext[] = [];

    // Get pool matches
    tournament.pools?.forEach((pool: any) => {
      pool.matches?.forEach((match: any) => {
        const team1Id = match.team1?.id || match.team1Id;
        const team2Id = match.team2?.id || match.team2Id;
        if (team1Id === team.id || team2Id === team.id) {
          matches.push({
            match,
            type: 'pool',
            poolId: pool.id,
            poolName: pool.name,
          });
        }
      });
    });

    // Get elimination matches
    tournament.eliminationMatches?.forEach((match: any) => {
      const team1Id = match.team1?.id || match.team1Id;
      const team2Id = match.team2?.id || match.team2Id;
      if (team1Id === team.id || team2Id === team.id) {
        matches.push({
          match,
          type: 'elimination',
          roundName: getRoundName(match.round),
        });
      }
    });

    setMyMatches(matches);
  }, [tournament, user]);

  const getRoundName = (round: number): string => {
    const roundNames: { [key: number]: string } = {
      1: 'Finale',
      2: 'Demi-finale',
      4: 'Quart de finale',
      8: 'Huitième de finale',
      16: 'Seizième de finale',
    };
    return roundNames[round] || `Tour ${round}`;
  };

  const isRankingFrozen = (): boolean => {
    return !!(tournament?.finalRanking && tournament.finalRanking.length > 0);
  };

  const isCaptain = (): boolean => {
    return userTeam?.captainId === user?.uid;
  };

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

  const formatSetsScore = (match: any): string => {
    if (!match.sets || match.sets.length === 0) return '-';

    return match.sets
      .filter((set: any) => set.score1 !== null && set.score2 !== null)
      .map((set: any) => `${set.score1}-${set.score2}`)
      .join(', ');
  };

  const handleOpenScoreModal = (matchWithContext: MatchWithContext) => {
    if (isRankingFrozen()) {
      toast.error('Le classement est figé. Vous ne pouvez plus modifier les scores.');
      return;
    }
    setSelectedMatch(matchWithContext);
    setShowScoreModal(true);
  };

  const handleSubmitScores = async (sets: any[]) => {
    if (!tournamentId || !selectedMatch) return;

    try {
      const response = await matchService.submitScores(tournamentId, selectedMatch.match.id, {
        sets,
        matchType: selectedMatch.type,
        poolId: selectedMatch.poolId,
      });

      if (response.success) {
        toast.success('Scores enregistrés avec succès !');
        setShowScoreModal(false);
        setSelectedMatch(null);
        fetchTournament();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message || 'Erreur lors de l\'enregistrement des scores'
      );
      throw error;
    }
  };

  // Separate matches by status
  const pendingMatches = myMatches.filter((m) => m.match.status !== 'completed');
  const completedMatches = myMatches.filter((m) => m.match.status === 'completed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500 text-center">Tournoi introuvable</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card text-center">
          <AlertCircle className="mx-auto text-yellow-500 mb-4" size={48} />
          <p className="text-gray-600 mb-4">Vous devez être connecté pour voir vos matchs.</p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  if (!userTeam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(`/tournoi/${tournamentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} />
          <span>Retour au tournoi</span>
        </button>
        <div className="card text-center">
          <AlertCircle className="mx-auto text-yellow-500 mb-4" size={48} />
          <p className="text-gray-600">Vous n'êtes pas inscrit dans une équipe pour ce tournoi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <button
        onClick={() => navigate(`/tournoi/${tournamentId}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Retour au tournoi</span>
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes matchs</h1>
        <div className="flex items-center gap-3">
          <span className="text-gray-600">{tournament.name}</span>
          <span className="text-gray-400">•</span>
          <span className="font-semibold text-primary-600">{userTeam.name}</span>
        </div>
      </div>

      {isRankingFrozen() && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-blue-800 text-sm">
            Le classement est figé. Les scores ne peuvent plus être modifiés.
          </p>
        </div>
      )}

      {myMatches.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500">Aucun match programmé pour votre équipe.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Matches */}
          {pendingMatches.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="text-yellow-500" size={24} />
                Matchs à jouer ({pendingMatches.length})
              </h2>
              <div className="space-y-4">
                {pendingMatches.map((matchCtx, idx) => {
                  const { match, type, poolName, roundName } = matchCtx;
                  const team1Name = match.team1Name || match.team1?.name || 'TBD';
                  const team2Name = match.team2Name || match.team2?.name || 'TBD';
                  const isMyTeam1 = (match.team1?.id || match.team1Id) === userTeam.id;
                  const canEdit = isCaptain() && !isRankingFrozen();

                  return (
                    <div
                      key={`${type}-${match.id}-${idx}`}
                      className="card border-l-4 border-l-yellow-400"
                    >
                      {/* Match type badge */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {type === 'pool' ? `Poule ${poolName}` : roundName}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {match.status === 'in_progress' ? 'En cours' : 'À venir'}
                        </span>
                      </div>

                      {/* Teams */}
                      <div className="flex flex-col gap-3 mb-4">
                        <div className={`flex justify-between items-center p-3 rounded-lg ${isMyTeam1 ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'}`}>
                          <span className={`font-medium ${isMyTeam1 ? 'text-primary-700' : 'text-gray-700'}`}>
                            {team1Name}
                            {isMyTeam1 && <span className="ml-2 text-xs">(vous)</span>}
                          </span>
                        </div>
                        <div className="text-center text-gray-400 text-sm font-medium">VS</div>
                        <div className={`flex justify-between items-center p-3 rounded-lg ${!isMyTeam1 ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'}`}>
                          <span className={`font-medium ${!isMyTeam1 ? 'text-primary-700' : 'text-gray-700'}`}>
                            {team2Name}
                            {!isMyTeam1 && <span className="ml-2 text-xs">(vous)</span>}
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      {canEdit && (
                        <button
                          onClick={() => handleOpenScoreModal(matchCtx)}
                          className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                          <Edit size={18} />
                          Saisir le score
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Completed Matches */}
          {completedMatches.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-500" size={24} />
                Matchs terminés ({completedMatches.length})
              </h2>
              <div className="space-y-4">
                {completedMatches.map((matchCtx, idx) => {
                  const { match, type, poolName, roundName } = matchCtx;
                  const { winner, team1Wins, team2Wins } = getMatchWinner(match);
                  const team1Name = match.team1Name || match.team1?.name || 'TBD';
                  const team2Name = match.team2Name || match.team2?.name || 'TBD';
                  const isTeam1Winner = winner === team1Name;
                  const isTeam2Winner = winner === team2Name;
                  const didWeWin = (isTeam1Winner && (match.team1?.id || match.team1Id) === userTeam.id) ||
                                   (isTeam2Winner && (match.team2?.id || match.team2Id) === userTeam.id);
                  const canEdit = isCaptain() && !isRankingFrozen();

                  return (
                    <div
                      key={`${type}-${match.id}-${idx}`}
                      className={`card border-l-4 ${didWeWin ? 'border-l-green-500' : 'border-l-red-400'}`}
                    >
                      {/* Match type badge */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {type === 'pool' ? `Poule ${poolName}` : roundName}
                        </span>
                        <div className="flex items-center gap-2">
                          {didWeWin ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Victoire
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              Défaite
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Teams with scores */}
                      <div className="flex flex-col gap-2 mb-3">
                        <div className={`flex justify-between items-center p-3 rounded-lg ${isTeam1Winner ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <span className={`flex items-center gap-2 font-medium ${isTeam1Winner ? 'text-green-700' : 'text-gray-600'}`}>
                            {isTeam1Winner && <Trophy size={16} className="text-green-500" />}
                            {team1Name}
                          </span>
                          <span className={`font-bold text-xl ${isTeam1Winner ? 'text-green-600' : 'text-gray-500'}`}>
                            {team1Wins}
                          </span>
                        </div>
                        <div className={`flex justify-between items-center p-3 rounded-lg ${isTeam2Winner ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <span className={`flex items-center gap-2 font-medium ${isTeam2Winner ? 'text-green-700' : 'text-gray-600'}`}>
                            {isTeam2Winner && <Trophy size={16} className="text-green-500" />}
                            {team2Name}
                          </span>
                          <span className={`font-bold text-xl ${isTeam2Winner ? 'text-green-600' : 'text-gray-500'}`}>
                            {team2Wins}
                          </span>
                        </div>
                      </div>

                      {/* Score details */}
                      <div className="text-center text-sm text-gray-500 mb-3">
                        {formatSetsScore(match)}
                      </div>

                      {/* Edit button for captain */}
                      {canEdit && (
                        <button
                          onClick={() => handleOpenScoreModal(matchCtx)}
                          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                        >
                          <Edit size={16} />
                          Modifier le score
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Match Score Modal */}
      {selectedMatch && (
        <MatchScoreModal
          isOpen={showScoreModal}
          onClose={() => {
            setShowScoreModal(false);
            setSelectedMatch(null);
          }}
          onSave={handleSubmitScores}
          match={selectedMatch.match}
          setsToWin={
            selectedMatch.type === 'pool'
              ? tournament?.setsPerMatchPool || 1
              : tournament?.setsPerMatchElimination || 3
          }
          pointsPerSet={
            selectedMatch.type === 'pool'
              ? tournament?.pointsPerSetPool || 21
              : tournament?.pointsPerSetElimination || 21
          }
        />
      )}
    </div>
  );
};

export default MyMatchesPage;
