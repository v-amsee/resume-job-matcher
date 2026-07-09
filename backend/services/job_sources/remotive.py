"""Fetch and normalize job postings from the Remotive public API.

https://remotive.com/api/remote-jobs -- no API key required. Remotive asks
that this not be called more than twice a minute, so this is meant to be
run as an occasional sync job, not on every request.
"""
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, map_job_type, parse_salary_range, is_valid_job

API_URL = "https://remotive.com/api/remote-jobs"


def fetch_jobs(limit: int = 200) -> Iterator[Dict[str, Any]]:
    response = httpx.get(API_URL, timeout=30, params={"limit": limit})
    response.raise_for_status()
    data = response.json()

    for job in data.get("jobs", []):
        description = strip_html(job.get("description", ""))
        salary_min, salary_max = parse_salary_range(job.get("salary", ""))
        title = job.get("title", "").strip()

        if not is_valid_job(title, description):
            continue

        yield {
            "external_id": str(job["id"]),
            "title": title,
            "company": job.get("company_name", "").strip(),
            "description": description,
            "required_skills": extract_required_skills(description, tags=job.get("tags")),
            "nice_to_have_skills": [],
            "salary_min": salary_min,
            "salary_max": salary_max,
            "location": job.get("candidate_required_location") or "Remote",
            "job_type": map_job_type(job.get("job_type", "")),
            "experience_level": infer_experience_level(title, description),
            "apply_url": job.get("url"),
            "sponsorship": detect_sponsorship(description),
            "source": JobSource.REMOTIVE,
        }
