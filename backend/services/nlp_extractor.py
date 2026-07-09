import spacy
from typing import List, Dict, Optional
from datetime import datetime
import re

# make sure the model's installed: python -m spacy download en_core_web_sm
try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    print("⚠️  spaCy model not found. Run: python -m spacy download en_core_web_sm")
    nlp = None

# Master skill database
SKILLS_DATABASE = {
    "programming_languages": [
        "python", "javascript", "java", "c++", "c#", "go", "rust", "php",
        "ruby", "swift", "kotlin", "typescript", "scala", "r", "matlab"
    ],
    "frontend": [
        "react", "vue.js", "angular", "svelte", "html", "css", "sass",
        "tailwind", "bootstrap", "webpack", "vite", "next.js", "nuxt.js"
    ],
    "backend": [
        "node.js", "django", "flask", "fastapi", "spring", "express.js",
        "rails", "laravel", "asp.net", "asp.net core", "gin"
    ],
    "databases": [
        "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
        "dynamodb", "cassandra", "firestore", "oracle", "sql server"
    ],
    "devops": [
        "docker", "kubernetes", "aws", "gcp", "azure", "jenkins",
        "gitlab ci", "github actions", "terraform", "ansible"
    ],
    "ml": [
        "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
        "opencv", "keras", "nlp", "machine learning", "deep learning"
    ],
    "other": [
        "git", "rest api", "graphql", "microservices", "agile", "scrum",
        "jira", "linux", "unix", "windows", "macos"
    ]
}

