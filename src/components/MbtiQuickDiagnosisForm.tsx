import { useState, type FormEvent } from 'react'
import type { AxisKey, MbtiQuestion, MbtiQuestions } from '../data/sampleQuestions'
import { submitSurveyResponse } from '../lib/formSubmission'
import { SHEET_BRIDGE_URL } from '../lib/sheetConfig'

interface AxisChoice {
  selectedQuestionId: string | null
  selectedValue: string | null
}

interface MbtiQuickDiagnosisFormProps {
  questions: MbtiQuestions
}

interface SubmitState {
  kind: 'idle' | 'submitting' | 'error'
  message: string
}

interface SelectedAnswer {
  question: MbtiQuestion
  optionIndex: 0 | 1
}

const AXES: AxisKey[] = ['EI', 'SN', 'TF', 'JP']

function createInitialChoices(): Record<AxisKey, AxisChoice> {
  return {
    EI: { selectedQuestionId: null, selectedValue: null },
    SN: { selectedQuestionId: null, selectedValue: null },
    TF: { selectedQuestionId: null, selectedValue: null },
    JP: { selectedQuestionId: null, selectedValue: null },
  }
}

function createIdleState(): SubmitState {
  return {
    kind: 'idle',
    message: '',
  }
}

function getSectionLabel(index: number) {
  return `セクション ${index + 1}`
}

function buildCompletionUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('submitted', '1')
  return url.toString()
}

