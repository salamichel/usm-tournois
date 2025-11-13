const { adminDb } = require('../../services/firebase');
const { sendFlashAndRedirect } = require('../../services/response.utils');

exports.showDashboard = async (req, res) => {
    try {
        // Récupérer le nombre total d'utilisateurs
        const usersSnapshot = await adminDb.collection('users').get();
        const totalUsers = usersSnapshot.size;

        // Récupérer le nombre total de tournois (événements)
        const eventsSnapshot = await adminDb.collection('events').get();
        const totalTournaments = eventsSnapshot.size;

        // Récupérer le nombre total d'équipes (depuis les sous-collections des événements)
        let totalTeams = 0;
        for (const eventDoc of eventsSnapshot.docs) {
            const teamsSnapshot = await adminDb.collection('events').doc(eventDoc.id).collection('teams').get();
            totalTeams += teamsSnapshot.size;
        }

        res.render('admin/dashboard', {
            pageTitle: 'Tableau de Bord Admin',
            title: 'Tableau de Bord Admin',
            totalUsers,
            totalTournaments,
            totalTeams
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des métriques du tableau de bord:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération des métriques du tableau de bord.', '/admin/dashboard');
    }
};
