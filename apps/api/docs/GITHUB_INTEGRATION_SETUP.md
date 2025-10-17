# GitHub Integration Setup Guide

This guide explains how to set up GitHub integration for pushing project files to GitHub repositories.

## Prerequisites

1. **Install Required Dependencies**
   ```bash
   npm install @octokit/rest
   ```

2. **GitHub OAuth App Setup**
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Click "New OAuth App"
   - Fill in the application details:
     - Application name: `Idem API GitHub Integration`
     - Homepage URL: `https://your-domain.com`
     - Authorization callback URL: `https://your-domain.com/github/auth/callback`
   - Note down the `Client ID` and `Client Secret`

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=https://your-domain.com/github/auth/callback
```

## API Endpoints

### 1. Get GitHub Authorization URL
```http
GET /github/auth/url
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://github.com/login/oauth/authorize?client_id=...",
  "message": "GitHub authorization URL generated successfully"
}
```

### 2. Handle OAuth Callback
```http
GET /github/auth/callback?code=<auth-code>&state=<state>
```

**Response:**
```json
{
  "success": true,
  "message": "GitHub account connected successfully",
  "user": {
    "username": "github-username",
    "avatarUrl": "https://avatars.githubusercontent.com/...",
    "email": "user@example.com"
  }
}
```

### 3. Push Project to GitHub
```http
POST /github/projects/{projectId}/push
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "repositoryName": "my-awesome-project",
  "description": "Project generated from Idem API",
  "isPrivate": false,
  "commitMessage": "Initial commit from Idem API",
  "files": {
    "README.md": "# My Project\n\nThis is awesome!",
    "package.json": "{\n  \"name\": \"my-project\"\n}",
    "index.html": "<!DOCTYPE html>..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully pushed 3 files to GitHub",
  "repositoryUrl": "https://github.com/username/my-awesome-project",
  "repositoryName": "my-awesome-project",
  "owner": "username",
  "pushedFiles": ["README.md", "package.json", "index.html"]
}
```

### 4. Get User's GitHub Repositories
```http
GET /github/repositories
Authorization: Bearer <your-jwt-token>
```

### 5. Get GitHub User Info
```http
GET /github/user
Authorization: Bearer <your-jwt-token>
```

### 6. Disconnect GitHub Account
```http
DELETE /github/disconnect
Authorization: Bearer <your-jwt-token>
```

## Usage Flow

1. **Connect GitHub Account:**
   - Frontend calls `/github/auth/url` to get authorization URL
   - User is redirected to GitHub for authorization
   - GitHub redirects back to `/github/auth/callback`
   - User's GitHub token is stored in their profile

2. **Push Project Files:**
   - Frontend calls `/github/projects/{projectId}/push` with project files
   - API creates/updates GitHub repository
   - Files are committed and pushed to the repository
   - Repository URL is returned and stored in project metadata

## Data Structure

The user model now includes GitHub integration:

```typescript
interface GitHubIntegration {
  accessToken: string;
  refreshToken?: string;
  username: string;
  avatarUrl?: string;
  connectedAt: Date;
  lastUsed?: Date;
  scopes: string[];
}

interface UserModel {
  // ... existing fields
  githubIntegration?: GitHubIntegration;
}
```

## Security Considerations

- GitHub tokens are stored securely in the user's profile
- OAuth state parameter prevents CSRF attacks
- All endpoints require authentication
- Repository creation respects user's GitHub permissions
- Tokens are refreshed automatically when needed

## Error Handling

Common error scenarios:
- User not authenticated: 401 Unauthorized
- GitHub account not connected: 400 Bad Request
- Repository creation failed: 400 Bad Request with error message
- File push failed: 400 Bad Request with error message
- GitHub API rate limits: 429 Too Many Requests

## Testing

To test the integration:

1. Set up environment variables
2. Start the API server
3. Use a tool like Postman or curl to test endpoints
4. Verify repositories are created in GitHub
5. Check that files are properly committed

## Example Frontend Integration

```javascript
// Get GitHub auth URL
const authResponse = await fetch('/github/auth/url', {
  headers: { 'Authorization': `Bearer ${userToken}` }
});
const { authUrl } = await authResponse.json();

// Redirect user to GitHub
window.location.href = authUrl;

// After OAuth callback, push project
const pushResponse = await fetch(`/github/projects/${projectId}/push`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    repositoryName: 'my-project',
    description: 'Generated project',
    isPrivate: false,
    files: projectFiles
  })
});

const result = await pushResponse.json();
console.log('Repository URL:', result.repositoryUrl);
```
