import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'

import BrowseItemsPage from './pages/BrowseItemsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import GiveItemPage from './pages/GiveItemPage.jsx'
import GiverHomePage from './pages/GiverHomePage.jsx'
import HomePage from './pages/HomePage.jsx'
import ItemListedSuccessPage from './pages/ItemListedSuccessPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import { Button, Surface } from './components/ui.jsx'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const STATUS_ENDPOINT = `${API_BASE}/api/status`
const ME_ENDPOINT = `${API_BASE}/api/me`
const ITEMS_ENDPOINT = `${API_BASE}/api/items`
const MY_ITEMS_ENDPOINT = `${API_BASE}/api/items/my`
const MY_REQUESTS_ENDPOINT = `${API_BASE}/api/requests/my`
const TOKEN_KEY = 'happiness_exchange_token'

const emptyItemForm = {
  title: '',
  description: '',
  category: '',
  condition: '',
  location: '',
  image_url: '',
}

function navClassName(isActive) {
  return [
    'rounded-full px-4 py-2 text-sm font-medium transition duration-300',
    isActive
      ? 'bg-white text-[#1f443a] shadow-[0_10px_30px_rgba(32,53,46,0.12)]'
      : 'text-[#5d6b66] hover:bg-white/70 hover:text-[#20352e]',
  ].join(' ')
}

