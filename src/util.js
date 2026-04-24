'use strict'

const axios = require('axios')
const querystring = require('querystring')
const crypto = require('hash.js')
const parser = require('fast-xml-parser')

function getChecksum(callName, queryParams, sharedSecret, hashMethod = 'sha1') {
  return crypto[hashMethod]()
    .update(`${callName}${querystring.encode(queryParams)}${sharedSecret}`)
    .digest('hex')
}

function constructUrl(options, action, params) {
  const queryParams = { ...params }
  queryParams.checksum = getChecksum(
    action,
    queryParams,
    options.salt,
    options.hashMethod
  )

  return `${options.host}/api/${action}?${querystring.encode(queryParams)}`
}

function constructRequest(options, action, params, requestOptions = {}) {
  const url = constructUrl(options, action, params)

  return {
    method: requestOptions.method || 'get',
    url,
    headers: {
      Accept: 'text/xml, application/json, text/plain, */*',
      ...(requestOptions.headers || {}),
    },
    data: requestOptions.data,
  }
}

function parseResponse(response) {
  const responseData = response && response.data
  const contentType =
    (response && response.headers && response.headers['content-type']) || ''

  if (responseData && typeof responseData === 'object') {
    return responseData.response || responseData
  }

  if (typeof responseData !== 'string') {
    return responseData
  }

  if (/json/i.test(contentType)) {
    const json = JSON.parse(responseData)
    return json.response || json
  }

  return parseXml(responseData)
}

function httpClient(urlOrRequest, requester = axios) {
  const request =
    typeof urlOrRequest === 'string'
      ? {
          url: urlOrRequest,
          method: 'get',
          headers: { Accept: 'text/xml, application/json, text/plain, */*' },
        }
      : {
          method: 'get',
          headers: { Accept: 'text/xml, application/json, text/plain, */*' },
          ...urlOrRequest,
          headers: {
            Accept: 'text/xml, application/json, text/plain, */*',
            ...(urlOrRequest && urlOrRequest.headers ? urlOrRequest.headers : {}),
          },
        }

  return requester(request).then(parseResponse)
}

function normalizeUrl(url) {
  return /\/$/.test(url) ? url.slice(0, -1) : url
}

function getPathname(url, host) {
  return url.replace(host, '')
}

function parseXml(xml) {
  const json = parser.parse(xml).response

  if (json.meetings) {
    let meetings = json.meetings ? json.meetings.meeting : []
    meetings = Array.isArray(meetings) ? meetings : [meetings]
    json.meetings = meetings
  }
  if (json.recordings) {
    let recordings = json.recordings ? json.recordings.recording : []
    recordings = Array.isArray(recordings) ? recordings : [recordings]
    json.recordings = recordings
  }
  return json
}

module.exports = {
  httpClient,
  constructUrl,
  constructRequest,
  normalizeUrl,
  getPathname,
  parseXml,
  parseResponse,
}
