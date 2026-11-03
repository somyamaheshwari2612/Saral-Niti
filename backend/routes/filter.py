# backend/routes/filter.py
# Comprehensive multi-dimensional filtering engine for 4,800+ welfare schemes
# Supports: Demographics, Geography, Socio-Economic, Education/Occupation, Benefit Types & Enterprise

import os
import re
import json
from flask import Blueprint, jsonify, request
from database import get_db_connection, row_to_dict, scheme_to_dict

filter_bp = Blueprint("filter", __name__)

ALLOWED_CATEGORIES = [
    "agriculture", "health", "education", "housing", "employment",
    "women", "financial", "elderly", "youth", "disability"
]

BENEFIT_KEYWORD_MAP = {
    "dbt": [
        "dbt", "pension", "cash", "stipend", "direct benefit",
        "financial assistance", "incentive", "allowance", "maternity"
    ],
    "subsidy": [
        "subsidy", "concession", "rebate", "discount", "equipment",
        "fertilizer", "solar", "ev", "electric vehicle"
    ],
    "loan": [
        "loan", "credit", "mudra", "interest subvention", "collateral",
        "borrow", "micro credit", "refinance"
    ],
    "scholarship": [
        "scholarship", "fellowship", "coaching", "tuition", "hostel",
        "stipend", "skill development", "training", "course"
    ],
    "in_kind": [
        "equipment", "toolkit", "tool kit", "laptop", "bicycle", "cycle",
        "sewing machine", "free ration", "assistive device", "uniform", "books"
    ],
    "insurance": [
        "insurance", "bima", "health cover", "hospitalization", "ayushman",
        "accidental cover", "life insurance", "crop insurance"
    ]
}

PROFESSION_KEYWORD_MAP = {
    "student": ["student", "scholar", "aspirant"],
    "farmer": ["farmer", "kisan", "cultivator", "agriculture"],
    "unemployed": ["unemployed", "job seeker", "jobseeker"],
    "daily_wage": ["daily wage", "labourer", "laborer", "construction worker", "unorganized"],
    "artisan": ["artisan", "craftsperson", "potter", "blacksmith", "carpenter", "sculptor"],
    "street_vendor": ["vendor", "hawker", "street food", "pm svanidhi"],
    "self_employed": ["self employed", "entrepreneur", "own business"],
    "domestic_worker": ["domestic worker", "maid", "helper"],
    "gig_worker": ["gig worker", "platform worker", "delivery", "aggregator"],
    "sanitation": ["sanitation", "safai", "waste picker", "scavenger", "swachhata"],
    "fisherfolk": ["fisher", "matsya", "aquaculture", "fish", "marine"],
    "handloom_weaver": ["weaver", "handloom", "bunkar", "spinning", "khadi", "textile"]
}

VULNERABILITY_KEYWORD_MAP = {
    "disability": [
        "disability", "divyang", "handicapped", "differently abled",
        "blind", "deaf", "locomotor", "visual", "hearing", "mental", "udid"
    ],
    "widow": ["widow", "widowed", "destitute women"],
    "orphan": ["orphan", "parentless", "abandoned child"],
    "destitute": ["destitute", "beggar", "indigent", "homeless"],
    "single_women": ["single women", "unmarried women", "abandoned", "divorced"]
}

ENTERPRISE_KEYWORD_MAP = {
    "individual": ["individual", "citizen", "person"],
    "shg": ["shg", "self help group", "women group", "cooperative"],
    "fpo": ["fpo", "farmer producer", "producer company", "fpc"],
    "cooperative": ["cooperative", "society", "federation"],
    "msme": ["msme", "micro enterprise", "small enterprise", "udyam", "startup", "entrepreneur"]
}

BUSINESS_STAGE_KEYWORD_MAP = {
    "ideation": ["ideation", "idea", "prototype", "incubation", "incubator"],
    "pre_revenue": ["pre revenue", "early stage", "seed", "seed fund", "proof of concept"],
    "growth": ["growth", "scaling", "expansion", "commercialization", "stand up"]
}

