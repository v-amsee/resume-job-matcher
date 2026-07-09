// Skills are stored lowercase in the DB (the matcher does exact-match
// comparisons on them), but "python"/"aws"/"c++" look sloppy in the UI.
// Maps the vocabulary from backend/services/nlp_extractor.py's
// SKILLS_DATABASE to how it should actually display.
const SKILL_CASING = {
  // Programming languages
  python: 'Python', javascript: 'JavaScript', java: 'Java', 'c++': 'C++',
  'c#': 'C#', go: 'Go', rust: 'Rust', php: 'PHP', ruby: 'Ruby',
  swift: 'Swift', kotlin: 'Kotlin', typescript: 'TypeScript', scala: 'Scala',
  r: 'R', matlab: 'MATLAB',
  // Frontend
  react: 'React', 'vue.js': 'Vue.js', angular: 'Angular', svelte: 'Svelte',
  html: 'HTML', css: 'CSS', sass: 'Sass', tailwind: 'Tailwind',
  bootstrap: 'Bootstrap', webpack: 'Webpack', vite: 'Vite',
  'next.js': 'Next.js', 'nuxt.js': 'Nuxt.js',
  // Backend
  'node.js': 'Node.js', django: 'Django', flask: 'Flask', fastapi: 'FastAPI',
  spring: 'Spring', 'express.js': 'Express.js', rails: 'Rails',
  laravel: 'Laravel', 'asp.net': 'ASP.NET', 'asp.net core': 'ASP.NET Core',
  gin: 'Gin',
  // Databases
  postgresql: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB', redis: 'Redis',
  elasticsearch: 'Elasticsearch', dynamodb: 'DynamoDB', cassandra: 'Cassandra',
  firestore: 'Firestore', oracle: 'Oracle', 'sql server': 'SQL Server',
  // DevOps
  docker: 'Docker', kubernetes: 'Kubernetes', aws: 'AWS', gcp: 'GCP',
  azure: 'Azure', jenkins: 'Jenkins', 'gitlab ci': 'GitLab CI',
  'github actions': 'GitHub Actions', terraform: 'Terraform', ansible: 'Ansible',
  // ML/AI
  tensorflow: 'TensorFlow', pytorch: 'PyTorch', 'scikit-learn': 'Scikit-learn',
  pandas: 'Pandas', numpy: 'NumPy', opencv: 'OpenCV', keras: 'Keras',
  nlp: 'NLP', 'machine learning': 'Machine Learning', 'deep learning': 'Deep Learning',
  // Other
  git: 'Git', 'rest api': 'REST API', graphql: 'GraphQL',
  microservices: 'Microservices', agile: 'Agile', scrum: 'Scrum', jira: 'Jira',
  linux: 'Linux', unix: 'Unix', windows: 'Windows', macos: 'macOS',
};

// Falls back to capitalizing each word for anything not in the map above,
// so a skill added to the backend later doesn't just print lowercase.
export function formatSkill(skill) {
  if (!skill) return '';
  const key = skill.toLowerCase().trim();
  if (SKILL_CASING[key]) return SKILL_CASING[key];

  return key
    .split(' ')
    .map((word) => (SKILL_CASING[word] ? SKILL_CASING[word] : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}
