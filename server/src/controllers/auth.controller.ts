import { Request, Response } from 'express';
import { adminAuth, adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { sendPasswordResetEmail } from '../services/email.service';
import type {
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';
  CreateUserDto,
  LoginCredentials,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  UserSession,
  User
} from '@shared/types';

/**
 * Firebase REST API response types
 */
interface FirebaseAuthResponse {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
}

interface FirebaseAuthError {
  error?: {
    message?: string;
  };
}

/**
 * Verify user credentials using Firebase REST API
 * Firebase Admin SDK cannot verify passwords directly, so we use the REST API
 */
async function verifyPassword(email: string, password: string): Promise<{ uid: string; email: string }> {
  const apiKey = process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY is not configured');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const data = await response.json() as FirebaseAuthResponse & FirebaseAuthError;

  if (!response.ok) {
    // Map Firebase error codes to our error messages
    const errorCode = data.error?.message || 'UNKNOWN_ERROR';
    throw { code: `auth/${errorCode.toLowerCase().replace(/_/g, '-')}`, message: errorCode };
  }

  return {
    uid: data.localId,
    email: data.email,
  };
}

/**
 * @desc    User signup
 * @route   POST /api/auth/signup
 * @access  Public
 */
export const signup = async (req: Request, res: Response) => {
  const { email, password, pseudo, level }: CreateUserDto = req.body;

  if (!email || !password || !pseudo || !level) {
    ErrorHandlers.validation('Tous les champs sont requis.');
  }

  try {
    // Check if a virtual account exists with this pseudo
    const usersSnapshot = await adminDb
      .collection('users')
      .where('pseudo', '==', pseudo)
      .where('isVirtual', '==', true)
      .limit(1)
      .get();

    if (!usersSnapshot.empty) {
      const virtualUser = usersSnapshot.docs[0];
      const virtualUserData = virtualUser.data();

      // Return information about the virtual account found
      return res.status(200).json({
        success: false,
        virtualAccountFound: true,
        message: `Un compte virtuel existe déjà avec le pseudo "${pseudo}". Vous pouvez récupérer ce compte ou choisir un autre pseudo.`,
        data: {
          virtualUserId: virtualUser.id,
          pseudo: virtualUserData.pseudo,
          level: virtualUserData.level,
        },
      });
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: pseudo,
    });

    // Save additional user info in Firestore
    const userData: Omit<User, 'uid'> = {
      pseudo,
      email,
      level,
      role: 'player',
      clubId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await adminDb.collection('users').doc(userRecord.uid).set(userData);

    // Create session
    const sessionUser: UserSession = {
      uid: userRecord.uid,
      email,
      pseudo,
      level,
      role: 'player',
    };

    req.session.user = sessionUser as any;

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: { user: sessionUser },
    });
  } catch (error) {
    let message = 'Erreur lors de l\'inscription.';
    if ((error as any).code === 'auth/email-already-exists') {
      message = 'Cet email est déjà utilisé.';
    } else if ((error as any).code === 'auth/invalid-email') {
      message = 'Format d\'email invalide.';
    } else if ((error as any).code === 'auth/weak-password') {
      message = 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    handleControllerError(error, 'during user signup', message, 400);
  }
};

