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
            }
        }
    </style>
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

        <a href="{{ $dashboardUrl }}" class="button">
            Se connecter au Dashboard
        </a>

        <div class="info">
            <p>
                Vous serez redirigé vers le tableau de bord Idem où vous pourrez vous connecter 
                avec votre compte. Une fois authentifié, vous pourrez accéder à toutes les ressources.
            </p>
        </div>
    </div>
</body>
</html>
