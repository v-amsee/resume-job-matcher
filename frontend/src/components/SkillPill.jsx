import { formatSkill } from '../utils/text';

// rounded filled pills so skills read as distinct chips, not just text
const VARIANTS = {
  default: 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300',
  matched: 'bg-brand-100 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-900/50 dark:text-brand-200 dark:ring-brand-800',
  missing: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function SkillPill({ skill, variant = 'default', className = '' }) {
  return (
    <span
      className={`inline-block max-w-full px-3 py-1 rounded-full text-xs font-medium break-words ${VARIANTS[variant] || VARIANTS.default} ${className}`}
    >
      {formatSkill(skill)}
    </span>
  );
}
