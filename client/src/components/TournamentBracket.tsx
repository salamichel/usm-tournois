import React from 'react';

interface Match {
  id: string;
  round: string;
  team1Name?: string;
  team2Name?: string;
  team1?: { name: string };
  team2?: { name: string };
  sets?: Array<{ score1: number | null; score2: number | null }>;
  status: string;
}

interface TournamentBracketProps {
  matches: Match[];
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({ matches }) => {
  // Group matches by round
  const groupedMatches: Record<string, Match[]> = {};

  matches.forEach((match) => {
    if (!groupedMatches[match.round]) {
      groupedMatches[match.round] = [];
    }
    groupedMatches[match.round].push(match);
  });

  // Define round order
  const roundOrder = [
    'Tours Préliminaires',
    'Huitièmes de Finale',
    'Quarts de Finale',
    'Demi-Finales',
    'Petite Finale',
    'Finale',
  ];

  // Filter rounds that exist in the matches
  const existingRounds = roundOrder.filter((round) => groupedMatches[round]);

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

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {existingRounds.map((round) => (
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
