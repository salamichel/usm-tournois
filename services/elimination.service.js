/**
 * Calcule la structure d'un tableau d'élimination directe pour un nombre donné d'équipes.
 * Détermine le nombre de byes, le nombre de matchs préliminaires et la taille du tableau final.
 * @param {number} numberOfTeams Le nombre total d'équipes qualifiées.
 * @returns {object} Un objet contenant { totalSlots, byes, preliminaryMatches, mainBracketSize, firstMainRoundName }.
 */
function calculateBracketStructure(numberOfTeams) {
    if (numberOfTeams < 2) {
        throw new Error("Au moins 2 équipes sont nécessaires pour un tournoi à élimination.");
    }

    // Trouver la puissance de 2 supérieure ou égale au nombre d'équipes
    let totalSlots = 2;
    while (totalSlots < numberOfTeams) {
        totalSlots *= 2;
    }

    const byes = totalSlots - numberOfTeams;
    const teamsPlayingPreliminary = numberOfTeams - byes;
    const preliminaryMatches = teamsPlayingPreliminary / 2;
    const mainBracketSize = totalSlots / 2; // Nombre d'équipes dans le premier tour du bracket principal

    // Déterminer le nom du premier tour principal
    let firstMainRoundName;
    if (mainBracketSize === 2) {
        firstMainRoundName = 'Finale';
    } else if (mainBracketSize === 4) {
        firstMainRoundName = 'Demi-finale';
    } else if (mainBracketSize === 8) {
        firstMainRoundName = 'Quart de finale';
    } else if (mainBracketSize === 16) {
        firstMainRoundName = 'Huitième de finale';
    } else if (mainBracketSize === 32) {
        firstMainRoundName = 'Seizième de finale';
    } else {
        firstMainRoundName = `Tour de ${mainBracketSize}`;
    }

    return { 
        totalSlots, 
        byes, 
        preliminaryMatches, 
        mainBracketSize, 
        firstMainRoundName,
        teamsPlayingPreliminary
    };
}

/**
 * Génère un tableau d'élimination directe avec des placeholders pour les équipes et les liens entre les matchs.
 * @param {Array<object>} qualifiedTeams Les équipes qualifiées, triées par classement (meilleure en première position).
 * @param {object} tournamentConfig Configuration du tournoi (setsPerMatchElimination, pointsPerSetElimination, tieBreakEnabledElimination).
 * @returns {Array<object>} Un tableau d'objets match prêts à être sauvegardés.
 */
