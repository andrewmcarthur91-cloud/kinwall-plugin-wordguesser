// Wordguess: board, keyboard and letter input.
// Guess validation and saving will be added separately.

const el = id => document.getElementById(id)

const keyboardRows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
]

let currentGuess = []
let currentRow = 0

// Select the same daily answer for everyone using the local calendar date.
function getDailyAnswer() {
  const today = new Date()
  const dayNumber = Math.floor(Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ) / 86400000)

  return DAILY_ANSWERS[dayNumber % DAILY_ANSWERS.length].toUpperCase()
}

const answer = getDailyAnswer()

// Identify today's puzzle using the device's local calendar date.
function getPuzzleDate() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')
}

const puzzleDate = getPuzzleDate()
let submittedGuesses = []

// Save submitted guesses for the current Kinwall player.
async function saveProgress() {
  try {
    await Kinwall.save('progress', {
      date: puzzleDate,
      guesses: submittedGuesses,
      gameOver
    })
  } catch (error) {
    console.warn('Could not save game progress:', error)
    el('message').textContent = 'Playing offline — progress may not be saved.'
  }
}


let memberContext = null
let playerStats = {
  played: 0,
  wins: 0,
  distribution: [0, 0, 0, 0, 0, 0],
  lastCompletedDate: null
}

function renderPersonalStats() {
  const stats = playerStats
  el('stat-played').textContent = stats.played
  el('stat-wins').textContent = stats.wins
  el('stat-rate').textContent = stats.played
    ? `${Math.round(stats.wins / stats.played * 100)}%`
    : '0%'

  const distribution = el('guess-distribution')
  distribution.innerHTML = ''

  stats.distribution.forEach((count, index) => {
    const row = document.createElement('div')
    row.className = 'distribution-row'

    const label = document.createElement('span')
    label.textContent = String(index + 1)

    const bar = document.createElement('div')
    bar.className = 'distribution-bar'

    const fill = document.createElement('div')
    fill.className = 'distribution-fill'
    fill.style.width = `${stats.wins ? count / Math.max(...stats.distribution, 1) * 100 : 0}%`

    const value = document.createElement('span')
    value.textContent = String(count)

    bar.appendChild(fill)
    row.append(label, bar, value)
    distribution.appendChild(row)
  })
}

function renderFamilyLeaderboard(records) {
  const container = el('family-rankings')
  container.innerHTML = ''

  const entries = Object.values(records || {})
    .filter(item => item && item.played > 0)
    .sort((a, b) => {
      const averageA = (a.pointsTotal || 0) / a.played
      const averageB = (b.pointsTotal || 0) / b.played
      return averageB - averageA ||
        (b.pointsTotal || 0) - (a.pointsTotal || 0)
    })

  if (!entries.length) {
    container.textContent = 'Family results will appear here.'
    return
  }

  entries.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'leaderboard-row'

    const name = document.createElement('span')
    name.textContent = `${index + 1}. ${item.name}`

    const average = ((item.pointsTotal || 0) / item.played).toFixed(1)
    const winRate = Math.round(item.wins / item.played * 100)

    const result = document.createElement('span')
    result.textContent = `${average} avg · ${item.played} played · ${winRate}% wins`

    row.append(name, result)
    container.appendChild(row)
  })
}

async function publishFamilyStats() {
  if (!memberContext?.id) return

  const shared = await Kinwall.load({ shared: true })
  const records = shared?.family_stats || {}

  records[memberContext.id] = {
    name: memberContext.name || 'Family member',
    played: playerStats.played,
    wins: playerStats.wins,
    pointsTotal: playerStats.pointsTotal || 0
  }

  await Kinwall.save('family_stats', records, { shared: true })
  renderFamilyLeaderboard(records)
}

