#\!/usr/bin/env python3
"""
Traffic Logger - ForwardAuth Middleware for Traefik + CrowdSec Integration
Logs all HTTP traffic and queries CrowdSec LAPI for decisions
"""
import os
import sys
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
import requests

# Configuration
CROWDSEC_LAPI_URL = os.getenv('CROWDSEC_LAPI_URL', 'http://crowdsec-live:8080')
CROWDSEC_APPSEC_URL = os.getenv('CROWDSEC_APPSEC_URL', 'http://crowdsec-live:7422')
CROWDSEC_API_KEY = os.getenv('CROWDSEC_API_KEY', '')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# Flask app
app = Flask(__name__)

# Logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger('traffic-logger')

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    try:
        # Check CrowdSec connectivity
        response = requests.get(f"{CROWDSEC_LAPI_URL}/health", timeout=2)
        crowdsec_status = "ok" if response.status_code == 200 else "error"
    except Exception as e:
        crowdsec_status = f"error: {str(e)}"
    
    return jsonify({
        'status': 'ok',
        'crowdsec': crowdsec_status,
        'timestamp': datetime.utcnow().isoformat()
    })

# ForwardAuth endpoint - MUST be before main
@app.route('/forwardauth', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
def forward_auth():
    """
    Traefik ForwardAuth endpoint
    Checks CrowdSec decision and logs traffic
    """
    # Extract request data
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    method = request.method
    uri = request.headers.get('X-Forwarded-Uri', '/')
    host = request.headers.get('X-Forwarded-Host', 'unknown')
    user_agent = request.headers.get('User-Agent', '')
    
    # Log structure
    log_data = {
        'timestamp': datetime.utcnow().isoformat(),
        'ip_address': ip,
        'method': method,
        'uri': uri,
        'host': host,
        'user_agent': user_agent,
        'decision': 'allow',
        'reason': ''
    }
    
    # Step 1: Check AppSec WAF rules
    try:
        # Send request to AppSec for WAF analysis
        appsec_headers = {
            'X-Crowdsec-Appsec-Api-Key': CROWDSEC_API_KEY,
            'X-Crowdsec-Appsec-Ip': ip,
            'X-Crowdsec-Appsec-Uri': uri,
            'X-Crowdsec-Appsec-Host': host,
            'X-Crowdsec-Appsec-Verb': method,
            'X-Crowdsec-Appsec-User-Agent': user_agent,
        }
        
        appsec_response = requests.post(
            CROWDSEC_APPSEC_URL,
            headers=appsec_headers,
            timeout=2
        )
        
        # AppSec returns 200 if allowed, 403 if blocked
        if appsec_response.status_code == 403:
            log_data['decision'] = 'ban'
            log_data['reason'] = 'blocked by appsec waf'
            
            # Output JSON log
            print(f"TRAFFIC_LOG: {json.dumps(log_data)}", flush=True)
            
            # Return 403 to block
            return jsonify({'error': 'Forbidden - WAF'}), 403
            
    except Exception as e:
        logger.error(f"Error querying AppSec: {e}")
        # Continue to LAPI check even if AppSec fails
    
    # Step 2: Check LAPI for IP decisions
    try:
        if CROWDSEC_API_KEY:
            headers = {'X-Api-Key': CROWDSEC_API_KEY}
            response = requests.get(
                f"{CROWDSEC_LAPI_URL}/v1/decisions",
                headers=headers,
                params={'ip': ip},
                timeout=2
            )
            
            if response.status_code == 200:
                decisions = response.json()
                if decisions and len(decisions) > 0:
                    decision = decisions[0]
                    log_data['decision'] = decision.get('type', 'ban')
                    log_data['reason'] = decision.get('scenario', 'blocked by crowdsec')
                    
                    # Output JSON log
                    print(f"TRAFFIC_LOG: {json.dumps(log_data)}", flush=True)
                    
                    # Return 403 to block
                    return jsonify({'error': 'Forbidden - IP Ban'}), 403
            elif response.status_code == 404:
                # No decision found - allow
                pass
            else:
                logger.warning(f"CrowdSec LAPI returned {response.status_code}")
    except Exception as e:
        logger.error(f"Error querying CrowdSec LAPI: {e}")
        log_data['reason'] = f"crowdsec_error: {str(e)}"
    
    # Output JSON log
    print(f"TRAFFIC_LOG: {json.dumps(log_data)}", flush=True)
    
    # Return 200 to allow
    return '', 200

if __name__ == '__main__':
    logger.info("Starting Traffic Logger with AppSec support...")
    logger.info(f"CrowdSec AppSec: {CROWDSEC_APPSEC_URL}")
    logger.info(f"CrowdSec LAPI: {CROWDSEC_LAPI_URL}")
    logger.info(f"API Key configured: {'Yes' if CROWDSEC_API_KEY else 'No'}")
    
    # Run Flask app
    app.run(host='0.0.0.0', port=8080, debug=False)
