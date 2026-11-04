# backend/routes/recommend.py
# Transparent, rules-first eligibility recommendation engine for citizen welfare schemes

import os
import re
import json
import requests
from flask import Blueprint, request, jsonify
from database import get_schemes_collection, get_schemes_for_recommendation, scheme_to_dict, acquire_rate_limit_slot

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

    # Kinship & persona framing for empathetic, personalized evaluation
    rel = (profile.get("relationship") or profile.get("target_subject") or "self").strip().lower()
    KINSHIP_TERMS = {
        "father": {"subject": "your Father", "possessive": "your Father's", "title": "Father"},
        "mother": {"subject": "your Mother", "possessive": "your Mother's", "title": "Mother"},
        "spouse": {"subject": "your Spouse", "possessive": "your Spouse's", "title": "Spouse"},
        "son": {"subject": "your Son", "possessive": "your Son's", "title": "Son"},
        "daughter": {"subject": "your Daughter", "possessive": "your Daughter's", "title": "Daughter"},
        "brother": {"subject": "your Brother", "possessive": "your Brother's", "title": "Brother"},
        "sister": {"subject": "your Sister", "possessive": "your Sister's", "title": "Sister"},
        "grandfather": {"subject": "your Grandfather", "possessive": "your Grandfather's", "title": "Grandfather"},
        "grandmother": {"subject": "your Grandmother", "possessive": "your Grandmother's", "title": "Grandmother"},
        "self": {"subject": "you", "possessive": "your", "title": "You"},
        "myself": {"subject": "you", "possessive": "your", "title": "You"}
    }
    kin = KINSHIP_TERMS.get(rel, {"subject": f"your {rel.capitalize()}", "possessive": f"your {rel.capitalize()}'s", "title": rel.capitalize()})
    is_third_person = rel not in ("self", "myself")
    subj = kin["subject"]
    poss = kin["possessive"]

    # 1. State Check
    citizen_state = profile.get("state")
    scheme_state = eligibility.get("state", "all")
    if scheme_state and scheme_state.lower() != "all":
        if citizen_state:
            if scheme_state.lower() != citizen_state.lower() and citizen_state.lower() != "all":
                if is_third_person:
                    unmet.append(f"State restricted: Only open to residents of {scheme_state} ({subj} is in {citizen_state}).")
                else:
                    unmet.append(f"State restricted: Only open to residents of {scheme_state}.")
            else:
                if is_third_person:
                    reasons.append(f"Residency criteria met for {subj} in {scheme_state}.")
                else:
                    reasons.append(f"Residency criteria met for {scheme_state}.")
    else:
        if citizen_state and citizen_state.lower() not in ("all", ""):
            if is_third_person:
                reasons.append(f"Open to all States and Union Territories (including {subj} in {citizen_state.title()}).")
            else:
                reasons.append(f"Open to all States and Union Territories (including {citizen_state.title()}).")
        else:
            reasons.append("Open to all States and Union Territories (All India).")

    # 2. Gender Check
    citizen_gender = (profile.get("gender") or "").strip().lower()
    scheme_gender = (eligibility.get("gender") or "all").strip().lower()
    if scheme_gender not in ("all", "any"):
        if citizen_gender and citizen_gender != "all":
            if citizen_gender != scheme_gender:
                if is_third_person:
                    unmet.append(f"Target demographic: Exclusively for {scheme_gender.capitalize()} citizens ({subj} is {citizen_gender.capitalize()}).")
                else:
                    unmet.append(f"Target demographic: Exclusively for {scheme_gender.capitalize()} citizens.")
            else:
                if is_third_person:
                    reasons.append(f"Gender criteria met for {subj} ({scheme_gender.capitalize()}).")
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
                if is_third_person:
                    unmet.append(f"Age minimum: {subj.capitalize()} must be at least {min_age} years (current: {int(age_val)}).")
                else:
                    unmet.append(f"Age minimum: Must be at least {min_age} years (current: {int(age_val)}).")
            elif max_age is not None and age_val > max_age:
                if is_third_person:
                    unmet.append(f"Age limit: {subj.capitalize()} must be under {max_age} years (current: {int(age_val)}).")
                else:
                    unmet.append(f"Age limit: Must be under {max_age} years (current: {int(age_val)}).")
            else:
                # Only record reason if scheme actually defines an explicit age constraint
                if min_age is not None or max_age is not None:
                    if min_age is not None and max_age is not None:
                        if is_third_person:
                            reasons.append(f"Age {int(age_val)} meets {poss} age requirement ({int(min_age)}–{int(max_age)} years).")
                        else:
                            reasons.append(f"Age {int(age_val)} meets age requirement ({int(min_age)}–{int(max_age)} years).")
                    elif min_age is not None:
                        if is_third_person:
                            reasons.append(f"Age {int(age_val)} meets {poss} minimum age requirement (≥ {int(min_age)} years).")
                        else:
                            reasons.append(f"Age {int(age_val)} meets minimum age requirement (≥ {int(min_age)} years).")
                    else:
                        if is_third_person:
                            reasons.append(f"Age {int(age_val)} meets {poss} maximum age limit (≤ {int(max_age)} years).")
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
                if is_third_person:
                    unmet.append(f"Reserved category: Available exclusively for {', '.join(scheme_caste).upper()} ({subj} is {citizen_caste.upper()}).")
                else:
                    unmet.append(f"Reserved category: Available exclusively for {', '.join(scheme_caste).upper()}.")
            else:
                if is_third_person:
                    reasons.append(f"Affirmative welfare: Targeted for {poss} {citizen_caste.upper()} category.")
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
                if is_third_person:
                    reasons.append(f"Occupation match: Tailored for {poss} {citizen_occ.capitalize()} occupation.")
                else:
                    reasons.append(f"Occupation match: {citizen_occ.capitalize()}.")
            elif is_student and ("student" in scheme_occ_lower or "youth" in scheme_occ_lower):
                if is_third_person:
                    reasons.append(f"Student status matches {poss} educational focus.")
                else:
                    reasons.append("Student status matches scheme focus.")
        else:
            if is_third_person and citizen_occ:
                unmet.append(f"Target occupation: Tailored for {', '.join(scheme_occ).capitalize()} ({poss} occupation is {citizen_occ.capitalize()}).")
            else:
                unmet.append(f"Target occupation: Tailored for {', '.join(scheme_occ).capitalize()}.")

    # 7. Vulnerabilities & Life-Stage Support
    is_disabled = profile.get("is_differently_abled", False)
    vulnerabilities = profile.get("vulnerabilities") or []
    if isinstance(vulnerabilities, str):
        vulnerabilities = [vulnerabilities]
    if is_disabled and "disability" not in vulnerabilities:
        vulnerabilities.append("disability")

    for vuln in vulnerabilities:
        v = vuln.lower()
        if v in ("disability", "differently_abled") and any(k in desc_blob for k in ["disability", "divyang", "handicap", "udid"]):
            if is_third_person:
                reasons.append(f"Prioritizes Divyangjan welfare assistance for {subj}.")
            else:
                reasons.append("Prioritizes Divyangjan / Persons with Disabilities.")
        elif v == "widow" and ("widow" in desc_blob or "destitute women" in desc_blob):
            if is_third_person:
                reasons.append(f"Specifically covers single heads of household for {subj}.")
            else:
                reasons.append("Specifically covers Widows and single heads of household.")
        elif v == "orphan" and ("orphan" in desc_blob or "abandoned child" in desc_blob):
            reasons.append("Tailored for Orphans and vulnerable children.")
        elif v == "destitute" and ("destitute" in desc_blob or "homeless" in desc_blob):
            reasons.append("Dedicated welfare for destitute and homeless individuals.")

    # Senior Citizen recognition
    if citizen_age is not None:
        try:
            if float(citizen_age) >= 60 and any(k in desc_blob for k in ["senior citizen", "old age", "vridha", "elderly", "pension"]):
                if is_third_person:
                    reasons.append(f"Dedicated senior citizen welfare program for {subj}.")
                else:
                    reasons.append("Dedicated senior citizen welfare program.")
        except (ValueError, TypeError):
            pass

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

        # Extract active persona context
        active_persona = data.get("active_persona") or {}
        relationship = (active_persona.get("relationship") or data.get("relationship") or "self").lower()
        target_subject = (
            active_persona.get("relationship") or
            active_persona.get("label") or
            data.get("target_subject") or
            "Myself"
        )
        persona_label = active_persona.get("label") or target_subject

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
            "domicile_status": data.get("domicile_status"),
            "relationship": relationship,
            "target_subject": target_subject,
            "persona_label": persona_label
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

        return jsonify({
            "status": "ok",
            "total_evaluated": len(raw_schemes),
            "matched_count": len(evaluated),
            "target_subject": target_subject,
            "persona_label": persona_label,
            "profile": {
                k: v for k, v in profile.items() if v is not None and v != "" and v is not False and v != []
            },
            "recommendations": evaluated
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ══════════════════════════════════════════════════
#  HOUSEHOLD WELFARE MATRIX (SARAL PARIVAR DISCOVERY)
# ══════════════════════════════════════════════════

def classify_and_estimate_benefit(benefits_text):
    text = (benefits_text or "").lower()
    
    # 1. Health Cover
    if any(k in text for k in ["health cover", "hospitalization", "ayushman", "health insurance"]):
        m = re.search(r'(?:rs\.?|₹)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l)\b', text)
        amt = int(float(m.group(1)) * 100000) if m else 500000
        return {"category": "health_cover", "amount": amt, "label": f"₹{amt:,} Cashless Health Cover"}

    # 2. Annual Direct Cash Support
    m_year = re.search(r'(?:rs\.?|₹)\s*(\d+(?:,\d+)*)\s*(?:per year|/year|yearly|annually)', text)
    if m_year:
        val = int(m_year.group(1).replace(",", ""))
        return {"category": "cash_annual", "amount": val, "label": f"₹{val:,}/year Direct Cash Support"}

    # 3. Monthly Pension / Support -> Annualized
    m_month = re.search(r'(?:rs\.?|₹)\s*(\d+(?:,\d+)*)\s*(?:per month|/month|monthly)', text)
    if m_month:
        val = int(m_month.group(1).replace(",", "")) * 12
        return {"category": "cash_annual", "amount": val, "label": f"₹{val:,}/year Monthly Pension"}

    # 4. Lump-Sum Financial Aid / Grant
    m_grant = re.search(r'(?:rs\.?|₹)\s*(\d+(?:,\d+)*)', text)
    if m_grant and any(k in text for k in ["incentive", "stipend", "grant", "aid", "scholarship", "allowance"]):
        val = int(m_grant.group(1).replace(",", ""))
        return {"category": "cash_grant", "amount": val, "label": f"₹{val:,} Financial Aid"}

    # 5. Institutional Credit / Loans
    if any(k in text for k in ["loan", "mudra", "credit", "subvention", "borrow"]):
        return {"category": "credit_loan", "amount": 0, "label": "Institutional Credit / Loan"}

    # 6. In-Kind / Subsidies
    if any(k in text for k in ["free", "subsidy", "connection", "ration", "toolkit", "equipment", "cycle", "tablet"]):
        return {"category": "in_kind", "amount": 0, "label": "Subsidized / In-Kind Entitlement"}

    return {"category": "welfare", "amount": 0, "label": "Welfare Entitlement"}


def call_gemini_household_synthesis(roster_summary, metrics, client_ip):
    # Strictly prioritize GEMINI_API_KEY_SP per user directive to avoid load on primary key
    api_key = os.getenv("GEMINI_API_KEY_SP") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return generate_rule_based_household_plan(metrics)

    allowed, _, _ = acquire_rate_limit_slot("gemini_household", client_ip, global_limit=13, client_limit=5, window_sec=60)
    if not allowed:
        return generate_rule_based_household_plan(metrics)

    model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip().lower().replace(" ", "-")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}

    prompt = f"""You are Saral Niti Sahayak, India's leading public welfare advisor.
Analyze the following multi-member household welfare entitlements discovery results:

Household Summary:
- Total Members: {metrics.get('total_members', 0)}
- Total Qualified Schemes: {metrics.get('total_schemes_matched', 0)}
- Potential Annual Direct Cash Support: ₹{metrics.get('estimated_annual_cash_inflow', 0):,}
- Cashless Health Protection: ₹{metrics.get('total_health_cover', 0):,}

Member Breakdown:
{roster_summary}

INSTRUCTIONS:
1. Provide a warm, empowering, highly practical 3-4 bullet "Family Welfare Action Plan" in clear bilingual Hinglish/English.
2. Step 1: Immediate priority enrollment (which member should apply first and why).
3. Step 2: Benefit stacking (e.g. how agricultural DBT + maternal aid + student scholarships complement each other).
4. Step 3: Critical document readiness (e.g. NPCI bank account mapping and land/caste verification).
5. Keep it concise, respectful, and formatted with clean bullet points.
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600}
    }

    try:
        res = requests.post(url, headers=headers, json=payload, timeout=12)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates and "content" in candidates[0]:
                parts = candidates[0]["content"].get("parts", [])
                if parts and "text" in parts[0]:
                    return parts[0]["text"].strip()
    except Exception:
        pass

    return generate_rule_based_household_plan(metrics)


def generate_rule_based_household_plan(metrics):
    cash_str = f"₹{metrics.get('estimated_annual_cash_inflow', 0):,}" if metrics.get('estimated_annual_cash_inflow') else "Direct Cash"
    health_str = f"₹{metrics.get('total_health_cover', 0):,}" if metrics.get('total_health_cover') else "₹5,00,000"
    return (
        f"• **Immediate Priority:** Begin with central DBT initiatives for the primary earning member (such as PM-KISAN or pensions) as they provide foundational liquidity ({cash_str}/year).\n"
        f"• **Healthcare Protection:** Ensure the entire family is enrolled under Ayushman Bharat or State Health Cards for up to {health_str} in cashless hospitalization coverage.\n"
        f"• **Education & Livelihood:** Apply for student scholarships and youth skill development schemes early in the academic cycle to prevent missing cutoff deadlines.\n"
        f"• **Next Steps for CSC:** Carry original Aadhaar cards, updated bank passbooks (active on NPCI mapper), and revenue records to your nearest Jan Seva Kendra."
    )


@recommend_bp.route("/api/recommend/household", methods=["POST"])
def recommend_household():
    """
    POST /api/recommend/household
    Evaluates multi-member household dossiers in parallel.
    """
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Payload must be a valid JSON object"}), 400

        members = data.get("members")
        if not isinstance(members, list) or len(members) == 0:
            return jsonify({"error": "Payload must include a non-empty 'members' list"}), 400

        # Cap members at 15 to prevent resource exhaustion
        members = members[:15]
        schemes_collection = get_schemes_collection()
        if schemes_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        members_matrix = []
        unique_schemes = set()
        master_docs = {}
        total_cash_inflow = 0
        total_health_cover = 0
        in_kind_count = 0
        credited_scheme_types = set()

        for m in members:
            rel = (m.get("relationship") or "self").lower()
            lbl = m.get("label") or rel.capitalize()
            member_profile = {
                "age": m.get("age"),
                "gender": m.get("gender"),
                "state": m.get("state"),
                "income": m.get("income"),
                "caste": m.get("caste") or m.get("social_category"),
                "occupation": m.get("occupation"),
                "is_student": m.get("occupation") == "student" or bool(m.get("is_student")),
                "is_differently_abled": bool(m.get("disability") or m.get("is_differently_abled")),
                "vulnerabilities": m.get("vulnerabilities") or [],
                "ration_card": m.get("ration_card"),
                "housing_status": m.get("housing_status"),
                "land_ownership": m.get("land_ownership"),
                "education_level": m.get("education_level"),
                "relationship": rel,
                "target_subject": rel,
                "persona_label": lbl
            }

            if hasattr(schemes_collection, 'data'):
                all_schemes = list(schemes_collection.find())
                raw_schemes = [s for s in all_schemes if s.get("is_active") is not False]
            else:
                raw_schemes = get_schemes_for_recommendation(member_profile)

            evaluated_member_schemes = []
            for s in raw_schemes:
                eval_res = evaluate_eligibility(s, member_profile)
                if eval_res["status"] in ("eligible", "partial"):
                    s_dict = scheme_to_dict(s)
                    b_info = classify_and_estimate_benefit(s_dict.get("benefits"))
                    evaluated_member_schemes.append({
                        "scheme": s_dict,
                        "match_score": eval_res["match_score"],
                        "status": eval_res["status"],
                        "reasons": eval_res["reasons"],
                        "unmet_criteria": eval_res["unmet_criteria"],
                        "benefit_info": b_info
                    })
                    unique_schemes.add(s_dict.get("title"))

                    # Aggregate household totals safely
                    sch_title = s_dict.get("title", "")
                    if b_info["category"] in ("cash_annual", "cash_grant"):
                        if (sch_title, m.get("id")) not in credited_scheme_types:
                            total_cash_inflow += b_info["amount"]
                            credited_scheme_types.add((sch_title, m.get("id")))
                    elif b_info["category"] == "health_cover":
                        total_health_cover = max(total_health_cover, b_info["amount"])
                    elif b_info["category"] == "in_kind":
                        in_kind_count += 1

                    # Collect master documents
                    for doc in (s_dict.get("documents_required") or s_dict.get("documents") or []):
                        if doc not in master_docs:
                            master_docs[doc] = {
                                "name": doc,
                                "required_by": [lbl]
                            }
                        elif lbl not in master_docs[doc]["required_by"]:
                            master_docs[doc]["required_by"].append(lbl)

            evaluated_member_schemes.sort(
                key=lambda x: (x["match_score"], x["scheme"].get("launched_year") or 0),
                reverse=True
            )

            members_matrix.append({
                "member_id": m.get("id"),
                "label": lbl,
                "relationship": rel,
                "profile": member_profile,
                "matched_count": len(evaluated_member_schemes),
                "top_recommendations": evaluated_member_schemes[:8]
            })

        household_summary = {
            "total_members": len(members_matrix),
            "total_schemes_matched": len(unique_schemes),
            "estimated_annual_cash_inflow": total_cash_inflow,
            "total_health_cover": total_health_cover or 500000,
            "in_kind_benefits_count": in_kind_count
        }

        # Format roster summary for AI synthesis
        roster_lines = []
        for mm in members_matrix:
            top_titles = [x["scheme"]["title"] for x in mm["top_recommendations"][:3]]
            roster_lines.append(f"- {mm['relationship'].capitalize()} ({mm['label']}): {mm['matched_count']} schemes matched ({', '.join(top_titles)})")
        roster_summary_text = "\n".join(roster_lines)

        client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr or "127.0.0.1"
        include_ai = data.get("include_ai_synthesis", True)
        ai_synthesis = call_gemini_household_synthesis(roster_summary_text, household_summary, client_ip) if include_ai else None

        return jsonify({
            "status": "ok",
            "household_summary": household_summary,
            "members_matrix": members_matrix,
            "master_document_checklist": list(master_docs.values()),
            "ai_synthesis": ai_synthesis
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
