import { calculateTournamentStatus } from '../utils/tournament.status.utils';

// Test case: Tournament with future registration opening date
const testTournament = {
  name: 'Test Tournament',
  date: new Date('2025-12-15T10:00:00'),
  maxTeams: 16,
  registrationStartDateTime: new Date('2025-12-09T20:00:00'),
  registrationEndDateTime: new Date('2025-12-14T23:59:00'),
  waitingListEnabled: false,
  waitingListSize: 0
};

console.log('=== DEBUG: Tournament Status Calculation ===');
console.log('Tournament:', testTournament.name);
console.log('Tournament Date:', testTournament.date);
console.log('Registration Start:', testTournament.registrationStartDateTime);
console.log('Registration End:', testTournament.registrationEndDateTime);
console.log('Current Date:', new Date());

const now = new Date();
const registrationStarts = testTournament.registrationStartDateTime
  ? new Date(testTournament.registrationStartDateTime)
  : new Date(0);
const registrationEnds = testTournament.registrationEndDateTime
  ? new Date(testTournament.registrationEndDateTime)
  : new Date(8640000000000000);

console.log('\n=== Intermediate Values ===');
console.log('now:', now);
console.log('registrationStarts:', registrationStarts);
console.log('registrationEnds:', registrationEnds);
console.log('now >= registrationStarts:', now >= registrationStarts);
console.log('now <= registrationEnds:', now <= registrationEnds);
console.log('now < registrationStarts:', now < registrationStarts);

const hasRegistrationDates =
  testTournament.registrationStartDateTime || testTournament.registrationEndDateTime;
console.log('hasRegistrationDates:', hasRegistrationDates);

const result = calculateTournamentStatus(
  testTournament,
  0, // completeTeamsCount
  0, // totalTeamsCount
  false, // hasMatches
  false // isRankingFrozen
);

console.log('\n=== Result ===');
console.log('Status:', result.status);
console.log('Message:', result.message);
console.log('registrationsAreOpen:', result.registrationsAreOpen);
