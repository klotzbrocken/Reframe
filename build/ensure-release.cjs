#!/usr/bin/env node
/*
 * The draft GitHub release for this version: create it once (--create), then
 * check it is there and unambiguous before each platform build publishes.
 *
 * Why this exists: electron-builder's PublishManager.getOrCreatePublisher()
 * reads its publisher cache and fills it across an `await`, and scheduleUpload()
 * runs once per artifact, concurrently. So the dmg and the zip each end up with
 * their own GitHubPublisher, each with its own lazily created release — and
 * GitHub accepts two drafts for one tag, because a draft carries no git tag yet.
 * The assets then split across the two objects, and the platform jobs that run
 * later upload into whichever one their own publisher resolves to, which need
 * not be the one `gh release view` shows. 1.15.0 went out with the Linux
 * AppImage and latest-linux.yml sitting on an invisible second draft.
 *
 * With the draft already in place, gitHubPublisher.getOrCreateRelease() returns
 * it — it accepts an existing draft unconditionally — and nobody creates a
 * second one.
 *
 * Creating is deliberately NOT part of the build scripts. GitHub's release
 * listing is not read-after-write consistent: a draft created a second earlier
 * can still be absent from `GET /releases` (measured, not assumed). Three build
 * scripts each allowed to create would race exactly like the two publishers do.
 * So `--create` is its own step, run once before the tag is pushed, and it waits
 * until the new draft is actually visible before returning.
 *
 * It must be a DRAFT, not a published release. For a published one the publisher
 * logs "existing type not compatible with publishing type" and uploads nothing
 * at all, which looks like a successful build that shipped no files.
 *
 * Self-check: node build/ensure-release.cjs --self-check  (no network, no token)
 */
'use strict'

const pkg = require('../package.json')

/**
 * What to do about the releases GitHub reports for `tag`. Pure — the whole
 * decision lives here so it can be checked without touching the network.
 */
function decide(releases, tag) {
  const mine = releases.filter((r) => r.tag_name === tag)
  if (mine.length > 1) return { action: 'duplicate', ids: mine.map((r) => r.id) }
  if (mine.length === 0) return { action: 'absent' }
  return mine[0].draft ? { action: 'ready', id: mine[0].id } : { action: 'published', id: mine[0].id }
}

function selfCheck() {
  const assert = require('node:assert')
  const T = 'v9.9.9'

  assert.deepStrictEqual(decide([], T), { action: 'absent' })
  assert.deepStrictEqual(decide([{ id: 1, tag_name: 'v1.0.0', draft: true }], T), {
    action: 'absent'
  })
  assert.deepStrictEqual(decide([{ id: 7, tag_name: T, draft: true }], T), {
    action: 'ready',
    id: 7
  })
  assert.deepStrictEqual(decide([{ id: 7, tag_name: T, draft: false }], T), {
    action: 'published',
    id: 7
  })
  assert.deepStrictEqual(
    decide(
      [
        { id: 8, tag_name: T, draft: true },
        { id: 9, tag_name: T, draft: true }
      ],
      T
    ),
    { action: 'duplicate', ids: [8, 9] }
  )
  // The duplicate case is what this script exists for, and it must be caught
  // even once one of the two has been published by hand — which is how 1.15.0
  // looked while half its assets sat elsewhere.
  assert.strictEqual(
    decide(
      [
        { id: 8, tag_name: T, draft: false },
        { id: 9, tag_name: T, draft: true }
      ],
      T
    ).action,
    'duplicate'
  )
  console.log('ensure-release: self-check passed')
}

function github() {
  const gh = (pkg.build.publish || []).find((p) => p.provider === 'github')
  if (!gh) throw new Error('no github publish config in package.json build.publish')
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  return {
    api: `https://api.github.com/repos/${gh.owner}/${gh.repo}/releases`,
    tag: `v${pkg.version}`,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': `${gh.repo}-release-script`
    }
  }
}

async function list({ api, headers }) {
  const res = await fetch(`${api}?per_page=100`, { headers })
  if (!res.ok) throw new Error(`listing releases failed: HTTP ${res.status} ${await res.text()}`)
  return res.json()
}

async function main(creating) {
  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    // Never be the reason a build stops: electron-builder reports a missing
    // token perfectly well on its own.
    console.log('ensure-release: no GH_TOKEN, skipping (electron-builder will say so)')
    return
  }

  const gh = github()
  const what = decide(await list(gh), gh.tag)

  if (what.action === 'duplicate') {
    throw new Error(
      `${gh.tag} has ${what.ids.length} release objects (ids ${what.ids.join(', ')}). ` +
        `Assets would split across them. Consolidate down to one, then build again ` +
        `— see the duplicate-draft trap in RELEASE.md.`
    )
  }

  if (what.action === 'published') {
    throw new Error(
      `${gh.tag} is already published (id=${what.id}). electron-builder will not upload ` +
        `into a published release — it logs "existing type not compatible" and ships ` +
        `nothing. Bump the version, or delete that release if it was a mistake.`
    )
  }

  if (what.action === 'ready') {
    console.log(`ensure-release: draft ${gh.tag} is there (id=${what.id})`)
    return
  }

  if (!creating) {
    throw new Error(
      `no draft release for ${gh.tag}. Run \`npm run release:prepare\` first — and ` +
        `before pushing the tag, so the CI builds find it instead of each creating ` +
        `their own. See RELEASE.md.`
    )
  }

  const created = await fetch(gh.api, {
    method: 'POST',
    headers: { ...gh.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_name: gh.tag, name: pkg.version, draft: true })
  })
  if (!created.ok)
    throw new Error(`creating the draft failed: HTTP ${created.status} ${await created.text()}`)
  const id = (await created.json()).id
  console.log(`ensure-release: created draft ${gh.tag} (id=${id})`)

  // Wait for the listing to catch up, so "created" means the platform builds
  // will actually find it. Without this the tag could be pushed inside the
  // window where GET /releases still omits it.
  for (let i = 0; i < 20; i++) {
    const seen = decide(await list(gh), gh.tag)
    if (seen.action === 'ready' && seen.id === id) {
      console.log('ensure-release: visible in the release listing')
      return
    }
    if (seen.action === 'duplicate') {
      throw new Error(
        `${gh.tag} now has ${seen.ids.length} release objects (ids ${seen.ids.join(', ')}) — ` +
          `something else created one at the same time. Consolidate down to one.`
      )
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(
    `created draft ${id}, but it has not appeared in the release listing after 30s. ` +
      `Check the release page before pushing the tag.`
  )
}

if (process.argv.includes('--self-check')) {
  selfCheck()
} else {
  main(process.argv.includes('--create')).catch((e) => {
    console.error(`ensure-release: ${e.message}`)
    process.exit(1)
  })
}

module.exports = { decide }
