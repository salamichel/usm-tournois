import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import type { LoginCredentials, CreateUserDto, UserLevel } from '@shared/types';
import { AlertCircle, UserPlus } from 'lucide-react';

const LoginPage = () => {
  const [isSignup, setIsSignup] = useState(false);
  const { login, signup, claimVirtualAccount } = useAuth();
  const navigate = useNavigate();
  const [showVirtualAccountModal, setShowVirtualAccountModal] = useState(false);
  const [virtualAccountData, setVirtualAccountData] = useState<{
    virtualUserId: string;
    pseudo: string;
    level: string;
  } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const [loginData, setLoginData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });

  const [signupData, setSignupData] = useState<CreateUserDto>({
    email: '',
    password: '',
    pseudo: '',
    level: 'Intermédiaire',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginData);
      navigate('/mon-compte');
    } catch (error) {
      // Error handled by AuthContext
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await signup(signupData);

      // Check if virtual account was found
      if (result.virtualAccountFound && result.virtualUserId) {
        setVirtualAccountData({
          virtualUserId: result.virtualUserId,
          pseudo: result.pseudo || signupData.pseudo,
          level: result.level || signupData.level,
        });
        setShowVirtualAccountModal(true);
        return;
      }

      // Normal signup success
      navigate('/mon-compte');
    } catch (error) {
      // Error handled by AuthContext
    }
  };

  const handleClaimVirtualAccount = async () => {
    if (!virtualAccountData) return;

    try {
      setIsClaiming(true);
      await claimVirtualAccount({
        email: signupData.email,
        password: signupData.password,
        pseudo: virtualAccountData.pseudo,
        level: virtualAccountData.level,
        virtualUserId: virtualAccountData.virtualUserId,
      });

      setShowVirtualAccountModal(false);
      navigate('/mon-compte');
    } catch (error) {
      // Error handled by AuthContext
    } finally {
      setIsClaiming(false);
    }
  };

  const handleChangePseudo = () => {
    setShowVirtualAccountModal(false);
    setVirtualAccountData(null);
    // User can now change their pseudo in the form
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">
              {isSignup ? 'Créer un compte' : 'Connexion'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isSignup
                ? 'Rejoignez USM Tournois pour participer'
                : 'Connectez-vous à votre compte'}
            </p>
          </div>

          {isSignup ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label htmlFor="pseudo" className="block text-sm font-medium text-gray-700 mb-1">
                  Pseudo
                </label>
                <input
                  type="text"
                  id="pseudo"
                  className="input"
                  value={signupData.pseudo}
                  onChange={(e) => setSignupData({ ...signupData, pseudo: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="input"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="password"
                  className="input"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
              </div>

              <div>
                <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                  Niveau
                </label>
                <select
                  id="level"
                  className="input"
                  value={signupData.level}
                  onChange={(e) =>
                    setSignupData({ ...signupData, level: e.target.value as UserLevel })
                  }
                  required
                >
                  <option value="Débutant">Débutant</option>
                  <option value="Intermédiaire">Intermédiaire</option>
                  <option value="Confirmé">Confirmé</option>
                </select>
              </div>

              <button type="submit" className="btn-primary w-full">
                S'inscrire
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="login-email"
                  className="input"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="login-password"
                  className="input"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full">
                Se connecter
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {isSignup
                ? 'Vous avez déjà un compte ? Connectez-vous'
                : 'Pas de compte ? Inscrivez-vous'}
            </button>
          </div>
        </div>
      </div>

      {/* Virtual Account Modal */}
      {showVirtualAccountModal && virtualAccountData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Compte virtuel détecté
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Un compte virtuel existe déjà avec le pseudo "<strong>{virtualAccountData.pseudo}</strong>".
                </p>
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700 mb-2">
                    Ce compte a peut-être été créé par un capitaine d'équipe pour vous ajouter à un tournoi.
                  </p>
                  <p className="text-sm text-gray-700">
                    Voulez-vous récupérer ce compte existant ou choisir un autre pseudo ?
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleClaimVirtualAccount}
                disabled={isClaiming}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <UserPlus size={20} />
                {isClaiming ? 'Récupération...' : 'Récupérer ce compte'}
              </button>
              <button
                onClick={handleChangePseudo}
                disabled={isClaiming}
                className="btn-secondary w-full"
              >
                Choisir un autre pseudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
