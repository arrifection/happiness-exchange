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

assert.equal(isStaffUser('user'), false)
assert.equal(isStaffUser('admin'), true)
assert.equal(isAdminNotification(signupAlert), true)
assert.equal(isAdminNotification(requestAlert), false)

const filtered = filterNotificationsForUser([signupAlert, requestAlert])
assert.equal(filtered.length, 1)
assert.equal(filtered[0].id, '2')

const staffView = filterNotificationsForUser([signupAlert, requestAlert])
assert.equal(staffView.length, 1)

console.log('notificationFilters tests passed')
