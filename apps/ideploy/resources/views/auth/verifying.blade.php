<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Vérification de l'authentification - Idem</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Jura', sans-serif;
        }

        :root {
            --color-primary: #1447e6;
            --color-bg-dark: #06080d;
            --glass-bg: rgba(15, 20, 27, 0.4);
            --glass-border: rgba(255, 255, 255, 0.1);
            --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            --glass-blur: 8px;
        }

        body {
            background-color: var(--color-bg-dark);
            background-size: 50px 50px;
            background-image:
                linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: white;
        }

        .container {
            background: var(--glass-bg);
            backdrop-filter: blur(var(--glass-blur));
            -webkit-backdrop-filter: blur(var(--glass-blur));
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            box-shadow: var(--glass-shadow);
            max-width: 500px;
            width: 100%;
            padding: 48px 40px;
            text-align: center;
        }

        .loader-container {
            width: 80px;
            height: 80px;
            margin: 0 auto 32px;
            position: relative;
        }

        .loader {
            width: 100%;
            height: 100%;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top: 4px solid var(--color-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .pulse {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--color-primary), rgba(20, 71, 230, 0.6));
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            50% {
                opacity: 0.5;
                transform: translate(-50%, -50%) scale(0.8);
            }
        }

        h1 {
            font-size: 2rem;
            font-weight: 600;
            color: white;
            margin-bottom: 16px;
            letter-spacing: 0.5px;
        }

        p {
            font-size: 1rem;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.6;
            margin-bottom: 16px;
            font-weight: 400;
        }

        .status {
            font-size: 0.875rem;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 24px;
        }

        .hidden {
            display: none;
        }

        @media (max-width: 640px) {
            .container {
                padding: 32px 24px;
            }

            h1 {
                font-size: 1.5rem;
            }

            p {
                font-size: 0.875rem;
            }

            .loader-container {
                width: 60px;
                height: 60px;
            }

            .pulse {
                width: 30px;
                height: 30px;
            }
        }
    </style>
    <script>
        window.IDEM_API_URL = '{{ config('idem.api_url', 'http://localhost:3001') }}';
        window.IDEM_DASHBOARD_URL = '{{ config('idem.dashboard_url', 'http://localhost:4200') }}';
    </script>
</head>
<body>
    <div class="container">
        <div class="loader-container">
            <div class="loader"></div>
            <div class="pulse"></div>
        </div>

        <h1>Vérification en cours...</h1>
        
        <p>
            Nous vérifions votre authentification auprès du serveur Idem.
            Veuillez patienter quelques instants.
        </p>

        <div class="status" id="status">
            Connexion au serveur d'authentification...
        </div>
    </div>

    <script>
        console.log('[DEBUG] Script chargé');
        
        // Service d'authentification IDEM (inline pour éviter les problèmes de compilation)
        class IdemAuthService {
            constructor() {
                this.apiUrl = window.IDEM_API_URL || 'http://localhost:3001';
                this.user = null;
                this.isLoading = false;
                this.error = null;
            }

            async checkAuth() {
                this.isLoading = true;
                this.error = null;

                try {
                    console.log('[IDEM Auth] Vérification auprès de:', this.apiUrl + '/auth/profile');
                    
                    const response = await fetch(`${this.apiUrl}/auth/profile`, {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log('[IDEM Auth] Réponse reçue:', response.status);

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            this.user = null;
                            this.error = 'Non authentifié';
                            return null;
                        }
                        
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
                    }

                    const data = await response.json();
                    this.user = data.user || data;
                    this.error = null;
                    
                    console.log('[IDEM Auth] Utilisateur authentifié:', this.user.email);
                    return this.user;

                } catch (error) {
                    console.error('[IDEM Auth] Erreur lors de la vérification:', error);
                    this.error = error.message;
                    this.user = null;
                    throw error;
                } finally {
                    this.isLoading = false;
                }
            }

            async syncWithBackend(user) {
                try {
                    console.log('[IDEM Auth] Synchronisation avec Laravel...');
                    
                    const response = await fetch('/api/auth/sync', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
                        },
                        body: JSON.stringify({ user })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || 'Erreur de synchronisation');
                    }

                    const data = await response.json();
                    console.log('[IDEM Auth] Utilisateur synchronisé avec Laravel');
                    return data;

                } catch (error) {
                    console.error('[IDEM Auth] Erreur de synchronisation:', error);
                    throw error;
                }
            }
        }

        // Fonction principale de vérification
        async function verifyAuthentication() {
            console.log('[DEBUG] verifyAuthentication appelée');
            console.log('[DEBUG] document.readyState:', document.readyState);
            
            const statusEl = document.getElementById('status');
            console.log('[DEBUG] statusEl:', statusEl);
            
            // Initialiser le service d'authentification
            if (!window.idemAuth) {
                console.log('[DEBUG] Création de IdemAuthService');
                window.idemAuth = new IdemAuthService();
                console.log('[DEBUG] window.idemAuth créé:', window.idemAuth);
            }
            
            try {
                // Vérifier l'authentification avec l'API
                statusEl.textContent = 'Vérification de votre session...';
                const user = await window.idemAuth.checkAuth();

                if (!user) {
                    // Pas authentifié - rediriger vers la page d'erreur
                    console.log('[Auth] Utilisateur non authentifié, redirection vers /auth/error');
                    window.location.href = '/auth/error';
                    return;
                }

                // Afficher la réponse dans la console
                console.log('[Auth] ✅ Authentification réussie !');
                console.log('[Auth] Données utilisateur:', user);
                console.log('[Auth] Email:', user.email);
                console.log('[Auth] UID:', user.uid);
                console.log('[Auth] Display Name:', user.displayName);

                // Rediriger vers le dashboard
                statusEl.textContent = 'Authentification réussie ! Redirection...';
                
                const urlParams = new URLSearchParams(window.location.search);
                const redirectTo = urlParams.get('redirect') || '/dashboard';
                
                console.log('[Auth] Redirection vers:', redirectTo);
                
                setTimeout(() => {
                    window.location.href = redirectTo;
                }, 500);

            } catch (error) {
                console.error('[Auth] ❌ Erreur de vérification:', error);
                
                // Rediriger vers la page d'erreur avec le message
                const errorMessage = encodeURIComponent(error.message);
                window.location.href = `/auth/error?message=${errorMessage}`;
            }
        }

        // Lancer la vérification au chargement de la page
        console.log('[DEBUG] Configuration du listener, readyState:', document.readyState);
        
        if (document.readyState === 'loading') {
            console.log('[DEBUG] DOM en cours de chargement, ajout du listener');
            document.addEventListener('DOMContentLoaded', function() {
                console.log('[DEBUG] DOMContentLoaded déclenché');
                verifyAuthentication();
            });
        } else {
            console.log('[DEBUG] DOM déjà chargé, exécution immédiate');
            verifyAuthentication();
        }
    </script>
</body>
</html>
