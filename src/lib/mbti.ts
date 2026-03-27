import compatibilityCsv from '../data/mbti-list.csv?raw'

export const MBTI_ORDER = [
  'ENTP',
  'ENTJ',
  'ENFP',
  'ENFJ',
  'ESTP',
  'ESTJ',
  'ESFP',
  'ESFJ',
  'INTP',
  'INTJ',
  'INFP',
  'INFJ',
  'ISTP',
  'ISTJ',
  'ISFP',
  'ISFJ',
] as const

export type MbtiType = (typeof MBTI_ORDER)[number]
export type MbtiCounts = Record<MbtiType, number>

interface CompatibilityRow {
  type: MbtiType
  label: string
  matches: MbtiType[]
}

interface GroupPlan {
  groupCount: number
  sizes: number[]
  targetSize: number
  averageSize: number
  hasSizeException: boolean
}

interface TypableMember {
  type: MbtiType
}

interface WorkingGroup<Member extends TypableMember> {
  id: string
  capacity: number
  members: Member[]
}

interface GeneratedGroupBase {
  id: string
  size: number
  capacity: number
  score: number
  averagePairScore: number
  composition: Array<{ type: MbtiType; count: number }>
  highlightPairs: Array<{ pair: [MbtiType, MbtiType]; score: number }>
}

export interface ParticipantRecord {
  id: string
  name: string
  mbti: MbtiType
  rowNumber?: number
}

interface GroupParticipant extends ParticipantRecord, TypableMember {}

export interface GeneratedParticipantGroup extends GeneratedGroupBase {
  members: ParticipantRecord[]
}

export interface ParticipantGenerationResult {
  groups: GeneratedParticipantGroup[]
  totalParticipants: number
  plan: GroupPlan
  warnings: string[]
  counts: MbtiCounts
}

interface GenerateParticipantGroupOptions {
  participants: ParticipantRecord[]
  targetSize: number
  minSize: number
  maxSize: number
}

const MATCH_RANK_WEIGHTS = [0, 60, 40, 28, 18, 10]
const parsedCompatibilityRows = parseCompatibilityCsv(compatibilityCsv)
const compatibilityMap = buildCompatibilityMap(parsedCompatibilityRows)

export const compatibilityRows = parsedCompatibilityRows

export function createEmptyCounts(): MbtiCounts {
  return MBTI_ORDER.reduce<MbtiCounts>((accumulator, type) => {
    accumulator[type] = 0
    return accumulator
  }, {} as MbtiCounts)
}

export function summarizeActiveCounts(counts: MbtiCounts) {
  return MBTI_ORDER.filter((type) => counts[type] > 0).map((type) => ({
    type,
    count: counts[type],
  }))
}

export function buildCountsFromParticipants(participants: ParticipantRecord[]) {
  return participants.reduce<MbtiCounts>((accumulator, participant) => {
    accumulator[participant.mbti] += 1
    return accumulator
  }, createEmptyCounts())
}

export function findMbtiType(value: string) {
  const normalizedValue = value.toUpperCase()

  return MBTI_ORDER.find((type) => normalizedValue.includes(type)) ?? null
}

export function generateParticipantGroups({
  participants,
  targetSize,
  minSize,
  maxSize,
}: GenerateParticipantGroupOptions): ParticipantGenerationResult {
  const normalizedParticipants = participants
    .map<GroupParticipant>((participant) => ({
      ...participant,
      name: participant.name.trim(),
      mbti: participant.mbti,
      type: participant.mbti,
    }))
    .filter((participant) => participant.name.length > 0)

  const counts = buildCountsFromParticipants(normalizedParticipants)
  const totalParticipants = normalizedParticipants.length
  const plan = chooseGroupPlan(totalParticipants, targetSize, minSize, maxSize)

  if (totalParticipants === 0) {
    return {
      groups: [],
      totalParticipants,
      plan,
      warnings: [],
      counts,
    }
  }

  const warnings = buildWarnings(totalParticipants, counts, plan)
  const buckets = createMemberBuckets(
    normalizedParticipants.sort((left, right) => left.name.localeCompare(right.name, 'ja')),
  )
  const workingGroups = allocateMembers(plan, counts, buckets)

  optimizeGroups(workingGroups)

  return {
    groups: workingGroups.map(summarizeParticipantGroup),
    totalParticipants,
    plan,
    warnings,
    counts,
  }
}