BUSINESS_SECTOR_KEYWORD_MAP = {
    "agriculture": ["agriculture", "agro", "farming", "horticulture", "dairy", "fisheries"],
    "manufacturing": ["manufacturing", "industry", "production", "maker", "factory"],
    "services": ["services", "service", "hospitality", "logistics", "consulting"],
    "handloom": ["handloom", "textile", "weaving", "handicrafts", "khadi", "artisan"],
    "tech": ["technology", "tech", "software", "digital", "ai", "electronics", "it"]
}

EDUCATION_KEYWORD_MAP = {
    "illiterate": ["illiterate", "uneducated", "no formal education"],
    "below_10th": ["below 10th", "primary", "middle school", "8th pass", "5th pass"],
    "10th": ["10th", "matric", "high school", "secondary school", "sslc"],
    "12th": ["12th", "intermediate", "senior secondary", "higher secondary", "10 2", "hsc"],
    "graduate": ["graduate", "degree", "bachelors", "undergraduate", "college", "university"],
    "postgraduate": ["post graduate", "postgraduate", "masters", "phd", "doctorate"],
    "vocational": ["iti", "vocational", "polytechnic", "diploma", "skill development", "training"]
}


def make_fts_or_clause(keywords):
    """
    Safely wraps each keyword in double quotes and returns a clean FTS5 OR clause.
    Special SQLite FTS characters (-, :, *, etc.) inside the quotes are treated as literal tokens.
    """
    clean_terms = []
    for kw in keywords:
        k = str(kw).replace('"', '').strip()
        if k:
            clean_terms.append(f'"{k}"')
    return f"({' OR '.join(clean_terms)})" if clean_terms else ""


