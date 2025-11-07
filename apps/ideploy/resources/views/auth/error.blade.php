<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentification requise - Idem</title>
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

        .icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 32px;
            background: linear-gradient(135deg, var(--color-primary), rgba(20, 71, 230, 0.6));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 20px rgba(20, 71, 230, 0.4);
        }

        .icon svg {
            width: 40px;
            height: 40px;
            color: white;
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
            margin-bottom: 32px;
            font-weight: 400;
        }

        .error-message {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 32px;
            font-size: 0.875rem;
            color: rgba(255, 255, 255, 0.9);
        }

        .buttons {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .button {
            display: inline-block;
            background: linear-gradient(135deg, var(--color-primary), rgba(20, 71, 230, 0.8));
            background-size: 200% 100%;
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 10px;
            font-weight: 500;
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(20, 71, 230, 0.3);
            position: relative;
            overflow: hidden;
            border: none;
            cursor: pointer;
            flex: 1;
            min-width: 140px;
        }

        .button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.7s;
        }

        .button:hover::before {
            left: 100%;
        }

        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(20, 71, 230, 0.5);
        }

        .button:active {
            transform: translateY(0);
        }

        .button-secondary {
            background: rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .button-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .info {
            margin-top: 32px;
            padding-top: 32px;
            border-top: 1px solid var(--glass-border);
        }

        .info p {
            font-size: 0.875rem;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 0;
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

            .button {
                padding: 12px 24px;
                font-size: 0.875rem;
                flex: 1 1 100%;
            }

            .buttons {
                flex-direction: column;
            }
        }
    </style>
    <script>
        window.IDEM_DASHBOARD_URL = '{{ config('idem.dashboard_url', 'http://localhost:4200') }}';
    </script>
</head>
<body>
    <div class="container">
        <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        </div>

        <h1>Vous n'êtes pas authentifié</h1>
        
        <p>
            Pour accéder à cette ressource, vous devez être connecté. 
            Veuillez vous authentifier sur le tableau de bord Idem.
        </p>

        <div class="error-message" id="error-message" style="display: none;">
            <!-- Message d'erreur dynamique -->
        </div>

        <div class="buttons">
            <button onclick="retryAuth()" class="button button-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Réessayer
            </button>
            
            <a href="{{ config('idem.dashboard_url', 'http://localhost:4200') }}" class="button">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Se connecter
            </a>
        </div>

        <div class="info">
            <p>
                Vous serez redirigé vers le tableau de bord Idem où vous pourrez vous connecter 
                avec votre compte. Une fois authentifié, vous pourrez accéder à toutes les ressources.
            </p>
        </div>
    </div>

    <script>
        // Afficher le message d'erreur si présent dans l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const errorMessage = urlParams.get('message');
        
        if (errorMessage) {
            const errorDiv = document.getElementById('error-message');
            errorDiv.textContent = decodeURIComponent(errorMessage);
            errorDiv.style.display = 'block';
        }

        // Fonction pour réessayer l'authentification
        function retryAuth() {
            // Récupérer l'URL de redirection si présente
            const redirectTo = urlParams.get('redirect') || '/dashboard';
            
            // Rediriger vers la page de vérification
            window.location.href = `/auth/verify?redirect=${encodeURIComponent(redirectTo)}`;
        }
    </script>
</body>
</html>
