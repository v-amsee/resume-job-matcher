import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only force a redirect if we actually had a session that got rejected
    // (expired/invalid token). Now that some pages work without logging in,
    // an anonymous request hitting a protected endpoint also comes back as
    // 401 -- that's expected there, not a reason to boot someone browsing
    // without an account back to the homepage.
    if (error.response?.status === 401 && localStorage.getItem('access_token')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// FastAPI 422s return `detail` as a list of {loc, msg, type} objects, not a
// string like every other error path -- use this instead of reading
// error.response.data.detail directly if you just want one readable line.
export function extractErrorMessage(error, fallback = 'Something went wrong') {
  const detail = error?.response?.data?.detail;
  if (!detail) return error?.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'string' ? d : d.msg))
      .filter(Boolean)
      .join('; ') || fallback;
  }
  return fallback;
}

// Auth API
export const authAPI = {
  register: (email, password, name, userType = 'job_seeker', company = null) =>
    api.post('/auth/register', { email, password, name, user_type: userType, company }),
  
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  googleLogin: (credential) =>
    api.post('/auth/google', { credential }),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),

  getMe: () =>
    api.get('/auth/me'),
  
  updateProfile: (name, company) =>
    api.put('/auth/profile', { name, company }),
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }
};

// Resume API
export const resumeAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/resumes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  getMyResume: () =>
    api.get('/resumes/my-resume'),
  
  getResume: (resumeId) =>
    api.get(`/resumes/${resumeId}`),

  updateResume: (data) =>
    api.put('/resumes/my-resume', data),

  deleteResume: () =>
    api.delete('/resumes/my-resume')
};

// Jobs API
export const jobsAPI = {
  create: (jobData) =>
    api.post('/jobs/', jobData),
  
  getAll: (page = 1, limit = 20, filters = {}) => {
    const params = new URLSearchParams({ page, limit, ...filters });
    return api.get(`/jobs/?${params}`);
  },
  
  getById: (jobId) =>
    api.get(`/jobs/${jobId}`),

  getMyJobs: () =>
    api.get('/jobs/my-jobs'),

  update: (jobId, jobData) =>
    api.put(`/jobs/${jobId}`, jobData),
  
  delete: (jobId) =>
    api.delete(`/jobs/${jobId}`),
  
  getApplications: (jobId) =>
    api.get(`/jobs/${jobId}/applications`)
};

// Applications API
export const applicationsAPI = {
  create: (jobId, resumeId) =>
    api.post('/applications/', { job_id: jobId, resume_id: resumeId }),
  
  getMyApplications: () =>
    api.get('/applications/my-applications'),
  
  getById: (applicationId) =>
    api.get(`/applications/${applicationId}`),
  
  update: (applicationId, data) =>
    api.put(`/applications/${applicationId}`, data),
  
  withdraw: (applicationId) =>
    api.delete(`/applications/${applicationId}`),
  
  scheduleInterview: (applicationId, interviewDate, interviewLink) =>
    api.post(`/applications/${applicationId}/schedule-interview`, {
      interview_date: interviewDate,
      interview_link: interviewLink
    })
};

// Matching API
export const matchingAPI = {
  getMatchedJobs: () =>
    api.get('/matching/jobs'),
  
  getMatchedCandidates: (jobId) =>
    api.get(`/matching/candidates/${jobId}`),
  
  saveJob: (jobId) =>
    api.post(`/matching/jobs/${jobId}/save`),
  
  unsaveJob: (jobId) =>
    api.delete(`/matching/jobs/${jobId}/save`),
  
  getSavedJobs: () =>
    api.get('/matching/saved-jobs')
};

export default api;
