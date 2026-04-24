const assert = require('assert')
const bbb = require('../')

const DEFAULT_HOST = 'https://bbb.example.com/bigbluebutton'
const DEFAULT_SECRET = 'shared-secret'

function getSearchParams(url) {
  return new URL(url).searchParams
}

function captureWarnings(run) {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)

  try {
    return {
      value: run(),
      warnings,
    }
  } finally {
    console.warn = originalWarn
  }
}

describe('Administration URL Construction', () => {
  it('keeps legacy join(password) behavior by default', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const url = api.administration.join('moderator', 'meeting-1', 'mp')
    const searchParams = getSearchParams(url)

    assert.equal(searchParams.get('fullName'), 'moderator')
    assert.equal(searchParams.get('meetingID'), 'meeting-1')
    assert.equal(searchParams.get('password'), 'mp')
    assert.equal(searchParams.get('checksum').length > 0, true)
  })

  it('supports role-based join when kwparams are passed as third argument', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const url = api.administration.join('attendee', 'meeting-1', {
      role: 'VIEWER',
    })
    const searchParams = getSearchParams(url)

    assert.equal(searchParams.get('role'), 'VIEWER')
    assert.equal(searchParams.get('password'), null)
  })

  it('prioritizes role when both role and password are provided', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const url = api.administration.join('moderator', 'meeting-1', 'mp', {
      role: 'MODERATOR',
    })
    const searchParams = getSearchParams(url)

    assert.equal(searchParams.get('role'), 'MODERATOR')
    assert.equal(searchParams.get('password'), null)
  })

  it('disables join password in strict mode', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET, {
      compat: {
        joinPasswordMode: 'strict',
      },
    })

    const url = api.administration.join('moderator', 'meeting-1', 'mp')
    const searchParams = getSearchParams(url)

    assert.equal(searchParams.get('password'), null)
  })

  it('ignores removed BBB 3.0 create parameters', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const url = api.administration.create('room-name', 'meeting-1', {
      breakoutRoomsEnabled: true,
      learningDashboardEnabled: true,
      virtualBackgroundsDisabled: true,
      duration: 30,
    })

    const searchParams = getSearchParams(url)
    assert.equal(searchParams.get('duration'), '30')
    assert.equal(searchParams.get('breakoutRoomsEnabled'), null)
    assert.equal(searchParams.get('learningDashboardEnabled'), null)
    assert.equal(searchParams.get('virtualBackgroundsDisabled'), null)
  })

  it('adds sendChatMessage URL', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const url = api.administration.sendChatMessage(
      'meeting-1',
      'Hello from test',
      'System'
    )

    const searchParams = getSearchParams(url)
    assert.equal(searchParams.get('meetingID'), 'meeting-1')
    assert.equal(searchParams.get('message'), 'Hello from test')
    assert.equal(searchParams.get('userName'), 'System')
  })

  it('adds getJoinUrl URL', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const url = api.administration.getJoinUrl('session-token-1', {
      enforceLayout: 'PRESENTATION_ONLY',
    })

    const searchParams = getSearchParams(url)
    assert.equal(searchParams.get('sessionToken'), 'session-token-1')
    assert.equal(searchParams.get('enforceLayout'), 'PRESENTATION_ONLY')
  })

  it('builds create request descriptors without changing existing create URL flow', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const request = api.administration.createRequest('room-name', 'meeting-1', {
      duration: 30,
    })

    assert.equal(request.method, 'get')
    assert.equal(typeof request.url, 'string')
    assert.equal(request.url.includes('/api/create?'), true)

    const searchParams = getSearchParams(request.url)
    assert.equal(searchParams.get('name'), 'room-name')
    assert.equal(searchParams.get('meetingID'), 'meeting-1')
  })

  it('builds POST create descriptors and keeps checksum stable when only body changes', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)

    const postRequestOne = api.administration.createPost(
      'room-name',
      'meeting-1',
      { duration: 30 },
      'clientSettingsOverride=%7B%22public%22%3A%7B%22app%22%3A%7B%22appName%22%3A%22A%22%7D%7D%7D'
    )

    const postRequestTwo = api.administration.createPost(
      'room-name',
      'meeting-1',
      { duration: 30 },
      'clientSettingsOverride=%7B%22public%22%3A%7B%22app%22%3A%7B%22appName%22%3A%22B%22%7D%7D%7D'
    )

    assert.equal(postRequestOne.method, 'post')
    assert.equal(postRequestOne.headers['Content-Type'], 'application/x-www-form-urlencoded')
    assert.equal(typeof postRequestOne.data, 'string')

    const checksumOne = getSearchParams(postRequestOne.url).get('checksum')
    const checksumTwo = getSearchParams(postRequestTwo.url).get('checksum')
    assert.equal(checksumOne, checksumTwo)
  })

  it('normalizes trailing slashes in the configured host', () => {
    const api = bbb.api('https://bbb.example.com/bigbluebutton/', DEFAULT_SECRET)
    const url = api.monitoring.getMeetings()

    assert.equal(
      url.startsWith('https://bbb.example.com/bigbluebutton/api/getMeetings?'),
      true
    )
  })

  it('adds deprecated end password and warns about it', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const { value: url, warnings } = captureWarnings(() =>
      api.administration.end('meeting-1', 'mp')
    )

    const searchParams = getSearchParams(url)
    assert.equal(searchParams.get('meetingID'), 'meeting-1')
    assert.equal(searchParams.get('password'), 'mp')
    assert.equal(warnings.length, 1)
    assert.equal(
      warnings[0],
      '[bigbluebutton-js] end(password) is deprecated in BBB 3.0 and may be ignored by the server.'
    )
  })

  it('supports sendChatMessage keyword params without positional user name', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const url = api.administration.sendChatMessage('meeting-1', 'Hello from test', {
      userName: 'System',
      chatEmphasize: true,
    })

    const searchParams = getSearchParams(url)
    assert.equal(searchParams.get('meetingID'), 'meeting-1')
    assert.equal(searchParams.get('message'), 'Hello from test')
    assert.equal(searchParams.get('userName'), 'System')
    assert.equal(searchParams.get('chatEmphasize'), 'true')
  })

  it('merges default Accept header with custom request headers', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const request = api.administration.createRequest(
      'room-name',
      'meeting-1',
      { duration: 30 },
      {
        method: 'post',
        headers: {
          'X-Test-Header': 'present',
        },
      }
    )

    assert.equal(request.method, 'post')
    assert.equal(request.headers.Accept, 'text/xml, application/json, text/plain, */*')
    assert.equal(request.headers['X-Test-Header'], 'present')
  })

  it('lets createPost callers override default POST headers', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const request = api.administration.createPost(
      'room-name',
      'meeting-1',
      {},
      'name=value',
      {
        'Content-Type': 'application/json',
        'X-Test-Header': 'present',
      }
    )

    assert.equal(request.headers['Content-Type'], 'application/json')
    assert.equal(request.headers['X-Test-Header'], 'present')
  })

  it('uses configured hashMethod when building checksums', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET, {
      hashMethod: 'sha256',
    })
    const url = api.monitoring.getMeetings()

    assert.equal(getSearchParams(url).get('checksum').length, 64)
  })
})

