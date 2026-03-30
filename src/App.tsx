import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Papa from 'papaparse'
import {
  compatibilityRows,
  createEmptyCounts,
  findMbtiType,
  generateParticipantGroups,
  summarizeActiveCounts,
  type GeneratedParticipantGroup,
  type MbtiCounts,
  type ParticipantRecord,
} from './lib/mbti'
import {
  FIXED_GROUPING_SOURCE_URL,
  FIXED_SPREADSHEET_NAME,
  FIXED_SPREADSHEET_URL,
  GROUPING_RESPONSE_HEADERS,
} from './lib/sheetConfig'

const MIN_GROUP_SIZE = 4
const MAX_GROUP_SIZE = 6
const DEFAULT_TARGET_SIZE = 5

type CsvRow = Record<string, string>
type ImportMode = 'questionnaire' | 'direct'
type QuestionColumnKey = 'q1' | 'q2' | 'q3' | 'q4'

interface CsvDataSet {
  sourceName: string
  headers: string[]
  rows: CsvRow[]
}

interface QuestionColumns {
  q1: string
  q2: string
  q3: string
  q4: string
}

interface SkippedRow {
  rowNumber: number
  rawName: string
  rawMbti: string
  reason: string
}

interface ParticipantImportPreview {
  participants: ParticipantRecord[]
  skippedRows: SkippedRow[]
  counts: MbtiCounts
}

interface AppliedImportState extends ParticipantImportPreview {
  sourceName: string | null
  selectionSignature: string
}

interface ImportSelection {
  nameColumn: string
  mbtiColumn: string
  questionColumns: QuestionColumns
  mode: ImportMode
}

interface BoardGroupSnapshot {
  id: string
  label: string
  members: string[]
}

interface BoardSnapshot {
  createdAt: string
  sourceName: string | null
  totalParticipants: number
  targetSize: number
  groups: BoardGroupSnapshot[]
}

const QUESTION_LABELS: Record<QuestionColumnKey, string> = {
  q1: '質問1 (E / I)',
  q2: '質問2 (S / N)',
  q3: '質問3 (T / F)',
  q4: '質問4 (J / P)',
}

const QUESTION_PATTERNS: Record<QuestionColumnKey, RegExp> = {
  q1: /(質問1|外向|内向|エネルギー|回復)/i,
  q2: /(質問2|感覚|直観|テーマ|意味)/i,
  q3: /(質問3|思考|感情|判断|基準)/i,
  q4: /(質問4|判断型|知覚型|進める|スタイル)/i,
}

const PREFERRED_QUESTION_HEADERS: Record<QuestionColumnKey, string> = {
  q1: GROUPING_RESPONSE_HEADERS[0],
  q2: GROUPING_RESPONSE_HEADERS[1],
  q3: GROUPING_RESPONSE_HEADERS[2],
  q4: GROUPING_RESPONSE_HEADERS[3],
}

const QUESTION_MAPPINGS: Record<QuestionColumnKey, Record<'A' | 'B', string>> = {
  q1: { A: 'E', B: 'I' },
  q2: { A: 'S', B: 'N' },
  q3: { A: 'T', B: 'F' },
  q4: { A: 'J', B: 'P' },
}

const EMPTY_QUESTION_COLUMNS: QuestionColumns = {
  q1: '',
  q2: '',
  q3: '',
  q4: '',
}

const EMPTY_PREVIEW: ParticipantImportPreview = {
  participants: [],
  skippedRows: [],
  counts: createEmptyCounts(),
}

const EMPTY_APPLIED_IMPORT: AppliedImportState = {
  ...EMPTY_PREVIEW,
  sourceName: null,
  selectionSignature: '',
}

const BOARD_STORAGE_KEY = 'tongari-group-board'

function App() {
  return getAppView() === 'board' ? <BoardPage /> : <MainPage />
}

