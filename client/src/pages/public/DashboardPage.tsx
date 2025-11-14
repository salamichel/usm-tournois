import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useTournament } from '@contexts/TournamentContext';
import { Calendar, MapPin, Users, User, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DashboardPage = () => {
  const { user } = useAuth();
  const { tournaments, fetchTournaments, isLoading } = useTournament();

  useEffect(() => {
    fetchTournaments();
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenue, {user.pseudo} !
        </h1>
        <p className="text-gray-600 mt-2">
          Gérez vos inscriptions et suivez vos tournois
        </p>
      </div>

      {/* User Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <User className="text-primary-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pseudo</p>
              <p className="text-lg font-semibold">{user.pseudo}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Niveau</p>
              <p className="text-lg font-semibold">
                {user.level === 'Beginner' && 'Débutant'}
                {user.level === 'Intermediate' && 'Intermédiaire'}
                {user.level === 'Advanced' && 'Avancé'}
                {user.level === 'Expert' && 'Expert'}
              </p>
            </div>
          </div>
        </div>

        {user.role === 'admin' && (
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <Shield className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Rôle</p>
                <p className="text-lg font-semibold">Administrateur</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/mon-profil" className="btn-secondary text-center">
            Modifier mon profil
          </Link>
          <Link to="/changer-mot-de-passe" className="btn-secondary text-center">
            Changer mon mot de passe
          </Link>
          {user.role === 'admin' && (
            <Link to="/admin" className="btn-primary text-center">
              Panneau d'administration
            </Link>
          )}
        </div>
      </div>

      {/* Available Tournaments */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Tournois disponibles
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              Aucun tournoi disponible pour le moment.
            </p>
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
                    className="w-full h-48 object-cover rounded-t-lg -mt-4 -mx-4 mb-4"
                  />
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {tournament.name}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>
                        {tournament.date
                          ? format(new Date(tournament.date), 'PPP', {
                              locale: fr,
                            })
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
                        {tournament.registeredTeamsCount} / {tournament.maxTeams}{' '}
                        équipes
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
                          : tournament.status === "Liste d'attente"
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
    </div>
  );
};

export default DashboardPage;
