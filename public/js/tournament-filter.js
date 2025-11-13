document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const typeFilter = document.getElementById('type-filter');
    const dateFilter = document.getElementById('date-filter');
    const tournamentsGrid = document.getElementById('tournaments-grid');
    const noResultsMessage = document.getElementById('no-results');

    // Vérifier si les éléments nécessaires existent avant de continuer
    if (!searchInput || !typeFilter || !dateFilter || !tournamentsGrid || !noResultsMessage) {
        console.warn("tournament-filter.js: Certains éléments DOM nécessaires pour le filtrage des tournois sont manquants. Le script ne sera pas exécuté.");
        return; // Arrêter l'exécution du script si les éléments ne sont pas trouvés
    }

    const tournamentCards = tournamentsGrid.querySelectorAll('.tournament-card');

    function filterTournaments() {
        const searchTerm = searchInput.value.toLowerCase();
        const typeValue = typeFilter.value;
        const dateValue = dateFilter.value;
        let resultsFound = false;

        tournamentCards.forEach(card => {
            const name = card.dataset.name.toLowerCase();
            const location = card.dataset.location.toLowerCase();
            const type = card.dataset.type;
            const date = new Date(card.dataset.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const searchMatch = name.includes(searchTerm) || location.includes(searchTerm);
            const typeMatch = typeValue === 'all' || type === typeValue;
            
            let dateMatch = true;
            if (dateValue === 'prochainement') {
                dateMatch = date >= today;
            } else if (dateValue === 'passe') {
                dateMatch = date < today;
            }

            if (searchMatch && typeMatch && dateMatch) {
                card.style.display = 'flex';
                resultsFound = true;
            } else {
                card.style.display = 'none';
            }
        });

        noResultsMessage.style.display = resultsFound ? 'none' : 'block';
    }

    searchInput.addEventListener('input', filterTournaments);
    typeFilter.addEventListener('change', filterTournaments);
    dateFilter.addEventListener('change', filterTournaments);
});
