import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import BrowseItemsPage from './pages/BrowseItemsPage.jsx'
import AuthenticatedHomePage from './pages/AuthenticatedHomePage.jsx'
import ChatLayout from './pages/ChatLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DeliveryTrackingPage from './pages/DeliveryTrackingPage.jsx'
import GiveItemPage from './pages/GiveItemPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ItemDetailsPage from './pages/ItemDetailsPage.jsx'
import ItemListedSuccessPage from './pages/ItemListedSuccessPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ReputationPage from './pages/ReputationPage.jsx'
import RequestsPage from './pages/RequestsPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import CheckYourEmailPage from './pages/CheckYourEmailPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import BrandLogo from './components/BrandLogo.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import { ReviewModal } from './components/reputation.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import { Button, Surface } from './components/ui.jsx'
import { NotificationProvider } from './components/NotificationContext.jsx'
import {
  parseApiErrorDetail,
  setResendCooldown,
  syncResendCooldownFromSeconds,
} from './lib/verificationResend.js'
import { resolveApiBase, asArray } from './lib/api.js'
import { buildItemsQueryParams, DEFAULT_COUNTRY, readLocationPreferences } from './lib/locations.js'

const API_BASE = resolveApiBase()
const STATUS_ENDPOINT = `${API_BASE}/api/status`
const ME_ENDPOINT = `${API_BASE}/api/me`
const ITEMS_ENDPOINT = `${API_BASE}/api/items`
const ITEM_IMAGE_UPLOAD_ENDPOINT = `${API_BASE}/api/items/upload-image`
const MY_ITEMS_ENDPOINT = `${API_BASE}/api/items/my`
const MY_REQUESTS_ENDPOINT = `${API_BASE}/api/requests/my`
const MY_REPUTATION_ENDPOINT = `${API_BASE}/api/me/reputation`
const REVIEWS_ENDPOINT = `${API_BASE}/api/reviews`
const CONVERSATIONS_ENDPOINT = `${API_BASE}/api/conversations/my`
const DELIVERIES_ENDPOINT = `${API_BASE}/api/deliveries/my`
const TOKEN_KEY = 'happiness_exchange_token'
const AUTH_FLOW_PATHS = ['/verify-email', '/check-email', '/login', '/signup']
const MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024

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
  image_url: '',
  owner_name: '',
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
  const navigate = useNavigate()
  const [showSplash, setShowSplash] = useState(false)
  const [token, setToken] = useState(() => readStoredToken())
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [loadingUser, setLoadingUser] = useState(false)

  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
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

  const [profileUpdating, setProfileUpdating] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
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

  // Chat state — map of requestId → conversationId
  const [conversations, setConversations] = useState([])
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0)

  // Deliveries state
  const [myDeliveries, setMyDeliveries] = useState([])

  const isAuthFlowRoute = AUTH_FLOW_PATHS.includes(location.pathname)
  const isMarketingHome = !currentUser && location.pathname === '/'
  const isMessagesRoute = location.pathname.startsWith('/messages')
  const showAppChrome = Boolean(currentUser) || location.pathname !== '/'

  useEffect(() => { loadItems(readLocationPreferences()) }, [])

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
      loadItems() // Also reload public items when user changes to get fresh state
      loadMyItems()
      loadRequestData()
      loadMyReputation()
      loadProfileReviews(currentUser.id)
      loadConversations()
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
    setLoadingUser(true)
    setAuthError('')

    try {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const controller = new AbortController()
          const timeoutId = window.setTimeout(() => controller.abort(), 20000)
          const res = await fetch(ME_ENDPOINT, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
          window.clearTimeout(timeoutId)
          const data = await res.json()

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
          return
        } catch {
          if (attempt < 3) {
            await new Promise((resolve) => window.setTimeout(resolve, 1500 * attempt))
            continue
          }
          setAuthError('Could not reach the server. Your session is still saved — please try again.')
        }
      }
    } finally {
      setLoadingUser(false)
    }
  }

  async function loadItems(locationPrefs) {
    setLoadingItems(true); setItemsError('')
    try {
      const prefs = locationPrefs || readLocationPreferences()
      const params = buildItemsQueryParams(prefs)
      const url = params.toString() ? `${ITEMS_ENDPOINT}?${params.toString()}` : ITEMS_ENDPOINT
      const res = await fetch(url)
      let data = null
      try {
        data = await res.json()
      } catch {
        if (!res.ok) {
          setItemsError(`Unable to load items (server error ${res.status}). The backend may still be updating — try Refresh in a minute.`)
          return
        }
      }
      if (res.ok) setItems(Array.isArray(data) ? data : [])
      else setItemsError(formatApiError(data, 'Failed to load items.'))
    } catch {
      setItemsError('Unable to fetch community items. Check your connection and try again.')
    } finally { setLoadingItems(false) }
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
      const [myRes, ownerRes, delivRes] = await Promise.all([
        fetch(MY_REQUESTS_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/requests/incoming`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(DELIVERIES_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } })
      ])
      const [myData, ownerData, delivData] = await Promise.all([myRes.json(), ownerRes.json(), delivRes.json()])
      if (myRes.ok && ownerRes.ok) {
        setMyRequests(asArray(myData))
        setOwnerRequests(asArray(ownerData))
      }
      else setRequestsError('Failed to sync activity.')
      if (delivRes.ok) setMyDeliveries(asArray(delivData))
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

  async function loadConversations() {
    if (!token) return
    try {
      const res = await fetch(CONVERSATIONS_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        const list = asArray(data)
        setConversations(list)
        setChatUnreadTotal(list.reduce((sum, c) => sum + (c.unread_count || 0), 0))
      }
    } catch { /* silent */ }
  }

  function handleLogout() {
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
    setMyReputation(null); setReputationError('')
    setProfileReviews([]); setProfileReviewsError('')
    setReviewMessage(''); setReviewModalState(null)
    setConversations([]); setChatUnreadTotal(0)
    setMyDeliveries([])
  }

  function handleAuthSuccess(data) {
    setAuthError('')
    if (data.user) setCurrentUser(data.user)
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
    if (uploadingItemImage) { setItemError('Please wait for the image upload to finish before publishing.'); return null }
    setCreatingItem(true); setItemError(''); setItemMessage('')
    try {
      const payload = {
        ...itemForm,
        location: itemForm.location?.trim()
          || itemForm.location_display?.trim()
          || itemForm.city
          || 'Current location',
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

  async function handleCreateRequest(itemId) {
    setRequestsError(''); setRequestsMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/requests/${itemId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatApiError(data, 'Request failed.'))
      setRequestsMessage('Request sent to owner!')
      await loadItems(); await loadRequestData(); return data
    } catch (err) { setRequestsError(err.message); return null }
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
          ? 'That request has been approved and the item is now reserved.'
          : 'That request has been declined.',
      )
      await loadItems(); await loadMyItems(); await loadRequestData()
      // Reload conversations so "Open Chat" appears
      await loadConversations()
      return data
    } catch (error) { setRequestsError(error.message); return null }
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

  // Map requestId → conversationId for "Open Chat" buttons
  function getChatConversationForRequest(requestId) {
    const conv = asArray(conversations).find((c) => c.request_id === requestId)
    return conv ? conv.id : null
  }

  const bottomTabItems = [
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
        <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-[#8b4cf6] text-white shadow-xs transition-transform active:scale-90">
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      ),
    },
    {
      to: '/messages',
      label: 'Messages',
      icon: (
        <div className="relative">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          {chatUnreadTotal > 0 && (
            <div className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#8b4cf6] text-[7px] font-bold text-white">
              {chatUnreadTotal > 9 ? '9+' : chatUnreadTotal}
            </div>
          )}
        </div>
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

  return (
    <NotificationProvider token={token}>
      <div className="he-app flex min-h-screen flex-1 flex-col bg-he-page">
        <SplashScreen visible={showSplash} />

        <div className="flex flex-1 flex-col">
          {currentUser && !currentUser.is_verified ? (
            <div className="bg-[#fff3f0] px-4 py-2.5 text-center text-[13px] font-bold text-[#c65d4a] border-b border-[#ffd7cf] flex items-center justify-center gap-4 flex-wrap dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/40">
              <span>Verify your email to list, request, chat, and review.</span>
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

          {showAppChrome ? (
            <header className="sticky top-0 z-50 border-b border-he-border bg-he-surface/95 backdrop-blur-md dark:bg-he-surface/98">
              <div className="flex h-14 items-center px-4 mx-auto w-full max-w-[1280px] md:px-6">
                {/* Logo */}
                <div className="flex flex-1 items-center justify-start">
                  <NavLink to="/" className="flex items-center gap-2">
                    <BrandLogo size="sm" showText={true} className="min-w-0" />
                  </NavLink>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center justify-center gap-1">
                  {[
                    { to: '/', label: 'Home' },
                    { to: '/browse', label: 'Browse' },
                    { to: '/give', label: 'Give Item' },
                    { to: '/requests', label: 'Activity' },
                    { to: '/messages', label: 'Messages', badge: chatUnreadTotal },
                    { to: '/dashboard', label: 'Dashboard' },
                  ].map((nav) => (
                    <NavLink
                      key={nav.to}
                      to={nav.to}
                      className={({ isActive }) => [
                        'relative px-3 py-2 rounded-full text-[13px] font-bold tracking-wide transition-all duration-300',
                        isActive ? 'bg-he-nav-active text-he-purple shadow-xs' : 'text-he-soft hover:text-he-purple hover:bg-he-surface-soft',
                      ].join(' ')}
                    >
                      {nav.label}
                      {nav.badge > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#8b4cf6] text-[8px] font-bold text-white">
                          {nav.badge > 9 ? '9+' : nav.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                  <NavLink
                    to="/leaderboard"
                    className={({ isActive }) => [
                      'text-sm font-bold uppercase tracking-widest transition-colors duration-200',
                      isActive ? 'text-he-purple' : 'text-he-ink hover:text-he-purple',
                    ].join(' ')}
                  >
                    Top Donors
                  </NavLink>
                </nav>

                {/* Profile and Notifications */}
                <div className="flex flex-1 items-center justify-end gap-3">
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
                </div>
              </div>
            </header>
          ) : null}

          <main className={
            isMarketingHome
              ? 'flex-1'
              : isMessagesRoute
                ? 'app-shell flex-1 pb-20 md:pb-8'
                : 'app-shell flex-1 pt-4 pb-20 md:pb-8'
          }>
            <Routes>
              <Route
                path="/"
                element={
                  currentUser ? (
                    <AuthenticatedHomePage
                      items={items} currentUser={currentUser} myReputation={myReputation}
                      getMyRequestForItem={getMyRequestForItem} getReviewContextForItem={getReviewContextForItem}
                      onCreateRequest={handleCreateRequest} onOpenReview={openReviewModal}
                      loadingItems={loadingItems} itemsError={itemsError}
                      myRequests={myRequests} ownerRequests={ownerRequests}
                    />
                  ) : (
                    <HomePage
                      items={items} currentUser={currentUser}
                      getMyRequestForItem={getMyRequestForItem} onCreateRequest={handleCreateRequest}
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
                    onCreateRequest={handleCreateRequest} onOpenReview={openReviewModal}
                    onRefreshItems={loadItems} loadingItems={loadingItems} itemsError={itemsError}
                  />
                }
              />
              <Route
                path="/give"
                element={
                  <GiveItemPage
                    currentUser={currentUser} itemForm={itemForm}
                    onItemChange={handleItemChange} onItemImageUpload={handleItemImageUpload}
                    onCreateItem={handleCreateItem} creatingItem={creatingItem}
                    uploadingItemImage={uploadingItemImage} itemMessage={itemMessage} itemError={itemError}
                    imageUploadMessage={imageUploadMessage} imageUploadError={imageUploadError}
                  />
                }
              />
              <Route
                path="/items/:itemId"
                element={
                  <ItemDetailsPage
                    currentUser={currentUser} items={items} myItems={myItems}
                    getMyRequestForItem={getMyRequestForItem} getReviewContextForItem={getReviewContextForItem}
                    onCreateRequest={handleCreateRequest} onOpenReview={openReviewModal}
                    onDeleteItem={handleDeleteItem} onCompleteItem={handleCompleteItem}
                    ownerActionItemId={ownerActionItemId}
                  />
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
                    myDeliveries={myDeliveries} loadRequestData={loadRequestData} token={token}
                    onRequestAction={handleRequestAction} onOpenReview={openReviewModal}
                    getReviewContextForMyRequest={getReviewContextForMyRequest}
                    getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
                    getChatConversationForRequest={getChatConversationForRequest}
                    loadingRequests={loadingRequests} requestsMessage={requestsMessage} requestsError={requestsError}
                  />
                }
              />
              <Route
                path="/requests"
                element={
                  <RequestsPage
                    currentUser={currentUser} ownerRequests={ownerRequests} myItems={myItems}
                    onOpenReview={openReviewModal}
                    getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
                    loadingRequests={loadingRequests} requestsMessage={requestsMessage} requestsError={requestsError}
                    onRequestAction={handleRequestAction}
                    myDeliveries={myDeliveries} loadRequestData={loadRequestData} token={token}
                  />
                }
              />
              <Route
                path="/messages"
                element={<ChatLayout apiBase={API_BASE} token={token} currentUser={currentUser} />}
              />
              <Route
                path="/messages/:conversationId"
                element={<ChatLayout apiBase={API_BASE} token={token} currentUser={currentUser} />}
              />
              <Route
                path="/deliveries/:deliveryId"
                element={<DeliveryTrackingPage token={token} currentUser={currentUser} />}
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
                  <ProfilePage
                    currentUser={currentUser} myReputation={myReputation}
                    loadingReputation={loadingReputation} reputationError={reputationError}
                    profileReviews={profileReviews} loadingProfileReviews={loadingProfileReviews}
                    profileReviewsError={profileReviewsError}
                    onUpdateProfile={handleProfileUpdate} profileUpdating={profileUpdating}
                    profileMessage={profileMessage} profileError={profileError}
                    onLogout={handleLogout} onDeleteAccount={handleDeleteAccount}
                    accountDeleting={accountDeleting} accountDeleteError={accountDeleteError}
                    myItems={myItems} myRequests={myRequests}
                    onLocationPrefsUpdated={loadItems}
                  />
                }
              />
              <Route path="/settings" element={<Navigate to="/profile" replace />} />
              <Route
                path="/login"
                element={<LoginPage apiBase={API_BASE} onSuccess={handleAuthSuccess} currentUser={currentUser} />}
              />
              <Route
                path="/signup"
                element={<SignupPage apiBase={API_BASE} onSuccess={handleAuthSuccess} currentUser={currentUser} />}
              />
              <Route path="/leaderboard" element={<LeaderboardPage apiBase={API_BASE} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {currentUser && !isMarketingHome ? (
            <nav className="md:hidden fixed bottom-0 left-1/2 z-50 flex h-14 w-full max-w-[480px] -translate-x-1/2 items-center justify-around border-t border-he-border bg-he-surface/90 px-2 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.03)] backdrop-blur-md dark:shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
              {bottomTabItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => [
                    'flex flex-col items-center justify-center flex-1 py-1 gap-0.5 text-[9px] font-bold tracking-wide transition-all duration-200',
                    isActive ? 'text-he-purple' : 'text-he-soft hover:text-he-ink',
                  ].join(' ')}
                >
                  {item.icon}
                  <span className="scale-90">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>

      {/* Global notification toast */}
      {(loadingUser || authError || authNotice || reviewMessage) ? (
        <div className="fixed bottom-6 right-6 z-50 w-64">
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
      </div>
    </NotificationProvider>
  )
}
