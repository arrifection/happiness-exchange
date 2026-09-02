export const SITE_URL = 'https://www.happyexchange.net'
export const OG_IMAGE_URL = `${SITE_URL}/og-image.png`
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const SITE_NAME = 'Happiness Exchange'

export const DEFAULT_META = {
  title: 'Happiness Exchange | Share & Receive Free Items',
  description:
    'Give what you don\'t need. Receive what you do. A trusted community platform for free item sharing in Pakistan and Saudi Arabia.',
  image: OG_IMAGE_URL,
  url: `${SITE_URL}/`,
}

export const PAGE_META = {
  '/': {
    title: 'HappinessExchange — Give & Get Happiness',
    description: DEFAULT_META.description,
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/`,
  },
  '/browse': {
    title: 'Browse Items — HappinessExchange',
    description:
      'Browse free items shared by your community in Pakistan and Saudi Arabia. Request what you need with dignity.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/browse`,
  },
  '/dashboard': {
    title: 'Dashboard — HappinessExchange',
    description: 'View your listings, requests, and community activity on Happiness Exchange.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/dashboard`,
  },
  '/profile': {
    title: 'Profile — HappinessExchange',
    description: 'Manage your Happiness Exchange profile, WhatsApp number, and account settings.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/profile`,
  },
  '/deliveries': {
    title: 'Deliveries — HappinessExchange',
    description: 'Track your Happiness Exchange deliveries and shipment status.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/deliveries`,
  },
  '/give': {
    title: 'Give an Item — HappinessExchange',
    description: 'List an item to give away or exchange on Happiness Exchange.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/give`,
  },
  '/requests': {
    title: 'Activity — HappinessExchange',
    description: 'View your requests, offers, and exchange activity.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/requests`,
  },
  '/needs': {
    title: 'Needs Board — HappinessExchange',
    description: 'Browse community needs and help others on Happiness Exchange.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/needs`,
  },
  '/swaps': {
    title: 'Exchange — HappinessExchange',
    description: 'Manage your swap offers and exchanges on Happiness Exchange.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/swaps`,
  },
  '/reputation': {
    title: 'Reputation — HappinessExchange',
    description: 'View your trust score and community reputation.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/reputation`,
  },
  '/privacy': {
    title: 'Privacy Policy | Happiness Exchange',
    description:
      'How Happiness Exchange collects, uses, and protects your information in Pakistan and Saudi Arabia.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/privacy`,
  },
  '/terms': {
    title: 'Terms of Use | Happiness Exchange',
    description:
      'Rules for using Happiness Exchange safely and respectfully in our giving community.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/terms`,
  },
  '/contact': {
    title: 'Contact Us | Happiness Exchange',
    description:
      'Reach the Happiness Exchange team for support, safety reports, or partnership inquiries.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/contact`,
  },
  '/login': {
    title: 'Login — HappinessExchange',
    description: 'Sign in to Happiness Exchange to give, request, and coordinate free item sharing.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/login`,
  },
  '/signup': {
    title: 'Create Account — HappinessExchange',
    description: 'Create your Happiness Exchange account and join the giving community.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/signup`,
  },
  '/check-email': {
    title: 'Check Your Email — HappinessExchange',
    description: 'Verify your Happiness Exchange account from your inbox.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/check-email`,
  },
  '/verify-email': {
    title: 'Verify Email — HappinessExchange',
    description: 'Complete your Happiness Exchange email verification.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/verify-email`,
  },
}

const PREFIX_META = [
  { prefix: '/items/', title: 'Item Details — HappinessExchange' },
  { prefix: '/exchange/', title: 'Exchange — HappinessExchange' },
  { prefix: '/tracking/', title: 'Track Delivery — HappinessExchange' },
]

export function getPageMeta(pathname) {
  if (PAGE_META[pathname]) {
    return PAGE_META[pathname]
  }

  const prefixMatch = PREFIX_META.find((entry) => pathname.startsWith(entry.prefix))
  if (prefixMatch) {
    return {
      title: prefixMatch.title,
      description: DEFAULT_META.description,
      image: OG_IMAGE_URL,
      url: `${SITE_URL}${pathname}`,
    }
  }

  return DEFAULT_META
}
