# backend/routes/pre_audit.py
# Last-Mile Pre-Flight Audit & Pre-Verification Diagnostic Engine for Saral-Niti
# Prevents application failure traps (Aadhaar-Bank NPCI seeding, name mismatch, document expiration, duplicate benefits)

import os
import re
import difflib
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_scheme_by_id, scheme_to_dict

pre_audit_bp = Blueprint("pre_audit", __name__)


# ══════════════════════════════════════════════════
#  NAME SIMILARITY & PHONETIC NORMALIZATION
# ══════════════════════════════════════════════════
def normalize_name(name):
    """Normalizes Indian names by stripping titles, honorifics, and redundant punctuation."""
    if not name:
        return ""
    n = name.lower().strip()
    # Remove common honorifics and noise words
    honorifics = [
        r"\bshri\b", r"\bshree\b", r"\bsmt\b", r"\bshrimati\b", r"\bmr\b",
        r"\bmrs\b", r"\bms\b", r"\bmiss\b", r"\bdr\b", r"\bmaster\b",
        r"\bmd\b", r"\bmohd\b", r"\bmohammed\b", r"\bmuhammad\b"
    ]
    for h in honorifics:
        n = re.sub(h, "", n)
    # Remove special characters
    n = re.sub(r"[^a-z\s]", " ", n)
    return " ".join(n.split())


def calculate_name_similarity(name1, name2):
    """
    Simulates PFMS / Core Banking (CBS) automated name-matching verification.
    Uses SequenceMatcher ratio combined with token-set intersection.
    Returns:
        dict: {
            "score": int (0-100),
            "status": "PASS" | "WARN" | "FAIL",
            "message": str,
            "action": str
        }
    """
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)

    if not n1 or not n2:
        return {
            "score": 0,
            "status": "WARN",
            "message": "Both Aadhaar name and Bank Account name are required to verify name consistency.",
            "action": "Enter names exactly as printed on your Aadhaar card and Bank Passbook."
        }

    if n1 == n2:
        return {
            "score": 100,
            "status": "PASS",
            "message": "Exact Match: Names on Aadhaar and Bank Passbook match perfectly.",
            "action": "Safe for automated PFMS banking clearance."
        }

    # Levenshtein sequence ratio
    seq_ratio = difflib.SequenceMatcher(None, n1, n2).ratio()

    # Token overlap (handles rearranged names e.g. "Sharma Ramesh" vs "Ramesh Sharma")
    t1 = set(n1.split())
    t2 = set(n2.split())

    if t1 == t2 and len(t1) > 0:
        return {
            "score": 92,
            "status": "PASS",
            "message": "High Concordance (92%): First and last name transposed (e.g. surname first), acceptable to CBS/PFMS gateways.",
            "action": "Ensure name components are aligned when filling the application form."
        }

    token_overlap = len(t1.intersection(t2)) / max(len(t1.union(t2)), 1)

    combined_score = round(((seq_ratio * 0.6) + (token_overlap * 0.4)) * 100)
    combined_score = max(5, min(100, combined_score))

    if combined_score >= 85:
        return {
            "score": combined_score,
            "status": "PASS",
            "message": f"High Concordance ({combined_score}%): Minor spelling or initial variation acceptable to most CBS gateways.",
            "action": "Ensure bank passbook photocopy is clear when uploading supporting documents."
        }
    elif combined_score >= 70:
        return {
            "score": combined_score,
            "status": "WARN",
            "message": f"Moderate Discrepancy ({combined_score}%): Name on Bank Account differs noticeably from Aadhaar.",
            "action": "Risk of PFMS hold. Submit a self-declaration/gazette affidavit or update bank passbook before applying."
        }
    else:
        return {
            "score": combined_score,
            "status": "FAIL",
            "message": f"Severe Name Mismatch ({combined_score}%): Automated DBT validation will fail at the departmental gateway.",
            "action": "Critical: Visit your bank branch to align passbook name with your official Aadhaar card."
        }