export default function App() {
  const [statusInfo, setStatusInfo] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [loadingUser, setLoadingUser] = useState(false)
  const [items, setItems] = useState([])
  const [itemsError, setItemsError] = useState('')
  const [loadingItems, setLoadingItems] = useState(true)
  const [myItems, setMyItems] = useState([])
  const [myItemsError, setMyItemsError] = useState('')
  const [loadingMyItems, setLoadingMyItems] = useState(false)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [itemMessage, setItemMessage] = useState('')
  const [itemError, setItemError] = useState('')
  const [creatingItem, setCreatingItem] = useState(false)
  const [lastPublishedItem, setLastPublishedItem] = useState(null)
  const [myRequests, setMyRequests] = useState([])
  const [ownerRequests, setOwnerRequests] = useState([])
  const [requestsError, setRequestsError] = useState('')
  const [requestsMessage, setRequestsMessage] = useState('')
  const [loadingRequests, setLoadingRequests] = useState(false)

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await fetch(STATUS_ENDPOINT)
        const data = await response.json()
        setStatusInfo(data)
      } catch {
        setStatusError(`Could not reach ${STATUS_ENDPOINT}`)
      }
    }

    loadStatus()
  }, [])

  useEffect(() => {
    loadItems()
  }, [])

  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      setMyItems([])
      setMyRequests([])
      setOwnerRequests([])
      return
    }

    async function loadCurrentUser() {
      setLoadingUser(true)
      setAuthError('')

      try {
        const response = await fetch(ME_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Could not load current user.')
        }

        const data = await response.json()
        setCurrentUser(data)
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
        setCurrentUser(null)
        setAuthError(error.message)
      } finally {
        setLoadingUser(false)
      }
    }

    loadCurrentUser()
  }, [token])

  useEffect(() => {
    if (!currentUser || !token) {
      return
    }

    loadMyItems(currentUser, token)
  }, [currentUser, token])

  useEffect(() => {
    if (!currentUser || !token) {
      return
    }

    loadRequestData(currentUser, token)
  }, [currentUser, token, myItems])

  async function loadItems() {
    setLoadingItems(true)
    setItemsError('')

    try {
      const response = await fetch(ITEMS_ENDPOINT)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Could not load items.')
      }

      const data = await response.json()
      setItems(data)
    } catch (error) {
      setItemsError(error.message)
    } finally {
      setLoadingItems(false)
    }
  }

  async function loadMyItems(user = currentUser, authToken = token) {
    if (!user || !authToken) {
      return
    }

    setLoadingMyItems(true)
    setMyItemsError('')

    try {
      const response = await fetch(MY_ITEMS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Could not load your items.')
      }

      const data = await response.json()
      setMyItems(data)
    } catch (error) {
      setMyItemsError(error.message)
    } finally {
      setLoadingMyItems(false)
    }
  }

  async function loadRequestData(user = currentUser, authToken = token) {
    if (!user || !authToken) {
      return
    }

    setLoadingRequests(true)
    setRequestsError('')

    try {
      const myRequestsResponse = await fetch(MY_REQUESTS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (!myRequestsResponse.ok) {
        const errorData = await myRequestsResponse.json()
        throw new Error(errorData.detail || 'Could not load your requests.')
      }

      const myRequestsData = await myRequestsResponse.json()
      setMyRequests(myRequestsData)

      const ownedItems = myItems.filter((item) => item.owner_id === user.id)
      const ownerRequestLists = await Promise.all(
        ownedItems.map(async (item) => {
          const response = await fetch(`${API_BASE}/api/items/${item.id}/requests`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || 'Could not load item requests.')
          }

          return response.json()
        }),
      )

      setOwnerRequests(ownerRequestLists.flat())
    } catch (error) {
      setRequestsError(error.message)
    } finally {
      setLoadingRequests(false)
    }
  }

  function handleAuthSuccess(data) {
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setToken(data.access_token)
    setCurrentUser(data.user)
    setAuthError('')
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setCurrentUser(null)
    setMyItems([])
    setMyItemsError('')
    setAuthError('')
    setRequestsMessage('')
    setItemMessage('')
  }

  function handleItemChange(event) {
    const { name, value } = event.target
    setItemForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleCreateItem(event) {
    event.preventDefault()
    setCreatingItem(true)
    setItemMessage('')
    setItemError('')

    try {
      const payload = {
        ...itemForm,
        image_url: itemForm.image_url.trim() || null,
      }

      const response = await fetch(ITEMS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Could not create item.')
      }

      setItems((current) => [data, ...current])
      setMyItems((current) => [data, ...current])
      setLastPublishedItem(data)
      setItemForm(emptyItemForm)
      setItemMessage('Your free listing is now live for the community.')
      return data
    } catch (error) {
      setItemError(error.message)
      return null
    } finally {
      setCreatingItem(false)
    }
  }

  async function handleCreateRequest(itemId) {
    setRequestsMessage('')
    setRequestsError('')

    try {
      const response = await fetch(`${API_BASE}/api/requests/${itemId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Could not create request.')
      }

      setMyRequests((current) => [data, ...current])
      setRequestsMessage('Your interest was shared with the item owner.')
    } catch (error) {
      setRequestsError(error.message)
    }
  }

  async function handleRequestAction(requestId, action) {
    setRequestsMessage('')
    setRequestsError('')

    try {
      const response = await fetch(`${API_BASE}/api/requests/${requestId}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || `Could not ${action} request.`)
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

  function getMyRequestForItem(itemId) {
    return myRequests.find((request) => request.item_id === itemId)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(237,180,145,0.28),transparent_52%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-24 -z-10 h-72 w-72 rounded-full bg-[#f0b89d]/35 blur-3xl" />
      <div className="pointer-events-none absolute left-[-6rem] top-[34rem] -z-10 h-80 w-80 rounded-full bg-[#9cc2ae]/30 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <Surface className="sticky top-4 z-30 mb-8 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1d6b57,#8ab59f)] text-lg font-semibold text-white shadow-[0_18px_45px_rgba(29,107,87,0.32)]">
                HE
              </div>
              <div>
                <p className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-lg font-semibold tracking-[-0.03em] text-[#20352e]">
                  Happiness Exchange
                </p>
                <p className="mt-1 max-w-md text-sm text-[#6d7975]">
                  A beautiful place to give freely, receive kindly, and keep useful things in the community.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:items-end">
              <div className="flex flex-wrap items-center gap-2 rounded-full bg-[#f7f1e8]/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <NavLink className={({ isActive }) => navClassName(isActive)} to="/">
                  Home
                </NavLink>
                <NavLink className={({ isActive }) => navClassName(isActive)} to="/browse">
                  Browse
                </NavLink>
                <NavLink className={({ isActive }) => navClassName(isActive)} to="/give">
                  Give Item
                </NavLink>
                <NavLink className={({ isActive }) => navClassName(isActive)} to="/dashboard">
                  Dashboard
                </NavLink>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold text-[#5c6a65] shadow-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#6fa784]" />
                  {statusInfo ? `${statusInfo.status} backend` : statusError || 'Checking backend'}
                </span>

                {currentUser ? (
                  <>
                    <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm text-[#4f615b] shadow-sm">
                      Signed in as {currentUser.name}
                    </span>
                    <Button variant="ghost" onClick={handleLogout}>
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Button as="link" to="/login" variant="ghost">
                      Login
                    </Button>
                    <Button as="link" to="/signup">
                      Signup
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Surface>

        <main className="flex-1">
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
                  onCreateItem={handleCreateItem}
                  creatingItem={creatingItem}
                  itemMessage={itemMessage}
                  itemError={itemError}
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

        {(loadingUser || authError) ? (
          <div className="mt-8">
            <Surface className="mx-auto max-w-3xl p-6">
              <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold text-[#20352e]">
                Activity
              </h2>
              {loadingUser ? <p className="mt-3 text-sm text-[#687670]">Loading your account...</p> : null}
              {authError ? <p className="mt-3 text-sm font-medium text-[#b04e43]">{authError}</p> : null}
            </Surface>
          </div>
        ) : null}
      </div>
    </div>
  )
}
