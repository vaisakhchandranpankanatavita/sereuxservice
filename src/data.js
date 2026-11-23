/* `price` stays a display string for existing pages; `from` is the numeric starting price used for sorting, filtering and estimates. */
export const serviceCategories = ['Repairs', 'Home care', 'Installation'];

export const services = [
  { name: 'Plumbing', description: 'Leaks, fittings and pipe repairs.', price: '₹500', from: 500, id: 1, category: 'Repairs', duration: 60, rating: 4.7, reviews: 214, terms: 'plumber pipes leak tap bathroom' },
  { name: 'Electrical', description: 'Repairs, fittings and installations.', price: '₹600', from: 600, id: 2, category: 'Repairs', duration: 60, rating: 4.8, reviews: 318, terms: 'electrician wiring lights fan' },
  { name: 'AC repair', description: 'Servicing, repairs and installation.', price: '₹800', from: 800, id: 3, category: 'Installation', duration: 90, rating: 4.6, reviews: 187, terms: 'air conditioning cooling maintenance installation' },
  { name: 'Carpentry', description: 'Furniture repairs and practical woodwork.', price: '₹700', from: 700, id: 4, category: 'Repairs', duration: 120, rating: 4.5, reviews: 96, terms: 'carpenter furniture woodwork custom' },
  { name: 'Painting', description: 'Interior and exterior painting.', price: '₹1,000', from: 1000, id: 5, category: 'Home care', duration: 240, rating: 4.6, reviews: 142, terms: 'painter interior exterior walls' },
  { name: 'Cleaning', description: 'Regular upkeep and deep cleaning.', price: '₹400', from: 400, id: 6, category: 'Home care', duration: 120, rating: 4.9, reviews: 402, terms: 'home cleaning deep clean house' },
  { name: 'Appliances', description: 'Repairs for the things you use every day.', price: '₹550', from: 550, id: 7, category: 'Repairs', duration: 60, rating: 4.4, reviews: 121, terms: 'appliance repair refrigerator washing machine microwave' },
  { name: 'Pest control', description: 'Treatment for common household pests.', price: '₹450', from: 450, id: 8, category: 'Home care', duration: 90, rating: 4.7, reviews: 88, terms: 'extermination insects bugs' },
];

/* The lists above are the offline fallback. loadCatalog() swaps in what the host serves (managed from the admin app),
   mutating the same arrays in place so every page that imported them sees the live data. */
const API = import.meta.env.VITE_API_URL || '/api';
const getJson = async (path) => { const r = await fetch(API + path); if (!r.ok) throw new Error(path); return r.json(); };

/* Admin-managed settings (support contacts, flags, FAQ) from /config; these defaults apply until the host answers. */
export const siteConfig = { 'content.supportEmail': '', 'content.supportPhone': '', 'content.termsUrl': '', 'content.privacyUrl': '', 'content.faq': [], 'rules.bookingSlots': ['09:00', '11:00', '13:00', '15:00', '17:00'], 'rules.maxDaysAhead': 60, 'flags.shopEnabled': true, 'flags.maintenanceMode': false, 'flags.maintenanceMessage': '' };

export async function loadCatalog() {
  const cfg = getJson('/config').then((c) => { if (c?.settings) { Object.assign(siteConfig, c.settings); const t = siteConfig['rules.bookingSlots']; if (Array.isArray(t) && t.length) slots.splice(0, slots.length, ...t); } }).catch(() => {});
  const [svc, prod, pros] = await Promise.allSettled([getJson('/services'), getJson('/products'), getJson('/providers')]);
  await cfg;
  if (pros.status === 'fulfilled' && Array.isArray(pros.value)) {
    providers.splice(0, providers.length, ...pros.value.map((p) => ({
      id: p.id, name: p.name, verified: p.verified, years: p.years, response: p.response,
      serviceIds: (p.services || []).map((x) => x.id), rating: 0, jobs: 0,
    })));
  }
  if (svc.status === 'fulfilled' && Array.isArray(svc.value) && svc.value.length) {
    services.splice(0, services.length, ...svc.value.map((s) => ({
      id: s.id, name: s.name, description: s.description, category: s.category, duration: s.duration, terms: s.terms ?? '',
      from: s.fromPrice, price: rupee(s.fromPrice), rating: s.rating ? Math.round(s.rating * 10) / 10 : 0, reviews: s.reviews ?? 0,
      image: s.imageVersion > 0 ? `${API}/services/${s.id}/image?v=${s.imageVersion}` : null,
    })));
    serviceCategories.splice(0, serviceCategories.length, ...new Set(services.map((s) => s.category)));
  }
  if (prod.status === 'fulfilled' && Array.isArray(prod.value) && prod.value.length) {
    products.splice(0, products.length, ...prod.value.map((p) => ({ id: p.id, img: p.img, name: p.name, seller: p.seller, price: p.price, old: p.oldPrice, category: p.category, blurb: p.blurb || undefined })));
  }
}

