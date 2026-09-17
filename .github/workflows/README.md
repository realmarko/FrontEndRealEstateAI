# CI notes

`ci.yml` runs `npm ci`, `ng test`, and `ng build` on every push and PR. A few of its
steps look unusual — this is why.

## Getting `ng test` to actually run on GitHub's runner

None of this showed up locally on Windows; it only appeared once the workflow ran on
`ubuntu-latest`, and each fix below was found by reproducing that exact job (root user,
Node 22, Linux) in a local container rather than guessing from commit history:

1. **Plain `ChromeHeadless` fails immediately.** The runner executes as root, and Chrome
   refuses to launch its sandbox as root. Fixed by switching to `ChromeHeadlessNoSandbox`,
   a launcher the Angular CLI's karma builder already ships built-in
   (`--no-sandbox --disable-gpu --disable-dev-shm-usage`) for exactly this case.
2. **`karma-chrome-launcher` can't find Chrome even with the right launcher.** Its
   auto-detection doesn't reliably locate `ubuntu-latest`'s preinstalled Chrome, and
   guessing at the binary name (`google-chrome`, `google-chrome-stable`,
   `chromium-browser`...) proved fragile across runner image versions. Fixed with
   [`browser-actions/setup-chrome`](https://github.com/browser-actions/setup-chrome),
   which installs a known build and reports its exact path — `CHROME_BIN` is set from
   that output instead of a guess.
3. **Zero spec files existed.** The project's only spec (for a component that turned out
   to be dead code, unreferenced by any route) was deleted, leaving nothing for `ng test`
   to run. With zero specs, `ng test` exits `1` on Linux despite Karma printing
   `0 SUCCESS` — a real, reproduced platform difference from Windows, where it exits `0`.
   Fixed by adding a real spec (`translation.service.spec.ts`) rather than working around
   an empty suite.

## The actual build failure

None of the above was the failure blocking `ng build` — it was `environment.ts` importing
`GOOGLE_MAPS_API_KEY` from `./env-keys`, a file that holds the real Google Maps API key
and is gitignored on purpose (see `src/environments/env-keys.example.ts`), so it never
exists on a clean checkout. The workflow copies the example file over it before building;
a placeholder key is fine since nothing in the build or test suite calls the Maps API.

This one only turned up because GitHub requires signing in to view a public repo's full
job logs — the "1 error and 1 warning" annotation summary visible without sign-in just
said `Process completed with exit code 1`, so the Chrome-side fixes above were verified
by local reproduction while this one needed the actual log pasted in from a signed-in
session.
