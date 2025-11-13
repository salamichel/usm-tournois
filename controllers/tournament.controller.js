// Ce fichier gère la logique métier liée aux tournois.
const { db } = require('../services/firebase');
const { collection, getDocs, query, doc, getDoc, where, writeBatch, setDoc, deleteDoc, arrayUnion, arrayRemove, orderBy, limit, updateDoc } = require('firebase/firestore');
const { getTeamsAndPlayersCounts, getTournamentStatus, getUserRegistrationStatus, sendFlashAndRedirect } = require('../services/tournament.utils');
const { updateMatchScoresAndStatus, propagateEliminationMatchResults } = require('../services/match.service'); // Importer les nouvelles fonctions mutualisées


/**
 * Affiche la page d'accueil avec la liste de tous les tournois.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.showAllTournaments = async (req, res) => {
    console.log(`[showAllTournaments] Début de la fonction.`);
    try {
        const eventsCollection = collection(db, 'events');
        // Filtrer uniquement les tournois actifs
        const q = query(eventsCollection, where('isActive', '==', true));
        const eventsSnapshot = await getDocs(q);
        
        const userId = req.session.user ? req.session.user.uid : null; // Récupérer l'UID de l'utilisateur si connecté
        console.log(`[showAllTournaments] Current user ID from session: ${userId}`);
        console.log(`[showAllTournaments] Nombre de tournois actifs trouvés: ${eventsSnapshot.docs.length}`);

        const events = await Promise.all(eventsSnapshot.docs.map(async (docSnap) => {
            const event = { id: docSnap.id, ...docSnap.data() };
            console.log(`[showAllTournaments] Traitement du tournoi: ${event.name} (ID: ${event.id})`);

            // Rendre registrationsOpen dynamique
            const now = new Date();
            const registrationStarts = event.registrationStartDateTime ? event.registrationStartDateTime.toDate() : new Date(0);
            event.registrationsOpen = now >= registrationStarts; // Le tournoi est ouvert si la date de début est atteinte
            console.log(`[showAllTournaments] Tournoi ${event.name} - Inscriptions ouvertes: ${event.registrationsOpen}`);

            const { completeTeamsCount, totalPlayersInTeams, teamsCount, unassignedPlayersCount, playersCount } = await getTeamsAndPlayersCounts(event.id, event);
            event.teamsCount = teamsCount;
            event.unassignedPlayersCount = unassignedPlayersCount;
            event.completeTeamsCount = completeTeamsCount;
            event.playersCount = playersCount;
            event.waitingListCount = (await getDocs(collection(db, `events/${event.id}/waitingListTeams`))).size; // Garder pour l'instant

            console.log(`[showAllTournaments] Tournoi ${event.name} - completeTeamsCount: ${event.completeTeamsCount}, maxTeams: ${event.maxTeams}`);
            console.log(`[showAllTournaments] Tournoi ${event.name} - totalTeamsCount: ${event.teamsCount}`);

            event.status = getTournamentStatus(event, completeTeamsCount);
            console.log(`[showAllTournaments] Tournoi ${event.name} - Statut: ${event.status}`);

            if (userId) {
                const userRegistrationStatus = await getUserRegistrationStatus(event.id, userId);
                if (userRegistrationStatus.isRegistered) {
                    event.registrationType = userRegistrationStatus.registrationType;
                    event.teamName = userRegistrationStatus.teamName;
                }
                console.log(`[showAllTournaments] Event ${event.id} (${event.name}) - registrationType for user ${userId}: ${event.registrationType || 'N/A'}`);
            }
            console.log(`[showAllTournaments] Ajout du tournoi à la liste finale: ${event.name} (ID: ${event.id})`);
            return event;
        }));

        res.render('pages/index', {
            title: 'Accueil - Tournois',
            events: events,
            user: req.session.user || null,
            path: req.path
        });
        console.log(`[showAllTournaments] Fin de la fonction.`);
    } catch (error) {
        console.error("Erreur lors de la récupération des tournois:", error);
        res.status(500).send("Erreur serveur.");
    }
};

/**
 * Gère l'inscription d'une équipe à un tournoi par son capitaine.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.registerTeam = async (req, res) => {
    if (!req.session.user) {
        return sendFlashAndRedirect(req, res, 'error', "Non authentifié.", '/mon-compte');
    }

    const eventId = req.params.id;
    const teamId = req.body.teamId; // L'ID de l'équipe à inscrire
    const captainId = req.session.user.uid;

    console.log(`[registerTeam] Début de la fonction.`);
    console.log(`[registerTeam] eventId: ${eventId}, teamId: ${teamId}, captainId: ${captainId}`);

    try {
        const eventDocRef = doc(db, 'events', eventId);
        const eventDoc = await getDoc(eventDocRef);
        if (!eventDoc.exists()) {
            console.log(`[registerTeam] Tournoi non trouvé pour eventId: ${eventId}`);
            return sendFlashAndRedirect(req, res, 'error', "Tournoi non trouvé.", '/mon-compte');
        }
        const eventData = eventDoc.data();
        console.log(`[registerTeam] Données du tournoi: ${JSON.stringify(eventData.name)}`);

        const { completeTeamsCount } = await getTeamsAndPlayersCounts(eventId, eventData);
        console.log(`[registerTeam] completeTeamsCount: ${completeTeamsCount}, maxTeams: ${eventData.maxTeams}`);

        if (completeTeamsCount >= eventData.maxTeams) {
            if (eventData.waitingListEnabled) {
                const existingWaitingListDoc = await getDoc(doc(db, `events/${eventId}/waitingListTeams`, teamId));
                if (existingWaitingListDoc.exists()) {
                    console.log(`[registerTeam] Équipe ${teamId} déjà en liste d'attente pour le tournoi ${eventId}.`);
                    return sendFlashAndRedirect(req, res, 'error', "Votre équipe est déjà en liste d'attente pour ce tournoi.", '/mon-compte');
                }

                let foundTeamDataForWaitingList = null;
                const allEventsSnapshotForWaitingList = await getDocs(collection(db, 'events'));
                for (const eDoc of allEventsSnapshotForWaitingList.docs) {
                    const tSnapshot = await getDocs(query(collection(db, `events/${eDoc.id}/teams`), where('captainId', '==', captainId)));
                    for (const tDoc of tSnapshot.docs) {
                        if (tDoc.id === teamId) {
                            foundTeamDataForWaitingList = tDoc.data();
                            break;
                        }
                    }
                    if (foundTeamDataForWaitingList) break;
                }

                if (!foundTeamDataForWaitingList) {
                    console.log(`[registerTeam] Équipe ${teamId} non trouvée pour la liste d'attente ou capitaine incorrect.`);
                    return sendFlashAndRedirect(req, res, 'error', "Équipe non trouvée ou vous n'êtes pas le capitaine.", '/mon-compte');
                }

                await setDoc(doc(db, `events/${eventId}/waitingListTeams`, teamId), {
                    ...foundTeamDataForWaitingList,
                    addedAt: new Date()
                });
                console.log(`[registerTeam] Équipe ${teamId} ajoutée à la liste d'attente pour le tournoi ${eventId}.`);
                return sendFlashAndRedirect(req, res, 'success', "Le tournoi est complet. Votre équipe a été ajoutée à la liste d'attente.", '/mon-compte');
            } else {
                console.log(`[registerTeam] Tournoi ${eventId} complet et liste d'attente non activée.`);
                return sendFlashAndRedirect(req, res, 'error', "Le tournoi est complet et la liste d'attente n'est pas activée.", '/mon-compte');
            }
        }

        let foundTeamData = null;
        let originalTeamId = null;

        console.log(`[registerTeam] Recherche de l'équipe ${teamId} pour le capitaine ${captainId} dans tous les événements.`);
        const allEventsSnapshot = await getDocs(collection(db, 'events'));
        for (const eventDoc of allEventsSnapshot.docs) {
            const teamsSnapshot = await getDocs(query(collection(db, `events/${eventDoc.id}/teams`), where('captainId', '==', captainId)));
            for (const teamDoc of teamsSnapshot.docs) {
                console.log(`[registerTeam] Vérification de l'équipe ${teamDoc.id} dans l'événement ${eventDoc.id}.`);
                if (teamDoc.id === teamId) {
                    foundTeamData = teamDoc.data();
                    originalTeamId = teamDoc.id;
                    console.log(`[registerTeam] Équipe ${teamId} trouvée dans l'événement ${eventDoc.id}.`);
                    break;
                }
            }
            if (foundTeamData) break;
        }

        if (!foundTeamData) {
            console.log(`[registerTeam] Équipe ${teamId} non trouvée ou capitaine incorrect après recherche globale.`);
            return sendFlashAndRedirect(req, res, 'error', "Équipe non trouvée ou vous n'êtes pas le capitaine.", '/mon-compte');
        }

        const existingRegistrationDoc = await getDoc(doc(db, `events/${eventId}/teams`, originalTeamId));
        if (existingRegistrationDoc.exists()) {
            console.log(`[registerTeam] Équipe ${originalTeamId} déjà inscrite au tournoi ${eventId}.`);
            return sendFlashAndRedirect(req, res, 'error', "Cette équipe est déjà inscrite à ce tournoi.", '/mon-compte');
        }

        await setDoc(doc(db, `events/${eventId}/teams`, originalTeamId), {
            ...foundTeamData,
            registeredAt: new Date().toISOString()
        });
        console.log(`[registerTeam] Équipe ${originalTeamId} inscrite au tournoi ${eventId} avec succès.`);

        return sendFlashAndRedirect(req, res, 'success', "Équipe inscrite au tournoi avec succès.", '/mon-compte');

    } catch (error) {
        console.error("Erreur lors de l'inscription de l'équipe au tournoi:", error);
        return sendFlashAndRedirect(req, res, 'error', "Erreur serveur lors de l'inscription de l'équipe.", '/mon-compte');
    }
};

/**
 * Gère la désinscription d'une équipe d'un tournoi par son capitaine.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.unregisterTeam = async (req, res) => {
    if (!req.session.user) {
        return sendFlashAndRedirect(req, res, 'error', "Non authentifié.", '/mon-compte');
    }

    const eventId = req.params.id;
    const teamId = req.body.teamId; // L'ID de l'équipe à désinscrire
    const captainId = req.session.user.uid;

    try {
        // Vérifier si l'équipe existe dans le tournoi et si l'utilisateur est bien le capitaine
        const teamDocRef = doc(db, `events/${eventId}/teams`, teamId);
        const teamDoc = await getDoc(teamDocRef);

        if (!teamDoc.exists()) {
            return sendFlashAndRedirect(req, res, 'error', "Équipe non trouvée dans ce tournoi.", '/mon-compte');
        }
        const teamData = teamDoc.data();

        if (teamData.captainId !== captainId) {
            return sendFlashAndRedirect(req, res, 'error', "Vous n'êtes pas le capitaine de cette équipe.", '/mon-compte');
        }

        // Supprimer l'équipe de la sous-collection 'teams' de l'événement
        await deleteDoc(teamDocRef);

        // Après la désinscription, vérifier s'il faut promouvoir une équipe de la liste d'attente
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        const eventData = eventDoc.data();

        if (eventData.waitingListEnabled) {
            const waitingListQuery = query(collection(db, `events/${eventId}/waitingListTeams`), orderBy('addedAt', 'asc'), limit(1));
            const waitingListSnapshot = await getDocs(waitingListQuery);

            if (!waitingListSnapshot.empty) {
                const firstWaitingTeamDoc = waitingListSnapshot.docs[0];
                const teamToPromoteId = firstWaitingTeamDoc.id;
                const teamToPromoteData = firstWaitingTeamDoc.data();

                const batch = writeBatch(db);

                // 1. Ajouter l'équipe promue à la collection des équipes inscrites
                const newTeamRef = doc(db, `events/${eventId}/teams`, teamToPromoteId);
                batch.set(newTeamRef, { ...teamToPromoteData, registeredAt: new Date() });

                // 2. Supprimer l'équipe de la liste d'attente
                batch.delete(firstWaitingTeamDoc.ref);

                await batch.commit();

                // TODO: Envoyer une notification au capitaine de l'équipe promue
                console.log(`Équipe ${teamToPromoteId} promue de la liste d'attente.`);
            }
        }

        return sendFlashAndRedirect(req, res, 'success', "Équipe désinscrite du tournoi avec succès.", '/mon-compte');

    } catch (error) {
        console.error("Erreur lors de la désinscription de l'équipe du tournoi:", error);
        return sendFlashAndRedirect(req, res, 'error', "Erreur serveur lors de la désinscription de l'équipe.", '/mon-compte');
    }
};

/**
 * Gère la désinscription d'une équipe de la liste d'attente d'un tournoi.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.unregisterWaitingListTeam = async (req, res) => {
    if (!req.session.user) {
        return sendFlashAndRedirect(req, res, 'error', "Non authentifié.", '/mon-compte');
    }

    const eventId = req.params.id;
    const teamId = req.body.teamId;
    const captainId = req.session.user.uid;

    try {
        // Vérifier si l'équipe existe dans la liste d'attente et si l'utilisateur est bien le capitaine
        const waitingListTeamDocRef = doc(db, `events/${eventId}/waitingListTeams`, teamId);
        const waitingListTeamDoc = await getDoc(waitingListTeamDocRef);

        if (!waitingListTeamDoc.exists()) {
            return sendFlashAndRedirect(req, res, 'error', "Équipe non trouvée dans la liste d'attente de ce tournoi.", '/mon-compte');
        }
        const teamData = waitingListTeamDoc.data();

        if (teamData.captainId !== captainId) {
            return sendFlashAndRedirect(req, res, 'error', "Vous n'êtes pas le capitaine de cette équipe.", '/mon-compte');
        }

        // Supprimer l'équipe de la liste d'attente
        await deleteDoc(waitingListTeamDocRef);

        return sendFlashAndRedirect(req, res, 'success', "Votre équipe a été retirée de la liste d'attente avec succès.", '/mon-compte');

    } catch (error) {
        console.error("Erreur lors de la désinscription de l'équipe de la liste d'attente:", error);
        return sendFlashAndRedirect(req, res, 'error', "Erreur serveur lors de la désinscription de la liste d'attente.", '/mon-compte');
    }
};

/**
 * Affiche la page "Mon Compte" avec les tournois auxquels l'utilisateur est inscrit.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.showMyTournaments = async (req, res, title = 'Mon Compte - Mes Tournois') => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const userId = req.session.user.uid;
    let registeredEvents = [];

    try {
        const eventsCollection = collection(db, 'events');
        const eventsSnapshot = await getDocs(query(eventsCollection));

        for (const eventDoc of eventsSnapshot.docs) {
            const event = { id: eventDoc.id, ...eventDoc.data() };
            const userRegistrationStatus = await getUserRegistrationStatus(event.id, userId);

            if (userRegistrationStatus.isRegistered) {
                const { completeTeamsCount, teamsCount, unassignedPlayersCount, playersCount } = await getTeamsAndPlayersCounts(event.id, event);
                event.teamsCount = teamsCount;
                event.completeTeamsCount = completeTeamsCount;
                event.unassignedPlayersCount = unassignedPlayersCount;
                event.playersCount = playersCount;
                event.status = getTournamentStatus(event, completeTeamsCount);

                event.registrationType = userRegistrationStatus.registrationType;
                event.teamName = userRegistrationStatus.teamName;

                registeredEvents.push(event);
            }
        }

        let userTeams = [];
        const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const captainTeamsPromises = allEvents.map(async (event) => {
            const teamsSnapshot = await getDocs(query(collection(db, `events/${event.id}/teams`), where('captainId', '==', userId)));
            return teamsSnapshot.docs.map(teamDoc => ({
                id: teamDoc.id,
                ...teamDoc.data(),
                tournamentId: event.id,
                tournamentName: event.name,
                maxMembers: event.playersPerTeam
            }));
        });
        const captainTeamsArrays = await Promise.all(captainTeamsPromises);
        userTeams = captainTeamsArrays.flat();

        const activeTournaments = [];
        const now = new Date();
        for (const eventDoc of eventsSnapshot.docs) {
            const event = { id: eventDoc.id, ...eventDoc.data() };
            const registrationStarts = event.registrationStartDateTime ? event.registrationStartDateTime.toDate() : new Date(0);

            if (event.isActive && event.registrationsOpen && now >= registrationStarts) {
                const { completeTeamsCount, teamsCount } = await getTeamsAndPlayersCounts(event.id, event);
                event.teamsCount = teamsCount;
                event.completeTeamsCount = completeTeamsCount;
                event.status = getTournamentStatus(event, completeTeamsCount);
                activeTournaments.push(event);
            }
        }

        const teamsWithRegistrationStatus = await Promise.all(userTeams.map(async (team) => {
            const tournamentsStatus = await Promise.all(activeTournaments.map(async (tournament) => {
                const teamRegistrationDoc = await getDoc(doc(db, `events/${tournament.id}/teams`, team.id));
                const teamWaitingListDoc = await getDoc(doc(db, `events/${tournament.id}/waitingListTeams`, team.id));
                return {
                    tournamentId: tournament.id,
                    tournamentName: tournament.name,
                    isRegistered: teamRegistrationDoc.exists(),
                    isOnWaitingList: teamWaitingListDoc.exists(),
                    status: tournament.status
                };
            }));
            return {
                ...team,
                tournamentsStatus: tournamentsStatus
            };
        }));

        const userMatches = await exports.getUserMatches(userId);

        res.render('pages/mon-compte', {
            title: title,
            user: req.session.user,
            currentUser: req.session.user,
            registeredEvents: registeredEvents,
            userTeams: teamsWithRegistrationStatus,
            activeTournaments: activeTournaments,
            userMatches: userMatches,
            path: req.path
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des tournois de l'utilisateur:", error);
        res.status(500).send("Erreur serveur.");
    }
};

/**
 * Gère l'inscription d'un joueur libre à un tournoi.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.registerFreePlayer = async (req, res) => {
    if (!req.session.user) {
        return sendFlashAndRedirect(req, res, 'error', "Non authentifié.", '/mon-compte');
    }

    const eventId = req.params.id;
    const userId = req.session.user.uid;

    console.log(`[DEBUG - registerFreePlayer] eventId: ${eventId}`);
    console.log(`[DEBUG - registerFreePlayer] userId (from session): ${userId}`);

    try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (!eventDoc.exists()) {
            return sendFlashAndRedirect(req, res, 'error', "Tournoi non trouvé.", '/mon-compte');
        }
        const eventData = eventDoc.data();

        const now = new Date();
        const registrationStarts = eventData.registrationStartDateTime ? eventData.registrationStartDateTime.toDate() : new Date(0);

        if (!eventData.registrationsOpen || now < registrationStarts) {
            return sendFlashAndRedirect(req, res, 'error', "Les inscriptions pour ce tournoi ne sont pas encore ouvertes ou sont fermées.", '/mon-compte');
        }

        const { completeTeamsCount } = await getTeamsAndPlayersCounts(eventId, eventData);

        if (completeTeamsCount >= eventData.maxTeams) {
            return sendFlashAndRedirect(req, res, 'error', "Le tournoi est complet (nombre maximum d'équipes complètes atteint). Impossible de rejoindre une équipe.", '/mon-compte');
        }

        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            console.error(`[DEBUG - registerFreePlayer] Utilisateur non trouvé pour l'UID: ${userId}`);
            return sendFlashAndRedirect(req, res, 'error', "Utilisateur non trouvé.", '/mon-compte');
        }
        const userData = userDoc.data();

        console.log(`[DEBUG - registerFreePlayer] Tentative d'inscription de l'utilisateur ${userId} (${userData.pseudo}) à l'événement ${eventId}.`);
        console.log(`[DEBUG - registerFreePlayer] Chemin Firestore: events/${eventId}/unassignedPlayers/${userId}`);
        console.log(`[DEBUG - registerFreePlayer] Données du document: { userId: ${userId}, pseudo: ${userData.pseudo}, level: ${userData.level} }`);

        // Log pour vérifier si cette ligne est atteinte
        console.log(`[DEBUG - registerFreePlayer] Tentative de création du joueur libre dans Firestore.`);
        
        // Utiliser setDoc avec l'UID de l'utilisateur comme ID du document
        await setDoc(doc(db, `events/${eventId}/unassignedPlayers`, userId), {
            userId: userId,
            pseudo: userData.pseudo,
            level: userData.level
        });

        console.log(`[DEBUG - registerFreePlayer] Inscription réussie pour l'utilisateur ${userId}.`);
        
        let successMessage = "Inscription réussie en tant que joueur libre.";
        if (eventData.whatsappGroupLink) {
            successMessage += ` Rejoignez notre groupe WhatsApp pour les dernières infos : ${eventData.whatsappGroupLink}`;
        }
        return sendFlashAndRedirect(req, res, 'success', successMessage, '/mon-compte');

    } catch (error) {
        console.error(`[DEBUG - registerFreePlayer] Erreur lors de l'inscription du joueur libre pour l'événement ${eventId} et l'utilisateur ${userId}:`, error);
        return sendFlashAndRedirect(req, res, 'error', "Erreur serveur lors de l'inscription.", '/mon-compte');
    }
};

/**
 * Gère la désinscription d'un joueur d'un tournoi (joueur libre ou membre d'équipe).
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.leaveTournament = async (req, res) => {
    if (!req.session.user) {
        return sendFlashAndRedirect(req, res, 'error', "Non authentifié.", '/mon-compte');
    }

    const eventId = req.params.id;
    const userId = req.session.user.uid;

    try {
        const batch = writeBatch(db);

        // 1. Vérifier et supprimer des joueurs libres
        const unassignedPlayersQuery = query(collection(db, `events/${eventId}/unassignedPlayers`), where("userId", "==", userId));
        const unassignedPlayersSnapshot = await getDocs(unassignedPlayersQuery);
        unassignedPlayersSnapshot.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });

        // 2. Vérifier et supprimer des équipes
        const teamsQuery = query(collection(db, `events/${eventId}/teams`), where("members", "array-contains", { userId: userId }));
        const teamsSnapshot = await getDocs(teamsQuery);
        teamsSnapshot.forEach(teamDoc => {
            const teamData = teamDoc.data();
            const updatedMembers = teamData.members.filter(member => member.userId !== userId);
            batch.update(teamDoc.ref, { members: updatedMembers });
        });

        await batch.commit();

        return sendFlashAndRedirect(req, res, 'success', "Désinscription du tournoi réussie.", '/mon-compte');

    } catch (error) {
        console.error("Erreur lors de la désinscription du tournoi:", error);
        return sendFlashAndRedirect(req, res, 'error', "Erreur serveur lors de la désinscription.", '/mon-compte');
    }
};

/**
 * Gère l'action de rejoindre une équipe existante pour un tournoi.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.joinTeam = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }

    const eventId = req.params.id;
    const userId = req.session.user.uid;
    const { teamId } = req.body;

    console.log(`[DEBUG - joinTeam] eventId reçu: ${eventId}`);
    console.log(`[DEBUG - joinTeam] userId: ${userId}`);
    console.log(`[DEBUG - joinTeam] teamId reçu: ${teamId}`);

    try {
        const batch = writeBatch(db);

        // 1. Vérifier l'existence du tournoi
        const eventDocRef = doc(db, 'events', eventId);
        const eventDoc = await getDoc(eventDocRef);
        if (!eventDoc.exists()) {
            console.log(`[DEBUG - joinTeam] Tournoi non trouvé dans Firestore pour l'ID: ${eventId}`);
            return res.status(404).json({ success: false, message: "Tournoi non trouvé." });
        }
        const eventData = eventDoc.data();

        const now = new Date();
        const registrationStarts = eventData.registrationStartDateTime ? eventData.registrationStartDateTime.toDate() : new Date(0);

        if (!eventData.registrationsOpen || now < registrationStarts) {
            return res.status(400).json({ success: false, message: "Les inscriptions pour ce tournoi ne sont pas encore ouvertes ou sont fermées." });
        }

        // 2. Vérifier l'existence de l'équipe et si elle est dans ce tournoi
        const teamDocRef = doc(db, `events/${eventId}/teams`, teamId);
        const teamDoc = await getDoc(teamDocRef);
        if (!teamDoc.exists()) {
            return res.status(404).json({ success: false, message: "Équipe non trouvée dans ce tournoi." });
        }
        const teamData = teamDoc.data();

        // 3. Vérifier si l'utilisateur est déjà inscrit (joueur libre ou membre d'une équipe)
        // 3. Vérifier si l'utilisateur est déjà inscrit (joueur libre ou membre d'une équipe)
        const userStatus = await exports.getUserRegistrationStatus(eventId, userId);

        // Si l'utilisateur est déjà membre d'une équipe (autre que celle qu'il essaie de rejoindre)
        if (userStatus.isRegistered && userStatus.registrationType === 'team' && userStatus.teamId !== teamId) {
            return res.status(400).json({ success: false, message: "Vous êtes déjà membre d'une autre équipe dans ce tournoi." });
        }
        // Si l'utilisateur est déjà membre de l'équipe qu'il essaie de rejoindre
        if (userStatus.isRegistered && userStatus.registrationType === 'team' && userStatus.teamId === teamId) {
            return res.status(400).json({ success: false, message: "Vous êtes déjà membre de cette équipe." });
        }
        // Si l'utilisateur est joueur libre, il peut rejoindre une équipe (la logique de suppression sera gérée plus bas)
        // Pas besoin de bloquer ici s'il est 'free-player'

        // 4. Vérifier si l'équipe n'est pas complète (basé sur le nombre maximum de joueurs)
        if ((teamData.members?.length || 0) >= eventData.playersPerTeam) {
            return res.status(400).json({ success: false, message: "L'équipe a atteint son nombre maximum de joueurs." });
        }

        // 5. Récupérer les informations de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé." });
        }
        const userData = userDoc.data();

        // 6. Ajouter l'utilisateur comme membre de l'équipe
        batch.update(teamDocRef, {
            members: arrayUnion({
                userId: userId,
                pseudo: userData.pseudo,
                level: userData.level
            })
        });

        // 7. Supprimer l'utilisateur de la liste des joueurs libres s'il y était
        const unassignedPlayerDocRef = doc(db, `events/${eventId}/unassignedPlayers`, userId);
        const unassignedPlayerDoc = await getDoc(unassignedPlayerDocRef);
        if (unassignedPlayerDoc.exists()) {
            batch.delete(unassignedPlayerDocRef);
        }

        await batch.commit();

        let successMessage = `Vous avez rejoint l'équipe ${teamData.name} avec succès.`;
        if (eventData.whatsappGroupLink) {
            successMessage += ` Rejoignez notre groupe WhatsApp pour les dernières infos : ${eventData.whatsappGroupLink}`;
        }
        res.json({ success: true, message: successMessage });

    } catch (error) {
        console.error("Erreur lors de la tentative de rejoindre l'équipe:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de l'action de rejoindre l'équipe." });
    }
};

/**
 * Gère l'action de rejoindre la liste d'attente pour un tournoi.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.joinWaitingList = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }

    const eventId = req.params.id;
    const userId = req.session.user.uid;

    try {
        const eventDocRef = doc(db, 'events', eventId);
        const eventDoc = await getDoc(eventDocRef);
        if (!eventDoc.exists()) {
            return res.status(404).json({ success: false, message: "Tournoi non trouvé." });
        }
        const eventData = eventDoc.data();

        // Vérifier si la liste d'attente est activée et a une taille > 0
        if (!eventData.waitingListEnabled || eventData.waitingListSize <= 0) {
            return res.status(400).json({ success: false, message: "La liste d'attente n'est pas activée pour ce tournoi." });
        }

        // Vérifier si l'utilisateur est déjà inscrit ou en liste d'attente
        const userStatus = await exports.getUserRegistrationStatus(eventId, userId);
        if (userStatus.isRegistered) {
            return res.status(400).json({ success: false, message: "Vous êtes déjà inscrit à ce tournoi." });
        }
        if (userStatus.isOnWaitingList) {
            return res.status(400).json({ success: false, message: "Votre équipe est déjà en liste d'attente pour ce tournoi." });
        }

        // Récupérer l'équipe dont l'utilisateur est capitaine pour l'ajouter à la liste d'attente
        // Pour l'instant, nous supposons qu'un joueur libre ne peut pas rejoindre la liste d'attente directement,
        // mais doit le faire via une équipe.
        const teamsAsCaptainSnapshot = await getDocs(query(collection(db, `events/${eventId}/teams`), where('captainId', '==', userId)));
        if (teamsAsCaptainSnapshot.empty) {
            return res.status(400).json({ success: false, message: "Vous devez être capitaine d'une équipe pour rejoindre la liste d'attente." });
        }
        const teamToAddToWaitingList = { id: teamsAsCaptainSnapshot.docs[0].id, ...teamsAsCaptainSnapshot.docs[0].data() };

        // Vérifier si la liste d'attente n'est pas pleine
        const currentWaitingListSnapshot = await getDocs(collection(db, `events/${eventId}/waitingListTeams`));
        if (currentWaitingListSnapshot.size >= eventData.waitingListSize) {
            return res.status(400).json({ success: false, message: "La liste d'attente est pleine." });
        }

        // Ajouter l'équipe à la liste d'attente
        await setDoc(doc(db, `events/${eventId}/waitingListTeams`, teamToAddToWaitingList.id), {
            ...teamToAddToWaitingList,
            addedAt: new Date()
        });

        res.json({ success: true, message: "Votre équipe a été ajoutée à la liste d'attente avec succès." });

    } catch (error) {
        console.error("Erreur lors de la tentative de rejoindre la liste d'attente:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de l'action de rejoindre la liste d'attente." });
    }
};

/**
 * Fonction utilitaire pour obtenir le statut d'inscription d'un utilisateur pour un événement donné.
 * @param {string} eventId L'ID de l'événement.
 * @param {string} userId L'ID de l'utilisateur.
 * @returns {Promise<{isRegistered: boolean, registrationType: string|null, teamName: string|null, teamId: string|null, isOnWaitingList: boolean}>}
 */
