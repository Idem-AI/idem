# Beta Quota System Environment Variables

This document describes the environment variables needed to configure the beta quota and restrictions system.

## Required Environment Variables

### Beta Mode Configuration
```bash
# Enable/disable beta mode
IS_BETA=true
```

### Quota Limits Configuration
```bash
# Production quota limits (when IS_BETA=false)
DAILY_QUOTA_LIMIT=50
WEEKLY_QUOTA_LIMIT=200

# Beta quota limits (when IS_BETA=true)
BETA_DAILY_QUOTA_LIMIT=5
BETA_WEEKLY_QUOTA_LIMIT=20
```

### Beta Feature Restrictions
```bash
# Maximum number of style options in beta
BETA_MAX_STYLES=3

# Maximum resolution in beta (low, medium, high, ultra)
BETA_MAX_RESOLUTION=medium

# Comma-separated list of allowed features in beta
BETA_ALLOWED_FEATURES=logo,colors,typography

# Maximum output tokens for LLM responses in beta
BETA_MAX_OUTPUT_TOKENS=1000

# Comma-separated list of restricted prompt types in beta
BETA_RESTRICTED_PROMPTS=complex-branding,full-charter
```

### Input Validation Configuration
```bash
# Minimum input length for user requests
MIN_INPUT_LENGTH=3

# Maximum input length for user requests
MAX_INPUT_LENGTH=500
```

## Example .env Configuration

```bash
# Beta Mode
IS_BETA=true

# Quota Limits
DAILY_QUOTA_LIMIT=50
WEEKLY_QUOTA_LIMIT=200
BETA_DAILY_QUOTA_LIMIT=5
BETA_WEEKLY_QUOTA_LIMIT=20

# Beta Restrictions
BETA_MAX_STYLES=3
BETA_MAX_RESOLUTION=medium
BETA_ALLOWED_FEATURES=logo,colors,typography
BETA_MAX_OUTPUT_TOKENS=1000
BETA_RESTRICTED_PROMPTS=complex-branding,full-charter

# Input Validation
MIN_INPUT_LENGTH=3
MAX_INPUT_LENGTH=500

# Your existing environment variables...
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
# ... other variables
```

## How It Works

### Beta Mode Detection
- When `IS_BETA=true`, the system automatically applies beta restrictions
- All quota limits switch to beta values
- Feature restrictions are enforced
- Input validation is applied

### Quota Management
- **Daily Quota**: Resets every day at midnight
- **Weekly Quota**: Resets every Monday
- Users are blocked when either daily or weekly limit is reached
- Quota usage is tracked per user in Firestore

### Feature Restrictions
- Only allowed features can be accessed in beta mode
- Prompt parameters are automatically adjusted (tokens, styles, resolution)
- Restricted prompt types are blocked entirely

### Input Validation
- Prevents empty or too short inputs
- Blocks excessively long inputs
- Detects suspicious patterns (repeated characters, spam-like content)
- Validates input contains meaningful content

## API Endpoints

The quota system provides the following API endpoints:

- `GET /quota/info` - Get user's quota information
- `GET /quota/check` - Check if user can make a request
- `GET /quota/beta` - Get beta restrictions and limitations
- `GET /quota/validate/:featureName` - Validate if a feature is available
- `GET /quota/stats` - Get detailed usage statistics

## Integration with Services

The quota system is automatically integrated with:

- **PromptService**: All LLM calls are quota-checked and restricted
- **BrandingService**: Logo and branding generation respects beta limits
- **All Controllers**: Can use quota middleware for protection

## Middleware Usage

```typescript
import { checkQuota, checkFeatureAccess, validateInput, addBetaInfo } from '../middleware/quota.middleware';

// Apply quota checking
router.post('/generate', authenticate, checkQuota, controller.generate);

// Check specific feature access
router.post('/logo', authenticate, checkFeatureAccess('logo'), controller.generateLogo);

// Validate input content
router.post('/create', authenticate, validateInput('description'), controller.create);

// Add beta information to responses
router.get('/info', authenticate, addBetaInfo, controller.getInfo);
```

## Monitoring and Logging

The quota system provides comprehensive logging:

- Quota checks and usage increments
- Beta restriction applications
- Input validation failures
- Feature access denials

All logs include user IDs and relevant context for debugging and monitoring.
