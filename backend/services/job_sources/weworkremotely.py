"""Fetch and normalize job postings from We Work Remotely's public RSS feed.

https://weworkremotely.com/remote-jobs.rss -- no key needed, just
attribution (the "via We Work Remotely" tag on job cards covers that).

Written defensively (per-item try/except, skip anything malformed) since
RSS feeds drift over time -- a bad item just means fewer jobs synced, not
a crashed sync.
"""
import httpx
import xml.etree.ElementTree as ET
from typing import Iterator, Dict, Any

from models import JobSource
from services.job_enrichment import extract_required_skills, infer_experience_level, detect_sponsorship
from services.job_sources.util import strip_html, is_valid_job

API_URL = "https://weworkremotely.com/remote-jobs.rss"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ResumeMatchSync/1.0)"}


def _split_title(raw_title: str):
    """WWR RSS titles are conventionally "Company Name: Job Title". Falls
    back to treating the whole string as the title if that pattern isn't
    there, rather than dropping the listing."""
    if ":" in raw_title:
        company, _, title = raw_title.partition(":")
        return company.strip(), title.strip()
    return "", raw_title.strip()


def fetch_jobs(limit: int = 200) -> Iterator[Dict[str, Any]]:
    response = httpx.get(API_URL, timeout=30, headers=HEADERS, follow_redirects=True)
    response.raise_for_status()
    response.encoding = "utf-8"

    try:
        root = ET.fromstring(response.text)
    except ET.ParseError:
        return

    for item in root.findall(".//item")[:limit]:
        try:
            raw_title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            if not raw_title or not link:
                continue

            company, title = _split_title(raw_title)
            description = strip_html(item.findtext("description") or "")

            if not is_valid_job(title, description):
                continue

            yield {
                "external_id": link,
                "title": title,
                "company": company or "Unknown",
                "description": description,
                "required_skills": extract_required_skills(description),
                "nice_to_have_skills": [],
                "salary_min": None,
                "salary_max": None,
                "location": "Remote",
                "job_type": "Full-time",
                "experience_level": infer_experience_level(title, description),
                "apply_url": link,
                "sponsorship": detect_sponsorship(description),
                "source": JobSource.WEWORKREMOTELY,
            }
        except Exception:
            # One malformed <item> shouldn't take down the rest of the feed.
            continue
