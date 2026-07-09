"""Fetch and normalize job postings from a company's public Greenhouse Job
Board API.

https://developers.greenhouse.io/job-board.html -- public, no auth, just
the company's board token (the slug in their careers url, e.g.
boards.greenhouse.io/stripe -> "stripe").

No global search across companies, so sync_jobs.py loops over the curated
list in data/company_boards.json and calls this once per company.
"""
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job

BASE_URL = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ResumeMatchSync/1.0)"}


def fetch_jobs(token: str, company_name: str, limit: int = 200) -> Iterator[Dict[str, Any]]:
    url = BASE_URL.format(token=token)
    # content=true is required to get the actual job description back --
    # without it the list endpoint only returns title/location/id.
    response = httpx.get(url, params={"content": "true"}, timeout=30, headers=HEADERS)
    response.raise_for_status()
    data = response.json()

    for job in (data.get("jobs") or [])[:limit]:
        try:
            title = (job.get("title") or "").strip()
            description = strip_html(job.get("content", ""))

            if not is_valid_job(title, description):
                continue

            job_id = job.get("id")
            if not job_id:
                continue

            location = (job.get("location") or {}).get("name") or "Not specified"

            yield {
                "external_id": str(job_id),
                "title": title,
                "company": company_name,
                "description": description,
                "required_skills": extract_required_skills(description),
                "nice_to_have_skills": [],
                "salary_min": None,
                "salary_max": None,
                "location": location,
                "job_type": "Full-time",
                "experience_level": infer_experience_level(title, description),
                "apply_url": job.get("absolute_url"),
                "sponsorship": detect_sponsorship(description),
                "source": JobSource.GREENHOUSE,
            }
        except Exception:
            # One malformed posting from one company shouldn't take down
            # the rest of that company's sync.
            continue
