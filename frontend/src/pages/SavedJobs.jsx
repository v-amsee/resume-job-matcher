import { useState, useEffect } from 'react';
import { matchingAPI, applicationsAPI } from '../services/api';
import JobCard from '../components/JobCard';

export default function SavedJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSavedJobs();
  }, []);

  const loadSavedJobs = async () => {
    try {
      const response = await matchingAPI.getSavedJobs();
      setJobs(response.data);
    } catch (error) {
      setError(error.response?.data?.detail || 'Error loading saved jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (jobId) => {
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
    try {
      await matchingAPI.unsaveJob(jobId);
      setJobs(jobs.filter(j => j.id !== jobId));
    } catch (error) {
      alert(error.response?.data?.detail || 'Error removing saved job');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading saved jobs…</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-8 dark:text-gray-100">Saved jobs</h1>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
          {error}
        </div>
      )}

      {jobs.length > 0 ? (
        <div className="grid gap-4">
          {jobs.map((job) => (
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
      ) : (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg dark:border-gray-800">
          <p className="text-gray-700 font-medium mb-4 dark:text-gray-300">You haven't saved any jobs yet</p>
          <a
            href="/matched-jobs"
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black inline-block dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Browse matching jobs
          </a>
        </div>
      )}
    </div>
  );
}