# ══════════════════════════════════════════════════
#  SCHEME LAST-MILE PROFILE ANALYZER
# ══════════════════════════════════════════════════
def analyze_scheme_last_mile(scheme):
    """
    Generates a deterministic Last-Mile Audit Specification for any given scheme.
    Identifies real-world departmental failure traps based on category, ministry,
    benefit modality, and required documentation.
    """
    scheme = scheme_to_dict(scheme) or {}
    title = scheme.get("title", "Government Scheme")
    category = (scheme.get("category") or "general").lower()
    ministry = scheme.get("ministry") or "Government of India"
    benefits = scheme.get("benefits", "")
    description = scheme.get("description", "")
    docs = [d.lower() for d in (scheme.get("documents_required") or [])]
    eligibility = scheme.get("eligibility", {}) or {}

    blob = f"{title} {category} {benefits} {description} {' '.join(docs)}".lower()

    # Determine DBT Modality
    dbt_keywords = [
        "dbt", "cash", "pension", "stipend", "scholarship", "financial assistance",
        "subsidy", "incentive", "rs.", "inr", "₹", "per month", "per annum",
        "kisan", "pm-kisan", "samman", "pmegp", "mudra"
    ]
    is_dbt = any(k in blob for k in dbt_keywords)

    is_pension = any(k in blob for k in ["pension", "old age", "vridha", "widow", "divyang pension", "nsap"])
    is_farmer = any(k in blob for k in ["farmer", "kisan", "agriculture", "crop", "land", "fasal", "pmfby"])
    needs_income = any("income" in d for d in docs) or bool(eligibility.get("income_limit"))
    needs_caste = any("caste" in d or "category" in d or "community" in d for d in docs) or bool(eligibility.get("caste"))
    needs_biometric = is_dbt or any(k in blob for k in ["kisan", "awas", "ayushman", "ration", "pmjay", "e-kyc", "biometric"])

    checkpoints = []

    # 1. Aadhaar-Bank NPCI Seeding (The #1 DBT Failure Mode)
    if is_dbt:
        checkpoints.append({
            "id": "npci_seeding",
            "dimension": "Aadhaar Payment Bridge System (APBS)",
            "title": "Aadhaar-NPCI Bank Seeding Mandate (आधार-बैंक एनपीसीआई मैपिंग)",
            "mandatory": True,
            "risk_type": "HIGH",
            "departmental_trap": (
                "Direct Benefit Transfer (DBT) funds are routed through the NPCI Aadhaar Payment Bridge. "
                "Opening a bank account with Aadhaar is NOT enough. The account must be explicitly seeded on the "
                "NPCI central mapper. Over 68% of DBT failures result from unmapped or dormant accounts."
            ),
            "verification_instruction": "Dial *99*99*1# from your registered mobile SIM or verify online at myaadhaar.uidai.gov.in (Bank Seeding Status).",
            "prevention_step": "If unseeded, submit the DBT Annexure-I mandate form at your home bank branch."
        })

        checkpoints.append({
            "id": "name_matching",
            "dimension": "Banking Identity Concordance",
            "title": "Aadhaar vs Passbook Name Concordance (नाम में वर्तनी मिलान)",
            "mandatory": True,
            "risk_type": "HIGH",
            "departmental_trap": (
                "PFMS and Core Banking Systems run automated fuzzy matching between the applicant's Aadhaar and "
                "bank account holder name. Spelling variations, missing middle names, or initial discrepancies trigger "
                "rejection error 'Account Name Mismatch'."
            ),
            "verification_instruction": "Verify that your name on the bank passbook exactly matches the printed name on your Aadhaar card.",
            "prevention_step": "If different, obtain a bank name modification or attach a sworn affidavit before submission."
        })

    # 2. Aadhaar Mobile Number Active Linkage
    checkpoints.append({
        "id": "mobile_otp",
        "dimension": "Communications & Deemed Rejection",
        "title": "Aadhaar Mobile Linkage & OTP Deliverability (सक्रिय मोबाइल लिंकेज)",
        "mandatory": True,
        "risk_type": "CRITICAL",
        "departmental_trap": (
            "Scrutiny notices, e-Sign verifications, and deficiency correction windows (typically 7-15 days under "
            "Public Services Guarantee Acts) are dispatched via SMS. Inactive or cyber cafe mobile numbers result "
            "in deemed rejection without citizen knowledge."
        ),
        "verification_instruction": "Ensure the SIM card currently in your phone is active and registered with UIDAI.",
        "prevention_step": "Test Aadhaar OTP receipt at uidai.gov.in. Update mobile at any Aadhaar Seva Kendra if changed."
    })

    # 3. Document Validity & Jurisdictional Freshness
    if needs_income:
        checkpoints.append({
            "id": "income_freshness",
            "dimension": "Document Freshness & Revenue Audit",
            "title": "Income Certificate Financial Year Validity (आय प्रमाण पत्र वैधता)",
            "mandatory": True,
            "risk_type": "HIGH",
            "departmental_trap": (
                "Most state revenue departments (e-District portals) cap Income Certificate validity at 6 months to 1 Financial Year. "
                "Applications submitted with certificates from a previous FY are automatically rejected at the Tehsildar/Revenue desk."
            ),
            "verification_instruction": "Verify that your Income Certificate was issued on or after April 1st of the current Financial Year.",
            "prevention_step": "Apply for a fresh e-District digital income certificate if your current certificate is over 6 months old."
        })

    if needs_caste:
        checkpoints.append({
            "id": "caste_digital",
            "dimension": "Digital Revenue Verification",
            "title": "Digital Barcode / QR Caste Certificate (डिजिटल जाति प्रमाण पत्र)",
            "mandatory": True,
            "risk_type": "MEDIUM",
            "departmental_trap": (
                "Legacy handwritten or manual caste slips without a 16-digit e-District application number or QR barcode "
                "cannot be verified via automated departmental API checks, leading to rejection during clerical scrutiny."
            ),
            "verification_instruction": "Ensure your caste certificate has an online verification QR/barcode searchable on your State e-District portal.",
            "prevention_step": "Get legacy paper certificates converted to digital e-certificates at your local CSC/e-Seva Kendra."
        })

    # 4. Land Records & Joint Ownership
    if is_farmer:
        checkpoints.append({
            "id": "land_digitization",
            "dimension": "Land Records & Joint Khata",
            "title": "Digitized RoR & Co-Owner NOC (डिजिटल भूलेख व सहमति पत्र)",
            "mandatory": True,
            "risk_type": "HIGH",
            "departmental_trap": (
                "In PM-KISAN and crop assistance schemes, applicant name must match the State Bhulekh/Bhoomi digitized Record of Rights (RoR). "
                "Joint ancestral land holdings without a registered family separation or co-sharer NOC lead to immediate suspension."
            ),
            "verification_instruction": "Verify your name in the online State Bhulekh portal and verify if the land record is sole or joint.",
            "prevention_step": "If holding is joint, obtain an executed NOC (No Objection Certificate) from all co-sharers before applying."
        })

        checkpoints.append({
            "id": "tax_exclusion",
            "dimension": "Statutory DBT Exclusion",
            "title": "Income Tax & Institutional Disqualification (आयकर दाता अपवर्जन)",
            "mandatory": True,
            "risk_type": "CRITICAL",
            "departmental_trap": (
                "Under DBT Mission and PM-KISAN Section 2.1, any household where a member has paid Income Tax in the "
                "preceding assessment year, or holds constitutional office, is disqualified via automated CBDT-PFMS PAN cross-matching."
            ),
            "verification_instruction": "Confirm no member of the immediate beneficiary household filed an Income Tax Return (ITR) in the last assessment year.",
            "prevention_step": "Do not submit application if disqualified by statutory tax exclusions, as departments initiate recovery proceedings."
        })

    # 5. Pension Duplicate Exclusion
    if is_pension:
        checkpoints.append({
            "id": "duplicate_pension",
            "dimension": "De-Duplication & Exclusivity",
            "title": "Single Pension Exclusivity Rule (एकल पेंशन नियम)",
            "mandatory": True,
            "risk_type": "CRITICAL",
            "departmental_trap": (
                "Under National Social Assistance Programme (NSAP) guidelines, receiving more than one social security "
                "pension (e.g. claiming both Widow Pension and Old Age Pension) triggers automated Aadhaar de-duplication flags and immediate cancellation."
            ),
            "verification_instruction": "Ensure applicant is not currently receiving another Central or State DBT social security pension.",
            "prevention_step": "Surrender existing lower-tier pension with District Social Welfare Officer before applying for higher benefits."
        })

    # 6. Channel & Biometric Authentication Window
    if needs_biometric:
        checkpoints.append({
            "id": "biometric_channel",
            "dimension": "Channel & Physical Authentication",
            "title": "Mandatory Biometric / Iris e-KYC Window (बायोमेट्रिक प्रमाणीकरण)",
            "mandatory": True,
            "risk_type": "HIGH",
            "departmental_trap": (
                "Many citizens believe online registration completes the workflow. In reality, schemes require mandatory "
                "in-person biometric/Iris authentication at a CSC or banking kiosk within 30 days. Uncompleted e-KYC leads to automatic purging."
            ),
            "verification_instruction": "Check whether scheme mandates physical CSC biometric authentication after digital registration.",
            "prevention_step": "Visit your nearest Common Service Centre (CSC) within 14 days of applying to complete biometric e-KYC."
        })

    return {
        "scheme_id": str(scheme.get("_id") or scheme.get("id")),
        "scheme_title": title,
        "category": category,
        "ministry": ministry,
        "is_dbt": is_dbt,
        "dbt_mechanism": "Aadhaar Payment Bridge (APBS) / PFMS" if is_dbt else "Direct Departmental Service / In-Kind",
        "audit_risk_level": "HIGH_SCRUTINY" if (is_dbt or is_farmer or is_pension) else "STANDARD",
        "checkpoints_count": len(checkpoints),
        "checkpoints": checkpoints,
        "self_verification_tools": [
            {
                "tool": "NPCI Bank Seeding Check",
                "method": "Dial *99*99*1# on phone or visit myaadhaar.uidai.gov.in",
                "purpose": "Verify Aadhaar is linked to active bank account on NPCI mapper"
            },
            {
                "tool": "Aadhaar Mobile Linkage",
                "method": "Visit uidai.gov.in > Verify Email/Mobile",
                "purpose": "Ensure OTPs and scrutiny notifications will be received"
            },
            {
                "tool": "State e-District Barcode Check",
                "method": "Visit state edistrict portal > Verify Certificate",
                "purpose": "Verify that caste/income certificates have valid digital records"
            }
        ]
    }