def build_filter_query(filters):
    """
    Constructs SQL WHERE clause and parameter list based on multi-dimensional filters.
    Returns:
        where_clauses (list[str]), params (list), fts_terms (list[str]), target_age (float/None), income_max (float/None)
    """
    where_clauses = ["s.is_active = 1"]
    params = []
    fts_terms = []

    # 1. Category
    category = (filters.get("category") or "").strip().lower()
    if category and category != "all" and category in ALLOWED_CATEGORIES:
        where_clauses.append("s.category = ? COLLATE NOCASE")
        params.append(category)

    # 2. Level & State / UT
    state = (filters.get("state") or "").strip()
    if state and state.lower() != "all":
        # Matches if scheme is Central (All India) OR specifically targets this state
        where_clauses.append("(s.level = 'central' OR s.ministry LIKE ? OR s.eligibility_json LIKE ?)")
        params.append(f"%{state}%")
        params.append(f"%{state}%")

    level = (filters.get("level") or "").strip().lower()
    if level in ("central", "state"):
        where_clauses.append("s.level = ?")
        params.append(level)

    # Hierarchy: District, Block, Panchayat
    district = (filters.get("district") or "").strip()
    if district and district.lower() != "all":
        fts_terms.append(make_fts_or_clause([district]))

    block = (filters.get("block") or filters.get("tehsil") or "").strip()
    if block and block.lower() != "all":
        fts_terms.append(make_fts_or_clause([block]))

    panchayat = (filters.get("panchayat") or filters.get("municipality") or "").strip()
    if panchayat and panchayat.lower() != "all":
        fts_terms.append(make_fts_or_clause([panchayat]))

    # 3. Location Type (Rural, Urban, Semi-urban, Tribal)
    location_type = (filters.get("location_type") or "").strip().lower()
    if location_type == "rural":
        fts_terms.append(make_fts_or_clause(["rural", "gram", "panchayat", "village", "kisan", "agriculture"]))
    elif location_type == "urban":
        fts_terms.append(make_fts_or_clause(["urban", "municipality", "city", "town", "slum", "nagar"]))
    elif location_type in ("semi_urban", "semi-urban"):
        fts_terms.append(make_fts_or_clause(["semi-urban", "semi urban", "peri-urban", "town", "tehsil", "rurban"]))
    elif location_type == "tribal":
        fts_terms.append(make_fts_or_clause(["tribal", "scheduled tribe", "schedule v", "schedule vi", "adivasi", "forest"]))

    # 4. Domicile Status (Native vs Migrant)
    domicile = (filters.get("domicile_status") or "").strip().lower()
    if domicile == "migrant":
        fts_terms.append(make_fts_or_clause(["migrant", "inter-state", "portable", "one nation", "unorganized"]))
    elif domicile == "native":
        fts_terms.append(make_fts_or_clause(["domicile", "native", "resident", "local"]))

    # 5. Gender (Male, Female, Transgender)
    gender = (filters.get("gender") or "").strip().lower()
    if gender and gender not in ("all", "any"):
        if gender == "transgender":
            fts_terms.append(make_fts_or_clause(["transgender", "third gender", "trans", "lgbtq"]))
        elif gender in ("male", "female"):
            # Matches 'all' schemes OR schemes targeting this specific gender
            where_clauses.append("(s.eligibility_json LIKE '%\"gender\": \"all\"%' OR s.eligibility_json LIKE ?)")
            params.append(f'%\"gender\": \"{gender}\"%')

    # 6. Age & Age Buckets
    age = filters.get("age")
    age_group = (filters.get("age_group") or "").strip().lower()
    target_age = None

    if age is not None and str(age).strip() != "":
        try:
            target_age = float(age)
        except (ValueError, TypeError):
            pass
    elif age_group and age_group != "all":
        if age_group == "child":
            target_age = 8
        elif age_group == "student":
            target_age = 18
        elif age_group in ("working_age", "working"):
            target_age = 30
        elif age_group in ("senior", "elderly"):
            target_age = 65

    # 7. Social Category (General, SC, ST, OBC, Minority, DNT)
    caste = (filters.get("social_category") or filters.get("caste") or "").strip().lower()
    if caste and caste != "all":
        if caste == "minority":
            fts_terms.append(make_fts_or_clause(["minority", "muslim", "christian", "sikh", "buddhist", "jain", "parsi"]))
        elif caste == "dnt":
            fts_terms.append(make_fts_or_clause(["denotified", "nomadic", "semi-nomadic", "dnt"]))
        elif caste in ("sc", "st", "obc", "general"):
            where_clauses.append("(s.eligibility_json LIKE '%\"caste\":%' AND (s.eligibility_json LIKE ? OR s.eligibility_json LIKE '%\"general\"%'))")
            params.append(f'%\"{caste}\"%')

    # 8. Special Vulnerability
    vulnerabilities = filters.get("vulnerabilities") or []
    if isinstance(vulnerabilities, str):
        vulnerabilities = [vulnerabilities]

    for vuln in vulnerabilities:
        v_key = vuln.strip().lower()
        if v_key in VULNERABILITY_KEYWORD_MAP:
            fts_terms.append(make_fts_or_clause(VULNERABILITY_KEYWORD_MAP[v_key]))

    # 9. Socio-Economic & Financial
    # Income
    income_max = filters.get("income_max")
    income_range = (filters.get("income_range") or "").strip().lower()
    if income_range and income_range != "all":
        if income_range == "under_1lakh":
            income_max = 100000
        elif income_range == "1_to_2.5lakh":
            income_max = 250000
        elif income_range == "2.5_to_8lakh":
            income_max = 800000
        elif income_range == "above_8lakh":
            income_max = None

    if income_max is not None:
        try:
            income_max = float(income_max)
        except (ValueError, TypeError):
            income_max = None

    # Ration Card (AAY, BPL, PHH)
    ration_card = (filters.get("ration_card") or "").strip().lower()
    if ration_card == "aay":
        fts_terms.append(make_fts_or_clause(["antyodaya", "aay", "poorest of the poor"]))
    elif ration_card == "bpl":
        fts_terms.append(make_fts_or_clause(["bpl", "below poverty line", "ration card"]))
    elif ration_card == "phh":
        fts_terms.append(make_fts_or_clause(["priority household", "phh", "ration"]))

    # Housing Status (Homeless, Kutcha, Pucca)
    housing_status = (filters.get("housing_status") or "").strip().lower()
    if housing_status in ("homeless", "destitute"):
        fts_terms.append(make_fts_or_clause(["homeless", "houseless", "destitute", "shelter"]))
    elif housing_status == "kutcha":
        fts_terms.append(make_fts_or_clause(["kutcha", "temporary house", "pm awas", "shelter"]))
    elif housing_status == "pucca":
        fts_terms.append(make_fts_or_clause(["pucca", "pm awas", "housing"]))

    # Land Ownership (Landless, Marginal, Small, Large)
    land = (filters.get("land_ownership") or "").strip().lower()
    if land == "landless":
        fts_terms.append(make_fts_or_clause(["landless", "agricultural labourer", "tenant", "share cropper"]))
    elif land == "marginal":
        fts_terms.append(make_fts_or_clause(["marginal farmer", "small and marginal", "1 hectare", "one hectare"]))
    elif land == "small":
        fts_terms.append(make_fts_or_clause(["small farmer", "marginal", "2 hectare", "two hectare"]))
    elif land == "large":
        fts_terms.append(make_fts_or_clause(["large farmer", "agriculture", "irrigation", "farm", "land owner"]))

    # 10. Education Level
    education = (filters.get("education_level") or "").strip().lower()
    if education and education != "all" and education in EDUCATION_KEYWORD_MAP:
        fts_terms.append(make_fts_or_clause(EDUCATION_KEYWORD_MAP[education]))

    # 11. Occupation & Targeted Professions
    occ = (filters.get("occupation") or "").strip().lower()
    targeted_prof = (filters.get("targeted_profession") or "").strip().lower()

    if targeted_prof and targeted_prof in PROFESSION_KEYWORD_MAP:
        fts_terms.append(make_fts_or_clause(PROFESSION_KEYWORD_MAP[targeted_prof]))
    elif occ and occ in PROFESSION_KEYWORD_MAP:
        fts_terms.append(make_fts_or_clause(PROFESSION_KEYWORD_MAP[occ]))

    # 12. Benefit Type ("What I Need")
    benefit_type = (filters.get("benefit_type") or "").strip().lower()
    if benefit_type and benefit_type != "all" and benefit_type in BENEFIT_KEYWORD_MAP:
        fts_terms.append(make_fts_or_clause(BENEFIT_KEYWORD_MAP[benefit_type]))

    # 13. Enterprise / MSME
    applicant_type = (filters.get("applicant_type") or "").strip().lower()
    if applicant_type and applicant_type != "all" and applicant_type in ENTERPRISE_KEYWORD_MAP:
        fts_terms.append(make_fts_or_clause(ENTERPRISE_KEYWORD_MAP[applicant_type]))

    business_stage = (filters.get("business_stage") or "").strip().lower()
    if business_stage and business_stage != "all" and business_stage in BUSINESS_STAGE_KEYWORD_MAP:
        fts_terms.append(make_fts_or_clause(BUSINESS_STAGE_KEYWORD_MAP[business_stage]))

    business_sector = (filters.get("business_sector") or "").strip().lower()
    if business_sector and business_sector != "all" and business_sector in BUSINESS_SECTOR_KEYWORD_MAP:
        fts_terms.append(make_fts_or_clause(BUSINESS_SECTOR_KEYWORD_MAP[business_sector]))

    # Filter out empty clauses
    fts_terms = [t for t in fts_terms if t]

    return where_clauses, params, fts_terms, target_age, income_max


