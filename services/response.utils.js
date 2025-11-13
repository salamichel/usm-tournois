/**
 * Envoie un message flash à la session et redirige vers un chemin spécifié.
 * @param {object} req L'objet de la requête Express.
 * @param {object} res L'objet de la réponse Express.
 * @param {string} type Le type du message flash (e.g., 'success', 'error', 'info').
 * @param {string} message Le contenu du message flash.
 * @param {string} path Le chemin vers lequel rediriger.
 */
function sendFlashAndRedirect(req, res, type, message, path) {
    req.session.flashMessage = { type, message };
    // Sauvegarder explicitement la session avant la redirection
    req.session.save((err) => {
        if (err) {
            console.error("Erreur lors de la sauvegarde de la session:", err);
        }
        return res.redirect(path);
    });
}

module.exports = {
    sendFlashAndRedirect
};
