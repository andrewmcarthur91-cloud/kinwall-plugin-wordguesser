// Hello world: shows who's playing, counts their taps (saved for that person), and keeps a family
// total (shared by everyone). Everything Kinwall-specific goes through kinwall.js.
const el = id => document.getElementById(id)
let mine = 0 // this person's taps
let family = 0 // everyone's taps

function render() {
  el('count').textContent = mine === 0 ? 'No taps yet.' : `You've tapped ${mine} time${mine === 1 ? '' : 's'}.`
  el('family').textContent = `The whole family: ${family}`
}

Kinwall.ready().then(async ctx => {
  // ctx.member is whoever Kinwall asked "Who's playing?" about, or null ("Just playing").
  el('hello').textContent = ctx.member ? `Hello, ${ctx.member.name}! ${ctx.member.avatar || ''}` : 'Hello!'
  el('who').textContent = ctx.member ? 'Your taps are saved just for you.' : 'Nobody picked, so taps are saved for "Just playing".'
  const saved = await Kinwall.load() // this person's data: { key: value }
  const shared = await Kinwall.load({ shared: true }) // the whole family's
  mine = saved.taps ?? 0
  family = shared.taps ?? 0
  render()
  await applyActions()
  Kinwall.onActions(applyActions) // one arrived while we're open
})

// Actions: other apps (an AI assistant, Home Assistant) can ask for the ones kinwall-plugin.json
// declares. Check the input (it came from outside), apply it so that twice is the same as once,
// then say done; anything we can't use is marked done too, so it doesn't come back.
async function applyActions() {
  for (const a of await Kinwall.actions()) {
    try {
      if (a.action === 'setTaps' && Number.isInteger(a.input.taps) && a.input.taps >= 0) {
        mine = a.input.taps
        render()
        await Kinwall.save('taps', mine)
      }
      await Kinwall.done(a.id)
    } catch { /* offline: it's still waiting next time */ }
  }
}

el('tap').onclick = async () => {
  mine++
  family++
  render()
  // Save after updating the screen, so it feels instant. Saving can fail (offline); keep going.
  await Promise.all([Kinwall.save('taps', mine), Kinwall.save('taps', family, { shared: true })]).catch(() => {})
}

// Cooldowns: a 🔊 button rests until the words are said plus 1.5 s, and after a wrong answer the
// answer buttons rest for about 1.5 s, so nobody spams sound or guesses at random. They stay visible
// and focusable (aria-disabled, not disabled, so keyboard focus isn't lost); handlers check resting().
// For a wrong answer: rest(answerButtons, 1500).
const resting = b => b.getAttribute('aria-disabled') === 'true'
function rest(buttons, ms) {
  buttons.forEach(b => b.setAttribute('aria-disabled', 'true'))
  setTimeout(() => buttons.forEach(b => b.removeAttribute('aria-disabled')), ms)
}
async function restWhile(buttons, promise, after = 1500) {
  buttons.forEach(b => b.setAttribute('aria-disabled', 'true'))
  await promise
  rest(buttons, after)
}

el('say').onclick = () => {
  const b = el('say')
  if (resting(b)) return
  restWhile([b], Kinwall.speak(el('hello').textContent)) // resolves once it's said; never rejects
}

el('reset').onclick = async () => {
  mine = 0
  render()
  await Kinwall.save('taps', null).catch(() => {}) // null deletes a saved value
}
