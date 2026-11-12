# Wordguess

A family-friendly daily five-letter word puzzle for Kinwall.

## Features

- One shared daily puzzle, based on the local calendar date.
- Six guesses per puzzle.
- Green, yellow and grey letter feedback, including correct repeated-letter scoring.
- On-screen and physical keyboard support.
- Individual progress and statistics saved per Kinwall member.
- Family leaderboard ranked by average points per completed game.
- Six-point scoring system: 6 points for solving in one guess, down to 1 point for solving in six. Unsolved games score zero.
- Light and dark theme support.

## Project files

| File | Purpose |
|---|---|
| `index.html` | Game interface |
| `app.js` | Game logic, progress and statistics |
| `style.css` | Layout and styling |
| `kinwall.js` | Kinwall SDK (do not modify) |
| `guesses.js` | Valid five-letter guesses |
| `answers.js` | Daily answer candidates |
| `guesses.txt` | Source list for valid guesses |
| `answers.txt` | Curated daily answer candidates |
| `dev/` | Local development preview |

## Development

From the project directory:

    python3 -m http.server 8002 --bind 0.0.0.0

Open `/dev/` on the development machine or another device on the local network.

The preview harness simulates Kinwall's member and storage APIs. Always test the packaged plugin in a real Kinwall before releasing it.

Check JavaScript syntax using Node.js:

    node --check app.js

The game uses the Kinwall SDK for all persistent storage. It does not require external services, network requests, CDNs or third-party runtime libraries.

## Packaging

Build the installable package:

    scripts/package.sh

Kinwall installs `kinwall-plugin.zip`. The package must contain `kinwall-plugin.json` at its root.

## Releasing

1. Update the version in `kinwall-plugin.json`.
2. Commit and push the changes to GitHub.
3. Create a GitHub release tagged `v<version>`.
4. Attach the generated `kinwall-plugin.zip`, or use the repository's release workflow if configured.

For a self-hosted Kinwall, install through Activities → Get more activities → Upload a kinwall-plugin.zip.

## Licensing

The game code is original. Third-party word-list sources and their licences are acknowledged in `ATTRIBUTION.txt`.