function parseCompatibilityCsv(csv: string): CompatibilityRow[] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)

  return lines.slice(1).map((line) => {
    const columns = line.split(',').map((column) => column.trim())
    const fullLabel = columns[0]
    const type = extractMbtiType(fullLabel)
    const labelMatch = fullLabel.match(/^[A-Z]{4}（(.+)）$/)

    return {
      type,
      label: labelMatch?.[1] ?? fullLabel,
      matches: columns.slice(1).map(extractMbtiType),
    }
  })
}

function buildCompatibilityMap(rows: CompatibilityRow[]) {
  return rows.reduce<Record<MbtiType, Record<MbtiType, number>>>((accumulator, row) => {
    accumulator[row.type] = row.matches.reduce<Record<MbtiType, number>>((scores, match, index) => {
      scores[match] = MATCH_RANK_WEIGHTS[index + 1] ?? 0
      return scores
    }, {} as Record<MbtiType, number>)
    return accumulator
  }, {} as Record<MbtiType, Record<MbtiType, number>>)
}

function extractMbtiType(value: string) {
  const type = findMbtiType(value)

  if (!type) {
    throw new Error(`MBTI type could not be parsed from "${value}".`)
  }

  return type
}

function chooseGroupPlan(
  totalParticipants: number,
  targetSize: number,
  minSize: number,
  maxSize: number,
): GroupPlan {
  if (totalParticipants === 0) {
    return {
      groupCount: 0,
      sizes: [],
      targetSize,
      averageSize: 0,
      hasSizeException: false,
    }
  }

  let bestPlan: GroupPlan | null = null
  let bestCost = Number.POSITIVE_INFINITY

  for (let groupCount = 1; groupCount <= totalParticipants; groupCount += 1) {
    const sizes = Array.from({ length: groupCount }, (_, index) => {
      const base = Math.floor(totalParticipants / groupCount)
      const remainder = totalParticipants % groupCount
      return base + (index < remainder ? 1 : 0)
    })
    const sizePenalty = sizes.reduce((sum, size) => {
      if (size < minSize) {
        return sum + (minSize - size) * 120
      }

      if (size > maxSize) {
        return sum + (size - maxSize) * 120
      }

      return sum
    }, 0)
    const targetPenalty = sizes.reduce(
      (sum, size) => sum + Math.abs(size - targetSize) * 16,
      0,
    )
    const spreadPenalty = Math.max(...sizes) - Math.min(...sizes)
    const cost = sizePenalty + targetPenalty + spreadPenalty

    if (cost < bestCost) {
      bestCost = cost
      bestPlan = {
        groupCount,
        sizes,
        targetSize,
        averageSize: totalParticipants / groupCount,
        hasSizeException: sizePenalty > 0,
      }
    }
  }

  if (!bestPlan) {
    throw new Error('A valid group plan could not be created.')
  }

  return bestPlan
}

function buildWarnings(totalParticipants: number, counts: MbtiCounts, plan: GroupPlan) {
  const warnings: string[] = []

  if (plan.hasSizeException) {
    warnings.push(
      `合計 ${totalParticipants} 名では 4〜6 名に完全分割できないため、${plan.sizes.join(
        ' / ',
      )} 名の例外サイズを含めています。`,
    )
  }

  const maxTypeEntry = MBTI_ORDER.reduce<{ type: MbtiType; count: number }>(
    (best, type) => (counts[type] > best.count ? { type, count: counts[type] } : best),
    { type: MBTI_ORDER[0], count: 0 },
  )

  if (maxTypeEntry.count > plan.groupCount * 2) {
    warnings.push(
      `${maxTypeEntry.type} が ${maxTypeEntry.count} 名いるため、一部グループでは同タイプが複数入ります。`,
    )
  }

  return warnings
}

