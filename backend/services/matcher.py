from typing import List, Dict, Tuple
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

class JobMatcher:
    """Algorithm for matching resumes with jobs"""

    @staticmethod
    def calculate_semantic_similarity(user_text: str, job_text: str) -> float:
        """TF-IDF cosine similarity between resume text and a job
        description, scaled to 0-100. Catches terminology overlap that exact
        skill-list matching misses -- "React" vs "ReactJS", "ML" vs
        "Machine Learning", that kind of thing."""
        user_text = (user_text or "").strip()
        job_text = (job_text or "").strip()

        if not user_text or not job_text:
            return 0.0

        try:
            vectorizer = TfidfVectorizer()
            tfidf_matrix = vectorizer.fit_transform([user_text, job_text])
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            return float(similarity) * 100
        except ValueError:
            # e.g. "empty vocabulary" if, after tokenizing, neither text has
            # any usable content (very short/unusual input) -- treat that as
            # no semantic signal rather than raising.
            return 0.0

    @staticmethod
    def calculate_skill_match(user_skills: List[str], job_required_skills: List[str]) -> Tuple[float, List[str], List[str]]:
        """
        Calculate match percentage based on skills
        Returns: (match_score, matched_skills, missing_skills)
        """
        user_skills_lower = [s.lower() for s in user_skills]
        job_skills_lower = [s.lower() for s in job_required_skills]
        
        if not job_skills_lower:
            return 100.0, user_skills, []
        
        # Find matched skills
        matched = [skill for skill in job_skills_lower if skill in user_skills_lower]
        missing = [skill for skill in job_skills_lower if skill not in user_skills_lower]
        
        # Calculate percentage
        match_percentage = (len(matched) / len(job_skills_lower)) * 100
        
        return match_percentage, matched, missing
    
    @staticmethod
    def calculate_experience_match(user_experience_years: int, job_experience_level: str) -> float:
        """Calculate bonus points for experience level match"""
        # user_experience_years may be None (resume parsing found nothing) --
        # treat that as 0 years rather than raising a TypeError on comparison.
        user_experience_years = user_experience_years or 0

        experience_mapping = {
            "junior": (0, 3),
            "mid": (3, 8),
            "senior": (8, 100)
        }

        min_exp, max_exp = experience_mapping.get(job_experience_level.lower(), (0, 100))

        if min_exp <= user_experience_years <= max_exp:
            return 15.0  # Perfect experience match
        elif user_experience_years > max_exp:
            return 7.5   # Overqualified
        else:
            return 0.0   # Underqualified
    
    @staticmethod
    def calculate_salary_match(user_salary_expectation: float, job_salary_min: float, job_salary_max: float) -> float:
        """Calculate bonus points for salary expectations match"""
        if not user_salary_expectation or not job_salary_min:
            return 0.0
        
        if job_salary_min <= user_salary_expectation <= job_salary_max:
            return 5.0
        else:
            return 0.0
    
    @staticmethod
    def match_job(user_skills: List[str], job_required_skills: List[str],
                  job_nice_to_have: List[str], user_experience_years: int,
                  job_experience_level: str, user_resume_text: str = "",
                  job_description_text: str = "") -> Dict:
        """Overall match score for a job.

        Scoring breakdown:
        - Structured skill match: 55%
        - Semantic text similarity: 20%
        - Experience level: 15%
        - Nice-to-have skills: 10%

        user_resume_text / job_description_text are optional -- if left out,
        this falls back to the skill lists so semantic scoring still has
        something to work with instead of just contributing zero.
        """

        # Structured skill match (55%)
        skill_match, matched_skills, missing_skills = JobMatcher.calculate_skill_match(
            user_skills, job_required_skills
        )
        base_score = (skill_match / 100) * 55

        # Semantic similarity (20%)
        resume_text = user_resume_text.strip() if user_resume_text else " ".join(user_skills)
        job_text = job_description_text.strip() if job_description_text else " ".join(
            job_required_skills + job_nice_to_have
        )
        semantic_similarity = JobMatcher.calculate_semantic_similarity(resume_text, job_text)
        semantic_score = (semantic_similarity / 100) * 20

        # Experience match (15%)
        exp_bonus = JobMatcher.calculate_experience_match(user_experience_years, job_experience_level)
        exp_score = min(exp_bonus, 15)

        # Nice-to-have skills bonus (10%)
        nice_to_have_lower = [s.lower() for s in job_nice_to_have]
        user_skills_lower = [s.lower() for s in user_skills]
        nice_matches = [s for s in nice_to_have_lower if s in user_skills_lower]

        if nice_to_have_lower:
            nice_score = (len(nice_matches) / len(nice_to_have_lower)) * 10
        else:
            nice_score = 0

        # Total score
        total_score = min(base_score + semantic_score + exp_score + nice_score, 100)

        return {
            "match_score": round(total_score, 1),
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "base_score": round(base_score, 1),
            "semantic_score": round(semantic_score, 1),
            "experience_bonus": round(exp_score, 1),
            "nice_to_have_bonus": round(nice_score, 1)
        }
    
    @staticmethod
    def rank_jobs(user_skills: List[str], user_experience_years: int, jobs: List[Dict]) -> List[Dict]:
        """
        Rank multiple jobs by match score
        """
        results = []
        
        for job in jobs:
            match_result = JobMatcher.match_job(
                user_skills=user_skills,
                job_required_skills=job.get("required_skills", []),
                job_nice_to_have=job.get("nice_to_have_skills", []),
                user_experience_years=user_experience_years,
                job_experience_level=job.get("experience_level", "mid")
            )
            
            results.append({
                **job,
                **match_result
            })
        
        # Sort by match score descending
        results.sort(key=lambda x: x["match_score"], reverse=True)
        
        return results

# Singleton instance
matcher = JobMatcher()
