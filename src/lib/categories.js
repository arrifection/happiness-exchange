export const ITEM_CATEGORIES = [
  'Furniture',
  'Home',
  'Kitchen',
  'Electronics',
  'Clothes',
  'Kids',
  'Books',
  'Appliances',
  'Study',
  'Sports',
  'Toys',
  'Food',
  'Other',
]

export const BROWSE_CATEGORIES = [
  'All',
  'Furniture',
  'Home',
  'Kids Goods',
  'Books',
  'Kitchen',
  'Clothes',
  'Family Items',
  'Food',
  'Other',
]

export const STORAGE_CONDITIONS = [
  { value: 'room_temp', label: 'Room temperature' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'frozen', label: 'Frozen' },
]

export const ITEM_CONDITIONS = ['New', 'Like New', 'Good', 'Gently Used', 'Used']

export const NEED_URGENCIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
]

export function storageConditionLabel(value) {
  return STORAGE_CONDITIONS.find((option) => option.value === value)?.label || value
}

export function urgencyLabel(value) {
  return NEED_URGENCIES.find((option) => option.value === value)?.label || value
}
