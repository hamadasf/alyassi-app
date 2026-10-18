// Company settings — edit here and rebuild to change them in the app.
export const SITE = 'https://omaralyassirealestate.com';

export const CONTACT = {
  phone: '+97167442027',           // زر الاتصال
  phoneLabel: '06 744 2027',
  office: '+971568080655',         // هاتف المكتب (صفحة تواصل)
  officeLabel: '056 808 0655',
  whatsapp: '971568080655',        // واتساب (بدون +)
  whatsappLabel: '056 808 0655',
  email: 'omaralyassi.realestate@gmail.com',
  address: 'الشارقة، شارع مليحة، مكتب رقم 2',
  instagram: 'https://www.instagram.com/omaralyassi.uae3',
  facebook: 'https://www.facebook.com/profile.php?id=61590477670523',
};

export const APP_URL = 'https://hamadasf.github.io/alyassi-app/';
export const CHANGES_URL = APP_URL + 'changes.json';   // price / status changes, updated every few minutes

export const LOGO = './assets/logo.png';     // added at build time from the website
export const EMBLEM = './assets/emblem.png';

// How long cached data is trusted before it is refreshed in the background.
export const TTL = {
  index: 6 * 3600e3,       // list of projects
  plan: 7 * 24 * 3600e3,   // plot sizes & types of a project (rarely change)
  state: 0,                // availability & prices — refreshed on every open
};

// Default plot types used by plans that do not define their own (same as the website plan viewer).
export const DEFAULT_TYPES = {
  magenta: { use: 'تجاري سكني', floors: 'أرضي + اثنين', loc: 'عادية', b: 'reg', c: [255, 20, 147] },
  gold:    { use: 'تجاري سكني', floors: 'أرضي + اثنين', tag: 'زاوية', loc: 'زاوية', b: 'cor', c: [218, 165, 32] },
  yellow:  { use: 'تجاري سكني', floors: 'أرضي + اثنين', tag: 'زاوية', loc: 'زاوية', b: 'cor', c: [255, 255, 0] },
  khaki:   { use: 'تجاري سكني', floors: 'أرضي + اثنين', loc: 'عادية', b: 'reg', c: [240, 230, 140] },
  salmon:  { use: 'تجاري مكاتب سكني', floors: 'أرضي + اثنين', tag: 'زاوية', loc: 'زاوية', b: 'cor', c: [240, 128, 128] },
  darkred: { use: 'تجاري مكاتب سكني', floors: 'أرضي + اثنين', loc: 'عادية', b: 'reg', c: [178, 34, 34] },
  red:     { use: 'محلات تجارية', floors: 'أرضي فقط', c: [255, 0, 0] },
};
