"""Fetch and normalize job postings from the Arbeitnow public API.

https://www.arbeitnow.com/api/job-board-api -- no API key required.
Europe/Germany-focused with a mix of remote and English-language listings.
Paginated via a `links.next` URL in the response.
"""
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, map_job_type, is_valid_job

API_URL = "https://www.arbeitnow.com/api/job-board-api"


def fetch_jobs(max_pages: int = 3) -> Iterator[Dict[str, Any]]:
    url = API_URL
    pages_fetched = 0

    while url and pages_fetched < max_pages:
        response = httpx.get(url, timeout=30)
        response.raise_for_status()
        payload = response.json()
        pages_fetched += 1

        for job in payload.get("data", []):
            description = strip_html(job.get("description", ""))
            title = job.get("title", "").strip()
            job_types = job.get("job_types") or []
            job_type = map_job_type(job_types[0]) if job_types else "Full-time"

            if not is_valid_job(title, description):
                continue

            yield {
                "external_id": job.get("slug"),
                "title": title,
                "company": job.get("company_name", "").strip(),
                "description": description,
                "required_skills": extract_required_skills(description, tags=job.get("tags")),
                "nice_to_have_skills": [],
                "salary_min": None,
                "salary_max": None,
                "location": "Remote" if job.get("remote") else (job.get("location") or "Not specified"),
                "job_type": job_type,
                "experience_level": infer_experience_level(title, description),
                "apply_url": job.get("url"),
                "sponsorship": detect_sponsorship(description),
                "source": JobSource.ARBEITNOW,
            }

        url = (payload.get("links") or {}).get("next") or None