exports.getUserRegistrationStatus = async (eventId, userId) => {
    let status = {
        isRegistered: false,
        registrationType: null,
        teamName: null,
        teamId: null,
        isOnWaitingList: false,
    };

    // 1. Vérifier si l'utilisateur est membre d'une équipe
    const teamsCollectionRef = collection(db, `events/${eventId}/teams`);
    const allTeamsSnapshot = await getDocs(teamsCollectionRef);
    
    for (const teamDoc of allTeamsSnapshot.docs) {
        const teamData = teamDoc.data();
        if (teamData.members && teamData.members.some(member => member.userId === userId)) {
            status.isRegistered = true;
            status.registrationType = 'team';
            status.teamName = teamData.name;
            status.teamId = teamDoc.id;
            break;
        }
    }

    // 2. Vérifier si l'utilisateur est un joueur libre (seulement si pas déjà membre d'une équipe)
    if (!status.isRegistered) {
        const unassignedPlayerDoc = await getDoc(doc(db, `events/${eventId}/unassignedPlayers`, userId));
        if (unassignedPlayerDoc.exists()) {
            status.isRegistered = true;
            status.registrationType = 'free-player';
        }
    }

    // 3. Vérifier si l'utilisateur est dans une équipe en liste d'attente
    if (!status.isRegistered) { // Seulement si pas déjà inscrit (équipe ou joueur libre)
        const waitingListTeamsRef = collection(db, `events/${eventId}/waitingListTeams`);
        const waitingListSnapshot = await getDocs(waitingListTeamsRef);
        for (const teamDoc of waitingListSnapshot.docs) {
            const teamData = teamDoc.data();
            if (teamData.members && teamData.members.some(member => member.userId === userId)) {
                status.isOnWaitingList = true;
                status.teamName = teamData.name; // Nom de l'équipe en attente
                status.teamId = teamDoc.id; // ID de l'équipe en attente
                break;
            }
        }
    }
    return status;
};

