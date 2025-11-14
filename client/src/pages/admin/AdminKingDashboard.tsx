import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import kingService from '@services/king.service';
import toast from 'react-hot-toast';
import type { KingDashboardData } from '@shared/types';

const AdminKingDashboard = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [data, setData] = useState<KingDashboardData | null>(null);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-red-600">Erreur : Impossible de charger le dashboard King</p>
      </div>
    );
  }

  const { tournament, kingData, currentPhase } = data;
  const currentKingPhase = tournament.currentKingPhase || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">King Dashboard</h1>
        <p className="text-gray-600 mt-2">{tournament.name}</p>
      </div>

      {/* Status Card */}
      <div className="card mb-6">
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
                <span className="badge-success">Complétée</span>
              ) : (
                <span className="badge-warning">En cours</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Matchs</p>
            <p className="text-2xl font-bold">{kingData?.totalMatches || 0}</p>
          </div>
        </div>
      </div>

      {/* Phase Controls */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">Gestion des Phases</h2>
        <div className="flex gap-4">
          <button
            onClick={handleStartPhase1}
            disabled={currentKingPhase !== 0}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Démarrer Phase 1 (4v4)
          </button>
          <button
            onClick={handleStartPhase2}
            disabled={currentKingPhase !== 1 || !tournament.isKingPhaseCompleted}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Démarrer Phase 2 (3v3)
          </button>
          <button
            onClick={handleStartPhase3}
            disabled={currentKingPhase !== 2 || !tournament.isKingPhaseCompleted}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Démarrer Phase 3 (2v2)
          </button>
        </div>
      </div>

      {/* Current Phase Details */}
      {currentPhase && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            Phase {currentPhase.phaseNumber} - {currentPhase.description}
          </h2>

          {currentPhase.pools && currentPhase.pools.length > 0 ? (
            <div className="space-y-6">
              {currentPhase.pools.map((pool: any) => (
                <div key={pool.id} className="border rounded-lg p-4">
                  <h3 className="text-lg font-bold mb-3">{pool.name}</h3>
                  {pool.matches && pool.matches.length > 0 ? (
                    <div className="space-y-2">
                      {pool.matches.map((match: any) => (
                        <div key={match.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <div>
                            <p className="font-medium">
                              {match.team1?.name} vs {match.team2?.name}
                            </p>
                            <p className="text-sm text-gray-600">{match.roundName}</p>
                          </div>
                          <div>
                            {match.status === 'completed' ? (
                              <span className="badge-success">
                                {match.setsWonTeam1} - {match.setsWonTeam2}
                              </span>
                            ) : (
                              <span className="badge-warning">En attente</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Aucun match dans cette poule</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Aucune poule créée pour cette phase</p>
          )}
        </div>
      )}

      {/* TODO Notice */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Cette interface King Dashboard est une version basique. La logique complète de
          gestion des matchs, classements et phases doit être implémentée en migrant le code de{' '}
          <code>controllers/admin/admin.king.controller.js</code> et <code>services/king.service.js</code>{' '}
          vers TypeScript.
        </p>
      </div>
    </div>
  );
};

export default AdminKingDashboard;
