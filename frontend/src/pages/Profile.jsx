import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, resumeAPI, extractErrorMessage } from '../services/api';
import SkillPill from '../components/SkillPill';

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-600 focus:border-brand-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100';

export default function Profile({ user, onProfileUpdate }) {
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resume, setResume] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);

  useEffect(() => {
    resumeAPI
      .getMyResume()
      .then((response) => setResume(response.data))
      .catch(() => setResume(null))
      .finally(() => setResumeLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Name can’t be empty');
      return;
    }

    setSaving(true);
    try {
      const response = await authAPI.updateProfile(name.trim(), user.company);
      onProfileUpdate(response.data);
      setSuccess('Profile updated.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Error updating profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-8 dark:text-gray-100">Profile</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Account details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-5 dark:text-gray-400">Account</h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Email</label>
              <input type="text" value={user.email} disabled className={`${fieldClass} opacity-60 cursor-not-allowed`} />
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Email can&rsquo;t be changed here.</p>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Account type</label>
              <p className="text-sm font-medium text-gray-900 capitalize dark:text-gray-100">
                {user.user_type.replace('_', ' ')}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-brand-50 border border-brand-200 text-brand-700 text-sm rounded-md dark:bg-brand-950/40 dark:border-brand-900 dark:text-brand-400">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-gray-900 text-white font-medium text-sm rounded-md hover:bg-black disabled:opacity-50 transition dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Resume summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-5 dark:text-gray-400">Resume</h2>

          {resumeLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : resume ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">File</p>
                <p className="font-medium text-gray-900 text-sm dark:text-gray-100">{resume.file_name}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Experience</p>
                <p className="font-medium text-gray-900 text-sm dark:text-gray-100">
                  {resume.experience_years ?? 0} year{resume.experience_years !== 1 ? 's' : ''}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2 dark:text-gray-500">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {resume.skills?.slice(0, 8).map((skill) => (
                    <SkillPill key={skill} skill={skill} />
                  ))}
                  {resume.skills?.length > 8 && (
                    <span className="text-gray-400 text-xs py-0.5 dark:text-gray-500">+{resume.skills.length - 8} more</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => navigate('/upload-resume')}
                className="w-full mt-2 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:border-gray-300 transition dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
              >
                Manage resume
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">You haven&rsquo;t uploaded a resume yet.</p>
              <button
                onClick={() => navigate('/upload-resume')}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-black transition dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                Upload resume
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
