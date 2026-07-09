import { useState, useRef, useEffect } from 'react';

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-600 focus:border-brand-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100';

// Checkbox dropdown for filter bars. A plain <details> looked right but
// only closes when you click its own summary again -- clicking anywhere
// else on the page left it hanging open on top of the results below it.
export default function MultiSelectDropdown({ label, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="min-w-[160px] relative" ref={containerRef}>
      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${fieldClass} text-left flex items-center justify-between`}
      >
        <span>{selected.length ? `${selected.length} selected` : 'Any'}</span>
        <span className="text-gray-400">&#9662;</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg p-2 max-h-60 overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          {options.map(({ value, label: optionLabel }) => (
            <label
              key={value}
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-600"
              />
              {optionLabel}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
