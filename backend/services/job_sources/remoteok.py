"""Fetch and normalize job postings from the RemoteOK public API.

https://remoteok.com/api -- no key needed, but it wants a browser-like
User-Agent or it blocks the request. First element of the response array is
always a legal/rate-limit notice, not a job.
"""
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job, clean_location

API_URL = "https://remoteok.com/api"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ResumeMatchSync/1.0)"}


def fetch_jobs(limit: int = 200) -> Iterator[Dict[str, Any]]:
    response = httpx.get(API_URL, timeout=30, headers=HEADERS)
    response.raise_for_status()
    # remoteok doesn't always send a charset header, and httpx's guess can
    # mangle non-English listings ("Niños" -> "NiÃ±os"). JSON is UTF-8 by spec anyway.
    response.encoding = "utf-8"
    data = response.json()

    for job in data[1:limit + 1]:
        if not isinstance(job, dict) or "id" not in job:
            continue

        description = strip_html(job.get("description", ""))
        tags = job.get("tags") or []
        title = job.get("position", "").strip()

        if not is_valid_job(title, description):
            continue

        salary_min = job.get("salary_min") or None
        salary_max = job.get("salary_max") or None

        yield {
            "external_id": str(job["id"]),
            "title": title,
            "company": job.get("company", "").strip(),
            "description": description,
            "required_skills": extract_required_skills(description, tags=tags),
            "nice_to_have_skills": [],
            "salary_min": float(salary_min) if salary_min else None,
            "salary_max": float(salary_max) if salary_max else None,
            "location": clean_location(job.get("location")),
            "job_type": "Full-time",
            "experience_level": infer_experience_level(title, description),
            "apply_url": job.get("apply_url") or job.get("url"),
            "sponsorship": detect_sponsorship(description),
            "source": JobSource.REMOTEOK,
        }
