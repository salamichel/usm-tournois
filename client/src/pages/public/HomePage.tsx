import { useEffect, useState, useMemo } from 'react';
import { useTournament } from '@contexts/TournamentContext';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import TournamentFilters from '@components/TournamentFilters';

const HomePage = () => {
  const { tournaments, fetchTournaments, isLoading } = useTournament();

  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  // Filtrage des tournois
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((tournament) => {
      // Exclure automatiquement les tournois terminés
      if (tournament.status === 'Terminé') {
        return false;
      }

      // Filtre par recherche textuelle (nom ou lieu)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = tournament.name.toLowerCase().includes(query);
        const matchesLocation = tournament.location.toLowerCase().includes(query);
        if (!matchesName && !matchesLocation) {
          return false;
        }
      }

      // Filtre par type (basé sur le nombre de joueurs par équipe)
      if (selectedType !== 'all') {
        const playersPerTeam = (tournament as any).playersPerTeam;
        if (playersPerTeam && playersPerTeam.toString() !== selectedType) {
          return false;
        }
      }

      // Filtre par statut
      if (selectedStatus !== 'all' && tournament.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [tournaments, searchQuery, selectedType, selectedStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tournois disponibles</h1>
        <p className="text-gray-600 mt-2">Découvrez et inscrivez-vous aux tournois à venir</p>
      </div>

      {/* Composant de filtres */}
      <TournamentFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
      />

      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {tournaments.length === 0
              ? 'Aucun tournoi disponible pour le moment.'
              : 'Aucun tournoi ne correspond à vos critères de recherche.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <Link
              key={tournament.id}
              to={`/tournoi/${tournament.id}`}
              className="card hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden"
            >
              {/* Image de couverture */}
              {tournament.coverImage && (
                <img
                  src={tournament.coverImage}
                  alt={tournament.name}
                  className="w-full h-48 object-cover"
                />
              )}

              {/* Bandeau d'inscription utilisateur (comme dans l'ancien design) */}
              {(tournament as any).userRegistered && (
                <div className="p-3 bg-gray-100 border-b border-gray-300 text-sm text-gray-700 flex items-center justify-center">
                  {(tournament as any).userRegistrationType === 'team' ? (
                    <>
                      <Users size={16} className="mr-2 text-blue-600" />
                      Inscrit avec l'équipe: <span className="font-semibold ml-1">{(tournament as any).userTeamName}</span>
                    </>
                  ) : (
                    <>
                      <Users size={16} className="mr-2 text-green-600" />
                      Inscrit en tant que joueur libre
                    </>
                  )}
                </div>
              )}

              {/* Contenu principal */}
              <div className="p-5 border-b border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900 pr-4">{tournament.name}</h3>
                  {/* Badge de statut à droite du titre (comme dans l'ancien design) */}
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                      tournament.status === 'Ouvert'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : tournament.status === 'Complet'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : tournament.status === 'Liste d\'attente'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-gray-100 text-gray-800 border border-gray-200'
                    }`}
                  >
                    {tournament.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>
                      {tournament.date
                        ? format(new Date(tournament.date), 'dd MMM', { locale: fr })
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    <span>{tournament.location}</span>
                  </div>
                </div>
              </div>

              {/* Section des barres de progression */}
              <div className="p-5">
                <div className="space-y-4">
                  {/* Barre équipes complètes */}
                  <div>
                    <div className="text-sm text-gray-700 mb-1 flex justify-between">
                      <span>Équipes complètes</span>
                      <span>{(tournament as any).completeTeamsCount || 0} / {tournament.maxTeams}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.min((((tournament as any).completeTeamsCount || 0) / tournament.maxTeams) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;