function createMemberBuckets<Member extends TypableMember>(members: Member[]) {
  return members.reduce<Record<MbtiType, Member[]>>((accumulator, member) => {
    accumulator[member.type].push(member)
    return accumulator
  }, createTypedBuckets<Member>())
}

function createTypedBuckets<Member>() {
  return MBTI_ORDER.reduce<Record<MbtiType, Member[]>>((accumulator, type) => {
    accumulator[type] = []
    return accumulator
  }, {} as Record<MbtiType, Member[]>)
}

function allocateMembers<Member extends TypableMember>(
  plan: GroupPlan,
  counts: MbtiCounts,
  buckets: Record<MbtiType, Member[]>,
) {
  const queue = buildAssignmentQueue(counts, plan.groupCount)
  const workingGroups = plan.sizes.map<WorkingGroup<Member>>((size, index) => ({
    id: `group-${index + 1}`,
    capacity: size,
    members: [],
  }))

  for (const type of queue) {
    const member = buckets[type].shift()

    if (!member) {
      continue
    }

    const bestGroup = workingGroups.reduce<WorkingGroup<Member> | null>((best, current) => {
      if (current.members.length >= current.capacity) {
        return best
      }

      if (best === null) {
        return current
      }

      return getPlacementScore(type, current) > getPlacementScore(type, best) ? current : best
    }, null)

    if (bestGroup) {
      bestGroup.members.push(member)
    }
  }

  return workingGroups
}

function buildAssignmentQueue(counts: MbtiCounts, groupCount: number) {
  const remaining = { ...counts }
  const queue: MbtiType[] = []

  for (let index = 0; index < groupCount; index += 1) {
    const nextType = getTypesWithMembers(remaining).sort(sortByAbundance(remaining))[0]

    if (!nextType) {
      break
    }

    queue.push(nextType)
    remaining[nextType] -= 1
  }

  while (getTypesWithMembers(remaining).length > 0) {
    const round = getTypesWithMembers(remaining).sort(sortByRarity(remaining))

    for (const type of round) {
      queue.push(type)
      remaining[type] -= 1
    }
  }

  return queue
}

function sortByAbundance(counts: MbtiCounts) {
  return (left: MbtiType, right: MbtiType) => {
    const countDifference = counts[right] - counts[left]

    if (countDifference !== 0) {
      return countDifference
    }

    return left.localeCompare(right)
  }
}

function sortByRarity(counts: MbtiCounts) {
  return (left: MbtiType, right: MbtiType) => {
    const countDifference = counts[left] - counts[right]

    if (countDifference !== 0) {
      return countDifference
    }

    return left.localeCompare(right)
  }
}

function getTypesWithMembers(counts: MbtiCounts) {
  return MBTI_ORDER.filter((type) => counts[type] > 0)
}

function getPlacementScore<Member extends TypableMember>(type: MbtiType, group: WorkingGroup<Member>) {
  if (group.members.length >= group.capacity) {
    return Number.NEGATIVE_INFINITY
  }

  if (group.members.length === 0) {
    return group.capacity * 20
  }

  const pairScore = group.members.reduce(
    (sum, member) => sum + getPairScore(type, member.type),
    0,
  )
  const sameTypeCount = group.members.filter((member) => member.type === type).length
  const exactFitBonus = group.members.length + 1 === group.capacity ? 24 : 0
  const capacityPressure = (group.capacity - group.members.length) * 8

  return pairScore / group.members.length + exactFitBonus + capacityPressure - sameTypeCount * 26
}

