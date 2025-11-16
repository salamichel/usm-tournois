import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import type {
  CreateUserDto,
  LoginCredentials,
  ChangePasswordDto,
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
