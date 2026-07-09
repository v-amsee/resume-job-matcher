"""Fetch and normalize job postings from the Working Nomads public feed.

https://www.workingnomads.co/api/exposed_jobs/ -- no key needed. Each entry
is flat JSON (url/title/description/company_name/category_name/tags/
location/pub_date), tags is a comma-separated string not an array. No
numeric id field, so external_id comes from the job's own url path instead.
Everything here is remote by nature -- `location` is more of a timezone
constraint ("US business hours") than an actual place.
"""
import re
import httpx
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job, clean_location

API_URL = "https://www.workingnomads.co/api/exposed_jobs/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ResumeMatchSync/1.0)"}
_ID_RE = re.compile(r'/(\d+)/?$')


def fetch_jobs(limit: int = 200) -> Iterator[Dict[str, Any]]:
    response = httpx.get(API_URL, timeout=30, headers=HEADERS)
    response.raise_for_status()
    response.encoding = "utf-8"
    data = response.json()

    for job in data[:limit]:
        if not isinstance(job, dict):
            continue

        title = (job.get("title") or "").strip()
        description = strip_html(job.get("description", ""))

        if not is_valid_job(title, description):
            continue

        url = job.get("url") or ""
        id_match = _ID_RE.search(url)
        external_id = id_match.group(1) if id_match else url
        if not external_id:
            continue

        tags = [t.strip() for t in (job.get("tags") or "").split(",") if t.strip()]

        yield {
            "external_id": external_id,
            "title": title,
            "company": (job.get("company_name") or "").strip() or "Unknown",
            "description": description,
            "required_skills": extract_required_skills(description, tags=tags),
            "nice_to_have_skills": [],
            "salary_min": None,
            "salary_max": None,
            "location": clean_location(job.get("location")),
            "job_type": "Full-time",
            "experience_level": infer_experience_level(title, description),
            "apply_url": url,
            "sponsorship": detect_sponsorship(description),
            "source": JobSource.WORKINGNOMADS,
        }
