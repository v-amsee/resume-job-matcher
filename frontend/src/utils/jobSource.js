// Display labels for Job.source / Job.sponsorship values coming back from
// the API. Kept in one place so every card/detail view stays in sync.

export const SOURCE_LABELS = {
  internal: null,
  remotive: 'Remotive',
  remoteok: 'RemoteOK',
  arbeitnow: 'Arbeitnow',
  weworkremotely: 'We Work Remotely',
  workingnomads: 'Working Nomads',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  adzuna: 'Adzuna',
  reed: 'Reed',
  jooble: 'Jooble',
};

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || null;
}

// Sources actually being synced right now, for the "jobs sourced from..."
// banner. Separate from SOURCE_LABELS since Adzuna/Reed/Jooble are wired in
// code but need an API key (see .env.example) to actually pull anything --
// add them here once you've confirmed a sync with real keys works.
export const ACTIVE_SOURCE_LABELS = [
  'Remotive',
  'RemoteOK',
  'Arbeitnow',
  'We Work Remotely',
  'Working Nomads',
  'Greenhouse',
  'Lever',
  'Ashby',
];

// sponsorship is a heuristic read on what the posting's own text says --
// not_mentioned (the common case) renders no badge at all.
export const SPONSORSHIP_BADGES = {
  sponsors: { text: 'Sponsors visa', className: 'bg-brand-50 text-brand-700' },
  may_sponsor: { text: 'May sponsor', className: 'bg-amber-50 text-amber-700' },
  unlikely: { text: 'Unlikely to sponsor', className: 'bg-gray-100 text-gray-500' },
  not_mentioned: null,
};

export function sponsorshipBadge(sponsorship) {
  return SPONSORSHIP_BADGES[sponsorship] || null;
}
