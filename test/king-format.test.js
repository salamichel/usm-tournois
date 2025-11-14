/**
 * @fileoverview Tests pour vérifier l'implémentation du format King 4v4→3v3→2v2
 * VERSION CORRIGÉE - Syntaxe JavaScript valide
 */

const kingService = require('../services/king.service');

// ========================================
// UTILITAIRES DE TEST
// ========================================

function generateDummyPlayers(count) {
    const players = [];
    for (let i = 0; i < count; i++) {
        players.push({
            id: `player-${i + 1}`,
            name: `Joueur ${i + 1}`
        });
    }
    return players;
}

function generateDummyTournament() {
    return {
        fields: 3,
        phase1TeamsPerPool: 3,
        phase1TeamSize: 4,
        phase1NumRoundsPerPool: 3
    };
}

// ========================================
// TEST 1: Phase 1 (4v4)
// ========================================

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║ TEST 1: Phase 1 (4v4) - FILTRAGE                              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const players36 = generateDummyPlayers(36);
const tournament = generateDummyTournament();

const phase1 = kingService.generatePhase1(players36, tournament);

// Vérifications Phase 1
const tests1 = {
    '✓ Phase 1 générée': phase1 !== null,
    '✓ Nombre de poules = 3': phase1.pools.length === 3,
    '✓ Joueurs par poule = 12': phase1.pools.every(p => p.players.length === 12),
    '✓ Nombre total de matchs = 27': phase1.allMatches.length === 27,
    '✓ Chaque poule a 9 matchs': phase1.pools.every(p => p.matches.length === 9),
    '✓ Format des matchs = 4v4': phase1.allMatches.every(m => m.format === '4v4'),
    '✓ Statut initial = pending': phase1.allMatches.every(m => m.status === 'pending'),
    '✓ Chaque poule a 3 tournées': phase1.pools.every(p => {
        const tours = new Set(p.matches.map(m => m.round));
        return tours.size === 3;
    })
};

console.log('Résultats:');
Object.entries(tests1).forEach(entry => {
    const test = entry[0];
    const result = entry[1];
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
});

let phase1Passed = Object.values(tests1).every(v => v === true);
console.log(`\n${phase1Passed ? '✅ PHASE 1 OK' : '❌ PHASE 1 ÉCHOUÉE'}\n`);

// Détails Phase 1
console.log('Détails Phase 1:');
phase1.pools.forEach((pool, idx) => {
    const matchesPerRound = {};
    pool.matches.forEach(m => {
        const round = m.round;
        matchesPerRound[round] = (matchesPerRound[round] || 0) + 1;
    });
    console.log(`  Poule ${String.fromCharCode(65 + idx)}: ${pool.players.length} joueurs, ${pool.matches.length} matchs`);
    Object.entries(matchesPerRound).forEach(entry => {
        const round = entry[0];
        const count = entry[1];
        console.log(`    - ${round}: ${count} matchs`);
    });
});

// ========================================
// TEST 2: Qualification Phase 1 → Phase 2
// ========================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║ TEST 2: Qualification Phase 1 → Phase 2                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Simuler des résultats de matchs pour Phase 1
const phase1MatchesWithResults = phase1.allMatches.map((match, idx) => ({
    ...match,
    status: 'completed',
    winnerTeam: idx % 2 === 0 ? match.team1 : match.team2,
    setsWonTeam1: idx % 2 === 0 ? 2 : 1,
    setsWonTeam2: idx % 2 === 0 ? 1 : 2
}));

// Calculer les qualifiés
const qualifiers = kingService.getPhase1Qualifiers(phase1.pools, phase1MatchesWithResults, 4);

const tests2 = {
    '✓ Nombre de qualifiés = 12': qualifiers.length === 12,
    '✓ Qualifiés distincts': new Set(qualifiers.map(q => q.id)).size === 12
};

console.log('Résultats:');
Object.entries(tests2).forEach(entry => {
    const test = entry[0];
    const result = entry[1];
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
});

let phase1QualPassed = Object.values(tests2).every(v => v === true);
console.log(`\n${phase1QualPassed ? '✅ QUALIFICATION PHASE 1 OK' : '❌ QUALIFICATION ÉCHOUÉE'}\n`);

console.log('Classement Phase 1 (Top 5):');
qualifiers.slice(0, 5).forEach((q, idx) => {
    console.log(`  ${idx + 1}. ${q.name} (${q.wins} victoires, ${q.matchesPlayed} matchs)`);
});
console.log(`  ...\n`);

// ========================================
// TEST 3: Phase 2 (3v3)
// ========================================

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║ TEST 3: Phase 2 (3v3) - SÉLECTION                             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const phase2 = kingService.generatePhase2(qualifiers, tournament);

const tests3 = {
    '✓ Phase 2 générée': phase2 !== null,
    '✓ Nombre de poules = 2': phase2.pools.length === 2,
    '✓ Joueurs par poule = 6': phase2.pools.every(p => p.players.length === 6),
    '✓ Nombre total de matchs = 10': phase2.allMatches.length === 10,
    '✓ Chaque poule a 5 matchs': phase2.pools.every(p => p.matches.length === 5),
    '✓ Format des matchs = 3v3': phase2.allMatches.every(m => m.format === '3v3'),
    '✓ Statut initial = pending': phase2.allMatches.every(m => m.status === 'pending'),
    '✓ Chaque équipe a 3 membres': phase2.allMatches.every(m =>
        m.team1.members.length === 3 && m.team2.members.length === 3
    )
};

console.log('Résultats:');
Object.entries(tests3).forEach(entry => {
    const test = entry[0];
    const result = entry[1];
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
});

