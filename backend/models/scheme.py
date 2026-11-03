from datetime import datetime, timezone

def create_scheme(
    title, slug, description, category,
    tags, eligibility, benefits,
    application_url, ministry,
    launched_year, is_active=True
):
    now = datetime.now(timezone.utc)
    return {
        "title": title,
        "slug": slug,
        "description": description,
        "category": category,
        "tags": tags if isinstance(tags, list) else [tags],
        "eligibility": {
            "min_age": eligibility.get("min_age") if eligibility else None,
            "max_age": eligibility.get("max_age") if eligibility else None,
            "gender": eligibility.get("gender", "all") if eligibility else "all",
            "income_limit": eligibility.get("income_limit") if eligibility else None,
            "caste": eligibility.get("caste", ["general", "obc", "sc", "st"]) if eligibility else ["general", "obc", "sc", "st"],
            "occupation": eligibility.get("occupation", []) if eligibility else [],
            "state": eligibility.get("state", "all") if eligibility else "all"
        },
        "benefits": benefits,
        "application_url": application_url,
        "ministry": ministry,
        "launched_year": launched_year,
        "is_active": is_active,
        "created_at": now,
        "updated_at": now
    }
