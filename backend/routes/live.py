# backend/routes/live.py
# Live API integration with external scheme services with graceful fallback

import requests
from flask import Blueprint, jsonify, request

live_bp = Blueprint('live', __name__)

MYSCHEME_API_BASE = "https://api.myscheme.gov.in/search/v4/schemes"

@live_bp.route('/api/live/schemes', methods=['GET'])
def get_live_schemes():
    """Fetch live schemes from external government API with error resilience"""
    try:
        keyword = request.args.get('q', '').strip()
        if len(keyword) > 100:
            return jsonify({"error": "Query parameter too long (max 100 chars)"}), 400

        params = {
            'keyword': keyword,
            'lang': 'en',
            'pageSize': 10,
            'pageNo': 1
        }
        response = requests.get(MYSCHEME_API_BASE, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        return jsonify({
            "source": "myscheme_live",
            "data": data
        }), 200

    except requests.exceptions.Timeout:
        return jsonify({
            "error": "MyScheme live service timed out",
            "status": "timeout"
        }), 504
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "MyScheme live upstream service is currently unreachable",
            "status": "unavailable"
        }), 503
    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": f"Upstream service error: {str(e)}",
            "status": "error"
        }), 502


@live_bp.route('/api/live/scheme/<scheme_id>', methods=['GET'])
def get_live_scheme_by_id(scheme_id):
    """Fetch a single scheme by ID from MyScheme API"""
    try:
        scheme_id = scheme_id.strip()
        if not scheme_id or len(scheme_id) > 100 or not scheme_id.replace('-', '').replace('_', '').isalnum():
            return jsonify({"error": "Invalid scheme_id format"}), 400

        url = f"{MYSCHEME_API_BASE}/{scheme_id}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        return jsonify(response.json()), 200

    except requests.exceptions.Timeout:
        return jsonify({
            "error": "MyScheme live service timed out",
            "status": "timeout"
        }), 504
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "MyScheme live upstream service is currently unreachable",
            "status": "unavailable"
        }), 503
    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": f"Upstream service error: {str(e)}",
            "status": "error"
        }), 502