/**
 * Récupère les matchs auxquels un utilisateur participe.
 * @param {string} userId L'ID de l'utilisateur.
 * @returns {Promise<Array<Object>>} Une promesse qui résout en un tableau de matchs.
 */
exports.getUserMatches = async (userId) => {
    console.log(`[getUserMatches] Début de la fonction pour l'utilisateur: ${userId}`);
    const userMatches = [];
    try {
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        console.log(`[getUserMatches] Nombre d'événements trouvés: ${eventsSnapshot.docs.length}`);

        for (const eventDoc of eventsSnapshot.docs) {
            const eventId = eventDoc.id;
            const eventData = eventDoc.data();
            console.log(`[getUserMatches] Traitement de l'événement: ${eventData.name} (ID: ${eventId})`);

            // Vérifier les matchs de poule
            const poolsSnapshot = await getDocs(collection(db, `events/${eventId}/pools`));
            console.log(`[getUserMatches] Nombre de poules trouvées pour l'événement ${eventId}: ${poolsSnapshot.docs.length}`);
            for (const poolDoc of poolsSnapshot.docs) {
                const poolId = poolDoc.id;
                const matchesSnapshot = await getDocs(collection(db, `events/${eventId}/pools/${poolId}/matches`));
                //console.log(`[getUserMatches] Nombre de matchs de poule trouvés pour la poule ${poolId}: ${matchesSnapshot.docs.length}`);
                for (const matchDoc of matchesSnapshot.docs) {
                    const matchData = matchDoc.data();
                    let match = { 
                        id: matchDoc.id, 
                        ...matchData, 
                        tournamentName: eventData.name, 
                        eventId: eventId, 
                        poolName: poolDoc.data().name, 
                        sets: matchData.sets, 
                        poolId: poolId,
                        tieBreakEnabled: eventData.tieBreakEnabled, // Ajouter cette ligne
                        setsToWin: eventData.setsToWin // Ajouter cette ligne
                    };
                    
                    let team1Data = null;
                    if (matchData.team1?.id) {
                        const team1Doc = await getDoc(doc(db, `events/${eventId}/teams`, matchData.team1.id));
                        if (team1Doc.exists()) {
                            team1Data = { id: team1Doc.id, ...team1Doc.data() };
                        }
                    }
                    let team2Data = null;
                    if (matchData.team2?.id) {
                        const team2Doc = await getDoc(doc(db, `events/${eventId}/teams`, matchData.team2.id));
                        if (team2Doc.exists()) {
                            team2Data = { id: team2Doc.id, ...team2Doc.data() };
                        }
                    }

                    // Ajouter les noms des équipes et l'ID du capitaine au match
                    match.team1Name = team1Data?.name || 'N/A';
                    match.team2Name = team2Data?.name || 'N/A';
                    match.team1CaptainId = team1Data?.captainId || null; // Ajouter l'ID du capitaine de l'équipe 1

                    const team1Members = team1Data?.members || [];
                    const team2Members = team2Data?.members || [];
                    //console.log(`[getUserMatches] Match ${match.id} (Poule ${poolId}) - Team1 Members:`, team1Members);
                    //console.log(`[getUserMatches] Match ${match.id} (Poule ${poolId}) - Team2 Members:`, team2Members);

                    const isUserInTeam1 = team1Members.some(member => {
                        //console.log(`[getUserMatches] Checking Team1 member:`, member, `against userId: ${userId}`);
                        return member.userId === userId;
                    });
                    const isUserInTeam2 = team2Members.some(member => {
                        //console.log(`[getUserMatches] Checking Team2 member:`, member, `against userId: ${userId}`);
                        return member.userId === userId;
                    });

                    if (isUserInTeam1 || isUserInTeam2) {
                        //console.log(`[getUserMatches] Match de poule trouvé pour l'utilisateur ${userId}: ${match.id} dans l'événement ${eventId}, poule ${poolId}`);
                        userMatches.push(match);
                    }
                }
            }

            // Vérifier les matchs éliminatoires
            const eliminationMatchesSnapshot = await getDocs(collection(db, `events/${eventId}/eliminationMatches`));
            console.log(`[getUserMatches] Nombre de matchs éliminatoires trouvés pour l'événement ${eventId}: ${eliminationMatchesSnapshot.docs.length}`);
            for (const matchDoc of eliminationMatchesSnapshot.docs) {
                const matchData = matchDoc.data();
                let match = { 
                    id: matchDoc.id, 
                    ...matchData, 
                    tournamentName: eventData.name, 
                    eventId: eventId, 
                    type: 'elimination', 
                    sets: matchData.sets,
                    tieBreakEnabled: eventData.tieBreakEnabled, // Ajouter cette ligne
                    setsToWin: eventData.setsToWin // Ajouter cette ligne
                };
                
                let team1Data = null;
                if (matchData.team1?.id) {
                    const team1Doc = await getDoc(doc(db, `events/${eventId}/teams`, matchData.team1.id));
                    if (team1Doc.exists()) {
                        team1Data = { id: team1Doc.id, ...team1Doc.data() };
                    }
                }
                let team2Data = null;
                if (matchData.team2?.id) {
                    const team2Doc = await getDoc(doc(db, `events/${eventId}/teams`, matchData.team2.id));
                    if (team2Doc.exists()) {
                        team2Data = { id: team2Doc.id, ...team2Doc.data() };
                    }
                }

                // Ajouter les noms des équipes et l'ID du capitaine au match
                match.team1Name = team1Data?.name || 'N/A';
                match.team2Name = team2Data?.name || 'N/A';
                match.team1CaptainId = team1Data?.captainId || null; // Ajouter l'ID du capitaine de l'équipe 1

                const team1Members = team1Data?.members || [];
                const team2Members = team2Data?.members || [];
                //console.log(`[getUserMatches] Match ${match.id} (Élimination) - Team1 Members:`, team1Members);
                //console.log(`[getUserMatches] Match ${match.id} (Élimination) - Team2 Members:`, team2Members);

                const isUserInTeam1 = team1Members.some(member => {
                    //console.log(`[getUserMatches] Checking Team1 member:`, member, `against userId: ${userId}`);
                    return member.userId === userId;
                });
                const isUserInTeam2 = team2Members.some(member => {
                    //console.log(`[getUserMatches] Checking Team2 member:`, member, `against userId: ${userId}`);
                    return member.userId === userId;
                });

                if (isUserInTeam1 || isUserInTeam2) {
                    //console.log(`[getUserMatches] Match éliminatoire trouvé pour l'utilisateur ${userId}: ${match.id} dans l'événement ${eventId}`);
                    userMatches.push(match);
                }
            }
        }
    } catch (error) {
        console.error("[getUserMatches] Erreur lors de la récupération des matchs de l'utilisateur:", error);
    }
    console.log(`[getUserMatches] Fin de la fonction pour l'utilisateur ${userId}. Nombre total de matchs trouvés: ${userMatches.length}`);
    return userMatches;
};

