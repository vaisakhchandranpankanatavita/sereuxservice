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
  c1: '#6d5efc', c2: '#ff9f43', c3: '#1ec28b', c4: '#ff6fa0', c5: '#3aa0ff',
  c6: '#e0ab2e', c7: '#18b3b3', c8: '#ff6b57', c9: '#9b6bff', c10: '#64748b',
};
