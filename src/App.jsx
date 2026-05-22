import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

import BrowseItemsPage from './pages/BrowseItemsPage.jsx'
import AuthenticatedHomePage from './pages/AuthenticatedHomePage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import GiveItemPage from './pages/GiveItemPage.jsx'
import GiverHomePage from './pages/GiverHomePage.jsx'
import HomePage from './pages/HomePage.jsx'
import ItemDetailsPage from './pages/ItemDetailsPage.jsx'
import ItemListedSuccessPage from './pages/ItemListedSuccessPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RequestsPage from './pages/RequestsPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import BrandLogo from './components/BrandLogo.jsx'
import { ReviewModal } from './components/reputation.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import { Button, Surface } from './components/ui.jsx'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
const STATUS_ENDPOINT = `${API_BASE}/api/status`
const ME_ENDPOINT = `${API_BASE}/api/me`
const ITEMS_ENDPOINT = `${API_BASE}/api/items`
const ITEM_IMAGE_UPLOAD_ENDPOINT = `${API_BASE}/api/items/upload-image`
const MY_ITEMS_ENDPOINT = `${API_BASE}/api/items/my`
const MY_REQUESTS_ENDPOINT = `${API_BASE}/api/requests/my`
const PROFILE_ENDPOINT = `${API_BASE}/api/me`
const MY_REPUTATION_ENDPOINT = `${API_BASE}/api/me/reputation`
const REVIEWS_ENDPOINT = `${API_BASE}/api/reviews`
const TOKEN_KEY = 'happiness_exchange_token'
const MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024

const emptyItemForm = {
  title: '',
  description: '',
  category: '',
  condition: '',
  location: '',
  image_url: '',
  owner_name: '',
}

const tabItems = [
  { to: '/', label: 'Home' },
  { to: '/browse', label: 'Browse' },
  { to: '/give', label: 'Give' },
  { to: '/requests', label: 'Activity' },
  { to: '/dashboard', label: 'Profile' },
]

function formatApiError(errorData, fallbackMessage) {
  const detail = errorData?.detail

  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const readableIssues = detail
      .map((issue) => {
        if (typeof issue === 'string') {
          return issue
        }

        const fieldPath = Array.isArray(issue?.loc) ? issue.loc.slice(1).join(' ') : ''
        const message = typeof issue?.msg === 'string' ? issue.msg : ''
        return [fieldPath, message].filter(Boolean).join(': ')
      })
      .filter(Boolean)

    if (readableIssues.length > 0) {
      return readableIssues.join(' ')
    }
  }

  if (detail && typeof detail === 'object' && typeof detail.msg === 'string' && detail.msg.trim()) {
    return detail.msg
  }

  return fallbackMessage
}

function appTabClass(isActive) {
  return [
    'px-3 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap',
    isActive
      ? 'text-[#8b4cf6] bg-[#efe7ff] shadow-sm'
      : 'text-[#8c755f] hover:text-[#1f1f1f] hover:bg-[#fff3cc]',
  ].join(' ')
}

function getUserReviewsEndpoint(userId) {
  return `${API_BASE}/api/users/${userId}/reviews`
}

function AuthenticatedDashboardRoute({
  currentUser,
  items,
  myItems,
  myRequests,
  ownerRequests,
  myReputation,
  myItemsError,
  loadingMyItems,
  ownerItemsMessage,
  ownerItemsError,
  ownerActionItemId,
  onDeleteItem,
  onCompleteItem,
  onRequestAction,
  onOpenReview,
  getReviewContextForMyRequest,
  getReviewContextForOwnerRequest,
  loadingRequests,
  requestsMessage,
  requestsError,
}) {
  return currentUser?.account_type === 'giver' ? (
    <GiverHomePage
      currentUser={currentUser}
      myReputation={myReputation}
      myItems={myItems}
      myRequests={myRequests}
      myItemsError={myItemsError}
      loadingMyItems={loadingMyItems}
      ownerItemsMessage={ownerItemsMessage}
      ownerItemsError={ownerItemsError}
      ownerActionItemId={ownerActionItemId}
      onDeleteItem={onDeleteItem}
      onCompleteItem={onCompleteItem}
      ownerRequests={ownerRequests}
      onRequestAction={onRequestAction}
      onOpenReview={onOpenReview}
      getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
      loadingRequests={loadingRequests}
      requestsMessage={requestsMessage}
      requestsError={requestsError}
    />
  ) : (
    <DashboardPage
      currentUser={currentUser}
      items={items}
      myReputation={myReputation}
      myItems={myItems}
      myRequests={myRequests}
      ownerRequests={ownerRequests}
      onRequestAction={onRequestAction}
      onOpenReview={onOpenReview}
      getReviewContextForMyRequest={getReviewContextForMyRequest}
      getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
      loadingRequests={loadingRequests}
      requestsMessage={requestsMessage}
      requestsError={requestsError}
    />
  )
}

