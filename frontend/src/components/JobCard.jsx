import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sourceLabel, sponsorshipBadge } from '../utils/jobSource';
import SkillPill from './SkillPill';

function matchTone(score) {
  if (score >= 80) return 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-800';
  if (score >= 60) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900';
  return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700';
}

export default function JobCard({ job, onApply, onSave, matchScore, showApply = true }) {
  const navigate = useNavigate();
  const source = sourceLabel(job.source);
  const badge = sponsorshipBadge(job.sponsorship);
  // External jobs: clicking Apply just opens the real posting -- we don't
  // know if they actually went through with it there, so wait for them to
  // come back and say so instead of logging it right away.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const handleCardClick = () => {
    navigate(`/jobs/${job.id}`);
  };

  const handleApplyClick = (e) => {
    e.stopPropagation();
    if (job.apply_url) {
      window.open(job.apply_url, '_blank', 'noopener,noreferrer');
      setAwaitingConfirm(true);
      return;
    }
    // internal job, nothing external to confirm -- applying is the whole action
    onApply?.(job.id);
  };

  const handleConfirmApplied = (e) => {
    e.stopPropagation();
    onApply?.(job.id);
    setAwaitingConfirm(false);
  };

  const handleDismissConfirm = (e) => {
    e.stopPropagation();
    setAwaitingConfirm(false);
  };

  const handleSaveClick = (e) => {
    e.stopPropagation();
    onSave?.(job.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition p-6 cursor-pointer dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700"
    >
      <div className="flex justify-between items-start mb-3 gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate dark:text-gray-100">{job.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{job.company}</p>
        </div>
        {matchScore !== undefined && (
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${matchTone(matchScore)}`}>
            {matchScore.toFixed(0)}% match
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
        {job.location && <span>{job.location}</span>}
        {job.job_type && (
          <>
            <span className="text-gray-300 dark:text-gray-700">&middot;</span>
            <span>{job.job_type}</span>
          </>
        )}
        {job.salary_min > 0 && job.salary_max > 0 && (
          <>
            <span className="text-gray-300 dark:text-gray-700">&middot;</span>
            <span>${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}</span>
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
        <div className="mb-4">
          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${badge.className}`}>
            {badge.text}
          </span>
        </div>
      )}

      {job.required_skills && job.required_skills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {job.required_skills.slice(0, 6).map((skill) => (
              <SkillPill key={skill} skill={skill} />
            ))}
            {job.required_skills.length > 6 && (
              <span className="inline-block text-gray-400 text-xs py-1 dark:text-gray-600">
                +{job.required_skills.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {job.matched_skills && job.matched_skills.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5 dark:text-gray-400">Matched</p>
          <div className="flex flex-wrap gap-1.5">
            {job.matched_skills.slice(0, 5).map((skill) => (
              <SkillPill key={skill} skill={skill} variant="matched" />
            ))}
          </div>
        </div>
      )}

      {job.missing_skills && job.missing_skills.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1.5 dark:text-gray-400">Missing</p>
          <div className="flex flex-wrap gap-1.5">
            {job.missing_skills.slice(0, 3).map((skill) => (
              <SkillPill key={skill} skill={skill} variant="missing" />
            ))}
            {job.missing_skills.length > 3 && (
              <span className="inline-block text-gray-400 text-xs py-1 dark:text-gray-600">
                +{job.missing_skills.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
        {showApply && (
          awaitingConfirm && !job.is_applied ? (
            <div className="flex-1 flex gap-2">
              <button
                onClick={handleConfirmApplied}
                className="flex-1 py-2 rounded-md text-sm font-medium bg-gray-900 text-white hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                Mark as applied
              </button>
              <button
                onClick={handleDismissConfirm}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Didn&rsquo;t apply
              </button>
            </div>
          ) : (
            <button
              onClick={handleApplyClick}
              disabled={job.is_applied}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                job.is_applied
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-gray-900 text-white hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white'
              }`}
            >
              {job.is_applied ? 'Applied' : source ? `Apply on ${source}` : 'Apply now'}
            </button>
          )
        )}
        <button
          onClick={handleSaveClick}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition ${
            job.is_saved
              ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600'
          }`}
        >
          {job.is_saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
