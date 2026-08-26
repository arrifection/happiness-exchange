/**
 * Temporary public-facing gates.
 *
 * The Delivery system is fully built (APIs, pages, admin tooling) but stays
 * hidden from normal users until the admin side is configured. Set
 * VITE_ENABLE_PUBLIC_DELIVERY=true to expose the public Delivery page again.
 */
export const PUBLIC_DELIVERY_ENABLED = import.meta.env.VITE_ENABLE_PUBLIC_DELIVERY === 'true'
