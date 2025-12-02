import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import type { LoginCredentials, CreateUserDto, UserLevel } from '@shared/types';
import { AlertCircle, UserPlus, Mail } from 'lucide-react';
import authService from '@services/auth.service';
import { toast } from 'react-hot-toast';
import { analyticsService } from '@services/analytics.service';

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
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

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
      analyticsService.trackLogin('email');
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
        analyticsService.trackModalOpen('Virtual Account Claim');
        setShowVirtualAccountModal(true);
        return;
      }

      // Normal signup success
      analyticsService.trackSignup(false);
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

      analyticsService.trackVirtualAccountClaim();
      analyticsService.trackSignup(true);
      setShowVirtualAccountModal(false);
      navigate('/mon-compte');
    } catch (error) {
      // Error handled by AuthContext
    } finally {
      setIsClaiming(false);
    }
  };

  const handleChangePseudo = () => {
    analyticsService.trackModalClose('Virtual Account Claim');
    setShowVirtualAccountModal(false);
    setVirtualAccountData(null);
    // User can now change their pseudo in the form
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail) {
      toast.error('Veuillez entrer votre adresse email.');
      return;
    }

    try {
      setIsResettingPassword(true);
      const response = await authService.requestPasswordReset({ email: resetEmail });

      analyticsService.trackPasswordResetRequest();

      // In development, show the reset link
      if (response.resetLink) {
        const url = new URL(response.resetLink);
        const oobCode = url.searchParams.get('oobCode');
        if (oobCode) {
          const resetUrl = `${window.location.origin}/reset-password?token=${oobCode}`;
          console.log('Reset link:', resetUrl);
          toast.success(
            `Lien de réinitialisation généré ! Consultez la console ou utilisez ce lien.\n${resetUrl}`,
            { duration: 10000 }
          );
        }
      } else {
        toast.success('Un email de réinitialisation a été envoyé si ce compte existe.');
      }

      setShowForgotPasswordModal(false);
      setResetEmail('');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la demande de réinitialisation.');
    } finally {
      setIsResettingPassword(false);
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

              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    analyticsService.trackModalOpen('Forgot Password');
                    setShowForgotPasswordModal(true);
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                analyticsService.trackButtonClick(isSignup ? 'Switch to Login' : 'Switch to Signup', 'Login Page');
                setIsSignup(!isSignup);
              }}
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

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0">
                <Mail className="h-6 w-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Mot de passe oublié ?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>
              </div>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="reset-email"
                  className="input"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="btn-primary w-full"
                >
                  {isResettingPassword ? 'Envoi en cours...' : 'Envoyer le lien'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    analyticsService.trackModalClose('Forgot Password');
                    setShowForgotPasswordModal(false);
                    setResetEmail('');
                  }}
                  disabled={isResettingPassword}
                  className="btn-secondary w-full"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
