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
  '/': DEFAULT_META,
  '/browse': {
    title: 'Browse Free Items | Happiness Exchange',
    description:
      'Browse free items shared by your community in Pakistan and Saudi Arabia. Request what you need with dignity.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/browse`,
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
    title: 'Login | Happiness Exchange',
    description: 'Sign in to Happiness Exchange to give, request, and coordinate free item sharing.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/login`,
  },
  '/signup': {
    title: 'Sign Up | Happiness Exchange',
    description: 'Create your Happiness Exchange account and join the giving community.',
    image: OG_IMAGE_URL,
    url: `${SITE_URL}/signup`,
  },
}

export function getPageMeta(pathname) {
  return PAGE_META[pathname] || DEFAULT_META
}
