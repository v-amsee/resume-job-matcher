import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsAPI, applicationsAPI, matchingAPI } from '../services/api';
import { sourceLabel, sponsorshipBadge } from '../utils/jobSource';
import SkillPill from '../components/SkillPill';

export default function JobDetails({ user }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);

  useEffect(() => {
    loadJobDetails();
  }, [jobId]);

  const loadJobDetails = async () => {
    try {
      const response = await jobsAPI.getById(jobId);
      setJob(response.data);

      if (user?.user_type === 'job_seeker') {
        // Load match score
        try {
          const matchResponse = await matchingAPI.getMatchedJobs();
          const matched = matchResponse.data.find(j => j.id === parseInt(jobId));
          if (matched) {
            setMatchInfo(matched);
            setHasApplied(matched.is_applied);
            setIsSaved(matched.is_saved);
          }
        } catch (error) {
          console.error('Error loading match info:', error);
        }
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Error loading job');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    // External jobs: open the real posting so the user applies there, and
    // still record an Application locally so it shows up in the
    // Applications tracker exactly like an internal job would.
    if (job.apply_url) {
      window.open(job.apply_url, '_blank', 'noopener,noreferrer');
    }
    try {
      await applicationsAPI.create(jobId, null);
      setHasApplied(true);
    } catch (error) {
      alert(error.response?.data?.detail || 'Error applying for job');
    }
  };

  const handleSave = async () => {
    try {
      if (isSaved) {
        await matchingAPI.unsaveJob(jobId);
      } else {
        await matchingAPI.saveJob(jobId);
      }
      setIsSaved(!isSaved);
    } catch (error) {
      alert(error.response?.data?.detail || 'Error saving job');
    }
  };

  const source = job ? sourceLabel(job.source) : null;
  const badge = job ? sponsorshipBadge(job.sponsorship) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading job details…</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center">
          <p className="text-gray-700 mb-4 dark:text-gray-300">{error || 'Job not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-900 font-medium mb-6 dark:text-gray-400 dark:hover:text-gray-100"
      >
        &larr; Back
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-8 dark:bg-gray-900 dark:border-gray-800">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1 dark:text-gray-100">{job.title}</h1>
            <p className="text-gray-500 mb-4 dark:text-gray-400">{job.company}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              {job.location && <span>{job.location}</span>}
              {job.job_type && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">&middot;</span>
                  <span>{job.job_type}</span>
                </>
              )}
              {job.experience_level && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">&middot;</span>
                  <span className="capitalize">{job.experience_level} level</span>
                </>
              )}
              {source && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">&middot;</span>
                  <span>via {source}</span>
                </>
              )}
            </div>
            {badge && (
              <span className={`inline-block mt-3 px-2 py-1 rounded text-xs font-medium ${badge.className}`}>
                {badge.text}
              </span>
            )}
          </div>
          {matchInfo && (
            <div className="text-right flex-shrink-0">
              <div className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {matchInfo.match_score.toFixed(0)}%
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mt-1 dark:text-gray-400">Match score</p>
            </div>
          )}
        </div>

        {/* Salary */}
        {job.salary_min > 0 && job.salary_max > 0 && (
          <div className="mb-6 py-3 border-y border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()} per year
            </p>
          </div>
        )}

        {/* Description */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 dark:text-gray-400">About this role</h2>
          <div className="whitespace-pre-wrap text-gray-700 leading-relaxed dark:text-gray-300">
            {job.description}
          </div>
        </div>

        {/* Skills */}
        {job.required_skills && job.required_skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 dark:text-gray-400">Required skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.map((skill) => (
                <SkillPill
                  key={skill}
                  skill={skill}
                  variant={matchInfo?.matched_skills.includes(skill) ? 'matched' : 'default'}
                />
              ))}
            </div>
          </div>
        )}

        {/* Nice to Have */}
        {job.nice_to_have_skills && job.nice_to_have_skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 dark:text-gray-400">Nice to have</h2>
            <div className="flex flex-wrap gap-2">
              {job.nice_to_have_skills.map((skill) => (
                <SkillPill key={skill} skill={skill} variant="neutral" />
              ))}
            </div>
          </div>
        )}

        {/* Skills Analysis */}
        {matchInfo && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {matchInfo.matched_skills.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 dark:text-gray-100">Your matching skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {matchInfo.matched_skills.map((skill) => (
                    <SkillPill key={skill} skill={skill} variant="matched" />
                  ))}
                </div>
              </div>
            )}

            {matchInfo.missing_skills.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 dark:text-gray-100">Skills to develop</h3>
                <div className="flex flex-wrap gap-1.5">
                  {matchInfo.missing_skills.map((skill) => (
                    <SkillPill key={skill} skill={skill} variant="missing" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {user?.user_type === 'job_seeker' && (
          <div className="flex gap-3 pt-8 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={handleApply}
              disabled={hasApplied}
              className={`flex-1 py-3 rounded-md font-medium transition ${
                hasApplied
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-gray-900 text-white hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white'
              }`}
            >
              {hasApplied ? 'Applied' : source ? `Apply on ${source}` : 'Apply now'}
            </button>
            <button
              onClick={handleSave}
              className={`px-6 py-3 rounded-md font-medium border transition ${
                isSaved
                  ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
