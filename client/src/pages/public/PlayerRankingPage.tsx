/**
 * Player Ranking Page
 * Displays global player rankings and statistics
 */

import { useEffect, useState } from 'react';
import { Trophy, Medal, TrendingUp, Calendar, Award, Building2, Globe, CalendarRange } from 'lucide-react';
import playerRankingService from '@services/playerRanking.service';
import seasonService from '@services/season.service';
import type { PlayerGlobalRanking } from '@shared/types/playerPoints.types';
import type { Season, SeasonRanking } from '@shared/types/season.types';
import { Link } from 'react-router-dom';

type ViewMode = 'global' | 'season';

const PlayerRankingPage = () => {
  const [rankings, setRankings] = useState<(PlayerGlobalRanking | SeasonRanking)[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('season');

  // Fetch seasons on mount
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const response = await seasonService.getAllSeasons();
        if (response.success && response.data) {
          setSeasons(response.data.seasons);
          // Select active season by default, or first season
          const activeSeason = response.data.seasons.find(s => s.isActive);
          if (activeSeason) {
            setSelectedSeasonId(activeSeason.id);
          } else if (response.data.seasons.length > 0) {
            setSelectedSeasonId(response.data.seasons[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching seasons:', err);
      }
    };

    fetchSeasons();
  }, []);

  // Fetch rankings when view mode or selected season changes
  useEffect(() => {
    const fetchRankings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (viewMode === 'global') {
          const response = await playerRankingService.getGlobalRanking(100, 0);
          if (response.success && response.data) {
            setRankings(response.data.rankings);
            setTotal(response.data.total);
          }
        } else if (selectedSeasonId) {
          const response = await seasonService.getSeasonRanking(selectedSeasonId, 100, 0);
          if (response.success && response.data) {
            setRankings(response.data.rankings);
            setTotal(response.data.total);
          }
        } else {
          setRankings([]);
          setTotal(0);
        }
      } catch (err: any) {
        console.error('Error fetching player rankings:', err);
        setError(err.message || 'Erreur lors du chargement du classement');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRankings();
  }, [viewMode, selectedSeasonId]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-500" size={24} />
          <span className="text-2xl font-bold text-yellow-500">1er</span>
        </div>
      );
    } else if (rank === 2) {
      return (
        <div className="flex items-center gap-2">
          <Medal className="text-gray-400" size={24} />
          <span className="text-xl font-bold text-gray-400">2ème</span>
        </div>
      );
    } else if (rank === 3) {
      return (
        <div className="flex items-center gap-2">
          <Medal className="text-amber-600" size={24} />
          <span className="text-xl font-bold text-amber-600">3ème</span>
        </div>
      );
    }
    return <span className="text-lg font-semibold text-gray-700">{rank}ème</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="text-primary-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-900">Classement des Joueurs</h1>
        </div>
        <p className="text-gray-600">
          {viewMode === 'global'
            ? `Classement global toutes saisons confondues (${total} joueurs)`
            : `Classement de la saison (${total} joueurs)`
          }
        </p>
      </div>

      {/* View Mode & Season Selector */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* View Mode Toggle */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setViewMode('season')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'season'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CalendarRange size={16} />
            Saison
          </button>
          <button
            onClick={() => setViewMode('global')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'global'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Globe size={16} />
            Global
          </button>
        </div>

        {/* Season Selector (only show when in season mode) */}
        {viewMode === 'season' && seasons.length > 0 && (
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name} {season.isActive && '(Active)'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stats Overview - Podium */}
      {rankings.length > 0 && (() => {
        // Get all players with top 3 unique scores
        const uniqueScores = [...new Set(rankings.map(r => r.totalPoints))].sort((a, b) => b - a).slice(0, 3);
        const firstPlaceScore = uniqueScores[0];
        const secondPlaceScore = uniqueScores[1];
        const thirdPlaceScore = uniqueScores[2];

        // Sort players alphabetically
        const firstPlacePlayers = rankings
          .filter(p => p.totalPoints === firstPlaceScore)
          .sort((a, b) => a.pseudo.localeCompare(b.pseudo));
        const secondPlacePlayers = uniqueScores.length > 1
          ? rankings.filter(p => p.totalPoints === secondPlaceScore)
              .sort((a, b) => a.pseudo.localeCompare(b.pseudo))
          : [];
        const thirdPlacePlayers = uniqueScores.length > 2
          ? rankings.filter(p => p.totalPoints === thirdPlaceScore)
              .sort((a, b) => a.pseudo.localeCompare(b.pseudo))
          : [];

        const CompactPlayerCard = ({ player, bgClass }: any) => (
          <div className={`${bgClass} px-3 py-2 rounded-md border`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{player.pseudo}</div>
                {player.clubName && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Building2 size={10} />
                    <span className="truncate">{player.clubName}</span>
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-gray-900">{player.totalPoints} pts</div>
                <div className="text-xs text-gray-600">{player.tournamentsPlayed} 🏆</div>
              </div>
            </div>
          </div>
        );

        return (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Podium
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* First Place */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="text-yellow-500" size={20} />
                  <h3 className="font-semibold text-yellow-600">1ère Place</h3>
                  {firstPlacePlayers.length > 1 && (
                    <span className="text-xs text-gray-500">({firstPlacePlayers.length} ex-aequo)</span>
                  )}
                </div>
                <div className="space-y-2">
                  {firstPlacePlayers.map(player => (
                    <CompactPlayerCard
                      key={player.playerId}
                      player={player}
                      bgClass="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300"
                    />
                  ))}
                </div>
              </div>

              {/* Second Place */}
              {secondPlacePlayers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Medal className="text-gray-400" size={20} />
                    <h3 className="font-semibold text-gray-500">2ème Place</h3>
                    {secondPlacePlayers.length > 1 && (
                      <span className="text-xs text-gray-500">({secondPlacePlayers.length} ex-aequo)</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {secondPlacePlayers.map(player => (
                      <CompactPlayerCard
                        key={player.playerId}
                        player={player}
                        bgClass="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Third Place */}
              {thirdPlacePlayers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Medal className="text-amber-600" size={20} />
                    <h3 className="font-semibold text-amber-700">3ème Place</h3>
                    {thirdPlacePlayers.length > 1 && (
                      <span className="text-xs text-gray-500">({thirdPlacePlayers.length} ex-aequo)</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {thirdPlacePlayers.map(player => (
                      <CompactPlayerCard
                        key={player.playerId}
                        player={player}
                        bgClass="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Rankings Table */}
      {rankings.length === 0 ? (
        <div className="text-center py-12 card">
          <p className="text-gray-500 text-lg">Aucun classement disponible pour le moment.</p>
          <p className="text-gray-400 text-sm mt-2">
            Les points seront attribués après la finalisation des tournois.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joueur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Club
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points Totaux
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tournois
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Moyenne
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meilleur Résultat
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rankings.map((player) => (
                  <tr
                    key={player.playerId}
                    className={`hover:bg-gray-50 transition-colors ${
                      player.rank && player.rank <= 3 ? 'bg-gray-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.rank && getRankBadge(player.rank)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {player.pseudo}
                          </div>
                          {player.bestRankTournament && (
                            <div className="text-xs text-gray-500">
                              {player.bestRankTournament}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.clubName ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Building2 size={14} className="text-gray-400" />
                          <span>{player.clubName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Award className="text-primary-600" size={16} />
                        <span className="text-sm font-bold text-primary-600">
                          {player.totalPoints}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="group relative inline-block">
                        <span className="text-sm text-gray-900 cursor-help border-b border-dotted border-gray-400">
                          {player.tournamentsPlayed}
                        </span>
                        {player.bestRankTournament && (
                          <div className="invisible group-hover:visible absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
                            <div className="font-semibold mb-1">Meilleur résultat:</div>
                            <div>{player.bestRank}{player.bestRank === 1 ? 'er' : 'ème'} - {player.bestRankTournament}</div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-600">
                        {player.averagePoints.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          player.bestRank === 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : player.bestRank === 2
                            ? 'bg-gray-100 text-gray-800'
                            : player.bestRank === 3
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {player.bestRank}
                        {player.bestRank === 1 ? 'er' : 'ème'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Points System Info */}
      <div className="mt-8 card p-6 bg-blue-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Système d'attribution des points
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">1ère place:</span>
            <span className="ml-2 text-yellow-600 font-bold">100 pts</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">2ème place:</span>
            <span className="ml-2 text-gray-600 font-bold">80 pts</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">3ème place:</span>
            <span className="ml-2 text-amber-600 font-bold">65 pts</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">4ème place:</span>
            <span className="ml-2 text-blue-600 font-bold">55 pts</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">5-8ème:</span>
            <span className="ml-2 text-green-600 font-bold">40 pts</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">9-16ème:</span>
            <span className="ml-2 text-indigo-600 font-bold">25 pts</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">17-32ème:</span>
            <span className="ml-2 text-purple-600 font-bold">15 pts</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">32+:</span>
            <span className="ml-2 text-gray-500 font-bold">10 pts</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-4">
          * Tous les membres d'une équipe reçoivent le même nombre de points selon le classement
          final de leur équipe dans le tournoi.
        </p>
      </div>
    </div>
  );
};

export default PlayerRankingPage;
