#!/usr/bin/env python3
"""
backend/scripts/normalize_dataset.py
------------------------------------
ETL and Normalization Pipeline for Government Scheme Datasets.
Ingests raw CSV or JSON files (from Kaggle, GitHub, or data.gov.in),
cleans and normalizes records into the canonical Saral-Niti schema,
and writes or merges them safely into data/schemes.json.
"""

import os
import sys
import re
import json
import csv
import argparse
from datetime import datetime, timezone

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from models.scheme import create_scheme

ALLOWED_CATEGORIES = [
    "agriculture", "health", "education", "housing", "employment",
    "women", "financial", "elderly", "youth", "disability"
]

CATEGORY_KEYWORDS = {
    "agriculture": ["farmer", "kisan", "crop", "agriculture", "fertilizer", "soil", "irrigation", "fpo", "horticulture", "dairy", "fisheries"],
    "health": ["health", "hospital", "medical", "ayushman", "disease", "treatment", "medicine", "wellness", "sanitation"],
    "education": ["student", "scholarship", "school", "college", "university", "fellowship", "education", "tuition", "hostel", "academic"],
    "housing": ["housing", "awas", "shelter", "home loan", "urban poor", "pradhan mantri awas", "slum"],
    "employment": ["employment", "job", "rozgar", "skill", "training", "entrepreneur", "startup", "msme", "subsidy scheme", "handloom", "weaver", "artisan", "vocation"],
    "women": ["women", "girl", "maternity", "mahila", "beti", "mother", "shakti", "widow", "kanya"],
    "financial": ["pension", "insurance", "bank", "credit", "loan", "subsidy", "financial aid", "bima", "dbt", "fund"],
    "elderly": ["elderly", "senior citizen", "old age", "vridha", "pensioner"],
    "youth": ["youth", "yuva", "internship", "sports", "innovation"],
    "disability": ["disability", "divyang", "handicapped", "differently abled", "udid", "prosthetic", "braille"]
}


def slugify(text):
    text = (text or "").lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[-\s]+", "-", text).strip("-")


def clean_text(raw):
    if not raw:
        return ""
    # Strip HTML tags
    text = re.sub(r'<.*?>', '', str(raw))
    # Replace unicode replacement characters, bullets, and excessive whitespace
    text = text.replace('\ufffd', '').replace('', '')
    text = re.sub(r'[\r\n\t]+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def infer_category(title, description, tags, raw_cat=""):
    raw_cat_lower = (raw_cat or "").lower()
    for cat in ALLOWED_CATEGORIES:
        if cat in raw_cat_lower:
            return cat

    blob = f"{title} {description} {' '.join(tags)}".lower()
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(kw in blob for kw in kws):
            return cat
    return "financial"


def parse_eligibility_text(text, level="central", state_name="all"):
    """Extract structured eligibility parameters from raw text"""
    text_lower = (text or "").lower()
    min_age = None
    max_age = None
    income_limit = None
    gender = "all"
    caste = ["general", "obc", "sc", "st"]
    occupation = []

    # Age extraction
    age_range_match = re.search(r'(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\s*years?', text_lower)
    if age_range_match:
        min_age = int(age_range_match.group(1))
        max_age = int(age_range_match.group(2))
    else:
        min_age_match = re.search(r'(?:above|at least|minimum)\s*(\d{1,2})\s*years?', text_lower)
        if min_age_match:
            min_age = int(min_age_match.group(1))
        max_age_match = re.search(r'(?:below|up to|maximum)\s*(\d{1,2})\s*years?', text_lower)
        if max_age_match:
            max_age = int(max_age_match.group(1))

    # Income extraction (e.g. ₹2,50,000, 2.5 lakh, 300000)
    income_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakh|crore)?', text_lower)
    if income_match and "income" in text_lower:
        val = float(income_match.group(1).replace(',', ''))
        multiplier = income_match.group(2)
        if multiplier == 'lakh':
            val *= 100000
        elif multiplier == 'crore':
            val *= 10000000
        if 5000 <= val <= 5000000:
            income_limit = int(val)

    # Gender
    if any(k in text_lower for k in ["women only", "females only", "girl child", "widow", "pregnant", "lactating"]):
        gender = "female"

    # Caste
    if "sc/st" in text_lower or "scheduled caste" in text_lower:
        caste = ["sc", "st"]
    elif "obc" in text_lower:
        caste = ["obc"]

    # Occupation / Role
    if any(k in text_lower for k in ["farmer", "kisan", "cultivator"]):
        occupation.append("farmer")
    if any(k in text_lower for k in ["student", "scholar", "enrolled in"]):
        occupation.append("student")
    if any(k in text_lower for k in ["artisan", "weaver", "craftsman"]):
        occupation.append("artisan")

    # State
    target_state = "all"
    if level == "state" and state_name and state_name.lower() != "all" and not state_name.lower().startswith("ministry"):
        target_state = state_name

    return {
        "min_age": min_age,
        "max_age": max_age,
        "gender": gender,
        "income_limit": income_limit,
        "caste": caste,
        "occupation": occupation,
        "state": target_state,
        "is_student": "student" in occupation,
        "is_differently_abled": any(k in text_lower for k in ["differently abled", "handicapped", "disability", "divyang"])
    }


