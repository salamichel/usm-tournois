const { getDocById } = require('../services/admin.firestore.utils');

/**
 * Middleware pour récupérer un tournoi par son ID et le stocker dans req.tournament.
 * Gère les erreurs si le tournoi n'est pas trouvé.
 */
async function getTournament(req, res, next) {
    const { tournamentId } = req.params;

    if (!tournamentId) {
        req.session.flashMessage = { type: 'error', message: 'ID du tournoi manquant.' };
        return res.redirect('/admin/tournaments');
    }

    try {
        const tournament = await getDocById('events', tournamentId);
        if (!tournament) {
            req.session.flashMessage = { type: 'error', message: 'Tournoi non trouvé.' };
            return res.redirect('/admin/tournaments');
        }
        req.tournament = tournament;
        next();
    } catch (error) {
        console.error('Erreur lors de la récupération du tournoi dans le middleware:', error);
        req.session.flashMessage = { type: 'error', message: 'Erreur lors de la récupération du tournoi.' };
        res.redirect('/admin/tournaments');
    }
}

module.exports = {
    getTournament
};