/**
 * @desc    User login
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req: Request, res: Response) => {
  const { email, password }: LoginCredentials = req.body;

  if (!email || !password) {
    ErrorHandlers.validation('Email et mot de passe requis.');
  }

  try {
    // Verify user credentials using Firebase REST API (actually validates password)
    const verifiedUser = await verifyPassword(email, password);

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(verifiedUser.uid).get();

    if (!userDoc.exists) {
      ErrorHandlers.notFound('User data', verifiedUser.uid);
    }

    const userData = userDoc.data() as User;

    // Create session
    const sessionUser: UserSession = {
      uid: verifiedUser.uid,
      email: userData.email,
      pseudo: userData.pseudo,
      level: userData.level,
      role: userData.role,
    };

    req.session.user = sessionUser as any;

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: { user: sessionUser },
    });
  } catch (error) {
    let message = 'Email ou mot de passe incorrect.';
    if ((error as any).code === 'auth/user-not-found' || (error as any).code === 'auth/email-not-found') {
      message = 'Aucun compte associé à cet email.';
    } else if ((error as any).code === 'auth/invalid-email') {
      message = 'Format d\'email invalide.';
    } else if ((error as any).code === 'auth/invalid-password' || (error as any).code === 'auth/wrong-password' || (error as any).code === 'auth/invalid-login-credentials') {
      message = 'Email ou mot de passe incorrect.';
    } else if ((error as any).code === 'auth/too-many-requests') {
      message = 'Trop de tentatives de connexion. Veuillez réessayer plus tard.';
    } else if ((error as any).code === 'auth/user-disabled') {
      message = 'Ce compte a été désactivé.';
    }

    handleControllerError(error, 'during user login', message, 401);
  }
};

/**
 * @desc    User logout
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = async (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      handleControllerError(err, 'during user logout', 'Erreur lors de la déconnexion.');
    }

    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Déconnexion réussie',
    });
  });
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  if (!req.user) {
    ErrorHandlers.unauthorized('Non authentifié.');
  }

  res.json({
    success: true,
    data: { user: req.user },
  });
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword }: ChangePasswordDto = req.body;

  if (!req.user) {
    ErrorHandlers.unauthorized('Non authentifié.');
  }

  if (!currentPassword) {
    ErrorHandlers.validation('Le mot de passe actuel est requis.');
  }

  if (!newPassword || newPassword.length < 6) {
    ErrorHandlers.validation('Le nouveau mot de passe doit contenir au moins 6 caractères.');
  }

  try {
    // Verify current password before allowing change
    await verifyPassword(req.user.email, currentPassword);

    // Update password in Firebase Auth
    await adminAuth.updateUser(req.user.uid, {
      password: newPassword,
    });

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès',
    });
  } catch (error) {
    if ((error as any).code === 'auth/invalid-password' || (error as any).code === 'auth/wrong-password' || (error as any).code === 'auth/invalid-login-credentials') {
      handleControllerError(error, 'during password verification', 'Le mot de passe actuel est incorrect.', 400);
    }

    handleControllerError(error, 'during password change', 'Erreur lors de la modification du mot de passe.', 500);
  }
};

/**
 * @desc    Claim virtual account (convert virtual account to real account)
 * @route   POST /api/auth/claim-virtual-account
 * @access  Public
 */
export const claimVirtualAccount = async (req: Request, res: Response) => {
  const { email, password, pseudo, level, virtualUserId } = req.body;

  if (!email || !password || !pseudo || !level || !virtualUserId) {
    ErrorHandlers.validation('Tous les champs sont requis.');
  }

  try {
    // Verify the virtual user exists and is actually virtual
    const virtualUserDoc = await adminDb.collection('users').doc(virtualUserId).get();

    if (!virtualUserDoc.exists) {
      ErrorHandlers.notFound('Virtual account', virtualUserId);
    }

    const virtualUserData = virtualUserDoc.data();

    if (!virtualUserData?.isVirtual) {
      ErrorHandlers.validation('Ce compte n\'est pas un compte virtuel.');
    }

    if (virtualUserData.pseudo !== pseudo) {
      ErrorHandlers.validation('Le pseudo ne correspond pas au compte virtuel.');
    }

    // Create new real user in Firebase Auth
    const newUserRecord = await adminAuth.createUser({
      email,
      password,
      displayName: pseudo,
    });

    const newUserId = newUserRecord.uid;

    // Start batch operations
    const batch = adminDb.batch();

    // Create new user document (non-virtual)
    const newUserRef = adminDb.collection('users').doc(newUserId);
    batch.set(newUserRef, {
      pseudo,
      email,
      level,
      role: 'player',
      isVirtual: false,
      claimedFromVirtual: virtualUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update all teams that reference the virtual user
    const eventsSnapshot = await adminDb.collection('events').get();

    for (const eventDoc of eventsSnapshot.docs) {
      const teamsSnapshot = await eventDoc.ref.collection('teams').get();

      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const members = teamData.members || [];

        // Check if virtual user is in this team
        const memberIndex = members.findIndex((m: any) => m.userId === virtualUserId);

        if (memberIndex !== -1) {
          // Update member with new userId
          members[memberIndex].userId = newUserId;
          batch.update(teamDoc.ref, {
            members,
            updatedAt: new Date(),
          });

          // If virtual user was captain, update captainId
          if (teamData.captainId === virtualUserId) {
            batch.update(teamDoc.ref, {
              captainId: newUserId,
              updatedAt: new Date(),
            });
          }
        }
      }

      // Update unassigned players if present
      const unassignedRef = eventDoc.ref.collection('unassignedPlayers').doc(virtualUserId);
      const unassignedDoc = await unassignedRef.get();

      if (unassignedDoc.exists) {
        const unassignedData = unassignedDoc.data();
        batch.delete(unassignedRef);
        batch.set(
          eventDoc.ref.collection('unassignedPlayers').doc(newUserId),
          {
            ...unassignedData,
            userId: newUserId,
            updatedAt: new Date(),
          }
        );
      }
    }

    // Delete old virtual user document
    batch.delete(adminDb.collection('users').doc(virtualUserId));

    // Commit all changes
    await batch.commit();

    // Delete virtual user from Firebase Auth
    try {
      await adminAuth.deleteUser(virtualUserId);
    } catch (error) {
      console.warn('Failed to delete virtual user from Firebase Auth:', error);
      // Continue even if this fails, as Firestore data is already migrated
    }

    // Create session
    const sessionUser: UserSession = {
      uid: newUserId,
      email,
      pseudo,
      level,
      role: 'player',
    };

    req.session.user = sessionUser as any;

    res.status(201).json({
      success: true,
      message: 'Compte virtuel récupéré avec succès !',
      data: { user: sessionUser },
    });
  } catch (error) {
    let message = 'Erreur lors de la récupération du compte virtuel.';
    if ((error as any).code === 'auth/email-already-exists') {
      message = 'Cet email est déjà utilisé.';
    } else if ((error as any).code === 'auth/invalid-email') {
      message = 'Format d\'email invalide.';
    } else if ((error as any).code === 'auth/weak-password') {
      message = 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    handleControllerError(error, 'while claiming virtual account', message, 400);
  }
};

/**
 * @desc    Request password reset
 * @route   POST /api/auth/request-password-reset
 * @access  Public
 */
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email }: RequestPasswordResetDto = req.body;

  if (!email) {
    ErrorHandlers.validation('Email requis.');
  }

  try {
    // Verify user exists
    const userRecord = await adminAuth.getUserByEmail(email);

    // Generate password reset link
    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: process.env.CLIENT_URL || 'http://localhost:5173',
    });

    // Send password reset email via Brevo
    const emailSent = await sendPasswordResetEmail(email, resetLink);

    if (!emailSent) {
      console.error('Failed to send password reset email');
      // Don't throw error to avoid revealing if email exists
    }

    res.json({
      success: true,
      message: 'Un email de réinitialisation a été envoyé.',
    });
  } catch (error) {
    // Log error but don't reveal if user exists for security reasons
    console.error('Request password reset error:', error);

    // Always return success message
    res.json({
      success: true,
      message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
    });
  }
};

