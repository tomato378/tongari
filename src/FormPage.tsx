import MbtiQuickDiagnosisForm from './components/MbtiQuickDiagnosisForm'
import { sampleQuestions } from './data/sampleQuestions'

export default function FormPage() {
  const isCompleted = getIsCompletedView()

  return (
    <main className="form-page">
      {isCompleted ? <CompletedPage /> : <MbtiQuickDiagnosisForm questions={sampleQuestions} />}
    </main>
  )
}

function CompletedPage() {
  return (
    <section className="complete-card">
      <div className="complete-accent" aria-hidden="true" />
      <div className="complete-body">
        <p className="complete-kicker">送信完了</p>
        <h1 className="complete-title">回答を受け付けました</h1>
        <p className="complete-copy">
          送信は完了しています。この画面では再送信できません。
        </p>
      </div>
    </section>
  )
}

function getIsCompletedView() {
  if (typeof window === 'undefined') {
    return false
  }

  return new URLSearchParams(window.location.search).get('submitted') === '1'
}
