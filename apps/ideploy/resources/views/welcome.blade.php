<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenue - Coolify</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .gradient-bg {
            background: linear-gradient(-45deg, #6366f1, #8b5cf6, #ec4899, #f59e0b);
            background-size: 400% 400%;
            animation: gradient 15s ease infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .spinner {
            animation: spin 1s linear infinite;
        }
        .fade-in {
            animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
    <script>
        window.IDEM_API_URL = '{{ $apiUrl }}';
        window.IDEM_DASHBOARD_URL = '{{ $authUrl }}';
    </script>
</head>
<body class="gradient-bg min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full">
        <!-- Card -->
        <div class="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm bg-opacity-95">
            <!-- Logo/Icon -->
            <div class="flex justify-center mb-6">
                <div class="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                </div>
            </div>

            <!-- Titre -->
            <h1 class="text-3xl font-bold text-center text-gray-900 mb-2">
                Bienvenue sur Coolify
            </h1>

            <!-- État de chargement -->
            <div id="loading-state" class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                    <svg class="w-8 h-8 text-indigo-600 spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                </div>
                <p class="text-lg text-gray-700 mb-2">
                    Vérification en cours...
                </p>
                <p class="text-sm text-gray-500">
                    Nous vérifions votre session auprès du service d'authentification.
                </p>
            </div>

            <!-- État non connecté (caché par défaut) -->
            <div id="not-authenticated-state" class="hidden fade-in">
                <!-- Message d'erreur (si présent) -->
                <div id="error-message" class="hidden mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div class="flex items-start">
                        <svg class="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                        </svg>
                        <div>
                            <p id="error-text" class="text-sm font-medium text-red-800"></p>
                        </div>
                    </div>
                </div>

                <!-- Message -->
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                        <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <p class="text-lg text-gray-700 mb-2">
                        Vous n'êtes pas connecté
                    </p>
                    <p class="text-sm text-gray-500">
                        Pour accéder au tableau de bord, veuillez vous authentifier via notre service centralisé.
                    </p>
                </div>

                <!-- Boutons -->
                <div class="space-y-3">
                    <!-- Bouton Se connecter -->
                    <a href="{{ $authUrl }}" 
                       class="block w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 text-center">
                        <div class="flex items-center justify-center">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                            </svg>
                            Se connecter
                        </div>
                    </a>

                    <!-- Bouton Réessayer -->
                    <button onclick="checkAuthentication()" 
                            class="block w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 hover:border-gray-400 shadow hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
                        <div class="flex items-center justify-center">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Réessayer
                        </div>
                    </button>
                </div>
            </div>

            <!-- Info -->
            <div class="mt-6 pt-6 border-t border-gray-200">
                <p class="text-xs text-center text-gray-500">
                    Authentification centralisée via 
                    <span class="font-semibold text-indigo-600">IDEM Express API</span>
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="mt-6 text-center">
            <p class="text-sm text-white text-opacity-90">
                Propulsé par <span class="font-semibold">Coolify</span> × <span class="font-semibold">IDEM</span>
            </p>
        </div>
    </div>

    <script>
        // Fonction pour obtenir un cookie
        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }

        // Fonction pour vérifier l'authentification
        async function checkAuthentication() {
            console.log('[Welcome] ========================================');
            console.log('[Welcome] Starting authentication check...');
            console.log('[Welcome] All cookies:', document.cookie);
            
            // Afficher le loader
            document.getElementById('loading-state').classList.remove('hidden');
            document.getElementById('not-authenticated-state').classList.add('hidden');
            document.getElementById('error-message').classList.add('hidden');

            // Récupérer le cookie session (juste pour les logs)
            const sessionCookie = getCookie('session');
            console.log('[Welcome] Session cookie:', sessionCookie ? 'Found (length: ' + sessionCookie.length + ')' : 'Not found');
            
            // TOUJOURS appeler le backend, même sans cookie
            try {
                console.log('[Welcome] Calling backend API: /api/auth/check');
                console.log('[Welcome] Request URL:', window.location.origin + '/api/auth/check');
                
                // Appeler l'API Laravel pour vérifier l'authentification
                const response = await fetch('/api/auth/check', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                console.log('[Welcome] Backend response status:', response.status);
                console.log('[Welcome] Response headers:', Object.fromEntries(response.headers.entries()));

                // Si la réponse est 200, l'utilisateur est authentifié
                if (response.status === 200) {
                    const data = await response.json();
                    console.log('[Welcome] ✅ User authenticated:', data.user);
                    console.log('[Welcome] Redirecting to dashboard in 500ms...');
                    
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 500);
                    return;
                }

                // Si 401 ou 403, pas authentifié
                if (response.status === 401 || response.status === 403) {
                    console.log('[Welcome] ❌ User not authenticated (401/403)');
                    const data = await response.json().catch(() => ({}));
                    console.log('[Welcome] Error data:', data);
                    showNotAuthenticated(data.message || 'Session invalide ou expirée');
                    return;
                }

                // Autres erreurs
                console.error('[Welcome] ⚠️ Unexpected response:', response.status);
                const errorText = await response.text().catch(() => 'No response body');
                console.error('[Welcome] Response body:', errorText);
                showNotAuthenticated('Erreur lors de la vérification');

            } catch (error) {
                console.error('[Welcome] ❌ Error checking authentication:', error);
                console.error('[Welcome] Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                showNotAuthenticated('Erreur de connexion au serveur');
            }
            
            console.log('[Welcome] ========================================');
        }

        // Afficher l'état non authentifié
        function showNotAuthenticated(errorMessage = null) {
            document.getElementById('loading-state').classList.add('hidden');
            document.getElementById('not-authenticated-state').classList.remove('hidden');
            
            if (errorMessage) {
                document.getElementById('error-text').textContent = errorMessage;
                document.getElementById('error-message').classList.remove('hidden');
            }
        }

        // Vérifier automatiquement au chargement de la page
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[Welcome] Page loaded, starting authentication check...');
            checkAuthentication();
        });
    </script>
</body>
</html>
