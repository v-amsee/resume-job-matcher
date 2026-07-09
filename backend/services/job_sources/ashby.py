"""Fetch and normalize job postings from a company's public Ashby Job
Postings API.

https://developers.ashbyhq.com/docs/public-job-posting-api -- public,
unauthenticated, per-company like Greenhouse/Lever, looped over
data/company_boards.json from sync_jobs.py.

The description field name isn't consistent across Ashby customers, so this
tries a short fallback chain instead of assuming one.
"""
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job, map_job_type

BASE_URL = "https://api.ashbyhq.com/posting-api/job-board/{token}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ResumeMatchSync/1.0)"}


def fetch_jobs(token: str, company_name: str, limit: int = 200) -> Iterator[Dict[str, Any]]:
    url = BASE_URL.format(token=token)
    response = httpx.get(url, timeout=30, headers=HEADERS)
    response.raise_for_status()
    data = response.json()

    for job in (data.get("jobs") or [])[:limit]:
        try:
            title = (job.get("title") or "").strip()
            raw_description = (
                job.get("descriptionPlain")
                or job.get("descriptionHtml")
                or job.get("description")
                or ""
            )
            description = strip_html(raw_description)

            if not is_valid_job(title, description):
                continue

            job_id = job.get("id")
            if not job_id:
                continue

            location = job.get("location") or ("Remote" if job.get("isRemote") else "Not specified")

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
                "job_type": map_job_type(job.get("employmentType")),
                "experience_level": infer_experience_level(title, description),
                "apply_url": job.get("jobUrl") or job.get("applyUrl"),
                "sponsorship": detect_sponsorship(description),
                "source": JobSource.ASHBY,
            }
        except Exception:
            continue
