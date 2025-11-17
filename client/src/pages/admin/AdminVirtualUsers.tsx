import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserCog, Link as LinkIcon, Users, ArrowLeft } from 'lucide-react';

interface VirtualUser {
  id: string;
  pseudo: string;
  email: string;
  level: string;
  isVirtual: boolean;
  createdAt: string;
  teams: {
    teamId: string;
    teamName: string;
    tournamentId: string;
    tournamentName: string;
    isCaptain: boolean;
  }[];
}

interface RealUser {
  uid: string;
  pseudo: string;
  email: string;
  level: string;
}

const AdminVirtualUsers = () => {
  const [virtualUsers, setVirtualUsers] = useState<VirtualUser[]>([]);
  const [realUsers, setRealUsers] = useState<RealUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedVirtualUser, setSelectedVirtualUser] = useState<VirtualUser | null>(null);
  const [selectedRealUserId, setSelectedRealUserId] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch virtual users
      const virtualResponse = await fetch('/api/admin/virtual-users', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!virtualResponse.ok) throw new Error('Failed to fetch virtual users');
      const virtualData = await virtualResponse.json();

      // Fetch all users to get real users
      const usersResponse = await fetch('/api/admin/users', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!usersResponse.ok) throw new Error('Failed to fetch users');
      const usersData = await usersResponse.json();

      setVirtualUsers(virtualData.data.virtualUsers);
      setRealUsers(usersData.data.users.filter((u: any) => !u.isVirtual));
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkClick = (virtualUser: VirtualUser) => {
    setSelectedVirtualUser(virtualUser);
    setShowLinkModal(true);
  };

  const handleLink = async () => {
    if (!selectedVirtualUser || !selectedRealUserId) return;

    try {
      setProcessing(true);

      const response = await fetch('/api/admin/virtual-users/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          virtualUserId: selectedVirtualUser.id,
          realUserId: selectedRealUserId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to link accounts');
      }

      toast.success('Compte virtuel lié avec succès !');
      setShowLinkModal(false);
      setSelectedVirtualUser(null);
      setSelectedRealUserId('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la liaison des comptes');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/admin"
        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
      >
        <ArrowLeft size={20} />
        Retour au dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <UserCog size={32} />
          Gestion des comptes virtuels
        </h1>
        <p className="text-gray-600 mt-2">
          Gérer et lier les comptes virtuels aux comptes réels
        </p>
      </div>

      {virtualUsers.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg">Aucun compte virtuel trouvé</p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Comptes virtuels ({virtualUsers.length})
          </h2>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Niveau
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Équipes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {virtualUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{user.pseudo}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.teams.length > 0 ? (
                        <div className="text-sm text-gray-900">
                          {user.teams.map((team, idx) => (
                            <div key={idx} className="mb-1">
                              {team.teamName} ({team.tournamentName})
                              {team.isCaptain && (
                                <span className="ml-2 text-xs text-primary-600 font-semibold">
                                  Capitaine
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Aucune équipe</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleLinkClick(user)}
                        className="btn-primary-outline flex items-center gap-2"
                      >
                        <LinkIcon size={16} />
                        Lier à un compte réel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && selectedVirtualUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Lier le compte virtuel "{selectedVirtualUser.pseudo}"
            </h3>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Compte virtuel</h4>
              <p className="text-sm text-gray-700">
                <strong>Pseudo:</strong> {selectedVirtualUser.pseudo}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> {selectedVirtualUser.email}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Niveau:</strong> {selectedVirtualUser.level}
              </p>
              {selectedVirtualUser.teams.length > 0 && (
                <div className="mt-2">
                  <strong className="text-sm text-gray-700">Équipes:</strong>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {selectedVirtualUser.teams.map((team, idx) => (
                      <li key={idx}>
                        {team.teamName} - {team.tournamentName}
                        {team.isCaptain && ' (Capitaine)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sélectionner le compte réel
              </label>
              <select
                className="input"
                value={selectedRealUserId}
                onChange={(e) => setSelectedRealUserId(e.target.value)}
              >
                <option value="">-- Choisir un utilisateur --</option>
                {realUsers.map((user) => (
                  <option key={user.uid} value={user.uid}>
                    {user.pseudo} ({user.email}) - {user.level}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLink}
                disabled={processing || !selectedRealUserId}
                className="btn-primary flex-1"
              >
                {processing ? 'Liaison en cours...' : 'Lier les comptes'}
              </button>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSelectedVirtualUser(null);
                  setSelectedRealUserId('');
                }}
                disabled={processing}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVirtualUsers;