async function recordCompletion() {
  if (!gameOver) return

  try {
    const saved = await Kinwall.load()
    const stats = saved?.stats || playerStats

    if (stats.lastCompletedDate === puzzleDate) return

    const oldDistribution = Array.isArray(stats.distribution)
      ? [...stats.distribution]
      : [0, 0, 0, 0, 0, 0]

    while (oldDistribution.length < 6) oldDistribution.push(0)

    // Recover points from earlier guess-distribution statistics if needed.
    const previousPoints = typeof stats.pointsTotal === 'number'
      ? stats.pointsTotal
      : oldDistribution.reduce(
          (total, count, index) => total + count * (6 - index), 0
        )

    const previousSolvedGuesses = typeof stats.solvedGuessTotal === 'number'
      ? stats.solvedGuessTotal
      : oldDistribution.reduce(
          (total, count, index) => total + count * (index + 1), 0
        )

    const won = submittedGuesses.includes(answer)
    const guessesUsed = submittedGuesses.length

    playerStats = {
      played: (stats.played || 0) + 1,
      wins: (stats.wins || 0) + (won ? 1 : 0),
      distribution: oldDistribution,
      pointsTotal: previousPoints + (won ? 7 - guessesUsed : 0),
      solvedGuessTotal: previousSolvedGuesses + (won ? guessesUsed : 0),
      lastCompletedDate: puzzleDate
    }

    if (won) {
      playerStats.distribution[guessesUsed - 1]++
    }

    await Kinwall.save('stats', playerStats)
    renderPersonalStats()
    await publishFamilyStats()
  } catch (error) {
    console.warn('Could not update statistics:', error)
  }
}

// Restore previously submitted guesses onto the board.
function restoreProgress(progress) {
  if (!progress || progress.date !== puzzleDate ||
      !Array.isArray(progress.guesses)) return

  const guesses = progress.guesses.slice(0, 6)
  const keyboard = el('keyboard')
  const priority = { absent: 1, present: 2, correct: 3 }

  guesses.forEach((guess, row) => {
    if (typeof guess !== 'string' || !/^[A-Z]{5}$/.test(guess)) return

    const score = scoreGuess(guess, answer)
    const tiles = el('board').children[row].children

    guess.split('').forEach((letter, col) => {
      tiles[col].textContent = letter
      tiles[col].classList.add(score[col])

      const button = keyboard.querySelector(`[data-key="${letter}"]`)
      if (!button) return

      const existing = ['correct', 'present', 'absent']
        .find(name => button.classList.contains(name))

      if (!existing || priority[score[col]] > priority[existing]) {
        button.classList.remove('correct', 'present', 'absent')
        button.classList.add(score[col])
      }
    })

    submittedGuesses.push(guess)
  })

  currentRow = submittedGuesses.length
  gameOver = Boolean(progress.gameOver) || currentRow >= 6 ||
    submittedGuesses.includes(answer)

  if (gameOver) {
    el('message').textContent = submittedGuesses.includes(answer)
      ? 'Brilliant! You got it!'
      : `The answer was ${answer}.`
  } else {
    el('message').textContent = currentRow
      ? 'Welcome back! Continue your puzzle.'
      : 'Guess the five-letter word!'
  }

  renderGuess()
}



function buildBoard() {
  const board = el('board')
  board.innerHTML = ''

  for (let row = 0; row < 6; row++) {
    const rowElement = document.createElement('div')
    rowElement.className = 'board-row'

    for (let col = 0; col < 5; col++) {
      const tile = document.createElement('div')
      tile.className = 'tile'
      tile.setAttribute('aria-label', `Row ${row + 1}, letter ${col + 1}`)
      rowElement.appendChild(tile)
    }

    board.appendChild(rowElement)
  }
}

function buildKeyboard() {
  const keyboard = el('keyboard')
  keyboard.innerHTML = ''

  keyboardRows.forEach(keys => {
    const row = document.createElement('div')
    row.className = 'keyboard-row'

    keys.forEach(key => {
      const button = document.createElement('button')
      button.className = 'key'
      button.textContent = key === 'BACK' ? '⌫' : key
      button.dataset.key = key

      if (key === 'ENTER' || key === 'BACK') {
        button.classList.add('wide')
        button.setAttribute('aria-label', key === 'BACK' ? 'Delete letter' : 'Submit guess')
      }

      button.addEventListener('click', () => handleKey(key))
      row.appendChild(button)
    })

    keyboard.appendChild(row)
  })
}

function renderGuess() {
  if (currentRow < 6) {
    const tiles = el('board').children[currentRow].children

    for (let col = 0; col < 5; col++) {
      const letter = currentGuess[col] || ''
      tiles[col].textContent = letter
      tiles[col].classList.toggle('filled', Boolean(letter))
    }
  }

  const remaining = 6 - currentRow
  el('attempts').textContent = remaining === 0
    ? 'No guesses remaining'
    : `${remaining} ${remaining === 1 ? 'guess' : 'guesses'} remaining`
}