function MainPage() {
  const [csvData, setCsvData] = useState<CsvDataSet | null>(null)
  const [csvVersion, setCsvVersion] = useState(0)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isRemoteLoading, setIsRemoteLoading] = useState(false)
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null)
  const [nameColumn, setNameColumn] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('questionnaire')
  const [mbtiColumn, setMbtiColumn] = useState('')
  const [questionColumns, setQuestionColumns] = useState<QuestionColumns>(EMPTY_QUESTION_COLUMNS)
  const [draftTargetSize, setDraftTargetSize] = useState(DEFAULT_TARGET_SIZE)
  const [appliedTargetSize, setAppliedTargetSize] = useState(DEFAULT_TARGET_SIZE)
  const [appliedImport, setAppliedImport] = useState<AppliedImportState>(EMPTY_APPLIED_IMPORT)
  const latestSelectionRef = useRef<ImportSelection>({
    nameColumn: '',
    mbtiColumn: '',
    questionColumns: EMPTY_QUESTION_COLUMNS,
    mode: 'questionnaire',
  })
  const latestVersionRef = useRef(0)
  const latestTargetSizeRef = useRef(DEFAULT_TARGET_SIZE)
  const lastDataSignatureRef = useRef('')

  const preview = csvData
    ? buildParticipantPreview({
        rows: csvData.rows,
        nameColumn,
        mode: importMode,
        mbtiColumn,
        questionColumns,
      })
    : EMPTY_PREVIEW

  const previewSummary = summarizeActiveCounts(preview.counts)
  const appliedSummary = summarizeActiveCounts(appliedImport.counts)
  const result = generateParticipantGroups({
    participants: appliedImport.participants,
    targetSize: appliedTargetSize,
    minSize: MIN_GROUP_SIZE,
    maxSize: MAX_GROUP_SIZE,
  })
  const hasBoardData = result.groups.length > 0

  const selectionSignature = createSelectionSignature({
    version: csvVersion,
    mode: importMode,
    nameColumn,
    mbtiColumn,
    questionColumns,
  })
  const hasPendingChanges =
    selectionSignature !== appliedImport.selectionSignature || draftTargetSize !== appliedTargetSize

  const statusMessage = parseError
    ? parseError
    : !csvData
      ? isRemoteLoading
        ? '固定スプレッドシートから回答を読み込んでいます。'
        : '固定スプレッドシートを読み込めていません。再読み込みしてください。'
      : !nameColumn
        ? '名前列を選択してください。'
        : importMode === 'direct' && !mbtiColumn
          ? 'MBTI列を選択してください。'
          : importMode === 'questionnaire' && !allQuestionColumnsSelected(questionColumns)
            ? '質問1〜4の列を選択してください。'
            : hasPendingChanges
              ? '現在の設定はまだ結果に反映されていません。'
              : result.totalParticipants > 0
                ? '現在の CSV と判定設定でチーム表を表示しています。'
                : '有効な参加者が抽出できていません。'

  const canGenerate =
    Boolean(csvData && nameColumn) &&
    (importMode === 'direct' ? Boolean(mbtiColumn) : allQuestionColumnsSelected(questionColumns)) &&
    preview.participants.length > 0

  useEffect(() => {
    latestSelectionRef.current = {
      nameColumn,
      mbtiColumn,
      questionColumns,
      mode: importMode,
    }
    latestVersionRef.current = csvVersion
    latestTargetSizeRef.current = draftTargetSize
  }, [csvVersion, draftTargetSize, importMode, mbtiColumn, nameColumn, questionColumns])

  useEffect(() => {
    if (!hasBoardData) {
      return
    }

    writeBoardSnapshot(
      createBoardSnapshot({
        groups: result.groups,
        sourceName: appliedImport.sourceName,
        totalParticipants: result.totalParticipants,
        targetSize: result.plan.targetSize,
      }),
    )
  }, [
    appliedImport.participants,
    appliedImport.selectionSignature,
    appliedImport.sourceName,
    hasBoardData,
    appliedTargetSize,
  ])

  const applyImportedDataSet = (dataset: CsvDataSet, warning: string | null = null) => {
    const resolvedSelection = resolveImportSelection(
      dataset.headers,
      latestSelectionRef.current,
    )
    const nextVersion = latestVersionRef.current + 1
    const nextPreview = buildParticipantPreview({
      rows: dataset.rows,
      nameColumn: resolvedSelection.nameColumn,
      mode: resolvedSelection.mode,
      mbtiColumn: resolvedSelection.mbtiColumn,
      questionColumns: resolvedSelection.questionColumns,
    })
    const nextSelectionSignature = createSelectionSignature({
      version: nextVersion,
      mode: resolvedSelection.mode,
      nameColumn: resolvedSelection.nameColumn,
      mbtiColumn: resolvedSelection.mbtiColumn,
      questionColumns: resolvedSelection.questionColumns,
    })

    latestSelectionRef.current = resolvedSelection
    latestVersionRef.current = nextVersion

    setCsvData(dataset)
    setNameColumn(resolvedSelection.nameColumn)
    setMbtiColumn(resolvedSelection.mbtiColumn)
    setQuestionColumns(resolvedSelection.questionColumns)
    setImportMode(resolvedSelection.mode)
    setCsvVersion(nextVersion)
    setParseError(warning)
    setAppliedImport({
      ...nextPreview,
      sourceName: dataset.sourceName,
      selectionSignature: nextSelectionSignature,
    })
    setAppliedTargetSize(latestTargetSizeRef.current)
  }

  const loadFixedSheet = async () => {
    setIsRemoteLoading(true)

    try {
      const { dataset, warning } = await fetchRemoteDataset(FIXED_GROUPING_SOURCE_URL)
      const nextSignature = createDataSignature(dataset)

      if (nextSignature !== lastDataSignatureRef.current || !lastDataSignatureRef.current) {
        lastDataSignatureRef.current = nextSignature
        applyImportedDataSet(dataset, warning)
      } else {
        setParseError(warning)
      }

      setLastSyncLabel(formatSyncLabel(new Date()))
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setParseError(`固定スプレッドシートの取得に失敗しました: ${message}`)
    } finally {
      setIsRemoteLoading(false)
    }
  }

  useEffect(() => {
    void loadFixedSheet()
  }, [])

  const applyCurrentImport = () => {
    setAppliedImport({
      ...preview,
      sourceName: csvData?.sourceName ?? null,
      selectionSignature,
    })
    setAppliedTargetSize(draftTargetSize)
  }

  const downloadTeamsCsv = () => {
    if (result.groups.length === 0) {
      return
    }

    const rows = result.groups.flatMap((group, groupIndex) =>
      group.members.map((member) => ({
        team: `Group ${groupIndex + 1}`,
        name: member.name,
      })),
    )

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'mbti-team-table.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const openBoardPage = () => {
    if (!hasBoardData) {
      return
    }

    writeBoardSnapshot(
      createBoardSnapshot({
        groups: result.groups,
        sourceName: appliedImport.sourceName,
        totalParticipants: result.totalParticipants,
        targetSize: result.plan.targetSize,
      }),
    )
    window.open(buildBoardPageUrl(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="app-shell">
      <header className="top-panel">
        <div>
          <p className="eyebrow">Google Sheets</p>
          <h1>固定スプレッドシートから回答を読み込み、名前付きチーム表を生成</h1>
          <p className="lead-copy">
            読み込み元は固定の Google スプレッドシートです。画面表示時に最新回答を読み込み、必要なときだけ手動で再読み込みできます。
          </p>
        </div>

        <div className="headline-stats">
          <article className="stat-card accent-card">
            <span className="stat-label">プレビュー人数</span>
            <strong>{preview.participants.length}</strong>
            <span className="stat-note">現在の設定で抽出可能</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">出力グループ</span>
            <strong>{result.plan.groupCount}</strong>
            <span className="stat-note">
              {result.plan.sizes.length > 0 ? result.plan.sizes.join(' / ') : '未生成'}
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-label">除外行</span>
            <strong>{preview.skippedRows.length}</strong>
            <span className="stat-note">名前または回答不足</span>
          </article>
        </div>
      </header>

      <main className="workspace">
        <section className="panel control-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Sheet</p>
              <h2>回答シート</h2>
            </div>
            <div className="button-row">
              <a className="secondary-button" href={buildFormPageUrl()}>
                診断フォームへ
              </a>
              <a
                className="secondary-button"
                href={FIXED_SPREADSHEET_URL}
                target="_blank"
                rel="noreferrer"
              >
                シートを開く
              </a>
            </div>
          </div>

          <p className="source-note">{FIXED_SPREADSHEET_NAME}</p>
          <p className="sync-note">
            最終同期: {lastSyncLabel ?? '未同期'}
          </p>

          <div className="button-row import-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void loadFixedSheet()}
              disabled={isRemoteLoading}
            >
              {isRemoteLoading ? '取得中...' : '最新の回答を再読み込み'}
            </button>
          </div>

          <p className={`status-banner ${parseError ? 'pending' : hasPendingChanges ? 'pending' : 'saved'}`}>
            {statusMessage}
          </p>

          {csvData ? (
            <>
              <div className="meta-row">
                <span className="meta-pill">{csvData.sourceName}</span>
                <span className="meta-pill">{csvData.rows.length} 行</span>
                <span className="meta-pill">{csvData.headers.length} 列</span>
              </div>

              <div className="mode-toggle">
                <button
                  type="button"
                  className={`mode-button ${importMode === 'questionnaire' ? 'active' : ''}`}
                  onClick={() => setImportMode('questionnaire')}
                >
                  4問の回答から判定
                </button>
                <button
                  type="button"
                  className={`mode-button ${importMode === 'direct' ? 'active' : ''}`}
                  onClick={() => setImportMode('direct')}
                >
                  MBTI列を直接使う
                </button>
              </div>

              <div className="mapping-grid">
                <label className="field-block">
                  <span>名前列</span>
                  <select value={nameColumn} onChange={(event) => setNameColumn(event.target.value)}>
                    {csvData.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-block range-block">
                  <span>目標グループ人数</span>
                  <input
                    type="range"
                    min={MIN_GROUP_SIZE}
                    max={MAX_GROUP_SIZE}
                    step={1}
                    value={draftTargetSize}
                    onChange={(event) => setDraftTargetSize(Number(event.target.value))}
                  />
                  <strong>{draftTargetSize}名</strong>
                </label>
              </div>

              {importMode === 'questionnaire' ? (
                <div className="mapping-grid question-grid">
                  {(Object.keys(QUESTION_LABELS) as QuestionColumnKey[]).map((key) => (
                    <label key={key} className="field-block">
                      <span>{QUESTION_LABELS[key]}</span>
                      <select
                        value={questionColumns[key]}
                        onChange={(event) =>
                          setQuestionColumns((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      >
                        <option value="">選択してください</option>
                        {csvData.headers.map((header) => (
                          <option key={`${key}-${header}`} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mapping-grid">
                  <label className="field-block">
                    <span>MBTI列</span>
                    <select value={mbtiColumn} onChange={(event) => setMbtiColumn(event.target.value)}>
                      {csvData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={applyCurrentImport}
                  disabled={!canGenerate}
                >
                  この設定で再編成
                </button>
              </div>

              <section className="compact-block">
                <div className="block-header">
                  <h3>抽出プレビュー</h3>
                  <span>
                    {preview.participants.length}名 / 除外 {preview.skippedRows.length}行
                  </span>
                </div>
                <div className="token-row">
                  {previewSummary.length > 0 ? (
                    previewSummary.map((entry) => (
                      <span key={entry.type} className="summary-token">
                        {entry.type} × {entry.count}
                      </span>
                    ))
                  ) : (
                    <span className="summary-empty">現在の設定では有効な参加者が抽出できていません。</span>
                  )}
                </div>
                <div className="preview-list">
                  {preview.participants.slice(0, 8).map((participant) => (
                    <article key={participant.id} className="preview-item">
                      <strong>{participant.name}</strong>
                      <span>{participant.mbti}</span>
                    </article>
                  ))}
                </div>
              </section>

              {preview.skippedRows.length > 0 ? (
                <section className="compact-block">
                  <div className="block-header">
                    <h3>除外された行</h3>
                    <span>先頭5件を表示</span>
                  </div>
                  <div className="issue-list">
                    {preview.skippedRows.slice(0, 5).map((row) => (
                      <p key={`${row.rowNumber}-${row.rawName}`} className="warning-card">
                        {row.rowNumber}行目: {row.reason}
                        {row.rawName ? ` / 名前: ${row.rawName}` : ''}
                        {row.rawMbti ? ` / 回答: ${row.rawMbti}` : ''}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}

              <details className="reference-toggle">
                <summary>相性CSVを確認する</summary>
                <div className="reference-list">
                  {compatibilityRows.map((row) => (
                    <article key={row.type} className="reference-card">
                      <div>
                        <strong>{row.type}</strong>
                        <span>{row.label}</span>
                      </div>
                      <p>{row.matches.join(' / ')}</p>
                    </article>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <div className="empty-state">
              <p>固定スプレッドシートから回答を読み込んでください。</p>
            </div>
          )}
        </section>

        <section className="results-column">
          <section className="panel overview-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Overview</p>
                <h2>出力サマリー</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={downloadTeamsCsv}
                disabled={result.groups.length === 0}
              >
                結果CSVを保存
              </button>
            </div>

            <div className="summary-grid">
              <article className="mini-card">
                <span>出力人数</span>
                <strong>{result.totalParticipants}名</strong>
              </article>
              <article className="mini-card">
                <span>平均人数</span>
                <strong>{result.plan.averageSize.toFixed(1)}名</strong>
              </article>
              <article className="mini-card">
                <span>目標人数</span>
                <strong>{result.plan.targetSize}名</strong>
              </article>
              <article className="mini-card">
                <span>除外行</span>
                <strong>{appliedImport.skippedRows.length}行</strong>
              </article>
            </div>

            <div className="summary-line">
              <span className="summary-inline-label">生成に使った人数:</span>
              {appliedSummary.length > 0 ? (
                appliedSummary.map((entry) => (
                  <span key={`applied-${entry.type}`} className="summary-token">
                    {entry.type} × {entry.count}
                  </span>
                ))
              ) : (
                <span className="summary-empty">まだチーム表は生成されていません。</span>
              )}
            </div>

            {result.warnings.length > 0 ? (
              <div className="issue-list">
                {result.warnings.map((warning) => (
                  <p key={warning} className="warning-card">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel groups-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Teams</p>
                <h2>グループ番号と名前の一覧</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={openBoardPage}
                disabled={result.groups.length === 0}
              >
                別ページで表示
              </button>
            </div>

            {result.groups.length === 0 ? (
              <div className="empty-state">
                <p>シートを読み込み、設定を確認してからチーム表を作成してください。</p>
              </div>
            ) : (
              <div className="group-grid">
                {result.groups.map((group, index) => (
                  <GroupCard key={group.id} group={group} index={index} />
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}

function BoardPage() {
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(() => readBoardSnapshot())
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    const syncSnapshot = () => {
      setSnapshot(readBoardSnapshot())
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== BOARD_STORAGE_KEY) {
        return
      }

      syncSnapshot()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', syncSnapshot)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', syncSnapshot)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  if (!snapshot) {
    return (
      <div className="board-page">
        <div className="board-empty">
          <p className="eyebrow">Group Board</p>
          <h1>グループ表示データがありません</h1>
          <p className="lead-copy">
            設定画面でチーム表を生成してから、別ページ表示を開いてください。
          </p>
          <a className="primary-button" href={buildMainPageUrl()}>
            設定画面に戻る
          </a>
        </div>
      </div>
    )
  }

  const boardLayout = getBoardLayout(snapshot.groups, viewportWidth)
  const boardDisplay = getBoardDisplaySettings(snapshot.groups, boardLayout.rows)
  const boardGridStyle = {
    '--board-columns': String(boardLayout.columns),
    '--board-rows': String(boardLayout.rows),
    '--board-column-width': `${boardLayout.columnWidth}px`,
    '--board-card-gap': `${boardDisplay.cardGap}px`,
    '--board-card-padding-y': `${boardDisplay.cardPaddingY}px`,
    '--board-card-padding-x': `${boardDisplay.cardPaddingX}px`,
    '--board-member-gap': `${boardDisplay.memberGap}px`,
    '--board-member-font-size': `${boardDisplay.memberFontSize}rem`,
    '--board-member-line-height': String(boardDisplay.memberLineHeight),
    '--board-label-font-size': `${boardDisplay.labelFontSize}rem`,
    '--board-label-line-height': String(boardDisplay.labelLineHeight),
  } as CSSProperties

  return (
    <div className={`board-page ${boardLayout.densityClass}`}>
      <section className="board-frame">
        <div className="board-grid" style={boardGridStyle}>
          {snapshot.groups.map((group, index) => (
            <article key={group.id} className={`board-card board-tone-${index % 3}`}>
              <p className="board-group-label">＜{index + 1}班＞</p>
              <ul className="board-member-list">
                {group.members.map((member, memberIndex) => (
                  <li key={`${group.id}-${memberIndex}`} className="board-member">
                    {member}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function GroupCard({ group, index }: { group: GeneratedParticipantGroup; index: number }) {
  return (
    <article className="group-card">
      <p className="group-label">Group {index + 1}</p>

      <ul className="member-list">
        {group.members.map((member) => (
          <li key={member.id} className="member-row">
            <span>{member.name}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function normalizeCsvRow(row: Record<string, string | undefined>) {
  return Object.entries(row).reduce<CsvRow>((accumulator, [key, value]) => {
    accumulator[key] = String(value ?? '').trim()
    return accumulator
  }, {})
}

function buildCsvDataSet(
  sourceName: string,
  rawHeaders: string[],
  rawRows: Record<string, string | undefined>[],
): CsvDataSet {
  const headers = rawHeaders.filter(Boolean)
  const rows = rawRows
    .map(normalizeCsvRow)
    .filter((row) => Object.values(row).some((value) => value.length > 0))

  return {
    sourceName,
    headers,
    rows,
  }
}

function detectColumn(headers: string[], pattern: RegExp) {
  return headers.find((header) => pattern.test(header))
}

function detectQuestionColumns(headers: string[]): QuestionColumns {
  return (Object.keys(QUESTION_PATTERNS) as QuestionColumnKey[]).reduce<QuestionColumns>(
    (accumulator, key) => {
      accumulator[key] =
        headers.find((header) => header === PREFERRED_QUESTION_HEADERS[key]) ??
        detectColumn(headers, QUESTION_PATTERNS[key]) ??
        ''
      return accumulator
    },
    { ...EMPTY_QUESTION_COLUMNS },
  )
}

function allQuestionColumnsSelected(questionColumns: QuestionColumns) {
  return Object.values(questionColumns).every(Boolean)
}

function buildDefaultSelection(headers: string[]): {
  nameColumn: string
  mbtiColumn: string
  questionColumns: QuestionColumns
  mode: ImportMode
} {
  const nameColumn = detectColumn(headers, /(名前|氏名|name)/i) ?? headers[0] ?? ''
  const mbtiColumn =
    detectColumn(headers, /(mbti|タイプ|type|診断)/i) ??
    headers.find((header) => header !== nameColumn) ??
    headers[0] ??
    ''
  const questionColumns = detectQuestionColumns(headers)
  const mode: ImportMode = allQuestionColumnsSelected(questionColumns)
    ? 'questionnaire'
    : 'direct'

  return {
    nameColumn,
    mbtiColumn,
    questionColumns,
    mode,
  }
}

function resolveImportSelection(
  headers: string[],
  currentSelection: ImportSelection,
): ImportSelection {
  const defaults = buildDefaultSelection(headers)
  const availableHeaders = new Set(headers)
  const nameColumn = availableHeaders.has(currentSelection.nameColumn)
    ? currentSelection.nameColumn
    : defaults.nameColumn
  const mbtiColumn = availableHeaders.has(currentSelection.mbtiColumn)
    ? currentSelection.mbtiColumn
    : defaults.mbtiColumn
  const questionColumns = (Object.keys(QUESTION_LABELS) as QuestionColumnKey[]).reduce<QuestionColumns>(
    (accumulator, key) => {
      accumulator[key] = availableHeaders.has(currentSelection.questionColumns[key])
        ? currentSelection.questionColumns[key]
        : defaults.questionColumns[key]
      return accumulator
    },
    { ...EMPTY_QUESTION_COLUMNS },
  )

  let mode = currentSelection.mode

  if (mode === 'questionnaire' && !allQuestionColumnsSelected(questionColumns)) {
    mode = defaults.mode
  }

  if (mode === 'direct' && !mbtiColumn) {
    mode = defaults.mode
  }

  return {
    nameColumn,
    mbtiColumn,
    questionColumns,
    mode,
  }
}

function createDataSignature(dataset: CsvDataSet) {
  return JSON.stringify([dataset.headers, dataset.rows])
}

function formatSyncLabel(timestamp: Date) {
  return timestamp.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getAppView() {
  if (typeof window === 'undefined') {
    return 'main'
  }

  return new URLSearchParams(window.location.search).get('view') === 'board' ? 'board' : 'main'
}

function buildBoardPageUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('view', 'board')
  url.hash = ''
  return url.toString()
}

function buildFormPageUrl() {
  const url = new URL('form.html', window.location.href)
  url.hash = ''
  return url.toString()
}

function buildMainPageUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('view')
  url.hash = ''
  return url.toString()
}

function createBoardSnapshot({
  groups,
  sourceName,
  totalParticipants,
  targetSize,
}: {
  groups: GeneratedParticipantGroup[]
  sourceName: string | null
  totalParticipants: number
  targetSize: number
}): BoardSnapshot {
  return {
    createdAt: new Date().toLocaleString('ja-JP'),
    sourceName,
    totalParticipants,
    targetSize,
    groups: groups.map((group, index) => ({
      id: group.id,
      label: `Group ${index + 1}`,
      members: group.members.map((member) => member.name),
    })),
  }
}

function writeBoardSnapshot(snapshot: BoardSnapshot) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(snapshot))
}

function readBoardSnapshot() {
  if (typeof window === 'undefined') {
    return null
  }

  const rawSnapshot = window.localStorage.getItem(BOARD_STORAGE_KEY)

  if (!rawSnapshot) {
    return null
  }

  try {
    return JSON.parse(rawSnapshot) as BoardSnapshot
  } catch {
    return null
  }
}

function getBoardLayout(groups: BoardGroupSnapshot[], viewportWidth: number) {
  const groupCount = groups.length

  if (groupCount <= 1) {
    return { columns: 1, rows: 1, densityClass: '', columnWidth: 220 }
  }

  const longestMemberLength = groups.reduce(
    (max, group) =>
      Math.max(max, ...group.members.map((member) => member.length), group.label.length),
    0,
  )
  const estimatedCardWidth = Math.min(240, Math.max(172, longestMemberLength * 13 + 54))
  const availableWidth = Math.min(1240, Math.max(320, viewportWidth - 36))
  let columns = Math.min(5, groupCount)

  while (
    columns > 1 &&
    columns * estimatedCardWidth + (columns - 1) * 12 > availableWidth
  ) {
    columns -= 1
  }

  const rows = Math.ceil(groupCount / columns)

  if (groupCount >= 13 || rows >= 4) {
    return { columns, rows, densityClass: 'board-dense', columnWidth: estimatedCardWidth }
  }

  if (groupCount >= 9 || rows >= 3) {
    return { columns, rows, densityClass: 'board-compact', columnWidth: estimatedCardWidth }
  }

  return { columns, rows, densityClass: '', columnWidth: estimatedCardWidth }
}

function getBoardDisplaySettings(groups: BoardGroupSnapshot[], rows: number) {
  const maxMembers = groups.reduce((max, group) => Math.max(max, group.members.length), 0)

  if (rows >= 4 || (rows >= 3 && maxMembers >= 6)) {
    return {
      cardGap: 4,
      cardPaddingY: 7,
      cardPaddingX: 9,
      memberGap: 1,
      memberFontSize: 0.68,
      memberLineHeight: 1.2,
      labelFontSize: 0.78,
      labelLineHeight: 1.15,
    }
  }

  if (rows >= 3 || maxMembers >= 6) {
    return {
      cardGap: 6,
      cardPaddingY: 9,
      cardPaddingX: 11,
      memberGap: 2,
      memberFontSize: 0.78,
      memberLineHeight: 1.25,
      labelFontSize: 0.88,
      labelLineHeight: 1.2,
    }
  }

  if (rows >= 2 || maxMembers >= 5) {
    return {
      cardGap: 7,
      cardPaddingY: 10,
      cardPaddingX: 12,
      memberGap: 3,
      memberFontSize: 0.88,
      memberLineHeight: 1.3,
      labelFontSize: 0.94,
      labelLineHeight: 1.25,
    }
  }

  return {
    cardGap: 8,
    cardPaddingY: 12,
    cardPaddingX: 14,
    memberGap: 4,
    memberFontSize: 0.96,
    memberLineHeight: 1.4,
    labelFontSize: 0.98,
    labelLineHeight: 1.3,
  }
}

function createSelectionSignature({
  version,
  mode,
  nameColumn,
  mbtiColumn,
  questionColumns,
}: {
  version: number
  mode: ImportMode
  nameColumn: string
  mbtiColumn: string
  questionColumns: QuestionColumns
}) {
  return JSON.stringify({
    version,
    mode,
    nameColumn,
    mbtiColumn,
    questionColumns,
  })
}

function extractChoiceLetter(value: string) {
  const normalized = value.trim().toUpperCase()

  if (normalized.startsWith('A')) {
    return 'A'
  }

  if (normalized.startsWith('B')) {
    return 'B'
  }

  return null
}

function inferMbtiFromAnswers(row: CsvRow, questionColumns: QuestionColumns) {
  let mbti = ''

  for (const key of Object.keys(questionColumns) as QuestionColumnKey[]) {
    const rawAnswer = (row[questionColumns[key]] ?? '').trim()
    const choice = extractChoiceLetter(rawAnswer)

    if (!choice) {
      return {
        mbti: null,
        reason: `${QUESTION_LABELS[key]} の回答を判定できませんでした。`,
        rawAnswer,
      }
    }

    mbti += QUESTION_MAPPINGS[key][choice]
  }

  const matchedType = findMbtiType(mbti)

  if (!matchedType) {
    return {
      mbti: null,
      reason: `回答から MBTI を組み立てられませんでした。`,
      rawAnswer: mbti,
    }
  }

  return {
    mbti: matchedType,
    reason: '',
    rawAnswer: mbti,
  }
}

function buildParticipantPreview({
  rows,
  nameColumn,
  mode,
  mbtiColumn,
  questionColumns,
}: {
  rows: CsvRow[]
  nameColumn: string
  mode: ImportMode
  mbtiColumn: string
  questionColumns: QuestionColumns
}): ParticipantImportPreview {
  if (!nameColumn) {
    return EMPTY_PREVIEW
  }

  if (mode === 'direct' && !mbtiColumn) {
    return EMPTY_PREVIEW
  }

  if (mode === 'questionnaire' && !allQuestionColumnsSelected(questionColumns)) {
    return EMPTY_PREVIEW
  }

  const participants: ParticipantRecord[] = []
  const skippedRows: SkippedRow[] = []
  const counts = createEmptyCounts()

  rows.forEach((row, index) => {
    const rawName = (row[nameColumn] ?? '').trim()
    const rowNumber = index + 2

    if (!rawName) {
      skippedRows.push({
        rowNumber,
        rawName,
        rawMbti: '',
        reason: '名前が空のため除外しました。',
      })
      return
    }

    const resolved =
      mode === 'direct'
        ? (() => {
            const rawMbti = (row[mbtiColumn] ?? '').trim()
            const mbti = findMbtiType(rawMbti)

            if (!mbti) {
              return {
                mbti: null,
                reason: 'MBTI を判定できませんでした。',
                rawAnswer: rawMbti,
              }
            }

            return {
              mbti,
              reason: '',
              rawAnswer: rawMbti,
            }
          })()
        : inferMbtiFromAnswers(row, questionColumns)

    if (!resolved.mbti) {
      skippedRows.push({
        rowNumber,
        rawName,
        rawMbti: resolved.rawAnswer,
        reason: resolved.reason,
      })
      return
    }

    counts[resolved.mbti] += 1
    participants.push({
      id: `row-${rowNumber}`,
      name: rawName,
      mbti: resolved.mbti,
      rowNumber,
    })
  })

  return {
    participants,
    skippedRows,
    counts,
  }
}

export default App

async function fetchRemoteDataset(sourceUrl: string) {
  const normalized = normalizeRemoteSourceUrl(sourceUrl)
  const response = await fetch(normalized.fetchUrl)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const rawText = await response.text()

  if (looksLikeJson(contentType, rawText)) {
    return {
      dataset: buildDataSetFromJson(normalized.sourceName, rawText),
      warning: null,
    }
  }

  const parsed = Papa.parse<Record<string, string>>(rawText, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  return {
    dataset: buildCsvDataSet(normalized.sourceName, parsed.meta.fields ?? [], parsed.data),
    warning:
      parsed.errors.length > 0
        ? '取得したデータは読み込めましたが、一部の行で解析警告があります。'
        : null,
  }
}

function normalizeRemoteSourceUrl(sourceUrl: string) {
  const parsedUrl = new URL(sourceUrl)
  const spreadsheetMatch = parsedUrl.href.match(
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/]+)\//,
  )

  if (spreadsheetMatch) {
    const spreadsheetId = spreadsheetMatch[1]
    const gid =
      parsedUrl.searchParams.get('gid') ??
      parsedUrl.hash.match(/gid=(\d+)/)?.[1] ??
      '0'

    return {
      fetchUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
      sourceName: `Google Sheets ${spreadsheetId.slice(0, 8)}...`,
    }
  }

  return {
    fetchUrl: sourceUrl,
    sourceName: new URL(sourceUrl).hostname,
  }
}

function looksLikeJson(contentType: string, rawText: string) {
  return (
    contentType.includes('application/json') ||
    contentType.includes('application/javascript') ||
    /^[\s\n\r]*[{[]/.test(rawText)
  )
}

function buildDataSetFromJson(sourceName: string, rawText: string): CsvDataSet {
  const payload = JSON.parse(rawText) as unknown

  if (Array.isArray(payload)) {
    return buildObjectRowDataSet(sourceName, payload)
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('JSON の形式を解釈できませんでした。')
  }

  const record = payload as {
    headers?: unknown
    rows?: unknown
    values?: unknown
    sheet?: unknown
  }
  const resolvedSourceName =
    typeof record.sheet === 'string' && record.sheet.trim().length > 0
      ? record.sheet.trim()
      : sourceName

  if (Array.isArray(record.rows)) {
    if (Array.isArray(record.headers) && record.rows.every(Array.isArray)) {
      return buildArrayRowDataSet(resolvedSourceName, record.headers, record.rows)
    }

    return buildObjectRowDataSet(resolvedSourceName, record.rows)
  }

  if (Array.isArray(record.values)) {
    const [headers = [], ...rows] = record.values as unknown[]
    return buildArrayRowDataSet(resolvedSourceName, headers, rows)
  }

  throw new Error('対応していない JSON 形式です。')
}

function buildObjectRowDataSet(sourceName: string, rows: unknown[]): CsvDataSet {
  const normalizedRows = rows.filter(isObjectRecord).map(normalizeCsvRow)
  const headers = Array.from(
    normalizedRows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  )

  return {
    sourceName,
    headers,
    rows: normalizedRows,
  }
}

function buildArrayRowDataSet(sourceName: string, rawHeaders: unknown, rawRows: unknown[]) {
  const headers = Array.isArray(rawHeaders)
    ? rawHeaders.map((value) => String(value ?? '').trim()).filter(Boolean)
    : []

  const rows = rawRows
    .filter(Array.isArray)
    .map((row) =>
      headers.reduce<CsvRow>((accumulator, header, index) => {
        accumulator[header] = String((row as unknown[])[index] ?? '').trim()
        return accumulator
      }, {}),
    )

  return {
    sourceName,
    headers,
    rows,
  }
}

function isObjectRecord(value: unknown): value is Record<string, string | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
