"""Sync job postings from external job-board APIs into the jobs table.

Run it with:

    docker-compose exec backend python data/sync_jobs.py
    docker-compose exec backend python data/sync_jobs.py --sources remotive,remoteok
    docker-compose exec backend python data/sync_jobs.py --sources greenhouse,lever,ashby

Each source upserts independently, keyed on (source, external_id) -- safe to
rerun on a schedule, existing rows get refreshed instead of duplicated. Jobs
that disappear from a source's API get soft-delisted (is_active=False), not
deleted, so old Applications/SavedJobs don't break.

greenhouse/lever/ashby don't fit that model -- they're per-company APIs, no
"every job on the platform" endpoint. data/company_boards.json lists
{name, platform, token} entries, and every company on the same platform
shares one JobSource (all Greenhouse jobs are source=JobSource.GREENHOUSE).
That means the delisting step has to see every active company on a
platform before deciding what's stale, or it'd wipe out every other
company's jobs the moment you sync just one of them.
"""
import argparse
import json
import os
import sys
from datetime import datetime

# Allow running this file directly (`python data/sync_jobs.py`), where
# Python only puts this file's own directory (backend/data) on sys.path,
# not the backend/ root where database.py and models.py live.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, init_db  # noqa: E402
from models import Job, JobSource  # noqa: E402
from services.job_sources import (  # noqa: E402
    remotive, remoteok, arbeitnow, weworkremotely, workingnomads,
    greenhouse, lever, ashby, adzuna, reed, jooble,
)

COMPANY_BOARDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "company_boards.json")

COMPANY_BOARD_FETCHERS = {
    "greenhouse": greenhouse.fetch_jobs,
    "lever": lever.fetch_jobs,
    "ashby": ashby.fetch_jobs,
}


def _iter_company_boards(platform: str):
    """Yield jobs for every curated company on a given ATS platform. One
    company failing (bad token, network blip) just gets logged and skipped
    rather than taking down the whole platform's sync."""
    fetch_fn = COMPANY_BOARD_FETCHERS[platform]

    with open(COMPANY_BOARDS_PATH) as f:
        companies = json.load(f)

    for company in companies:
        if company.get("platform") != platform:
            continue
        try:
            yield from fetch_fn(company["token"], company["name"])
        except Exception as e:
            print(f"    ! {company['name']} ({platform}) failed: {e}")
            continue


SOURCES = {
    "remotive": (JobSource.REMOTIVE, remotive.fetch_jobs),
    "remoteok": (JobSource.REMOTEOK, remoteok.fetch_jobs),
    "arbeitnow": (JobSource.ARBEITNOW, arbeitnow.fetch_jobs),
    "weworkremotely": (JobSource.WEWORKREMOTELY, weworkremotely.fetch_jobs),
    "workingnomads": (JobSource.WORKINGNOMADS, workingnomads.fetch_jobs),
    "greenhouse": (JobSource.GREENHOUSE, lambda: _iter_company_boards("greenhouse")),
    "lever": (JobSource.LEVER, lambda: _iter_company_boards("lever")),
    "ashby": (JobSource.ASHBY, lambda: _iter_company_boards("ashby")),
    # each of these needs its own API key (ADZUNA_APP_ID/KEY, REED_API_KEY,
    # JOOBLE_API_KEY) -- without one, fetch_jobs() just yields nothing, so
    # leaving them here even unconfigured is harmless (0 created, 0 delisted)
    "adzuna": (JobSource.ADZUNA, adzuna.fetch_jobs),
    "reed": (JobSource.REED, reed.fetch_jobs),
    "jooble": (JobSource.JOOBLE, jooble.fetch_jobs),
}


def sync_source(db, source_name: str, source: JobSource, fetch_fn) -> None:
    seen_external_ids = set()
    created = 0
    updated = 0
    failed = False

    try:
        for job_data in fetch_fn():
            external_id = job_data.get("external_id")
            if not external_id:
                continue
            seen_external_ids.add(external_id)

            existing = db.query(Job).filter(
                Job.source == source, Job.external_id == external_id
            ).first()

            fields = {k: v for k, v in job_data.items() if k not in ("external_id", "source")}

            if existing:
                for field, value in fields.items():
                    setattr(existing, field, value)
                existing.is_active = True
                existing.updated_at = datetime.utcnow()
                updated += 1
            else:
                db.add(Job(employer_id=None, source=source, external_id=external_id, **fields))
                created += 1
    except Exception as e:
        print(f"  ! {source_name} sync failed partway through: {e}")
        failed = True

    db.commit()

    delisted = 0
    if not failed:
        # only delist on a clean run -- a partial failure isn't proof everything else closed
        query = db.query(Job).filter(Job.source == source, Job.is_active == True)
        if seen_external_ids:
            query = query.filter(~Job.external_id.in_(seen_external_ids))
        stale = query.all()
        for job in stale:
            job.is_active = False
        delisted = len(stale)
        db.commit()

    print(f"  {source_name}: {created} created, {updated} updated, {delisted} delisted")


def sync(source_names) -> None:
    init_db()
    db = SessionLocal()
    try:
        print("Syncing external job sources...")
        for name in source_names:
            entry = SOURCES.get(name)
            if not entry:
                print(f"  ! unknown source '{name}' (known: {', '.join(SOURCES)}), skipping")
                continue
            source, fetch_fn = entry
            sync_source(db, name, source, fetch_fn)
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync jobs from external sources")
    parser.add_argument(
        "--sources",
        default=",".join(SOURCES.keys()),
        help=f"Comma-separated list of sources to sync (default: all -- {', '.join(SOURCES.keys())})"
    )
    args = parser.parse_args()
    sync([s.strip() for s in args.sources.split(",") if s.strip()])
