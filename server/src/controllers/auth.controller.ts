import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import type {
  CreateUserDto,
  LoginCredentials,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  UserSession,
  User
} from '@shared/types';

/**
 * @desc    User signup
 * @route   POST /api/auth/signup
 * @access  Public
 */
export const signup = async (req: Request, res: Response) => {
  const { email, password, pseudo, level }: CreateUserDto = req.body;

  if (!email || !password || !pseudo || !level) {
    throw new AppError('Tous les champs sont requis.', 400);
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
  } catch (error: any) {
    console.error('Signup error:', error);

    let message = 'Erreur lors de l\'inscription.';
    if (error.code === 'auth/email-already-exists') {
      message = 'Cet email est déjà utilisé.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Format d\'email invalide.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    throw new AppError(message, 400);
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
    throw new AppError('Email et mot de passe requis.', 400);
  }

  try {
    // Verify user exists
    const userRecord = await adminAuth.getUserByEmail(email);

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();

    if (!userDoc.exists) {
      throw new AppError('Données utilisateur introuvables.', 404);
    }

    const userData = userDoc.data() as User;

    // Create session
    const sessionUser: UserSession = {
      uid: userRecord.uid,
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
  } catch (error: any) {
    console.error('Login error:', error);

    let message = 'Email ou mot de passe incorrect.';
    if (error.code === 'auth/user-not-found') {
      message = 'Aucun compte associé à cet email.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Format d\'email invalide.';
    }

    throw new AppError(message, 401);
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
      console.error('Logout error:', err);
      throw new AppError('Erreur lors de la déconnexion.', 500);
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
    throw new AppError('Non authentifié.', 401);
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
    throw new AppError('Non authentifié.', 401);
  }

  if (!newPassword || newPassword.length < 6) {
    throw new AppError('Le nouveau mot de passe doit contenir au moins 6 caractères.', 400);
  }

  try {
    // Update password in Firebase Auth
    await adminAuth.updateUser(req.user.uid, {
      password: newPassword,
    });

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    throw new AppError('Erreur lors de la modification du mot de passe.', 500);
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
    throw new AppError('Tous les champs sont requis.', 400);
  }

  try {
    // Verify the virtual user exists and is actually virtual
    const virtualUserDoc = await adminDb.collection('users').doc(virtualUserId).get();

    if (!virtualUserDoc.exists) {
      throw new AppError('Compte virtuel introuvable.', 404);
    }

    const virtualUserData = virtualUserDoc.data();

    if (!virtualUserData?.isVirtual) {
      throw new AppError('Ce compte n\'est pas un compte virtuel.', 400);
    }

    if (virtualUserData.pseudo !== pseudo) {
      throw new AppError('Le pseudo ne correspond pas au compte virtuel.', 400);
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
  } catch (error: any) {
    console.error('Claim virtual account error:', error);

    if (error instanceof AppError) {
      throw error;
    }

    let message = 'Erreur lors de la récupération du compte virtuel.';
    if (error.code === 'auth/email-already-exists') {
      message = 'Cet email est déjà utilisé.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Format d\'email invalide.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    throw new AppError(message, 400);
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
    throw new AppError('Email requis.', 400);
  }

  try {
    // Verify user exists
    const userRecord = await adminAuth.getUserByEmail(email);

    // Generate password reset link
    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: process.env.CLIENT_URL || 'http://localhost:5173',
    });

    // In production, send email here using a service like SendGrid, Mailgun, etc.
    // For now, we'll return the link (in production, remove this and only send via email)

    res.json({
      success: true,
      message: 'Un email de réinitialisation a été envoyé.',
      // TODO: Remove this in production - only for development
      data: { resetLink },
    });
  } catch (error: any) {
    console.error('Request password reset error:', error);

    // Don't reveal if user exists or not for security reasons
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
    throw new AppError('Token requis.', 400);
  }

  try {
    // Verify the reset link/token
    const email = await adminAuth.verifyPasswordResetCode(token);

    res.json({
      success: true,
      message: 'Token valide.',
      data: { email },
    });
  } catch (error: any) {
    console.error('Verify reset token error:', error);

    let message = 'Token invalide ou expiré.';
    if (error.code === 'auth/expired-action-code') {
      message = 'Le lien de réinitialisation a expiré.';
    } else if (error.code === 'auth/invalid-action-code') {
      message = 'Le lien de réinitialisation est invalide ou a déjà été utilisé.';
    }

    throw new AppError(message, 400);
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
    throw new AppError('Token et nouveau mot de passe requis.', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('Le mot de passe doit contenir au moins 6 caractères.', 400);
  }

  try {
    // Verify the token and get the email
    const email = await adminAuth.verifyPasswordResetCode(token);

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
  } catch (error: any) {
    console.error('Reset password error:', error);

    let message = 'Erreur lors de la réinitialisation du mot de passe.';
    if (error.code === 'auth/expired-action-code') {
      message = 'Le lien de réinitialisation a expiré.';
    } else if (error.code === 'auth/invalid-action-code') {
      message = 'Le lien de réinitialisation est invalide ou a déjà été utilisé.';
    } else if (error.code === 'auth/user-not-found') {
      message = 'Utilisateur introuvable.';
    }

    throw new AppError(message, 400);
  }
};