describe('Monitoring, Recording, and Hooks URL Construction', () => {
  it('builds getMeetingInfo and isMeetingRunning URLs with meetingID', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const meetingInfoParams = getSearchParams(api.monitoring.getMeetingInfo('meeting-1'))
    const meetingRunningParams = getSearchParams(
      api.monitoring.isMeetingRunning('meeting-1')
    )

    assert.equal(meetingInfoParams.get('meetingID'), 'meeting-1')
    assert.equal(meetingRunningParams.get('meetingID'), 'meeting-1')
  })

  it('builds getRecordings and updateRecordings URLs', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const recordingsParams = getSearchParams(
      api.recording.getRecordings({ meetingID: 'meeting-1' })
    )
    const updateParams = getSearchParams(
      api.recording.updateRecordings('record-1', { meta_category: 'demo' })
    )

    assert.equal(recordingsParams.get('meetingID'), 'meeting-1')
    assert.equal(updateParams.get('recordID'), 'record-1')
    assert.equal(updateParams.get('meta_category'), 'demo')
  })

  it('builds hook management URLs', () => {
    const api = bbb.api(DEFAULT_HOST, DEFAULT_SECRET)
    const createParams = getSearchParams(
      api.hooks.create('https://callback.example.com/webhook', { meetingID: 'meeting-1' })
    )
    const destroyParams = getSearchParams(api.hooks.destroy('hook-1'))
    const listParams = getSearchParams(api.hooks.list({ meetingID: 'meeting-1' }))

    assert.equal(createParams.get('callbackURL'), 'https://callback.example.com/webhook')
    assert.equal(createParams.get('meetingID'), 'meeting-1')
    assert.equal(destroyParams.get('hookID'), 'hook-1')
    assert.equal(listParams.get('meetingID'), 'meeting-1')
  })
})

