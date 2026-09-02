import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import BrowseItemsPage from './pages/BrowseItemsPage.jsx'
import AuthenticatedHomePage from './pages/AuthenticatedHomePage.jsx'
import MessagingDisabledPage from './pages/MessagingDisabledPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import GiveItemPage from './pages/GiveItemPage.jsx'
import NeedsBoardPage from './pages/NeedsBoardPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ItemDetailsPage from './pages/ItemDetailsPage.jsx'
import ItemListedSuccessPage from './pages/ItemListedSuccessPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ReputationPage from './pages/ReputationPage.jsx'
import RequestsPage from './pages/RequestsPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import CheckYourEmailPage from './pages/CheckYourEmailPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import ExchangeTransactionPage from './pages/ExchangeTransactionPage.jsx'
import ExchangeOffersPage from './pages/ExchangeOffersPage.jsx'
import ShipmentTrackingPage from './pages/ShipmentTrackingPage.jsx'
import MyDeliveriesPage from './pages/MyDeliveriesPage.jsx'
import DeliveryComingSoonPage from './pages/DeliveryComingSoonPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RequestItemModal from './components/RequestItemModal.jsx'
import ProposeSwapModal from './components/ProposeSwapModal.jsx'
import BrandLogo from './components/BrandLogo.jsx'
import FlashBanner from './components/FlashBanner.jsx'
import BackendWakeupBanner from './components/BackendWakeupBanner.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import { ReviewModal } from './components/reputation.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import AppBootSkeleton from './components/AppBootSkeleton.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import { Button, Surface } from './components/ui.jsx'
import { NotificationProvider } from './components/NotificationContext.jsx'
import {
  parseApiErrorDetail,
  setResendCooldown,
  syncResendCooldownFromSeconds,
} from './lib/verificationResend.js'
import { resolveApiBase, asArray } from './lib/api.js'
import {
  fetchWithBootstrapRetry,
  isServerStartingErrorMessage,
  SERVER_STARTING_MESSAGE,
} from './lib/bootstrapFetch.js'
import { getPageMeta } from './lib/siteMeta.js'
import { usePageMeta } from './lib/usePageMeta.js'
import { buildItemsQueryParams, DEFAULT_COUNTRY, readLocationPreferences, writeLocationPreferences } from './lib/locations.js'
import { userNeedsWhatsApp, WHATSAPP_REQUIRED_MESSAGE } from './lib/whatsappRequirement.js'
import { supportsExchange, supportsGiveaway } from './lib/listingMode.js'
import { PUBLIC_DELIVERY_ENABLED } from './lib/featureFlags.js'
import LocalDemoBar from './components/LocalDemoBar.jsx'

const API_BASE = resolveApiBase()
const STATUS_ENDPOINT = `${API_BASE}/api/status`
const ME_ENDPOINT = `${API_BASE}/api/me`
const ITEMS_ENDPOINT = `${API_BASE}/api/items`
const ITEM_IMAGE_UPLOAD_ENDPOINT = `${API_BASE}/api/items/upload-image`
const MY_ITEMS_ENDPOINT = `${API_BASE}/api/items/my`
const MY_REQUESTS_ENDPOINT = `${API_BASE}/api/requests/my`
const MY_REPUTATION_ENDPOINT = `${API_BASE}/api/me/reputation`
const REVIEWS_ENDPOINT = `${API_BASE}/api/reviews`
const NEED_REQUESTS_ENDPOINT = `${API_BASE}/api/need-requests`
const TOKEN_KEY = 'happiness_exchange_token'
const AUTH_FLOW_PATHS = ['/verify-email', '/check-email', '/login', '/signup']
const AUTH_PAGE_PATTERN = /^\/(login|signup)\/?$/
const MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024

function isAuthPagePath(pathname) {
  return AUTH_PAGE_PATTERN.test(pathname)
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

const emptyItemForm = {
  title: '',
  description: '',
  category: '',
  condition: '',
  location: '',
  country: DEFAULT_COUNTRY,
  city: '',
  area: '',
  latitude: null,
  longitude: null,
  location_source: 'manual',
  location_display: '',
  expiry_date: '',
  sealed_packaging: false,
  storage_condition: '',
  image_url: '',
  owner_name: '',
  listing_mode: 'GIVEAWAY',
}

function formatApiError(errorData, fallbackMessage) {
  const detail = errorData?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const readableIssues = detail
      .map((issue) => {
        if (typeof issue === 'string') return issue
        const fieldPath = Array.isArray(issue?.loc) ? issue.loc.slice(1).join(' ') : ''
        const message = typeof issue?.msg === 'string' ? issue.msg : ''
        return [fieldPath, message].filter(Boolean).join(': ')
      })
      .filter(Boolean)
    if (readableIssues.length > 0) return readableIssues.join(' ')
  }
  if (detail && typeof detail === 'object' && typeof detail.msg === 'string' && detail.msg.trim()) return detail.msg
  return fallbackMessage
}

