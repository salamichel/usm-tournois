import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';

// TODO: Implement full tournament controller logic
// This is a stub implementation

export const getAllTournaments = async (req: Request, res: Response) => {
  const tournamentsSnapshot = await adminDb.collection('events').where('isActive', '==', true).get();
  const tournaments = tournamentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  res.json({
    success: true,
    data: { tournaments },
  });
};

export const getTournamentById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const tournamentDoc = await adminDb.collection('events').doc(id).get();

  if (!tournamentDoc.exists) {
    throw new AppError('Tournoi introuvable.', 404);
  }

  res.json({
    success: true,
    data: { tournament: { id: tournamentDoc.id, ...tournamentDoc.data() } },
  });
};

export const registerPlayer = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Player registered' });
};

export const registerTeam = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Team registered' });
};

export const unregisterTeam = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Team unregistered' });
};

export const leaveTournament = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Left tournament' });
};

export const joinTeam = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Joined team' });
};

export const leaveTeam = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Left team' });
};

export const createTeam = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Team created' });
};

export const joinWaitingList = async (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ success: true, message: 'Joined waiting list' });
};
