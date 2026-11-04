# backend/routes/recommend.py
# Transparent, rules-first eligibility recommendation engine for citizen welfare schemes

import os
from flask import Blueprint, request, jsonify
from database import get_schemes_collection, get_schemes_for_recommendation, scheme_to_dict

recommend_bp = Blueprint("recommend", __name__)


def evaluate_eligibility(scheme, profile):
    """
    Deterministically evaluates a citizen's profile against scheme eligibility criteria.
    Returns:
        dict: {
            "eligible": bool,
            "match_score": int (0 - 100),
            "status": "eligible" | "partial" | "ineligible",
            "reasons": list[str],
            "unmet_criteria": list[str]
        }
    """
    eligibility = scheme.get("eligibility", {}) or {}
    tags = [t.lower() for t in (scheme.get("tags") or [])]
    desc_blob = f"{scheme.get('title', '')} {scheme.get('description', '')} {' '.join(tags)}".lower()

    reasons = []
    unmet = []

    # 1. State Check
    citizen_state = profile.get("state")
    scheme_state = eligibility.get("state", "all")
    if scheme_state and scheme_state.lower() != "all":
        if citizen_state:
            if scheme_state.lower() != citizen_state.lower() and citizen_state.lower() != "all":
                unmet.append(f"State restricted: Only open to residents of {scheme_state}.")
            else:
                reasons.append(f"Residency criteria met for {scheme_state}.")
    else:
        if citizen_state and citizen_state.lower() not in ("all", ""):
            reasons.append(f"Open to all States and Union Territories (including {citizen_state.title()}).")
        else:
            reasons.append("Open to all States and Union Territories (All India).")

    # 2. Gender Check
    citizen_gender = (profile.get("gender") or "").strip().lower()
    scheme_gender = (eligibility.get("gender") or "all").strip().lower()
    if scheme_gender not in ("all", "any"):
        if citizen_gender and citizen_gender != "all":
            if citizen_gender != scheme_gender:
                unmet.append(f"Target demographic: Exclusively for {scheme_gender.capitalize()} citizens.")
            else:
                reasons.append(f"Gender criteria met ({scheme_gender.capitalize()}).")

    # 3. Age Range Check
    citizen_age = profile.get("age")
    min_age = eligibility.get("min_age")
    max_age = eligibility.get("max_age")

    if citizen_age is not None:
        try:
            age_val = float(citizen_age)
            if min_age is not None and age_val < min_age:
                unmet.append(f"Age minimum: Must be at least {min_age} years (current: {int(age_val)}).")
            elif max_age is not None and age_val > max_age:
                unmet.append(f"Age limit: Must be under {max_age} years (current: {int(age_val)}).")
            else:
                # Only record reason if scheme actually defines an explicit age constraint
                if min_age is not None or max_age is not None:
                    if min_age is not None and max_age is not None:
                        reasons.append(f"Age {int(age_val)} meets age requirement ({int(min_age)}–{int(max_age)} years).")
                    elif min_age is not None:
                        reasons.append(f"Age {int(age_val)} meets minimum age requirement (≥ {int(min_age)} years).")
                    else:
                        reasons.append(f"Age {int(age_val)} meets maximum age limit (≤ {int(max_age)} years).")
        except (ValueError, TypeError):
            pass

    # 4. Income Limit Check
    citizen_income = profile.get("income")
    income_limit = eligibility.get("income_limit")

    if citizen_income is not None and income_limit is not None:
        try:
            inc_val = float(citizen_income)
            if inc_val > float(income_limit):
                unmet.append(
                    f"Annual household income ₹{int(inc_val):,} exceeds the cap of ₹{int(income_limit):,}."
                )
            else:
                reasons.append(
                    f"Annual income ₹{int(inc_val):,} is within the eligibility ceiling (₹{int(income_limit):,})."
                )
        except (ValueError, TypeError):
            pass

    # 5. Caste / Social Category Check
    citizen_caste = (profile.get("caste") or profile.get("social_category") or "").strip().lower()
    scheme_caste = eligibility.get("caste", []) or []
    if isinstance(scheme_caste, list) and scheme_caste and citizen_caste and citizen_caste != "all":
        scheme_caste_lower = [c.lower() for c in scheme_caste]
        all_categories = {"general", "obc", "sc", "st"}
        is_universal_caste = "all" in scheme_caste_lower or all_categories.issubset(set(scheme_caste_lower))
        if not is_universal_caste:
            if citizen_caste not in scheme_caste_lower:
                unmet.append(f"Reserved category: Available exclusively for {', '.join(scheme_caste).upper()}.")
            else:
                reasons.append(f"Affirmative welfare: Targeted for {citizen_caste.upper()} citizens.")

    # 6. Occupation / Student Check
    citizen_occ = (profile.get("occupation") or "").strip().lower()
    is_student = profile.get("is_student", False)
    scheme_occ = eligibility.get("occupation", []) or []
    if isinstance(scheme_occ, list) and scheme_occ:
        scheme_occ_lower = [o.lower() for o in scheme_occ]
        occ_matched = False
        if citizen_occ and citizen_occ in scheme_occ_lower:
            occ_matched = True
        elif is_student and ("student" in scheme_occ_lower or "youth" in scheme_occ_lower):
            occ_matched = True
        elif not citizen_occ and not is_student:
            occ_matched = True

        if occ_matched:
            if citizen_occ:
                reasons.append(f"Occupation match: {citizen_occ.capitalize()}.")
        else:
            unmet.append(f"Target occupation: Tailored for {', '.join(scheme_occ).capitalize()}.")

    # 7. Vulnerabilities / Disability
    is_disabled = profile.get("is_differently_abled", False)
    vulnerabilities = profile.get("vulnerabilities") or []
    if isinstance(vulnerabilities, str):
        vulnerabilities = [vulnerabilities]
    if is_disabled and "disability" not in vulnerabilities:
        vulnerabilities.append("disability")

    for vuln in vulnerabilities:
        v = vuln.lower()
        if v in ("disability", "differently_abled") and any(k in desc_blob for k in ["disability", "divyang", "handicap", "udid"]):
            reasons.append("Prioritizes Divyangjan / Persons with Disabilities.")
        elif v == "widow" and ("widow" in desc_blob or "destitute women" in desc_blob):
            reasons.append("Specifically covers Widows and single heads of household.")
        elif v == "orphan" and ("orphan" in desc_blob or "abandoned child" in desc_blob):
            reasons.append("Tailored for Orphans and vulnerable children.")
        elif v == "destitute" and ("destitute" in desc_blob or "homeless" in desc_blob):
            reasons.append("Dedicated welfare for destitute and homeless individuals.")

    # 8. Socio-Economic Status (Ration Card, Housing, Land)
    ration_card = (profile.get("ration_card") or "").strip().lower()
    if ration_card in ("bpl", "aay", "phh") and any(k in desc_blob for k in ["bpl", "ration card", "antyodaya", "priority household"]):
        reasons.append(f"Aligned with {ration_card.upper()} food security & welfare status.")

    housing = (profile.get("housing_status") or "").strip().lower()
    if housing in ("homeless", "kutcha") and any(k in desc_blob for k in ["housing", "shelter", "kutcha", "pm awas"]):
        reasons.append("Provides housing / shelter assistance for vulnerable shelter status.")

    land = (profile.get("land_ownership") or "").strip().lower()
    if land in ("landless", "marginal", "small") and any(k in desc_blob for k in ["landless", "marginal farmer", "small farmer", "kisan"]):
        reasons.append(f"Targeted support for {land.capitalize()} agricultural holdings.")

    # Scoring & Status Determination
    total_checks = len(reasons) + len(unmet)
    if total_checks == 0:
        score = 80
        status = "eligible"
    elif len(unmet) == 0:
        score = 100
        status = "eligible"
    elif len(unmet) == 1 and ("occupation" in unmet[0].lower() or "target" in unmet[0].lower()):
        score = 75
        status = "partial"
    elif len(unmet) == 1:
        score = 60
        status = "partial"
    else:
        score = max(10, 100 - (len(unmet) * 35))
        status = "ineligible"

    return {
        "eligible": status == "eligible",
        "match_score": score,
        "status": status,
        "reasons": reasons,
        "unmet_criteria": unmet
    }