let phase2Passed = Object.values(tests3).every(v => v === true);
console.log(`\n${phase2Passed ? '✅ PHASE 2 OK' : '❌ PHASE 2 ÉCHOUÉE'}\n`);

console.log('Détails Phase 2:');
phase2.pools.forEach((pool, idx) => {
    console.log(`  Poule ${String.fromCharCode(68 + idx)}: ${pool.players.length} joueurs, ${pool.matches.length} matchs (KOB)`);
});

// ========================================
// TEST 4: Qualification Phase 2 → Phase 3
// ========================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║ TEST 4: Qualification Phase 2 → Phase 3                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const phase2MatchesWithResults = phase2.allMatches.map((match, idx) => ({
    ...match,
    status: 'completed',
    winnerTeam: idx % 2 === 0 ? match.team1 : match.team2,
    setsWonTeam1: idx % 2 === 0 ? 2 : 1,
    setsWonTeam2: idx % 2 === 0 ? 1 : 2
}));

const finalists = kingService.getPhase2Qualifiers(phase2.pools, phase2MatchesWithResults, 4);

const tests4 = {
    '✓ Nombre de finalistes = 8': finalists.length === 8,
    '✓ Finalistes distincts': new Set(finalists.map(f => f.id)).size === 8
};

console.log('Résultats:');
Object.entries(tests4).forEach(entry => {
    const test = entry[0];
    const result = entry[1];
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
});

let phase2QualPassed = Object.values(tests4).every(v => v === true);
console.log(`\n${phase2QualPassed ? '✅ QUALIFICATION PHASE 2 OK' : '❌ QUALIFICATION ÉCHOUÉE'}\n`);

console.log('Finalistes:');
finalists.slice(0, 8).forEach((f, idx) => {
    console.log(`  ${idx + 1}. ${f.name} (${f.wins} victoires)`);
});

// ========================================
// TEST 5: Phase 3 (2v2)
// ========================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║ TEST 5: Phase 3 (2v2) - FINALE KING                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const phase3 = kingService.generatePhase3(finalists, tournament);

const tests5 = {
    '✓ Phase 3 générée': phase3 !== null,
    '✓ Nombre de poules = 1': phase3.pools.length === 1,
    '✓ Joueurs dans la finale = 8': phase3.pools[0].players.length === 8,
    '✓ Nombre total de matchs = 14': phase3.allMatches.length === 14,
    '✓ Nombre de tours = 7': new Set(phase3.allMatches.map(m => m.round)).size === 7,
    '✓ Format des matchs = 2v2': phase3.allMatches.every(m => m.format === '2v2'),
    '✓ Chaque équipe a 2 membres': phase3.allMatches.every(m =>
        m.team1.members.length === 2 && m.team2.members.length === 2
    )
};

console.log('Résultats:');
Object.entries(tests5).forEach(entry => {
    const test = entry[0];
    const result = entry[1];
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
});

let phase3Passed = Object.values(tests5).every(v => v === true);
console.log(`\n${phase3Passed ? '✅ PHASE 3 OK' : '❌ PHASE 3 ÉCHOUÉE'}\n`);

console.log('Détails Phase 3 (KOB 2v2):');
for (let i = 1; i <= 7; i++) {
    const tourMatches = phase3.allMatches.filter(m => m.round === `Phase Finale - Tour ${i}`);
    console.log(`  Tour ${i}: ${tourMatches.length} matchs`);
}

// ========================================
// TEST 6: Classement & Rankings
// ========================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║ TEST 6: Classement & Rankings                                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const phase3MatchesWithResults = phase3.allMatches.map((match, idx) => ({
    ...match,
    status: 'completed',
    winnerTeam: idx % 2 === 0 ? match.team1 : match.team2,
    setsWonTeam1: idx % 2 === 0 ? 2 : 1,
    setsWonTeam2: idx % 2 === 0 ? 1 : 2
}));

const finalRanking = kingService.calculateKingRanking(phase3MatchesWithResults);

const tests6 = {
    '✓ Ranking calculé': finalRanking.length > 0,
    '✓ 8 joueurs dans le ranking': finalRanking.length === 8
};

console.log('Résultats:');
Object.entries(tests6).forEach(entry => {
    const test = entry[0];
    const result = entry[1];
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
});

console.log('\nClassement Final (Phase 3):');
finalRanking.forEach((player, idx) => {
    console.log(`  ${idx + 1}. 👑 ${player.name}: ${player.wins} victoires, ${player.matchesPlayed} matchs`);
});

const kingWinner = finalRanking[0];
console.log(`\n🏆 KING: ${kingWinner.name} avec ${kingWinner.wins} victoires!\n`);

// ========================================
// RÉSUMÉ FINAL
// ========================================

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║ RÉSUMÉ FINAL                                                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const allPassed = phase1Passed && phase1QualPassed && phase2Passed && phase2QualPassed && phase3Passed;

console.log(`📊 Statistiques:
  • Phase 1: 36 joueurs → 27 matchs → 12 qualifiés
  • Phase 2: 12 joueurs → 10 matchs → 8 qualifiés
  • Phase 3: 8 joueurs → 14 matchs → 1 KING
  • TOTAL: 51 matchs

${allPassed ? '✅ TOUS LES TESTS PASSÉS!' : '❌ CERTAINS TESTS ONT ÉCHOUÉ'}`);

console.log('\n' + (allPassed ? '🎉 Implémentation du format 4v4→3v3→2v2 VALIDÉE!' : '⚠️  Vérifier les erreurs ci-dessus'));
console.log('\n');