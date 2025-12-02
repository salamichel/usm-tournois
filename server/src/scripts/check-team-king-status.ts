/**
 * Quick diagnostic script to check Team King tournament status
 */
import { adminDb } from '../config/firebase.config';

const TOURNAMENT_ID = '4FRTzZfdMhoxtc1NBSEg'; // Your tournament ID

async function checkTeamKingStatus() {
  try {
    console.log('🔍 Checking Team King status...\n');

    // Check tournament
    const tournamentDoc = await adminDb.collection('events').doc(TOURNAMENT_ID).get();
    if (!tournamentDoc.exists) {
      console.log('❌ Tournament not found');
      return;
    }
    console.log('✅ Tournament exists:', tournamentDoc.data()?.name);
    console.log('   teamKingInitialized:', tournamentDoc.data()?.teamKingInitialized);

    // Check mainData document
    const mainDataDoc = await tournamentDoc.ref.collection('teamKing').doc('mainData').get();
    if (!mainDataDoc.exists) {
      console.log('\n❌ mainData document DOES NOT EXIST');
      console.log('   This is why the dashboard shows the initialization screen!');
      console.log('   You need to initialize Team King mode.');
    } else {
      console.log('\n✅ mainData document exists');
      const data = mainDataDoc.data();
      console.log('   gameMode:', data?.gameMode);
      console.log('   playersPerTeam:', data?.playersPerTeam);
      console.log('   currentPhaseNumber:', data?.currentPhaseNumber);
    }

    // Check phases
    const phasesSnapshot = await tournamentDoc.ref
      .collection('teamKing')
      .doc('mainData')
      .collection('phases')
      .get();

    console.log(`\n📊 Found ${phasesSnapshot.size} phases`);

    for (const phaseDoc of phasesSnapshot.docs) {
      const phaseData = phaseDoc.data();
      console.log(`\n  Phase ${phaseData.phaseNumber}:`);
      console.log(`    ID: ${phaseDoc.id}`);
      console.log(`    Status: ${phaseData.status}`);
      console.log(`    Teams: ${phaseData.participatingTeamIds?.length || 0}`);

      // Check pools
      const poolsSnapshot = await phaseDoc.ref.collection('pools').get();
      console.log(`    Pools: ${poolsSnapshot.size}`);

      for (const poolDoc of poolsSnapshot.docs) {
        const poolData = poolDoc.data();
        const matchesSnapshot = await poolDoc.ref.collection('matches').get();
        console.log(`      ${poolData.name}: ${poolData.teamCount} teams, ${matchesSnapshot.size} matches`);
      }
    }

    // Check teams
    const teamsSnapshot = await tournamentDoc.ref.collection('teams').get();
    console.log(`\n👥 Found ${teamsSnapshot.size} registered teams`);

  } catch (error) {
    console.error('Error checking status:', error);
  } finally {
    process.exit(0);
  }
}

checkTeamKingStatus();
