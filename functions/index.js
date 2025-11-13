const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * Fonction Cloud Firestore pour propager les résultats des matchs d'élimination.
 * Déclenchée lorsqu'un match éliminatoire est mis à jour.
 */
exports.propagateEliminationMatchResults = onDocumentUpdated(
  'events/{eventId}/eliminationMatches/{matchId}',
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const { eventId, matchId } = event.params;

    console.log(`[Cloud Function - propagateEliminationMatchResults] Déclenchée pour eventId: ${eventId}, matchId: ${matchId}`);
    console.log(`[Cloud Function] Statut avant: ${beforeData.status}, Statut après: ${afterData.status}`);

    // Vérifier si le match est passé au statut 'completed' et qu'il y a un vainqueur
    if (beforeData.status !== 'completed' && afterData.status === 'completed' && afterData.winnerId) {
      console.log(`[Cloud Function] Match ${matchId} terminé. Propagation des résultats...`);

      const winnerId = afterData.winnerId;
      const winnerName = afterData.winnerName;
      const loserId = afterData.loserId;
      const loserName = afterData.loserName;

      const batch = db.batch();

      // Logique de propagation pour les quarts de finale (vers les demi-finales)
      if (afterData.nextMatchId && afterData.nextMatchTeamSlot) {
        const nextMatchRef = db.collection('events').doc(eventId).collection('eliminationMatches').doc(afterData.nextMatchId);
        const nextMatchDoc = await nextMatchRef.get();

        if (nextMatchDoc.exists) {
          const teamSlot = afterData.nextMatchTeamSlot;
          const updateObject = {};
          updateObject[`${teamSlot}.id`] = winnerId;
          updateObject[`${teamSlot}.name`] = winnerName;
          console.log(`[Cloud Function] Propagating winner (QF) to next match: ${afterData.nextMatchId}, slot: ${teamSlot}, update object:`, updateObject);
          batch.update(nextMatchRef, updateObject);
        } else {
          console.log(`[Cloud Function] Next match (QF) ${afterData.nextMatchId} not found.`);
        }
      }

      // Logique de propagation pour les demi-finales (vers la finale et le match 3ème place)
      if (afterData.nextMatchWinnerId && afterData.nextMatchWinnerTeamSlot) {
        const nextMatchRef = db.collection('events').doc(eventId).collection('eliminationMatches').doc(afterData.nextMatchWinnerId);
        const nextMatchDoc = await nextMatchRef.get();

        if (nextMatchDoc.exists) {
          const teamSlot = afterData.nextMatchWinnerTeamSlot;
          const updateWinnerObject = {};
          updateWinnerObject[`${teamSlot}.id`] = winnerId;
          updateWinnerObject[`${teamSlot}.name`] = winnerName;
          console.log(`[Cloud Function] Propagating winner (DF/Final) to next match: ${afterData.nextMatchWinnerId}, slot: ${teamSlot}, update object:`, updateWinnerObject);
          batch.update(nextMatchRef, updateWinnerObject);
        } else {
          console.log(`[Cloud Function] Next match (DF/Final) ${afterData.nextMatchWinnerId} not found.`);
        }
      }

      // Propager le perdant (pour le match de la 3ème place)
      if (afterData.nextMatchLoserId && afterData.nextMatchLoserTeamSlot) {
        const nextMatchRef = db.collection('events').doc(eventId).collection('eliminationMatches').doc(afterData.nextMatchLoserId);
        const nextMatchDoc = await nextMatchRef.get();

        if (nextMatchDoc.exists) {
          const teamSlot = afterData.nextMatchLoserTeamSlot;
          const updateLoserObject = {};
          updateLoserObject[`${teamSlot}.id`] = loserId;
          updateLoserObject[`${teamSlot}.name`] = loserName;
          console.log(`[Cloud Function] Propagating loser to next match: ${afterData.nextMatchLoserId}, slot: ${teamSlot}, update object:`, updateLoserObject);
          batch.update(nextMatchRef, updateLoserObject);
        } else {
          console.log(`[Cloud Function] Next match (3rd Place) ${afterData.nextMatchLoserId} not found.`);
        }
      }

      await batch.commit();
      console.log(`[Cloud Function] Propagation des résultats terminée pour matchId: ${matchId}.`);
    } else {
      console.log(`[Cloud Function] Match ${matchId} non terminé ou pas de vainqueur. Aucune propagation nécessaire.`);
    }

    return null;
  },
);