@recommend_bp.route("/api/recommend", methods=["POST"])
def recommend_schemes():
    """
    POST /api/recommend
    Evaluates citizen demographic and financial profile against all active welfare schemes.
    Returns ranked schemes with transparent match explanations and official citations.
    """
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Payload must be a valid JSON object"}), 400

        # Extract & sanitize profile
        profile = {
            "age": data.get("age"),
            "gender": data.get("gender"),
            "state": data.get("state"),
            "income": data.get("income"),
            "caste": data.get("caste") or data.get("social_category"),
            "occupation": data.get("occupation"),
            "is_student": bool(data.get("is_student")),
            "is_differently_abled": bool(data.get("is_differently_abled")),
            "vulnerabilities": data.get("vulnerabilities") or [],
            "ration_card": data.get("ration_card"),
            "housing_status": data.get("housing_status"),
            "land_ownership": data.get("land_ownership"),
            "education_level": data.get("education_level"),
            "location_type": data.get("location_type"),
            "domicile_status": data.get("domicile_status")
        }

        # Validation on age & income types if passed
        if profile["age"] is not None:
            try:
                age_val = float(profile["age"])
                if age_val < 0 or age_val > 125:
                    return jsonify({"error": "Age must be between 0 and 125"}), 400
            except (ValueError, TypeError):
                return jsonify({"error": "Age must be a numeric value"}), 400

        if profile["income"] is not None:
            try:
                inc_val = float(profile["income"])
                if inc_val < 0:
                    return jsonify({"error": "Income cannot be negative"}), 400
            except (ValueError, TypeError):
                return jsonify({"error": "Income must be a numeric value"}), 400

        schemes_collection = get_schemes_collection()
        if schemes_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        # High-performance SQL pre-filter (falls back to mock collection if in test mode)
        if hasattr(schemes_collection, 'data'):
            all_schemes = list(schemes_collection.find())
            raw_schemes = [s for s in all_schemes if s.get("is_active") is not False]
        else:
            raw_schemes = get_schemes_for_recommendation(profile)

        evaluated = []

        for s in raw_schemes:
            eval_result = evaluate_eligibility(s, profile)
            if eval_result["status"] in ("eligible", "partial"):
                evaluated.append({
                    "scheme": scheme_to_dict(s),
                    "match_score": eval_result["match_score"],
                    "status": eval_result["status"],
                    "reasons": eval_result["reasons"],
                    "unmet_criteria": eval_result["unmet_criteria"]
                })

        # Sort: Highest match score first, then launched year / title
        evaluated.sort(
            key=lambda x: (
                x["match_score"],
                x["scheme"].get("launched_year") or 0
            ),
            reverse=True
        )

        active_persona = data.get("active_persona") or {}
        target_subject = (
            active_persona.get("relationship") or
            active_persona.get("label") or
            data.get("target_subject") or
            "Myself"
        )

        return jsonify({
            "status": "ok",
            "total_evaluated": len(raw_schemes),
            "matched_count": len(evaluated),
            "target_subject": target_subject,
            "persona_label": active_persona.get("label"),
            "profile": {
                k: v for k, v in profile.items() if v is not None and v != "" and v is not False and v != []
            },
            "recommendations": evaluated
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