function optimizeGroups<Member extends TypableMember>(groups: WorkingGroup<Member>[]) {
  let improved = true
  let iteration = 0

  while (improved && iteration < 80) {
    improved = false
    iteration += 1

    for (let firstIndex = 0; firstIndex < groups.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
        const firstGroup = groups[firstIndex]
        const secondGroup = groups[secondIndex]

        for (let memberIndexA = 0; memberIndexA < firstGroup.members.length; memberIndexA += 1) {
          for (
            let memberIndexB = 0;
            memberIndexB < secondGroup.members.length;
            memberIndexB += 1
          ) {
            const memberA = firstGroup.members[memberIndexA]
            const memberB = secondGroup.members[memberIndexB]

            if (memberA.type === memberB.type) {
              continue
            }

            const beforeScore = getGroupScore(firstGroup) + getGroupScore(secondGroup)

            firstGroup.members[memberIndexA] = memberB
            secondGroup.members[memberIndexB] = memberA

            const afterScore = getGroupScore(firstGroup) + getGroupScore(secondGroup)

            if (afterScore > beforeScore) {
              improved = true
              continue
            }

            firstGroup.members[memberIndexA] = memberA
            secondGroup.members[memberIndexB] = memberB
          }
        }
      }
    }
  }
}

function summarizeParticipantGroup(group: WorkingGroup<GroupParticipant>): GeneratedParticipantGroup {
  return {
    ...summarizeGroupBase(group),
    members: group.members.map(({ type: _type, ...participant }) => participant),
  }
}

function summarizeGroupBase<Member extends TypableMember>(
  group: WorkingGroup<Member>,
): GeneratedGroupBase {
  const counts = group.members.reduce<Map<MbtiType, number>>((accumulator, member) => {
    accumulator.set(member.type, (accumulator.get(member.type) ?? 0) + 1)
    return accumulator
  }, new Map<MbtiType, number>())

  const composition = Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type))

  const highlightCandidates = new Map<string, { pair: [MbtiType, MbtiType]; score: number }>()

  for (let first = 0; first < group.members.length; first += 1) {
    for (let second = first + 1; second < group.members.length; second += 1) {
      const left = group.members[first].type
      const right = group.members[second].type

      if (left === right) {
        continue
      }

      const pair = [left, right].sort() as [MbtiType, MbtiType]
      const key = pair.join(':')
      const score = getPairScore(left, right)
      const existing = highlightCandidates.get(key)

      if (!existing || score > existing.score) {
        highlightCandidates.set(key, { pair, score })
      }
    }
  }

  const score = getGroupScore(group)
  const pairCount = (group.members.length * (group.members.length - 1)) / 2

  return {
    id: group.id,
    size: group.members.length,
    capacity: group.capacity,
    score,
    averagePairScore: pairCount > 0 ? score / pairCount : 0,
    composition,
    highlightPairs: Array.from(highlightCandidates.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, 2),
  }
}

function getGroupScore<Member extends TypableMember>(group: WorkingGroup<Member>) {
  let score = 0

  for (let first = 0; first < group.members.length; first += 1) {
    for (let second = first + 1; second < group.members.length; second += 1) {
      score += getPairScore(group.members[first].type, group.members[second].type)
    }
  }

  const duplicatePenalty = group.members.reduce<Map<MbtiType, number>>((accumulator, member) => {
    accumulator.set(member.type, (accumulator.get(member.type) ?? 0) + 1)
    return accumulator
  }, new Map<MbtiType, number>())

  for (const count of duplicatePenalty.values()) {
    if (count > 1) {
      score -= (count - 1) * 16
    }
  }

  return score
}

function getPairScore(left: MbtiType, right: MbtiType) {
  const direct = compatibilityMap[left]?.[right] ?? 0
  const reverse = compatibilityMap[right]?.[left] ?? 0

  return direct + reverse + getLetterHeuristic(left, right)
}

function getLetterHeuristic(left: MbtiType, right: MbtiType) {
  let score = 0

  if (left[1] === right[1]) {
    score += 12
  }

  if (left[2] === right[2]) {
    score += 10
  }

  if (left[0] !== right[0]) {
    score += 6
  }

  if (left[3] === right[3]) {
    score += 4
  }

  if (left[1] !== right[1] && left[2] !== right[2]) {
    score -= 18
  }

  if (left === right) {
    score += 8
  }

  return score
}