/* Bookable windows, shared by every service for now. */
export const slots = ['09:00', '11:00', '13:00', '15:00', '17:00'];

/* Same per-service photos the mobile app uses (mobile/assets/services), served from /assets/services. */
const SERVICE_IMG = {
  plumbing: '/assets/services/plumbing.png',
  electrical: '/assets/services/electrical.png',
  'ac repair': '/assets/services/ac-repair.png',
  carpentry: '/assets/services/carpentry.png',
  painting: '/assets/services/painting.png',
  cleaning: '/assets/services/cleaning.png',
  appliances: '/assets/services/appliances.png',
  'pest control': '/assets/services/pest-control.png',
};
/* Takes a service object (uses the image uploaded in the admin app when it has one) or just a name. */
export const serviceImg = (s) => {
  if (s && typeof s === 'object' && s.image) return s.image;
  const name = typeof s === 'string' ? s : s?.name ?? '';
  return SERVICE_IMG[name.trim().toLowerCase()] ?? SERVICE_IMG.cleaning;
};

export const categories = ['Electronics', 'Home & Kitchen', 'Fashion', 'Books', 'Sports & Outdoors', 'Food & Beverages'];

/* Images are placeholders until real product photos exist; categories now match what each product is. */
export const products = [
  { id: 7, img: '/assets/img/framed-art-and-books.webp', name: 'Garden Chickpea Salad', seller: "Jithu's Greens & More", price: 950, old: 1200, category: 'Food & Beverages' },
  { id: 6, img: '/assets/img/decor-vase-and-plant.webp', name: 'Simple Italian Salad', seller: "Jithu's Greens & More", price: 750, old: 900, category: 'Food & Beverages' },
  { id: 5, img: '/assets/img/potted-plant-right.webp', name: 'Caesar Salad', seller: "Jithu's Greens & More", price: 600, old: 800, category: 'Food & Beverages' },
  { id: 4, img: '/assets/img/potted-plant-left.webp', name: 'Penne Pasta Salad', seller: "Jithu's Greens & More", price: 800, old: 1200, category: 'Food & Beverages' },
  { id: 3, img: '/assets/img/cushions.webp', name: 'Crompton Surebreeze Sea Sapphira 1200 mm', seller: 'KV Electrical and Electronics stores', price: 1649, old: 2599, category: 'Electronics' },
  { id: 2, img: '/assets/img/tool-bag.webp', name: 'Bajaj Classico Sleek Plus 5S 1200MM (48")', seller: 'KV Electrical and Electronics stores', price: 2599, old: 5400, category: 'Electronics' },
  { id: 1, img: '/assets/img/floor-lamp.webp', name: 'Tubelight', seller: 'KV Electrical and Electronics stores', price: 350, old: 550, category: 'Electronics', blurb: '15W Philips.' },
];

/* YYYY-MM-DD in the visitor's local time (toISOString would give the UTC date, a day off near midnight). */
export const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const rupee = (n) => '₹' + n.toLocaleString('en-IN');
export const discount = (p) => Math.round((1 - p.price / p.old) * 100);

/* Professionals come from the host (/providers); empty until loaded or when none have joined. */
export const providers = [];
