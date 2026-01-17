<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied - Security Check</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 60px 40px;
            text-align: center;
        }
        
        .shield {
            font-size: 80px;
            margin-bottom: 30px;
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        h1 {
            font-size: 32px;
            color: #2d3748;
            margin-bottom: 20px;
            font-weight: 700;
        }
        
        .subtitle {
            font-size: 18px;
            color: #718096;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .ip-box {
            background: #f7fafc;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .ip-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #a0aec0;
            margin-bottom: 8px;
            font-weight: 600;
        }
        
        .ip-value {
            font-size: 24px;
            color: #2d3748;
            font-weight: 700;
            font-family: 'Courier New', monospace;
        }
        
        .reason {
            background: #fed7d7;
            border-left: 4px solid #f56565;
            padding: 15px 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        
        .reason-title {
            font-weight: 700;
            color: #c53030;
            margin-bottom: 8px;
        }
        
        .reason-text {
            color: #742a2a;
            font-size: 14px;
            line-height: 1.6;
        }
        
        .info {
            font-size: 14px;
            color: #718096;
            line-height: 1.8;
            margin-top: 30px;
        }
        
        .info strong {
            color: #2d3748;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e2e8f0;
            font-size: 13px;
            color: #a0aec0;
        }
        
        .powered-by {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-top: 15px;
        }
        
        .powered-by img {
            height: 24px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="shield">🛡️</div>
        
        <h1>Access Denied</h1>
        
        <p class="subtitle">
            Our security system has blocked your request to protect our application from malicious activity.
        </p>
        
        <div class="ip-box">
            <div class="ip-label">Your IP Address</div>
            <div class="ip-value">{{ $ip }}</div>
        </div>
        
        <div class="reason">
            <div class="reason-title">🚫 Why was I blocked?</div>
            <div class="reason-text">
                {{ $reason ?? 'Your IP address has been flagged by our Web Application Firewall (WAF) due to suspicious activity or security concerns.' }}
            </div>
        </div>
        
        <div class="info">
            <p>
                <strong>What can I do?</strong>
            </p>
            <ul style="text-align: left; margin: 15px 0; padding-left: 20px;">
                <li style="margin: 8px 0;">Wait a few minutes and try again</li>
                <li style="margin: 8px 0;">Make sure you're not using a VPN or proxy</li>
                <li style="margin: 8px 0;">Check if you're sending too many requests</li>
                <li style="margin: 8px 0;">Contact the website administrator if you believe this is an error</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Request ID: {{ Str::uuid() }}</p>
            <p>Timestamp: {{ now()->toIso8601String() }}</p>
            
            <div class="powered-by">
                <span>Protected by</span>
                <strong>CrowdSec</strong>
            </div>
        </div>
    </div>
</body>
</html>
