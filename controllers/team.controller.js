const { db, adminAuth, adminDb } = require('../services/firebase'); // Importez adminAuth et adminDb
const { collection, getDocs, query, where, doc, getDoc, addDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, deleteDoc, setDoc } = require('firebase/firestore');

/*
 * =============================================
 * Contrôleur pour la gestion des équipes
 * =============================================
 */

/**
 * Affiche la page de gestion d'une équipe spécifique.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.showTeamManagementPage = async (req, res, title = 'Gestion d\'équipe') => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const teamId = req.params.id;
    const tournamentId = req.query.tournamentId;
    const userId = req.session.user.uid;

    console.log(`showTeamManagementPage: teamId=${teamId}, tournamentId=${tournamentId}, userId=${userId}`);

    try {
        const teamRef = doc(db, `events/${tournamentId}/teams`, teamId);
        const teamDoc = await getDoc(teamRef);

        if (!teamDoc.exists()) {
            console.log(`showTeamManagementPage: Équipe introuvable pour teamId=${teamId}, tournamentId=${tournamentId}`);
            return res.status(404).render('pages/404', { title: 'Équipe introuvable' });
        }
        let team = { id: teamDoc.id, ...teamDoc.data() };
        console.log(`showTeamManagementPage: Équipe trouvée: ${JSON.stringify(team)}`);

        // Vérifier si l'utilisateur est le capitaine de l'équipe
        if (team.captainId !== userId) {
            return res.status(403).send("Accès refusé. Vous n'êtes pas le capitaine de cette équipe.");
        }

        const tournamentDoc = await getDoc(doc(db, 'events', tournamentId));
        if (!tournamentDoc.exists()) {
            return res.status(404).render('pages/404', { title: 'Tournoi introuvable' });
        }
        const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

        // Récupérer tous les utilisateurs pour les détails des membres et les agents libres
        const allUsersSnapshot = await getDocs(collection(db, 'users'));
        const allUsersMap = new Map(allUsersSnapshot.docs.map(d => [d.id, d.data()]));

        // Enrichir les membres de l'équipe avec les pseudos et niveaux
        const membersWithDetails = team.members.map(member => {
            const userDetail = allUsersMap.get(member.userId);
            return {
                ...member,
                pseudo: userDetail ? userDetail.pseudo : 'Inconnu',
                level: userDetail ? userDetail.level : 'N/A'
            };
        });
        team.members = membersWithDetails;
        team.maxMembers = tournament.playersPerTeam; // Définir maxMembers basé sur le tournoi

        // Mettre à jour le statut de recrutement si l'équipe est pleine
        if (team.members.length >= team.maxMembers && team.recruitmentOpen) {
            await updateDoc(teamRef, { recruitmentOpen: false });
            team.recruitmentOpen = false; // Mettre à jour l'objet team pour la vue
        } else if (team.members.length < team.maxMembers && !team.recruitmentOpen) {
            // Si l'équipe n'est plus pleine et le recrutement est fermé, le rouvrir (optionnel, mais logique)
            await updateDoc(teamRef, { recruitmentOpen: true });
            team.recruitmentOpen = true; // Mettre à jour l'objet team pour la vue
        }

        // Joueurs déjà dans l'équipe actuelle
        const currentTeamMemberIds = new Set(team.members.map(m => m.userId));

        // Récupérer les joueurs actuellement dans la collection `unassignedPlayers` pour ce tournoi
        const unassignedPlayersInCurrentTournamentSnapshot = await getDocs(collection(db, `events/${tournamentId}/unassignedPlayers`));
        const unassignedPlayersInCurrentTournament = unassignedPlayersInCurrentTournamentSnapshot.docs.map(d => ({
            id: d.id,
            pseudo: d.data().pseudo,
            level: d.data().level
        }));
        const unassignedPlayerIdsInCurrentTournament = new Set(unassignedPlayersInCurrentTournament.map(p => p.id));

        // Récupérer tous les joueurs qui sont dans une équipe (dans n'importe quel tournoi)
        const allPlayersInAnyTeam = new Set();
        const allUnassignedPlayersInAnyEvent = new Set();

        const allEventsSnapshotForGlobalCheck = await getDocs(collection(db, 'events'));
        for (const eventDoc of allEventsSnapshotForGlobalCheck.docs) {
            const teamsSnapshot = await getDocs(collection(db, `events/${eventDoc.id}/teams`));
            teamsSnapshot.docs.forEach(teamDoc => {
                teamDoc.data().members.forEach(member => allPlayersInAnyTeam.add(member.userId));
            });

            const unassignedSnapshot = await getDocs(collection(db, `events/${eventDoc.id}/unassignedPlayers`));
            unassignedSnapshot.docs.forEach(playerDoc => allUnassignedPlayersInAnyEvent.add(playerDoc.id));
        }

        // Les "freeAgents" sont les joueurs qui peuvent être ajoutés à l'équipe.
        // Cela inclut:
        // 1. Les joueurs qui sont actuellement dans la collection `unassignedPlayers` pour ce `tournamentId`.
        // 2. Les joueurs qui ne sont dans aucune équipe et ne sont pas dans `unassignedPlayers` pour *aucun* tournoi.
        const freeAgentsMap = new Map();

        // Ajouter les joueurs libres de l'événement actuel (ceux qui ont été retirés d'une équipe ou se sont inscrits comme joueurs libres)
        unassignedPlayersInCurrentTournament.forEach(player => {
            if (!currentTeamMemberIds.has(player.id)) { // S'assurer qu'ils ne sont pas déjà dans l'équipe actuelle
                freeAgentsMap.set(player.id, player);
            }
        });

        // Ajouter les utilisateurs qui ne sont dans aucune équipe et ne sont pas des joueurs libres dans aucun événement
        allUsersSnapshot.docs.forEach(userDoc => {
            if (!allPlayersInAnyTeam.has(userDoc.id) && !allUnassignedPlayersInAnyEvent.has(userDoc.id) && !currentTeamMemberIds.has(userDoc.id)) {
                freeAgentsMap.set(userDoc.id, {
                    id: userDoc.id,
                    pseudo: userDoc.data().pseudo,
                    level: userDoc.data().level
                });
            }
        });

        const freeAgents = Array.from(freeAgentsMap.values());

        res.render('pages/gestion-equipe', { 
            title: title, 
            path: req.path,
            team: team,
            tournament: tournament,
            freeAgents: freeAgents
        });

    } catch (error) {
        console.error("Erreur lors de la récupération de la page de gestion d'équipe:", error);
        res.status(500).send("Erreur serveur.");
    }
};

/**
 * Gère le fait qu'un membre quitte une équipe (action initiée par le membre lui-même).
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.leaveTeam = async (req, res) => {
    if (!req.session.user) {
        console.log("leaveTeam: Utilisateur non authentifié.");
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }

    const eventId = req.params.id; // L'ID du tournoi
    const teamId = req.body.teamId; // L'ID de l'équipe à quitter
    const userId = req.session.user.uid; // L'utilisateur qui quitte l'équipe

    console.log(`leaveTeam: Tentative de l'utilisateur ${userId} de quitter l'équipe ${teamId} pour le tournoi ${eventId}.`);

    try {
        const teamRef = doc(db, `events/${eventId}/teams`, teamId);
        const teamDoc = await getDoc(teamRef);

        if (!teamDoc.exists()) {
            console.log(`leaveTeam: Équipe ${teamId} non trouvée.`);
            return res.status(404).json({ success: false, message: "Équipe non trouvée." });
        }
        const teamData = teamDoc.data();
        console.log(`leaveTeam: Données de l'équipe récupérées: ${JSON.stringify(teamData)}.`);

        // Vérifier si l'utilisateur est bien membre de cette équipe
        const memberToLeave = teamData.members.find(m => m.userId === userId);
        if (!memberToLeave) {
            console.log(`leaveTeam: L'utilisateur ${userId} n'est pas membre de l'équipe ${teamId}.`);
            return res.status(400).json({ success: false, message: "Vous n'êtes pas membre de cette équipe." });
        }
        console.log(`leaveTeam: L'utilisateur ${userId} est bien membre de l'équipe.`);

        const batch = writeBatch(db);
        console.log("leaveTeam: Début de l'opération batch.");

        if (userId === teamData.captainId) {
            console.log(`leaveTeam: L'utilisateur ${userId} est le capitaine.`);
            // Retirer le capitaine du tableau des membres
            const updatedMembers = teamData.members.filter(m => m.userId !== userId);

            if (updatedMembers.length > 0) {
                // Il reste d'autres membres, transférer le rôle de capitaine au premier membre restant
                const newCaptain = updatedMembers[0];
                batch.update(teamRef, {
                    members: updatedMembers,
                    captainId: newCaptain.userId // Le premier membre restant devient le nouveau capitaine
                });
                console.log(`leaveTeam: Capitaine ${userId} retiré. Nouveau capitaine: ${newCaptain.userId}.`);
                // Ajouter l'ancien capitaine à la liste des joueurs libres
                batch.set(doc(db, `events/${eventId}/unassignedPlayers`, userId), {
                    userId: memberToLeave.userId,
                    pseudo: memberToLeave.pseudo,
                    level: memberToLeave.level,
                    tournamentId: eventId
                });
                await batch.commit();
                console.log("leaveTeam: Opération batch terminée avec succès (capitaine transféré).");
                res.json({ success: true, message: `Vous avez quitté l'équipe. ${newCaptain.pseudo} est le nouveau capitaine.` });
            } else {
                // Le capitaine est le seul membre, supprimer l'équipe
                batch.delete(teamRef);
                console.log(`leaveTeam: Capitaine ${userId} était le seul membre. Équipe ${teamId} supprimée.`);
                // Ajouter l'ancien capitaine à la liste des joueurs libres
                batch.set(doc(db, `events/${eventId}/unassignedPlayers`, userId), {
                    userId: memberToLeave.userId,
                    pseudo: memberToLeave.pseudo,
                    level: memberToLeave.level,
                    tournamentId: eventId
                });
                await batch.commit();
                console.log("leaveTeam: Opération batch terminée avec succès (équipe supprimée).");
                res.json({ success: true, message: "Vous avez quitté l'équipe. L'équipe a été supprimée car vous étiez le seul membre." });
            }
        } else {
            console.log(`leaveTeam: L'utilisateur ${userId} n'est pas le capitaine.`);
            // Retirer le membre de l'équipe
            batch.update(teamRef, {
                members: arrayRemove(memberToLeave)
            });
            console.log(`leaveTeam: Ajout de l'opération de retrait du membre ${userId} de l'équipe au batch.`);

            // Ajouter le membre à la liste des joueurs libres de cet événement
            batch.set(doc(db, `events/${eventId}/unassignedPlayers`, userId), {
                userId: memberToLeave.userId,
                pseudo: memberToLeave.pseudo,
                level: memberToLeave.level,
                tournamentId: eventId
            });
            console.log(`leaveTeam: Ajout de l'opération d'ajout du membre ${userId} aux joueurs libres au batch.`);

            await batch.commit();
            console.log("leaveTeam: Opération batch terminée avec succès.");

            res.json({ success: true, message: "Vous avez quitté l'équipe et êtes maintenant un joueur libre." });
        }

    } catch (error) {
        console.error("leaveTeam: Erreur lors du retrait d'un membre de l'équipe:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors du retrait du membre." });
    }
};

/**
 * Gère la création d'une nouvelle équipe pour un tournoi.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.createTeam = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }
    const tournamentId = req.params.id;
    const userId = req.session.user.uid;
    const { teamName } = req.body;

    try {
        const tournamentDoc = await getDoc(doc(db, 'events', tournamentId));
        if (!tournamentDoc.exists()) {
            return res.status(404).json({ success: false, message: "Tournoi non trouvé." });
        }
        const tournamentData = tournamentDoc.data();

        // Vérifier si le tournoi est complet avant de permettre la création d'une équipe
        const teamsSnapshot = await getDocs(collection(db, `events/${tournamentId}/teams`));
        let completeTeamsCount = 0;
        teamsSnapshot.forEach(teamDoc => {
            const teamData = teamDoc.data();
            if (tournamentData.minPlayersPerTeam && teamData.members && teamData.members.length >= tournamentData.minPlayersPerTeam) {
                completeTeamsCount++;
            }
        });

        if (completeTeamsCount >= tournamentData.maxTeams) {
            return res.status(400).json({ success: false, message: "Le tournoi est complet (nombre maximum d'équipes complètes atteint). Impossible de créer une équipe." });
        }

        // Vérifier si l'utilisateur est déjà inscrit en joueur libre
        const unassignedPlayerDoc = await getDoc(doc(db, `events/${tournamentId}/unassignedPlayers`, userId));
        if (unassignedPlayerDoc.exists()) {
            // Supprimer le joueur libre avant de créer l'équipe
            await deleteDoc(doc(db, `events/${tournamentId}/unassignedPlayers`, userId));
        }

        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return res.status(404).json({ success: false, message: "Utilisateur capitaine non trouvé." });
        }
        const userData = userDoc.data();

        const newTeamRef = doc(collection(db, `events/${tournamentId}/teams`));
        await setDoc(newTeamRef, {
            name: teamName,
            captainId: userId,
            members: [{ userId: userId, pseudo: userData.pseudo, level: userData.level }],
            recruitmentOpen: true
        });

        res.json({ success: true, message: "Équipe créée avec succès.", teamId: newTeamRef.id });

    } catch (error) {
        console.error("Erreur lors de la création de l'équipe:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la création de l'équipe." });
    }
};

/**
 * Gère la mise à jour des paramètres d'une équipe (nom, statut de recrutement).
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.updateTeamSettings = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }
    const teamId = req.params.id;
    const { tournamentId, teamName } = req.body; // Ne plus extraire recruitmentOpen
    const userId = req.session.user.uid;

    try {
        const teamRef = doc(db, `events/${tournamentId}/teams`, teamId);
        const teamDoc = await getDoc(teamRef);

        if (!teamDoc.exists()) {
            return res.status(404).json({ success: false, message: "Équipe non trouvée." });
        }
        const teamData = teamDoc.data();

        if (teamData.captainId !== userId) {
            return res.status(403).json({ success: false, message: "Accès refusé. Vous n'êtes pas le capitaine de cette équipe." });
        }

        await updateDoc(teamRef, {
            name: teamName // Ne plus mettre à jour recruitmentOpen ici
        });

        res.json({ success: true, message: "Paramètres de l'équipe mis à jour avec succès." });

    } catch (error) {
        console.error("Erreur lors de la mise à jour des paramètres de l'équipe:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la mise à jour des paramètres." });
    }
};

/**
 * Gère l'ajout d'un membre à une équipe.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.addTeamMember = async (req, res) => {
    console.log("addTeamMember: Début de la fonction.");
    if (!req.session.user) {
        console.log("addTeamMember: Utilisateur non authentifié.");
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }
    const teamId = req.params.id;
    const { tournamentId, memberId } = req.body;
    const userId = req.session.user.uid; // Capitaine qui effectue l'action

    console.log(`addTeamMember: Tentative d'ajout du membre ${memberId} à l'équipe ${teamId} pour le tournoi ${tournamentId} par le capitaine ${userId}.`);

    try {
        const teamRef = doc(db, `events/${tournamentId}/teams`, teamId);
        const teamDoc = await getDoc(teamRef);

        if (!teamDoc.exists()) {
            console.log(`addTeamMember: Équipe ${teamId} non trouvée.`);
            return res.status(404).json({ success: false, message: "Équipe non trouvée." });
        }
        const teamData = teamDoc.data();
        console.log(`addTeamMember: Données de l'équipe récupérées. Capitaine de l'équipe: ${teamData.captainId}.`);

        if (teamData.captainId !== userId) {
            console.log(`addTeamMember: Accès refusé. L'utilisateur ${userId} n'est pas le capitaine de cette équipe (capitaine: ${teamData.captainId}).`);
            return res.status(403).json({ success: false, message: "Accès refusé. Vous n'êtes pas le capitaine de cette équipe." });
        }
        console.log(`addTeamMember: L'utilisateur ${userId} est bien le capitaine.`);

        const tournamentDoc = await getDoc(doc(db, 'events', tournamentId));
        if (!tournamentDoc.exists()) {
            console.log(`addTeamMember: Tournoi ${tournamentId} non trouvé.`);
            return res.status(404).json({ success: false, message: "Tournoi non trouvé." });
        }
        const tournamentData = tournamentDoc.data();
        console.log(`addTeamMember: Données du tournoi récupérées. Players per team: ${tournamentData.playersPerTeam}.`);

        // Vérifier si le tournoi est complet avant d'ajouter un membre
        const allTeamsSnapshot = await getDocs(collection(db, `events/${tournamentId}/teams`));
        let completeTeamsCount = 0;
        allTeamsSnapshot.forEach(tDoc => {
            const tData = tDoc.data();
            if (tournamentData.minPlayersPerTeam && tData.members && tData.members.length >= tournamentData.minPlayersPerTeam) {
                completeTeamsCount++;
            }
        });

        if (completeTeamsCount >= tournamentData.maxTeams) {
            return res.status(400).json({ success: false, message: "Le tournoi est complet (nombre maximum d'équipes complètes atteint). Impossible d'ajouter un membre." });
        }

        if (teamData.members.length >= tournamentData.playersPerTeam) {
            console.log(`addTeamMember: L'équipe est pleine (${teamData.members.length}/${tournamentData.playersPerTeam}).`);
            return res.status(400).json({ success: false, message: "L'équipe a atteint le nombre maximum de membres." });
        }
        console.log(`addTeamMember: L'équipe n'est pas pleine (${teamData.members.length}/${tournamentData.playersPerTeam}).`);


        const memberUserDoc = await getDoc(doc(db, 'users', memberId));
        if (!memberUserDoc.exists()) {
            console.log(`addTeamMember: Joueur à ajouter ${memberId} non trouvé.`);
            return res.status(404).json({ success: false, message: "Joueur à ajouter non trouvé." });
        }
        const memberUserData = memberUserDoc.data();
        console.log(`addTeamMember: Données du joueur à ajouter récupérées: ${JSON.stringify(memberUserData)}.`);


        // Vérifier si le joueur est déjà membre de l'équipe actuelle
        const isAlreadyInCurrentTeam = teamData.members.some(m => m.userId === memberId);
        if (isAlreadyInCurrentTeam) {
            console.log(`addTeamMember: Le joueur ${memberId} est déjà membre de l'équipe ${teamId}.`);
            return res.status(400).json({ success: false, message: "Ce joueur est déjà membre de cette équipe." });
        }
        console.log(`addTeamMember: Le joueur ${memberId} n'est pas déjà membre de l'équipe actuelle.`);

        // Selon la règle métier, un joueur peut être dans plusieurs tournois.
        // La vérification si le joueur est déjà inscrit dans un AUTRE événement est donc supprimée.
        // La seule vérification nécessaire est qu'il ne soit pas déjà dans l'équipe actuelle.
        // S'il est joueur libre dans le tournoi actuel, il sera retiré de la liste des joueurs libres plus bas.


        // Supprimer le joueur de la liste des joueurs libres de cet événement s'il y est
        const unassignedPlayerRef = doc(db, `events/${tournamentId}/unassignedPlayers`, memberId);
        const unassignedPlayerSnap = await getDoc(unassignedPlayerRef);
        if (unassignedPlayerSnap.exists()) {
            console.log(`addTeamMember: Suppression du joueur ${memberId} de la liste des joueurs libres de l'événement ${tournamentId}.`);
            await deleteDoc(unassignedPlayerRef);
        } else {
            console.log(`addTeamMember: Le joueur ${memberId} n'était pas dans la liste des joueurs libres de l'événement ${tournamentId}.`);
        }

        await updateDoc(teamRef, {
            members: arrayUnion({ userId: memberId, pseudo: memberUserData.pseudo, level: memberUserData.level })
        });
        console.log(`addTeamMember: Membre ${memberId} ajouté à l'équipe ${teamId}.`);

        res.json({ success: true, message: "Membre ajouté à l'équipe avec succès." });
        console.log("addTeamMember: Fin de la fonction avec succès.");

    } catch (error) {
        console.error("addTeamMember: Erreur lors de l'ajout d'un membre à l'équipe:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de l'ajout du membre." });
    }
};

/**
 * Gère le retrait d'un membre d'une équipe.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.removeTeamMember = async (req, res) => {
    if (!req.session.user) {
        console.log("removeTeamMember: Utilisateur non authentifié.");
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }
    const teamId = req.params.id;
    const { tournamentId, memberId } = req.body;
    const userId = req.session.user.uid; // Capitaine qui effectue l'action

    console.log(`removeTeamMember: Tentative de retrait du membre ${memberId} de l'équipe ${teamId} pour le tournoi ${tournamentId} par le capitaine ${userId}.`);

    try {
        const teamRef = doc(db, `events/${tournamentId}/teams`, teamId);
        const teamDoc = await getDoc(teamRef);

        if (!teamDoc.exists()) {
            console.log(`removeTeamMember: Équipe ${teamId} non trouvée.`);
            return res.status(404).json({ success: false, message: "Équipe non trouvée." });
        }
        const teamData = teamDoc.data();
        console.log(`removeTeamMember: Données de l'équipe récupérées. Capitaine de l'équipe: ${teamData.captainId}.`);

        if (teamData.captainId !== userId) {
            console.log(`removeTeamMember: Accès refusé. L'utilisateur ${userId} n'est pas le capitaine de cette équipe (capitaine: ${teamData.captainId}).`);
            return res.status(403).json({ success: false, message: "Accès refusé. Vous n'êtes pas le capitaine de cette équipe." });
        }
        console.log(`removeTeamMember: L'utilisateur ${userId} est bien le capitaine.`);

        const memberToRemove = teamData.members.find(m => m.userId === memberId);
        if (!memberToRemove) {
            console.log(`removeTeamMember: Membre ${memberId} non trouvé dans l'équipe ${teamId}.`);
            return res.status(404).json({ success: false, message: "Membre non trouvé dans l'équipe." });
        }
        console.log(`removeTeamMember: Membre à retirer trouvé: ${JSON.stringify(memberToRemove)}.`);

        // Si le membre à retirer est le capitaine, empêcher la suppression directe
        if (memberId === teamData.captainId) {
            console.log(`removeTeamMember: Tentative de retirer le capitaine ${memberId} de l'équipe.`);
            return res.status(400).json({ success: false, message: "Le capitaine ne peut pas être retiré de l'équipe de cette manière. Transférez d'abord le rôle de capitaine ou supprimez l'équipe." });
        }
        console.log(`removeTeamMember: Le membre ${memberId} n'est pas le capitaine.`);

        const batch = writeBatch(db);
        console.log("removeTeamMember: Début de l'opération batch.");

        // Retirer le membre de l'équipe
        batch.update(teamRef, {
            members: arrayRemove(memberToRemove)
        });
        console.log(`removeTeamMember: Ajout de l'opération de retrait du membre ${memberId} de l'équipe au batch.`);

        // Ajouter le membre à la liste des joueurs libres de cet événement
        batch.set(doc(db, `events/${tournamentId}/unassignedPlayers`, memberId), {
            userId: memberToRemove.userId,
            pseudo: memberToRemove.pseudo,
            level: memberToRemove.level,
            teamId: teamId, // Ajouter l'ID de l'équipe d'origine
            tournamentId: tournamentId // Ajouter l'ID du tournoi
        });
        console.log(`removeTeamMember: Ajout de l'opération d'ajout du membre ${memberId} aux joueurs libres au batch.`);

        await batch.commit();
        console.log("removeTeamMember: Opération batch terminée avec succès.");

        res.json({ success: true, message: "Membre retiré de l'équipe et ajouté aux joueurs libres." });

    } catch (error) {
        console.error("removeTeamMember: Erreur lors du retrait d'un membre de l'équipe:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors du retrait du membre." });
    }
};

/**
 * Gère l'ajout d'un membre à une équipe par le capitaine (potentiellement un membre "virtuel" ou existant).
 * Cette fonction est similaire à addTeamMember mais est appelée via une route différente
 * et pourrait avoir des logiques spécifiques si un "membre virtuel" signifie autre chose qu'un utilisateur existant.
 * Pour l'instant, elle réutilise la logique d'ajout d'un membre existant.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.addTeamMemberByCaptain = async (req, res) => {
    console.log("addTeamMemberByCaptain: Début de la fonction.");
    if (!req.session.user) {
        console.log("addTeamMemberByCaptain: Utilisateur non authentifié.");
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }
    const teamId = req.params.id;
    const { tournamentId, memberId, pseudo, level, email } = req.body; // memberId est l'ID de l'utilisateur à ajouter, pseudo, level, email pour la création
    const userId = req.session.user.uid; // Capitaine qui effectue l'action

    console.log(`addTeamMemberByCaptain: Début de la fonction. teamId=${teamId}, tournamentId=${tournamentId}, memberId=${memberId}, pseudo=${pseudo}, level=${level}, email=${email}, captainId=${userId}`);

    try {
        let finalMemberId = memberId;
        let memberUserData = {};

        if (!finalMemberId) {
            // Si memberId n'est pas fourni, tenter de créer un nouvel utilisateur
            if (!pseudo || !level) { // L'email n'est plus requis du body
                console.log("addTeamMemberByCaptain: Informations de création de joueur virtuel manquantes (pseudo, level).");
                return res.status(400).json({ success: false, message: "L'ID du membre à ajouter est manquant, ou les informations pour créer un joueur virtuel sont incomplètes (pseudo, level)." });
            }

            let finalEmail = email;
            if (!finalEmail) {
                // Générer un email unique si non fourni
                finalEmail = `${pseudo.toLowerCase().replace(/\s/g, '')}-${Date.now()}@virtual.tournoi.com`;
                console.log(`addTeamMemberByCaptain: Email non fourni, génération d'un email virtuel: ${finalEmail}`);
            } else {
                console.log(`addTeamMemberByCaptain: Email fourni: ${finalEmail}`);
            }
            
            // Créer un utilisateur dans Firebase Authentication
            const userRecord = await adminAuth.createUser({
                email: finalEmail, // Utiliser l'email fourni ou généré
                password: Math.random().toString(36).slice(-8), // Mot de passe temporaire
                displayName: pseudo,
            });
            finalMemberId = userRecord.uid;

            // Ajouter les données de l'utilisateur à Firestore en utilisant adminDb (SDK Admin)
            await adminDb.collection('users').doc(finalMemberId).set({
                pseudo: pseudo,
                level: level,
                email: finalEmail, // Utiliser l'email fourni ou généré
                // Ajoutez d'autres champs par défaut si nécessaire
            });
            memberUserData = { pseudo, level, email: finalEmail }; // Inclure l'email fourni ou généré
            console.log(`addTeamMemberByCaptain: Nouvel utilisateur virtuel créé avec ID: ${finalMemberId}`);

        } else {
            // Si memberId est fourni, récupérer les données de l'utilisateur existant
            const memberUserDoc = await getDoc(doc(db, 'users', finalMemberId));
            if (!memberUserDoc.exists()) {
                console.log(`addTeamMemberByCaptain: Joueur à ajouter ${finalMemberId} non trouvé.`);
                return res.status(404).json({ success: false, message: "Joueur à ajouter non trouvé." });
            }
            memberUserData = memberUserDoc.data();
            console.log(`addTeamMemberByCaptain: Données du joueur à ajouter récupérées: ${JSON.stringify(memberUserData)}.`);
        }

        const teamRef = doc(db, `events/${tournamentId}/teams`, teamId);
        const teamDoc = await getDoc(teamRef);

        if (!teamDoc.exists()) {
            console.log(`addTeamMemberByCaptain: Équipe ${teamId} non trouvée.`);
            return res.status(404).json({ success: false, message: "Équipe non trouvée." });
        }
        const teamData = teamDoc.data();
        console.log(`addTeamMemberByCaptain: Données de l'équipe récupérées. Capitaine de l'équipe: ${teamData.captainId}.`);

        if (teamData.captainId !== userId) {
            console.log(`addTeamMemberByCaptain: Accès refusé. L'utilisateur ${userId} n'est pas le capitaine de cette équipe (capitaine: ${teamData.captainId}).`);
            return res.status(403).json({ success: false, message: "Accès refusé. Vous n'êtes pas le capitaine de cette équipe." });
        }
        console.log(`addTeamMemberByCaptain: L'utilisateur ${userId} est bien le capitaine.`);

        const tournamentDoc = await getDoc(doc(db, 'events', tournamentId));
        if (!tournamentDoc.exists()) {
            console.log(`addTeamMemberByCaptain: Tournoi ${tournamentId} non trouvé.`);
            return res.status(404).json({ success: false, message: "Tournoi non trouvé." });
        }
        const tournamentData = tournamentDoc.data();
        console.log(`addTeamMemberByCaptain: Données du tournoi récupérées. Players per team: ${tournamentData.playersPerTeam}.`);

        // Vérifier si le tournoi est complet avant d'ajouter un membre
        const allTeamsSnapshot = await getDocs(collection(db, `events/${tournamentId}/teams`));
        let completeTeamsCount = 0;
        allTeamsSnapshot.forEach(tDoc => {
            const tData = tDoc.data();
            if (tournamentData.minPlayersPerTeam && tData.members && tData.members.length >= tournamentData.minPlayersPerTeam) {
                completeTeamsCount++;
            }
        });

        if (completeTeamsCount >= tournamentData.maxTeams) {
            return res.status(400).json({ success: false, message: "Le tournoi est complet (nombre maximum d'équipes complètes atteint). Impossible d'ajouter un membre." });
        }

        if (teamData.members.length >= tournamentData.playersPerTeam) {
            console.log(`addTeamMemberByCaptain: L'équipe est pleine (${teamData.members.length}/${tournamentData.playersPerTeam}).`);
            return res.status(400).json({ success: false, message: "L'équipe a atteint le nombre maximum de membres." });
        }
        console.log(`addTeamMemberByCaptain: L'équipe n'est pas pleine (${teamData.members.length}/${tournamentData.playersPerTeam}).`);

        // Vérifier si le joueur est déjà membre de l'équipe actuelle
        const isAlreadyInCurrentTeam = teamData.members.some(m => m.userId === finalMemberId);
        if (isAlreadyInCurrentTeam) {
            console.log(`addTeamMemberByCaptain: Le joueur ${finalMemberId} est déjà membre de l'équipe ${teamId}.`);
            return res.status(400).json({ success: false, message: "Ce joueur est déjà membre de cette équipe." });
        }
        console.log(`addTeamMemberByCaptain: Le joueur ${finalMemberId} n'est pas déjà membre de l'équipe actuelle.`);

        // Supprimer le joueur de la liste des joueurs libres de cet événement s'il y est
        const unassignedPlayerRef = doc(db, `events/${tournamentId}/unassignedPlayers`, finalMemberId);
        const unassignedPlayerSnap = await getDoc(unassignedPlayerRef);
        if (unassignedPlayerSnap.exists()) {
            console.log(`addTeamMemberByCaptain: Suppression du joueur ${finalMemberId} de la liste des joueurs libres de l'événement ${tournamentId}.`);
            await deleteDoc(unassignedPlayerRef);
        } else {
            console.log(`addTeamMemberByCaptain: Le joueur ${finalMemberId} n'était pas dans la liste des joueurs libres de l'événement ${tournamentId}.`);
        }

        await updateDoc(teamRef, {
            members: arrayUnion({ userId: finalMemberId, pseudo: memberUserData.pseudo, level: memberUserData.level })
        });
        console.log(`addTeamMemberByCaptain: Membre ${finalMemberId} ajouté à l'équipe ${teamId}.`);

        res.json({ success: true, message: "Membre ajouté à l'équipe avec succès." });
        console.log("addTeamMemberByCaptain: Fin de la fonction avec succès.");

    } catch (error) {
        console.error("addTeamMemberByCaptain: Erreur lors de l'ajout d'un membre à l'équipe:", error);
        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({ success: false, message: "L'adresse e-mail est déjà utilisée par un autre compte." });
        }
        res.status(500).json({ success: false, message: "Erreur serveur lors de l'ajout du membre." });
    }
};
