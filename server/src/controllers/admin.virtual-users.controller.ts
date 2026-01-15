import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import { updateGlobalRankings } from '../services/playerPoints.service';

/**
 * Virtual Users Management Controller
 */

/**
 * Get all virtual users
 */
export const getAllVirtualUsers = async (req: Request, res: Response) => {
  try {
    // Get all users and filter by virtual email pattern
    const usersSnapshot = await adminDb.collection('users').get();

    // Filter virtual users by email pattern
    const virtualUserDocs = usersSnapshot.docs.filter((doc) => {
      const userData = doc.data();
      return userData.email && userData.email.endsWith('@virtual.tournoi.com');
    });

    const virtualUsers = await Promise.all(
      virtualUserDocs.map(async (doc) => {
        const userData = doc.data();

        // Find which teams this virtual user belongs to
        const teams: any[] = [];
        const eventsSnapshot = await adminDb.collection('events').get();

        for (const eventDoc of eventsSnapshot.docs) {
          const teamsSnapshot = await eventDoc.ref.collection('teams').get();

          for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();
            const members = teamData.members || [];

            if (members.some((m: any) => m.userId === doc.id)) {
              teams.push({
                teamId: teamDoc.id,
                teamName: teamData.name,
                tournamentId: eventDoc.id,
                tournamentName: eventDoc.data().name,
                isCaptain: teamData.captainId === doc.id,
              });
            }
          }
        }

        return convertTimestamps({
          id: doc.id,
          ...userData,
          teams,
        });
      })
    );

    res.json({
      success: true,
      data: { virtualUsers },
    });
  } catch (error) {
    console.error('Error getting virtual users:', error);
    throw new AppError('Error retrieving virtual users', 500);
  }
};

/**
 * Link virtual account to existing real account (admin operation)
 */
export const linkVirtualToRealUser = async (req: Request, res: Response) => {
  const { virtualUserId, realUserId } = req.body;

  if (!virtualUserId || !realUserId) {
    throw new AppError('Virtual user ID and real user ID are required', 400);
  }

  try {
    // Verify virtual user exists and is virtual
    const virtualUserDoc = await adminDb.collection('users').doc(virtualUserId).get();

    if (!virtualUserDoc.exists) {
      throw new AppError('Virtual user not found', 404);
    }

    const virtualUserData = virtualUserDoc.data();

    // Check if user is virtual by email pattern (consistent with getAllVirtualUsers)
    const isVirtualByEmail = virtualUserData?.email?.endsWith('@virtual.tournoi.com');
    const isVirtualByFlag = virtualUserData?.isVirtual;

    if (!isVirtualByEmail && !isVirtualByFlag) {
      throw new AppError('This is not a virtual account', 400);
    }

    // Verify real user exists and is not virtual
    const realUserDoc = await adminDb.collection('users').doc(realUserId).get();

    if (!realUserDoc.exists) {
      throw new AppError('Real user not found', 404);
    }

    const realUserData = realUserDoc.data();

    // Check if target is virtual (by email pattern or flag)
    const targetIsVirtualByEmail = realUserData?.email?.endsWith('@virtual.tournoi.com');
    const targetIsVirtualByFlag = realUserData?.isVirtual;

    if (targetIsVirtualByEmail || targetIsVirtualByFlag) {
      throw new AppError('Target user is also a virtual account', 400);
    }

    // Start batch operations
    const batch = adminDb.batch();

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
          // Check if real user is already in this team
          const realUserInTeam = members.some((m: any) => m.userId === realUserId);

          if (realUserInTeam) {
            // Real user already in team, just remove virtual user
            members.splice(memberIndex, 1);
          } else {
            // Replace virtual user with real user
            members[memberIndex] = {
              userId: realUserId,
              pseudo: realUserData.pseudo,
              level: realUserData.level,
            };
          }

          batch.update(teamDoc.ref, {
            members,
            updatedAt: new Date(),
          });

          // If virtual user was captain, transfer captainship
          if (teamData.captainId === virtualUserId) {
            batch.update(teamDoc.ref, {
              captainId: realUserId,
              captainPseudo: realUserData.pseudo,
              updatedAt: new Date(),
            });
          }
        }
      }

      // Handle unassigned players
      const unassignedRef = eventDoc.ref.collection('unassignedPlayers').doc(virtualUserId);
      const unassignedDoc = await unassignedRef.get();

      if (unassignedDoc.exists) {
        batch.delete(unassignedRef);

        // Check if real user is not already in unassigned
        const realUnassignedRef = eventDoc.ref.collection('unassignedPlayers').doc(realUserId);
        const realUnassignedDoc = await realUnassignedRef.get();

        if (!realUnassignedDoc.exists) {
          batch.set(realUnassignedRef, {
            userId: realUserId,
            pseudo: realUserData.pseudo,
            level: realUserData.level,
            updatedAt: new Date(),
          });
        }
      }
    }

    // Delete virtual user document
    batch.delete(adminDb.collection('users').doc(virtualUserId));

    // Commit all changes
    await batch.commit();

    // Transfer tournament points from virtual user to real user
    let pointsTransferred = 0;
    try {
      const virtualPointsSnapshot = await adminDb
        .collection('playerTournamentPoints')
        .doc(virtualUserId)
        .collection('tournaments')
        .get();

      if (!virtualPointsSnapshot.empty) {
        const pointsBatch = adminDb.batch();

        for (const pointsDoc of virtualPointsSnapshot.docs) {
          const pointsData = pointsDoc.data();

          // Transfer points to real user (update playerId and pseudo)
          const realPointsRef = adminDb
            .collection('playerTournamentPoints')
            .doc(realUserId)
            .collection('tournaments')
            .doc(pointsDoc.id);

          pointsBatch.set(realPointsRef, {
            ...pointsData,
            playerId: realUserId,
            playerPseudo: realUserData.pseudo,
          });

          // Delete old virtual user points
          pointsBatch.delete(pointsDoc.ref);
          pointsTransferred++;
        }

        await pointsBatch.commit();

        // Delete virtual user's playerTournamentPoints parent document if it exists
        await adminDb.collection('playerTournamentPoints').doc(virtualUserId).delete().catch(() => {
          // Ignore error if document doesn't exist
        });

        // Delete virtual user's global ranking if it exists
        await adminDb.collection('globalPlayerRanking').doc(virtualUserId).delete().catch(() => {
          // Ignore error if document doesn't exist
        });

        // Recalculate global ranking for the real user
        await updateGlobalRankings([realUserId]);
      }
    } catch (error) {
      console.error('Error transferring tournament points:', error);
      // Don't throw - the main linking operation succeeded
    }

    // Delete virtual user from Firebase Auth
    try {
      await adminAuth.deleteUser(virtualUserId);
    } catch (error) {
      console.warn('Failed to delete virtual user from Firebase Auth:', error);
    }

    res.json({
      success: true,
      message: `Virtual account successfully linked to real account. ${pointsTransferred} tournament points transferred.`,
    });
  } catch (error) {
    console.error('Error linking virtual to real user:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error linking virtual account', 500);
  }
};

