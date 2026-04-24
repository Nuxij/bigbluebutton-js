'use strict'

const util = require('./util')

const REMOVED_CREATE_PARAMS = [
  'breakoutRoomsEnabled',
  'learningDashboardEnabled',
  'virtualBackgroundsDisabled',
]

function warn(message) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(message)
  }
}

function buildJoinParams(options, fullName, meetingID, passwordOrKwparams, maybeKwparams) {
  const isThirdArgObject =
    typeof passwordOrKwparams === 'object' && passwordOrKwparams !== null

  const keywordParams = isThirdArgObject
    ? { ...passwordOrKwparams }
    : { ...maybeKwparams }

  const passwordFromPositional = isThirdArgObject ? undefined : passwordOrKwparams
  const passwordFromKeyword = keywordParams.password

  keywordParams.fullName = fullName
  keywordParams.meetingID = meetingID

  const role = keywordParams.role
  const joinPasswordMode =
    (options.compat && options.compat.joinPasswordMode) || 'legacy'

  if (role) {
    delete keywordParams.password
    return keywordParams
  }

  const password =
    passwordFromPositional === undefined
      ? passwordFromKeyword
      : passwordFromPositional

  if (joinPasswordMode === 'strict') {
    if (password !== undefined) {
      warn(
        '[bigbluebutton-js] join(password) is disabled in strict mode. Provide kwparams.role instead.'
      )
    }
    delete keywordParams.password
    return keywordParams
  }

  if (password !== undefined) {
    warn(
      '[bigbluebutton-js] join(password) is deprecated in BBB 3.0. Prefer kwparams.role with MODERATOR or VIEWER.'
    )
    keywordParams.password = password
  }

  return keywordParams
}

function administration(options) {
  function getCreateParams(name, id, kwparams) {
    kwparams = { ...kwparams }

    REMOVED_CREATE_PARAMS.forEach((paramName) => {
      if (Object.prototype.hasOwnProperty.call(kwparams, paramName)) {
        delete kwparams[paramName]
        warn(
          `[bigbluebutton-js] create parameter ${paramName} was removed in BBB 3.0 and will be ignored.`
        )
      }
    })

    kwparams.name = name
    kwparams.meetingID = id

    return kwparams
  }

  function create(name, id, kwparams) {
    kwparams = getCreateParams(name, id, kwparams)

    return util.constructUrl(options, 'create', kwparams)
  }

  function createRequest(name, id, kwparams, requestOptions) {
    kwparams = getCreateParams(name, id, kwparams)

    return util.constructRequest(options, 'create', kwparams, requestOptions)
  }

  function createPost(name, id, kwparams, postBody, headers = {}) {
    return createRequest(name, id, kwparams, {
      method: 'post',
      data: postBody,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
    })
  }

  function join(fullName, meetingID, passwordOrKwparams, maybeKwparams) {
    const kwparams = buildJoinParams(
      options,
      fullName,
      meetingID,
      passwordOrKwparams,
      maybeKwparams
    )

    return util.constructUrl(options, 'join', kwparams)
  }
  function end(meetingID, password) {
    let kwparams = {
      meetingID: meetingID,
    }

    if (password !== undefined && password !== null) {
      kwparams.password = password
      warn(
        '[bigbluebutton-js] end(password) is deprecated in BBB 3.0 and may be ignored by the server.'
      )
    }

    return util.constructUrl(options, 'end', kwparams)
  }

  function sendChatMessage(meetingID, message, userNameOrKwparams, maybeKwparams) {
    const userNameIsObject =
      typeof userNameOrKwparams === 'object' && userNameOrKwparams !== null

    const kwparams = userNameIsObject
      ? { ...userNameOrKwparams }
      : { ...maybeKwparams }

    kwparams.meetingID = meetingID
    kwparams.message = message

    if (!userNameIsObject && userNameOrKwparams !== undefined) {
      kwparams.userName = userNameOrKwparams
    }

    return util.constructUrl(options, 'sendChatMessage', kwparams)
  }

  function getJoinUrl(sessionToken, kwparams) {
    kwparams = { ...kwparams }
    kwparams.sessionToken = sessionToken

    return util.constructUrl(options, 'getJoinUrl', kwparams)
  }

  return {
    create,
    createRequest,
    createPost,
    join,
    end,
    sendChatMessage,
    getJoinUrl,
  }
}

module.exports = administration