def execute_filtered_query(filters, page=1, page_size=0):
    """
    Executes hybrid SQL and FTS5 query with in-memory validation of numeric age and income.
    When page_size is 0, returns all matching schemes (for client-side 24-card batch pagination).
    When page_size > 0, returns the requested slice.
    """
    con = get_db_connection()
    cur = con.cursor()

    where_clauses, params, fts_terms, target_age, income_max = build_filter_query(filters)

    # If FTS terms exist, join with schemes_fts
    if fts_terms:
        combined_fts = " AND ".join(fts_terms)
        where_sql = " AND ".join(where_clauses)
        query = f"""
            SELECT s.* FROM schemes s
            JOIN schemes_fts f ON s.id = f.rowid
            WHERE {where_sql} AND schemes_fts MATCH ?
            ORDER BY s.id ASC
        """
        exec_params = params + [combined_fts]
    else:
        where_sql = " AND ".join(where_clauses)
        query = f"SELECT s.* FROM schemes s WHERE {where_sql} ORDER BY s.id ASC"
        exec_params = params

    cur.execute(query, exec_params)
    rows = cur.fetchall()

    # In-memory post-filter for exact numeric age & income caps
    matching_schemes = []
    for r in rows:
        item = row_to_dict(r)
        elig = item.get("eligibility", {}) or {}

        # Age check
        if target_age is not None:
            min_age = elig.get("min_age")
            max_age = elig.get("max_age")
            if min_age is not None and target_age < min_age:
                continue
            if max_age is not None and target_age > max_age:
                continue

        # Income check
        if income_max is not None:
            income_limit = elig.get("income_limit")
            if income_limit is not None and income_max > income_limit:
                continue

        matching_schemes.append(item)

    total_count = len(matching_schemes)
    if page_size > 0:
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_schemes = matching_schemes[start_idx:end_idx]
        has_more = end_idx < total_count
    else:
        paged_schemes = matching_schemes
        has_more = False

    return {
        "status": "ok",
        "total_matched": total_count,
        "count": total_count,
        "page": page,
        "page_size": page_size if page_size > 0 else total_count,
        "has_more": has_more,
        "schemes": paged_schemes
    }


