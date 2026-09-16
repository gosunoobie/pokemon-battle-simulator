export function viewerResultTitle(view) {
  const result = view?.result
  if (result?.kind === 'win') return result.winnerSeat === view.seat ? 'You won the battle.' : 'Your opponent won.'
  return result?.kind === 'draw' ? 'The battle is a draw.' : 'Battle ended.'
}

export function sideConditionLabels(view) {
  return Object.entries(view?.sideConditions ?? {}).flatMap(([seat, values]) =>
    values.map(value => `${seat === view.seat ? 'Your side' : 'Opponent'}: ${value.replace(/^move: /, '')}`))
}
