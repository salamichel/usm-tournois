import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Trophy } from 'lucide-react';

const AdminEliminationManagement = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      setTournament(tournamentRes.tournament);
      setMatches(matchesRes.matches || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Chargement...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link to={`/admin/tournaments/${tournamentId}/pools`} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy size={28} />
            Phase d'Élimination - {tournament?.name}
          </h1>
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
            {['final', 'semi-final', 'quarter-final', 'round-of-16'].map(round => {
              const roundMatches = matches.filter(m => m.round === round);
              if (roundMatches.length === 0) return null;

              return (
                <div key={round} className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-bold mb-4 capitalize">
                    {round.replace('-', ' ')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roundMatches.map((match, idx) => (
                      <div key={idx} className="border border-gray-300 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold">Match {match.matchNumber || idx + 1}</span>
                          <span className={`text-sm px-2 py-1 rounded ${
                            match.status === 'completed' ? 'bg-green-100 text-green-800' :
                            match.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {match.status === 'completed' ? 'Terminé' :
                             match.status === 'in_progress' ? 'En cours' : 'À venir'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className={`flex justify-between items-center p-2 rounded ${
                            match.winner === match.team1?.id ? 'bg-green-50 font-bold' : 'bg-gray-50'
                          }`}>
                            <span>{match.team1?.name || 'TBD'}</span>
                            <span>{match.score1 ?? '-'}</span>
                          </div>
                          <div className={`flex justify-between items-center p-2 rounded ${
                            match.winner === match.team2?.id ? 'bg-green-50 font-bold' : 'bg-gray-50'
                          }`}>
                            <span>{match.team2?.name || 'TBD'}</span>
                            <span>{match.score2 ?? '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEliminationManagement;
