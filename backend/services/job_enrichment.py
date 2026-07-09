"""Turns a raw job-source payload into the fields the Job model and matcher
need: skills, an experience level bucket, and a sponsorship read.

None of the source APIs give us this structure directly -- Greenhouse/Reed
just give prose, RemoteOK/Arbeitnow give a partial tags list. Uses the same
boundary-aware keyword matching as the resume extractor (nlp_extractor.py)
so "react" inside some unrelated word doesn't count as a match.
"""
from typing import List, Optional
import re

from models import SponsorshipStatus
from services.nlp_extractor import extractor, NLPExtractor


def extract_required_skills(text: str, tags: Optional[List[str]] = None, limit: int = 12) -> List[str]:
    """Skills found in a job description, optionally seeded with
    source-provided tags.

    Tags aren't trusted verbatim -- some feeds (RemoteOK especially) tag
    low-quality bulk listings with generic buzzwords that have nothing to do
    with the posting, apparently to game visibility. A tag only counts if
    it's also in our own skill vocabulary. The description scan below is
    the real signal; tags are just a bonus.
    """
    text_lower = text.lower()
    found = set()

    if tags:
        for tag in tags:
            tag_clean = tag.strip().lower()
            if tag_clean and tag_clean in extractor.all_skills:
                found.add(tag_clean)

    for skill in extractor.all_skills:
        if NLPExtractor._contains_token(text_lower, skill):
            found.add(skill)

    return sorted(found)[:limit]


_SENIOR_TITLE_RE = re.compile(r'\b(senior|sr\.?|staff|principal|lead|head of|director)\b', re.IGNORECASE)
_JUNIOR_TITLE_RE = re.compile(r'\b(junior|jr\.?|entry.level|graduate|intern(?:ship)?|associate)\b', re.IGNORECASE)
_YEARS_RE = re.compile(r'(\d+)\+?\s*years?')


def infer_experience_level(title: str, description: str = "") -> str:
    """Heuristic experience-level bucket from the title (primary signal)
    and description (fallback), matching the junior/mid/senior vocabulary
    the matching algorithm already expects.
    """
    if _SENIOR_TITLE_RE.search(title or ""):
        return "senior"
    if _JUNIOR_TITLE_RE.search(title or ""):
        return "junior"

    # Titles are usually enough, but a lot of senior postings say "5+
    # years" in the body without ever putting "senior" in the title.
    excerpt = (description or "")[:600].lower()
    years_match = _YEARS_RE.search(excerpt)
    if years_match:
        years = int(years_match.group(1))
        if years >= 6:
            return "senior"
        if years <= 2:
            return "junior"

    return "mid"


# Covers both US phrasing (H-1B, "authorized to work") and UK phrasing
# ("right to work", "skilled worker visa"), since this app is UK-focused
# for now but expects US listings (via Adzuna) later.
_UNLIKELY_RE = re.compile(
    r'unable to (?:provide |offer )?sponsor|cannot sponsor|does not sponsor|'
    r'no (?:visa )?sponsorship|without sponsorship|not (?:able|eligible) to (?:provide |offer )?sponsor|'
    r'must have (?:the )?right to work|must be authorized to work|'
    r'must be eligible to work|no longer sponsor(?:s|ing)?|'
    r'requires? current work authorization|must be a (?:u\.?s\.?|uk) citizen',
    re.IGNORECASE
)
_MAY_SPONSOR_RE = re.compile(
    r'may (?:consider|provide|offer) sponsorship|sponsorship (?:considered|possible|'
    r'may be available)|case.by.case (?:basis )?(?:for )?sponsorship|'
    r'sponsorship .{0,20}exceptional candidates|open to discussing sponsorship',
    re.IGNORECASE
)
_SPONSORS_RE = re.compile(
    r'visa sponsorship (?:is )?available|will sponsor|we sponsor|can sponsor|'
    r'able to sponsor|sponsor(?:s|ing)? (?:a |an )?(?:work )?visa|'
    r'h-?1b sponsorship|provide (?:visa )?sponsorship|open to sponsoring|'
    r'sponsor a skilled worker visa',
    re.IGNORECASE
)


def detect_sponsorship(text: str) -> SponsorshipStatus:
    """Classify what a posting's text says about visa sponsorship -- just
    reads the listing, doesn't verify anything with the employer. Most
    postings say nothing, hence NOT_MENTIONED as the common case.

    Checked UNLIKELY -> MAY_SPONSOR -> SPONSORS in that order so an
    explicit refusal beats softer boilerplate language elsewhere in the
    same posting.
    """
    if not text:
        return SponsorshipStatus.NOT_MENTIONED

    if _UNLIKELY_RE.search(text):
        return SponsorshipStatus.UNLIKELY
    if _MAY_SPONSOR_RE.search(text):
        return SponsorshipStatus.MAY_SPONSOR
    if _SPONSORS_RE.search(text):
        return SponsorshipStatus.SPONSORS

    return SponsorshipStatus.NOT_MENTIONED