function generateEliminationBracket(qualifiedTeams, tournamentConfig) {
    console.log('Début de generateEliminationBracket');
    console.log(`Équipes qualifiées (${qualifiedTeams.length}):`, qualifiedTeams.map(t => t.name));
    console.log('Configuration du tournoi:', tournamentConfig);

    const numberOfTeams = qualifiedTeams.length;
    const { byes, preliminaryMatches, mainBracketSize, firstMainRoundName, teamsPlayingPreliminary } = calculateBracketStructure(numberOfTeams);

    console.log(`Structure du bracket calculée: Total Slots=${numberOfTeams}, Byes=${byes}, Preliminary Matches=${preliminaryMatches}, Main Bracket Size=${mainBracketSize}, First Main Round Name='${firstMainRoundName}'`);

    const matches = [];
    let matchNumberCounter = 1;
    const initialSets = Array.from({ length: tournamentConfig.setsPerMatchElimination || 3 }, () => ({ score1: null, score2: null }));

    // 1. Générer les matchs préliminaires si nécessaire
    const preliminaryMatchRefs = [];
    
    if (preliminaryMatches > 0) {
                // Les équipes jouant les matchs préliminaires sont les dernières du classement
        // Pour 9 équipes : équipes 8 et 9
        // Pour 10 équipes : équipes 7, 8, 9, 10
        // Pour 11 équipes : équipes 6, 7, 8, 9, 10, 11
        // Pour 12 équipes : équipes 5, 6, 7, 8, 9, 10, 11, 12

        console.log(`Génération de ${preliminaryMatches} matchs préliminaires.`);
        const startIndex = byes;
        for (let i = 0; i < preliminaryMatches; i++) {
            const team1Index = startIndex + i;
            const team2Index = numberOfTeams - 1 - i; // Dernières équipes
            
            const team1 = qualifiedTeams[team1Index];
            const team2 = qualifiedTeams[team2Index];

            const matchRefId = `preliminary-${matchNumberCounter}`;
            preliminaryMatchRefs.push({ 
                id: matchRefId, 
                matchNumber: matchNumberCounter,
                team1Index,
                team2Index
            });

            matches.push({
                id: matchRefId,
                matchNumber: matchNumberCounter++,
                round: 'Tour Préliminaire',
                team1: { 
                    id: team1.id, 
                    name: team1.name, 
                    poolName: team1.poolName 
                },
                team2: { 
                    id: team2.id, 
                    name: team2.name, 
                    poolName: team2.poolName 
                },
                sets: JSON.parse(JSON.stringify(initialSets)),
                status: 'scheduled',
                type: 'elimination',
                setsToWin: tournamentConfig.setsPerMatchElimination,
                pointsPerSet: tournamentConfig.pointsPerSetElimination,
                tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`Match préliminaire créé: M${matchRefId} entre ${team1.name} et ${team2.name}`);
        }
    } else {
        console.log('Aucun match préliminaire nécessaire.');
    }

    // 2. Préparer les équipes pour le bracket principal
    // Les équipes avec bye + les vainqueurs des matchs préliminaires
    const teamsForMainBracket = [];
    
    // Les équipes avec bye (les meilleures)
    for (let i = 0; i < byes; i++) {
        teamsForMainBracket.push({
            type: 'direct',
            team: qualifiedTeams[i]
        });
        console.log(`Équipe avec bye ajoutée au bracket principal: ${qualifiedTeams[i].name}`);
    }
    
    // Les vainqueurs des matchs préliminaires
    for (let i = 0; i < preliminaryMatchRefs.length; i++) {
        teamsForMainBracket.push({
            type: 'preliminary',
            sourceMatchId: preliminaryMatchRefs[i].id,
            sourceMatchNumber: preliminaryMatchRefs[i].matchNumber
        });
        console.log(`Vainqueur du match préliminaire M${preliminaryMatchRefs[i].matchNumber} ajouté au bracket principal.`);
    }
    console.log(`Nombre total d'équipes pour le bracket principal: ${teamsForMainBracket.length}`);

    // 3. Générer les matchs du premier tour du bracket principal
    // Placement stratégique : les meilleures équipes sont séparées
    // Pour un placement équilibré, on utilise un pattern classique de bracket
    const mainBracketMatches = [];
    const numMainBracketMatches = mainBracketSize / 2;
    console.log(`Génération de ${numMainBracketMatches} matchs pour le premier tour principal (${firstMainRoundName}).`);

    for (let i = 0; i < numMainBracketMatches; i++) {
        // Pattern de placement : 1 vs dernier, 2 vs avant-dernier, etc.
        const team1Data = teamsForMainBracket[i];
        const team2Data = teamsForMainBracket[mainBracketSize - 1 - i];

        const matchRefId = `main-${matchNumberCounter}`;
        mainBracketMatches.push({ 
            id: matchRefId, 
            matchNumber: matchNumberCounter 
        });

        // Construire team1
        let team1;
        if (team1Data.type === 'direct') {
            team1 = {
                id: team1Data.team.id,
                name: team1Data.team.name,
                poolName: team1Data.team.poolName
            };
        } else {
            team1 = {
                id: null,
                name: `Vainqueur P${team1Data.sourceMatchNumber}`,
                sourceMatchId: team1Data.sourceMatchId,
                sourceTeamType: 'winner'
            };
        }

        // Construire team2
        let team2;
        if (team2Data.type === 'direct') {
            team2 = {
                id: team2Data.team.id,
                name: team2Data.team.name,
                poolName: team2Data.team.poolName
            };
        } else {
            team2 = {
                id: null,
                name: `Vainqueur P${team2Data.sourceMatchNumber}`,
                sourceMatchId: team2Data.sourceMatchId,
                sourceTeamType: 'winner'
            };
        }

        matches.push({
            id: matchRefId,
            matchNumber: matchNumberCounter++,
            round: firstMainRoundName,
            team1: team1,
            team2: team2,
            sets: JSON.parse(JSON.stringify(initialSets)),
            status: 'scheduled',
            type: 'elimination',
            setsToWin: tournamentConfig.setsPerMatchElimination,
            pointsPerSet: tournamentConfig.pointsPerSetElimination,
            tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log(`Match principal créé: M${matchRefId} (${firstMainRoundName}) entre ${team1.name} et ${team2.name}`);
    }

    // 4. Mettre à jour les matchs préliminaires avec nextMatchId
    console.log('Mise à jour des matchs préliminaires avec nextMatchId.');
    for (let i = 0; i < preliminaryMatchRefs.length; i++) {
        const prelimMatch = preliminaryMatchRefs[i];
        
        // Trouver le match principal qui attend ce vainqueur
        const targetMainMatchIndex = matches.findIndex(m => {
            if (m.round !== firstMainRoundName) return false;
            return (m.team1?.sourceMatchId === prelimMatch.id) || 
                   (m.team2?.sourceMatchId === prelimMatch.id);
        });

        if (targetMainMatchIndex !== -1) {
            const prelimMatchIndex = matches.findIndex(m => m.id === prelimMatch.id);
            if (prelimMatchIndex !== -1) {
                matches[prelimMatchIndex].nextMatchId = matches[targetMainMatchIndex].id;
                
                // Déterminer si le vainqueur va en team1 ou team2
                if (matches[targetMainMatchIndex].team1?.sourceMatchId === prelimMatch.id) {
                    matches[prelimMatchIndex].nextMatchTeamSlot = 'team1';
                } else {
                    matches[prelimMatchIndex].nextMatchTeamSlot = 'team2';
                }
                console.log(`Match préliminaire M${prelimMatch.matchNumber} lié au match principal M${matches[targetMainMatchIndex].matchNumber} (slot: ${matches[prelimMatchIndex].nextMatchTeamSlot}).`);
            }
        }
    }

    // 5. Générer les tours suivants (Demi-finales, Finale, etc.)
    let previousRoundMatches = mainBracketMatches;
    let currentRoundName = firstMainRoundName;
    console.log('Génération des tours suivants...');

    while (previousRoundMatches.length > 1) {
        const nextRoundMatches = [];
        let nextRoundName;

        // Déterminer le nom du tour suivant
        if (currentRoundName === 'Seizième de finale') {
            nextRoundName = 'Huitième de finale';
        } else if (currentRoundName === 'Huitième de finale') {
            nextRoundName = 'Quart de finale';
        } else if (currentRoundName === 'Quart de finale') {
            nextRoundName = 'Demi-finale';
        } else if (currentRoundName === 'Demi-finale') {
            nextRoundName = 'Finale';
        } else {
            console.log('Fin de la génération des tours (atteint la finale ou un tour non géré).');
            break;
        }
        console.log(`Génération de ${previousRoundMatches.length / 2} matchs pour le tour: ${nextRoundName}`);

        // Créer les matchs du tour suivant
        for (let i = 0; i < previousRoundMatches.length / 2; i++) {
            const sourceMatch1 = previousRoundMatches[i * 2];
            const sourceMatch2 = previousRoundMatches[i * 2 + 1];

            const matchRefId = `${nextRoundName.replace(/\s/g, '-').toLowerCase()}-${matchNumberCounter}`;
            nextRoundMatches.push({ 
                id: matchRefId, 
                matchNumber: matchNumberCounter 
            });

            matches.push({
                id: matchRefId,
                matchNumber: matchNumberCounter++,
                round: nextRoundName,
                team1: { 
                    id: null, 
                    name: `Vainqueur M${sourceMatch1.matchNumber}`, 
                    sourceMatchId: sourceMatch1.id, 
                    sourceTeamType: 'winner' 
                },
                team2: { 
                    id: null, 
                    name: `Vainqueur M${sourceMatch2.matchNumber}`, 
                    sourceMatchId: sourceMatch2.id, 
                    sourceTeamType: 'winner' 
                },
                sets: JSON.parse(JSON.stringify(initialSets)),
                status: 'scheduled',
                type: 'elimination',
                setsToWin: tournamentConfig.setsPerMatchElimination,
                pointsPerSet: tournamentConfig.pointsPerSetElimination,
                tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Mettre à jour les matchs sources avec nextMatchId
            const matchIndex1 = matches.findIndex(m => m.id === sourceMatch1.id);
            if (matchIndex1 !== -1) {
                matches[matchIndex1].nextMatchId = matchRefId;
                matches[matchIndex1].nextMatchTeamSlot = 'team1';
            }

            const matchIndex2 = matches.findIndex(m => m.id === sourceMatch2.id);
            if (matchIndex2 !== -1) {
                matches[matchIndex2].nextMatchId = matchRefId;
                matches[matchIndex2].nextMatchTeamSlot = 'team2';
            }
            console.log(`Match de tour suivant créé: M${matchRefId} (${nextRoundName}) lié à M${sourceMatch1.matchNumber} et M${sourceMatch2.matchNumber}`);
        }

        previousRoundMatches = nextRoundMatches;
        currentRoundName = nextRoundName;
    }

    // 6. Ajouter le match pour la 3ème place
    console.log('Vérification et ajout du match pour la 3ème place si nécessaire.');
    const demiFinales = matches.filter(m => m.round === 'Demi-finale');
    if (demiFinales.length === 2) {
        const m3pRefId = `match-3eme-place-${matchNumberCounter}`;
        
        matches.push({
            id: m3pRefId,
            matchNumber: matchNumberCounter++,
            round: 'Match 3ème place',
            team1: { 
                id: null, 
                name: `Perdant M${demiFinales[0].matchNumber}`, 
                sourceMatchId: demiFinales[0].id, 
                sourceTeamType: 'loser' 
            },
            team2: { 
                id: null, 
                name: `Perdant M${demiFinales[1].matchNumber}`, 
                sourceMatchId: demiFinales[1].id, 
                sourceTeamType: 'loser' 
            },
            sets: JSON.parse(JSON.stringify(initialSets)),
            status: 'scheduled',
            type: 'elimination',
            setsToWin: tournamentConfig.setsPerMatchElimination,
            pointsPerSet: tournamentConfig.pointsPerSetElimination,
            tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log(`Match pour la 3ème place créé: M${m3pRefId} lié aux perdants des demi-finales M${demiFinales[0].matchNumber} et M${demiFinales[1].matchNumber}`);

        // Mettre à jour les demi-finales pour pointer vers le match 3ème place
        const df1Index = matches.findIndex(m => m.id === demiFinales[0].id);
        if (df1Index !== -1) {
            matches[df1Index].nextMatchLoserId = m3pRefId;
            matches[df1Index].nextMatchLoserTeamSlot = 'team1';
            console.log(`Demi-finale M${demiFinales[0].matchNumber} mise à jour pour le match 3ème place.`);
        }

        const df2Index = matches.findIndex(m => m.id === demiFinales[1].id);
        if (df2Index !== -1) {
            matches[df2Index].nextMatchLoserId = m3pRefId;
            matches[df2Index].nextMatchLoserTeamSlot = 'team2';
            console.log(`Demi-finale M${demiFinales[1].matchNumber} mise à jour pour le match 3ème place.`);
        }
    } else {
        console.log('Pas de match pour la 3ème place nécessaire (moins de 2 demi-finales).');
    }

    console.log('Fin de generateEliminationBracket. Nombre total de matchs générés:', matches.length);
    return matches;
}

module.exports = {
    calculateBracketStructure,
    generateEliminationBracket
};