/**
 * Delete a virtual user
 */
export const deleteVirtualUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    // Verify user exists and is virtual
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();

    // Check if user is virtual by email pattern or flag
    const isVirtualByEmail = userData?.email?.endsWith('@virtual.tournoi.com');
    const isVirtualByFlag = userData?.isVirtual;

    if (!isVirtualByEmail && !isVirtualByFlag) {
      throw new AppError('This is not a virtual account', 400);
    }

    const batch = adminDb.batch();

    // Remove virtual user from all teams
    const eventsSnapshot = await adminDb.collection('events').get();

    for (const eventDoc of eventsSnapshot.docs) {
      const teamsSnapshot = await eventDoc.ref.collection('teams').get();

      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const members = teamData.members || [];

        // Check if virtual user is in this team
        const memberIndex = members.findIndex((m: any) => m.userId === userId);

        if (memberIndex !== -1) {
          // Remove virtual user from team
          members.splice(memberIndex, 1);

          batch.update(teamDoc.ref, {
            members,
            updatedAt: new Date(),
          });

          // If virtual user was captain and there are remaining members, transfer captainship
          if (teamData.captainId === userId && members.length > 0) {
            batch.update(teamDoc.ref, {
              captainId: members[0].userId,
              captainPseudo: members[0].pseudo,
            });
          }
        }
      }

      // Remove from unassigned players
      const unassignedRef = eventDoc.ref.collection('unassignedPlayers').doc(userId);
      const unassignedDoc = await unassignedRef.get();

      if (unassignedDoc.exists) {
        batch.delete(unassignedRef);
      }
    }

    // Delete user document
    batch.delete(adminDb.collection('users').doc(userId));

    // Commit all changes
    await batch.commit();

    // Delete tournament points if any
    try {
      const pointsSnapshot = await adminDb
        .collection('playerTournamentPoints')
        .doc(userId)
        .collection('tournaments')
        .get();

      if (!pointsSnapshot.empty) {
        const pointsBatch = adminDb.batch();
        for (const pointsDoc of pointsSnapshot.docs) {
          pointsBatch.delete(pointsDoc.ref);
        }
        await pointsBatch.commit();
      }

      // Delete parent document
      await adminDb.collection('playerTournamentPoints').doc(userId).delete().catch(() => {});

      // Delete global ranking
      await adminDb.collection('globalPlayerRanking').doc(userId).delete().catch(() => {});
    } catch (error) {
      console.error('Error deleting tournament points:', error);
    }

    // Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(userId);
    } catch (error) {
      console.warn('Failed to delete virtual user from Firebase Auth:', error);
    }

    res.json({
      success: true,
      message: 'Virtual account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting virtual user:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting virtual account', 500);
  }
};
