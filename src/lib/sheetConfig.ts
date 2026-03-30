export const FIXED_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1ph3FBqdwqknpJQJCdTZ8wKfP917m2fQeJw5ZFk1oIDo/edit?resourcekey=&gid=1134375871#gid=1134375871'

export const FIXED_SPREADSHEET_NAME = 'トンガリーズ学園祭タイプ分け（回答）'

export const SHEET_BRIDGE_URL = (import.meta.env.VITE_SHEET_BRIDGE_URL ?? '').trim()

export const SHEET_BRIDGE_SHEET_NAME = (import.meta.env.VITE_SHEET_BRIDGE_SHEET_NAME ?? '').trim()

export const GROUPING_SOURCE_SHEET_NAME = 'シート2'

export const FIXED_GROUPING_SOURCE_URL = SHEET_BRIDGE_URL
  ? `${SHEET_BRIDGE_URL}?sheet=${encodeURIComponent(GROUPING_SOURCE_SHEET_NAME)}`
  : FIXED_SPREADSHEET_URL

export const GROUPING_RESPONSE_HEADERS = [
  'セクション1の回答',
  'セクション2の回答',
  'セクション3の回答',
  'セクション4の回答',
] as const