// Compare a guess with the answer, handling repeated letters correctly.
function scoreGuess(guess, answer) {
  const result = Array(5).fill('absent')
  const remaining = answer.split('')

  // First pass: identify exact matches.
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct'
      remaining[i] = null
    }
  }

  // Second pass: identify letters in the wrong position.
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue

    const match = remaining.indexOf(guess[i])

    if (match !== -1) {
      result[i] = 'present'
      remaining[match] = null
    }
  }

  return result
}

let gameOver = false
let gameReady = false

function updateSplashStatus() {
  const status = el('puzzle-status')
  const button = el('play-button')

  if (!gameOver) {
    status.hidden = true
    button.textContent = "Guess today's word"
    button.classList.remove('completed')
    return
  }

  status.hidden = false
  button.textContent = "View today's puzzle"
  button.classList.add('completed')

  if (submittedGuesses.includes(answer)) {
    status.textContent = `✓ Solved in ${submittedGuesses.length} ${submittedGuesses.length === 1 ? 'guess' : 'guesses'}`
    status.classList.add('solved')
  } else {
    status.textContent = "You didn't get today's word."
    status.classList.remove('solved')
  }
}

async function submitGuess() {
  if (currentGuess.length !== 5) {
    el('message').textContent = 'You need five letters.'
    return
  }

  const guess = currentGuess.join('')

  if (!VALID_GUESSES.has(guess.toLowerCase())) {
    el('message').textContent = 'That word is not in the word list.'
    return
  }

  const score = scoreGuess(guess, answer)
  const tiles = el('board').children[currentRow].children
  const keyboard = el('keyboard')

  // Colour the submitted tiles.
  score.forEach((result, index) => {
    tiles[index].classList.add(result)
    tiles[index].classList.remove('filled')
  })

  // Update keyboard clues without downgrading a better result.
  const priority = { absent: 1, present: 2, correct: 3 }

  guess.split('').forEach((letter, index) => {
    const button = keyboard.querySelector(`[data-key="${letter}"]`)
    if (!button) return

    const existing = ['correct', 'present', 'absent']
      .find(className => button.classList.contains(className))

    if (!existing || priority[score[index]] > priority[existing]) {
      button.classList.remove('correct', 'present', 'absent')
      button.classList.add(score[index])
    }
  })

  submittedGuesses.push(guess)

  if (guess === answer) {
    gameOver = true
    el('message').textContent = 'Brilliant! You got it!'
  } else if (currentRow === 5) {
    gameOver = true
    el('message').textContent = `The answer was ${answer}.`
  } else {
    currentRow++
    currentGuess = []
    el('message').textContent = 'Keep going!'
    renderGuess()
  }

  updateSplashStatus()
  await saveProgress()
  if (gameOver) await recordCompletion()
}

function handleKey(key) {
  if (!gameReady || gameOver || currentRow >= 6) return

  if (key === 'BACK') {
    currentGuess.pop()
  } else if (key === 'ENTER') {
    submitGuess()
  } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
    currentGuess.push(key)
    el('message').textContent = 'Keep going!'
  }

  renderGuess()
}

document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return

  if (event.key === 'Backspace') {
    event.preventDefault()
    handleKey('BACK')
  } else if (event.key === 'Enter') {
    handleKey('ENTER')
  } else if (/^[a-z]$/i.test(event.key)) {
    handleKey(event.key.toUpperCase())
  }
})

buildBoard()
buildKeyboard()
renderGuess()

async function startGame() {
  try {
    const ctx = await Kinwall.ready()

    if (ctx.member) {
      el('who').textContent = `Playing as ${ctx.member.name} ${ctx.member.avatar || ''}`
    } else {
      el('who').textContent = 'A daily word puzzle'
    }

    memberContext = ctx.member

    const saved = await Kinwall.load()
    playerStats = saved?.stats || playerStats
    renderPersonalStats()
    restoreProgress(saved?.progress)
    updateSplashStatus()

    const shared = await Kinwall.load({ shared: true })
    renderFamilyLeaderboard(shared?.family_stats || {})
    await publishFamilyStats()

    if (gameOver) await recordCompletion()

    gameReady = true
    el('play-button').disabled = false
  } catch (error) {
    console.warn('Could not load saved progress:', error)
    el('message').textContent = 'Could not load saved progress. You can still play.'
    gameReady = true
    el('play-button').disabled = false
  }
}

el('play-button').addEventListener('click', () => {
  el('splash').hidden = true
  el('game-screen').hidden = false
})

startGame()
