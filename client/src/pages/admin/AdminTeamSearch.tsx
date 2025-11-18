import { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@components/AdminLayout';
import adminService from '@services/admin.service';
import toast from 'react-hot-toast';
import {
  Search,
  UsersRound,
  Trophy,
  Users,
  UserCheck,
  Edit,
  Eye,
  ArrowRight
} from 'lucide-react';

interface SearchResult {
  tournamentId: string;
  tournamentName: string;
  team: {
    id: string;
    name: string;
    captainPseudo?: string;
    members: any[];
    recruitmentOpen: boolean;
    poolId?: string;
  };
}

const AdminTeamSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      toast.error('Veuillez entrer un terme de recherche');
      return;
    }

    try {
      setIsSearching(true);
      setHasSearched(true);

      // Fetch all tournaments
      const tournamentsResponse = await adminService.getAllTournaments();

      if (tournamentsResponse.success && tournamentsResponse.data) {
        const searchResults: SearchResult[] = [];
        const query = searchQuery.toLowerCase();

        // Search teams in each tournament
        for (const tournament of tournamentsResponse.data.tournaments || []) {
          try {
            const teamsResponse = await adminService.getTeams(tournament.id);
            if (teamsResponse.success && teamsResponse.data) {
              const teams = teamsResponse.data.teams || [];

              // Filter teams matching the search query
              const matchingTeams = teams.filter((team: any) => {
                const matchesName = team.name?.toLowerCase().includes(query);
                const matchesCaptain = team.captainPseudo?.toLowerCase().includes(query);
                const matchesMember = team.members?.some((m: any) =>
                  m.pseudo?.toLowerCase().includes(query)
                );
                return matchesName || matchesCaptain || matchesMember;
              });

              for (const team of matchingTeams) {
                searchResults.push({
                  tournamentId: tournament.id,
                  tournamentName: tournament.name,
                  team
                });
              }
            }
          } catch {
            // Skip tournaments that fail
          }
        }

        setResults(searchResults);

        if (searchResults.length === 0) {
          toast('Aucune équipe trouvée', { icon: '🔍' });
        } else {
          toast.success(`${searchResults.length} équipe(s) trouvée(s)`);
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors de la recherche');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recherche d'Équipes</h1>
          <p className="text-gray-600 mt-1">
            Recherchez des équipes par nom, capitaine ou membre
          </p>
        </div>

        {/* Search Form */}
        <div className="card">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Nom d'équipe, pseudo du capitaine ou d'un membre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="btn-primary flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Recherche...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Rechercher
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            {results.length > 0 ? (
              <>
                <p className="text-gray-600">
                  {results.length} résultat{results.length > 1 ? 's' : ''} pour "{searchQuery}"
                </p>

                <div className="grid gap-4">
                  {results.map((result, index) => (
                    <div key={`${result.tournamentId}-${result.team.id}-${index}`} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Team Info */}
                          <div className="flex items-center gap-3 mb-2">
                            <UsersRound size={24} className="text-primary-500" />
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">
                                {result.team.name}
                              </h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Trophy size={14} />
                                <span>{result.tournamentName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Team Details */}
                          <div className="ml-9 space-y-2">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <UserCheck size={14} className="text-yellow-500" />
                                <span>Capitaine: {result.team.captainPseudo || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users size={14} className="text-gray-400" />
                                <span>{result.team.members?.length || 0} membre(s)</span>
                              </div>
                            </div>

                            {/* Members List */}
                            {result.team.members && result.team.members.length > 0 && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Membres: </span>
                                {result.team.members.map((m: any) => m.pseudo).join(', ')}
                              </div>
                            )}

                            {/* Status Badges */}
                            <div className="flex gap-2">
                              {result.team.recruitmentOpen && (
                                <span className="badge badge-info text-xs">En recrutement</span>
                              )}
                              {result.team.poolId && (
                                <span className="badge badge-default text-xs">Assignée à une poule</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <Link
                            to={`/admin/tournaments/${result.tournamentId}/teams/${result.team.id}/edit`}
                            className="btn-sm btn-secondary flex items-center gap-1"
                          >
                            <Edit size={14} />
                            Modifier
                          </Link>
                          <Link
                            to={`/admin/tournaments/${result.tournamentId}/teams`}
                            className="btn-sm btn-ghost flex items-center gap-1"
                          >
                            <ArrowRight size={14} />
                            Voir tournoi
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="card text-center py-12">
                <Search size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun résultat trouvé
                </h3>
                <p className="text-gray-500">
                  Aucune équipe ne correspond à "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!hasSearched && (
          <div className="card text-center py-12">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Rechercher une équipe
            </h3>
            <p className="text-gray-500">
              Entrez un nom d'équipe, un pseudo de capitaine ou de membre
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminTeamSearch;
