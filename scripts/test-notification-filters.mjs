import assert from 'node:assert/strict'
import {
  filterNotificationsForUser,
  isAdminNotification,
  isStaffUser,
} from '../src/lib/notificationFilters.js'

const signupAlert = {
  id: '1',
  title: 'New User Signup',
  message: 'A new user (Test) has joined the platform.',
  type: 'new_user_signup',
  read: false,
}

const requestAlert = {
  id: '2',
  title: 'New request',
  message: 'Someone requested your item.',
  type: 'request_received',
  read: false,
}

const swapAlert = {
  id: '3',
  title: 'New Swap Offer',
  message: 'Someone sent you a swap offer for Nike Shoes.',
  type: 'exchange_offer_received',
  read: false,
}

const adminExchangeAlert = {
  id: '4',
  title: 'Exchange Accepted',
  message: 'Shipping coordination required.',
  type: 'exchange_admin_action',
  read: false,
}

assert.equal(isStaffUser('user'), false)
assert.equal(isStaffUser('admin'), true)
assert.equal(isAdminNotification(signupAlert), true)
assert.equal(isAdminNotification(requestAlert), false)
assert.equal(isAdminNotification(swapAlert), false)
assert.equal(isAdminNotification(adminExchangeAlert), true)

const filtered = filterNotificationsForUser([signupAlert, requestAlert, swapAlert, adminExchangeAlert])
assert.equal(filtered.length, 2)
assert.equal(filtered[0].id, '2')
assert.equal(filtered[1].id, '3')

const staffView = filterNotificationsForUser([signupAlert, requestAlert])
assert.equal(staffView.length, 1)

console.log('notificationFilters tests passed')
