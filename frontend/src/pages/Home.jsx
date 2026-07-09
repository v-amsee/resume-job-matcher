import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    title: 'Upload your resume',
    body: 'Upload a PDF or DOCX resume and we automatically extract your skills, experience, and education.',
  },
  {
    title: 'Get matched',
    body: 'Our algorithm scores every open role against your profile, based on required skills, experience level, and bonus skills.',
  },
  {
    title: 'Apply and track',
    body: 'Apply directly, save roles for later, and track every application status in one place.',
  },
];

const BENEFITS = [
  {
    title: 'Fast',
    body: 'Get matched with relevant roles in seconds, not days.',
  },
  {
    title: 'Transparent scoring',
    body: 'See exactly which skills matched and which are missing before you apply.',
  },
  {
    title: 'Organized',
    body: 'Save roles and track every application status from a single dashboard.',
  },
  {
    title: 'Real listings, one place',
    body: 'We pull live roles from Remotive, RemoteOK, Arbeitnow and more, so you\'re not stuck browsing a dozen tabs.',
  },
];

export default function Home({ user, onLoginClick }) {
  const navigate = useNavigate();

  if (user) {
    navigate('/matched-jobs', { replace: true });
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
              Find the right role, faster.
            </h1>
            <p className="text-lg text-gray-300 mb-10 leading-relaxed">
              Upload your resume once. We match you to open roles based on your
              actual skills and experience, and show you exactly how you stack up.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onLoginClick}
                className="px-6 py-3 bg-white text-gray-900 font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                Get started
              </button>
              <button
                className="px-6 py-3 border border-gray-600 text-white font-medium rounded-md hover:border-gray-400 transition-colors"
                onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
              >
                See how it works
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="py-24 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-600 mb-3 dark:text-brand-400">
            How it works
          </h2>
          <p className="text-3xl font-semibold text-gray-900 mb-16 max-w-xl tracking-tight dark:text-gray-100">
            Three steps between your resume and your next role.
          </p>

          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="text-sm font-semibold text-gray-400 mb-3 dark:text-gray-600">0{i + 1}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed dark:text-gray-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-gray-50 py-24 border-b border-gray-100 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-center mb-16 text-gray-900 tracking-tight dark:text-gray-100">
            Why ResumeMatch
          </h2>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex gap-4">
                <div className="flex-shrink-0 w-1.5 rounded-full bg-brand-600 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 dark:text-gray-100">{benefit.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{benefit.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-3xl font-semibold mb-6 text-gray-900 tracking-tight dark:text-gray-100">
            Ready to find your next role?
          </h2>
          <button
            onClick={onLoginClick}
            className="px-8 py-3 bg-gray-900 text-white font-medium rounded-md hover:bg-black transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Create a free account
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-gray-400 py-8 border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} ResumeMatch. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