export default function App() {
  const location = useLocation()
  const [showSplash, setShowSplash] = useState(true)
  const [statusInfo, setStatusInfo] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
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
  const [myReputation, setMyReputation] = useState(null)
  const [loadingReputation, setLoadingReputation] = useState(false)
  const [reputationError, setReputationError] = useState('')
  const [profileReviews, setProfileReviews] = useState([])
  const [loadingProfileReviews, setLoadingProfileReviews] = useState(false)
  const [profileReviewsError, setProfileReviewsError] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewModalState, setReviewModalState] = useState(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const isRestoringSession = Boolean(token) && !currentUser
  const isLandingHome = !currentUser && location.pathname === '/'

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowSplash(false)
    }, 1800)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch(STATUS_ENDPOINT)
        const data = await response.json()
        if (response.ok) {
          setStatusInfo(data)
        } else {
          setStatusError('Platform is undergoing maintenance.')
        }
      } catch (err) {
        setStatusError('Unable to connect to community servers.')
      }
    }
    checkStatus()
  }, [])

  useEffect(() => {
    loadItems()
  }, [])

  useEffect(() => {
    if (token) {
      loadUserData()
    } else {
      setCurrentUser(null)
    }
  }, [token])

  useEffect(() => {
    if (currentUser) {
      loadMyItems()
      loadRequestData()
      loadMyReputation()
      loadProfileReviews(currentUser.id)
      setItemForm((current) => ({
        ...current,
        owner_name: current.owner_name || currentUser.name,
      }))
    }
  }, [currentUser])

  async function loadUserData() {
    setLoadingUser(true)
    setAuthError('')
    try {
      const response = await fetch(ME_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (response.ok) {
        setCurrentUser(data)
      } else {
        handleLogout()
        setAuthError(formatApiError(data, 'Session expired.'))
      }
    } catch (err) {
      setAuthError('Connection lost.')
    } finally {
      setLoadingUser(false)
    }
  }

  async function loadItems() {
    setLoadingItems(true)
    setItemsError('')
    try {
      const response = await fetch(ITEMS_ENDPOINT)
      const data = await response.json()
      if (response.ok) {
        setItems(data)
      } else {
        setItemsError('Failed to load items.')
      }
    } catch (err) {
      setItemsError('Unable to fetch community items.')
    } finally {
      setLoadingItems(false)
    }
  }

  async function loadMyItems() {
    if (!currentUser) {
      return
    }
    setLoadingMyItems(true)
    setMyItemsError('')
    try {
      const response = await fetch(MY_ITEMS_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (response.ok) {
        setMyItems(data)
      } else {
        setMyItemsError('Failed to load your items.')
      }
    } catch (err) {
      setMyItemsError('Connection issue.')
    } finally {
      setLoadingMyItems(false)
    }
  }

  async function loadRequestData() {
    if (!currentUser) {
      return
    }
    setLoadingRequests(true)
    setRequestsError('')
    try {
      const myResponse = await fetch(MY_REQUESTS_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const myData = await myResponse.json()

      const ownerResponse = await fetch(`${API_BASE}/api/requests/incoming`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const ownerData = await ownerResponse.json()

      if (myResponse.ok && ownerResponse.ok) {
        setMyRequests(myData)
        setOwnerRequests(ownerData)
      } else {
        setRequestsError('Failed to sync activity.')
      }
    } catch (err) {
      setRequestsError('Unable to sync activity.')
    } finally {
      setLoadingRequests(false)
    }
  }

  async function loadMyReputation() {
    if (!token) {
      setMyReputation(null)
      return
    }

    setLoadingReputation(true)
    setReputationError('')
    try {
      const response = await fetch(MY_REPUTATION_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (response.ok) {
        setMyReputation(data)
      } else {
        setReputationError(formatApiError(data, 'Unable to load your reputation.'))
      }
    } catch (error) {
      setReputationError('Unable to load your reputation.')
    } finally {
      setLoadingReputation(false)
    }
  }

  async function loadProfileReviews(userId) {
    if (!userId) {
      setProfileReviews([])
      return
    }

    setLoadingProfileReviews(true)
    setProfileReviewsError('')
    try {
      const response = await fetch(getUserReviewsEndpoint(userId))
      const data = await response.json()
      if (response.ok) {
        setProfileReviews(data)
      } else {
        setProfileReviewsError(formatApiError(data, 'Unable to load profile reviews.'))
      }
    } catch (error) {
      setProfileReviewsError('Unable to load profile reviews.')
    } finally {
      setLoadingProfileReviews(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setCurrentUser(null)
    setItems([])
    setMyItems([])
    setMyRequests([])
    setOwnerRequests([])
    setOwnerItemsMessage('')
    setOwnerItemsError('')
    setOwnerActionItemId('')
    setUploadingItemImage(false)
    setImageUploadMessage('')
    setImageUploadError('')
    setItemMessage('')
    setItemError('')
    setProfileMessage('')
    setProfileError('')
    setMyReputation(null)
    setReputationError('')
    setProfileReviews([])
    setProfileReviewsError('')
    setReviewMessage('')
    setReviewModalState(null)
  }

  function handleAuthSuccess(data) {
    setAuthError('')

    if (data.user) {
      setCurrentUser(data.user)
    }

    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token)
      setToken(data.access_token)
    }
  }

  function handleItemChange(event) {
    const { name, value } = event.target
    setItemForm((current) => ({ ...current, [name]: value }))
  }

  async function handleItemImageUpload(file) {
    if (!file) {
      return null
    }

    if (!file.type?.startsWith('image/')) {
      setImageUploadMessage('')
      setImageUploadError('Please choose an image file such as JPG, PNG, or WEBP.')
      setItemForm((current) => ({ ...current, image_url: '' }))
      return null
    }

    if (file.size > MAX_ITEM_IMAGE_BYTES) {
      setImageUploadMessage('')
      setImageUploadError('Please choose an image smaller than 5 MB.')
      setItemForm((current) => ({ ...current, image_url: '' }))
      return null
    }

    setUploadingItemImage(true)
    setItemError('')
    setItemMessage('')
    setImageUploadError('')
    setImageUploadMessage('')
    setItemForm((current) => ({ ...current, image_url: '' }))

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(ITEM_IMAGE_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(formatApiError(data, 'We could not upload that image right now.'))
      }

      setItemForm((current) => ({ ...current, image_url: data.secure_url }))
      setImageUploadMessage('Image uploaded and ready to publish.')
      return data.secure_url
    } catch (error) {
      setImageUploadError(error.message)
      setItemForm((current) => ({ ...current, image_url: '' }))
      return null
    } finally {
      setUploadingItemImage(false)
    }
  }

  async function handleCreateItem(event) {
    event.preventDefault()

    if (uploadingItemImage) {
      setItemError('Please wait for the image upload to finish before publishing.')
      return null
    }

    setCreatingItem(true)
    setItemError('')
    setItemMessage('')

    try {
      const response = await fetch(ITEMS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(itemForm),
      })

      const data = await response.json()
      if (response.ok) {
        setItemMessage('Item published successfully!')
        setLastPublishedItem(data)
        setImageUploadMessage('')
        setImageUploadError('')
        setItemForm({
          ...emptyItemForm,
          owner_name: currentUser?.name || '',
        })
        await loadItems()
        await loadMyItems()
        return data
      }
      throw new Error(formatApiError(data, 'Publishing failed.'))
    } catch (err) {
      setItemError(err.message)
      return null
    } finally {
      setCreatingItem(false)
    }
  }

  async function handleCreateRequest(itemId) {
    setRequestsError('')
    setRequestsMessage('')
    try {
      const response = await fetch(`${API_BASE}/api/requests/${itemId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Request failed.'))
      }
      setRequestsMessage('Request sent to owner!')
      await loadItems()
      await loadRequestData()
      return data
    } catch (err) {
      setRequestsError(err.message)
      return null
    }
  }

  async function handleRequestAction(requestId, action) {
    setRequestsError('')
    setRequestsMessage('')
    try {
      const response = await fetch(`${API_BASE}/api/requests/${requestId}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Action failed.'))
      }
      setRequestsMessage(
        action === 'approve'
          ? 'That request has been approved and the item is now reserved.'
          : 'That request has been declined.',
      )
      await loadItems()
      await loadMyItems()
      await loadRequestData()
      return data
    } catch (error) {
      setRequestsError(error.message)
      return null
    }
  }

  function replaceItemAcrossLists(updatedItem) {
    setItems((current) => current.map((item) => (item.id === updatedItem.id ? updatedItem : item)))
    setMyItems((current) => current.map((item) => (item.id === updatedItem.id ? updatedItem : item)))
  }

  async function handleDeleteItem(item) {
    if (!window.confirm(`Delete "${item.title}"? This action cannot be undone.`)) {
      return false
    }

    setOwnerActionItemId(item.id)
    setOwnerItemsError('')
    setOwnerItemsMessage('')

    try {
      const response = await fetch(`${ITEMS_ENDPOINT}/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorData = null
        try {
          errorData = await response.json()
        } catch {
          errorData = null
        }
        throw new Error(formatApiError(errorData, 'Unable to delete this item.'))
      }

      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
      setMyItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
      setOwnerRequests((current) => current.filter((request) => request.item_id !== item.id))
      setOwnerItemsMessage(`"${item.title}" was deleted successfully.`)
      await loadMyReputation()
      return true
    } catch (error) {
      setOwnerItemsError(error.message)
      return false
    } finally {
      setOwnerActionItemId('')
    }
  }

  async function handleCompleteItem(item) {
    setOwnerActionItemId(item.id)
    setOwnerItemsError('')
    setOwnerItemsMessage('')

    try {
      const response = await fetch(`${ITEMS_ENDPOINT}/${item.id}/complete`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Unable to mark this item as completed.'))
      }

      replaceItemAcrossLists(data)
      setOwnerItemsMessage(`"${item.title}" is now marked as successfully taken.`)
      await loadItems()
      await loadMyItems()
      await loadRequestData()
      await loadMyReputation()
      return data
    } catch (error) {
      setOwnerItemsError(error.message)
      return null
    } finally {
      setOwnerActionItemId('')
    }
  }

  async function handleProfileUpdate(nextName) {
    setProfileUpdating(true)
    setProfileMessage('')
    setProfileError('')

    try {
      const response = await fetch(PROFILE_ENDPOINT, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: nextName }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Unable to update your profile.'))
      }

      setCurrentUser(data)
      setMyItems((current) =>
        current.map((item) => (item.owner_id === data.id ? { ...item, owner_name: data.name } : item)),
      )
      setItems((current) =>
        current.map((item) => (item.owner_id === data.id ? { ...item, owner_name: data.name } : item)),
      )
      setMyRequests((current) =>
        current.map((request) => (request.requester_id === data.id ? { ...request, requester_name: data.name } : request)),
      )
      setOwnerRequests((current) =>
        current.map((request) => {
          const nextRequest = { ...request }
          if (request.requester_id === data.id) {
            nextRequest.requester_name = data.name
          }
          if (request.owner_id === data.id) {
            nextRequest.owner_name = data.name
          }
          return nextRequest
        }),
      )
      setProfileMessage('Profile updated successfully.')
      return data
    } catch (error) {
      setProfileError(error.message)
      return null
    } finally {
      setProfileUpdating(false)
    }
  }

  function openReviewModal(reviewContext) {
    if (!reviewContext) {
      return
    }

    setReviewModalState(reviewContext)
  }

  function closeReviewModal() {
    if (reviewSubmitting) {
      return
    }

    setReviewModalState(null)
  }

  async function handleSubmitReview({ rating, comment }) {
    if (!reviewModalState) {
      return { error: 'Review details are missing.' }
    }

    setReviewSubmitting(true)
    try {
      const response = await fetch(REVIEWS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: reviewModalState.itemId,
          reviewed_user_id: reviewModalState.reviewedUserId,
          rating,
          comment,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        return { error: formatApiError(data, 'Unable to submit your review.') }
      }

      setReviewMessage('Review submitted successfully.')
      setReviewModalState(null)
      await loadItems()
      await loadMyItems()
      await loadRequestData()
      await loadMyReputation()
      if (currentUser?.id) {
        await loadProfileReviews(currentUser.id)
      }
      return { success: true, data }
    } catch (error) {
      return { error: 'Unable to submit your review.' }
    } finally {
      setReviewSubmitting(false)
    }
  }

  function getMyRequestForItem(itemId) {
    return myRequests.find((request) => request.item_id === itemId)
  }

  function hasSubmittedReviewForItem(itemId) {
    return Boolean(myReputation?.submitted_review_item_ids?.includes(itemId))
  }

  function getReviewContextForItem(item) {
    if (!currentUser || !item || item.owner_id === currentUser.id) {
      return null
    }

    const myRequest = getMyRequestForItem(item.id)
    if (item.status !== 'completed' || myRequest?.status !== 'approved' || hasSubmittedReviewForItem(item.id)) {
      return null
    }

    return {
      itemId: item.id,
      itemTitle: item.title,
      reviewedUserId: item.owner_id,
      reviewedUserName: item.owner_name,
    }
  }

  function getReviewContextForMyRequest(request) {
    if (!currentUser || !request || request.status !== 'approved' || hasSubmittedReviewForItem(request.item_id)) {
      return null
    }

    const relatedItem = items.find((item) => item.id === request.item_id)
    if (!relatedItem || relatedItem.status !== 'completed') {
      return null
    }

    return {
      itemId: request.item_id,
      itemTitle: request.item_title,
      reviewedUserId: relatedItem.owner_id,
      reviewedUserName: relatedItem.owner_name,
    }
  }

  function getReviewContextForOwnerRequest(request) {
    if (!currentUser || !request || request.status !== 'approved' || hasSubmittedReviewForItem(request.item_id)) {
      return null
    }

    const relatedItem = myItems.find((item) => item.id === request.item_id)
    if (!relatedItem || relatedItem.status !== 'completed') {
      return null
    }

    return {
      itemId: request.item_id,
      itemTitle: request.item_title,
      reviewedUserId: request.requester_id,
      reviewedUserName: request.requester_name,
    }
  }

  if (isRestoringSession) {
    return (
      <div className="flex min-h-screen flex-col bg-[#fffaf0]">
        <SplashScreen visible={showSplash} />
        <main className={`app-shell flex flex-1 items-center justify-center py-8 transition-opacity duration-500 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>
          <Surface className="w-full max-w-md p-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">Restoring Session</p>
            <h1 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328]">
              Verifying your account
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#68766d]">
              We&apos;re signing you back in so your items and requests open in the right place.
            </p>
          </Surface>
        </main>
      </div>
    )
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
      to: '/requests',
      label: 'Activity',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
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

  return (
    <div className="flex flex-1 flex-col">
      <SplashScreen visible={showSplash} />
      {currentUser ? (
        <div className={`flex flex-1 flex-col transition-opacity duration-500 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>
          {!isLandingHome ? (
            <header className="sticky top-0 z-50 border-b border-[#efe8da] bg-white/80 backdrop-blur-md">
            <div className="flex h-14 items-center px-4 mx-auto w-full max-w-[1280px] md:px-6">
              {/* Left: Logo */}
              <div className="flex flex-1 items-center justify-start">
                <NavLink to="/" className="flex items-center gap-2">
                  <BrandLogo size="sm" showText={true} className="min-w-0" />
                </NavLink>
              </div>

              {/* Center: Desktop Navigation Links */}
              <nav className="hidden md:flex items-center justify-center gap-8">
                <NavLink
                  to="/"
                  className={({ isActive }) => [
                    'px-4 py-2 rounded-full text-[14px] font-bold tracking-wide transition-all duration-300',
                    isActive ? 'bg-[#efe7ff] text-[#8b4cf6] shadow-xs' : 'text-[#8c755f] hover:text-[#8b4cf6] hover:bg-[#faf7f1]',
                  ].join(' ')}
                >
                  Home
                </NavLink>
                <NavLink
                  to="/browse"
                  className={({ isActive }) => [
                    'px-4 py-2 rounded-full text-[14px] font-bold tracking-wide transition-all duration-300',
                    isActive ? 'bg-[#efe7ff] text-[#8b4cf6] shadow-xs' : 'text-[#8c755f] hover:text-[#8b4cf6] hover:bg-[#faf7f1]',
                  ].join(' ')}
                >
                  Browse
                </NavLink>
                <NavLink
                  to="/give"
                  className={({ isActive }) => [
                    'px-4 py-2 rounded-full text-[14px] font-bold tracking-wide transition-all duration-300',
                    isActive ? 'bg-[#efe7ff] text-[#8b4cf6] shadow-xs' : 'text-[#8c755f] hover:text-[#8b4cf6] hover:bg-[#faf7f1]',
                  ].join(' ')}
                >
                  Give Item
                </NavLink>
                <NavLink
                  to="/requests"
                  className={({ isActive }) => [
                    'px-4 py-2 rounded-full text-[14px] font-bold tracking-wide transition-all duration-300',
                    isActive ? 'bg-[#efe7ff] text-[#8b4cf6] shadow-xs' : 'text-[#8c755f] hover:text-[#8b4cf6] hover:bg-[#faf7f1]',
                  ].join(' ')}
                >
                  Activity
                </NavLink>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => [
                    'px-4 py-2 rounded-full text-[14px] font-bold tracking-wide transition-all duration-300',
                    isActive ? 'bg-[#efe7ff] text-[#8b4cf6] shadow-xs' : 'text-[#8c755f] hover:text-[#8b4cf6] hover:bg-[#faf7f1]',
                  ].join(' ')}
                >
                  Dashboard
                </NavLink>
              </nav>

              {/* Right: Profile */}
              <div className="flex flex-1 items-center justify-end gap-2">
                <NavLink
                  to="/profile"
                  className={({ isActive }) => [
                    'inline-flex h-8 w-8 items-center justify-center rounded-btn border border-transparent text-[#8c755f] transition-all duration-200 hover:bg-[#fff3cc] hover:text-[#1f1f1f]',
                    isActive ? 'bg-[#efe7ff] text-[#8b4cf6] shadow-xs' : '',
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

          <main className={isLandingHome ? 'flex-1' : 'app-shell flex-1 pt-4 pb-20 md:pb-8'}>
            <Routes>
              <Route
                path="/"
                element={(
                  <AuthenticatedHomePage
                    items={items}
                    currentUser={currentUser}
                    myReputation={myReputation}
                    getMyRequestForItem={getMyRequestForItem}
                    getReviewContextForItem={getReviewContextForItem}
                    onCreateRequest={handleCreateRequest}
                    onOpenReview={openReviewModal}
                    loadingItems={loadingItems}
                    itemsError={itemsError}
                    myRequests={myRequests}
                    ownerRequests={ownerRequests}
                  />
                )}
              />
              <Route
                path="/browse"
                element={(
                  <BrowseItemsPage
                    items={items}
                    currentUser={currentUser}
                    getMyRequestForItem={getMyRequestForItem}
                    getReviewContextForItem={getReviewContextForItem}
                    onCreateRequest={handleCreateRequest}
                    onOpenReview={openReviewModal}
                    onRefreshItems={loadItems}
                    loadingItems={loadingItems}
                    itemsError={itemsError}
                  />
                )}
              />
              <Route
                path="/give"
                element={(
                  <GiveItemPage
                    currentUser={currentUser}
                    itemForm={itemForm}
                    onItemChange={handleItemChange}
                    onItemImageUpload={handleItemImageUpload}
                    onCreateItem={handleCreateItem}
                    creatingItem={creatingItem}
                    uploadingItemImage={uploadingItemImage}
                    itemMessage={itemMessage}
                    itemError={itemError}
                    imageUploadMessage={imageUploadMessage}
                    imageUploadError={imageUploadError}
                  />
                )}
              />
              <Route
                path="/items/:itemId"
                element={(
                  <ItemDetailsPage
                    currentUser={currentUser}
                    items={items}
                    myItems={myItems}
                    getMyRequestForItem={getMyRequestForItem}
                    getReviewContextForItem={getReviewContextForItem}
                    onCreateRequest={handleCreateRequest}
                    onOpenReview={openReviewModal}
                    onDeleteItem={handleDeleteItem}
                    onCompleteItem={handleCompleteItem}
                    ownerActionItemId={ownerActionItemId}
                  />
                )}
              />
              <Route
                path="/item-listed-success"
                element={(
                  <ItemListedSuccessPage
                    currentUser={currentUser}
                    publishedItem={lastPublishedItem}
                  />
                )}
              />
              <Route
                path="/dashboard"
                element={(
                  <AuthenticatedDashboardRoute
                    currentUser={currentUser}
                    items={items}
                    myReputation={myReputation}
                    myItems={myItems}
                    myRequests={myRequests}
                    ownerRequests={ownerRequests}
                    myItemsError={myItemsError}
                    loadingMyItems={loadingMyItems}
                    ownerItemsMessage={ownerItemsMessage}
                    ownerItemsError={ownerItemsError}
                    ownerActionItemId={ownerActionItemId}
                    onDeleteItem={handleDeleteItem}
                    onCompleteItem={handleCompleteItem}
                    onRequestAction={handleRequestAction}
                    onOpenReview={openReviewModal}
                    getReviewContextForMyRequest={getReviewContextForMyRequest}
                    getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
                    loadingRequests={loadingRequests}
                    requestsMessage={requestsMessage}
                    requestsError={requestsError}
                  />
                )}
              />
              <Route
                path="/requests"
                element={(
                  <RequestsPage
                    currentUser={currentUser}
                    ownerRequests={ownerRequests}
                    myItems={myItems}
                    onOpenReview={openReviewModal}
                    getReviewContextForOwnerRequest={getReviewContextForOwnerRequest}
                    loadingRequests={loadingRequests}
                    requestsMessage={requestsMessage}
                    requestsError={requestsError}
                    onRequestAction={handleRequestAction}
                  />
                )}
              />
              <Route
                path="/profile"
                element={(
                  <ProfilePage
                    currentUser={currentUser}
                    myReputation={myReputation}
                    loadingReputation={loadingReputation}
                    reputationError={reputationError}
                    profileReviews={profileReviews}
                    loadingProfileReviews={loadingProfileReviews}
                    profileReviewsError={profileReviewsError}
                    onUpdateProfile={handleProfileUpdate}
                    profileUpdating={profileUpdating}
                    profileMessage={profileMessage}
                    profileError={profileError}
                    onLogout={handleLogout}
                    myItems={myItems}
                    myRequests={myRequests}
                  />
                )}
              />
              <Route
                path="/settings"
                element={<Navigate to="/profile" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {!isLandingHome ? (
            <nav className="md:hidden fixed bottom-0 left-1/2 z-50 flex h-14 w-full max-w-[480px] -translate-x-1/2 items-center justify-around border-t border-[#efe8da] bg-white/90 px-2 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.03)] backdrop-blur-md">
              {bottomTabItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => [
                    'flex flex-col items-center justify-center flex-1 py-1 gap-0.5 text-[9px] font-bold tracking-wide transition-all duration-200',
                    isActive ? 'text-[#8b4cf6]' : 'text-[#8c755f] hover:text-[#1f1f1f]',
                  ].join(' ')}
                >
                  {item.icon}
                  <span className="scale-90">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>
      ) : (
        <main className={`flex flex-1 flex-col transition-opacity duration-500 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>
          <Routes>
            <Route
              path="/"
              element={(
                <HomePage
                  items={items}
                  currentUser={currentUser}
                  getMyRequestForItem={getMyRequestForItem}
                  onCreateRequest={handleCreateRequest}
                  loadingItems={loadingItems}
                  itemsError={itemsError}
                  myRequests={myRequests}
                  ownerRequests={ownerRequests}
                />
              )}
            />
            <Route
              path="/login"
              element={(
                <LoginPage
                  apiBase={API_BASE}
                  onSuccess={handleAuthSuccess}
                  currentUser={currentUser}
                />
              )}
            />
            <Route
              path="/signup"
              element={(
                <SignupPage
                  apiBase={API_BASE}
                  onSuccess={handleAuthSuccess}
                  currentUser={currentUser}
                />
              )}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      )}

      {(loadingUser || authError || reviewMessage) ? (
        <div className="fixed bottom-6 right-6 z-50 w-64">
          <Surface className="border-[#8b4cf6]/10 p-4 shadow-xl ring-1 ring-[#8b4cf6]/5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">System Notification</h2>
            {loadingUser ? <p className="mt-1 text-xs text-[#68766d]">Verifying profile...</p> : null}
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
  )
}
