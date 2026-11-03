#!/usr/bin/env python3
"""
backend/scripts/normalize_dataset.py
------------------------------------
ETL and Normalization Pipeline for Government Scheme Datasets.
Ingests raw CSV or JSON files (from Kaggle, GitHub, or data.gov.in),
cleans and normalizes records into the canonical Saral-Niti schema,
and writes or merges them safely into backend/data/schemes.json.
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
    "agriculture": ["farmer", "kisan", "crop", "agriculture", "fertilizer", "soil", "irrigation", "fpo"],
    "health": ["health", "hospital", "medical", "ayushman", "disease", "treatment", "medicine"],
    "education": ["student", "scholarship", "school", "college", "university", "fellowship", "education"],
    "housing": ["housing", "awas", "shelter", "home loan", "urban poor", "pradhan mantri awas"],
    "employment": ["employment", "job", "rozgar", "skill", "training", "entrepreneur", "startup", "msme"],
    "women": ["women", "girl", "maternity", "mahila", "beti", "mother", "shakti"],
    "financial": ["pension", "insurance", "bank", "credit", "loan", "subsidy", "financial aid"],
    "elderly": ["elderly", "senior citizen", "old age", "vridha", "pensioner"],
    "youth": ["youth", "yuva", "internship", "sports", "innovation"],
    "disability": ["disability", "divyang", "handicapped", "differently abled", "udid"]
}


def slugify(text):
    text = (text or "").lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[-\s]+", "-", text).strip("-")


def clean_html(raw_html):
    if not raw_html:
        return ""
    cleanr = re.compile(r'<.*?>')
    text = re.sub(cleanr, '', str(raw_html))
    return re.sub(r'\s+', ' ', text).strip()


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


def parse_eligibility_text(text):
    """Extract structured eligibility parameters from raw unstructured text"""
    text = (text or "").lower()
    min_age = None
    max_age = None
    income_limit = None
    gender = "all"
    caste = ["general", "obc", "sc", "st"]
    occupation = []

    # Age extraction
    age_range_match = re.search(r'(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\s*years?', text)
    if age_range_match:
        min_age = int(age_range_match.group(1))
        max_age = int(age_range_match.group(2))
    else:
        min_age_match = re.search(r'(?:above|at least|minimum)\s*(\d{1,2})\s*years?', text)
        if min_age_match:
            min_age = int(min_age_match.group(1))
        max_age_match = re.search(r'(?:below|up to|maximum)\s*(\d{1,2})\s*years?', text)
        if max_age_match:
            max_age = int(max_age_match.group(1))

    # Income extraction (e.g. ₹2,50,000, 2.5 lakh, 300000)
    income_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakh|crore)?', text)
    if income_match and "income" in text:
        val = float(income_match.group(1).replace(',', ''))
        multiplier = income_match.group(2)
        if multiplier == 'lakh':
            val *= 100000
        elif multiplier == 'crore':
            val *= 10000000
        if 5000 <= val <= 5000000:
            income_limit = int(val)

    # Gender
    if "women only" in text or "females only" in text or "girl" in text:
        gender = "female"

    # Caste
    if "sc/st" in text or "scheduled caste" in text:
        caste = ["sc", "st"]
    elif "obc" in text:
        caste = ["obc"]

    # Occupation
    if "farmer" in text or "kisan" in text:
        occupation.append("farmer")
    if "student" in text:
        occupation.append("student")
    if "artisan" in text or "weaver" in text:
        occupation.append("artisan")

    return {
        "min_age": min_age,
        "max_age": max_age,
        "gender": gender,
        "income_limit": income_limit,
        "caste": caste,
        "occupation": occupation,
        "state": "all"
    }


def normalize_record(raw):
    """Maps varied raw dictionary inputs into canonical Saral-Niti scheme schema"""
    title = clean_html(raw.get("title") or raw.get("scheme_name") or raw.get("Scheme Name") or "Untitled Scheme")
    slug = raw.get("slug") or slugify(title)
    description = clean_html(raw.get("description") or raw.get("brief_description") or raw.get("Details") or "")
    benefits = clean_html(raw.get("benefits") or raw.get("Benefits") or "Refer to official scheme portal for benefit details.")
    app_url = raw.get("application_url") or raw.get("scheme_url") or raw.get("URL") or "https://www.myscheme.gov.in"
    ministry = clean_html(raw.get("ministry") or raw.get("nodal_ministry") or raw.get("Ministry") or "Government of India")
    level = (raw.get("level") or raw.get("scheme_type") or "central").lower()
    if "state" in level:
        level = "state"
    else:
        level = "central"

    # Tags
    raw_tags = raw.get("tags") or raw.get("Tags") or []
    if isinstance(raw_tags, str):
        tags = [t.strip().lower() for t in raw_tags.split(",") if t.strip()]
    elif isinstance(raw_tags, list):
        tags = [str(t).strip().lower() for t in raw_tags if str(t).strip()]
    else:
        tags = []

    # Category
    category = infer_category(title, description, tags, raw.get("category") or raw.get("scheme_category") or "")

    # Eligibility
    raw_elig = raw.get("eligibility") or raw.get("Eligibility") or {}
    if isinstance(raw_elig, str):
        eligibility = parse_eligibility_text(raw_elig)
    elif isinstance(raw_elig, dict):
        eligibility = {
            "min_age": raw_elig.get("min_age"),
            "max_age": raw_elig.get("max_age"),
            "gender": raw_elig.get("gender", "all"),
            "income_limit": raw_elig.get("income_limit"),
            "caste": raw_elig.get("caste", ["general", "obc", "sc", "st"]),
            "occupation": raw_elig.get("occupation", []),
            "state": raw_elig.get("state", "all")
        }
    else:
        eligibility = parse_eligibility_text(description)

    # Documents required
    raw_docs = raw.get("documents_required") or raw.get("Documents Required")
    if isinstance(raw_docs, list):
        docs = [str(d).strip() for d in raw_docs if str(d).strip()]
    elif isinstance(raw_docs, str):
        docs = [d.strip() for d in re.split(r'[,;\n]', raw_docs) if d.strip()]
    else:
        docs = ["Aadhaar Card", "Bank Account Details", "Income/Identity Proof"]

    launched_year = raw.get("launched_year")
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
        is_active=raw.get("is_active", True),
        level=level,
        source=raw.get("source", "myscheme"),
        source_url=app_url,
        documents_required=docs,
        last_verified_at=raw.get("last_verified_at") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        disclaimer="Informational only — verify on the official portal before applying."
    )


def process_dataset(input_file, output_file, merge=True):
    print(f"Reading input dataset: {input_file}...")
    ext = os.path.splitext(input_file)[-1].lower()
    raw_records = []

    if ext == ".json":
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                raw_records = data
            elif isinstance(data, dict):
                raw_records = data.get("schemes") or data.get("data") or [data]
    elif ext in [".csv", ".tsv"]:
        delimiter = "\t" if ext == ".tsv" else ","
        with open(input_file, "r", encoding="utf-8") as f:
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
            # Update with newer verified data, keeping original id if present
            existing_id = existing_by_slug[slug].get("_id")
            if existing_id:
                norm["_id"] = existing_id
        existing_by_slug[slug] = norm
        normalized_count += 1

    final_list = list(existing_by_slug.values())
    print(f"Writing {len(final_list)} normalized schemes to {output_file}...")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)

    print("Normalization complete! Dataset is ready for database seeding.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalize scheme datasets into Saral-Niti schema")
    parser.add_argument("--input", required=True, help="Path to input raw CSV or JSON file")
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(__file__), '..', 'data', 'schemes.json'),
        help="Path to output schemes.json"
    )
    parser.add_argument("--no-merge", action="store_true", help="Overwrite instead of merging with existing schemes")

    args = parser.parse_args()
    process_dataset(args.input, args.output, merge=not args.no_merge)

