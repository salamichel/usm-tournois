import { Request, Response } from 'express';

// TODO: Implement full user controller logic

export const getUserDashboard = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Get user dashboard - TODO' });
};

export const getUserProfile = async (req: Request, res: Response) => {
  res.json({ success: true, data: { user: req.user } });
};

export const updateUserProfile = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Update user profile - TODO' });
};