/**
 * Gère la soumission des scores pour un match.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.submitMatchScores = async (req, res) => {
    console.log(`[submitMatchScores] Début de la fonction.`);
    if (!req.session.user) {
        console.log(`[submitMatchScores] Erreur: Utilisateur non authentifié.`);
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }

    const userId = req.session.user.uid;
    const { eventId, matchId } = req.params;
    const { sets, matchType, poolId } = req.body;

    console.log(`[submitMatchScores] userId: ${userId}, eventId: ${eventId}, matchId: ${matchId}, matchType: ${matchType}, poolId: ${poolId}`);
    console.log(`[submitMatchScores] Sets soumis: ${JSON.stringify(sets)}`);

    try {
        let matchRef;
        let eventDocRef = doc(db, 'events', eventId);
        let eventDoc = await getDoc(eventDocRef);
        if (!eventDoc.exists()) {
            console.log(`[submitMatchScores] Erreur: Tournoi non trouvé pour eventId: ${eventId}.`);
            return res.status(404).json({ success: false, message: "Tournoi non trouvé." });
        }
        const eventData = eventDoc.data();
        console.log(`[submitMatchScores] Données du tournoi récupérées pour eventId: ${eventId}.`);

        if (matchType === 'pool') {
            if (!poolId) {
                console.error(`[submitMatchScores] Erreur: poolId manquant pour un match de poule (eventId: ${eventId}, matchId: ${matchId}).`);
                return res.status(400).json({ success: false, message: "ID de poule manquant pour ce type de match." });
            }
            matchRef = doc(db, `events/${eventId}/pools/${poolId}/matches`, matchId);
            console.log(`[submitMatchScores] Référence de match de poule créée: events/${eventId}/pools/${poolId}/matches/${matchId}`);
        } else if (matchType === 'elimination') {
            matchRef = doc(db, `events/${eventId}/eliminationMatches`, matchId);
            console.log(`[submitMatchScores] Référence de match d'élimination créée: events/${eventId}/eliminationMatches/${matchId}`);
        } else {
            console.log(`[submitMatchScores] Erreur: Type de match invalide: ${matchType}.`);
            return res.status(400).json({ success: false, message: "Type de match invalide." });
        }

        const matchDoc = await getDoc(matchRef);
        if (!matchDoc.exists()) {
            console.log(`[submitMatchScores] Erreur: Match non trouvé pour matchId: ${matchId}.`);
            return res.status(404).json({ success: false, message: "Match non trouvé." });
        }
        const matchData = matchDoc.data();
        console.log(`[submitMatchScores] Données du match récupérées pour matchId: ${matchId}.`);

        // Vérifier si l'utilisateur est le capitaine de l'équipe 1
        const team1Doc = await getDoc(doc(db, `events/${eventId}/teams`, matchData.team1.id));
        if (!team1Doc.exists() || team1Doc.data().captainId !== userId) {
            console.log(`[submitMatchScores] Erreur: Utilisateur ${userId} n'est pas le capitaine de l'équipe 1 (${matchData.team1.id}).`);
            return res.status(403).json({ success: false, message: "Vous n'êtes pas autorisé à saisir les scores pour ce match." });
        }
        console.log(`[submitMatchScores] Utilisateur ${userId} vérifié comme capitaine de l'équipe 1.`);

        const { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId, winnerName, loserName } = await updateMatchScoresAndStatus(
            matchRef,
            matchData,
            sets,
            eventData,
            matchType,
            db
        );
        console.log(`[submitMatchScores] Scores et statut du match mis à jour. Statut: ${matchStatus}, Vainqueur: ${winnerName} (${winnerId}), Perdant: ${loserName} (${loserId}).`);

        // Si le match est terminé et qu'il s'agit d'un match d'élimination, propager les résultats
        if (matchStatus === 'completed' && matchType === 'elimination') {
            // La propagation des résultats sera gérée par une fonction Cloud Firestore.
            console.log(`[submitMatchScores] Match d'élimination terminé. La propagation des résultats sera gérée par une fonction Cloud Firestore.`);
        }

        res.json({ success: true, message: "Scores mis à jour avec succès.", status: matchStatus });
        console.log(`[submitMatchScores] Fin de la fonction.`);

    } catch (error) {
        console.error(`[submitMatchScores] Erreur lors de la soumission des scores pour eventId: ${eventId}, matchId: ${matchId}:`, error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la soumission des scores." });
    }
};

/**
 * Affiche la page de détail pour un tournoi spécifique.
 * @param {import('express').Request} req L'objet de la requête Express.
 * @param {import('express').Response} res L'objet de la réponse Express.
 */
