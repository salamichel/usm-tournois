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
              className="card hover:shadow-lg transition-shadow relative"
            >
              {/* Badge de statut en position absolue en haut à droite */}
              <div className="absolute top-3 right-3 z-10">
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${
                    tournament.status === 'Ouvert'
                      ? 'bg-green-500 text-white'
                      : tournament.status === 'Complet'
                      ? 'bg-red-500 text-white'
                      : tournament.status === 'Liste d\'attente'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  {tournament.status}
                </span>
              </div>

              {tournament.coverImage && (
                <img
                  src={tournament.coverImage}
                  alt={tournament.name}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
              )}
              <div className="p-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{tournament.name}</h3>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>
                      {tournament.date
                        ? format(new Date(tournament.date), 'PPP', { locale: fr })
                        : 'Date à confirmer'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{tournament.location}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    <span>
                      {tournament.registeredTeamsCount} / {tournament.maxTeams} équipes
                    </span>
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
