# ⚡ JWT Quickstart - IDEM SaaS

> Démarrage rapide pour tester l'authentification JWT en 5 minutes

#NOTE dans l'inplementation de la partie Authentification faudrai conserver les differents niveau d'utilisateurs de preference conserver l'attribut idem_role qui permet de definir le niveau de privilege de l'utilisateur il est important dans la logique en place
# pour lancer en dev une facon plus simple serait d'utiliser le  docker-compose.dev.yml pour cela du devra installer executer la commande " docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d


---

## 🚀 Configuration en 3 étapes

### Étape 1: Configurer JWT_SECRET

```bash
# Générer un secret fort
JWT_SECRET=$(openssl rand -base64 32)

# Ajouter à .env
echo "JWT_SECRET=$JWT_SECRET" >> .env

# Vérifier
cat .env | grep JWT_SECRET
```

### Étape 2: Vider le cache Laravel

```bash
php artisan config:clear
php artisan cache:clear
```

### Étape 3: Créer un utilisateur de test

```bash
php artisan tinker
```

```php
// Créer un utilisateur admin
$admin = User::create([
    'name' => 'Admin Test',
    'email' => 'admin@test.com',
    'password' => Hash::make('password123'),
    'idem_role' => 'admin',
    'email_verified_at' => now()
]);

// Créer un utilisateur membre
$member = User::create([
    'name' => 'Member Test',
    'email' => 'member@test.com',
    'password' => Hash::make('password123'),
    'idem_role' => 'member',
    'email_verified_at' => now()
]);

echo "✅ Utilisateurs créés !\n";
echo "Admin: admin@test.com / password123\n";
echo "Member: member@test.com / password123\n";

exit
```

---

## 🧪 Tests rapides

### Test 1: Login et obtenir un token

```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@test.com","password":"password123"}' \
     http://localhost:8000/api/v1/auth/login
```

**Réponse attendue:**
```json
{
    "success": true,
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {
        "id": 1,
        "name": "Admin Test",
        "email": "admin@test.com",
        "role": "admin"
    }
}
```

**💡 Copiez le token pour les tests suivants !**

### Test 2: Utiliser le token pour accéder à une route protégée

```bash
# Remplacez YOUR_TOKEN par le token obtenu
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."

curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/idem/subscription
```

**Réponse attendue:**
```json
{
    "success": true,
    "data": {
        "plan": "free",
        "display_name": "Free Plan",
        "price_monthly": 0.00,
        "app_limit": 2,
        "server_limit": 0,
        ...
    }
}
```

### Test 3: Accès admin au dashboard

```bash
# Avec le token admin
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/idem/admin/dashboard
```

**Réponse attendue:** Statistiques globales de la plateforme

### Test 4: Token invalide (doit échouer)

```bash
curl -H "Authorization: Bearer invalid-token-123" \
     http://localhost:8000/api/v1/idem/subscription
```

**Réponse attendue:**
```json
{
    "success": false,
    "message": "Token JWT invalide: ..."
}
```

---

## 🌐 Test avec un client web

### HTML + JavaScript simple

