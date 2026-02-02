import React from 'react';
import { Edit, Trophy } from 'lucide-react';

interface Match {
  id: string;
  round: string;
  team1Name?: string;
  team2Name?: string;
  team1?: { id?: string; name: string };
  team2?: { id?: string; name: string };
  sets?: Array<{ score1: number | null; score2: number | null }>;
  status: string;
  bracket?: 'main' | 'consolation'; // For double bracket tournaments
}

interface TournamentBracketProps {
  matches: Match[];
  user?: any;
  teams?: any[];
  onEditScore?: (match: Match) => void;
  isRankingFrozen?: boolean;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({
  matches,
  user,
  teams = [],
  onEditScore,
  isRankingFrozen = false
}) => {
  // Check if user is captain in a match
  const isCaptainInMatch = (match: Match): boolean => {
    if (!user || !teams) return false;

    const team1Id = match.team1?.id;
    const team2Id = match.team2?.id;

    const team1 = teams.find(t => t.id === team1Id);
    const team2 = teams.find(t => t.id === team2Id);

    return (team1?.captainId === user.uid) || (team2?.captainId === user.uid);
  };

  // Group matches by round
  const groupedMatches: Record<string, Match[]> = {};

  matches.forEach((match) => {
    if (!groupedMatches[match.round]) {
      groupedMatches[match.round] = [];
    }
    groupedMatches[match.round].push(match);
  });

  // Define round order - including common variations
  const roundOrderMap: Record<string, number> = {
    'Tours Préliminaires': 1,
    'Preliminary Round': 1,
    'Huitièmes de Finale': 2,
    'Huitièmes de finale': 2,
    'Round of 16': 2,
    'Quarts de Finale': 3,
    'Quarts de finale': 3,
    'Quarterfinals': 3,
    'Quarter-finals': 3,
    'Demi-Finales': 4,
    'Demi-finales': 4,
    'Semifinals': 4,
    'Semi-finals': 4,
    'Petite Finale': 5,
    'Petite finale': 5,
    'Third Place': 5,
    'Finale': 6,
    'Final': 6,
  };

  // Get all existing rounds and sort them
  const existingRounds = Object.keys(groupedMatches).sort((a, b) => {
    const orderA = roundOrderMap[a] || 999;
    const orderB = roundOrderMap[b] || 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // If not in map, sort alphabetically
    return a.localeCompare(b);
  });

  // Calculate winner from sets
  const getWinner = (match: Match): string | null => {
    if (!match.sets || match.sets.length === 0 || match.status !== 'completed') {
      return null;
    }

    let team1Wins = 0;
    let team2Wins = 0;

    match.sets.forEach((set) => {
      if (set.score1 !== null && set.score2 !== null) {
        if (set.score1 > set.score2) {
          team1Wins++;
        } else if (set.score2 > set.score1) {
          team2Wins++;
        }
      }
    });

    if (team1Wins > team2Wins) {
      return match.team1Name || match.team1?.name || 'Équipe 1';
    } else if (team2Wins > team1Wins) {
      return match.team2Name || match.team2?.name || 'Équipe 2';
    }

    return null;
  };

  // Format score
  const formatScore = (match: Match): string => {
    if (!match.sets || match.sets.length === 0) return '';

    return match.sets
      .filter((set) => set.score1 !== null && set.score2 !== null)
      .map((set) => `${set.score1}-${set.score2}`)
      .join(', ');
  };

  const renderMatch = (match: Match) => {
    const team1 = match.team1Name || match.team1?.name || 'TBD';
    const team2 = match.team2Name || match.team2?.name || 'TBD';
    const winner = getWinner(match);
    const score = formatScore(match);
    const canEditScore = onEditScore && user && isCaptainInMatch(match) && !isRankingFrozen;

    return (
      <div
        key={match.id}
        className="bg-white border-2 border-gray-200 rounded-lg p-3 mb-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between p-2 rounded ${
              winner === team1 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
            }`}
          >
            <span className={`font-medium ${winner === team1 ? 'text-green-700' : 'text-gray-900'}`}>
              {team1}
            </span>
            {winner === team1 && <span className="text-green-600 text-xl">✓</span>}
          </div>
          <div
            className={`flex items-center justify-between p-2 rounded ${
              winner === team2 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
            }`}
          >
            <span className={`font-medium ${winner === team2 ? 'text-green-700' : 'text-gray-900'}`}>
              {team2}
            </span>
            {winner === team2 && <span className="text-green-600 text-xl">✓</span>}
          </div>
        </div>
        {score && (
          <div className="text-center mt-2 pt-2 border-t border-gray-200">
            <span className="text-sm font-bold text-gray-700">{score}</span>
          </div>
        )}
        {match.status === 'in_progress' && (
          <div className="text-center mt-2">
            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
              En cours
            </span>
          </div>
        )}
        {canEditScore && (
          <div className="text-center mt-2">
            <button
              onClick={() => onEditScore(match)}
              className="text-xs px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors inline-flex items-center gap-1"
            >
              <Edit size={12} />
              Saisir
            </button>
          </div>
        )}
      </div>
    );
  };

  if (existingRounds.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Aucune phase d'élimination configurée pour ce tournoi.
      </div>
    );
  }

  // Detect double bracket mode
  const isDoubleBracket = matches.some(m => m.bracket === 'main' || m.bracket === 'consolation');

  if (isDoubleBracket) {
    // Split matches by bracket type
    const mainMatches = matches.filter(m => m.bracket === 'main');
    const consolationMatches = matches.filter(m => m.bracket === 'consolation');

    // Group matches by round for each bracket
    const groupMatchesByRound = (bracketMatches: Match[]) => {
      const grouped: Record<string, Match[]> = {};
      bracketMatches.forEach((match) => {
        if (!grouped[match.round]) {
          grouped[match.round] = [];
        }
        grouped[match.round].push(match);
      });
      return grouped;
    };

    const mainGrouped = groupMatchesByRound(mainMatches);
    const consolationGrouped = groupMatchesByRound(consolationMatches);

    const getExistingRounds = (grouped: Record<string, Match[]>) => {
      return Object.keys(grouped).sort((a, b) => {
        const orderA = roundOrderMap[a] || 999;
        const orderB = roundOrderMap[b] || 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
      });
    };

    const mainRounds = getExistingRounds(mainGrouped);
    const consolationRounds = getExistingRounds(consolationGrouped);

    const renderBracket = (
      grouped: Record<string, Match[]>,
      rounds: string[],
      title: string,
      colorClass: string,
      bgClass: string
    ) => (
      <div className={`flex-1 ${bgClass} rounded-lg p-4`}>
        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${colorClass}`}>
          <Trophy size={20} />
          {title}
        </h3>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {[...rounds].reverse().map((round) => (
              <div key={round} className="flex-shrink-0" style={{ minWidth: '240px' }}>
                <h4 className={`text-sm font-bold text-center mb-3 px-3 py-1.5 ${colorClass === 'text-blue-800' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'} rounded-lg`}>
                  {round}
                </h4>
                <div className="space-y-2">
                  {grouped[round].map((match) => renderMatch(match))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderBracket(mainGrouped, mainRounds, 'Tableau Principal', 'text-blue-800', 'bg-blue-50')}
          {renderBracket(consolationGrouped, consolationRounds, 'Tableau Consolante', 'text-orange-800', 'bg-orange-50')}
        </div>
        <div className="text-center text-sm text-gray-500">
          <p>Le classement final combine les deux tableaux : places 1-{mainMatches.length > 0 ? Math.ceil(new Set(mainMatches.map(m => m.team1?.id).concat(mainMatches.map(m => m.team2?.id))).size / 2) : '?'} (principal) puis suivantes (consolante)</p>
        </div>
      </div>
    );
  }

  // Single bracket mode (original)
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {[...existingRounds].reverse().map((round) => (
          <div key={round} className="flex-shrink-0" style={{ minWidth: '280px' }}>
            <h3 className="text-lg font-bold text-center mb-4 px-4 py-2 bg-primary-100 text-primary-800 rounded-lg">
              {round}
            </h3>
            <div className="space-y-3">
              {groupedMatches[round].map((match) => renderMatch(match))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentBracket;