describe('HTTP Client Parsing', () => {
  it('parses XML payloads', async () => {
    const xmlResponse =
      '<response><returncode>SUCCESS</returncode><meetingName>Room</meetingName></response>'

    const mockRequester = async () => {
      return {
        headers: {
          'content-type': 'text/xml; charset=utf-8',
        },
        data: xmlResponse,
      }
    }

    const result = await bbb.http('https://bbb.example.com/api/getMeetingInfo', mockRequester)
    assert.equal(result.returncode, 'SUCCESS')
    assert.equal(result.meetingName, 'Room')
  })

  it('parses JSON payloads and unwraps response root', async () => {
    const mockRequester = async () => {
      return {
        headers: {
          'content-type': 'application/json',
        },
        data: JSON.stringify({
          response: {
            returncode: 'SUCCESS',
            url: 'https://bbb.example.com/join-url',
          },
        }),
      }
    }

    const result = await bbb.http('https://bbb.example.com/api/getJoinUrl', mockRequester)
    assert.equal(result.returncode, 'SUCCESS')
    assert.equal(result.url, 'https://bbb.example.com/join-url')
  })

  it('accepts request descriptor objects', async () => {
    let capturedRequest
    const mockRequester = async (request) => {
      capturedRequest = request
      return {
        headers: {
          'content-type': 'application/json',
        },
        data: {
          response: {
            returncode: 'SUCCESS',
          },
        },
      }
    }

    const request = {
      method: 'post',
      url: 'https://bbb.example.com/bigbluebutton/api/create',
      data: 'name=Room&meetingID=1',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }

    const result = await bbb.http(request, mockRequester)

    assert.equal(capturedRequest.method, 'post')
    assert.equal(capturedRequest.url, request.url)
    assert.equal(result.returncode, 'SUCCESS')
  })

  it('adds default Accept header for string URL requests', async () => {
    let capturedRequest
    const mockRequester = async (request) => {
      capturedRequest = request
      return {
        headers: {
          'content-type': 'application/json',
        },
        data: {
          returncode: 'SUCCESS',
        },
      }
    }

    await bbb.http('https://bbb.example.com/api/getMeetings', mockRequester)

    assert.equal(capturedRequest.method, 'get')
    assert.equal(capturedRequest.headers.Accept, 'text/xml, application/json, text/plain, */*')
  })

  it('returns plain object payloads without a response wrapper unchanged', async () => {
    const mockRequester = async () => {
      return {
        headers: {
          'content-type': 'application/json',
        },
        data: {
          returncode: 'SUCCESS',
          meetings: [],
        },
      }
    }

    const result = await bbb.http('https://bbb.example.com/api/getMeetings', mockRequester)
    assert.equal(result.returncode, 'SUCCESS')
    assert.deepEqual(result.meetings, [])
  })

  it('normalizes XML meetings collections to arrays', () => {
    const result = bbb.util.parseXml(
      '<response><returncode>SUCCESS</returncode><meetings><meeting><meetingID>meeting-1</meetingID></meeting></meetings></response>'
    )

    assert.equal(Array.isArray(result.meetings), true)
    assert.equal(result.meetings.length, 1)
    assert.equal(result.meetings[0].meetingID, 'meeting-1')
  })

  it('normalizes XML recordings collections to arrays', () => {
    const result = bbb.util.parseXml(
      '<response><returncode>SUCCESS</returncode><recordings><recording><recordID>record-1</recordID></recording></recordings></response>'
    )

    assert.equal(Array.isArray(result.recordings), true)
    assert.equal(result.recordings.length, 1)
    assert.equal(result.recordings[0].recordID, 'record-1')
  })

  it('returns non-string response data unchanged', async () => {
    const mockRequester = async () => {
      return {
        headers: {},
        data: null,
      }
    }

    const result = await bbb.http('https://bbb.example.com/api/getMeetings', mockRequester)
    assert.equal(result, null)
  })
})
