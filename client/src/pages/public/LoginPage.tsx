import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import type { LoginCredentials, CreateUserDto, UserLevel } from '@shared/types';

const LoginPage = () => {
  const [isSignup, setIsSignup] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });

  const [signupData, setSignupData] = useState<CreateUserDto>({
    email: '',
    password: '',
    pseudo: '',
    level: 'Intermediate',
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
      await signup(signupData);
      navigate('/mon-compte');
    } catch (error) {
      // Error handled by AuthContext
    }
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
                  <option value="Beginner">Débutant</option>
                  <option value="Intermediate">Intermédiaire</option>
                  <option value="Advanced">Avancé</option>
                  <option value="Expert">Expert</option>
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
    </div>
  );
};

export default LoginPage;