def clean_documents_list(raw_docs):
    """Parses and sanitizes documents required string into a clean list"""
    if not raw_docs:
        return ["Aadhaar Card", "Bank Account Details", "Identity Proof"]

    if isinstance(raw_docs, list):
        items = raw_docs
    else:
        # Split on bullets, numbers, newlines, or semicolons
        raw_clean = re.sub(r'[\ufffd•▪-]', '\n', str(raw_docs))
        items = re.split(r'[\r\n;]+', raw_clean)

    cleaned = []
    for item in items:
        clean_item = clean_text(item)
        # Remove leading list markers like "1. ", "a. ", "- "
        clean_item = re.sub(r'^(?:[0-9]+[.)]|[a-zA-Z][.)]|[-*])\s*', '', clean_item)
        if len(clean_item) > 3 and len(clean_item) < 120 and clean_item.lower() not in ["none", "nil", "n/a"]:
            cleaned.append(clean_item)

    if not cleaned:
        return ["Aadhaar Card", "Bank Account Details"]
    return cleaned[:8]  # Keep top 8 concise documents


def normalize_record(raw):
    """Maps varied raw dictionary inputs into canonical Saral-Niti scheme schema"""
    # Clean BOM in keys
    clean_raw = {str(k).lstrip('\ufeff'): v for k, v in raw.items()}

    title = clean_text(
        clean_raw.get("title") or clean_raw.get("scheme_name") or clean_raw.get("Scheme Name") or "Untitled Scheme"
    )
    slug = clean_raw.get("slug") or clean_raw.get("Scheme Slug") or slugify(title)
    description = clean_text(
        clean_raw.get("description") or clean_raw.get("brief_description") or clean_raw.get("Description") or clean_raw.get("Details") or ""
    )
    benefits = clean_text(
        clean_raw.get("benefits") or clean_raw.get("Benefits") or "Refer to official scheme portal for complete benefit guidelines."
    )
    raw_url = (
        clean_raw.get("Official Link") or clean_raw.get("application_url") or clean_raw.get("scheme_url") or clean_raw.get("MyScheme URL") or "https://www.myscheme.gov.in"
    ).strip()
    if not raw_url.startswith(('http://', 'https://')):
        app_url = f"https://{raw_url}" if raw_url and '.' in raw_url else "https://www.myscheme.gov.in"
    else:
        app_url = raw_url

    source_url = clean_raw.get("MyScheme URL") or clean_raw.get("source_url") or app_url
    ministry = clean_text(
        clean_raw.get("State / UT / Ministry") or clean_raw.get("ministry") or clean_raw.get("nodal_ministry") or clean_raw.get("Ministry") or "Government of India"
    )

    level_raw = (clean_raw.get("level") or clean_raw.get("Level") or clean_raw.get("scheme_type") or "central").lower()
    level = "state" if "state" in level_raw else "central"

    # Tags
    raw_tags = clean_raw.get("tags") or clean_raw.get("Tags / Categories") or clean_raw.get("Tags") or []
    if isinstance(raw_tags, str):
        tags = [clean_text(t).lower() for t in re.split(r'[,;/]', raw_tags) if clean_text(t)]
    elif isinstance(raw_tags, list):
        tags = [clean_text(str(t)).lower() for t in raw_tags if clean_text(str(t))]
    else:
        tags = []

    # Category
    category = infer_category(
        title, description, tags, clean_raw.get("category") or clean_raw.get("Tags / Categories") or ""
    )

    # Eligibility
    raw_elig = clean_raw.get("eligibility") or clean_raw.get("Eligibility Criteria") or clean_raw.get("Eligibility (General)") or {}
    if isinstance(raw_elig, str):
        eligibility = parse_eligibility_text(raw_elig, level=level, state_name=ministry)
    elif isinstance(raw_elig, dict):
        eligibility = {
            "min_age": raw_elig.get("min_age"),
            "max_age": raw_elig.get("max_age"),
            "gender": raw_elig.get("gender", "all"),
            "income_limit": raw_elig.get("income_limit"),
            "caste": raw_elig.get("caste", ["general", "obc", "sc", "st"]),
            "occupation": raw_elig.get("occupation", []),
            "state": ministry if level == "state" else raw_elig.get("state", "all"),
            "is_student": raw_elig.get("is_student", False),
            "is_differently_abled": raw_elig.get("is_differently_abled", False)
        }
    else:
        eligibility = parse_eligibility_text(description, level=level, state_name=ministry)

    # Documents
    raw_docs = clean_raw.get("documents_required") or clean_raw.get("Documents Required")
    docs = clean_documents_list(raw_docs)

    launched_year = clean_raw.get("launched_year")
    try:
        launched_year = int(launched_year) if launched_year else None
    except (ValueError, TypeError):
        launched_year = None

    return create_scheme(
        title=title,
        slug=slug,
        description=description,
        category=category,
        tags=tags,
        eligibility=eligibility,
        benefits=benefits,
        application_url=app_url,
        ministry=ministry,
        launched_year=launched_year,
        is_active=clean_raw.get("is_active", True),
        level=level,
        source="myscheme",
        source_url=source_url,
        documents_required=docs,
        last_verified_at=clean_raw.get("last_verified_at") or "2026-03-01",
        disclaimer="Informational only — verify on the official portal before applying."
    )