export default function MbtiQuickDiagnosisForm({ questions }: MbtiQuickDiagnosisFormProps) {
  const [respondentName, setRespondentName] = useState('')
  const [choices, setChoices] = useState<Record<AxisKey, AxisChoice>>(createInitialChoices)
  const [submitState, setSubmitState] = useState<SubmitState>(createIdleState)

  const completedSections = AXES.filter((axis) => Boolean(choices[axis].selectedValue)).length
  const isComplete = completedSections === AXES.length
  const isNameFilled = respondentName.trim().length > 0
  const canSubmit = isNameFilled && isComplete && submitState.kind !== 'submitting'

  const resetSubmitState = () => {
    if (submitState.kind !== 'idle') {
      setSubmitState(createIdleState())
    }
  }

  const handleQuestionSelect = (axis: AxisKey, questionId: string) => {
    setChoices((current) => {
      const axisChoice = current[axis]
      const keepsAnswer = axisChoice.selectedQuestionId === questionId

      return {
        ...current,
        [axis]: {
          selectedQuestionId: questionId,
          selectedValue: keepsAnswer ? axisChoice.selectedValue : null,
        },
      }
    })
    resetSubmitState()
  }

  const handleAnswerSelect = (axis: AxisKey, questionId: string, value: string) => {
    setChoices((current) => ({
      ...current,
      [axis]: {
        selectedQuestionId: questionId,
        selectedValue: value,
      },
    }))
    resetSubmitState()
  }

  const handleNameChange = (value: string) => {
    setRespondentName(value)
    resetSubmitState()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!SHEET_BRIDGE_URL) {
      setSubmitState({
        kind: 'error',
        message:
          '送信先が未設定です。.env.local に VITE_SHEET_BRIDGE_URL を設定してから再読み込みしてください。',
      })
      return
    }

    if (!isNameFilled) {
      setSubmitState({
        kind: 'error',
        message: '名前を入力してください。',
      })
      return
    }

    const answers = collectSelectedAnswers(questions, choices)

    if (!answers) {
      setSubmitState({
        kind: 'error',
        message: '未回答のセクションがあります。すべて回答してから送信してください。',
      })
      return
    }

    setSubmitState({
      kind: 'submitting',
      message: '送信しています...',
    })

    try {
      await submitSurveyResponse({
        respondentName: respondentName.trim(),
        answers,
      })

      window.location.replace(buildCompletionUrl())
    } catch (error) {
      setSubmitState({
        kind: 'error',
        message: error instanceof Error ? error.message : '送信に失敗しました。',
      })
    }
  }

  return (
    <form className="survey-form" onSubmit={handleSubmit}>
      <section className="intro-card">
        <div className="intro-accent" aria-hidden="true" />

        <div className="intro-content">
          <div className="intro-copy-block">
            <p className="intro-kicker">アンケート</p>
            <h1>回答フォーム</h1>
            <p className="intro-copy">
              各セクションで質問を1つ選び、その質問にだけ回答してください。
            </p>
          </div>

          <aside className="progress-card" aria-label="回答状況">
            <p className="progress-label">回答状況</p>
            <strong>
              {completedSections} / {AXES.length}
            </strong>
            <p>{isComplete ? 'すべて回答済みです。' : '未回答のセクションがあります。'}</p>
          </aside>
        </div>
      </section>

      <section className="field-card">
        <label className="field-label" htmlFor="respondent-name">
          名前 <span className="required-mark">*</span>
        </label>
        <input
          id="respondent-name"
          className="text-input"
          type="text"
          value={respondentName}
          onChange={(event) => handleNameChange(event.target.value)}
          placeholder="名前を入力"
          autoComplete="name"
        />
      </section>

      <p className="required-note">* すべてのセクションで回答が必要です</p>

      <div className="section-stack">
        {AXES.map((axis, sectionIndex) => {
          const sectionLabel = getSectionLabel(sectionIndex)
          const axisChoice = choices[axis]
          const axisQuestions = questions[axis]
          const axisAnswered = Boolean(axisChoice.selectedValue)

          return (
            <section key={axis} className="section-card">
              <div className="section-header">
                <div className="section-copy-block">
                  <p className="section-kicker">{sectionLabel}</p>
                  <h2>質問を1つ選んで回答してください</h2>
                </div>
                <span className={`section-state ${axisAnswered ? 'is-complete' : ''}`}>
                  {axisAnswered ? '回答済み' : '未回答'}
                </span>
              </div>

              <div className="question-list">
                {axisQuestions.map((question, questionIndex) => {
                  const isSelected = axisChoice.selectedQuestionId === question.id

                  return (
                    <article
                      key={question.id}
                      className={`question-card ${isSelected ? 'is-selected' : 'is-collapsed'}`}
                    >
                      <div className="question-header">
                        <span className="question-index">質問 {questionIndex + 1}</span>
                        <button
                          type="button"
                          className={`select-question-button ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => handleQuestionSelect(axis, question.id)}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? '選択中' : 'この質問で答える'}
                        </button>
                      </div>

                      <p className="question-text">{question.text}</p>

                      {isSelected ? (
                        <div
                          className="option-list"
                          role="radiogroup"
                          aria-label={`${sectionLabel} の回答`}
                        >
                          {question.options.map((option) => {
                            const checked = axisChoice.selectedValue === option.value

                            return (
                              <label
                                key={option.value}
                                className={`option-card ${checked ? 'is-checked' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`axis-${axis}`}
                                  value={option.value}
                                  checked={checked}
                                  onChange={() =>
                                    handleAnswerSelect(axis, question.id, option.value)
                                  }
                                />
                                <span className="option-label">{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      ) : null}

                      <p className="question-help">
                        {isSelected
                          ? 'この質問に回答できます。'
                          : '回答するには先にこの質問を選択してください。'}
                      </p>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="submit-card">
        <div className="submit-copy-block">
          <p className="submit-title">送信</p>
          <p className="submit-copy">4つすべてのセクションに回答すると送信できます。</p>
        </div>

        <button type="submit" className="submit-button" disabled={!canSubmit}>
          {submitState.kind === 'submitting' ? '送信中...' : '送信する'}
        </button>
      </footer>

      {submitState.kind !== 'idle' ? (
        <section
          className={`status-card ${submitState.kind === 'error' ? 'is-error' : ''}`}
          aria-live="polite"
        >
          <p className="status-label">
            {submitState.kind === 'error' ? '送信エラー' : '送信中'}
          </p>
          <strong>{submitState.message}</strong>
        </section>
      ) : null}
    </form>
  )
}

function collectSelectedAnswers(
  questions: MbtiQuestions,
  choices: Record<AxisKey, AxisChoice>,
): [SelectedAnswer, SelectedAnswer, SelectedAnswer, SelectedAnswer] | null {
  const selectedAnswers = AXES.map((axis) => {
    const axisChoice = choices[axis]
    const selectedQuestion = questions[axis].find(
      (question) => question.id === axisChoice.selectedQuestionId,
    )

    if (!selectedQuestion || !axisChoice.selectedValue) {
      return null
    }

    const optionIndex = selectedQuestion.options.findIndex(
      (option) => option.value === axisChoice.selectedValue,
    )

    if (optionIndex !== 0 && optionIndex !== 1) {
      return null
    }

    return {
      question: selectedQuestion,
      optionIndex,
    }
  })

  if (selectedAnswers.some((answer) => answer === null)) {
    return null
  }

  return selectedAnswers as [SelectedAnswer, SelectedAnswer, SelectedAnswer, SelectedAnswer]
}
