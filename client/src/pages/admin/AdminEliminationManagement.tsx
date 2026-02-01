import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import MatchScoreModal from '@components/admin/MatchScoreModal';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Trophy, Edit2, Lock, Users, X } from 'lucide-react';

const AdminEliminationManagement = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [finalRanking, setFinalRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam1, setSelectedTeam1] = useState<any>(null);
  const [selectedTeam2, setSelectedTeam2] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, matchesRes, teamsRes]: any[] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getEliminationMatches(tournamentId!),
        adminService.getTeams(tournamentId!),
      ]);

      setTournament(tournamentRes.tournament || tournamentRes.data?.tournament);
      setMatches(matchesRes.matches || matchesRes.data?.matches || []);
      setFinalRanking(matchesRes.finalRanking || matchesRes.data?.finalRanking || []);
      setTeams(teamsRes.teams || teamsRes.data?.teams || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMatchScore = (match: any) => {
    setSelectedMatch(match);
    setScoreModalOpen(true);
  };

  const handleEditMatchTeams = (match: any) => {
    setSelectedMatch(match);
    setSelectedTeam1(match.team1?.id ? { id: match.team1.id, name: match.team1.name } : null);
    setSelectedTeam2(match.team2?.id ? { id: match.team2.id, name: match.team2.name } : null);
    setTeamsModalOpen(true);
  };

  const handleSaveMatchTeams = async () => {
    if (!selectedMatch) return;

    try {
      const team1 = selectedTeam1 ? { id: selectedTeam1.id, name: selectedTeam1.name } : undefined;
      const team2 = selectedTeam2 ? { id: selectedTeam2.id, name: selectedTeam2.name } : undefined;

      if (!team1 && !team2) {
        toast.error('Veuillez sélectionner au moins une équipe');
        return;
      }

      await adminService.updateEliminationMatchTeams(tournamentId!, selectedMatch.id, team1, team2);
      toast.success('Équipes mises à jour avec succès');
      setTeamsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour des équipes');
    }
  };

  const handleSaveMatchScore = async (sets: any[]) => {
    try {
      await adminService.updateEliminationMatchScore(tournamentId!, selectedMatch.id, sets);
      toast.success('Score mis à jour avec succès. Les résultats ont été propagés au bracket.');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du score');
      throw error;
    }
  };

  const handleFreezeRanking = async () => {
    if (!tournamentId) return;
    if (!confirm('Êtes-vous sûr de vouloir figer le classement et attribuer les points ? Vous pouvez relancer cette action si nécessaire.')) return;

    try {
      const response = await adminService.freezeEliminationRanking(tournamentId);
      if (response.success) {
        toast.success(response.message || 'Classement figé avec succès !');
        loadData();
      } else {
        toast.error(response.message || 'Erreur lors du gel du classement');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Erreur lors du gel du classement');
    }
  };

  // Check if finale is completed
  const isFinaleCompleted = matches.some(m => m.round === 'Finale' && m.status === 'completed');
  const isTournamentFrozen = tournament?.isFrozen || tournament?.status === 'frozen';

  // Detect double bracket mode
  const isDoubleBracket = matches.some(m => m.bracket === 'main' || m.bracket === 'consolation');
  const mainBracketMatches = isDoubleBracket ? matches.filter(m => m.bracket === 'main') : matches;
  const consolationMatches = isDoubleBracket ? matches.filter(m => m.bracket === 'consolation') : [];

  // For double bracket, check if BOTH finales are completed
  const isMainFinaleCompleted = mainBracketMatches.some(m => m.round === 'Finale' && m.status === 'completed');
  const isConsolationFinaleCompleted = consolationMatches.some(m => m.round === 'Finale' && m.status === 'completed');
  const areBothFinalesCompleted = isDoubleBracket
    ? isMainFinaleCompleted && isConsolationFinaleCompleted
    : isFinaleCompleted;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Chargement...</div>
        </div>
      </AdminLayout>
    );
  }

  // Group matches by round - left to right order (preliminary to final)
  const roundOrder = [
    { key: 'Tour Préliminaire', label: 'Tour Préliminaire' },
    { key: 'Seizième de finale', label: '1/16 de finale' },
    { key: 'Huitième de finale', label: '1/8 de finale' },
    { key: 'Quart de finale', label: '1/4 de finale' },
    { key: 'Demi-finale', label: '1/2 finale' },
    { key: 'Match 3ème place', label: 'Petite finale' },
    { key: 'Finale', label: 'Finale' },
  ];

  // Match Card Component
  const MatchCard = ({
    match,
    onEditTeams,
    onEditScore,
  }: {
    match: any;
    onEditTeams: (match: any) => void;
    onEditScore: (match: any) => void;
  }) => (
    <div className="border-2 border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors bg-white">
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-gray-700">
          Match {match.matchNumber || ''}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${
          match.status === 'completed' ? 'bg-green-100 text-green-800' :
          match.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {match.status === 'completed' ? 'Terminé' :
           match.status === 'in_progress' ? 'En cours' : 'À venir'}
        </span>
      </div>

      {/* Teams and scores */}
      <div className="space-y-2 mb-3">
        <div className={`p-3 rounded ${
          match.winnerId === match.team1?.id ? 'bg-green-50 border-2 border-green-300' : 'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex justify-between items-center">
            <span className={`flex-1 ${match.winnerId === match.team1?.id ? 'font-bold' : ''}`}>
              {match.team1?.name || 'À déterminer'}
            </span>
            {match.sets && match.sets.length > 0 && (
              <div className="flex gap-2">
                {match.sets.map((set: any, idx: number) => (
                  <span key={idx} className="text-sm min-w-[24px] text-center">
                    {set.score1 ?? '-'}
                  </span>
                ))}
              </div>
            )}
          </div>
          {match.team1?.members && match.team1.members.length > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              {match.team1.members.map((m: any) => m.pseudo || m.name).join(' / ')}
            </div>
          )}
        </div>
        <div className={`p-3 rounded ${
          match.winnerId === match.team2?.id ? 'bg-green-50 border-2 border-green-300' : 'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex justify-between items-center">
            <span className={`flex-1 ${match.winnerId === match.team2?.id ? 'font-bold' : ''}`}>
              {match.team2?.name || 'À déterminer'}
            </span>
            {match.sets && match.sets.length > 0 && (
              <div className="flex gap-2">
                {match.sets.map((set: any, idx: number) => (
                  <span key={idx} className="text-sm min-w-[24px] text-center">
                    {set.score2 ?? '-'}
                  </span>
                ))}
              </div>
            )}
          </div>
          {match.team2?.members && match.team2.members.length > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              {match.team2.members.map((m: any) => m.pseudo || m.name).join(' / ')}
            </div>
          )}
        </div>
      </div>

      {/* Edit buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onEditTeams(match)}
          className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 px-3 py-1 rounded hover:bg-purple-50 transition-colors"
        >
          <Users size={14} />
          Équipes
        </button>
        <button
          onClick={() => onEditScore(match)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          <Edit2 size={14} />
          Scores
        </button>
      </div>

      {/* Winner info */}
      {match.winnerId && match.winnerName && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-green-700 font-medium">
            Vainqueur: {match.winnerName}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/admin/tournaments/${tournamentId}/pools`} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy size={28} />
              Phase d'Élimination - {tournament?.name}
            </h1>
          </div>
          {matches.length > 0 && (
            <button
              onClick={handleFreezeRanking}
              disabled={!areBothFinalesCompleted}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                areBothFinalesCompleted
                  ? isTournamentFrozen
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={!areBothFinalesCompleted ? (isDoubleBracket ? 'Les deux finales doivent être terminées' : 'La finale doit être terminée pour figer le classement') : isTournamentFrozen ? 'Relancer le calcul des points' : 'Figer le classement final'}
            >
              <Lock size={18} />
              {isTournamentFrozen ? 'Recalculer les points' : 'Figer le classement'}
            </button>
          )}
        </div>

        {matches.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">Aucun match d'élimination généré</p>
            <Link
              to={`/admin/tournaments/${tournamentId}/pools`}
              className="btn-primary inline-block"
            >
              Retour aux Poules
            </Link>
          </div>
        ) : isDoubleBracket ? (
          /* Double Bracket Layout - Side by Side */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Main Bracket */}
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg shadow-md p-4">
              <h2 className="text-2xl font-bold mb-4 text-blue-800 flex items-center gap-2">
                <Trophy size={24} />
                Tableau Principal
              </h2>
              <div className="space-y-4">
                {roundOrder.map(({ key, label }) => {
                  const roundMatches = mainBracketMatches.filter(m => m.round === key);
                  if (roundMatches.length === 0) return null;

                  return (
                    <div key={`main-${key}`} className="bg-white rounded-lg p-4 border border-blue-200">
                      <h3 className="text-lg font-bold mb-3 text-blue-700">{label}</h3>
                      <div className="space-y-3">
                        {roundMatches.map((match) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                            onEditTeams={handleEditMatchTeams}
                            onEditScore={handleEditMatchScore}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Consolation Bracket */}
            <div className="bg-gradient-to-br from-orange-50 to-white rounded-lg shadow-md p-4">
              <h2 className="text-2xl font-bold mb-4 text-orange-800 flex items-center gap-2">
                <Trophy size={24} />
                Tableau Consolante
              </h2>
              <div className="space-y-4">
                {roundOrder.map(({ key, label }) => {
                  const roundMatches = consolationMatches.filter(m => m.round === key);
                  if (roundMatches.length === 0) return null;

                  return (
                    <div key={`consolation-${key}`} className="bg-white rounded-lg p-4 border border-orange-200">
                      <h3 className="text-lg font-bold mb-3 text-orange-700">{label}</h3>
                      <div className="space-y-3">
                        {roundMatches.map((match) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                            onEditTeams={handleEditMatchTeams}
                            onEditScore={handleEditMatchScore}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Single Bracket Layout */
          <div className="space-y-6">
            {roundOrder.map(({ key, label }) => {
              const roundMatches = matches.filter(m => m.round === key);
              if (roundMatches.length === 0) return null;

              return (
                <div key={key} className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-bold mb-4">{label}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roundMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        onEditTeams={handleEditMatchTeams}
                        onEditScore={handleEditMatchScore}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Final Ranking Section */}
        {finalRanking.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-center flex items-center justify-center gap-2">
              <Trophy className="text-yellow-500" size={28} />
              Classement Final
            </h2>
            <div className="max-w-2xl mx-auto">
              <div className="space-y-3">
                {finalRanking.map((team: any, index: number) => (
                  <div
                    key={team.id || index}
                    className={`flex items-center p-4 rounded-lg border-2 ${
                      index === 0 ? 'bg-yellow-50 border-yellow-300' :
                      index === 1 ? 'bg-gray-100 border-gray-300' :
                      index === 2 ? 'bg-orange-50 border-orange-300' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <span className="text-2xl mr-4 min-w-[40px] text-center">
                      {index === 0 ? (
                        <Trophy className="text-yellow-500 inline" size={28} />
                      ) : index === 1 ? (
                        <Trophy className="text-gray-400 inline" size={24} />
                      ) : index === 2 ? (
                        <Trophy className="text-orange-500 inline" size={24} />
                      ) : (
                        <span className="font-bold text-gray-500">{index + 1}</span>
                      )}
                    </span>
                    <span className="flex-grow font-semibold text-lg">
                      {team.teamName || team.name}
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {team.points || 0} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info about propagation */}
        {matches.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note :</strong> Lorsque vous modifiez le score d'un match, le vainqueur est automatiquement
              propagé vers le match suivant du bracket d'élimination. Les perdants des demi-finales sont également
              propagés vers le match pour la 3ème place.
            </p>
          </div>
        )}
      </div>

      {/* Score Modal */}
      <MatchScoreModal
        isOpen={scoreModalOpen}
        onClose={() => setScoreModalOpen(false)}
        onSave={handleSaveMatchScore}
        match={selectedMatch}
        setsToWin={tournament?.setsPerMatchElimination || 3}
        pointsPerSet={tournament?.pointsPerSetElimination || 21}
      />

      {/* Teams Modal */}
      {teamsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setTeamsModalOpen(false)}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Modifier les équipes</h3>
                <button onClick={() => setTeamsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              {selectedMatch?.status === 'completed' && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Attention :</strong> Ce match est terminé. Modifier les équipes réinitialisera le score et effacera les résultats propagés.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team 1 Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Équipe 1</label>
                  <select
                    value={selectedTeam1?.id || ''}
                    onChange={(e) => {
                      const team = teams.find(t => t.id === e.target.value);
                      setSelectedTeam1(team ? { id: team.id, name: team.name } : null);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Sélectionner --</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} disabled={team.id === selectedTeam2?.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  {selectedTeam1 && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      <span className="font-medium">{selectedTeam1.name}</span>
                    </div>
                  )}
                </div>

                {/* Team 2 Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Équipe 2</label>
                  <select
                    value={selectedTeam2?.id || ''}
                    onChange={(e) => {
                      const team = teams.find(t => t.id === e.target.value);
                      setSelectedTeam2(team ? { id: team.id, name: team.name } : null);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Sélectionner --</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} disabled={team.id === selectedTeam1?.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  {selectedTeam2 && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      <span className="font-medium">{selectedTeam2.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setTeamsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveMatchTeams}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminEliminationManagement;
