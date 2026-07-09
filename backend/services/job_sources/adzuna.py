"""Fetch and normalize job postings from the Adzuna Search API.

https://developer.adzuna.com/ -- needs a free app_id + app_key (env vars
ADZUNA_APP_ID / ADZUNA_APP_KEY, sign up at developer.adzuna.com/signup).
Split per-country with no "everything" endpoint, so this loops a handful of
countries x search terms and dedupes on (country, job id). No keys set ->
fetch_jobs just yields nothing, doesn't error.
"""
import os
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job, clean_location

APP_ID = os.getenv("ADZUNA_APP_ID")
APP_KEY = os.getenv("ADZUNA_APP_KEY")

BASE_URL = "https://api.adzuna.com/v1/api/jobs/{country}/search/1"

# subset of Adzuna's supported country codes (full list at
# developer.adzuna.com/docs/countries) -- kept short for sync time and free-tier call volume
COUNTRIES = ["us", "gb", "ca", "in", "au"]

SEARCH_TERMS = [
    "software engineer",
    "data scientist",
    "product manager",
    "devops engineer",
    "machine learning engineer",
]

RESULTS_PER_PAGE = 25


def _fetch_one(country: str, term: str) -> Iterator[Dict[str, Any]]:
    url = BASE_URL.format(country=country)
    params = {
        "app_id": APP_ID,
        "app_key": APP_KEY,
        "results_per_page": RESULTS_PER_PAGE,
        "what": term,
        "content-type": "application/json",
    }
    response = httpx.get(url, timeout=30, params=params)
    response.raise_for_status()
    data = response.json()

    for job in data.get("results", []):
        title = (job.get("title") or "").strip()
        # Adzuna only returns a cropped snippet of the description, not the
        # full text -- still enough for is_valid_job's quality gate and for
        # skill extraction to find real matches.
        description = strip_html(job.get("description") or "")

        if not is_valid_job(title, description):
            continue

        job_id = job.get("id")
        if not job_id:
            continue

        location_obj = job.get("location") or {}
        location = location_obj.get("display_name") if isinstance(location_obj, dict) else None

        job_type = "Contract" if job.get("contract_type") == "contract" else (
            "Part-time" if job.get("contract_time") == "part_time" else "Full-time"
        )

        yield {
            # Prefixed with country since Adzuna job ids aren't guaranteed
            # unique across its per-country indexes.
            "external_id": f"{country}-{job_id}",
            "title": title,
            "company": ((job.get("company") or {}).get("display_name") or "").strip(),
            "description": description,
            "required_skills": extract_required_skills(description),
            "nice_to_have_skills": [],
            "salary_min": job.get("salary_min"),
            "salary_max": job.get("salary_max"),
            "location": clean_location(location),
            "job_type": job_type,
            "experience_level": infer_experience_level(title, description),
            "apply_url": job.get("redirect_url"),
            "sponsorship": detect_sponsorship(description),
            "source": JobSource.ADZUNA,
        }


def fetch_jobs(limit: int = 200) -> Iterator[Dict[str, Any]]:
    if not APP_ID or not APP_KEY:
        return

    seen = set()
    count = 0
    for country in COUNTRIES:
        for term in SEARCH_TERMS:
            try:
                for job in _fetch_one(country, term):
                    if job["external_id"] in seen:
                        continue
                    seen.add(job["external_id"])
                    yield job
                    count += 1
                    if count >= limit:
                        return
            except Exception as e:
                print(f"    ! adzuna {country}/{term} failed: {e}")
                continue
