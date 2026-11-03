from datetime import datetime, timezone

def create_scheme(
    title, slug, description, category,
    tags, eligibility, benefits,
    application_url, ministry,
    launched_year, is_active=True,
    level="central", source="myscheme",
    source_url=None, documents_required=None,
    last_verified_at=None,
    disclaimer="Informational only — verify on the official portal before applying."
):
    now = datetime.now(timezone.utc)
    return {
        "title": title,
        "slug": slug,
        "description": description,
        "category": category,
        "level": level or "central",
        "tags": tags if isinstance(tags, list) else [tags],
        "eligibility": {
            "min_age": eligibility.get("min_age") if eligibility else None,
            "max_age": eligibility.get("max_age") if eligibility else None,
            "gender": eligibility.get("gender", "all") if eligibility else "all",
            "income_limit": eligibility.get("income_limit") if eligibility else None,
            "caste": eligibility.get("caste", ["general", "obc", "sc", "st"]) if eligibility else ["general", "obc", "sc", "st"],
            "occupation": eligibility.get("occupation", []) if eligibility else [],
            "state": eligibility.get("state", "all") if eligibility else "all",
            "is_student": eligibility.get("is_student", False) if eligibility else False,
            "is_differently_abled": eligibility.get("is_differently_abled", False) if eligibility else False
        },
        "benefits": benefits,
        "application_url": application_url,
        "source": source or "myscheme",
        "source_url": source_url or application_url,
        "documents_required": documents_required if isinstance(documents_required, list) else (
            ["Aadhaar Card", "Bank Account Details"]
        ),
        "disclaimer": disclaimer,
        "last_verified_at": last_verified_at or now.strftime("%Y-%m-%d"),
        "ministry": ministry,
        "launched_year": launched_year,
        "is_active": is_active,
        "created_at": now,
        "updated_at": now
    }