/**
 * @desc    Verify password reset token
 * @route   GET /api/auth/verify-reset-token/:token
 * @access  Public
 */
export const verifyPasswordResetToken = async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token) {
    ErrorHandlers.validation('Token requis.');
  }

  try {
    // Verify the reset link/token (using any cast as verifyPasswordResetCode is not in admin types)
    const email = await (adminAuth as any).verifyPasswordResetCode(token);

    res.json({
      success: true,
      message: 'Token valide.',
      data: { email },
    });
  } catch (error) {
    let message = 'Token invalide ou expiré.';
    if ((error as any).code === 'auth/expired-action-code') {
      message = 'Le lien de réinitialisation a expiré.';
    } else if ((error as any).code === 'auth/invalid-action-code') {
      message = 'Le lien de réinitialisation est invalide ou a déjà été utilisé.';
    }

    handleControllerError(error, 'while verifying password reset token', message, 400);
  }
};

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword }: ResetPasswordDto = req.body;

  if (!token || !newPassword) {
    ErrorHandlers.validation('Token et nouveau mot de passe requis.');
  }

  if (newPassword.length < 6) {
    ErrorHandlers.validation('Le mot de passe doit contenir au moins 6 caractères.');
  }

  try {
    // Verify the token and get the email (using any cast as verifyPasswordResetCode is not in admin types)
    const email = await (adminAuth as any).verifyPasswordResetCode(token);

    // Update the password
    const userRecord = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Revoke all refresh tokens to log out all sessions
    await adminAuth.revokeRefreshTokens(userRecord.uid);

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès.',
    });
  } catch (error) {
    let message = 'Erreur lors de la réinitialisation du mot de passe.';
    if ((error as any).code === 'auth/expired-action-code') {
      message = 'Le lien de réinitialisation a expiré.';
    } else if ((error as any).code === 'auth/invalid-action-code') {
      message = 'Le lien de réinitialisation est invalide ou a déjà été utilisé.';
    } else if ((error as any).code === 'auth/user-not-found') {
      message = 'Utilisateur introuvable.';
    }

    handleControllerError(error, 'while resetting password', message, 400);
  }
};
