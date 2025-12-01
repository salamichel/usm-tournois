import { Timestamp } from 'firebase-admin/firestore';
import { calculateTournamentStatus } from '../utils/tournament.status.utils';

// Test avec Firestore Timestamps (comme les données qui viennent directement de la DB)
const futureDate = new Date('2025-12-09T20:00:00');
const tournamentDate = new Date('2025-12-15T10:00:00');
const endDate = new Date('2025-12-14T23:59:00');

const testTournamentWithTimestamp = {
  name: 'Test Tournament avec Timestamp',
  date: Timestamp.fromDate(tournamentDate),
  maxTeams: 16,
  registrationStartDateTime: Timestamp.fromDate(futureDate),
  registrationEndDateTime: Timestamp.fromDate(endDate),
  waitingListEnabled: false,
  waitingListSize: 0
};

console.log('=== TEST: Tournament avec Firestore Timestamps ===');
console.log('Date actuelle:', new Date());
console.log('Date d\'ouverture des inscriptions:', futureDate);
console.log('');

const result = calculateTournamentStatus(
  testTournamentWithTimestamp,
  0,
  0,
  false,
  false
);

console.log('Statut retourné:', result.status);
console.log('Message:', result.message);
console.log('Inscriptions ouvertes:', result.registrationsAreOpen);
console.log('');

if (result.status === 'Avenir') {
  console.log('✅ SUCCESS: Le statut "Avenir" est correctement appliqué!');
} else {
  console.log('❌ ÉCHEC: Le statut devrait être "Avenir" mais est:', result.status);
}

// Test avec des dates en string ISO (comme après conversion)
const testTournamentWithString = {
  name: 'Test Tournament avec String',
  date: tournamentDate.toISOString(),
  maxTeams: 16,
  registrationStartDateTime: futureDate.toISOString(),
  registrationEndDateTime: endDate.toISOString(),
  waitingListEnabled: false,
  waitingListSize: 0
};

console.log('\n=== TEST: Tournament avec dates String ISO ===');
const result2 = calculateTournamentStatus(
  testTournamentWithString,
  0,
  0,
  false,
  false
);

console.log('Statut retourné:', result2.status);
console.log('Message:', result2.message);

if (result2.status === 'Avenir') {
  console.log('✅ SUCCESS: Le statut "Avenir" fonctionne aussi avec les strings ISO!');
} else {
  console.log('❌ ÉCHEC: Le statut devrait être "Avenir" mais est:', result2.status);
}

// Test avec des dates dans le passé (inscriptions ouvertes)
const pastDate = new Date('2025-11-25T20:00:00');
const testTournamentOpen = {
  name: 'Test Tournament Ouvert',
  date: Timestamp.fromDate(tournamentDate),
  maxTeams: 16,
  registrationStartDateTime: Timestamp.fromDate(pastDate),
  registrationEndDateTime: Timestamp.fromDate(endDate),
  waitingListEnabled: false,
  waitingListSize: 0
};

console.log('\n=== TEST: Tournament avec inscriptions ouvertes ===');
console.log('Date d\'ouverture des inscriptions:', pastDate);
const result3 = calculateTournamentStatus(
  testTournamentOpen,
  0,
  0,
  false,
  false
);

console.log('Statut retourné:', result3.status);
console.log('Message:', result3.message);

if (result3.status === 'Ouvert') {
  console.log('✅ SUCCESS: Le statut "Ouvert" est correct pour un tournoi avec inscriptions ouvertes!');
} else {
  console.log('❌ ÉCHEC: Le statut devrait être "Ouvert" mais est:', result3.status);
}
