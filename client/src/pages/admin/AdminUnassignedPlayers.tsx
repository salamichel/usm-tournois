import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import { ArrowLeft, UserMinus, Trash2, Shuffle, UserPlus, X, Search, MessageSquare, Eye, BarChart3, Edit } from 'lucide-react';
import SignupQuestionsModal from '../../components/SignupQuestionsModal';
import type { QuestionResponse, TournamentQuestion } from '@shared/types';

interface OptionStat {
  id: string;
  label: string;
  count: number;
  percentage: number;
}

interface QuestionStat {
  questionId: string;
  question: string;
  totalResponses: number;
  options: OptionStat[];
}

const AdminUnassignedPlayers = () => {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Responses modal state
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // Statistics state
  const [showStats, setShowStats] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [editForm, setEditForm] = useState({ pseudo: '', level: '', sexe: '' });
  const [updatingPlayer, setUpdatingPlayer] = useState(false);

  // Signup questions state for adding player
  const [showSignupQuestionsModal, setShowSignupQuestionsModal] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<any>(null);

  // Edit question responses state
  const [editQuestionResponses, setEditQuestionResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  useEffect(() => {
    // Filter users based on search term
    if (searchTerm.trim() === '') {
      setFilteredUsers(allUsers);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredUsers(
        allUsers.filter(
          (user) =>
            user.pseudo?.toLowerCase().includes(term) ||
            user.email?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, allUsers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, playersRes] = await Promise.all([
        adminService.getTournamentById(tournamentId!),
        adminService.getUnassignedPlayers(tournamentId!),
      ]);

      setTournament(tournamentRes.data?.tournament);
      setPlayers(playersRes.data?.players || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await adminService.getAllUsers();
      const users = response.data?.users || [];

      // Filter out users who are already in the unassigned list
      const playerIds = players.map((p) => p.id);
      const availableUsers = users.filter((u: any) => !playerIds.includes(u.id));

      setAllUsers(availableUsers);
      setFilteredUsers(availableUsers);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenAddModal = () => {
    setShowAddModal(true);
    setSearchTerm('');
    loadAllUsers();
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setSearchTerm('');
    setAllUsers([]);
    setFilteredUsers([]);
  };

  const handleAddPlayer = async (userId: string, user: any) => {
    // Check if tournament has signup questions
    if (tournament?.signupQuestions && tournament.signupQuestions.length > 0) {
      // Store the user and open signup questions modal
      setSelectedUserToAdd(user);
      setShowSignupQuestionsModal(true);
    } else {
      // No questions, add player directly
      await executeAddPlayer(userId, []);
    }
  };

  const executeAddPlayer = async (userId: string, questionResponses: QuestionResponse[]) => {
    try {
      setAddingPlayer(true);
      await adminService.addUnassignedPlayer(tournamentId!, userId, questionResponses);
      toast.success('Joueur ajouté avec succès');
      handleCloseAddModal();
      setShowSignupQuestionsModal(false);
      setSelectedUserToAdd(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'ajout du joueur');
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleSignupQuestionsSubmit = (questionResponses: QuestionResponse[]) => {
    if (selectedUserToAdd) {
      executeAddPlayer(selectedUserToAdd.id, questionResponses);
    }
  };

  const handleSignupQuestionsClose = () => {
    setShowSignupQuestionsModal(false);
    setSelectedUserToAdd(null);
  };

  const handleRemovePlayer = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce joueur ?')) return;

    try {
      await adminService.removeUnassignedPlayer(tournamentId!, userId);
      toast.success('Joueur retiré avec succès');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleViewResponses = (player: any) => {
    setSelectedPlayer(player);
    setShowResponsesModal(true);
  };

  const handleCloseResponsesModal = () => {
    setShowResponsesModal(false);
    setSelectedPlayer(null);
  };

  const handleOpenEditModal = (player: any) => {
    setEditingPlayer(player);
    setEditForm({
      pseudo: player.pseudo || '',
      level: player.level || '',
      sexe: player.sexe || 'homme',
    });

    // Initialize question responses from player data
    const responsesMap: Record<string, string> = {};
    if (player.questionResponses && Array.isArray(player.questionResponses)) {
      player.questionResponses.forEach((response: QuestionResponse) => {
        responsesMap[response.questionId] = response.selectedOptionId;
      });
    }
    setEditQuestionResponses(responsesMap);

    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingPlayer(null);
    setEditForm({ pseudo: '', level: '', sexe: '' });
    setEditQuestionResponses({});
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editForm.pseudo.trim()) {
      toast.error('Le pseudo est requis');
      return;
    }

    // Build question responses array
    const questionResponses: QuestionResponse[] = [];
    if (tournament?.signupQuestions) {
      tournament.signupQuestions.forEach((question: TournamentQuestion) => {
        if (editQuestionResponses[question.id]) {
          const selectedOption = question.options.find(opt => opt.id === editQuestionResponses[question.id]);
          questionResponses.push({
            questionId: question.id,
            selectedOptionId: editQuestionResponses[question.id],
            selectedOptionLabel: selectedOption?.label,
          });
        }
      });
    }

    try {
      setUpdatingPlayer(true);
      await adminService.updateUnassignedPlayer(tournamentId!, editingPlayer.id, {
        pseudo: editForm.pseudo.trim(),
        level: editForm.level,
        sexe: editForm.sexe,
        questionResponses: questionResponses.length > 0 ? questionResponses : undefined,
      });
      toast.success('Joueur mis à jour avec succès');
      handleCloseEditModal();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du joueur');
    } finally {
      setUpdatingPlayer(false);
    }
  };

  // Helper to get question label by ID
  const getQuestionLabel = (questionId: string): string => {
    const question = tournament?.signupQuestions?.find((q: TournamentQuestion) => q.id === questionId);
    return question?.question || 'Question inconnue';
  };

  // Check if tournament has signup questions
  const hasSignupQuestions = tournament?.signupQuestions && tournament.signupQuestions.length > 0;

  // Compute aggregated statistics for questions
  const computeStatistics = (): QuestionStat[] => {
    if (!hasSignupQuestions || !players.length) return [];

    return tournament.signupQuestions.map((question: TournamentQuestion) => {
      const optionCounts: Record<string, number> = {};

      // Initialize all options with 0
      question.options.forEach((opt) => {
        optionCounts[opt.id] = 0;
      });

      // Count responses
      let totalResponses = 0;
      players.forEach((player) => {
        const response = player.questionResponses?.find(
          (r: QuestionResponse) => r.questionId === question.id
        );
        if (response && optionCounts[response.selectedOptionId] !== undefined) {
          optionCounts[response.selectedOptionId]++;
          totalResponses++;
        }
      });

      return {
        questionId: question.id,
        question: question.question,
        totalResponses,
        options: question.options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          count: optionCounts[opt.id],
          percentage: totalResponses > 0 ? Math.round((optionCounts[opt.id] / totalResponses) * 100) : 0,
        })),
      };
    });
  };

  const statistics = computeStatistics();

  const handleGenerateRandomTeams = async () => {
    if (!confirm(`Voulez-vous générer les équipes équilibrées avec ${players.length} joueur(s) ?\n\nCette action créera des équipes de ${tournament.playersPerTeam} joueurs équilibrées par niveau.`)) {
      return;
    }

    try {
      setGenerating(true);
      const response = await adminService.generateRandomTeams(tournamentId!);
      toast.success(response.message || 'Équipes générées avec succès');

      if ((response.data?.remainingPlayers ?? 0) > 0) {
        toast.success(`${response.data?.remainingPlayers} joueur(s) restant(s) non assigné(s)`, { duration: 5000 });
      }

      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération des équipes');
    } finally {
      setGenerating(false);
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
          <Link to="/admin/tournaments" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserMinus size={28} />
            Joueurs non assignés - {tournament?.name}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <p className="text-gray-600">
              {tournament?.registrationMode === 'random'
                ? `${players.length} joueur(s) inscrit(s). Les équipes seront générées de manière équilibrée par niveau.`
                : 'Ces joueurs se sont inscrits au tournoi mais n\'ont pas encore rejoint ou créé d\'équipe.'}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasSignupQuestions && players.length > 0 && (
                <button
                  onClick={() => setShowStats(!showStats)}
                  className={`btn-secondary flex items-center gap-2 ${showStats ? 'bg-blue-100 text-blue-700' : ''}`}
                >
                  <BarChart3 size={18} />
                  {showStats ? 'Masquer stats' : 'Voir stats'}
                </button>
              )}
              <button
                onClick={handleOpenAddModal}
                className="btn-secondary flex items-center gap-2"
              >
                <UserPlus size={18} />
                Ajouter un joueur
              </button>
              {tournament?.registrationMode === 'random' && players.length > 0 && (
                <button
                  onClick={handleGenerateRandomTeams}
                  disabled={generating || players.length < tournament.playersPerTeam}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={players.length < tournament.playersPerTeam ? `Besoin d'au moins ${tournament.playersPerTeam} joueurs` : 'Générer les équipes équilibrées par niveau'}
                >
                  <Shuffle size={18} />
                  {generating ? 'Génération...' : 'Générer les équipes équilibrées'}
                </button>
              )}
            </div>
          </div>

          {/* Aggregated Statistics Section */}
          {showStats && hasSignupQuestions && statistics.length > 0 && (
            <div className="mb-6 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 size={20} />
                Statistiques des réponses
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                {statistics.map((stat, index) => (
                  <div key={stat.questionId} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">
                      {index + 1}. {stat.question}
                    </h4>
                    <p className="text-xs text-gray-500 mb-3">
                      {stat.totalResponses} réponse(s) sur {players.length} joueur(s)
                    </p>
                    <div className="space-y-3">
                      {stat.options.map((option) => (
                        <div key={option.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{option.label}</span>
                            <span className="font-medium text-gray-900">
                              {option.count} ({option.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-3 rounded-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${option.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {players.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pseudo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sexe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Niveau
                    </th>
                    {hasSignupQuestions && (
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Réponses
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.map(player => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{player.pseudo}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {player.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {player.sexe === 'femme' ? 'F' : 'H'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          player.level?.toLowerCase() === 'débutant' ? 'bg-gray-100 text-gray-800' :
                          player.level?.toLowerCase() === 'intermédiaire' ? 'bg-blue-100 text-blue-800' :
                          player.level?.toLowerCase() === 'confirmé' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {player.level || 'N/A'}
                        </span>
                      </td>
                      {hasSignupQuestions && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {player.questionResponses && player.questionResponses.length > 0 ? (
                            <button
                              onClick={() => handleViewResponses(player)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                              title="Voir les réponses"
                            >
                              <Eye size={14} />
                              {player.questionResponses.length} réponse(s)
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">Aucune</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(player)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Éditer"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleRemovePlayer(player.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Retirer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UserMinus size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Aucun joueur non assigné</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal d'ajout de joueur */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserPlus size={20} />
                Ajouter un joueur
              </h2>
              <button
                onClick={handleCloseAddModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par pseudo ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-600">Chargement des utilisateurs...</div>
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.pseudo}</p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            user.level?.toLowerCase() === 'débutant' ? 'bg-gray-100 text-gray-800' :
                            user.level?.toLowerCase() === 'intermédiaire' ? 'bg-blue-100 text-blue-800' :
                            user.level?.toLowerCase() === 'confirmé' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {user.level || 'N/A'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {user.sexe === 'femme' ? 'F' : 'H'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddPlayer(user.id, user)}
                        disabled={addingPlayer}
                        className="ml-4 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <UserPlus size={16} />
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur disponible'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal pour voir les réponses aux questions */}
      {showResponsesModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageSquare size={20} />
                Réponses de {selectedPlayer.pseudo}
              </h2>
              <button
                onClick={handleCloseResponsesModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedPlayer.questionResponses && selectedPlayer.questionResponses.length > 0 ? (
                <div className="space-y-4">
                  {selectedPlayer.questionResponses.map((response: QuestionResponse, index: number) => (
                    <div key={response.questionId} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {index + 1}. {getQuestionLabel(response.questionId)}
                      </p>
                      <p className="text-base text-gray-900 bg-blue-50 px-3 py-2 rounded-md">
                        {response.selectedOptionLabel || 'Réponse non disponible'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Ce joueur n'a pas répondu aux questions
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={handleCloseResponsesModal}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'édition de joueur */}
      {showEditModal && editingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <form onSubmit={handleUpdatePlayer} className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Edit size={20} />
                  Éditer le joueur
                </h2>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pseudo *
                  </label>
                  <input
                    type="text"
                    value={editForm.pseudo}
                    onChange={(e) => setEditForm({ ...editForm, pseudo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Niveau *
                  </label>
                  <select
                    value={editForm.level}
                    onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Sélectionner un niveau</option>
                    <option value="Débutant">Débutant</option>
                    <option value="Intermédiaire">Intermédiaire</option>
                    <option value="Confirmé">Confirmé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sexe *
                  </label>
                  <select
                    value={editForm.sexe}
                    onChange={(e) => setEditForm({ ...editForm, sexe: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="homme">Homme</option>
                    <option value="femme">Femme</option>
                  </select>
                </div>

                {/* Signup questions */}
                {tournament?.signupQuestions && tournament.signupQuestions.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Questions d'inscription
                    </h3>
                    <div className="space-y-4">
                      {tournament.signupQuestions.map((question: TournamentQuestion, index: number) => (
                        <div key={question.id}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {index + 1}. {question.question}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <div className="space-y-2">
                            {question.options.map((option) => (
                              <label
                                key={option.id}
                                className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                                  editQuestionResponses[question.id] === option.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`edit_${question.id}`}
                                  value={option.id}
                                  checked={editQuestionResponses[question.id] === option.id}
                                  onChange={() => {
                                    setEditQuestionResponses({
                                      ...editQuestionResponses,
                                      [question.id]: option.id,
                                    });
                                  }}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <span className="ml-3 text-sm text-gray-700">{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={updatingPlayer}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={updatingPlayer}
                >
                  {updatingPlayer ? 'Mise à jour...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signup Questions Modal for adding player */}
      {tournament?.signupQuestions && tournament.signupQuestions.length > 0 && (
        <SignupQuestionsModal
          isOpen={showSignupQuestionsModal}
          onClose={handleSignupQuestionsClose}
          onSubmit={handleSignupQuestionsSubmit}
          questions={tournament.signupQuestions}
          isLoading={addingPlayer}
          title="Questions d'inscription pour le joueur"
        />
      )}
    </AdminLayout>
  );
};

export default AdminUnassignedPlayers;
