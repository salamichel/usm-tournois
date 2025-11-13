const App = {
    init() {
        window.addEventListener('hashchange', this.router.bind(this));
        window.addEventListener('load', () => {
            this.router(); // Then run router
        });
        document.body.addEventListener('click', this.handleGlobalClick.bind(this));
    },

    router() {
        const path = window.location.pathname;
        const hash = window.location.hash;

        console.log(`[DEBUG - Router] Path: ${path}, Hash: ${hash}`);

        // Handle server-rendered pages (e.g., /tournoi/:id or /mon-compte)
        if (path.startsWith('/tournoi/') || path === '/mon-compte' || path === '/') { // Ajout de '/' pour la page d'accueil
            console.log(`[DEBUG - Router] Page rendue par le serveur: ${path}`);

            if (path === '/mon-compte') {
                // No client-side view activation needed for /mon-compte as it's a full server-rendered page
                return;
            }

            // For server-rendered pages, we only manage sub-views via hash
            const detailView = document.getElementById('view-detail');
            const resultsView = document.getElementById('view-results');

            if (detailView) detailView.classList.remove('active');
            if (resultsView) resultsView.classList.remove('active');

            if (hash === '#results') {
                if (resultsView) {
                    resultsView.classList.add('active');
                    console.log(`[DEBUG - Router] Activation de la sous-vue résultats.`);
                }
            } else { // Default to detail view if no hash or #detail
                if (detailView) {
                    detailView.classList.add('active');
                    console.log(`[DEBUG - Router] Activation de la sous-vue détail.`);
                }
            }
            // Initialize tabs for server-rendered views if they exist
            if (document.getElementById('view-detail')) {
                const initialDetailTabButton = document.querySelector('.detail-tab-btn.active') || document.querySelector('.detail-tab-btn');
                if (initialDetailTabButton) {
                    this.setupTabs('detail-tab-btn', 'detail-tab-panel', 'tab-detail-', initialDetailTabButton, 'detailTab'); // 'detailTab' correspond à 'data-detail-tab'
                }
            }
            if (document.getElementById('view-results')) {
                const initialResultsTabButton = document.querySelector('.results-tab-btn.active') || document.querySelector('.results-tab-btn');
                if (initialResultsTabButton) {
                    this.setupTabs('results-tab-btn', 'results-tab-panel', 'tab-results-', initialResultsTabButton, 'resultsTab'); // 'resultsTab' correspond à 'data-results-tab'
                }
            }

        } else { // Handle client-side hash routing for other pages
            const [viewName, param] = hash.slice(1).split('/');
            console.log(`[DEBUG - Router] Routage côté client. Vue: ${viewName}, Param: ${param}`);
            let activeViewElement = null;
            switch (viewName) {
                case 'tournament':
                    // Pour le routage client, nous activons simplement la vue EJS déjà rendue par le serveur.
                    // Le contenu dynamique est déjà là.
                    activeViewElement = document.getElementById('view-detail');
                    console.log(`[DEBUG - Router] Activation de la vue détail (via hash).`);
                    break;
                case 'dashboard':
                    // Le tableau de bord est maintenant rendu par EJS côté serveur
                    console.log(`[DEBUG - Router] Le tableau de bord est rendu par le serveur.`);
                    break;
                case 'login':
                    // La page de connexion est maintenant rendue par EJS côté serveur
                    console.log(`[DEBUG - Router] La page de connexion est rendue par le serveur.`);
                    break;
                case 'manage-team':
                    // La page de gestion d'équipe est maintenant rendue par EJS côté serveur
                    console.log(`[DEBUG - Router] La page de gestion d'équipe est rendue par le serveur.`);
                    break;
                case 'tournaments-list':
                default:
                    // La liste des tournois est maintenant rendue par EJS côté serveur
                    console.log(`[DEBUG - Router] La liste des tournois est rendue par le serveur.`);
            }
        }
        window.scrollTo(0, 0); // Scroll to top on view change
    },

    handleGlobalClick(e) {
        const target = e.target;

        // User menu
        const userMenuBtn = target.closest('#user-menu-btn');
        const userDropdown = document.getElementById('user-dropdown');
        if (userMenuBtn) {
            userDropdown.classList.toggle('hidden');
        } else if (userDropdown && !userDropdown.classList.contains('hidden') && !target.closest('#user-dropdown')) {
            userDropdown.classList.add('hidden');
        }

        // Admin menu
        const adminMenuBtn = target.closest('#admin-menu-btn');
        const adminDropdown = document.getElementById('admin-dropdown');
        if (adminMenuBtn) {
            adminDropdown.classList.toggle('hidden');
        } else if (adminDropdown && !adminDropdown.classList.contains('hidden') && !target.closest('#admin-dropdown')) {
            adminDropdown.classList.add('hidden');
        }

        // Logout
        if (target.closest('#logout-btn')) {
            e.preventDefault();
            fetch('/auth/logout', { method: 'POST' })
                .then(() => {
                    trackEvent('logout', 'User', 'Successful Logout');
                    window.location.href = '/';
                })
                .catch(error => {
                    console.error('Erreur lors de la déconnexion:', error);
                    showToast('Erreur lors de la déconnexion.', 'error');
                    trackEvent('logout_error', 'User', 'Logout Failed', error.message);
                });
        }

        // Tabs logic for tournament detail and results
        const detailTabButton = target.closest('.detail-tab-btn');
        if (detailTabButton) {
            this.setupTabs('detail-tab-btn', 'detail-tab-panel', 'tab-detail-', detailTabButton, 'detailTab'); // 'detailTab' correspond à 'data-detail-tab'
        }

        const resultsTabButton = target.closest('.results-tab-btn');
        if (resultsTabButton) {
            this.setupTabs('results-tab-btn', 'results-tab-panel', 'tab-results-', resultsTabButton, 'resultsTab'); // 'resultsTab' correspond à 'data-results-tab'
        }
    },

    setupTabs(buttonClass, panelClass, panelPrefix, clickedButton, dataAttributeName) {
        const tabButtons = document.querySelectorAll(`.${buttonClass}`);
        const tabPanels = document.querySelectorAll(`.${panelClass}`);

        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains('detail-tab-btn')) {
                btn.classList.remove('border-blue-500', 'text-blue-400');
                btn.classList.add('border-transparent', 'text-gray-400', 'hover:text-white');
            } else {
                btn.classList.remove('bg-blue-600', 'text-white');
            }
        });
        tabPanels.forEach(panel => panel.classList.remove('active'));

        clickedButton.classList.add('active');
        if (clickedButton.classList.contains('detail-tab-btn')) {
            clickedButton.classList.add('border-blue-500', 'text-blue-400');
            clickedButton.classList.remove('border-transparent', 'text-gray-400', 'hover:text-white');
        } else {
            clickedButton.classList.add('bg-blue-600', 'text-white');
        }
        
        const panelIdSuffix = clickedButton.dataset[dataAttributeName];

        if (!panelIdSuffix) {
            console.warn(`[WARN - setupTabs] Missing data-${dataAttributeName} attribute on clicked button. Cannot activate panel.`);
            return; // Exit if data attribute is missing
        }

        document.getElementById(`${panelPrefix}${panelIdSuffix}`).classList.add('active');
    },

    renderTournamentDetail(id) {
        // Le rendu est géré par EJS côté serveur.
        // Cette fonction est un placeholder pour le routeur.
    },

    renderTournamentResults(id) {
        // Le rendu est géré par EJS côté serveur.
        // Cette fonction est un placeholder pour le routeur.
    },

    renderDashboard() {
        // Cette fonction n'est plus utilisée car le tableau de bord est rendu par EJS
        // et les données utilisateur sont passées via res.locals.currentUser
    }
};

    // Fonction utilitaire pour envoyer des événements Google Analytics
    function trackEvent(eventName, eventCategory, eventLabel, eventValue) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, {
                'event_category': eventCategory,
                'event_label': eventLabel,
                'value': eventValue
            });
            console.log(`[GA Event] ${eventName} | Category: ${eventCategory} | Label: ${eventLabel} | Value: ${eventValue}`);
        } else {
            console.warn('gtag is not defined. Google Analytics event not sent.');
        }
    }

    // Fonction pour afficher les toasts
    function showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            console.error('Toast container not found!');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `relative flex items-center w-full max-w-xs p-4 text-gray-500 bg-white rounded-lg shadow dark:text-gray-400 dark:bg-gray-800 transform translate-x-full transition-transform duration-300 ease-out`;
        
        let iconClasses = '';
        let textClasses = '';
        let bgClasses = '';

        switch (type) {
            case 'success':
                iconClasses = 'text-green-500 dark:text-green-400';
                textClasses = 'text-green-700 dark:text-green-300';
                bgClasses = 'bg-green-100 dark:bg-green-900';
                break;
            case 'error':
                iconClasses = 'text-red-500 dark:text-red-400';
                textClasses = 'text-red-700 dark:text-red-300';
                bgClasses = 'bg-red-100 dark:bg-red-900';
                break;
            case 'info':
            default:
                iconClasses = 'text-blue-500 dark:text-blue-400';
                textClasses = 'text-blue-700 dark:text-blue-300';
                bgClasses = 'bg-blue-100 dark:bg-blue-900';
                break;
        }

        toast.innerHTML = `
            <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 ${bgClasses} rounded-lg ${iconClasses}">
                ${type === 'success' ? '<i class="fas fa-check"></i>' : ''}
                ${type === 'error' ? '<i class="fas fa-times"></i>' : ''}
                ${type === 'info' ? '<i class="fas fa-info"></i>' : ''}
                <span class="sr-only">${type} icon</span>
            </div>
            <div class="ml-3 text-sm font-normal ${textClasses}">${message}</div>
            <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" data-dismiss-target="#toast-default" aria-label="Close">
                <span class="sr-only">Close</span>
                <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                </svg>
            </button>
        `;

        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10); // Small delay to ensure reflow for transition

        // Auto-dismiss
        const timeoutId = setTimeout(() => {
            toast.style.transform = 'translateX(calc(100% + 1rem))'; // Move out to the right
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);

        // Dismiss on click
        toast.querySelector('button').addEventListener('click', () => {
            clearTimeout(timeoutId); // Clear auto-dismiss timeout
            toast.style.transform = 'translateX(calc(100% + 1rem))'; // Move out to the right
            toast.addEventListener('transitionend', () => toast.remove());
        });
    }

    App.init();

    // Fonction pour stocker un message de toast avant un rechargement/redirection
    function storeToastMessage(message, type) {
        sessionStorage.setItem('toastMessage', message);
        sessionStorage.setItem('toastType', type);
    }

    // Fonction pour afficher un message de toast stocké après un rechargement
    function displayStoredToastMessage() {
        const storedMessage = sessionStorage.getItem('toastMessage');
        const storedType = sessionStorage.getItem('toastType');

        if (storedMessage && storedType) {
            showToast(storedMessage, storedType);
            sessionStorage.removeItem('toastMessage');
            sessionStorage.removeItem('toastType');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        displayStoredToastMessage(); // Afficher les messages stockés au chargement de la page

        // --- Copy Link Functionality (Gestion d'équipe) ---
        const copyBtn = document.getElementById('copy-link-btn');
        const linkInput = document.getElementById('invite-link-input');
        // const toast = document.getElementById('toast'); // Ancien toast, à supprimer ou adapter

        if (copyBtn && linkInput) { // toast n'est plus nécessaire ici
            copyBtn.addEventListener('click', () => {
                linkInput.select();
                document.execCommand('copy');
                showToast('Lien copié dans le presse-papiers !', 'info'); // Utiliser le nouveau toast
            });
        }

        // --- Actions des joueurs sur les tournois ---
        document.body.addEventListener('click', async (e) => {
            const target = e.target.closest('.action-btn');
            if (!target) return;

            const eventId = target.dataset.eventId;
            const action = target.dataset.action;

            if (!eventId || !action) return;

            let url = '';
            let method = 'POST';
            let body = {};

            switch (action) {
                case 'register-player':
                    url = `/tournoi/${eventId}/register-player`;
                    break;
                case 'leave-tournament':
                    if (!confirm('Êtes-vous sûr de vouloir quitter ce tournoi en tant que joueur libre ?')) {
                        return;
                    }
                    url = `/tournoi/${eventId}/leave-tournament`;
                    break;
                case 'leave-team':
                    if (!confirm('Êtes-vous sûr de vouloir quitter cette équipe ?')) {
                        return;
                    }
                    url = `/tournoi/${eventId}/leave-team`;
                    const teamId = target.dataset.teamId;
                    if (!teamId) {
                        showToast("Erreur: ID de l'équipe manquant pour quitter l'équipe.", 'error');
                        return;
                    }
                    body = JSON.stringify({ teamId: teamId });
                    break;
                case 'create-team':
                    // Cette action sera gérée par une modale ou une redirection, pas un simple fetch ici.
                    // Pour l'instant, nous laissons le bouton tel quel.
                    console.log("Action 'create-team' cliquée. Logique à implémenter.");
                    trackEvent('create_team_button_click', 'Tournament Actions', 'Create Team Button Clicked');
                    return;
                case 'join-waiting-list':
                    if (!confirm('Êtes-vous sûr de vouloir rejoindre la liste d\'attente pour ce tournoi ?')) {
                        return;
                    }
                    url = `/tournoi/${eventId}/join-waiting-list`;
                    break;
                default:
                    console.warn(`Action inconnue: ${action}`);
                    return;
            }

            try {
                const fetchOptions = {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                };
                if (Object.keys(body).length > 0) {
                    fetchOptions.body = body;
                }

                const response = await fetch(url, fetchOptions);
                const data = await response.json();
                console.log(`[DEBUG - AJAX Response] Data received for tournament action:`, data);

                if (data.success) {
                    storeToastMessage(data.message, 'success'); // Stocker le message avant le rechargement
                    trackEvent(action, 'Tournament Actions', `Successful ${action}`, eventId);
                    window.location.reload(); // Recharger la page pour mettre à jour l'état
                } else {
                    showToast(`Erreur: ${data.message}`, 'error');
                    trackEvent(`${action}_error`, 'Tournament Actions', `Failed ${action}`, eventId);
                }
            } catch (error) {
                console.error(`[DEBUG - AJAX Error] Erreur lors de l'action ${action}:`, error);
                showToast("Une erreur est survenue.", 'error');
                trackEvent(`${action}_error`, 'Tournament Actions', `Error during ${action} fetch`, eventId);
            }
        });

        // --- Actions de gestion d'équipe ---
        document.body.addEventListener('click', async (e) => {
            const target = e.target.closest('.remove-player-btn') || e.target.closest('.add-player-btn');
            if (!target) return;

            e.stopPropagation(); // Empêche l'événement de remonter le DOM
            e.stopImmediatePropagation(); // Empêche d'autres écouteurs du même événement d'être appelés

            const teamId = target.closest('[data-team-id]')?.dataset.teamId || document.querySelector('[data-team-id]')?.dataset.teamId || document.querySelector('#team-id')?.value || document.querySelector('#team-name')?.closest('form')?.action.split('/').slice(-2, -1)[0];
            const tournamentId = new URLSearchParams(window.location.search).get('tournamentId');
            const action = target.classList.contains('remove-player-btn') ? 'remove-member' : 'add-member';
            const memberId = target.dataset.memberId || target.dataset.agentId;

            if (!teamId || !tournamentId || !action || !memberId) {
                console.error("Informations manquantes pour l'action d'équipe.");
                showToast("Informations manquantes pour l'action d'équipe.", 'error');
                return;
            }

            let url = `/gestion-equipe/${teamId}/${action}`;
            let method = 'POST';
            let body = JSON.stringify({ tournamentId, memberId });

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });
                console.log(`[DEBUG - AJAX Response] Raw response for team action:`, response);
                const data = await response.json();
                console.log(`[DEBUG - AJAX Response] Data received for team action:`, data);

                if (data.success) {
                    storeToastMessage(data.message, 'success'); // Stocker le message avant le rechargement
                    trackEvent(action, 'Team Management', `Successful ${action}`, `${teamId}-${memberId}`);
                    window.location.reload();
                } else {
                    showToast(`Erreur: ${data.message}`, 'error');
                    trackEvent(`${action}_error`, 'Team Management', `Failed ${action}`, `${teamId}-${memberId}`);
                }
            } catch (error) {
                console.error(`[DEBUG - AJAX Error] Erreur lors de l'action d'équipe ${action}:`, error);
                showToast("Une erreur est survenue.", 'error');
                trackEvent(`${action}_error`, 'Team Management', `Error during ${action} fetch`, `${teamId}-${memberId}`);
            }
        });

        // --- Soumission du formulaire de paramètres d'équipe ---
        const teamSettingsForm = document.querySelector('#team-settings-form'); // Assurez-vous que le formulaire a un ID
        if (teamSettingsForm) {
            teamSettingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                // Récupérer teamId et tournamentId de l'URL ou des attributs data-
                const urlParams = new URLSearchParams(window.location.search);
                const pathSegments = window.location.pathname.split('/');
                const teamId = pathSegments[pathSegments.indexOf('gestion-equipe') + 1] || document.querySelector('main')?.dataset.teamId;
                const tournamentId = urlParams.get('tournamentId') || document.querySelector('main')?.dataset.tournamentId;
                
                const teamNameInput = document.getElementById('team-name');

                const teamName = teamNameInput ? teamNameInput.value : undefined;
                
                console.log(`[DEBUG - teamSettingsForm] teamId: ${teamId}, tournamentId: ${tournamentId}, teamName: ${teamName}recruitmentOpen}`);

                if (!teamId || !tournamentId || teamName === undefined) {
                    console.error("Erreur: Informations manquantes pour la mise à jour des paramètres de l'équipe.");
                    showToast("Erreur: Informations manquantes pour la mise à jour des paramètres de l'équipe.", 'error');
                    return;
                }

                const url = `/gestion-equipe/${teamId}/update-settings`;
                const method = 'POST';
                const body = JSON.stringify({ tournamentId, teamName });

                try {
                    const response = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: body
                    });
                    console.log(`[DEBUG - AJAX Response] Raw response for team settings update:`, response);
                    const data = await response.json();
                    console.log(`[DEBUG - AJAX Response] Data received for team settings update:`, data);

                    if (data.success) {
                        storeToastMessage(data.message, 'success'); // Stocker le message avant le rechargement
                        trackEvent('update_team_settings', 'Team Management', 'Successful Team Settings Update', teamId);
                        window.location.reload();
                    } else {
                        showToast(`Erreur: ${data.message}`, 'error');
                        trackEvent('update_team_settings_error', 'Team Management', 'Failed Team Settings Update', teamId);
                    }
                } catch (error) {
                    console.error(`[DEBUG - AJAX Error] Erreur lors de la mise à jour des paramètres de l'équipe:`, error);
                    showToast("Une erreur est survenue.", 'error');
                    trackEvent('update_team_settings_error', 'Team Management', 'Error during Team Settings Update fetch', teamId);
                }
            });
        }

        // --- Soumission du formulaire de création d'équipe (sur la page de détail du tournoi) ---
        document.body.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action="create-team"]');
            if (!target) return;

            const eventId = target.dataset.eventId;
            const teamName = prompt("Veuillez entrer le nom de la nouvelle équipe :");

            if (!teamName) return; // L'utilisateur a annulé

            const url = `/tournoi/${eventId}/create-team`;
            const method = 'POST';
            const body = JSON.stringify({ teamName });

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });
                console.log(`[DEBUG - AJAX Response] Raw response for create team:`, response);
                const data = await response.json();
                console.log(`[DEBUG - AJAX Response] Data received for create team:`, data);

                if (data.success) {
                    storeToastMessage(data.message, 'success'); // Stocker le message avant la redirection
                    trackEvent('create_team_prompt', 'Team Management', 'Successful Team Creation via Prompt', eventId);
                    window.location.href = `/gestion-equipe/${data.teamId}?tournamentId=${eventId}`; // Rediriger vers la page de gestion d'équipe
                } else {
                    showToast(`Erreur: ${data.message}`, 'error');
                    trackEvent('create_team_prompt_error', 'Team Management', 'Failed Team Creation via Prompt', eventId);
                }
            } catch (error) {
                console.error(`[DEBUG - AJAX Error] Erreur lors de la création de l'équipe:`, error);
                showToast("Une erreur est survenue.", 'error');
                trackEvent('create_team_prompt_error', 'Team Management', 'Error during Team Creation via Prompt fetch', eventId);
            }
        });

        // --- Soumission du formulaire pour rejoindre une équipe existante ---
        const joinTeamForm = document.getElementById('join-team-form');
        if (joinTeamForm) {
            joinTeamForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const eventId = joinTeamForm.dataset.eventId; // Extraire l'ID du tournoi de l'attribut data-event-id
                const teamId = document.getElementById('team-select').value;

                if (!teamId) {
                    showToast("Veuillez sélectionner une équipe à rejoindre.", 'info');
                    return;
                }

                const url = `/tournoi/${eventId}/rejoindre-equipe`;
                const method = 'POST';
                const body = JSON.stringify({ teamId });

                try {
                    const response = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: body
                    });
                console.log(`[DEBUG - AJAX Response] Raw response for join team:`, response);
                const data = await response.json();
                console.log(`[DEBUG - AJAX Response] Data received for join team:`, data);

                if (data.success) {
                    storeToastMessage(data.message, 'success'); // Stocker le message avant le rechargement
                    trackEvent('join_team', 'Team Management', 'Successful Team Join', `${eventId}-${teamId}`);
                    window.location.reload(); // Recharger la page pour mettre à jour l'état
                } else {
                    showToast(`Erreur: ${data.message}`, 'error');
                    trackEvent('join_team_error', 'Team Management', 'Failed Team Join', `${eventId}-${teamId}`);
                }
            } catch (error) {
                console.error(`[DEBUG - AJAX Error] Erreur lors de la tentative de rejoindre l'équipe:`, error);
                showToast("Une erreur est survenue.", 'error');
                trackEvent('join_team_error', 'Team Management', 'Error during Team Join fetch', `${eventId}-${teamId}`);
            }
        });
        }

        // --- Login/Signup Form Toggle (Page de connexion) ---
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const showSignupLink = document.getElementById('show-signup');
        const showLoginLink = document.getElementById('show-login');

        if (loginForm && signupForm && showSignupLink && showLoginLink) {
            showSignupLink.addEventListener('click', (e) => {
                e.preventDefault();
                loginForm.classList.add('hidden');
                signupForm.classList.remove('hidden');
                trackEvent('view_signup_form', 'Authentication', 'View Signup Form');
            });

            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                signupForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                trackEvent('view_login_form', 'Authentication', 'View Login Form');
            });
        }

        // --- Share Tournament Functionality ---
        const shareBtn = document.getElementById('share-tournament-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                const tournamentTitle = document.querySelector('h1').textContent;
                const shareData = {
                    title: `Tournoi: ${tournamentTitle}`,
                    text: `Rejoignez le tournoi ${tournamentTitle} !`,
                    url: window.location.href
                };
                try {
                    if (navigator.share) {
                        await navigator.share(shareData);
                        console.log('Tournoi partagé avec succès');
                        trackEvent('share_tournament', 'Tournament Actions', 'Successful Share', tournamentTitle);
                    } else {
                        // Fallback for browsers that do not support the Web Share API
                        await navigator.clipboard.writeText(window.location.href);
                        showToast('Lien du tournoi copié dans le presse-papiers !', 'info');
                        trackEvent('share_tournament_fallback_copy', 'Tournament Actions', 'Copied Link to Clipboard', tournamentTitle);
                    }
                } catch (err) {
                    console.error('Erreur lors du partage:', err);
                    trackEvent('share_tournament_error', 'Tournament Actions', 'Share Failed', tournamentTitle);
                    // Fallback in case of error (e.g., user cancels share)
                    try {
                        await navigator.clipboard.writeText(window.location.href);
                        showToast('Le partage a été annulé. Le lien a été copié dans le presse-papiers.', 'info');
                        trackEvent('share_tournament_error_fallback_copy', 'Tournament Actions', 'Copied Link to Clipboard after Error', tournamentTitle);
                    } catch (copyErr) {
                        console.error('Erreur lors de la copie du lien:', copyErr);
                        showToast('Impossible de partager ou de copier le lien.', 'error');
                        trackEvent('share_tournament_copy_error', 'Tournament Actions', 'Failed to Copy Link', tournamentTitle);
                    }
                }
            });
        }
    });
