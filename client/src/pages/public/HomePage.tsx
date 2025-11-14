import { useEffect } from 'react';
import { useTournament } from '@contexts/TournamentContext';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const HomePage = () => {
  const { tournaments, fetchTournaments, isLoading } = useTournament();

  useEffect(() => {
    fetchTournaments();
  }, []);

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

      {tournaments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Aucun tournoi disponible pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              to={`/tournoi/${tournament.id}`}
              className="card hover:shadow-lg transition-shadow"
            >
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

                <div className="mt-4">
                  <span
                    className={`badge ${
                      tournament.status === 'Ouvert'
                        ? 'badge-success'
                        : tournament.status === 'Complet'
                        ? 'badge-danger'
                        : tournament.status === 'Liste d\'attente'
                        ? 'badge-warning'
                        : 'badge-info'
                    }`}
                  >
                    {tournament.status}
                  </span>
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
