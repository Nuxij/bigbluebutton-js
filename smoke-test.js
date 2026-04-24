#!/usr/bin/env node

/**
 * Live smoke test for bigbluebutton-js against a running BBB instance.
 * Makes real HTTP calls to the BBB API and prints a join URL for manual follow-up.
 *
 * Usage:
 *   BBB_URL=https://YOUR_HOST/bigbluebutton BBB_SECRET=your_secret node smoke-test.js
 *
 * Tip for bigbluebutton/docker ./scripts/dev:
 *   BBB_SECRET is usually: SuperSecret
 */

const https = require('https')
const axios = require('axios')
const { api: bbb } = require('./src/api')
const { httpClient } = require('./src/util')

const BBB_URL = process.env.BBB_URL
const BBB_SECRET = process.env.BBB_SECRET
const shouldEndMeeting = process.argv.includes('--end')

if (!BBB_URL || !BBB_SECRET) {
  console.error('❌ Missing required environment variables:')
  console.error('   BBB_URL: ' + (BBB_URL ? '✓' : '✗'))
  console.error('   BBB_SECRET: ' + (BBB_SECRET ? '✓' : '✗'))
  console.error('')
  console.error('Usage:')
  console.error('  BBB_URL=https://YOUR_HOST/bigbluebutton BBB_SECRET=your_secret node smoke-test.js')
  console.error('')
  console.error('Tip for bigbluebutton/docker ./scripts/dev:')
  console.error('  BBB_SECRET is usually: SuperSecret')
  process.exit(1)
}

// Accept self-signed TLS certs used by the Docker dev stack
const httpsAgent = new https.Agent({ rejectUnauthorized: false })
const requester = (config) => axios({ ...config, httpsAgent })

let passed = 0
let failed = 0

async function test(label, fn) {
  process.stdout.write(`   ${label}... `)
  try {
    const result = await fn()
    console.log('✓' + (result ? `  (${result})` : ''))
    passed++
    return result
  } catch (err) {
    console.log(`✗  ${err.message}`)
    failed++
    throw err
  }
}

async function runSmokeTest() {
  console.log('🧪 Starting live smoke test against:', BBB_URL)
  console.log('')

  const api = bbb(BBB_URL, BBB_SECRET)
  const meetingID = `smoke-test-${Date.now()}`
  const meetingName = 'Smoke Test Meeting'

  // ── URL construction ──────────────────────────────────────────────────────
  console.log('URL construction')

  await test('create() returns a URL string', () => {
    const url = api.administration.create(meetingName, meetingID)
    if (typeof url !== 'string' || !url.includes('create')) throw new Error(`unexpected value: ${url}`)
    return 'ok'
  })

  await test('join() returns a URL with role=MODERATOR', () => {
    const url = api.administration.join('Test User', meetingID, { role: 'MODERATOR' })
    if (!url.includes('role=MODERATOR')) throw new Error('role param missing')
    return 'ok'
  })

  await test('join() legacy password still works', () => {
    const url = api.administration.join('Test User', meetingID, 'mp')
    if (!url.includes('password=mp')) throw new Error('password param missing')
    return 'ok'
  })

  await test('end() returns a URL string', () => {
    const url = api.administration.end(meetingID)
    if (!url.includes('end')) throw new Error(`unexpected value: ${url}`)
    return 'ok'
  })

  await test('getMeetingInfo() returns a URL string', () => {
    const url = api.monitoring.getMeetingInfo(meetingID)
    if (!url.includes('getMeetingInfo')) throw new Error(`unexpected value: ${url}`)
    return 'ok'
  })

  await test('isMeetingRunning() returns a URL string', () => {
    const url = api.monitoring.isMeetingRunning(meetingID)
    if (!url.includes('isMeetingRunning')) throw new Error(`unexpected value: ${url}`)
    return 'ok'
  })

  await test('getMeetings() returns a URL string', () => {
    const url = api.monitoring.getMeetings()
    if (!url.includes('getMeetings')) throw new Error(`unexpected value: ${url}`)
    return 'ok'
  })

  await test('createRequest() returns a POST descriptor', () => {
    const descriptor = api.administration.createRequest(meetingName, meetingID, {}, { method: 'post', data: 'x=1' })
    if (descriptor.method !== 'post') throw new Error('method not post')
    if (!descriptor.url.includes('create')) throw new Error('url missing action')
    return 'ok'
  })

  console.log('')

  // ── Live HTTP calls ───────────────────────────────────────────────────────
  console.log('Live HTTP calls')

  let createResult
  await test('POST /create — returns SUCCESS', async () => {
    const descriptor = api.administration.createPost(meetingName, meetingID, {})
    createResult = await httpClient(descriptor, requester)
    if (createResult.returncode !== 'SUCCESS') throw new Error(`returncode: ${createResult.returncode}`)
    return `meetingID=${createResult.meetingID}`
  })

  await test('GET /isMeetingRunning — returns a valid boolean response', async () => {
    const url = api.monitoring.isMeetingRunning(meetingID)
    const result = await httpClient(url, requester)
    if (result.running === undefined) throw new Error(`missing running field in response`)
    return `running=${result.running}`
  })

  await test('GET /getMeetingInfo — returns meeting details', async () => {
    const url = api.monitoring.getMeetingInfo(meetingID)
    const result = await httpClient(url, requester)
    if (result.returncode !== 'SUCCESS') throw new Error(`returncode: ${result.returncode}`)
    if (result.meetingID !== meetingID) throw new Error(`meetingID mismatch: ${result.meetingID}`)
    return `attendeePW=${result.attendeePW || 'n/a'}`
  })

  await test('GET /getMeetings — meeting appears in list', async () => {
    const url = api.monitoring.getMeetings()
    const result = await httpClient(url, requester)
    if (result.returncode !== 'SUCCESS') throw new Error(`returncode: ${result.returncode}`)
    const meetings = [].concat(result.meetings || [])
    const found = meetings.some((m) => m.meetingID === meetingID)
    if (!found) throw new Error(`meeting ${meetingID} not in list`)
    return `${meetings.length} meeting(s) found`
  })

  // ── Manual join URL ───────────────────────────────────────────────────────
  console.log('')
  console.log('Manual join URL')

  const joinUrl = api.administration.join('Smoke Tester', meetingID, { role: 'MODERATOR' })

  await test('builds join URL for manual browser testing', () => {
    if (typeof joinUrl !== 'string' || !joinUrl.includes('/api/join?')) {
      throw new Error('join URL was not generated')
    }

    return 'ok'
  })

  if (shouldEndMeeting) {
    await test('GET /end — ends the meeting cleanly', async () => {
      const url = api.administration.end(meetingID)
      const result = await httpClient(url, requester)
      if (result.returncode !== 'SUCCESS') throw new Error(`returncode: ${result.returncode}`)
      return 'ok'
    })
  } else {
    console.log('   Skipping /end (meeting left running for iframe test). Use --end to clean up automatically.')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('')
  if (failed > 0) {
    console.error(`❌ ${failed} test(s) failed, ${passed} passed`)
    process.exit(1)
  } else {
    console.log(`✅ All ${passed} smoke tests passed!`)
    console.log('')
    console.log(`Join URL:`)
    console.log(`  ${joinUrl}`)
    console.log('')
    console.log('Open that join URL in your browser for a live manual check.')
  }
}

runSmokeTest().catch((err) => {
  console.error('')
  console.error('❌ Smoke test aborted:', err.message)
  process.exit(1)
})
