import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import MatchScoreModal from '@components/admin/MatchScoreModal';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Edit2, Trash2, Users, Trophy, Save, X as XIcon, Calendar, RefreshCw, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ScheduledMatch {
  matchId: string;
  poolId: string;
  poolName: string;
  team1Name: string;
  team2Name: string;
  roundNumber: number;
  fieldNumber: number;
  status: string;
}

interface RoundScheduleData {
  totalRounds: number;
  totalMatches: number;
  numberOfFields: number;
  rounds: {
    roundNumber: number;
    matches: ScheduledMatch[];
  }[];
}

const AdminPoolsManagement = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [pools, setPools] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPoolName, setNewPoolName] = useState('');

  // Modal states
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [qualifiedTeams, setQualifiedTeams] = useState<string[]>([]);
  const [showQualificationPanel, setShowQualificationPanel] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [distributeSortBy, setDistributeSortBy] = useState<'weight' | 'globalRanking'>('weight');
  const [distributeClearExisting, setDistributeClearExisting] = useState(false);

  // Round schedule states
  const [viewMode, setViewMode] = useState<'pools' | 'rounds'>('pools');
  const [roundSchedule, setRoundSchedule] = useState<RoundScheduleData | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Clé localStorage unique par tournoi
  const qualifiedTeamsStorageKey = `qualified-teams-${tournamentId}`;

  // Charger les équipes qualifiées depuis localStorage au démarrage
  useEffect(() => {
    const savedTeams = localStorage.getItem(qualifiedTeamsStorageKey);
    if (savedTeams) {
      try {
        const teams = JSON.parse(savedTeams);
        setQualifiedTeams(teams);
        console.log(`Équipes qualifiées chargées depuis localStorage: ${teams.length} équipes`);
      } catch (error) {
        console.error('Erreur lors du chargement des équipes qualifiées:', error);
      }
    }
  }, [tournamentId]);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    if (qualifiedTeams.length > 0) {
      localStorage.setItem(qualifiedTeamsStorageKey, JSON.stringify(qualifiedTeams));
      console.log(`Sélection sauvegardée localement: ${qualifiedTeams.length} équipes`);
    } else {
      // Supprimer si aucune équipe sélectionnée
      localStorage.removeItem(qualifiedTeamsStorageKey);
    }
  }, [qualifiedTeams, qualifiedTeamsStorageKey]);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, poolsRes, teamsRes]: any[] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getPools(tournamentId!),
        adminService.getTeams(tournamentId!),
      ]);

      setTournament(tournamentRes.tournament || tournamentRes.data?.tournament);
      setPools(poolsRes.pools || poolsRes.data?.pools || []);
      setTeams(teamsRes.teams || teamsRes.data?.teams || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoolName.trim()) return;

    try {
      await adminService.createPool(tournamentId!, { name: newPoolName });
      toast.success('Poule créée avec succès');
      setNewPoolName('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleGenerateMatches = async (poolId: string) => {
    if (!confirm('Ceci va supprimer tous les matchs existants et en générer de nouveaux. Continuer ?')) return;

    try {
      await adminService.generatePoolMatches(tournamentId!, poolId);
      toast.success('Matchs générés avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération');
    }
  };

  const handleAssignTeams = async (poolId: string, selectedTeamIds: string[]) => {
    try {
      await adminService.assignTeamsToPool(tournamentId!, poolId, selectedTeamIds);
      toast.success('Équipes assignées avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'assignation');
    }
  };

  const handleUpdatePoolName = async (poolId: string, newName: string) => {
    try {
      await adminService.updatePoolName(tournamentId!, poolId, newName);
      toast.success('Nom de la poule mis à jour');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDeletePool = async (poolId: string, poolName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la poule "${poolName}" ? Tous les matchs associés seront également supprimés.`)) return;

    try {
      await adminService.deletePool(tournamentId!, poolId);
      toast.success('Poule supprimée avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleEditMatchScore = (match: any, poolId: string) => {
    setSelectedMatch(match);
    setSelectedPoolId(poolId);
    setScoreModalOpen(true);
  };

  const handleSaveMatchScore = async (sets: any[]) => {
    try {
      await adminService.updatePoolMatchScore(tournamentId!, selectedPoolId, selectedMatch.id, sets);
      toast.success('Score mis à jour avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du score');
      throw error;
    }
  };

  const handleToggleQualifiedTeam = (teamId: string) => {
    setQualifiedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleGenerateElimination = async () => {
    if (qualifiedTeams.length < 2) {
      toast.error('Veuillez sélectionner au moins 2 équipes qualifiées');
      return;
    }

    if (!confirm(`Voulez-vous vraiment générer les matchs d'élimination avec ${qualifiedTeams.length} équipes sélectionnées ? Cette action supprimera les matchs d'élimination existants.`)) return;

    try {
      await adminService.generateEliminationBracketWithTeams(tournamentId!, qualifiedTeams);
      toast.success('Matchs d\'élimination générés avec succès');

      // Nettoyer le localStorage après succès
      localStorage.removeItem(qualifiedTeamsStorageKey);

      setShowQualificationPanel(false);
      setQualifiedTeams([]);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération');
    }
  };

  const handleDistributeTeams = async () => {
    if (pools.length === 0) {
      toast.error('Veuillez créer des poules avant de distribuer les équipes');
      return;
    }

    try {
      const response = await adminService.distributeTeamsToPoolsAutomatically(
        tournamentId!,
        distributeSortBy,
        distributeClearExisting
      );
      if (response.success) {
        toast.success(response.message || 'Équipes distribuées avec succès');
        setShowDistributeModal(false);
        setDistributeClearExisting(false);
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la distribution');
    }
  };

  // Round schedule functions
  const loadRoundSchedule = async () => {
    try {
      setLoadingSchedule(true);
      const response = await adminService.getRoundSchedule(tournamentId!);
      const scheduleData = response.data?.data || response.data;
      setRoundSchedule(scheduleData as RoundScheduleData | null);
    } catch (error: any) {
      console.error('Error loading round schedule:', error);
      setRoundSchedule(null);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleGenerateRoundSchedule = async () => {
    // Check if matches exist
    const hasMatches = pools.some((pool) => pool.matches && pool.matches.length > 0);
    if (!hasMatches) {
      toast.error('Veuillez d\'abord générer les matchs dans les poules');
      return;
    }

    if (!confirm('Ceci va régénérer le planning des rounds. Les modifications manuelles seront perdues. Continuer ?')) return;

    try {
      setLoadingSchedule(true);
      const response = await adminService.generateRoundSchedule(tournamentId!);
      const message = (response as any).message || 'Planning généré avec succès';
      toast.success(message);
      const scheduleData = (response as any).data?.data || (response as any).data;
      setRoundSchedule(scheduleData as RoundScheduleData | null);
      setViewMode('rounds');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération du planning');
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleClearRoundSchedule = async () => {
    if (!confirm('Êtes-vous sûr de vouloir effacer le planning des rounds ?')) return;

    try {
      await adminService.clearRoundSchedule(tournamentId!);
      toast.success('Planning effacé');
      setRoundSchedule(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'effacement du planning');
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !roundSchedule) return;

    const { source, destination } = result;

    // Parse source and destination
    const sourceRoundIndex = parseInt(source.droppableId.split('-')[1]);
    const destRoundIndex = parseInt(destination.droppableId.split('-')[1]);
    const sourceFieldIndex = source.index;
    const destFieldIndex = destination.index;

    // Find the match being dragged
    const sourceRound = roundSchedule.rounds[sourceRoundIndex];
    const draggedMatch = sourceRound.matches[sourceFieldIndex];

    if (!draggedMatch) return;

    // Create a copy of the rounds
    const newRounds = [...roundSchedule.rounds];

    // If moving within the same round
    if (sourceRoundIndex === destRoundIndex) {
      const round = { ...newRounds[sourceRoundIndex] };
      const matches = [...round.matches];

      // Swap the matches
      const [removed] = matches.splice(sourceFieldIndex, 1);
      matches.splice(destFieldIndex, 0, removed);

      // Update field numbers
      matches.forEach((match, idx) => {
        match.fieldNumber = idx + 1;
      });

      round.matches = matches;
      newRounds[sourceRoundIndex] = round;
    } else {
      // Moving between different rounds
      const sourceRoundCopy = { ...newRounds[sourceRoundIndex] };
      const destRoundCopy = { ...newRounds[destRoundIndex] };

      const sourceMatches = [...sourceRoundCopy.matches];
      const destMatches = [...destRoundCopy.matches];

      // Remove from source
      const [removed] = sourceMatches.splice(sourceFieldIndex, 1);

      // Add to destination
      destMatches.splice(destFieldIndex, 0, removed);

      // Update round and field numbers
      sourceMatches.forEach((match, idx) => {
        match.fieldNumber = idx + 1;
      });
      destMatches.forEach((match, idx) => {
        match.roundNumber = destRoundCopy.roundNumber;
        match.fieldNumber = idx + 1;
      });
      removed.roundNumber = destRoundCopy.roundNumber;

      sourceRoundCopy.matches = sourceMatches;
      destRoundCopy.matches = destMatches;

      newRounds[sourceRoundIndex] = sourceRoundCopy;
      newRounds[destRoundIndex] = destRoundCopy;
    }

    // Optimistically update UI
    setRoundSchedule({
      ...roundSchedule,
      rounds: newRounds,
    });

    // Prepare updates for backend
    const updates: { poolId: string; matchId: string; roundNumber: number; fieldNumber: number }[] = [];
    newRounds.forEach((round) => {
      round.matches.forEach((match) => {
        updates.push({
          poolId: match.poolId,
          matchId: match.matchId,
          roundNumber: match.roundNumber,
          fieldNumber: match.fieldNumber,
        });
      });
    });

    try {
      await adminService.bulkUpdateMatchSchedules(tournamentId!, updates);
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour du planning');
      // Reload schedule to revert
      loadRoundSchedule();
    }
  };

  // Load round schedule when switching to rounds view
  useEffect(() => {
    if (viewMode === 'rounds' && !roundSchedule && !loadingSchedule) {
      loadRoundSchedule();
    }
  }, [viewMode]);

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
          <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold">
            Gestion des Poules - {tournament?.name}
          </h1>
        </div>

        {/* View mode toggle */}
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            onClick={() => setViewMode('pools')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewMode === 'pools'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={18} className="inline mr-2" />
            Poules
          </button>
          <button
            onClick={() => setViewMode('rounds')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewMode === 'rounds'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar size={18} className="inline mr-2" />
            Planning des Rounds
          </button>
        </div>

        {/* Pools View */}
        {viewMode === 'pools' && (
          <>
            {/* Créer une nouvelle poule */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Créer une nouvelle Poule</h2>
              <form onSubmit={handleCreatePool} className="flex gap-4">
                <input
              type="text"
              value={newPoolName}
              onChange={(e) => setNewPoolName(e.target.value)}
              placeholder="Nom de la poule (ex: Poule A)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Plus size={18} />
              Créer la Poule
            </button>
          </form>
        </div>

        {/* Distribution automatique des équipes */}
        {pools.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Users size={20} />
              Distribution Automatique des Équipes
            </h2>
            <p className="text-gray-700 mb-4">
              Distribuez automatiquement les équipes non assignées dans les poules de manière homogène en fonction de leur poids ou ranking.
            </p>
            <button
              onClick={() => setShowDistributeModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
            >
              <Users size={18} />
              Distribuer les équipes automatiquement
            </button>
          </div>
        )}

        {/* Phase d'élimination */}
        {tournament?.eliminationPhaseEnabled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy size={20} />
              Phase d'Élimination
            </h2>

            {!showQualificationPanel ? (
              <>
                <p className="text-gray-700 mb-4">
                  Sélectionnez manuellement les équipes qualifiées pour la phase d'élimination.
                  {qualifiedTeams.length > 0 && (
                    <span className="ml-2 text-green-600 font-semibold">
                      ({qualifiedTeams.length} équipe{qualifiedTeams.length > 1 ? 's' : ''} pré-sélectionnée{qualifiedTeams.length > 1 ? 's' : ''} 💾)
                    </span>
                  )}
                </p>
                <div className="flex gap-4">
                  <Link
                    to={`/admin/tournaments/${tournamentId}/elimination`}
                    className="btn-primary"
                  >
                    Accéder aux Matchs d'Élimination
                  </Link>
                  <button
                    onClick={() => setShowQualificationPanel(true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md"
                  >
                    {qualifiedTeams.length > 0 ? 'Modifier la sélection' : 'Sélectionner les Équipes Qualifiées'}
                  </button>
                  {qualifiedTeams.length >= 2 && (
                    <button
                      onClick={handleGenerateElimination}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-semibold"
                    >
                      Générer les Matchs ({qualifiedTeams.length} équipes)
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="bg-white rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">
                      Sélectionnez les équipes qualifiées ({qualifiedTeams.length} sélectionnée{qualifiedTeams.length > 1 ? 's' : ''})
                    </h3>
                    {qualifiedTeams.length > 0 && (
                      <button
                        onClick={() => {
                          setQualifiedTeams([]);
                          localStorage.removeItem(qualifiedTeamsStorageKey);
                          toast.success('Sélection effacée');
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Tout désélectionner
                      </button>
                    )}
                  </div>

                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    💾 Votre sélection est sauvegardée automatiquement dans votre navigateur
                  </div>

                  {pools.map((pool) => (
                    <div key={pool.id} className="mb-4 pb-4 border-b border-gray-200 last:border-b-0">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">{pool.name}</h4>
                      {((pool.ranking && pool.ranking.length > 0) || (pool.teams && pool.teams.length > 0)) ? (
                        <div className="space-y-2">
                          {/* Utiliser le ranking s'il existe, sinon utiliser pool.teams */}
                          {(pool.ranking && pool.ranking.length > 0 ? pool.ranking : pool.teams).map((team: any, idx: number) => (
                            <label
                              key={team.id}
                              className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={qualifiedTeams.includes(team.id)}
                                onChange={() => handleToggleQualifiedTeam(team.id)}
                                className="h-4 w-4"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
                                  <span className="font-medium">{team.name}</span>
                                  {team.wins !== undefined && (
                                    <span className="text-xs text-gray-500">
                                      ({team.wins || 0}V - {team.losses || 0}D)
                                    </span>
                                  )}
                                </div>
                                {(team.player1 || team.player2) && (
                                  <div className="text-xs text-gray-500 mt-0.5 ml-6">
                                    {team.player1?.name || team.player1?.displayName || 'Joueur 1'}
                                    {team.player2 && (
                                      <> / {team.player2?.name || team.player2?.displayName || 'Joueur 2'}</>
                                    )}
                                  </div>
                                )}
                                {team.members && team.members.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-0.5 ml-6">
                                    {team.members.map((m: any) => m.pseudo || m.name).join(' / ')}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Aucune équipe dans cette poule</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleGenerateElimination}
                    disabled={qualifiedTeams.length < 2}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md disabled:cursor-not-allowed"
                  >
                    Générer les Matchs ({qualifiedTeams.length} équipes)
                  </button>
                  <button
                    onClick={() => {
                      setShowQualificationPanel(false);
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
                  >
                      Fermer (sélection sauvegardée)
                  </button>
                </div>
              </>
            )}
          </div>
        )}

            {/* Liste des poules */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pools.map((pool, index) => {
                // Create a unique key that includes pool ID and team IDs to force re-mount on team changes
                const poolKey = `${pool.id}-${pool.teams?.map((t: any) => t.id).sort().join('-') || 'empty'}`;
                return (
                  <PoolCard
                    key={poolKey}
                    pool={pool}
                    teams={teams}
                    tournamentId={tournamentId!}
                    colorIndex={index}
                    tournament={tournament}
                    onGenerateMatches={handleGenerateMatches}
                    onAssignTeams={handleAssignTeams}
                    onUpdateName={handleUpdatePoolName}
                    onDelete={handleDeletePool}
                    onEditMatchScore={handleEditMatchScore}
                  />
                );
              })}
            </div>

            {pools.length === 0 && (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600">Aucune poule créée pour ce tournoi</p>
              </div>
            )}
          </>
        )}

        {/* Rounds View */}
        {viewMode === 'rounds' && (
          <div>
            {/* Generate/Clear buttons */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Calendar size={20} />
                Planning des Rounds
              </h2>
              <p className="text-gray-700 mb-4">
                Générez automatiquement le planning des matchs par round. Avec {tournament?.fields || 1} terrain{(tournament?.fields || 1) > 1 ? 's' : ''},
                les matchs seront distribués en alternant entre les poules.
              </p>
              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={handleGenerateRoundSchedule}
                  disabled={loadingSchedule}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md flex items-center gap-2"
                >
                  <RefreshCw size={18} className={loadingSchedule ? 'animate-spin' : ''} />
                  {roundSchedule ? 'Régénérer le planning' : 'Générer le planning'}
                </button>
                {roundSchedule && (
                  <button
                    onClick={handleClearRoundSchedule}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                  >
                    <Trash2 size={18} />
                    Effacer le planning
                  </button>
                )}
              </div>
            </div>

            {/* Round schedule display */}
            {loadingSchedule ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Chargement du planning...</div>
              </div>
            ) : roundSchedule && roundSchedule.rounds.length > 0 ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    {roundSchedule.totalRounds} round{roundSchedule.totalRounds > 1 ? 's' : ''} - {roundSchedule.totalMatches} match{roundSchedule.totalMatches > 1 ? 's' : ''} - {roundSchedule.numberOfFields} terrain{roundSchedule.numberOfFields > 1 ? 's' : ''}
                    <span className="ml-4 text-blue-600">Glissez-déposez les matchs pour réorganiser</span>
                  </div>
                  {roundSchedule.rounds.map((round, roundIndex) => (
                    <div key={round.roundNumber} className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-bold text-lg">Round {round.roundNumber}</h3>
                      </div>
                      <Droppable droppableId={`round-${roundIndex}`} direction="horizontal">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`p-4 flex gap-4 flex-wrap ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
                          >
                            {round.matches.map((match, matchIndex) => (
                              <Draggable
                                key={`${match.poolId}-${match.matchId}`}
                                draggableId={`${match.poolId}-${match.matchId}`}
                                index={matchIndex}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`flex-1 min-w-[280px] max-w-[350px] p-4 rounded-lg border-2 ${
                                      snapshot.isDragging
                                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <GripVertical size={16} className="text-gray-400" />
                                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                        Terrain {match.fieldNumber}
                                      </span>
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        match.poolName.includes('A') ? 'bg-purple-100 text-purple-700' :
                                        match.poolName.includes('B') ? 'bg-orange-100 text-orange-700' :
                                        match.poolName.includes('C') ? 'bg-green-100 text-green-700' :
                                        match.poolName.includes('D') ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {match.poolName}
                                      </span>
                                    </div>
                                    <div className="font-medium text-sm">
                                      {match.team1Name}
                                      <span className="mx-2 text-gray-400">vs</span>
                                      {match.team2Name}
                                    </div>
                                    <div className="mt-2">
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        match.status === 'completed' ? 'bg-green-100 text-green-800' :
                                        match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {match.status === 'completed' ? 'Terminé' :
                                         match.status === 'in_progress' ? 'En cours' : 'En attente'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              </DragDropContext>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Aucun planning généré</p>
                <p className="text-sm text-gray-500">
                  Créez d'abord des poules, assignez des équipes et générez les matchs, puis générez le planning des rounds.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Distribution Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Distribution Automatique</h3>
            <p className="text-gray-600 mb-4">
              Choisissez le critère de tri pour distribuer les équipes de manière homogène dans les poules.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Critère de tri
              </label>
              <select
                value={distributeSortBy}
                onChange={(e) => setDistributeSortBy(e.target.value as 'weight' | 'globalRanking')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="weight">Poids de l'équipe</option>
                <option value="globalRanking">Points de ranking global</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Les équipes seront triées par ordre décroissant et distribuées selon l'algorithme "serpent" pour équilibrer les poules.
              </p>
            </div>
            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={distributeClearExisting}
                  onChange={(e) => setDistributeClearExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Redistribuer toutes les équipes
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Cochez cette option pour effacer les assignations existantes et redistribuer toutes les équipes, pas seulement celles qui ne sont pas encore assignées.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDistributeModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDistributeTeams}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Distribuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score Modal */}
      <MatchScoreModal
        isOpen={scoreModalOpen}
        onClose={() => setScoreModalOpen(false)}
        onSave={handleSaveMatchScore}
        match={selectedMatch}
        setsToWin={tournament?.setsPerMatchPool || 1}
        pointsPerSet={tournament?.pointsPerSetPool || 21}
      />
    </AdminLayout>
  );
};

interface PoolCardProps {
  pool: any;
  teams: any[];
  tournamentId: string;
  tournament: any;
  colorIndex: number;
  onGenerateMatches: (poolId: string) => void;
  onAssignTeams: (poolId: string, teamIds: string[]) => void;
  onUpdateName: (poolId: string, newName: string) => void;
  onDelete: (poolId: string, poolName: string) => void;
  onEditMatchScore: (match: any, poolId: string) => void;
}

const PoolCard = ({
  pool,
  teams,
  tournamentId: _tournamentId,
  tournament: _tournament,
  colorIndex,
  onGenerateMatches,
  onAssignTeams,
  onUpdateName,
  onDelete,
  onEditMatchScore,
}: PoolCardProps) => {
  const colors = ['bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-red-50', 'bg-yellow-50'];
  const borderColors = ['border-blue-200', 'border-green-200', 'border-purple-200', 'border-red-200', 'border-yellow-200'];
  const colorClass = colors[colorIndex % colors.length];
  const borderClass = borderColors[colorIndex % borderColors.length];

  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    pool.teams?.map((t: any) => t.id) || []
  );
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(pool.name);

  const handleToggleTeam = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssignTeams(pool.id, selectedTeams);
  };

  const handleSaveName = () => {
    if (newName.trim() && newName !== pool.name) {
      onUpdateName(pool.id, newName.trim());
    }
    setEditingName(false);
  };

  return (
    <div className={`${colorClass} border ${borderClass} rounded-lg p-6`}>
      {/* Header with name edit */}
      <div className="flex items-center justify-between mb-4">
        {editingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xl font-bold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditingName(false);
                  setNewName(pool.name);
                }
              }}
            />
            <button
              onClick={handleSaveName}
              className="text-green-600 hover:text-green-800"
              title="Enregistrer"
            >
              <Save size={20} />
            </button>
            <button
              onClick={() => {
                setEditingName(false);
                setNewName(pool.name);
              }}
              className="text-gray-600 hover:text-gray-800"
              title="Annuler"
            >
              <XIcon size={20} />
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold">{pool.name}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingName(true)}
                className="text-blue-600 hover:text-blue-800"
                title="Renommer"
              >
                <Edit2 size={20} />
              </button>
              <button
                onClick={() => onDelete(pool.id, pool.name)}
                className="text-red-600 hover:text-red-800"
                title="Supprimer"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Classement */}
      {pool.ranking && pool.ranking.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-2">Classement</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-2 text-center w-8">#</th>
                  <th className="py-2 px-3 text-left">Équipe</th>
                  <th className="py-2 px-2 text-center">V</th>
                  <th className="py-2 px-2 text-center">D</th>
                  <th className="py-2 px-2 text-center">Sets</th>
                  <th className="py-2 px-2 text-center">Pts</th>
                  <th className="py-2 px-2 text-center">Diff</th>
                </tr>
              </thead>
              <tbody>
                {pool.ranking.map((team: any, idx: number) => (
                  <tr key={idx} className={`border-t border-gray-200 ${idx < (_tournament?.teamsQualifiedPerPool || 2) ? 'bg-green-50' : ''}`}>
                    <td className="py-2 px-2 text-center font-bold text-gray-500">{team.rank || idx + 1}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{team.name}</div>
                      {(team.player1 || team.player2) && (
                        <div className="text-xs text-gray-500">
                          {team.player1?.name || team.player1?.displayName || 'Joueur 1'}
                          {team.player2 && (
                            <> / {team.player2?.name || team.player2?.displayName || 'Joueur 2'}</>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-green-600 font-medium">{team.wins || 0}</td>
                    <td className="py-2 px-2 text-center text-red-600 font-medium">{team.losses || 0}</td>
                    <td className="py-2 px-2 text-center">{team.setsWon || 0}-{team.setsLost || 0}</td>
                    <td className="py-2 px-2 text-center text-xs">{team.pointsWon || 0}-{team.pointsLost || 0}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`font-medium ${(team.pointsDifferential || 0) > 0 ? 'text-green-600' : (team.pointsDifferential || 0) < 0 ? 'text-red-600' : ''}`}>
                        {(team.pointsDifferential || 0) > 0 ? '+' : ''}{team.pointsDifferential || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignation des équipes */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2">
          Équipes ({pool.teams?.length || 0})
        </h4>
        <form onSubmit={handleSubmit}>
          <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto mb-3">
            {teams.map(team => {
              const isInThisPool = pool.teams?.some((t: any) => t.id === team.id);
              const isInOtherPool = team.isAssigned && !isInThisPool;

              return (
                <label
                  key={team.id}
                  className={`flex items-start gap-2 mb-3 cursor-pointer ${isInOtherPool ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(team.id)}
                    onChange={() => handleToggleTeam(team.id)}
                    disabled={isInOtherPool}
                    className="h-4 w-4 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {team.name}
                        {isInOtherPool && <span className="text-gray-500 ml-1">(Assignée)</span>}
                      </span>
                      {(team.globalRanking ?? 0) > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          {team.globalRanking} pts
                        </span>
                      )}
                    </div>
                    {(team.player1 || team.player2) && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {team.player1?.name || team.player1?.displayName || 'Joueur 1'}
                        {team.player2 && (
                          <> / {team.player2?.name || team.player2?.displayName || 'Joueur 2'}</>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <button type="submit" className="btn-primary text-sm">
            Mettre à jour les équipes
          </button>
        </form>
      </div>

      {/* Matchs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Matchs</h4>
          {pool.matches && pool.matches.length > 0 && (
            <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {pool.matches.length} match{pool.matches.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => onGenerateMatches(pool.id)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm mb-3"
        >
          Générer les Matchs
        </button>

        {pool.matches && pool.matches.length > 0 && (
          <div className="text-sm space-y-2">
            {pool.matches.map((match: any) => (
              <div key={match.id} className="bg-white p-3 rounded border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex-1">
                    <span className="text-xs font-medium">{match.team1?.name || 'Équipe 1'}</span>
                    {match.team1?.members && match.team1.members.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {match.team1.members.map((m: any) => m.pseudo || m.name).join(' / ')}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-400 mx-2">VS</span>
                  <div className="flex-1 text-right">
                    <span className="text-xs font-medium">{match.team2?.name || 'Équipe 2'}</span>
                    {match.team2?.members && match.team2.members.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {match.team2.members.map((m: any) => m.pseudo || m.name).join(' / ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score display */}
                {match.sets && match.sets.length > 0 && (
                  <div className="flex justify-center gap-2 mb-2">
                    {match.sets.map((set: any, idx: number) => (
                      <div key={idx} className="text-xs">
                        <span className={set.score1 > set.score2 ? 'font-bold' : ''}>{set.score1 ?? '-'}</span>
                        <span className="mx-1">:</span>
                        <span className={set.score2 > set.score1 ? 'font-bold' : ''}>{set.score2 ?? '-'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status */}
                <div className="flex justify-between items-center">
                  <span className={`text-xs px-2 py-1 rounded ${
                    match.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {match.status === 'completed' ? 'Terminé' : 'En attente'}
                  </span>
                  <button
                    onClick={() => onEditMatchScore(match, pool.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Edit2 size={14} />
                    Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPoolsManagement;
