# Open Graph / Social Sharing Audit

Audit date: 2026-05-30  
Site: `https://www.happyexchange.net`

## Summary

**Status: PASS** — Social preview metadata uses a PNG image at the recommended 1200×630 size. No production HTML references the legacy SVG asset.

## Image asset

| Check | Result |
|---|---|
| Primary asset | `public/og-image.png` |
| Dimensions | **1200 × 630** (recommended OG size) |
| Format | **PNG** (`image/png`) |
| Public URL | `https://www.happyexchange.net/og-image.png` |
| HTTP status (live) | **200 OK** |
| Content-Type (live) | `image/png` |
| Legacy SVG | `public/og-image.svg` exists but is **not referenced** in HTML meta tags |

The PNG was generated via `scripts/generate_og_image.py` and is copied to `dist/` on build.

## Metadata (index.html)

| Tag | Value | Status |
|---|---|---|
| `og:type` | `website` | OK |
| `og:site_name` | Happiness Exchange | OK |
| `og:url` | `https://www.happyexchange.net/` | OK |
| `og:title` | Happiness Exchange \| Share & Receive Free Items | OK |
| `og:description` | Community item sharing (PK / SA) | OK |
| `og:image` | `https://www.happyexchange.net/og-image.png` | OK (PNG, not SVG) |
| `og:image:type` | `image/png` | OK |
| `og:image:width` | `1200` | OK |
| `og:image:height` | `630` | OK |
| `og:locale` | `en_US` | OK |
| `twitter:card` | `summary_large_image` | OK |
| `twitter:title` | (matches OG title) | OK |
| `twitter:description` | (matches OG description) | OK |
| `twitter:image` | `https://www.happyexchange.net/og-image.png` | OK |

Static legal pages (`privacy.html`, `terms.html`, `contact.html`) use the same PNG URL and Twitter card settings.

## SPA route metadata

`src/lib/siteMeta.js` centralizes page titles/descriptions and sets `OG_IMAGE_URL` to the PNG for client-side meta updates via `usePageMeta`.

## Platform compatibility

| Platform | Expected behavior | Notes |
|---|---|---|
| **WhatsApp** | Large link preview with PNG | Requires absolute HTTPS URL; PNG supported; 1200×630 ideal |
| **Facebook** | `og:image` preview | PNG + width/height tags help crawler |
| **LinkedIn** | Uses Open Graph | Same tags as Facebook |
| **Twitter / X** | `summary_large_image` | `twitter:image` matches `og:image` |
| **iMessage** | Link preview via OG | PNG URL must be publicly reachable (verified 200) |

### Why SVG was replaced

SVG in `og:image` is poorly supported by social crawlers and can carry script content. PNG is the safe, widely supported format for link previews.

## Actions taken

- **No image replacement required** — existing PNG meets spec and is live.
- **No code changes required** — meta tags already point to PNG with correct dimensions.
- Legacy `og-image.svg` retained in repo for design reference only; not used in production meta.

## Verification commands

```bash
# Local asset check
python -c "from PIL import Image; im=Image.open('public/og-image.png'); print(im.size, im.format)"

# Live HEAD check
curl -I https://www.happyexchange.net/og-image.png

# Automated audit
node scripts/audit-og-meta.mjs

# Build includes asset
npm run build && dir dist\\og-image.png
```

## Regenerating the image (optional)

```bash
python scripts/generate_og_image.py
npm run build
# Deploy frontend so Vercel serves updated PNG
```
