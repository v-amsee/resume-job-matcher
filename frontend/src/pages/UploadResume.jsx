import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { resumeAPI } from '../services/api';
import SkillPill from '../components/SkillPill';

const listToText = (list) => (list || []).join(', ');
const textToList = (text) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const fieldInputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-600 focus:border-brand-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100';

export default function UploadResume() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resume, setResume] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [form, setForm] = useState(null);

  // Load existing resume on mount
  useEffect(() => {
    loadResume();
  }, []);

  const loadResume = async () => {
    try {
      const response = await resumeAPI.getMyResume();
      setResume(response.data);
    } catch (error) {
      // No resume uploaded yet
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setFile(files[0]);
      setError('');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setError('Only PDF and DOCX files are allowed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await resumeAPI.upload(file);
      setResume(response.data);
      setSuccess('Resume uploaded successfully.');
      setFile(null);
      setEditing(false);

      setTimeout(() => {
        navigate('/matched-jobs');
      }, 1500);
    } catch (error) {
      setError(error.response?.data?.detail || 'Error uploading resume');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete your resume?')) return;

    try {
      await resumeAPI.deleteResume();
      setResume(null);
      setSuccess('Resume deleted successfully');
      setEditing(false);
    } catch (error) {
      setError('Error deleting resume');
    }
  };

  const startEditing = () => {
    setForm({
      skills: listToText(resume.skills),
      experience_years: resume.experience_years ?? '',
      education: resume.education || '',
      job_titles: listToText(resume.job_titles),
      languages: listToText(resume.languages),
      certifications: listToText(resume.certifications),
    });
    setEditError('');
    setEditing(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');

    try {
      const response = await resumeAPI.updateResume({
        skills: textToList(form.skills),
        experience_years: form.experience_years === '' ? null : parseInt(form.experience_years, 10),
        education: form.education.trim() || null,
        job_titles: textToList(form.job_titles),
        languages: textToList(form.languages),
        certifications: textToList(form.certifications),
      });
      setResume(response.data);
      setEditing(false);
      setSuccess('Resume details updated.');
    } catch (error) {
      setEditError(error.response?.data?.detail || 'Error saving changes');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-8 dark:text-gray-100">Upload your resume</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-10 text-center transition ${
              dragActive
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-950/30'
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
          >
            <p className="font-medium text-gray-900 mb-1 dark:text-gray-100">Drag and drop your resume</p>
            <p className="text-gray-400 text-sm mb-4 dark:text-gray-500">or</p>
            <label className="inline-block">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.docx"
                className="hidden"
              />
              <span className="px-4 py-2 bg-gray-900 text-white rounded-md cursor-pointer hover:bg-black font-medium text-sm dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
                Choose file
              </span>
            </label>
            <p className="text-xs text-gray-400 mt-4 dark:text-gray-500">PDF or DOCX, up to 10MB</p>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
              <p className="font-medium text-gray-900 text-sm dark:text-gray-100">{file.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)}MB</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-brand-50 border border-brand-200 text-brand-700 text-sm rounded-lg dark:bg-brand-950/40 dark:border-brand-900 dark:text-brand-400">
              {success}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full mt-4 py-3 bg-gray-900 text-white font-medium rounded-md hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            {loading ? 'Uploading…' : 'Upload resume'}
          </button>
        </div>

        {/* Resume Preview / Edit Section */}
        <div>
          {resume ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Your resume</h2>
                {!editing && (
                  <button
                    onClick={startEditing}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    Edit details
                  </button>
                )}
              </div>

              {editing ? (
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <p className="text-xs text-gray-500 -mt-2 mb-2 dark:text-gray-400">
                    Extraction isn't perfect &mdash; fix anything that's off. Separate multiple
                    entries with commas.
                  </p>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Skills</label>
                    <textarea
                      name="skills"
                      value={form.skills}
                      onChange={handleFormChange}
                      rows={3}
                      className={fieldInputClass}
                      placeholder="python, react, sql"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Years of experience</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      name="experience_years"
                      value={form.experience_years}
                      onChange={handleFormChange}
                      className={fieldInputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Education</label>
                    <input
                      type="text"
                      name="education"
                      value={form.education}
                      onChange={handleFormChange}
                      className={fieldInputClass}
                      placeholder="Bachelor's in Computer Science from ..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Job titles</label>
                    <input
                      type="text"
                      name="job_titles"
                      value={form.job_titles}
                      onChange={handleFormChange}
                      className={fieldInputClass}
                      placeholder="Software Engineer, Backend Developer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Languages</label>
                    <input
                      type="text"
                      name="languages"
                      value={form.languages}
                      onChange={handleFormChange}
                      className={fieldInputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Certifications</label>
                    <input
                      type="text"
                      name="certifications"
                      value={form.certifications}
                      onChange={handleFormChange}
                      className={fieldInputClass}
                    />
                  </div>

                  {editError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                      {editError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="flex-1 py-2 bg-gray-900 text-white font-medium text-sm rounded-md hover:bg-black disabled:opacity-50 transition dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                    >
                      {editSaving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-md hover:border-gray-300 transition dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">File</p>
                      <p className="font-medium text-gray-900 text-sm dark:text-gray-100">{resume.file_name}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Uploaded</p>
                      <p className="font-medium text-gray-900 text-sm dark:text-gray-100">
                        {new Date(resume.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-2 dark:text-gray-500">Extracted skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {resume.skills?.slice(0, 8).map((skill) => (
                          <SkillPill key={skill} skill={skill} />
                        ))}
                        {resume.skills?.length > 8 && (
                          <span className="text-gray-400 text-xs py-0.5 dark:text-gray-500">+{resume.skills.length - 8} more</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Experience</p>
                      <p className="font-medium text-gray-900 text-sm dark:text-gray-100">
                        {resume.experience_years ?? 0} year{resume.experience_years !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Education</p>
                      <p className="font-medium text-gray-900 text-sm dark:text-gray-100">{resume.education || 'Not specified'}</p>
                    </div>

                    {resume.certifications?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1 dark:text-gray-500">Certifications</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{resume.certifications.join(', ')}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-2 dark:border-gray-800">
                    <button
                      onClick={() => navigate('/matched-jobs')}
                      className="w-full py-2 bg-gray-900 text-white font-medium text-sm rounded-md hover:bg-black transition dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                    >
                      Find matching jobs
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full py-2 bg-white text-red-600 border border-red-200 font-medium text-sm rounded-md hover:bg-red-50 transition dark:bg-gray-900 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      Delete &amp; upload new
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-gray-200 rounded-lg p-10 text-center dark:border-gray-800">
              <p className="text-gray-500 text-sm dark:text-gray-400">Your resume will appear here after upload</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
