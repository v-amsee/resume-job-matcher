"""Fetch and normalize job postings from the Jooble REST API.

https://jooble.org/api/about -- needs a free API key (env var
JOOBLE_API_KEY). POST-based, requires both keywords and a location per
call, so this loops a handful of keywords x locations. No key -> yields
nothing.

Jooble only gives a short snippet, not a full description, so some
postings will fail is_valid_job's length check and get skipped -- expected,
same quality gate as every other source.
"""
import os
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job, clean_location, map_job_type

API_KEY = os.getenv("JOOBLE_API_KEY")
BASE_URL = "https://jooble.org/api/{key}"

SEARCH_TERMS = [
    "software engineer",
    "data scientist",
    "product manager",
    "devops engineer",
    "machine learning engineer",
]

LOCATIONS = ["United States", "United Kingdom", "Remote"]

RESULTS_ON_PAGE = "20"


def _fetch_one(term: str, location: str) -> Iterator[Dict[str, Any]]:
    url = BASE_URL.format(key=API_KEY)
    body = {"keywords": term, "location": location, "ResultOnPage": RESULTS_ON_PAGE}
    response = httpx.post(url, timeout=30, json=body)
    response.raise_for_status()
    data = response.json()

    for job in data.get("jobs", []):
        title = (job.get("title") or "").strip()
        description = strip_html(job.get("snippet") or "")

        if not is_valid_job(title, description):
            continue

        job_id = job.get("id")
        if not job_id:
            continue

        yield {
            "external_id": str(job_id),
            "title": title,
            "company": (job.get("company") or "").strip(),
            "description": description,
            "required_skills": extract_required_skills(description),
            "nice_to_have_skills": [],
            "salary_min": None,
            "salary_max": None,
            "location": clean_location(job.get("location")),
            "job_type": map_job_type(job.get("type")),
            "experience_level": infer_experience_level(title, description),
            "apply_url": job.get("link"),
            "sponsorship": detect_sponsorship(description),
            "source": JobSource.JOOBLE,
        }


def fetch_jobs(limit: int = 200) -> Iterator[Dict[str, Any]]:
    if not API_KEY:
        return

    seen = set()
    count = 0
    for term in SEARCH_TERMS:
        for location in LOCATIONS:
            try:
                for job in _fetch_one(term, location):
                    if job["external_id"] in seen:
                        continue
                    seen.add(job["external_id"])
                    yield job
                    count += 1
                    if count >= limit:
                        return
            except Exception as e:
                print(f"    ! jooble {term}/{location} failed: {e}")
                continue