exports.showTournamentDetails = async (req, res) => {
    console.log(`[Tournament Controller] showTournamentDetails called.`);
    try {
        const eventId = req.params.id;
        const user = req.session.user || null;

        console.log(`[Tournament Controller] Event ID received: ${eventId}`);
        console.log(`[Tournament Controller] User in session:`, user ? user.uid : 'Not logged in');

        console.log(`[Tournament Controller] Attempting to fetch event document: events/${eventId}`);
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (!eventDoc.exists()) {
            console.log(`[Tournament Controller] Event document not found for ID: ${eventId}`);
            return res.status(404).render('pages/404', { title: 'Tournoi introuvable' });
        }
        const event = { id: eventDoc.id, ...eventDoc.data() };
        console.log(`[Tournament Controller] Event document fetched: ${event.name}`);

        // Vérifier si le tournoi est actif
        if (!event.isActive) {
            console.log(`[DEBUG - Controller] Tournoi inactif pour l'ID: ${eventId}`);
            return res.status(404).render('pages/404', { title: 'Tournoi introuvable ou inactif' });
        }

        // Rendre registrationsOpen dynamique
        const now = new Date();
        const registrationStarts = event.registrationStartDateTime ? event.registrationStartDateTime.toDate() : new Date(0);
        event.registrationsOpen = now >= registrationStarts; // Le tournoi est ouvert si la date de début est atteinte

        // Assigner l'événement à res.locals pour qu'il soit disponible dans le layout
        res.locals.event = event;

        // Convertir la description de Markdown en HTML
        if (event.description) {
            const { marked } = await import('marked');
            event.description = marked(event.description);
        }
        
        console.log(`[Tournament Controller] Event name: ${event.name}`);

        console.log(`[Tournament Controller] Fetching teams for event ${eventId}...`);
        const teamsSnapshot = await getDocs(collection(db, `events/${eventId}/teams`));
        const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Tournament Controller] Teams fetched: ${teams.length}`);

        // Créer une carte des équipes pour une recherche rapide par ID
        const teamsMap = new Map(teams.map(team => [team.id, team]));

        console.log(`[Tournament Controller] Fetching unassigned players for event ${eventId}...`);
        const unassignedPlayersSnapshot = await getDocs(collection(db, `events/${eventId}/unassignedPlayers`));
        const unassignedPlayers = unassignedPlayersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Tournament Controller] Unassigned players fetched: ${unassignedPlayers.length}`);

        console.log(`[Tournament Controller] Fetching waiting list teams for event ${eventId}...`);
        const waitingListSnapshot = await getDocs(collection(db, `events/${eventId}/waitingListTeams`));
        const waitingList = waitingListSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Tournament Controller] Waiting list teams fetched: ${waitingList.length}`);

        console.log(`[Tournament Controller] Fetching pools and matches for event ${eventId}...`);
        const poolsSnapshot = await getDocs(collection(db, `events/${eventId}/pools`));
        const pools = await Promise.all(poolsSnapshot.docs.map(async (poolDoc) => {
            const pool = { id: poolDoc.id, ...poolDoc.data() };
            const matchesSnapshot = await getDocs(query(collection(db, `events/${eventId}/pools/${pool.id}/matches`), orderBy('matchNumber')));
            pool.matches = matchesSnapshot.docs.map(matchDoc => {
                const matchData = matchDoc.data();
                const team1 = teamsMap.get(matchData.team1?.id); // Accéder à team1.id
                const team2 = teamsMap.get(matchData.team2?.id); // Accéder à team2.id
                console.log(`[Tournament Controller] Pool Match ${matchDoc.id}: team1.id=${matchData.team1?.id} (found: ${!!team1}), team1Name=${team1 ? team1.name : 'N/A'} | team2.id=${matchData.team2?.id} (found: ${!!team2}), team2Name=${team2 ? team2.name : 'N/A'}`);
                return {
                    id: matchDoc.id,
                    ...matchData,
                    team1Name: team1 ? team1.name : 'N/A',
                    team2Name: team2 ? team2.name : 'N/A'
                };
            });
            console.log(`[Tournament Controller] Pool "${pool.name}" fetched with ${pool.matches.length} matches.`);
            return pool;
        }));
        console.log(`[Tournament Controller] Total pools fetched: ${pools.length}`);

        // Récupérer les matchs éliminatoires
        const eliminationMatchesSnapshot = await getDocs(collection(db, `events/${eventId}/eliminationMatches`));
        const eliminationMatches = eliminationMatchesSnapshot.docs.map(doc => {
            const matchData = doc.data();
            const team1 = teamsMap.get(matchData.team1?.id); // Accéder à team1.id
            const team2 = teamsMap.get(matchData.team2?.id); // Accéder à team2.id
            console.log(`[Tournament Controller] Elimination Match ${doc.id}: team1.id=${matchData.team1?.id} (found: ${!!team1}), team1Name=${team1 ? team1.name : 'N/A'} | team2.id=${matchData.team2?.id} (found: ${!!team2}), team2Name=${team2 ? team2.name : 'N/A'}`);
            return {
                id: doc.id,
                ...matchData,
                type: 'elimination',
                team1Name: team1 ? team1.name : 'N/A',
                team2Name: team2 ? team2.name : 'N/A'
            };
        });
        console.log(`[Tournament Controller] Elimination matches fetched: ${eliminationMatches.length}`);

        let preliminaryMatches = [];
        let qfMatches = [];
        let dfMatches = [];
        let m3pMatch = null;
        let finalMatch = null;

        if (eliminationMatches && eliminationMatches.length > 0) {
            preliminaryMatches = eliminationMatches.filter(m => m.round === 'Tour Préliminaire').sort((a, b) => a.matchNumber - b.matchNumber);
            qfMatches = eliminationMatches.filter(m => m.round === 'Quart de finale').sort((a, b) => a.matchNumber - b.matchNumber);
            dfMatches = eliminationMatches.filter(m => m.round === 'Demi-finale').sort((a, b) => a.matchNumber - b.matchNumber);
            m3pMatch = eliminationMatches.find(m => m.round === 'Match 3ème place');
            finalMatch = eliminationMatches.find(m => m.round === 'Finale');
        }

        // Récupérer le classement final
        console.log(`[Tournament Controller] Fetching final ranking for event ${eventId}...`);
        const finalRankingSnapshot = await getDocs(query(collection(db, `events/${eventId}/finalRanking`), orderBy('rank')));
        const finalRanking = finalRankingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Tournament Controller] Final ranking fetched: ${finalRanking.length}`);

        console.log(`[Tournament Controller] Fetching all users...`);
        const allUsersSnapshot = await getDocs(collection(db, 'users')); // Récupérer tous les utilisateurs
        console.log(`[Tournament Controller] Total users fetched: ${allUsersSnapshot.docs.length}`);

        let userStatus = {
            isInTeam: false,
            isUnassigned: false,
            isCaptain: false,
            isRegistered: false,
            registrationType: null,
            teamName: null,
            teamId: null,
        };

        if (user) {
            const userId = user.uid;
            const registrationStatus = await getUserRegistrationStatus(eventId, userId);
            userStatus.isRegistered = registrationStatus.isRegistered;
            userStatus.registrationType = registrationStatus.registrationType;
            userStatus.teamName = registrationStatus.teamName;
            userStatus.teamId = registrationStatus.teamId;

            if (registrationStatus.registrationType === 'team' && registrationStatus.teamId) {
                const teamDoc = await getDoc(doc(db, `events/${eventId}/teams`, registrationStatus.teamId));
                if (teamDoc.exists() && teamDoc.data().captainId === userId) {
                    userStatus.isCaptain = true;
                }
            }
            userStatus.isUnassigned = registrationStatus.registrationType === 'free-player';
            userStatus.isInTeam = registrationStatus.registrationType === 'team';
        }
        console.log(`[Tournament Controller] User status:`, userStatus);

        const availableTeams = teams.filter(team => 
            team.recruitmentOpen && (team.members?.length || 0) < event.playersPerTeam
        );
        console.log(`[Tournament Controller] Available teams to join:`, availableTeams.map(t => t.name));

        const { completeTeamsCount, teamsCount, unassignedPlayersCount, playersCount } = await getTeamsAndPlayersCounts(eventId, event);
        const teamsMax = event.maxTeams;
        const playersMax = event.maxTeams * event.playersPerTeam;

        const teamsProgress = (completeTeamsCount / teamsMax) * 100;
        const playersProgress = (playersCount / playersMax) * 100;

        res.render('pages/tournament-detail', {
            title: event.name,
            event: event, // Toujours passer l'événement à la vue spécifique
            teams: teams,
            unassignedPlayers: unassignedPlayers,
            waitingList: waitingList,
            pools: pools, // Passer les poules à la vue
            user: user,
            allUsers: allUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })), // Réactiver et récupérer tous les utilisateurs
            userStatus: userStatus,
            availableTeams: availableTeams, // Passer les équipes disponibles à la vue
            path: req.path,
            teamsCount,
            completeTeamsCount, // Ajouter completeTeamsCount à la vue
            playersCount,
            teamsMax,
            playersMax,
            teamsProgress,
            playersProgress,
            eliminationMatches: eliminationMatches, // Passer les matchs éliminatoires à la vue
            preliminaryMatches, // Passer les matchs préliminaires
            qfMatches, // Passer les quarts de finale
            dfMatches, // Passer les demi-finales
            m3pMatch,  // Passer le match 3ème place
            finalMatch, // Passer la finale
            finalRanking: finalRanking // Passer le classement final à la vue
        });
    } catch (error) {
        console.error(`[Tournament Controller] Error fetching tournament ${req.params.id}:`, error);
        res.status(500).send("Erreur serveur.");
    }
};