Créez un fichier `test-jwt.html` :

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test JWT IDEM</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 50px auto; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
        .success { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>🔐 Test JWT IDEM SaaS</h1>

    <!-- Login -->
    <div class="section">
        <h2>1. Login</h2>
        <input type="email" id="email" placeholder="Email" value="admin@test.com">
        <input type="password" id="password" placeholder="Password" value="password123">
        <button onclick="login()">Login</button>
        <div id="login-result"></div>
    </div>

    <!-- Test API -->
    <div class="section">
        <h2>2. Test API avec Token</h2>
        <button onclick="getSubscription()">Get Subscription</button>
        <button onclick="getQuota()">Get Quota</button>
        <button onclick="getDashboard()">Get Dashboard (Admin)</button>
        <div id="api-result"></div>
    </div>

    <!-- Logout -->
    <div class="section">
        <h2>3. Logout</h2>
        <button onclick="logout()">Logout</button>
    </div>

    <script>
        const API_BASE = 'http://localhost:8000/api/v1';
        
        async function login() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('jwt_token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    document.getElementById('login-result').innerHTML = 
                        `<p class="success">✅ Login réussi !</p>
                         <p>User: ${data.user.name} (${data.user.role})</p>
                         <pre>Token: ${data.token.substring(0, 50)}...</pre>`;
                } else {
                    document.getElementById('login-result').innerHTML = 
                        `<p class="error">❌ ${data.message}</p>`;
                }
            } catch (error) {
                document.getElementById('login-result').innerHTML = 
                    `<p class="error">❌ Erreur: ${error.message}</p>`;
            }
        }
        
        async function apiCall(endpoint) {
            const token = localStorage.getItem('jwt_token');
            
            if (!token) {
                return { error: 'Pas de token. Connectez-vous d\'abord.' };
            }
            
            try {
                const response = await fetch(`${API_BASE}${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                return await response.json();
            } catch (error) {
                return { error: error.message };
            }
        }
        
        async function getSubscription() {
            const data = await apiCall('/idem/subscription');
            document.getElementById('api-result').innerHTML = 
                `<h3>Subscription:</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        
        async function getQuota() {
            const data = await apiCall('/idem/quota');
            document.getElementById('api-result').innerHTML = 
                `<h3>Quota:</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        
        async function getDashboard() {
            const data = await apiCall('/idem/admin/dashboard');
            document.getElementById('api-result').innerHTML = 
                `<h3>Dashboard:</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        
        function logout() {
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user');
            alert('✅ Déconnecté !');
            location.reload();
        }
        
        // Vérifier si déjà connecté
        window.onload = function() {
            const token = localStorage.getItem('jwt_token');
            if (token) {
                const user = JSON.parse(localStorage.getItem('user'));
                document.getElementById('login-result').innerHTML = 
                    `<p class="success">✅ Déjà connecté: ${user.name} (${user.role})</p>`;
            }
        };
    </script>
</body>
</html>
```

**Utilisation:**
1. Ouvrez `test-jwt.html` dans votre navigateur
2. Cliquez sur "Login"
3. Testez les différentes API
4. Vérifiez la console du navigateur pour les détails

---

## 🔍 Débugger un token JWT

### Méthode 1: Avec jwt.io

1. Allez sur https://jwt.io/
2. Collez votre token dans le champ "Encoded"
3. Vérifiez le payload décodé

### Méthode 2: Avec PHP

```bash
php artisan tinker
```

```php
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...";

try {
    $decoded = JWT::decode($token, new Key(config('idem.jwt_secret'), 'HS256'));
    print_r($decoded);
} catch (Exception $e) {
    echo "Erreur: " . $e->getMessage();
}
```

### Méthode 3: Avec curl et jq

```bash
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."

# Extraire le payload (partie entre les deux points)
echo $TOKEN | cut -d. -f2 | base64 -d | jq .
```

---

## ✅ Checklist de validation

- [ ] JWT_SECRET configuré dans .env
- [ ] Utilisateurs de test créés
- [ ] Login retourne un token
- [ ] Token valide accepté sur routes protégées
- [ ] Token invalide rejeté avec erreur 401
- [ ] Admin peut accéder au dashboard
- [ ] Membre ne peut pas accéder au dashboard
- [ ] Token contient les bonnes informations (email, role)
- [ ] Token expire après la durée configurée

---

## 🐛 Problèmes courants

### "JWT_SECRET non configuré"

```bash
# Vérifier
php artisan config:clear
cat .env | grep JWT_SECRET

# Si absent
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
php artisan config:clear
```

### "CORS error" dans le navigateur

Ajoutez dans `config/cors.php` :

```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_origins' => ['*'],  // En dev uniquement !
```

### "Token invalide" alors qu'il semble correct

```bash
# Vérifier que le secret est le même
php artisan tinker
```

```php
echo config('idem.jwt_secret');
// Doit correspondre à JWT_SECRET dans .env
```
