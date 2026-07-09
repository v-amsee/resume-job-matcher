"""Fetch and normalize job postings from the Reed API.

https://www.reed.co.uk/developers/Jobseeker -- needs a free API key (env
var REED_API_KEY), sent as the username in HTTP Basic auth with an empty
password -- that's Reed's documented scheme, not a workaround. UK-only, no
category filter on this endpoint, so it loops over a handful of tech
keywords. No key set -> yields nothing.

No job-type/full-time flag in the response, so job_type just stays at the
Full-time default rather than being guessed.
"""
import os
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job, clean_location

API_KEY = os.getenv("REED_API_KEY")
SEARCH_URL = "https://www.reed.co.uk/api/1.0/search"

SEARCH_TERMS = [
    "software engineer",
    "data scientist",
    "product manager",
    "devops engineer",
    "machine learning engineer",
]

RESULTS_TO_TAKE = 50


def _fetch_one(term: str) -> Iterator[Dict[str, Any]]:
    params = {"keywords": term, "resultsToTake": RESULTS_TO_TAKE}
    response = httpx.get(SEARCH_URL, timeout=30, params=params, auth=(API_KEY, ""))
    response.raise_for_status()
    data = response.json()

    for job in data.get("results", []):
        title = (job.get("jobTitle") or "").strip()
        description = strip_html(job.get("jobDescription") or "")

        if not is_valid_job(title, description):
            continue

        job_id = job.get("jobId")
        if not job_id:
            continue

        yield {
            "external_id": str(job_id),
            "title": title,
            "company": (job.get("employerName") or "").strip(),
            "description": description,
            "required_skills": extract_required_skills(description),
            "nice_to_have_skills": [],
            "salary_min": job.get("minimumSalary"),
            "salary_max": job.get("maximumSalary"),
            "location": clean_location(job.get("locationName")),
            "job_type": "Full-time",
            "experience_level": infer_experience_level(title, description),
            "apply_url": job.get("jobUrl"),
            "sponsorship": detect_sponsorship(description),
            "source": JobSource.REED,
        }


def fetch_jobs(limit: int = 200) -> Iterator[Dict[str, Any]]:
    if not API_KEY:
        return

    seen = set()
    count = 0
    for term in SEARCH_TERMS:
        try:
            for job in _fetch_one(term):
                if job["external_id"] in seen:
                    continue
                seen.add(job["external_id"])
                yield job
                count += 1
                if count >= limit:
                    return
        except Exception as e:
            print(f"    ! reed {term} failed: {e}")
            continue
