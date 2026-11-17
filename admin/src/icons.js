/* Lordicon (https://lordicon.com) animated icon keys — all verified free ("premium: false") via
   their public /api/library/icons search. Referenced as https://cdn.lordicon.com/<key>.json. */
export const ICONS = {
  dashboard: 'vvkusrbh',   // Grid Bento
  bookings: 'uphbloed',    // Calendar
  orders: 'qfijwmqj',      // Shopping Basket
  users: 'jdgfsfzr',       // Avatars Chatting
  services: 'fwkrbvja',    // Wrench
  pros: 'zhiiqoue',        // Briefcase
  products: 'rezibkiy',    // Wooden Box
  coupons: 'dkobpcrm',     // Sale Tag
  banners: 'kezeezyg',     // Gift
  inbox: 'vpbspaec',       // Mail Fast
  auditLog: 'hmpomorl',    // Document

  bell: 'apmrcxtj',        // Mail Open Bell
  avatar: 'kdduutaw',      // Avatar
  logout: 'vfiwitrm',      // Exit Sign
  search: 'wjyqkiew',      // Magnifier

  chartGrow: 'lbcxnxti',   // Bar Chart Vertical Grow
  chartBars: 'oqhqyeud',   // Bar Chart Vertical
  coins: 'bsdkzyjd',       // Coins
  star: 'cvwrvyjv',        // Star
  check: 'lvrxlmju',       // Check
  clock: 'warimioc',       // Clock
  trophy: 'wjdlpfml',      // Badge Ribbon
  chat: 'fqbvgezn',        // Avatars Message Plus
};

export const iconSrc = (key) => `https://cdn.lordicon.com/${key}.json`;

/* Mirrors the CSS --c1..--c10 palette in styles.css (lord-icon's `colors` attribute needs literal
   hex, not a CSS var reference). */
export const HUES = {
  c1: '#232323', c2: '#b8691a', c3: '#1f8a5b', c4: '#b8468f', c5: '#3a6fd0',
  c6: '#8f7a0a', c7: '#1b8f84', c8: '#c94a34', c9: '#5a56d6', c10: '#6b6862', c11: '#1a8fa3',
};
