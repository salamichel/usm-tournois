/**
 * Utility functions for managing unassigned players synchronization with teams
 */

import { adminDb } from '../config/firebase.config';
import type { TeamMember } from '@shared/types';

/**
 * Remove players from unassigned list when they join a team
 * @param tournamentId Tournament ID
 * @param members Array of team members to remove from unassigned
 * @param batch Optional Firestore batch for atomic operations
 */
export async function removePlayersFromUnassigned(
  tournamentId: string,
  members: TeamMember[],
  batch?: FirebaseFirestore.WriteBatch
): Promise<void> {
  const useBatch = batch || adminDb.batch();
  const shouldCommit = !batch; // Only commit if we created the batch ourselves

  for (const member of members) {
    // Skip virtual players if they don't have a real userId
    const playerId = member.userId || member.id;
    if (!playerId) continue;

    const unassignedRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(playerId);

    useBatch.delete(unassignedRef);
  }

  if (shouldCommit) {
    await useBatch.commit();
  }
}

/**
 * Add players back to unassigned list when they leave a team
 * @param tournamentId Tournament ID
 * @param members Array of team members to add back to unassigned
 * @param batch Optional Firestore batch for atomic operations
 */
export async function addPlayersToUnassigned(
  tournamentId: string,
  members: TeamMember[],
  batch?: FirebaseFirestore.WriteBatch
): Promise<void> {
  const useBatch = batch || adminDb.batch();
  const shouldCommit = !batch;

  for (const member of members) {
    const playerId = member.userId || member.id;
    if (!playerId) continue;

    // Fetch user data to get complete information
    let playerData: any = {
      userId: playerId,
      pseudo: member.pseudo || 'Unknown',
      level: member.level || 'N/A',
      isVirtual: member.isVirtual || false,
    };

    // Try to fetch more complete data from users collection (if not virtual)
    if (!member.isVirtual) {
      try {
        const userDoc = await adminDb.collection('users').doc(playerId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          playerData = {
            userId: playerId,
            pseudo: userData?.pseudo || member.pseudo || 'Unknown',
            level: userData?.level || member.level || 'N/A',
            sexe: userData?.sexe,
            email: userData?.email,
            isVirtual: false,
          };
        }
      } catch (err) {
        console.warn(`Could not fetch user data for ${playerId}, using member data`);
      }
    }

    const unassignedRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(playerId);

    useBatch.set(unassignedRef, {
      ...playerData,
      registeredAt: new Date(),
    });
  }

  if (shouldCommit) {
    await useBatch.commit();
  }
}

/**
 * Synchronize unassigned players when team members are updated
 * Compares old members vs new members and:
 * - Removes newly added members from unassigned
 * - Adds removed members back to unassigned
 * @param tournamentId Tournament ID
 * @param oldMembers Previous team members
 * @param newMembers New team members
 * @param batch Optional Firestore batch for atomic operations
 */
export async function syncUnassignedPlayersOnUpdate(
  tournamentId: string,
  oldMembers: TeamMember[],
  newMembers: TeamMember[],
  batch?: FirebaseFirestore.WriteBatch
): Promise<void> {
  const useBatch = batch || adminDb.batch();
  const shouldCommit = !batch;

  // Create sets of user IDs for comparison
  const oldMemberIds = new Set(oldMembers.map(m => m.userId || m.id).filter(Boolean));
  const newMemberIds = new Set(newMembers.map(m => m.userId || m.id).filter(Boolean));

  // Find added members (in new but not in old)
  const addedMembers = newMembers.filter(m => {
    const id = m.userId || m.id;
    return id && !oldMemberIds.has(id);
  });

  // Find removed members (in old but not in new)
  const removedMembers = oldMembers.filter(m => {
    const id = m.userId || m.id;
    return id && !newMemberIds.has(id);
  });

  // Remove added members from unassigned
  if (addedMembers.length > 0) {
    await removePlayersFromUnassigned(tournamentId, addedMembers, useBatch);
  }

  // Add removed members back to unassigned
  if (removedMembers.length > 0) {
    await addPlayersToUnassigned(tournamentId, removedMembers, useBatch);
  }

  if (shouldCommit) {
    await useBatch.commit();
  }
}
