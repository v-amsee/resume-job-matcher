import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchingAPI, applicationsAPI, jobsAPI } from '../services/api';
import JobCard from '../components/JobCard';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { ACTIVE_SOURCE_LABELS, SOURCE_LABELS, SPONSORSHIP_LABELS } from '../utils/jobSource';

const PAGE_SIZE = 20;

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS)
  .filter(([, label]) => label)
  .map(([value, label]) => ({ value, label }));

const SPONSORSHIP_OPTIONS = Object.entries(SPONSORSHIP_LABELS)
  .map(([value, label]) => ({ value, label }));

// "match" only makes sense once there's a resume to score against, so it's
// filtered out of the dropdown in browse mode -- see the render below
const SORT_OPTIONS = [
  { value: 'match', label: 'Best match', rankedOnly: true },
  { value: 'newest', label: 'Newest' },
  { value: 'salary_high', label: 'Highest salary' },
  { value: 'salary_low', label: 'Lowest salary' },
];

// mirrors the backend's nullslast() -- a job with no salary listed sinks to
// the bottom no matter which direction you're sorting, instead of a missing
// value (0) reading as "the lowest salary" and floating to the top
const SORT_COMPARATORS = {
  match: (a, b) => b.match_score - a.match_score,
  newest: (a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0),
  salary_high: (a, b) => (b.salary_max || 0) - (a.salary_max || 0),
  salary_low: (a, b) => {
    const aVal = a.salary_min > 0 ? a.salary_min : Infinity;
    const bVal = b.salary_min > 0 ? b.salary_min : Infinity;
    return aVal - bVal;
  },
};

const EMPTY_FILTERS = {
  location: '',
  jobType: '',
  experienceLevel: '',
  minSalary: '',
  maxSalary: '',
  sources: [],
  sponsorships: [],
};

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-600 focus:border-brand-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100';