def process_dataset(input_file, output_file, merge=True):
    print(f"Reading input dataset: {input_file}...")
    ext = os.path.splitext(input_file)[-1].lower()
    raw_records = []

    if ext == ".json":
        with open(input_file, "r", encoding="utf-8-sig", errors="ignore") as f:
            data = json.load(f)
            if isinstance(data, list):
                raw_records = data
            elif isinstance(data, dict):
                raw_records = data.get("schemes") or data.get("data") or [data]
    elif ext in [".csv", ".tsv"]:
        delimiter = "\t" if ext == ".tsv" else ","
        with open(input_file, "r", encoding="utf-8-sig", errors="ignore") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            raw_records = list(reader)
    else:
        raise ValueError(f"Unsupported file extension: {ext}. Expected .json or .csv")

    print(f"Loaded {len(raw_records)} raw records. Normalizing into canonical schema...")

    existing_by_slug = {}
    if merge and os.path.exists(output_file):
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                for item in existing_data:
                    existing_by_slug[item.get("slug")] = item
            print(f"Found {len(existing_by_slug)} existing schemes in destination.")
        except Exception as e:
            print(f"Warning: Could not read existing destination for merge: {e}")

    normalized_count = 0
    for raw in raw_records:
        norm = normalize_record(raw)
        # Convert created_at & updated_at to ISO string for clean JSON serialization
        if isinstance(norm.get("created_at"), datetime):
            norm["created_at"] = norm["created_at"].isoformat()
        if isinstance(norm.get("updated_at"), datetime):
            norm["updated_at"] = norm["updated_at"].isoformat()

        slug = norm["slug"]
        if slug in existing_by_slug:
            existing_id = existing_by_slug[slug].get("_id")
            if existing_id:
                norm["_id"] = existing_id
        existing_by_slug[slug] = norm
        normalized_count += 1

    final_list = list(existing_by_slug.values())
    print(f"Writing {len(final_list)} normalized schemes to {output_file}...")

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)

    print("Normalization complete! Dataset is ready for database seeding.")
    return len(final_list)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalize scheme datasets into Saral-Niti schema")
    parser.add_argument("--input", required=True, help="Path to input raw CSV or JSON file")
    cand_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'schemes.json'))
    parser.add_argument(
        "--output",
        default=cand_root,
        help="Path to output schemes.json"
    )
    parser.add_argument("--no-merge", action="store_true", help="Overwrite instead of merging with existing schemes")

    args = parser.parse_args()
    process_dataset(args.input, args.output, merge=not args.no_merge)