export default function App() {
  const location = useLocation()
  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname])
  usePageMeta(pageMeta)
  const navigate = useNavigate()
  const [showSplash, setShowSplash] = useState(false)
  const [token, setToken] = useState(() => readStoredToken())
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [loadingUser, setLoadingUser] = useState(() => Boolean(readStoredToken()))

  const [items, setItems] = useState([])
  const [itemsPagination, setItemsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
    next_cursor: null,
    has_more: false,
  })
  const [loadingItems, setLoadingItems] = useState(true)
  const [loadingMoreItems, setLoadingMoreItems] = useState(false)
  const [itemsError, setItemsError] = useState('')

  const [myItems, setMyItems] = useState([])
  const [loadingMyItems, setLoadingMyItems] = useState(false)
  const [myItemsError, setMyItemsError] = useState('')
  const [ownerItemsMessage, setOwnerItemsMessage] = useState('')
  const [ownerItemsError, setOwnerItemsError] = useState('')
  const [ownerActionItemId, setOwnerActionItemId] = useState('')

  const [itemForm, setItemForm] = useState({ ...emptyItemForm })
  const [creatingItem, setCreatingItem] = useState(false)
  const [uploadingItemImage, setUploadingItemImage] = useState(false)
  const [itemMessage, setItemMessage] = useState('')
  const [itemError, setItemError] = useState('')
  const [imageUploadMessage, setImageUploadMessage] = useState('')
  const [imageUploadError, setImageUploadError] = useState('')
  const [lastPublishedItem, setLastPublishedItem] = useState(null)

  const [myRequests, setMyRequests] = useState([])
  const [ownerRequests, setOwnerRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsMessage, setRequestsMessage] = useState('')
  const [requestsError, setRequestsError] = useState('')
  const [cancelPendingRequestId, setCancelPendingRequestId] = useState('')
  const [requestModalItem, setRequestModalItem] = useState(null)
  const [swapModalItem, setSwapModalItem] = useState(null)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestSubmitError, setRequestSubmitError] = useState('')

  const [profileUpdating, setProfileUpdating] = useState(false)
  const [whatsappUpdating, setWhatsappUpdating] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [whatsappError, setWhatsappError] = useState('')
  const [countryUpdating, setCountryUpdating] = useState(false)
  const [countryMessage, setCountryMessage] = useState('')
  const [countryError, setCountryError] = useState('')
  const [accountDeleting, setAccountDeleting] = useState(false)
  const [accountDeleteError, setAccountDeleteError] = useState('')

  const [myReputation, setMyReputation] = useState(null)
  const [loadingReputation, setLoadingReputation] = useState(false)
  const [reputationError, setReputationError] = useState('')
  const [profileReviews, setProfileReviews] = useState([])
  const [loadingProfileReviews, setLoadingProfileReviews] = useState(false)
  const [profileReviewsError, setProfileReviewsError] = useState('')

  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewModalState, setReviewModalState] = useState(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [localCountry, setLocalCountry] = useState(DEFAULT_COUNTRY)
  const userLoadGeneration = useRef(0)


  const [needRequests, setNeedRequests] = useState([])
  const [loadingNeedRequests, setLoadingNeedRequests] = useState(true)
  const [needRequestsError, setNeedRequestsError] = useState('')
  const [needRequestsMessage, setNeedRequestsMessage] = useState('')
  const [creatingNeedRequest, setCreatingNeedRequest] = useState(false)
  const [needActionPendingId, setNeedActionPendingId] = useState('')

  const isAuthPage = isAuthPagePath(location.pathname)
  const isMarketingHome = !currentUser && location.pathname === '/'
  const showAppChrome = !isAuthPage && (Boolean(currentUser) || location.pathname !== '/')

  useEffect(() => {
    const root = document.documentElement
    if (isAuthPage) {
      root.classList.add('he-auth-page')
    } else {
      root.classList.remove('he-auth-page')
    }
    return () => root.classList.remove('he-auth-page')
  }, [isAuthPage])

  useEffect(() => {
    loadItems(readLocationPreferences(), { bootstrap: true })
    loadNeedRequests('open', { bootstrap: true })
  }, [])

  useEffect(() => {
    if (!itemsError || loadingItems) return
    if (!isServerStartingErrorMessage(itemsError)) return

    const timer = window.setTimeout(() => {
      loadItems(readLocationPreferences())
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [itemsError, loadingItems])

  useEffect(() => {
    if (!needRequestsError || loadingNeedRequests) return
    if (!isServerStartingErrorMessage(needRequestsError)) return

    const timer = window.setTimeout(() => {
      loadNeedRequests('open')
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [needRequestsError, loadingNeedRequests])

  useEffect(() => {
    if (!token || currentUser || !authError) return
    if (!isServerStartingErrorMessage(authError)) return

    const timer = window.setTimeout(() => {
      loadUserData()
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [token, currentUser, authError])

  useEffect(() => {
    if (token) loadUserData()
    else setCurrentUser(null)
  }, [token])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && token) {
        refreshCurrentUser()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [token])

  useEffect(() => {
    if (currentUser) {
      loadItems(readLocationPreferences()) // Also reload public items when user changes to get fresh state
      loadMyItems()
      loadRequestData()
      loadMyReputation()
      loadProfileReviews(currentUser.id)
      setItemForm((c) => ({ ...c, owner_name: c.owner_name || currentUser.name }))
    }
  }, [currentUser])

  async function refreshCurrentUser() {
    if (!token) return
    try {
      const res = await fetch(ME_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setCurrentUser(data)
    } catch {
      /* silent — verify page still shows success */
    }
  }

  async function loadUserData() {
    const generation = userLoadGeneration.current
    setLoadingUser(true)
    setAuthError('')

    try {
      const res = await fetchWithBootstrapRetry(ME_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (generation !== userLoadGeneration.current) return

      if (res.ok) {
        setCurrentUser(data)
        return
      }

      if (res.status === 401 || res.status === 403) {
        handleLogout()
        setAuthError(formatApiError(data, 'Session expired. Please log in again.'))
        return
      }

      setAuthError(formatApiError(data, 'Could not load your profile.'))
    } catch {
      if (generation !== userLoadGeneration.current) return
      setAuthError(`${SERVER_STARTING_MESSAGE} Your session is saved — we'll keep trying.`)
    } finally {
      if (generation === userLoadGeneration.current) setLoadingUser(false)
    }
  }

  async function loadItems(locationPrefs, options = {}) {
    const append = Boolean(options.append)
    if (append) {
      setLoadingMoreItems(true)
    } else {
      setLoadingItems(true)
    }
    setItemsError('')
    try {
      const prefs = locationPrefs || readLocationPreferences()
      const params = buildItemsQueryParams(prefs)
      const limit = options.limit || 20
      params.set('limit', String(limit))

      if (append && options.cursor) {
        params.set('cursor', String(options.cursor))
      } else {
        const page = options.page || 1
        params.set('page', String(page))
      }

      if (options.status === 'all') {
        params.set('status', '')
      } else if (options.status) {
        params.set('status', String(options.status).toLowerCase())
      }
      const url = `${ITEMS_ENDPOINT}?${params.toString()}`
      const res = options.bootstrap
        ? await fetchWithBootstrapRetry(url)
        : await fetch(url)
      let data = null
      try {
        data = await res.json()
      } catch {
        if (!res.ok) {
          setItemsError(`Unable to load items (server error ${res.status}). The backend may still be updating — try Refresh in a minute.`)
          return
        }
      }
      if (res.ok) {
        const nextItems = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
        setItems((currentItems) => (append ? [...currentItems, ...nextItems] : nextItems))
        if (data && typeof data.total === 'number') {
          setItemsPagination({
            page: data.page || (append ? itemsPagination.page : 1),
            limit: data.limit || limit,
            total: data.total,
            total_pages: data.total_pages || 1,
            next_cursor: data.next_cursor || null,
            has_more: Boolean(data.has_more),
          })
        }
      } else {
        setItemsError(formatApiError(data, 'Failed to load items.'))
      }
    } catch {
      setItemsError(
        options.bootstrap
          ? `${SERVER_STARTING_MESSAGE} Retrying automatically…`
          : 'Unable to fetch community items. Check your connection and try again.',
      )
    } finally {
      if (append) {
        setLoadingMoreItems(false)
      } else {
        setLoadingItems(false)
      }
    }
  }

  async function loadMyItems() {
    if (!currentUser) return
    setLoadingMyItems(true); setMyItemsError('')
    try {
      const res = await fetch(MY_ITEMS_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setMyItems(asArray(data))
      else setMyItemsError('Failed to load your items.')
    } catch { setMyItemsError('Connection issue.') }
    finally { setLoadingMyItems(false) }
  }

  async function loadRequestData() {
    if (!currentUser) return
    setLoadingRequests(true); setRequestsError('')
    try {
      const [myRes, ownerRes] = await Promise.all([
        fetch(MY_REQUESTS_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/requests/incoming`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [myData, ownerData] = await Promise.all([myRes.json(), ownerRes.json()])
      if (myRes.ok && ownerRes.ok) {
        setMyRequests(asArray(myData))
        setOwnerRequests(asArray(ownerData))
      }
      else setRequestsError('Failed to sync activity.')
    } catch { setRequestsError('Unable to sync activity.') }
    finally { setLoadingRequests(false) }
  }

  async function loadMyReputation() {
    if (!token) { setMyReputation(null); return }
    setLoadingReputation(true); setReputationError('')
    try {
      const res = await fetch(MY_REPUTATION_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setMyReputation(data)
      else setReputationError(formatApiError(data, 'Unable to load your reputation.'))
    } catch { setReputationError('Unable to load your reputation.') }
    finally { setLoadingReputation(false) }
  }

  async function loadProfileReviews(userId) {
    if (!userId) { setProfileReviews([]); return }
    setLoadingProfileReviews(true); setProfileReviewsError('')
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/reviews`)
      const data = await res.json()
      if (res.ok) setProfileReviews(asArray(data))
      else setProfileReviewsError(formatApiError(data, 'Unable to load profile reviews.'))
    } catch { setProfileReviewsError('Unable to load profile reviews.') }
    finally { setLoadingProfileReviews(false) }
  }

  function handleLogout() {
    userLoadGeneration.current += 1
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    setToken('')
    setCurrentUser(null)
    setMyItems([]); setMyRequests([]); setOwnerRequests([])
    setOwnerItemsMessage(''); setOwnerItemsError(''); setOwnerActionItemId('')
    setUploadingItemImage(false); setImageUploadMessage(''); setImageUploadError('')
    setItemMessage(''); setItemError('')
    setProfileMessage(''); setProfileError('')
    setWhatsappMessage(''); setWhatsappError('')
    setCountryMessage(''); setCountryError('')
    setMyReputation(null); setReputationError('')
    setProfileReviews([]); setProfileReviewsError('')
    setReviewMessage(''); setReviewModalState(null)
  }

  function handleAuthSuccess(data) {
    userLoadGeneration.current += 1
    setAuthError('')
    if (data.user) {
      setCurrentUser(data.user)
      const country = data.user.country || DEFAULT_COUNTRY
      const prefs = readLocationPreferences()
      if (prefs.country !== country) {
        const nextPrefs = { ...prefs, country, city: '', area: '' }
        writeLocationPreferences(nextPrefs)
        loadItems(nextPrefs)
      }
    }
    if (data.access_token) {
      try {
        localStorage.setItem(TOKEN_KEY, data.access_token)
      } catch {
        /* private browsing — session works for this tab only */
      }
      setToken(data.access_token)
    }
  }

  function handleItemChange(event) {
    const { name, value } = event.target
    if (name === 'location_bundle') {
      setItemForm((current) => ({ ...current, ...value }))
      return
    }
    setItemForm((current) => ({ ...current, [name]: value }))
  }

  async function handleItemImageUpload(file) {
    if (!file) return null
    if (!file.type?.startsWith('image/')) {
      setImageUploadMessage(''); setImageUploadError('Please choose an image file such as JPG, PNG, or WEBP.')
      setItemForm((c) => ({ ...c, image_url: '' })); return null
    }
    if (file.size > MAX_ITEM_IMAGE_BYTES) {
      setImageUploadMessage(''); setImageUploadError('Please choose an image smaller than 5 MB.')
      setItemForm((c) => ({ ...c, image_url: '' })); return null
    }
    setUploadingItemImage(true); setItemError(''); setItemMessage('')
    setImageUploadError(''); setImageUploadMessage(''); setItemForm((c) => ({ ...c, image_url: '' }))
    try {
      const formData = new FormData(); formData.append('file', file)
      const res = await fetch(ITEM_IMAGE_UPLOAD_ENDPOINT, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'We could not upload that image right now.'))
      setItemForm((c) => ({ ...c, image_url: data.secure_url }))
      setImageUploadMessage('Image uploaded and ready to publish.')
      return data.secure_url
    } catch (error) { setImageUploadError(error.message); setItemForm((c) => ({ ...c, image_url: '' })); return null }
    finally { setUploadingItemImage(false) }
  }

  async function handleCreateItem(event) {
    event.preventDefault()
    if (userNeedsWhatsApp(currentUser)) {
      setItemError(WHATSAPP_REQUIRED_MESSAGE)
      return null
    }
    if (uploadingItemImage) { setItemError('Please wait for the image upload to finish before publishing.'); return null }
    setCreatingItem(true); setItemError(''); setItemMessage('')
    try {
      const locationSource = itemForm.location_source || itemForm.locationSource || 'manual'
      const hasLocation = Boolean(
        itemForm.city?.trim()
        || itemForm.location?.trim()
        || itemForm.location_display?.trim()
        || (itemForm.latitude != null && itemForm.longitude != null),
      )
      const payload = {
        title: itemForm.title.trim(),
        description: itemForm.description.trim(),
        category: itemForm.category,
        condition: itemForm.condition,
        location: hasLocation
          ? (itemForm.location?.trim() || itemForm.location_display?.trim() || itemForm.city)
          : 'Pickup to be arranged',
        country: itemForm.country || null,
        city: itemForm.city || null,
        area: itemForm.area || null,
        latitude: itemForm.latitude ?? null,
        longitude: itemForm.longitude ?? null,
        location_source: hasLocation ? locationSource : 'manual',
        location_display: hasLocation
          ? (itemForm.location_display || itemForm.location?.trim() || itemForm.city || 'Pickup to be arranged')
          : 'Pickup to be arranged',
        image_url: itemForm.image_url?.trim() || null,
        listing_mode: itemForm.listing_mode || 'GIVEAWAY',
      }
      if (itemForm.category === 'Food') {
        if (itemForm.expiry_date) payload.expiry_date = itemForm.expiry_date
        if (itemForm.storage_condition) payload.storage_condition = itemForm.storage_condition
        payload.sealed_packaging = Boolean(itemForm.sealed_packaging)
      }
      const res = await fetch(ITEMS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        setItemMessage('Item published successfully!')
        setLastPublishedItem(data); setImageUploadMessage(''); setImageUploadError('')
        setItemForm({ ...emptyItemForm, owner_name: currentUser?.name || '' })
        await loadItems(); await loadMyItems(); return data
      }
      throw new Error(formatApiError(data, 'Publishing failed.'))
    } catch (err) { setItemError(err.message); return null }
    finally { setCreatingItem(false) }
  }

  async function loadNeedRequests(statusFilter = 'open', options = {}) {
    setLoadingNeedRequests(true); setNeedRequestsError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const url = params.toString() ? `${NEED_REQUESTS_ENDPOINT}?${params.toString()}` : NEED_REQUESTS_ENDPOINT
      const res = options.bootstrap
        ? await fetchWithBootstrapRetry(url)
        : await fetch(url)
      const data = await res.json()
      if (res.ok) setNeedRequests(Array.isArray(data) ? data : [])
      else setNeedRequestsError(formatApiError(data, 'Failed to load community needs.'))
    } catch {
      setNeedRequestsError(
        options.bootstrap
          ? `${SERVER_STARTING_MESSAGE} Retrying automatically…`
          : 'Unable to load community needs.',
      )
    } finally {
      setLoadingNeedRequests(false)
    }
  }

  async function handleCreateNeedRequest(payload) {
    setCreatingNeedRequest(true); setNeedRequestsError(''); setNeedRequestsMessage('')
    try {
      const res = await fetch(NEED_REQUESTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Could not post need request.'))
      setNeedRequestsMessage('Need request posted!')
      await loadNeedRequests('open')
      return data
    } catch (error) {
      setNeedRequestsError(error.message)
      return null
    } finally {
      setCreatingNeedRequest(false)
    }
  }

  async function handleCloseNeedRequest(needId) {
    setNeedActionPendingId(needId); setNeedRequestsError(''); setNeedRequestsMessage('')
    try {
      const res = await fetch(`${NEED_REQUESTS_ENDPOINT}/${needId}/close`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Could not close need request.'))
      setNeedRequestsMessage('Need request closed.')
      await loadNeedRequests('open')
      return data
    } catch (error) {
      setNeedRequestsError(error.message)
      return null
    } finally {
      setNeedActionPendingId('')
    }
  }

  async function handleFulfillNeedRequest(needId) {
    setNeedActionPendingId(needId); setNeedRequestsError(''); setNeedRequestsMessage('')
    try {
      const res = await fetch(`${NEED_REQUESTS_ENDPOINT}/${needId}/fulfilled`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Could not update need request.'))
      setNeedRequestsMessage('Need request marked as fulfilled.')
      await loadNeedRequests('open')
      return data
    } catch (error) {
      setNeedRequestsError(error.message)
      return null
    } finally {
      setNeedActionPendingId('')
    }
  }

  function handleApplyGivePrefill(prefill) {
    setItemForm((current) => ({
      ...current,
      ...prefill,
      owner_name: current.owner_name || currentUser?.name || '',
      location: prefill.city || current.location,
      location_display: prefill.city && prefill.country ? `${prefill.city}, ${prefill.country}` : current.location_display,
    }))
  }

  function openRequestModal(item) {
    if (userNeedsWhatsApp(currentUser)) {
      setProfileError('')
      setWhatsappError('')
      navigate('/profile', { state: { whatsappRequired: true } })
      return
    }
    setRequestSubmitError('')
    // Swap-only listings never accept give-away requests, so send the user
    // straight into the existing exchange offer flow instead.
    if (!supportsGiveaway(item) && supportsExchange(item)) {
      setSwapModalItem(item)
      return
    }
    setRequestModalItem(item)
  }

  function openSwapModalForRequest(request) {
    if (userNeedsWhatsApp(currentUser)) {
      setProfileError('')
      setWhatsappError('')
      navigate('/profile', { state: { whatsappRequired: true } })
      return
    }
    const knownItem = [...items, ...myItems].find((entry) => entry.id === request.item_id)
    setSwapModalItem(
      knownItem || {
        id: request.item_id,
        title: request.item_title,
        listing_mode: request.item_listing_mode || 'EXCHANGE',
      },
    )
  }

  async function handleCreateRequest(itemId, reason, requesterCity) {
    if (userNeedsWhatsApp(currentUser)) {
      setRequestSubmitError(WHATSAPP_REQUIRED_MESSAGE)
      return null
    }
    setRequestsError('')
    setRequestsMessage('')
    setRequestSubmitError('')
    setRequestSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/requests/${itemId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, requester_city: requesterCity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Request failed.'))
      setRequestModalItem(null)
      setRequestsMessage('Request sent to the donor for review!')
      await loadItems()
      await loadRequestData()
      return data
    } catch (err) {
      setRequestSubmitError(err.message)
      return null
    } finally {
      setRequestSubmitting(false)
    }
  }

  async function handleRequestAction(requestId, action) {
    setRequestsError(''); setRequestsMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/requests/${requestId}/${action}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Action failed.'))
      setRequestsMessage(
        action === 'approve'
          ? 'Request approved. Happiness Exchange admin will contact both sides via WhatsApp.'
          : 'That request has been declined.',
      )
      await loadItems(); await loadMyItems(); await loadRequestData()
      return data
    } catch (error) { setRequestsError(error.message); return null }
  }

  async function handleCancelRequest(requestId, options = {}) {
    const {
      confirmText = 'Cancel this request? You can request the item again later if it is still available.',
      successMessage = 'Request cancelled.',
      errorMessage = 'Unable to cancel this request.',
    } = options

    if (!window.confirm(confirmText)) {
      return false
    }

    setRequestsError('')
    setRequestsMessage('')
    setCancelPendingRequestId(requestId)

    try {
      const res = await fetch(`${API_BASE}/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        let errorData = null
        try { errorData = await res.json() } catch { errorData = null }
        throw new Error(formatApiError(errorData, errorMessage))
      }

      setMyRequests((current) => current.filter((request) => request.id !== requestId))
      setRequestsMessage(successMessage)
      await loadItems()
      await loadRequestData()
      return true
    } catch (error) {
      setRequestsError(error.message)
      return false
    } finally {
      setCancelPendingRequestId('')
    }
  }

  async function handleDeleteRejectedRequest(requestId) {
    return handleCancelRequest(requestId, {
      confirmText: 'Delete this declined request permanently? This only removes the request from your activity, not the listing.',
      successMessage: 'Request removed.',
      errorMessage: 'Unable to delete this request.',
    })
  }

  async function handleDeleteItem(item) {
    if (!window.confirm(`Delete "${item.title}"? This action cannot be undone.`)) return false
    setOwnerActionItemId(item.id); setOwnerItemsError(''); setOwnerItemsMessage('')
    try {
      const res = await fetch(`${ITEMS_ENDPOINT}/${item.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let errorData = null
        try { errorData = await res.json() } catch { errorData = null }
        throw new Error(formatApiError(errorData, 'Unable to delete this item.'))
      }
      setItems((c) => c.filter((i) => i.id !== item.id))
      setMyItems((c) => c.filter((i) => i.id !== item.id))
      setOwnerRequests((c) => c.filter((r) => r.item_id !== item.id))
      setOwnerItemsMessage(`"${item.title}" was deleted successfully.`)
      await loadMyReputation(); return true
    } catch (error) { setOwnerItemsError(error.message); return false }
    finally { setOwnerActionItemId('') }
  }

  async function handleChangeListingMode(item, listingMode = 'EXCHANGE') {
    setOwnerActionItemId(item.id); setOwnerItemsError(''); setOwnerItemsMessage('')
    try {
      const res = await fetch(`${ITEMS_ENDPOINT}/${item.id}/listing-mode`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_mode: listingMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Unable to update listing type.'))
      setItems((c) => c.map((i) => (i.id === data.id ? { ...i, ...data } : i)))
      setMyItems((c) => c.map((i) => (i.id === data.id ? { ...i, ...data } : i)))
      setOwnerItemsMessage(`"${item.title}" is now listed for ${listingMode === 'EXCHANGE' ? 'Exchange / Swap only' : listingMode === 'BOTH' ? 'Give Away and Exchange' : 'Give Away'}.`)
      return data
    } catch (error) { setOwnerItemsError(error.message); return null }
    finally { setOwnerActionItemId('') }
  }

  async function handleRenewItem(item) {
    setOwnerActionItemId(item.id); setOwnerItemsError(''); setOwnerItemsMessage('')
    try {
      const res = await fetch(`${ITEMS_ENDPOINT}/${item.id}/renew`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Unable to renew this listing.'))
      setItems((c) => c.map((i) => (i.id === data.id ? data : i)))
      setMyItems((c) => c.map((i) => (i.id === data.id ? data : i)))
      setOwnerItemsMessage(`"${item.title}" is active again for 14 days.`)
      await loadItems(); await loadMyItems()
      return data
    } catch (error) { setOwnerItemsError(error.message); return null }
    finally { setOwnerActionItemId('') }
  }

  async function handleCompleteItem(item) {
    setOwnerActionItemId(item.id); setOwnerItemsError(''); setOwnerItemsMessage('')
    try {
      const res = await fetch(`${ITEMS_ENDPOINT}/${item.id}/complete`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Unable to mark this item as completed.'))
      setItems((c) => c.map((i) => i.id === data.id ? data : i))
      setMyItems((c) => c.map((i) => i.id === data.id ? data : i))
      setOwnerItemsMessage(`"${item.title}" is now marked as successfully taken.`)
      await loadItems(); await loadMyItems(); await loadRequestData(); await loadMyReputation()
      return data
    } catch (error) { setOwnerItemsError(error.message); return null }
    finally { setOwnerActionItemId('') }
  }

  async function handleWhatsAppUpdate(nextWhatsapp) {
    setWhatsappUpdating(true); setWhatsappMessage(''); setWhatsappError('')
    try {
      const res = await fetch(`${ME_ENDPOINT}/whatsapp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ whatsapp_number: nextWhatsapp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Unable to update your WhatsApp number.'))
      setCurrentUser(data)
      setWhatsappMessage('WhatsApp number saved.')
      return data
    } catch (error) { setWhatsappError(error.message); return null }
    finally { setWhatsappUpdating(false) }
  }

  async function handleCountryUpdate(nextCountry) {
    setCountryUpdating(true); setCountryMessage(''); setCountryError('')
    try {
      const res = await fetch(`${ME_ENDPOINT}/country`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ country: nextCountry }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Unable to update your country.'))
      setCurrentUser(data)
      setCountryMessage('Country saved.')
      return data
    } catch (error) { setCountryError(error.message); return null }
    finally { setCountryUpdating(false) }
  }

  async function handleProfileUpdate(nextName) {
    setProfileUpdating(true); setProfileMessage(''); setProfileError('')
    try {
      const res = await fetch(ME_ENDPOINT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: nextName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Unable to update your profile.'))
      setCurrentUser(data)
      setMyItems((c) => c.map((i) => i.owner_id === data.id ? { ...i, owner_name: data.name } : i))
      setItems((c) => c.map((i) => i.owner_id === data.id ? { ...i, owner_name: data.name } : i))
      setMyRequests((c) => c.map((r) => r.requester_id === data.id ? { ...r, requester_name: data.name } : r))
      setOwnerRequests((c) => c.map((r) => {
        const next = { ...r }
        if (r.requester_id === data.id) next.requester_name = data.name
        if (r.owner_id === data.id) next.owner_name = data.name
        return next
      }))
      setProfileMessage('Profile updated successfully.'); return data
    } catch (error) { setProfileError(error.message); return null }
    finally { setProfileUpdating(false) }
  }

  async function handleDeleteAccount() {
    setAccountDeleting(true)
    setAccountDeleteError('')
    try {
      const res = await fetch(ME_ENDPOINT, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(formatApiError(data, 'Unable to delete your account.'))
      handleLogout()
      navigate('/signup')
      return true
    } catch (error) {
      setAccountDeleteError(error.message)
      return false
    } finally {
      setAccountDeleting(false)
    }
  }

  function openReviewModal(reviewContext) { if (reviewContext) setReviewModalState(reviewContext) }
  function closeReviewModal() { if (!reviewSubmitting) setReviewModalState(null) }

  async function handleSubmitReview({ rating, comment }) {
    if (!reviewModalState) return { error: 'Review details are missing.' }
    setReviewSubmitting(true)
    try {
      const res = await fetch(REVIEWS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          item_id: reviewModalState.itemId,
          reviewed_user_id: reviewModalState.reviewedUserId,
          rating, comment,
        }),
      })
      const data = await res.json()
      if (!res.ok) return { error: formatApiError(data, 'Unable to submit your review.') }
      setReviewMessage('Review submitted successfully.')
      setReviewModalState(null)
      await loadItems(); await loadMyItems(); await loadRequestData(); await loadMyReputation()
      if (currentUser?.id) await loadProfileReviews(currentUser.id)
      return { success: true, data }
    } catch { return { error: 'Unable to submit your review.' } }
    finally { setReviewSubmitting(false) }
  }

  function getMyRequestForItem(itemId) {
    return asArray(myRequests).find((r) => r.item_id === itemId)
  }

  function hasSubmittedReviewForItem(itemId) {
    const reviewed = myReputation?.submitted_review_item_ids
    return Array.isArray(reviewed) && reviewed.includes(itemId)
  }

  function getReviewContextForItem(item) {
    if (!currentUser || !item || item.owner_id === currentUser.id) return null
    const myRequest = getMyRequestForItem(item.id)
    if (item.status !== 'completed' || myRequest?.status !== 'approved' || hasSubmittedReviewForItem(item.id)) return null
    return { itemId: item.id, itemTitle: item.title, reviewedUserId: item.owner_id, reviewedUserName: item.owner_name }
  }

  function getReviewContextForMyRequest(request) {
    if (!currentUser || !request || request.status !== 'approved' || hasSubmittedReviewForItem(request.item_id)) return null
    const relatedItem = asArray(items).find((i) => i.id === request.item_id)
    if (!relatedItem || relatedItem.status !== 'completed') return null
    return { itemId: request.item_id, itemTitle: request.item_title, reviewedUserId: relatedItem.owner_id, reviewedUserName: relatedItem.owner_name }
  }

  function getReviewContextForOwnerRequest(request) {
    if (!currentUser || !request || request.status !== 'approved' || hasSubmittedReviewForItem(request.item_id)) return null
    const relatedItem = asArray(myItems).find((i) => i.id === request.item_id)
    if (!relatedItem || relatedItem.status !== 'completed') return null
    return { itemId: request.item_id, itemTitle: request.item_title, reviewedUserId: request.requester_id, reviewedUserName: request.requester_name }
  }

  const bottomTabItems = useMemo(() => {
    const items = [
    {
      to: '/',
      label: 'Home',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      to: '/browse',
      label: 'Browse',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
        </svg>
      ),
    },
    {
      to: '/give',
      label: 'Give',
      icon: (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8b4cf6] text-white shadow-xs transition-transform active:scale-90">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      ),
    },
    {
      to: '/swaps',
      label: 'Exchange',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
    {
      to: '/deliveries',
      label: 'Delivery',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21m-3 0h-.375c-.621 0-1.125-.504-1.125-1.125v-3.026a2.999 2.999 0 00-.5-1.664l-2.2-3.3A2.25 2.25 0 0014.25 9H9.75a2.25 2.25 0 00-1.875 1.011l-2.2 3.3a3 3 0 00-.5 1.664V16.5" />
        </svg>
      ),
    },
    {
      to: '/dashboard',
      label: 'Profile',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    ]

    if (!PUBLIC_DELIVERY_ENABLED) {
      return items.filter((item) => item.to !== '/deliveries')
    }

    return items
  }, [])

  const desktopNavItems = useMemo(() => {
    const items = [
      { to: '/', label: 'Home' },
      { to: '/browse', label: 'Browse' },
      { to: '/needs', label: 'Needs' },
      { to: '/give', label: 'Give Item' },
      { to: '/swaps', label: 'Exchange' },
      { to: '/deliveries', label: 'Delivery' },
      { to: '/requests', label: 'Activity' },
      { to: '/dashboard', label: 'Dashboard' },
    ]

    if (!PUBLIC_DELIVERY_ENABLED) {
      return items.filter((item) => item.to !== '/deliveries')
    }

    return items
  }, [])

  return (
    <NotificationProvider token={currentUser && token && !isAuthPage ? token : ''}>
      <div className={['he-app flex flex-1 flex-col bg-he-page', isAuthPage ? 'he-app-auth' : 'min-h-screen'].join(' ')}>
        <SplashScreen visible={showSplash} />

        <div className="flex flex-1 flex-col">
          {import.meta.env.DEV ? (
            <LocalDemoBar
              apiBase={API_BASE}
              currentUser={currentUser}
              country={localCountry}
              onCountryChange={setLocalCountry}
              onAuthSuccess={handleAuthSuccess}
              onError={setAuthError}
            />
          ) : null}

          {currentUser && !currentUser.is_verified && !isAuthPage ? (
            <div className="border-b border-he-danger/30 bg-[#fff3f0] px-4 py-2.5 text-center text-[13px] font-bold text-[#c65d4a] flex items-center justify-center gap-4 flex-wrap dark:border-rose-900/50 dark:bg-[#3f1d1d] dark:text-rose-200">
              <span>Verify your email to list, request items, and leave reviews.</span>
              <button
                type="button"
                onClick={async () => {
                  setAuthNotice('')
                  setAuthError('')
                  try {
                    const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      if (data.status === 'already_verified') {
                        await refreshCurrentUser()
                        setAuthNotice('Your email is already verified.')
                        return
                      }
                      if (currentUser?.id) {
                        setResendCooldown(currentUser.id)
                      }
                      navigate('/check-email', {
                        state: {
                          email: currentUser.email,
                          resendSuccess: true,
                        },
                      })
                      return
                    }
                    if (res.status === 429 && currentUser?.id) {
                      const { message, retryAfterSeconds } = parseApiErrorDetail(
                        data,
                        'Please wait before requesting another email.',
                      )
                      syncResendCooldownFromSeconds(currentUser.id, retryAfterSeconds || 600)
                      setAuthError(message)
                      return
                    }
                    const detail = typeof data.detail === 'string'
                      ? data.detail
                      : 'Failed to send verification email.'
                    setAuthError(detail)
                  } catch (e) {
                    setAuthError(e.message)
                  }
                }}
                className="underline hover:text-[#a04738] transition-colors"
              >
                Resend verification email
              </button>
            </div>
          ) : null}

          {currentUser && userNeedsWhatsApp(currentUser) && !isAuthPage ? (
            <div className="border-b border-[#8b4cf6]/30 bg-[#efe7ff] px-4 py-2.5 text-center text-[13px] font-bold text-[#6b3fd4] flex items-center justify-center gap-4 flex-wrap dark:border-purple-900/50 dark:bg-[#2a1f3d] dark:text-purple-200">
              <span>
                WhatsApp number required — add yours in Settings to list or request items. Only admins can see it.
              </span>
              <NavLink
                to="/profile"
                state={{ whatsappRequired: true }}
                className="underline hover:text-[#5a2fc4] transition-colors"
              >
                Add WhatsApp in Settings
              </NavLink>
            </div>
          ) : null}

          {showAppChrome && !isAuthPage ? (
            <>
            <header className="he-nav-shell">
              <div className="flex h-14 min-w-0 items-center px-4 mx-auto w-full max-w-[1280px] md:px-6">
                {/* Logo */}
                <div className="flex flex-1 items-center justify-start">
                  <NavLink to="/" className="flex items-center gap-2">
                    <BrandLogo size="sm" showText={true} className="min-w-0" />
                  </NavLink>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center justify-center gap-1.5">
                  {desktopNavItems.map((nav) => (
                    <NavLink
                      key={nav.to}
                      to={nav.to}
                      className={({ isActive }) => [
                        'relative px-3.5 py-2 rounded-full text-[13px] font-bold tracking-wide transition-all duration-300',
                        isActive ? 'bg-he-nav-active text-he-purple shadow-xs' : 'text-he-soft hover:text-he-purple hover:bg-he-surface-soft',
                      ].join(' ')}
                    >
                      {nav.label}
                    </NavLink>
                  ))}
                </nav>

                {/* Profile and Notifications — never on auth pages */}
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:gap-3">
                  {currentUser && !isAuthPage ? (
                    <>
                      <NotificationBell />
                      <NavLink
                        to="/profile"
                        className={({ isActive }) => [
                          'inline-flex h-8 w-8 items-center justify-center rounded-btn border border-transparent text-he-soft transition-all duration-200 hover:bg-he-surface-soft hover:text-he-ink',
                          isActive ? 'bg-he-nav-active text-he-purple shadow-xs' : '',
                        ].join(' ')}
                        aria-label="Open profile settings"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />
                        </svg>
                      </NavLink>
                    </>
                  ) : null}
                </div>
              </div>
            </header>
            <FlashBanner />
            <BackendWakeupBanner />
            </>
          ) : null}

          <main className={
            isAuthPage
              ? 'he-auth-main flex flex-1 flex-col'
              : isMarketingHome
              ? 'flex-1 min-w-0 overflow-x-clip'
              : 'app-shell flex-1 min-w-0 overflow-x-clip pt-4 pb-20 md:pb-8'
          }>
            <Routes>
              <Route
                path="/"
                element={
                  token && !currentUser && loadingUser ? (
                    <AppBootSkeleton />
                  ) : currentUser ? (
                    <AuthenticatedHomePage
                      items={items} currentUser={currentUser} myReputation={myReputation}
                      getMyRequestForItem={getMyRequestForItem} getReviewContextForItem={getReviewContextForItem}
                      onCreateRequest={openRequestModal} onOpenReview={openReviewModal}
                      loadingItems={loadingItems} itemsError={itemsError}
                      onRefreshItems={loadItems}
                      myRequests={myRequests} ownerRequests={ownerRequests}
                      onDeleteItem={handleDeleteItem} onCompleteItem={handleCompleteItem}
                      onRenewItem={handleRenewItem} onChangeListingMode={handleChangeListingMode}
                      ownerActionItemId={ownerActionItemId}
                    />
                  ) : (
                    <HomePage
                      items={items} currentUser={currentUser}
                      getMyRequestForItem={getMyRequestForItem} onCreateRequest={openRequestModal}
                      loadingItems={loadingItems} itemsError={itemsError}
                      myRequests={myRequests} ownerRequests={ownerRequests}
                    />
                  )
                }
              />
              <Route
                path="/check-email"
                element={
                  <CheckYourEmailPage
                    apiBase={API_BASE}
                    token={token}
                    currentUser={currentUser}
                    loadingUser={loadingUser}
                    onRefreshUser={refreshCurrentUser}
                  />
                }
              />
              <Route
                path="/verify-email"
                element={<VerifyEmailPage onRefreshUser={refreshCurrentUser} />}
              />
              <Route
                path="/browse"
                element={
                  <BrowseItemsPage
                    items={items} currentUser={currentUser}
                    getMyRequestForItem={getMyRequestForItem} getReviewContextForItem={getReviewContextForItem}
                    onCreateRequest={openRequestModal} onOpenReview={openReviewModal}
                    onRefreshItems={loadItems} loadingItems={loadingItems} loadingMoreItems={loadingMoreItems}
                    itemsError={itemsError}
                    itemsPagination={itemsPagination}
                  />
                }
              />
              <Route
                path="/needs"
                element={
                  <NeedsBoardPage
                    currentUser={currentUser}
                    needRequests={needRequests}
                    loadingNeedRequests={loadingNeedRequests}
                    needRequestsError={needRequestsError}
                    needRequestsMessage={needRequestsMessage}
                    onRefreshNeedRequests={loadNeedRequests}
                    onCreateNeedRequest={handleCreateNeedRequest}
                    onCloseNeedRequest={handleCloseNeedRequest}
                    onFulfillNeedRequest={handleFulfillNeedRequest}
                    creatingNeedRequest={creatingNeedRequest}
                    needActionPendingId={needActionPendingId}
                  />
                }
              />
              <Route path="/requests-board" element={<Navigate to="/needs" replace />} />
              <Route
                path="/give"
                element={
                  <GiveItemPage
                    currentUser={currentUser} itemForm={itemForm}
                    onItemChange={handleItemChange} onItemImageUpload={handleItemImageUpload}
                    onCreateItem={handleCreateItem} creatingItem={creatingItem}
                    uploadingItemImage={uploadingItemImage} itemMessage={itemMessage} itemError={itemError}
                    imageUploadMessage={imageUploadMessage} imageUploadError={imageUploadError}
                    onApplyGivePrefill={handleApplyGivePrefill}
                    missingWhatsApp={userNeedsWhatsApp(currentUser)}
                  />
                }
              />
              <Route
                path="/items/:itemId"
                element={
                  <ItemDetailsPage
                    currentUser={currentUser} items={items} myItems={myItems}
                    loadingItems={loadingItems} itemsError={itemsError}
                    onRefreshItems={loadItems}
                    onRefreshMyItems={loadMyItems}
                    token={token}
                    getMyRequestForItem={getMyRequestForItem} getReviewContextForItem={getReviewContextForItem}
                    onCreateRequest={openRequestModal} onOpenReview={openReviewModal}
                    onDeleteItem={handleDeleteItem} onCompleteItem={handleCompleteItem}
                    onRenewItem={handleRenewItem}
                    onChangeListingMode={handleChangeListingMode}
                    ownerActionItemId={ownerActionItemId}
                  />
                }
              />
              <Route
                path="/exchange/:transactionId"
                element={
                  <ExchangeTransactionPage currentUser={currentUser} token={token} />
                }
              />
              <Route
                path="/deliveries"
                element={
                  <RequireAuth token={token} currentUser={currentUser} loadingUser={loadingUser}>
                    {PUBLIC_DELIVERY_ENABLED
                      ? <MyDeliveriesPage currentUser={currentUser} token={token} />
                      : <DeliveryComingSoonPage />}
                  </RequireAuth>
                }
              />
              <Route
                path="/tracking/:shipmentId"
                element={
                  <ShipmentTrackingPage currentUser={currentUser} token={token} />
                }
              />
              <Route
                path="/item-listed-success"
                element={<ItemListedSuccessPage currentUser={currentUser} publishedItem={lastPublishedItem} />}
              />
              <Route
                path="/dashboard"
                element={
                  <DashboardPage
                    currentUser={currentUser} items={items} myReputation={myReputation}
                    myItems={myItems} myRequests={myRequests} ownerRequests={ownerRequests}
                    loadRequestData={loadRequestData}
                    onRequestAction={handleRequestAction} onOpenReview={openReviewModal}
                    getReviewContextForMyRequest={getReviewContextForMyRequest}
                    getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
                    loadingRequests={loadingRequests} requestsMessage={requestsMessage} requestsError={requestsError}
                  />
                }
              />
              <Route
                path="/swaps"
                element={
                  <ExchangeOffersPage currentUser={currentUser} token={token} />
                }
              />
              <Route
                path="/exchange-offers"
                element={<Navigate to="/swaps" replace />}
              />
              <Route
                path="/requests"
                element={
                  <RequestsPage
                    currentUser={currentUser}
                    items={items}
                    myRequests={myRequests}
                    ownerRequests={ownerRequests}
                    myItems={myItems}
                    onOpenReview={openReviewModal}
                    getReviewContextForMyRequest={getReviewContextForMyRequest}
                    getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
                    loadingRequests={loadingRequests}
                    requestsMessage={requestsMessage}
                    requestsError={requestsError}
                    onRequestAction={handleRequestAction}
                    onCancelRequest={handleCancelRequest}
                    onDeleteRejectedRequest={handleDeleteRejectedRequest}
                    onProposeSwap={openSwapModalForRequest}
                    cancelPendingRequestId={cancelPendingRequestId}
                    loadRequestData={loadRequestData}
                  />
                }
              />
              <Route path="/messages" element={<MessagingDisabledPage />} />
              <Route path="/messages/:conversationId" element={<MessagingDisabledPage />} />
              <Route
                path="/deliveries/:deliveryId"
                element={<Navigate to="/requests" replace />}
              />
              <Route
                path="/reputation"
                element={
                  <ReputationPage
                    currentUser={currentUser} myReputation={myReputation} profileReviews={profileReviews}
                  />
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth token={token} currentUser={currentUser} loadingUser={loadingUser}>
                    <ProfilePage
                      currentUser={currentUser} myReputation={myReputation}
                      loadingReputation={loadingReputation} reputationError={reputationError}
                      profileReviews={profileReviews} loadingProfileReviews={loadingProfileReviews}
                      profileReviewsError={profileReviewsError}
                      onUpdateProfile={handleProfileUpdate} profileUpdating={profileUpdating}
                      profileMessage={profileMessage} profileError={profileError}
                      onUpdateWhatsApp={handleWhatsAppUpdate} whatsappUpdating={whatsappUpdating}
                      whatsappMessage={whatsappMessage} whatsappError={whatsappError}
                      onUpdateCountry={handleCountryUpdate} countryUpdating={countryUpdating}
                      countryMessage={countryMessage} countryError={countryError}
                      onLogout={handleLogout} onDeleteAccount={handleDeleteAccount}
                      accountDeleting={accountDeleting} accountDeleteError={accountDeleteError}
                      myItems={myItems} myRequests={myRequests}
                      onLocationPrefsUpdated={loadItems}
                    />
                  </RequireAuth>
                }
              />
              <Route path="/settings" element={<Navigate to="/profile" replace />} />
              <Route
                path="/login"
                element={
                  <LoginPage
                    apiBase={API_BASE}
                    onSuccess={handleAuthSuccess}
                    currentUser={currentUser}
                    loadingUser={loadingUser}
                    token={token}
                  />
                }
              />
              <Route
                path="/signup"
                element={<SignupPage apiBase={API_BASE} onSuccess={handleAuthSuccess} currentUser={currentUser} />}
              />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          {currentUser && !isMarketingHome && !isAuthPage ? (
            <nav className="he-bottom-nav md:hidden">
              {bottomTabItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => [
                    'flex min-w-0 flex-col items-center justify-center flex-1 py-1 gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200',
                    isActive ? 'text-he-purple' : 'text-he-soft hover:text-he-ink',
                  ].join(' ')}
                >
                  {item.icon}
                  <span className="max-w-[4.75rem] truncate text-[9px] leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>

      {/* Global notification toast */}
      {!isAuthPage && (loadingUser || authError || authNotice || reviewMessage) ? (
        <div className="fixed bottom-20 right-4 z-50 w-[min(16rem,calc(100vw-2rem))] md:bottom-6 md:right-6">
          <Surface className="border-[#8b4cf6]/10 p-4 shadow-xl ring-1 ring-[#8b4cf6]/5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">System Notification</h2>
            {loadingUser ? <p className="mt-1 text-xs text-[#68766d]">Verifying profile...</p> : null}
            {authNotice ? <p className="mt-1 text-xs font-medium text-[#8b4cf6]">{authNotice}</p> : null}
            {authError ? <p className="mt-1 text-xs font-medium text-[#c65d4a]">{authError}</p> : null}
            {reviewMessage ? <p className="mt-1 text-xs font-medium text-[#8b4cf6]">{reviewMessage}</p> : null}
          </Surface>
        </div>
      ) : null}

      <ReviewModal
        open={Boolean(reviewModalState)}
        context={reviewModalState}
        submitting={reviewSubmitting}
        onClose={closeReviewModal}
        onSubmit={handleSubmitReview}
      />
      <RequestItemModal
        item={requestModalItem}
        open={Boolean(requestModalItem)}
        submitting={requestSubmitting}
        error={requestSubmitError}
        missingWhatsApp={userNeedsWhatsApp(currentUser)}
        country={currentUser?.country}
        onClose={() => {
          if (!requestSubmitting) {
            setRequestModalItem(null)
            setRequestSubmitError('')
          }
        }}
        onSubmit={handleCreateRequest}
      />
      <ProposeSwapModal
        open={Boolean(swapModalItem)}
        item={swapModalItem}
        myItems={myItems}
        token={token}
        country={currentUser?.country}
        onClose={() => setSwapModalItem(null)}
        onSubmitted={async () => {
          setSwapModalItem(null)
          setRequestsMessage('Swap offer sent! Track it under Swaps.')
          await loadItems()
          await loadRequestData()
        }}
      />
      </div>
    </NotificationProvider>
  )
}
