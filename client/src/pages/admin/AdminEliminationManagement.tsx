import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import MatchScoreModal from '@components/admin/MatchScoreModal';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Trophy, Edit2, Lock } from 'lucide-react';

const AdminEliminationManagement = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [finalRanking, setFinalRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, matchesRes] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getEliminationMatches(tournamentId!),
      ]);

      setTournament(tournamentRes.tournament || tournamentRes.data?.tournament);
      setMatches(matchesRes.matches || matchesRes.data?.matches || []);
      setFinalRanking(matchesRes.finalRanking || matchesRes.data?.finalRanking || []);
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
              disabled={!isFinaleCompleted}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                isFinaleCompleted
                  ? isTournamentFrozen
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={!isFinaleCompleted ? 'La finale doit être terminée pour figer le classement' : isTournamentFrozen ? 'Relancer le calcul des points' : 'Figer le classement final'}
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
        ) : (
          <div className="space-y-6">
            {roundOrder.map(({ key, label }) => {
              const roundMatches = matches.filter(m => m.round === key);
              if (roundMatches.length === 0) return null;

              return (
                <div key={key} className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-bold mb-4">{label}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roundMatches.map((match) => (
                      <div key={match.id} className="border-2 border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
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

                        {/* Edit button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleEditMatchScore(match)}
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 size={14} />
                            Modifier les scores
                          </button>
                        </div>

                        {/* Winner info */}
                        {match.winnerId && match.winnerName && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-green-700 font-medium">
                              🏆 Vainqueur: {match.winnerName}
                            </p>
                          </div>
                        )}
                      </div>
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
    </AdminLayout>
  );
};

export default AdminEliminationManagement;
