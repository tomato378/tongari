import type { MbtiQuestion } from '../data/sampleQuestions'
import {
  GROUPING_RESPONSE_HEADERS,
  SHEET_BRIDGE_SHEET_NAME,
  SHEET_BRIDGE_URL,
} from './sheetConfig'

interface SelectedAnswer {
  question: MbtiQuestion
  optionIndex: 0 | 1
}

interface SubmitSurveyResponseInput {
  respondentName: string
  answers: SelectedAnswer[]
}

interface SheetBridgeResponse {
  ok?: boolean
  error?: string
}

export async function submitSurveyResponse({
  respondentName,
  answers,
}: SubmitSurveyResponseInput) {
  if (!SHEET_BRIDGE_URL) {
    throw new Error('送信先の Apps Script Web App URL が未設定です。')
  }

  if (!looksLikeAppsScriptWebAppUrl(SHEET_BRIDGE_URL)) {
    throw new Error(
      'VITE_SHEET_BRIDGE_URL にはスプレッドシートURLではなく Apps Script Web App URL を設定してください。',
    )
  }

  const response = await fetch(SHEET_BRIDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      sheet: SHEET_BRIDGE_SHEET_NAME || undefined,
      row: buildSubmissionRow({
        respondentName,
        answers,
      }),
    }),
  })

  const rawText = await response.text()
  const parsed = tryParseSheetBridgeResponse(rawText)

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'Apps Script Web App が認証必須になっています。デプロイ設定のアクセス権を見直し、公開された /exec URL を設定してください。',
    )
  }

  if (!response.ok) {
    throw new Error(`送信に失敗しました。HTTP ${response.status}`)
  }

  if (looksLikeSignInPage(rawText)) {
    throw new Error(
      'Apps Script Web App がサインイン画面を返しています。Web App の公開設定を見直してください。',
    )
  }

  if (parsed?.ok === false) {
    throw new Error(parsed.error || 'スプレッドシートへの保存に失敗しました。')
  }
}

function buildSubmissionRow({
  respondentName,
  answers,
}: SubmitSurveyResponseInput) {
  const row: Record<string, string> = {
    名前: respondentName.trim(),
  }

  answers.forEach((answer, index) => {
    const answerLetter = answer.optionIndex === 0 ? 'A' : 'B'
    row[getGroupingResponseHeader(index)] = answerLetter
  })

  return row
}

function getGroupingResponseHeader(index: number) {
  return GROUPING_RESPONSE_HEADERS[index] ?? `セクション${index + 1}の回答`
}

function tryParseSheetBridgeResponse(rawText: string) {
  try {
    return JSON.parse(rawText) as SheetBridgeResponse
  } catch {
    return null
  }
}

function looksLikeAppsScriptWebAppUrl(url: string) {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === 'script.google.com' &&
      parsed.pathname.startsWith('/macros/s/')
    )
  } catch {
    return false
  }
}

function looksLikeSignInPage(rawText: string) {
  const normalized = rawText.toLowerCase()

  return (
    normalized.includes('accounts.google.com') ||
    normalized.includes('signin') ||
    normalized.includes('<!doctype html')
  )
}