class NLPExtractor:
    def __init__(self):
        self.all_skills = self._flatten_skills()

    def _flatten_skills(self) -> List[str]:
        """Flatten all skills into one list"""
        skills = []
        for category in SKILLS_DATABASE.values():
            skills.extend(category)
        return [skill.lower() for skill in skills]

    @staticmethod
    def _contains_token(text_lower: str, token: str) -> bool:
        """True if `token` shows up in `text_lower` as a whole word, not just
        a substring -- short tokens like "r", "go", "gin" match constantly
        as plain substrings ("server", "google", "engineering"...), so this
        requires it not be glued to surrounding letters/digits, while still
        matching symbol-suffixed tokens like "c++"/"c#"."""
        pattern = r'(?<![a-z0-9])' + re.escape(token) + r'(?![a-z0-9])'
        return re.search(pattern, text_lower) is not None

    def extract_skills(self, text: str) -> List[str]:
        """Extract skills from resume text"""
        text_lower = text.lower()
        found_skills = set()

        # Exact match
        for skill in self.all_skills:
            if self._contains_token(text_lower, skill):
                found_skills.add(skill)

        # Common phrases
        phrases = [
            "experienced with", "proficient in", "expertise in",
            "knowledge of", "skilled in"
        ]

        for phrase in phrases:
            idx = text_lower.find(phrase)
            if idx == -1:
                continue
            # Extract words after phrase
            after_phrase = text_lower[idx + len(phrase):idx + len(phrase) + 100]
            for skill in self.all_skills:
                if self._contains_token(after_phrase, skill):
                    found_skills.add(skill)

        return sorted(list(found_skills))

    # matches date ranges like "Jan 2019 - Mar 2022", "2015 - 2018", "June
    # 2021 - Present" -- most resumes convey experience through work-history
    # dates like this rather than spelling out "X years of experience"
    _MONTH = r'[A-Za-z]{3,9}\.?'
    _YEAR = r'(?:19|20)\d{2}'
    _DATE_RANGE_RE = re.compile(
        r'(?P<start>(?:' + _MONTH + r'\s+)?' + _YEAR + r')'
        r'\s*(?:-|–|—|to)\s*'
        r'(?P<end>(?:' + _MONTH + r'\s+)?' + _YEAR + r'|present|current|now|ongoing)',
        re.IGNORECASE
    )

    def _years_from_date_ranges(self, text: str) -> Optional[int]:
        current_year = datetime.utcnow().year
        spans = []

        for match in self._DATE_RANGE_RE.finditer(text):
            start_match = re.search(r'(19|20)\d{2}', match.group('start'))
            if not start_match:
                continue
            start_year = int(start_match.group())

            end_raw = match.group('end').strip().lower()
            if end_raw in ('present', 'current', 'now', 'ongoing'):
                end_year = current_year
            else:
                end_match = re.search(r'(19|20)\d{2}', end_raw)
                if not end_match:
                    continue
                end_year = int(end_match.group())

            # skip reversed/absurdly-long/out-of-range matches
            if start_year <= end_year and (end_year - start_year) <= 50 \
                    and 1960 <= start_year and end_year <= current_year + 1:
                spans.append((start_year, end_year))

        if not spans:
            return None

        earliest = min(start for start, _ in spans)
        latest = max(end for _, end in spans)
        return max(latest - earliest, 0)

    def extract_experience_years(self, text: str) -> int:
        """Total years of experience. Prefers spanning the work-history date
        ranges (see _years_from_date_ranges), falling back to an explicit
        "5 years of experience"-style phrase if no dates are found at all."""
        years_from_dates = self._years_from_date_ranges(text)
        if years_from_dates is not None and years_from_dates > 0:
            return years_from_dates

        patterns = [
            r'(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)',
            r'(\d+)\+?\s*years?\s+(?:working|developing)',
            r'(?:over|about)\s+(\d+)\s+years?'
        ]

        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                return int(match.group(1))

        return 0

    @staticmethod
    def _extract_institution(text: str) -> Optional[str]:
        """Finds a school name via common institution-naming patterns rather
        than a fixed list of elite schools -- covers state schools, community
        colleges, anything with "University"/"College"/etc. in the name."""
        patterns = [
            r"University of [A-Z][A-Za-z.&'-]*(?:\s+[A-Z][A-Za-z.&'-]*){0,3}",
            r"[A-Z][A-Za-z.&'-]*(?:\s+[A-Z][A-Za-z.&'-]*){0,3}\s+"
            r"(?:University|College|Institute of Technology|Polytechnic Institute)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0).strip()
        return None

    @staticmethod
    def _extract_field_of_study(text_lower: str, near_index: int) -> Optional[str]:
        """Look for "in <field>" shortly after a degree mention, e.g.
        "BS in Computer Science" / "Master's degree in Data Science"."""
        window = text_lower[near_index:near_index + 100]
        match = re.search(r'\bin\s+([a-z][a-z&\-\s]{2,40}?)(?:[,.;\n]|$)', window)
        if match:
            return match.group(1).strip()
        return None

    def extract_education(self, text: str) -> str:
        """Extract education information"""
        text_lower = text.lower()

        # bare abbreviations (ms, ma, bs, ba) only count as "<abbrev> in
        # <field>" -- a bare \bms\b/\bma\b collides with state abbreviations
        # in addresses ("Boston, MA", "Jackson, MS"). Periods (M.S., B.A.)
        # are unambiguous enough to match on their own.
        # the lookahead (rather than consuming "in") leaves match.end() right
        # before " in <field>" so _extract_field_of_study can pick it up
        degrees = {
            "phd": r"\bphd\b|\bdoctorate\b|doctoral degree",
            "master's": r"master'?s degree|\bm\.s\.(?=[\s,.]|$)|\bms\b(?=\s+in\b)|\bm\.a\.(?=[\s,.]|$)|\bma\b(?=\s+in\b)",
            "bachelor's": r"bachelor'?s degree|\bb\.s\.(?=[\s,.]|$)|\bbs\b(?=\s+in\b)|\bb\.a\.(?=[\s,.]|$)|\bba\b(?=\s+in\b)|\bbsc\b",
            "associate": r"associate'?s?\s+degree"
        }

        for degree_name, pattern in degrees.items():
            match = re.search(pattern, text_lower)
            if not match:
                continue

            field = self._extract_field_of_study(text_lower, match.end())
            institution = self._extract_institution(text)

            label = degree_name.title()
            if field:
                label += f" in {field.title()}"
            if institution:
                label += f" from {institution}"
            return label

        return "Not specified"
    
    def extract_job_titles(self, text: str) -> List[str]:
        """Extract job titles from resume"""
        job_titles = []

        common_titles = [
            "senior developer", "junior developer", "full stack engineer",
            "backend engineer", "frontend engineer", "devops engineer",
            "ml engineer", "data scientist", "qa engineer", "product manager",
            "tech lead", "architect", "developer", "engineer", "programmer"
        ]
        
        text_lower = text.lower()
        for title in common_titles:
            if self._contains_token(text_lower, title):
                job_titles.append(title.title())

        return list(set(job_titles))

    def extract_languages(self, text: str) -> List[str]:
        """Extract programming languages"""
        text_lower = text.lower()
        languages = []

        # _contains_token, not a plain substring check -- "go" as a substring
        # matches "google", "algorithm", "going", etc.
        lang_list = [
            "python", "javascript", "java", "c++", "c#", "go", "rust",
            "php", "ruby", "swift", "kotlin", "typescript"
        ]

        for lang in lang_list:
            if self._contains_token(text_lower, lang):
                languages.append(lang.title())

        return languages

    def extract_certifications(self, text: str) -> List[str]:
        """Extract certifications"""
        certs = []
        cert_keywords = [
            "aws certified", "google cloud", "azure certified",
            "certified kubernetes", "comptia", "cisco", "oracle"
        ]

        text_lower = text.lower()
        for cert in cert_keywords:
            if self._contains_token(text_lower, cert):
                certs.append(cert.title())

        return certs
    
    def extract_all(self, text: str) -> Dict:
        """Extract all information at once"""
        return {
            "skills": self.extract_skills(text),
            "experience_years": self.extract_experience_years(text),
            "education": self.extract_education(text),
            "job_titles": self.extract_job_titles(text),
            "languages": self.extract_languages(text),
            "certifications": self.extract_certifications(text)
        }

# Singleton instance
extractor = NLPExtractor()
