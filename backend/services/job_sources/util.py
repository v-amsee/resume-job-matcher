"""Small shared helpers for normalizing raw job-source payloads into the
shape sync_jobs.py expects."""
import html as html_module
import re
from typing import Optional, Tuple

_TAG_RE = re.compile(r'<[^>]+>')
_WHITESPACE_RE = re.compile(r'[ \t]+')

# cheap "is this even English" check -- a real posting has several of these
# in the first few hundred characters, a Spanish/German one won't
_ENGLISH_STOPWORDS = {
    "the", "and", "with", "you", "our", "for", "are", "will", "have",
    "this", "your", "from", "that", "team", "work", "experience",
}


def clean_location(raw: Optional[str]) -> str:
    """Strip dangling separators from a source's location string, e.g.
    RemoteOK sometimes sends "Dharmsala, " with no country after the comma."""
    if not raw:
        return "Remote"
    text = re.sub(r'\s*,\s*', ', ', raw.strip())
    text = text.strip(', ').strip()
    return text or "Remote"


def is_valid_job(title: str, description: str) -> bool:
    """Quality gate for external listings. RemoteOK/Arbeitnow especially mix
    in junk -- bare numeric titles, near-empty descriptions, non-English
    postings. Easier to filter here than to make matching robust to garbage."""
    title = (title or "").strip()
    description = (description or "").strip()

    # title with no real letters, e.g. "1838"
    if len(re.sub(r'[^A-Za-z]', '', title)) < 2:
        return False

    if len(description) < 40:
        return False

    excerpt = description[:500].lower()
    words = set(re.findall(r"[a-z']+", excerpt))
    if len(words & _ENGLISH_STOPWORDS) < 2:
        return False

    return True


def strip_html(raw: str) -> str:
    """Plain-text a source's HTML description -- the frontend renders this
    in a plain div, not dangerouslySetInnerHTML, so raw tags would just show
    up as literal text."""
    if not raw:
        return ""
    text = _TAG_RE.sub(' ', raw)
    text = html_module.unescape(text)
    lines = [_WHITESPACE_RE.sub(' ', line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


_JOB_TYPE_MAP = {
    "full_time": "Full-time",
    "full time": "Full-time",
    "fulltime": "Full-time",
    "part_time": "Part-time",
    "part time": "Part-time",
    "parttime": "Part-time",
    "contract": "Contract",
    "freelance": "Contract",
    "internship": "Contract",
}


def map_job_type(raw: Optional[str]) -> str:
    """Maps a source's job-type label onto our Full-time/Part-time/Contract
    vocabulary. Anything unrecognized just defaults to Full-time."""
    if not raw:
        return "Full-time"
    return _JOB_TYPE_MAP.get(raw.strip().lower(), "Full-time")


def parse_salary_range(raw: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    """Best-effort parse of a loose salary string like "$90,000 - $120,000"
    or "90k-120k" into (min, max). Returns (None, None) if nothing usable is
    found -- most postings across these sources don't include a parseable
    salary at all, which is expected, not a failure.
    """
    if not raw:
        return None, None

    numbers = []
    for match in re.finditer(r'(\d[\d,]*)(k)?', raw, re.IGNORECASE):
        value = float(match.group(1).replace(',', ''))
        if match.group(2):
            value *= 1000
        numbers.append(value)

    if not numbers:
        return None, None
    if len(numbers) == 1:
        return numbers[0], numbers[0]
    return min(numbers), max(numbers)
