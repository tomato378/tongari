export type AxisKey = 'EI' | 'SN' | 'TF' | 'JP'

export interface MbtiQuestionOption {
  label: string
  value: string
}

export interface MbtiQuestion {
  id: string
  text: string
  options: [MbtiQuestionOption, MbtiQuestionOption]
}

export type MbtiQuestions = Record<AxisKey, MbtiQuestion[]>

export const sampleQuestions: MbtiQuestions = {
  EI: [
    {
      id: 'ei_1',
      text: '初対面の人が多い場では、どちらの状態に近いですか？',
      options: [
        { label: 'A人と話すほどエネルギーが湧く', value: 'E' },
        { label: 'B一人で落ち着く時間がほしくなる', value: 'I' },
      ],
    },
    {
      id: 'ei_2',
      text: '休日の予定を考えるとき、より魅力を感じるのはどちらですか？',
      options: [
        { label: '誰かと会う予定を入れる', value: 'E' },
        { label: '自分のペースで過ごせる時間を確保する', value: 'I' },
      ],
    },
    {
      id: 'ei_3',
      text: '考えを整理するとき、自然にやりやすいのはどちらですか？',
      options: [
        { label: '口に出しながら考える', value: 'E' },
        { label: '頭の中やメモで静かに考える', value: 'I' },
      ],
    },
  ],
  SN: [
    {
      id: 'sn_1',
      text: '新しいことを学ぶとき、まず注目するのはどちらですか？',
      options: [
        { label: '具体例や事実', value: 'S' },
        { label: '全体像や可能性', value: 'N' },
      ],
    },
    {
      id: 'sn_2',
      text: '企画の話し合いでは、どちらの話に引かれやすいですか？',
      options: [
        { label: '今すぐ実行できる現実的な案', value: 'S' },
        { label: 'まだ形になっていない新しいアイデア', value: 'N' },
      ],
    },
    {
      id: 'sn_3',
      text: '説明を受けるなら、どちらの進め方が理解しやすいですか？',
      options: [
        { label: '手順を順番に丁寧に追う', value: 'S' },
        { label: '背景や意図から先に掴む', value: 'N' },
      ],
    },
  ],
  TF: [
    {
      id: 'tf_1',
      text: '誰かに助言するとき、優先しやすいのはどちらですか？',
      options: [
        { label: '筋が通っているか', value: 'T' },
        { label: '相手の気持ちに配慮できているか', value: 'F' },
      ],
    },
    {
      id: 'tf_2',
      text: '意見が対立した場面で重視するのはどちらですか？',
      options: [
        { label: '公平な基準で判断すること', value: 'T' },
        { label: '人間関係を壊さないこと', value: 'F' },
      ],
    },
    {
      id: 'tf_3',
      text: '評価をするとき、自然に見ているのはどちらですか？',
      options: [
        { label: '成果や合理性', value: 'T' },
        { label: '誠実さや思いやり', value: 'F' },
      ],
    },
  ],
  JP: [
    {
      id: 'jp_1',
      text: '旅行やイベントの準備では、どちらの進め方に近いですか？',
      options: [
        { label: '先に段取りを固めておきたい', value: 'J' },
        { label: 'その場の流れで柔軟に決めたい', value: 'P' },
      ],
    },
    {
      id: 'jp_2',
      text: '締め切りのある作業では、どちらになりやすいですか？',
      options: [
        { label: '早めに着手して終わらせたい', value: 'J' },
        { label: 'ギリギリで集中して仕上げたい', value: 'P' },
      ],
    },
    {
      id: 'jp_3',
      text: '予定変更が入ったとき、感覚として近いのはどちらですか？',
      options: [
        { label: '少し落ち着かなくなる', value: 'J' },
        { label: 'むしろ変化を楽しめる', value: 'P' },
      ],
    },
  ],
}
