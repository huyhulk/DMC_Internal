type GoogleSheetsValuesResponse = {
  values?: unknown[][]
}

type ServiceAccountTokenResponse = {
  access_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const GOOGLE_API_MAX_ATTEMPTS = 3
const GOOGLE_API_RETRY_BASE_DELAY_MS = 500
const TRANSIENT_GOOGLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientGoogleHttpStatus(status: number): boolean {
  return TRANSIENT_GOOGLE_HTTP_STATUSES.has(status)
}

async function fetchGoogleApiWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= GOOGLE_API_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(input, init)
      if (!isTransientGoogleHttpStatus(response.status) || attempt === GOOGLE_API_MAX_ATTEMPTS) {
        return response
      }

      await response.text().catch(() => null)
    } catch (error) {
      lastError = error
      if (attempt === GOOGLE_API_MAX_ATTEMPTS) throw error
    }

    await sleep(GOOGLE_API_RETRY_BASE_DELAY_MS * attempt)
  }

  throw lastError instanceof Error ? lastError : new Error('Google API request failed')
}

function getServiceAccountEmail(): string {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  if (!email) throw new Error('Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL')
  return email
}

function getPrivateKey(): string {
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!privateKey) throw new Error('Thiếu GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  return privateKey.replace(/\\n/g, '\n')
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function signJwt(input: string, privateKey: string): Promise<string> {
  const crypto = await import('crypto')
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(input)
  signer.end()
  return base64Url(signer.sign(privateKey))
}

async function createAssertion(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: getServiceAccountEmail(),
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`
  const signature = await signJwt(unsigned, getPrivateKey())
  return `${unsigned}.${signature}`
}

async function getAccessToken(): Promise<string> {
  const assertion = await createAssertion()
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const response = await fetchGoogleApiWithRetry(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  const payload = (await response.json()) as ServiceAccountTokenResponse
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `Google token HTTP ${response.status}`)
  }

  return payload.access_token
}

export async function readGoogleSheetValues(fileId: string, tabName: string): Promise<unknown[][]> {
  if (!fileId.trim()) throw new Error('Thiếu Google Sheet file ID')
  if (!tabName.trim()) throw new Error('Thiếu tab name')

  const accessToken = await getAccessToken()
  const range = encodeURIComponent(`'${tabName.replace(/'/g, "''")}'`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}/values/${range}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`
  const response = await fetchGoogleApiWithRetry(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Sheets HTTP ${response.status}: ${text.slice(0, 300)}`)
  }

  const payload = (await response.json()) as GoogleSheetsValuesResponse
  return payload.values ?? []
}

export async function testGoogleSheetConnection(fileId: string, tabName: string): Promise<{ rows: number; columns: number }> {
  const values = await readGoogleSheetValues(fileId, tabName)
  return {
    rows: Math.max(values.length - 1, 0),
    columns: values[0]?.length ?? 0,
  }
}