# ══════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════

# GET /api/filter (Backward-compatible + query-param enabled)
@filter_bp.route("/api/filter", methods=["GET"])
def filter_schemes():
    try:
        category = request.args.get("category", "").strip().lower()

        # If empty category with no other params, return empty for backward compatibility
        has_other_params = any(
            request.args.get(k) for k in [
                "state", "level", "gender", "age", "age_group", "caste", "social_category",
                "occupation", "benefit_type", "location_type", "ration_card", "housing_status"
            ]
        )
        if not category and not has_other_params:
            return jsonify({
                "status": "ok",
                "category": "",
                "count": 0,
                "total_matched": 0,
                "schemes": []
            })

        # Length check
        if len(category) > 50:
            return jsonify({"error": "Category value too long"}), 400

        # Whitelist check for category query
        if category and category != "all" and category not in ALLOWED_CATEGORIES:
            return jsonify({"error": f"Invalid category: {category}"}), 400

        # Build filter dict from request.args
        filters = {
            "category": category,
            "state": request.args.get("state", "").strip(),
            "level": request.args.get("level", "").strip(),
            "district": request.args.get("district", "").strip(),
            "block": request.args.get("block", "").strip(),
            "panchayat": request.args.get("panchayat", "").strip(),
            "gender": request.args.get("gender", "").strip(),
            "age": request.args.get("age"),
            "age_group": request.args.get("age_group", "").strip(),
            "social_category": (request.args.get("social_category") or request.args.get("caste", "")).strip(),
            "location_type": request.args.get("location_type", "").strip(),
            "domicile_status": request.args.get("domicile_status", "").strip(),
            "income_max": request.args.get("income_max"),
            "income_range": request.args.get("income_range", "").strip(),
            "ration_card": request.args.get("ration_card", "").strip(),
            "housing_status": request.args.get("housing_status", "").strip(),
            "land_ownership": request.args.get("land_ownership", "").strip(),
            "education_level": request.args.get("education_level", "").strip(),
            "occupation": request.args.get("occupation", "").strip(),
            "targeted_profession": request.args.get("targeted_profession", "").strip(),
            "benefit_type": request.args.get("benefit_type", "").strip(),
            "applicant_type": request.args.get("applicant_type", "").strip(),
            "business_stage": request.args.get("business_stage", "").strip(),
            "business_sector": request.args.get("business_sector", "").strip()
        }

        # Handle multiple vulnerabilities if passed via query params
        vulns = request.args.getlist("vulnerabilities") or request.args.getlist("vulnerability")
        if not vulns and request.args.get("vulnerabilities"):
            vulns = [v.strip() for v in request.args.get("vulnerabilities").split(",")]
        filters["vulnerabilities"] = vulns

        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 0))

        result = execute_filtered_query(filters, page=page, page_size=page_size)
        return jsonify({
            "status": "ok",
            "category": category,
            "count": result["total_matched"],
            "total_matched": result["total_matched"],
            "page": result["page"],
            "page_size": result["page_size"],
            "has_more": result["has_more"],
            "schemes": result["schemes"]
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# POST /api/filter & POST /api/filter/advanced (Comprehensive multi-dimensional filtering)
@filter_bp.route("/api/filter", methods=["POST"])
@filter_bp.route("/api/filter/advanced", methods=["POST"])
def advanced_filter_schemes():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Payload must be a JSON object"}), 400

        # Extract nested structures or flat keys
        demographics = data.get("demographics") or {}
        geographic = data.get("geographic") or {}
        socio_economic = data.get("socio_economic") or {}
        edu_occ = data.get("education_occupation") or {}
        enterprise = data.get("enterprise") or {}

        flat_filters = {
            # Demographics
            "age": data.get("age") or demographics.get("age"),
            "age_group": data.get("age_group") or demographics.get("age_group"),
            "gender": data.get("gender") or demographics.get("gender"),
            "social_category": data.get("social_category") or demographics.get("social_category") or data.get("caste"),
            "vulnerabilities": data.get("vulnerabilities") or demographics.get("vulnerabilities"),

            # Geographic & Domicile
            "state": data.get("state") or geographic.get("state"),
            "level": data.get("level") or geographic.get("level"),
            "district": data.get("district") or geographic.get("district"),
            "block": data.get("block") or geographic.get("block"),
            "panchayat": data.get("panchayat") or geographic.get("panchayat"),
            "location_type": data.get("location_type") or geographic.get("location_type"),
            "domicile_status": data.get("domicile_status") or geographic.get("domicile_status"),

            # Socio-Economic & Financial
            "income_max": data.get("income_max") or socio_economic.get("income_max"),
            "income_range": data.get("income_range") or socio_economic.get("income_range"),
            "ration_card": data.get("ration_card") or socio_economic.get("ration_card"),
            "housing_status": data.get("housing_status") or socio_economic.get("housing_status"),
            "land_ownership": data.get("land_ownership") or socio_economic.get("land_ownership"),

            # Education & Occupation
            "education_level": data.get("education_level") or edu_occ.get("education_level"),
            "occupation": data.get("occupation") or edu_occ.get("occupation"),
            "targeted_profession": data.get("targeted_profession") or edu_occ.get("targeted_profession"),

            # Benefit Type & Enterprise
            "benefit_type": data.get("benefit_type"),
            "applicant_type": data.get("applicant_type") or enterprise.get("applicant_type"),
            "business_stage": data.get("business_stage") or enterprise.get("business_stage"),
            "business_sector": data.get("business_sector") or enterprise.get("business_sector"),
            "category": data.get("category")
        }

        page = int(data.get("page") or 1)
        # Default page_size 0 gives full matching array so client-side 24-card batch pagination works
        page_size = int(data.get("page_size") if data.get("page_size") is not None else 0)

        result = execute_filtered_query(flat_filters, page=page, page_size=page_size)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
