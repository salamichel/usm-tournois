// middleware/flash.middleware.js
module.exports = (req, res, next) => {
    console.log(`[Flash Middleware] req.session.flashMessage before processing:`, req.session.flashMessage);
    // Toujours définir res.locals.flashMessage pour éviter les ReferenceError
    res.locals.flashMessage = req.session.flashMessage || null;
    // Supprimer le message flash de la session après l'avoir rendu disponible
    if (req.session.flashMessage) {
        console.log(`[Flash Middleware] Deleting req.session.flashMessage:`, req.session.flashMessage);
        delete req.session.flashMessage;
    }
    console.log(`[Flash Middleware] res.locals.flashMessage after processing:`, res.locals.flashMessage);
    next();
};