def find_scheme(scheme_id):
    """Retrieves scheme by integer id, _id string, or slug using the SQLite database layer."""
    if not scheme_id:
        return None
    return get_scheme_by_id(str(scheme_id))


# ══════════════════════════════════════════════════
#  CITIZEN PRE-FLIGHT AUDIT ENGINE
# ══════════════════════════════════════════════════
def run_pre_flight_audit(profile, scheme_id=None):
    """
    Executes a comprehensive, rules-based pre-flight audit of a citizen's application profile.
    Prevents rejection traps BEFORE the citizen submits to the departmental portal.
    """
    scheme = None
    if scheme_id:
        scheme = find_scheme(str(scheme_id))

    scheme_spec = analyze_scheme_last_mile(scheme) if scheme else None

    # Extracted citizen inputs
    aadhaar_name = profile.get("aadhaar_name", "").strip()
    bank_name = profile.get("bank_name", "").strip()
    npci_seeded = str(profile.get("npci_seeded", "unknown")).lower().strip()
    aadhaar_mobile_active = profile.get("aadhaar_mobile_active", True)
    family_tax_filer = profile.get("family_tax_filer", False)
    has_conflicting_pension = profile.get("has_conflicting_pension", False)
    income_cert_status = profile.get("income_cert_status", "valid_current_fy")
    caste_cert_status = profile.get("caste_cert_status", "digital_barcode")
    land_record_status = profile.get("land_record_status", "individual_digitized")
    channel_aware = profile.get("channel_aware", True)

    score = 100
    critical_failures = []
    warnings = []
    passed = []

    # 1. Name Similarity Check
    if aadhaar_name and bank_name:
        name_res = calculate_name_similarity(aadhaar_name, bank_name)
        if name_res["status"] == "FAIL":
            score -= 35
            critical_failures.append({
                "id": "name_mismatch",
                "title": "Severe Name Mismatch on Bank Passbook",
                "severity": "CRITICAL",
                "score": name_res["score"],
                "reason": name_res["message"],
                "remedy": name_res["action"]
            })
        elif name_res["status"] == "WARN":
            score -= 15
            warnings.append({
                "id": "name_discrepancy",
                "title": "Name Discrepancy on Passbook",
                "severity": "WARNING",
                "score": name_res["score"],
                "reason": name_res["message"],
                "remedy": name_res["action"]
            })
        else:
            passed.append({
                "id": "name_concordance",
                "title": "Identity & Banking Name Concordance",
                "message": f"Concordance score {name_res['score']}% satisfies PFMS automated validation."
            })
    elif aadhaar_name or bank_name:
        score -= 10
        warnings.append({
            "id": "partial_name_input",
            "title": "Bank Passbook Name Unverified",
            "severity": "WARNING",
            "reason": "Only one name was provided; unable to run automated CBS concordance test.",
            "remedy": "Provide both Aadhaar and Bank Passbook names to verify payment gateway clearance."
        })

    # 2. NPCI Seeding Check
    is_dbt_scheme = scheme_spec.get("is_dbt", True) if scheme_spec else True
    if is_dbt_scheme:
        if npci_seeded in ("no", "false", "unseeded"):
            score -= 35
            critical_failures.append({
                "id": "npci_not_seeded",
                "title": "Bank Account Not Seeded with NPCI Mapper",
                "severity": "CRITICAL",
                "reason": "Direct Benefit Transfer (DBT) mandates NPCI Aadhaar Payment Bridge (APB) mapping. Unseeded accounts cause 100% of payments to bounce.",
                "remedy": "Visit your bank branch with Aadhaar copy and submit DBT Annexure-I Mandate form. Or dial *99*99*1# to verify."
            })
        elif npci_seeded in ("unknown", "unsure", "not_sure"):
            score -= 15
            warnings.append({
                "id": "npci_unverified",
                "title": "NPCI Seeding Status Unconfirmed",
                "severity": "WARNING",
                "reason": "Account may not be mapped for DBT credits on the central NPCI switch.",
                "remedy": "Dial *99*99*1# on your phone or check Bank Seeding Status on myaadhaar.uidai.gov.in before applying."
            })
        else:
            passed.append({
                "id": "npci_verified",
                "title": "NPCI Aadhaar-Bank Seeding",
                "message": "Account mapped on NPCI mapper; eligible for automated DBT credit."
            })

    # 3. Mobile Number Deliverability Check
    if not aadhaar_mobile_active:
        score -= 30
        critical_failures.append({
            "id": "mobile_inactive",
            "title": "Aadhaar Mobile Number Disconnected / Inactive",
            "severity": "CRITICAL",
            "reason": "Departmental scrutiny alerts, e-KYC OTPs, and rejection rectifications require active Aadhaar mobile reception. Missing OTPs lead to deemed cancellation.",
            "remedy": "Update mobile number at the nearest Aadhaar Seva Kendra or post office before initiating application."
        })
    else:
        passed.append({
            "id": "mobile_active",
            "title": "Aadhaar Mobile Linkage",
            "message": "Mobile number is active for departmental SMS alerts and e-KYC OTP verifications."
        })

    # 4. Statutory Tax Payer Exclusions (PM-KISAN and DBT rules)
    is_farmer_scheme = scheme_spec.get("category") == "agriculture" if scheme_spec else False
    if family_tax_filer:
        if is_farmer_scheme or (scheme_spec and "kisan" in scheme_spec.get("scheme_title", "").lower()):
            score -= 40
            critical_failures.append({
                "id": "tax_exclusion_violation",
                "title": "Statutory Income Tax Payer Exclusion",
                "severity": "CRITICAL",
                "reason": "Under Section 2.1 of PM-KISAN and central welfare guidelines, households with an Income Tax filer in the last assessment year are strictly excluded. PAN-Aadhaar linkage triggers automatic departmental rejection.",
                "remedy": "Do not submit application. Welfare departments initiate recovery notices for tax filers."
            })
        else:
            score -= 15
            warnings.append({
                "id": "tax_filer_advisory",
                "title": "Income Tax Filer Scrutiny",
                "severity": "WARNING",
                "reason": "Filing ITR may disqualify your household from means-tested subsidy and BPL schemes.",
                "remedy": "Verify whether this specific scheme allows income tax filers before proceeding."
            })
    else:
        passed.append({
            "id": "tax_exclusion_clear",
            "title": "Statutory Tax Exclusion Check",
            "message": "No income tax disqualification detected for means-tested welfare."
        })

    # 5. Duplicate Pension Conflict
    is_pension_scheme = (scheme_spec and "pension" in scheme_spec.get("scheme_title", "").lower())
    if has_conflicting_pension:
        if is_pension_scheme:
            score -= 40
            critical_failures.append({
                "id": "pension_duplication_conflict",
                "title": "Dual Pension Prohibition Conflict",
                "severity": "CRITICAL",
                "reason": "National Social Assistance Programme (NSAP) rules prohibit claiming concurrent social security pensions. Automated Aadhaar de-duplication flags this as duplicate.",
                "remedy": "Surrender existing pension through the District Social Welfare Department before applying for a new pension scheme."
            })
        else:
            warnings.append({
                "id": "multiple_benefit_scrutiny",
                "title": "Active Pension Cross-Check",
                "severity": "WARNING",
                "reason": "Existing government benefits will be scrutinized during cross-departmental auditing.",
                "remedy": "Ensure this scheme allows multiple benefit convergence."
            })
    else:
        passed.append({
            "id": "duplicate_pension_clear",
            "title": "De-Duplication & Exclusivity",
            "message": "No conflicting social security pensions detected."
        })

    # 6. Document Freshness (Income Certificate)
    if income_cert_status == "older_than_1yr":
        score -= 25
        critical_failures.append({
            "id": "income_cert_expired",
            "title": "Income Certificate Expired (> 1 Financial Year)",
            "severity": "CRITICAL",
            "reason": "State revenue guidelines require Income Certificates to be issued in the current Financial Year (or within 6 months). Outdated certificates are rejected at clerical scrutiny.",
            "remedy": "Apply for a renewed digital income certificate on your State e-District portal immediately."
        })
    elif income_cert_status == "no_cert":
        score -= 20
        warnings.append({
            "id": "income_cert_missing",
            "title": "Income Certificate Not Yet Issued",
            "severity": "WARNING",
            "reason": "Schemes with income ceilings require a verified Tehsildar/Revenue Officer certificate.",
            "remedy": "Obtain an e-District income certificate before applying on the official portal."
        })
    else:
        passed.append({
            "id": "income_cert_valid",
            "title": "Income Certificate Freshness",
            "message": "Income certificate is valid for the current Financial Year."
        })

    # 7. Caste Certificate Barcode / Digital Verification
    if caste_cert_status == "old_manual_slip":
        score -= 15
        warnings.append({
            "id": "caste_cert_manual",
            "title": "Legacy Manual Paper Caste Certificate",
            "severity": "WARNING",
            "reason": "Older paper caste certificates lacking an online 16-digit application number or QR barcode fail automated portal verification.",
            "remedy": "Visit CSC or Tehsil to obtain a digitized e-District certificate with QR code verification."
        })
    elif caste_cert_status == "no_cert":
        warnings.append({
            "id": "caste_cert_missing",
            "title": "Caste Certificate Unverified",
            "severity": "WARNING",
            "reason": "Reserved category benefits require a digitally verifiable certificate.",
            "remedy": "Ensure digital certificate is ready if applying under reserved categories."
        })
    else:
        passed.append({
            "id": "caste_cert_digital",
            "title": "Digital Caste Verification",
            "message": "Certificate carries digital verification credentials for e-District validation."
        })

    # 8. Land Records & Joint Ownership
    if land_record_status == "joint_without_noc":
        score -= 25
        warnings.append({
            "id": "joint_land_without_noc",
            "title": "Joint Land Holding Lacks Co-Owner NOC",
            "severity": "WARNING",
            "reason": "Agriculture schemes require either individual digitized Khata or registered consent NOC from all joint co-sharers. Unpartitioned land leads to payment holds.",
            "remedy": "Prepare a notarized Co-Owner NOC or ensure land mutation (Dakhil-Kharij) is updated in State Bhulekh."
        })
    elif land_record_status == "manual_unregistered":
        score -= 30
        critical_failures.append({
            "id": "land_not_digitized",
            "title": "Land Records Not Digitized in State Bhulekh",
            "severity": "CRITICAL",
            "reason": "Schemes cross-check digitized State Land Records APIs. Un-digitized manual pattas fail automated verification.",
            "remedy": "Visit the Tehsil Land Records Office to digitize your Khata/Khasra on the State Bhulekh portal."
        })
    elif land_record_status in ("individual_digitized", "joint_with_noc"):
        passed.append({
            "id": "land_record_ready",
            "title": "Land Record Verification",
            "message": "Land ownership documentation meets departmental digitized audit standards."
        })

    # 9. Channel Biometric Awareness
    if not channel_aware:
        warnings.append({
            "id": "channel_unaware",
            "title": "Pending In-Person Biometric Requirement",
            "severity": "WARNING",
            "reason": "Applying online is only Step 1; physical biometric authentication at CSC/kiosk is mandatory within 30 days.",
            "remedy": "Mark calendar to complete Aadhaar biometric authentication at your local CSC after online submission."
        })

    # Clamp score
    final_score = max(5, min(100, score))

    # Readiness Category
    if final_score >= 85 and len(critical_failures) == 0:
        readiness_level = "READY_FOR_SUBMISSION"
        badge_text = "🟢 High Readiness (Ready to Apply)"
        badge_class = "badge-success"
        summary_text = "Your profile satisfies critical departmental validation rules. Very low risk of last-mile rejection."
    elif final_score >= 60 and len(critical_failures) == 0:
        readiness_level = "ACTION_REQUIRED"
        badge_text = "🟡 Action Required (Resolve Warnings)"
        badge_class = "badge-warning"
        summary_text = "Your profile has minor documentation discrepancies that could trigger departmental inquiries. Rectify highlighted warnings before submitting."
    else:
        readiness_level = "HIGH_REJECTION_RISK"
        badge_text = "🔴 High Risk of Departmental Rejection"
        badge_class = "badge-danger"
        summary_text = "Critical departmental validation traps detected! Submitting now will likely result in automated PFMS or scrutiny rejection."

    # Immediate prioritized remedies
    remedies = []
    for f in critical_failures:
        remedies.append(f"[URGENT] {f['title']}: {f['remedy']}")
    for w in warnings:
        remedies.append(f"[RECOMMENDED] {w['title']}: {w['remedy']}")

    # Formulate Printable Pre-Application Clearance Slip
    timestamp = datetime.utcnow().strftime("%d-%b-%Y %H:%M UTC")
    slip = {
        "audit_id": f"SN-AUDIT-{int(datetime.utcnow().timestamp())}",
        "timestamp": timestamp,
        "scheme_title": scheme_spec.get("scheme_title", "General Welfare Application") if scheme_spec else "General Welfare Application",
        "readiness_score": final_score,
        "readiness_level": readiness_level,
        "critical_issues_count": len(critical_failures),
        "warnings_count": len(warnings),
        "passed_checks_count": len(passed),
        "remedies": remedies,
        "notice": "Saral-Niti Pre-Flight Audit is an advisory diagnostic engine designed to prevent departmental rejection traps. It does not replace official government scrutiny."
    }

    return {
        "status": "ok",
        "readiness_score": final_score,
        "readiness_level": readiness_level,
        "badge_text": badge_text,
        "badge_class": badge_class,
        "summary": summary_text,
        "scheme": scheme_spec,
        "critical_failures": critical_failures,
        "warnings": warnings,
        "passed_checks": passed,
        "total_checks": len(critical_failures) + len(warnings) + len(passed),
        "remedies": remedies,
        "printable_slip": slip
    }


# ══════════════════════════════════════════════════
#  API ROUTES
# ══════════════════════════════════════════════════
@pre_audit_bp.route("/api/schemes/<scheme_id>/last-mile-audit", methods=["GET"])
def get_scheme_last_mile_audit(scheme_id):
    """
    GET /api/schemes/<scheme_id>/last-mile-audit
    Returns the scheme-specific departmental audit traps, failure modes,
    and pre-flight verification checkpoints.
    """
    try:
        scheme = find_scheme(str(scheme_id))
        if not scheme:
            return jsonify({"error": "Scheme not found"}), 404
        audit_spec = analyze_scheme_last_mile(scheme)
        return jsonify({
            "status": "ok",
            "audit_spec": audit_spec
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pre_audit_bp.route("/api/pre-audit", methods=["POST"])
def post_pre_audit():
    """
    POST /api/pre-audit
    Takes citizen's last-mile parameters and diagnoses potential failure modes.
    Returns readiness score, risk traps, and an actionable clearance slip.
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        scheme_id = data.get("scheme_id")
        result = run_pre_flight_audit(data, scheme_id=scheme_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
