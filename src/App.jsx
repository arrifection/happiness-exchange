import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'

import BrowseItemsPage from './pages/BrowseItemsPage.jsx'
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

export default function App() {
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
  const isRestoringSession = Boolean(token) && !currentUser

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
    if (token) {
      loadUserData()
    } else {
      setCurrentUser(null)
    }
  }, [token])

  useEffect(() => {
    if (currentUser) {
      loadItems()
      loadMyItems()
      loadRequestData()
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
      await loadRequestData()
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

  function getMyRequestForItem(itemId) {
    return myRequests.find((request) => request.item_id === itemId)
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

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf0]">
      <SplashScreen visible={showSplash} />
      {currentUser ? (
        <div className={`flex flex-1 flex-col transition-opacity duration-500 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>
          <header className="sticky top-0 z-50 border-b border-[#f1e2b8] bg-white/85 shadow-sm backdrop-blur-xl">
            <div className="app-shell flex h-14 items-center justify-between gap-4 sm:h-16">
              <BrandLogo size="sm" className="min-w-0" />

              <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {tabItems.map((item) => (
                  <NavLink key={item.to} className={({ isActive }) => appTabClass(isActive)} to={item.to}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <NavLink
                  to="/profile"
                  className={({ isActive }) => [
                    'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[#8c755f] transition-all duration-300 hover:bg-[#fff3cc] hover:text-[#1f1f1f]',
                    isActive ? 'bg-[#efe7ff] text-[#8b4cf6] shadow-sm' : '',
                  ].join(' ')}
                  aria-label="Open profile settings"
                >
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />
                  </svg>
                </NavLink>
                <Button variant="ghost" className="h-9 min-h-0 px-3 text-[10px] font-bold uppercase tracking-widest text-[#c65d4a] hover:bg-[#c65d4a]/5" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="app-shell flex-1 py-8">
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
                path="/browse"
                element={(
                  <BrowseItemsPage
                    items={items}
                    currentUser={currentUser}
                    getMyRequestForItem={getMyRequestForItem}
                    onCreateRequest={handleCreateRequest}
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
                    onCreateRequest={handleCreateRequest}
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
                  currentUser?.account_type === 'giver' ? (
                    <GiverHomePage
                      currentUser={currentUser}
                      myItems={myItems}
                      myItemsError={myItemsError}
                      loadingMyItems={loadingMyItems}
                      ownerItemsMessage={ownerItemsMessage}
                      ownerItemsError={ownerItemsError}
                      ownerActionItemId={ownerActionItemId}
                      onDeleteItem={handleDeleteItem}
                      onCompleteItem={handleCompleteItem}
                      ownerRequests={ownerRequests}
                      onRequestAction={handleRequestAction}
                      loadingRequests={loadingRequests}
                      requestsMessage={requestsMessage}
                      requestsError={requestsError}
                    />
                  ) : (
                    <DashboardPage
                      currentUser={currentUser}
                      myRequests={myRequests}
                      ownerRequests={ownerRequests}
                      onRequestAction={handleRequestAction}
                      loadingRequests={loadingRequests}
                      requestsMessage={requestsMessage}
                      requestsError={requestsError}
                    />
                  )
                )}
              />
              <Route
                path="/requests"
                element={(
                  <RequestsPage
                    currentUser={currentUser}
                    ownerRequests={ownerRequests}
                    myItems={myItems}
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
                    onUpdateProfile={handleProfileUpdate}
                    profileUpdating={profileUpdating}
                    profileMessage={profileMessage}
                    profileError={profileError}
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
        </div>
      ) : (
        <main className={`flex flex-1 flex-col transition-opacity duration-500 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>
          <Routes>
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
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      )}

      {(loadingUser || authError) ? (
        <div className="fixed bottom-6 right-6 z-50 w-64">
          <Surface className="border-[#8b4cf6]/10 p-4 shadow-xl ring-1 ring-[#8b4cf6]/5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">System Notification</h2>
            {loadingUser ? <p className="mt-1 text-xs text-[#68766d]">Verifying profile...</p> : null}
            {authError ? <p className="mt-1 text-xs font-medium text-[#c65d4a]">{authError}</p> : null}
          </Surface>
        </div>
      ) : null}
    </div>
  )
}