export default function MatchedJobs({ user, onLoginClick }) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterScore, setFilterScore] = useState(0);

  // ranked = resume on file, jobs come from /matching/jobs with scores.
  // unranked = no resume yet, falls back to the public /jobs listing
  const [ranked, setRanked] = useState(true);
  const [sortBy, setSortBy] = useState('match');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // ranked mode gets the whole match list back in one API call, but
  // rendering thousands of cards at once is what was making the page feel
  // slow to load -- only render a page's worth at a time, same as browse mode
  const [rankedVisibleCount, setRankedVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    loadJobs();
  }, []);

  // any filter change starts back at one page's worth of rendered cards
  useEffect(() => {
    setRankedVisibleCount(PAGE_SIZE);
  }, [filters, filterScore]);

  const loadJobs = async () => {
    setLoading(true);
    setError('');

    // Not logged in at all -- /matching/jobs requires auth, so don't even
    // try it (that'd just be a 401). Straight to the plain browse listing.
    if (!user) {
      setRanked(false);
      setSortBy('newest');
      try {
        await loadBrowseJobs(1, EMPTY_FILTERS, false, 'newest');
      } catch (error) {
        setError(error.response?.data?.detail || 'Error loading jobs');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const response = await matchingAPI.getMatchedJobs();
      setRanked(true);
      setJobs(response.data);
    } catch (error) {
      if (error.response?.status === 400) {
        // No resume on file -- browse everything instead of blocking.
        setRanked(false);
        setSortBy('newest');
        await loadBrowseJobs(1, EMPTY_FILTERS, false, 'newest');
      } else {
        setError(error.response?.data?.detail || 'Error loading jobs');
      }
    } finally {
      setLoading(false);
    }
  };

  // Backend filter params mirror the ones GET /jobs/ already supports.
  const toApiFilters = (f, sort) => ({
    location: f.location,
    job_type: f.jobType,
    experience_level: f.experienceLevel,
    min_salary: f.minSalary,
    max_salary: f.maxSalary,
    source: f.sources.join(','),
    sponsorship: f.sponsorships.join(','),
    sort,
  });

  // sortOverride defaults to the current sortBy state, but callers that
  // just changed the sort dropdown pass the new value explicitly -- setSortBy
  // won't have landed in this closure's `sortBy` yet by the time they call this
  const loadBrowseJobs = async (pageToLoad, f, append = false, sortOverride = sortBy) => {
    const cleanFilters = Object.fromEntries(
      Object.entries(toApiFilters(f, sortOverride)).filter(([, v]) => v)
    );
    const response = await jobsAPI.getAll(pageToLoad, PAGE_SIZE, cleanFilters);
    const totalCount = parseInt(response.headers['x-total-count'] || '0', 10);
    setTotal(totalCount);
    setPage(pageToLoad);
    setJobs((prev) => (append ? [...prev, ...response.data] : response.data));
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadBrowseJobs(page + 1, filters, true);
    } catch (error) {
      alert(error.response?.data?.detail || 'Error loading more jobs');
    } finally {
      setLoadingMore(false);
    }
  };

  // ranked mode has the whole match list in memory already, so filtering
  // is just client-side. unranked is paginated, so a filter change needs
  // to refetch from the server to get an accurate total.
  const handleFilterSubmit = async (e) => {
    e.preventDefault();
    if (ranked) return;

    setLoading(true);
    try {
      await loadBrowseJobs(1, filters);
    } catch (error) {
      setError(error.response?.data?.detail || 'Error loading jobs');
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // ranked mode just re-sorts what's already in memory. browse mode is
  // paginated server-side, so a sort change means re-fetching page 1 with
  // the new order instead of just re-sorting the one page we have loaded.
  const handleSortChange = async (value) => {
    setSortBy(value);
    if (ranked) return;

    setLoading(true);
    try {
      await loadBrowseJobs(1, filters, false, value);
    } catch (error) {
      setError(error.response?.data?.detail || 'Error loading jobs');
    } finally {
      setLoading(false);
    }
  };

  const toggleSourceFilter = (value) => {
    setFilters((prev) => ({
      ...prev,
      sources: prev.sources.includes(value)
        ? prev.sources.filter((s) => s !== value)
        : [...prev.sources, value],
    }));
  };

  const toggleSponsorshipFilter = (value) => {
    setFilters((prev) => ({
      ...prev,
      sponsorships: prev.sponsorships.includes(value)
        ? prev.sponsorships.filter((s) => s !== value)
        : [...prev.sponsorships, value],
    }));
  };

  const handleApply = async (jobId) => {
    if (!user) {
      onLoginClick?.();
      return;
    }
    try {
      await applicationsAPI.create(jobId, null);
      setJobs(jobs.map(job =>
        job.id === jobId ? { ...job, is_applied: true } : job
      ));
    } catch (error) {
      alert(error.response?.data?.detail || 'Error applying for job');
    }
  };

  const handleSave = async (jobId) => {
    if (!user) {
      onLoginClick?.();
      return;
    }
    try {
      const job = jobs.find(j => j.id === jobId);
      if (job.is_saved) {
        await matchingAPI.unsaveJob(jobId);
      } else {
        await matchingAPI.saveJob(jobId);
      }
      setJobs(jobs.map(j =>
        j.id === jobId ? { ...j, is_saved: !j.is_saved } : j
      ));
    } catch (error) {
      alert(error.response?.data?.detail || 'Error saving job');
    }
  };

  const matchesClientFilters = (job) => {
    if (job.match_score < filterScore) return false;
    if (filters.location && !(job.location || '').toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.jobType && job.job_type !== filters.jobType) return false;
    if (filters.experienceLevel && job.experience_level !== filters.experienceLevel) return false;
    // mirrors the backend's salary_min/max filter semantics
    if (filters.minSalary && !(job.salary_min >= Number(filters.minSalary))) return false;
    if (filters.maxSalary && !(job.salary_max > 0 && job.salary_max <= Number(filters.maxSalary))) return false;
    if (filters.sources.length && !filters.sources.includes(job.source)) return false;
    if (filters.sponsorships.length && !filters.sponsorships.includes(job.sponsorship)) return false;
    return true;
  };

  const filteredJobs = ranked
    ? jobs.filter(matchesClientFilters).sort(SORT_COMPARATORS[sortBy] || SORT_COMPARATORS.match)
    : jobs;
  const visibleJobs = ranked ? filteredJobs.slice(0, rankedVisibleCount) : filteredJobs;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading jobs…</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1 dark:text-gray-100">
        {ranked ? 'Jobs matched for you' : 'Browse jobs'}
      </h1>
      <p className="text-gray-500 mb-2 dark:text-gray-400">
        {ranked
          ? `${jobs.length} job${jobs.length !== 1 ? 's' : ''} matched based on your skills`
          : `Showing all open positions${total ? ` (${total} total)` : ''}`}
      </p>
      <p className="text-xs text-gray-400 mb-8 dark:text-gray-500">
        Jobs sourced from {ACTIVE_SOURCE_LABELS.join(', ')}.
      </p>

      {!ranked && !user && (
        <div className="mb-8 p-4 bg-brand-50 border border-brand-200 rounded-lg dark:bg-brand-950/30 dark:border-brand-900">
          <p className="text-sm text-brand-800 dark:text-brand-300">
            Log in and upload your resume to see a match score and matched skills for every job.
          </p>
          <button
            onClick={onLoginClick}
            className="mt-3 px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Log in
          </button>
        </div>
      )}

      {!ranked && user && (
        <div className="mb-8 p-4 bg-brand-50 border border-brand-200 rounded-lg dark:bg-brand-950/30 dark:border-brand-900">
          <p className="text-sm text-brand-800 dark:text-brand-300">
            Upload your resume to see a match score and matched skills for every job.
          </p>
          <button
            onClick={() => navigate('/upload-resume')}
            className="mt-3 px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Upload resume
          </button>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{error}</p>
        </div>
      )}

      {ranked && jobs.length > 0 && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4 dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap dark:text-gray-300">Minimum match score</label>
            <input
              type="range"
              min="0"
              max="100"
              value={filterScore}
              onChange={(e) => setFilterScore(Number(e.target.value))}
              className="flex-1 max-w-xs accent-gray-900 dark:accent-gray-100"
            />
            <span className="text-sm font-semibold text-gray-900 w-10 text-right dark:text-gray-100">{filterScore}%</span>
          </div>
        </div>
      )}

      {(ranked ? jobs.length > 0 : true) && (
        <form onSubmit={handleFilterSubmit} className="mb-8 bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3 items-end dark:bg-gray-900 dark:border-gray-800">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Location</label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => updateFilter('location', e.target.value)}
              placeholder="e.g. London, Remote"
              className={fieldClass}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Job type</label>
            <select
              value={filters.jobType}
              onChange={(e) => updateFilter('jobType', e.target.value)}
              className={fieldClass}
            >
              <option value="">Any</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Experience level</label>
            <select
              value={filters.experienceLevel}
              onChange={(e) => updateFilter('experienceLevel', e.target.value)}
              className={fieldClass}
            >
              <option value="">Any</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div className="min-w-[110px]">
            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Min salary</label>
            <input
              type="number"
              min="0"
              value={filters.minSalary}
              onChange={(e) => updateFilter('minSalary', e.target.value)}
              placeholder="0"
              className={fieldClass}
            />
          </div>
          <div className="min-w-[110px]">
            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Max salary</label>
            <input
              type="number"
              min="0"
              value={filters.maxSalary}
              onChange={(e) => updateFilter('maxSalary', e.target.value)}
              placeholder="Any"
              className={fieldClass}
            />
          </div>
          <MultiSelectDropdown
            label="Source"
            options={SOURCE_OPTIONS}
            selected={filters.sources}
            onToggle={toggleSourceFilter}
          />
          <MultiSelectDropdown
            label="Sponsorship"
            options={SPONSORSHIP_OPTIONS}
            selected={filters.sponsorships}
            onToggle={toggleSponsorshipFilter}
          />
          <div className="min-w-[150px]">
            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className={fieldClass}
            >
              {SORT_OPTIONS.filter((opt) => ranked || !opt.rankedOnly).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {!ranked && (
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Apply filters
            </button>
          )}
          {(filters.location || filters.jobType || filters.experienceLevel || filters.minSalary || filters.maxSalary || filters.sources.length > 0 || filters.sponsorships.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                if (!ranked) loadBrowseJobs(1, EMPTY_FILTERS);
              }}
              className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </form>
      )}

      {ranked && jobs.length > 0 && (
        <p className="text-sm text-gray-500 -mt-4 mb-8 dark:text-gray-400">
          Showing {visibleJobs.length} of {filteredJobs.length} jobs
        </p>
      )}

      {filteredJobs.length > 0 ? (
        <>
          <div className="grid gap-4">
            {visibleJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                matchScore={job.match_score}
                onApply={handleApply}
                onSave={handleSave}
                showApply={true}
              />
            ))}
          </div>

          {!ranked && jobs.length < total && (
            <div className="text-center mt-8">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-5 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:border-gray-300 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          {ranked && rankedVisibleCount < filteredJobs.length && (
            <div className="text-center mt-8">
              <button
                onClick={() => setRankedVisibleCount((count) => count + PAGE_SIZE)}
                className="px-5 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
              >
                Load more
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg dark:border-gray-800">
          <p className="text-gray-700 font-medium dark:text-gray-300">
            {ranked ? 'No jobs match your criteria' : 'No jobs available yet'}
          </p>
          {ranked ? (
            <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Try lowering the minimum match score or clearing filters</p>
          ) : (
            <button
              onClick={loadJobs}
              className="mt-4 px-5 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Refresh
            </button>
          )}
        </div>
      )}
    </div>
  );
}
