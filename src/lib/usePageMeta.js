import { useEffect } from 'react'

function upsertMeta(attr, key, value) {
  if (!value) return
  let element = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', value)
}

function upsertLink(rel, href) {
  if (!href) return
  let element = document.head.querySelector(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

export function applyPageMeta(meta) {
  if (!meta) return

  document.title = meta.title
  upsertMeta('name', 'description', meta.description)
  upsertLink('canonical', meta.url)

  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:site_name', 'Happiness Exchange')
  upsertMeta('property', 'og:title', meta.title)
  upsertMeta('property', 'og:description', meta.description)
  upsertMeta('property', 'og:image', meta.image)
  upsertMeta('property', 'og:image:type', 'image/png')
  upsertMeta('property', 'og:image:width', '1200')
  upsertMeta('property', 'og:image:height', '630')
  upsertMeta('property', 'og:url', meta.url)
  upsertMeta('property', 'og:locale', 'en_US')

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', meta.title)
  upsertMeta('name', 'twitter:description', meta.description)
  upsertMeta('name', 'twitter:image', meta.image)
}

export function usePageMeta(meta) {
  useEffect(() => {
    applyPageMeta(meta)
  }, [meta])
}
