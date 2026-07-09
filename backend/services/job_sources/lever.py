"""Fetch and normalize job postings from a company's public Lever Postings
API.

https://github.com/lever/postings-api -- public, unauthenticated, one
endpoint per company at api.lever.co/v0/postings/{company}. Same deal as
Greenhouse: no global search, sync_jobs.py loops over
data/company_boards.json instead.
"""
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job, map_job_type

BASE_URL = "https://api.lever.co/v0/postings/{token}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ResumeMatchSync/1.0)"}


def fetch_jobs(token: str, company_name: str, limit: int = 200) -> Iterator[Dict[str, Any]]:
    url = BASE_URL.format(token=token)
    response = httpx.get(url, params={"mode": "json"}, timeout=30, headers=HEADERS)
    response.raise_for_status()
    data = response.json()

    if not isinstance(data, list):
        return

    for job in data[:limit]:
        try:
            title = (job.get("text") or "").strip()
            # descriptionPlain is already plain text when present; fall
            # back to stripping the HTML description otherwise.
            description = job.get("descriptionPlain") or strip_html(job.get("description", ""))

            if not is_valid_job(title, description):
                continue

            job_id = job.get("id")
            if not job_id:
                continue

            categories = job.get("categories") or {}

            yield {
                "external_id": str(job_id),
                "title": title,
                "company": company_name,
                "description": description,
                "required_skills": extract_required_skills(description),
                "nice_to_have_skills": [],
                "salary_min": None,
                "salary_max": None,
                "location": categories.get("location") or "Not specified",
                "job_type": map_job_type(categories.get("commitment")),
                "experience_level": infer_experience_level(title, description),
                "apply_url": job.get("hostedUrl") or job.get("applyUrl"),
                "sponsorship": detect_sponsorship(description),
                "source": JobSource.LEVER,
            }
        except Exception:
            continue
