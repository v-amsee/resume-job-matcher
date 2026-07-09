import { useState, useEffect } from 'react';
import { applicationsAPI, jobsAPI } from '../services/api';
import SkillPill from '../components/SkillPill';

const STATUS_STYLES = {
  applied: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  interview_scheduled: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  accepted: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300',
};

const STATUS_OPTIONS = ['applied', 'interview_scheduled', 'rejected', 'accepted'];

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobsData, setJobsData] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  // holds an in-progress interview date/link while the user is filling out
  // the "moved to interview_scheduled" form, keyed by application id
  const [interviewDrafts, setInterviewDrafts] = useState({});

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const response = await applicationsAPI.getMyApplications();
      setApplications(response.data);

      // Load job details for each application in parallel instead of one
      // request at a time in a sequential for-await loop.
      const uniqueJobIds = [...new Set(response.data.map((app) => app.job_id))];
      const jobResponses = await Promise.all(
        uniqueJobIds.map((jobId) => jobsAPI.getById(jobId))
      );

      const jobsMap = {};
      uniqueJobIds.forEach((jobId, index) => {
        jobsMap[jobId] = jobResponses[index].data;
      });
      setJobsData(jobsMap);
    } catch (error) {
      setError(error.response?.data?.detail || 'Error loading applications');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (applicationId) => {
    if (!window.confirm('Are you sure you want to withdraw this application?')) return;

    try {
      await applicationsAPI.withdraw(applicationId);
      setApplications(applications.filter(app => app.id !== applicationId));
    } catch (error) {
      alert(error.response?.data?.detail || 'Error withdrawing application');
    }
  };

  const handleStatusChange = async (app, newStatus) => {
    if (newStatus === app.status) return;

    // interview_scheduled needs a date, so open the inline form instead of
    // saving immediately -- handleSaveInterview does the actual API call
    if (newStatus === 'interview_scheduled') {
      setInterviewDrafts((prev) => ({ ...prev, [app.id]: { date: '', link: '' } }));
      return;
    }

    try {
      const response = await applicationsAPI.update(app.id, { status: newStatus });
      setApplications((prev) => prev.map((a) => (a.id === app.id ? response.data : a)));
    } catch (error) {
      alert(error.response?.data?.detail || 'Error updating status');
    }
  };

  const handleSaveInterview = async (app) => {
    const draft = interviewDrafts[app.id];
    if (!draft?.date) return;

    try {
      const response = await applicationsAPI.update(app.id, {
        status: 'interview_scheduled',
        interview_date: new Date(draft.date).toISOString(),
        interview_link: draft.link || null,
      });
      setApplications((prev) => prev.map((a) => (a.id === app.id ? response.data : a)));
      setInterviewDrafts((prev) => {
        const next = { ...prev };
        delete next[app.id];
        return next;
      });
    } catch (error) {
      alert(error.response?.data?.detail || 'Error scheduling interview');
    }
  };

  const cancelInterviewDraft = (appId) => {
    setInterviewDrafts((prev) => {
      const next = { ...prev };
      delete next[appId];
      return next;
    });
  };

  const getStatusLabel = (status) => {
    return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const filteredApplications = statusFilter === 'all'
    ? applications
    : applications.filter(app => app.status === statusFilter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading applications…</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-8 dark:text-gray-100">My applications</h1>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
          {error}
        </div>
      )}

      {applications.length > 0 && (
        <>
          {/* Status Filter */}
          <div className="mb-8 bg-white rounded-lg border border-gray-200 p-4 dark:bg-gray-900 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 mb-3 dark:text-gray-300">Filter by status</p>
            <div className="flex flex-wrap gap-2">
              {['all', 'applied', 'interview_scheduled', 'rejected', 'accepted'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    statusFilter === status
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {status === 'all' ? 'All' : getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>

          {/* Applications List */}
          <div className="space-y-4">
            {filteredApplications.length > 0 ? (
              filteredApplications.map((app) => {
                const job = jobsData[app.job_id];
                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800"
                  >
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{job?.title}</h3>
                        <p className="text-gray-500 text-sm dark:text-gray-400">{job?.company}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[app.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {getStatusLabel(app.status)}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Applied on</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(app.applied_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Match score</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {app.match_score.toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Location</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{job?.location}</p>
                      </div>
                    </div>

                    {app.matched_skills && app.matched_skills.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1.5 dark:text-gray-400">Matched skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {app.matched_skills.map((skill) => (
                            <SkillPill key={skill} skill={skill} variant="matched" />
                          ))}
                        </div>
                      </div>
                    )}

                    {app.missing_skills && app.missing_skills.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1.5 dark:text-gray-400">Skills to develop</p>
                        <div className="flex flex-wrap gap-1.5">
                          {app.missing_skills.slice(0, 3).map((skill) => (
                            <SkillPill key={skill} skill={skill} variant="missing" />
                          ))}
                        </div>
                      </div>
                    )}

                    {app.status === 'interview_scheduled' && !interviewDrafts[app.id] && (
                      <div className="mb-4 p-3 bg-brand-50 border border-brand-200 rounded-lg text-sm dark:bg-brand-950/30 dark:border-brand-900">
                        <p className="text-brand-800 dark:text-brand-300">
                          <strong>Interview scheduled:</strong> {new Date(app.interview_date).toLocaleString()}
                        </p>
                        {app.interview_link && (
                          <a
                            href={app.interview_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-700 hover:underline mt-1 block font-medium dark:text-brand-400"
                          >
                            Join interview
                          </a>
                        )}
                      </div>
                    )}

                    {interviewDrafts[app.id] && (
                      <div className="mb-4 p-3 border border-gray-200 rounded-lg dark:border-gray-800">
                        <p className="text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Interview details</p>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Date &amp; time</label>
                            <input
                              type="datetime-local"
                              value={interviewDrafts[app.id].date}
                              onChange={(e) => setInterviewDrafts((prev) => ({
                                ...prev,
                                [app.id]: { ...prev[app.id], date: e.target.value },
                              }))}
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Link (optional)</label>
                            <input
                              type="text"
                              value={interviewDrafts[app.id].link}
                              onChange={(e) => setInterviewDrafts((prev) => ({
                                ...prev,
                                [app.id]: { ...prev[app.id], link: e.target.value },
                              }))}
                              placeholder="https://…"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveInterview(app)}
                            disabled={!interviewDrafts[app.id].date}
                            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => cancelInterviewDraft(app.id)}
                            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <a
                        href={`/jobs/${app.job_id}`}
                        className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm rounded-md font-medium hover:bg-black text-center dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                      >
                        View job
                      </a>
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{getStatusLabel(s)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleWithdraw(app.id)}
                        className="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm rounded-md font-medium hover:bg-red-50 dark:bg-gray-900 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        {app.status === 'applied' ? 'Withdraw' : 'Remove'}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg dark:border-gray-800">
                <p className="text-gray-600 dark:text-gray-400">No applications with this status</p>
              </div>
            )}
          </div>
        </>
      )}

      {applications.length === 0 && !error && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg dark:border-gray-800">
          <p className="text-gray-700 font-medium mb-4 dark:text-gray-300">You haven't applied to any jobs yet</p>
          <a
            href="/matched-jobs"
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black inline-block dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Start applying
          </a>
        </div>
      )}
    </div>
  );
}
