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
      text: '大人数での沈黙,数人で雑談していて、会話が途切れて30秒ほど沈黙が流れたとき、どう感じる？',
      options: [
        { label: 'A：一番最初に話を切り出そうとする', value: 'E' },
        { label: 'B：特に無理に話さず、誰かが切り出すのをなるべく待つ', value: 'I' },
      ],
    },
    {
      id: 'ei_2',
      text: 'イベントや手伝いなどで、知らない人が多い場にいるときの振る舞いは？',
      options: [
        { label: 'A：タイミングを見て、近くの人に軽く話しかける', value: 'E' },
        { label: 'B：まず周りの様子を見て、自然な流れで関われるのを待つ', value: 'I' },
      ],
    },
    {
      id: 'ei_3',
      text: '誰かと会話しているときの自分の感覚に近いのは？',
      options: [
        { label: 'A：話しながら考えがまとまっていく感覚', value: 'E' },
        { label: 'B：ある程度考えがまとまってから話す感覚', value: 'I' },
      ],
    },
    {
      id: 'ei_4',
      text: 'イベントや集まりが終わって帰るときの気分は？',
      options: [
        { label: 'A：まだ誰かと話していたい、少し物足りない感じがする', value: 'E' },
        { label: 'B：一人の時間でゆっくり落ち着きたいと感じる', value: 'I' },
      ],
    },
  ],
  SN: [
    {
      id: 'sn_1',
      text: '新しいことを教わるとき、自分が「理解しやすい」と感じるのはどちらですか？',
      options: [
        { label: 'A：具体例や実際のやり方を見て、「なるほど、こうやるのか」と理解できるとき', value: 'S' },
        { label: 'B：全体の考え方や意味を先に知って、「こういうことか」と納得できるとき', value: 'N' },
      ],
    },
    {
      id: 'sn_2',
      text: '普段、自然と関心が向きやすいのはどちらですか？',
      options: [
        { label: 'A：目の前の出来事や、実際に起きていること（事実・経験）', value: 'S' },
        { label: 'B：まだ起きていないことや、これからどうなるか（可能性・未来）', value: 'N' },
      ],
    },
    {
      id: 'sn_3',
      text: ' 人に何かを説明するとき、自分がやりがちなのはどちらですか？',
      options: [
        { label: 'A：具体例や体験を使って、「こういうことがあって…」と話す', value: 'S' },
        { label: 'B：要点や意味をまとめて、「つまりこういうこと」と伝える', value: 'N' },
      ],
    },
    {
      id: 'sn_4',
      text: '話や授業を聞いていて、「面白い」と感じるのはどちらに近いですか？',
      options: [
        { label: 'A：「それって実際どう使うの？」と現実とのつながりが見えたとき', value: 'S' },
        { label: 'B：「それってこういうことにもつながるのでは？」と広がりを感じたとき', value: 'N' },
      ],
    },
  ],
  TF: [
    {
      id: 'tf_1',
      text: ' 話し合いで意見が分かれたとき、どう考える？',
      options: [
        { label: 'A：一番合理的で、問題解決につながる案を選ぶ', value: 'T' },
        { label: ' B：できるだけ全員が納得しやすい形を重視する', value: 'F' },
      ],
    },
    {
      id: 'tf_2',
      text: '友達が少し落ち込んでいる様子のとき。',
      options: [
        { label: 'A：何が起きているのかを整理したくなる', value: 'T' },
        { label: 'B：その人がどう感じているのかに意識が向く', value: 'F' },
      ],
    },
    {
      id: 'tf_3',
      text: '会話のあとに「うまくいかなかった」と感じたとき。',
      options: [
        { label: ' A：どこで話の流れや論理がズレたかを考える', value: 'T' },
        { label: 'B：相手がどう感じたかを気にする', value: 'F' },
      ],
    },
    {
      id: 'tf_4',
      text: '日常の中でモヤっとしたとき、気になりやすいのは？',
      options: [
        { label: 'A：話の一貫性や論理のズレ', value: 'T' },
        { label: 'B：誰かが居心地悪そうにしている様子', value: 'F' },
      ],
    },
  ],
  JP: [
    {
      id: 'jp_1',
      text: '旅行に行くとき、どちらのスタイルがしっくりくる？',
      options: [
        { label: 'A：事前にスケジュールや行き先を決めて動く', value: 'J' },
        { label: 'B：当日の流れや気分に合わせて柔軟に動く', value: 'P' },
      ],
    },
    {
      id: 'jp_2',
      text: '新しいことを始めるとき、どう動く？',
      options: [
        { label: 'A：ある程度準備や情報収集をしてから始める', value: 'J' },
        { label: 'B：まずやってみて、途中で考えながら進める', value: 'P' },
      ],
    },
    {
      id: 'jp_3',
      text: '何かに取り組む前の自分の状態として近いのは？',
      options: [
        { label: 'A：ある程度見通しが立っていると安心する', value: 'J' },
        { label: 'B：やりながら形になっていく感覚がしっくりくる', value: 'P' },
      ],
    },
    {
      id: 'jp_4',
      text: 'スケジュールややることを考えるとき、どちらが近い？',
      options: [
        { label: 'A：あらかじめ埋めておくことで安心できる', value: 'J' },
        { label: 'B：あえて余白を残しておくことで動きやすい', value: 'P' },
      ],
    },
  ],
}
