import {calendar_v3, google} from "googleapis"
import {existsSync} from "fs";
import fs from "fs/promises"
import dotenv from "dotenv";
import {CodeChallengeMethod, OAuth2Client} from "google-auth-library";
import * as http from "http";
import * as url from "url";
import {DateTime} from "luxon";
import {GaxiosResponse} from "gaxios";

dotenv.config()

const TOKEN_CACHE = "token.json"

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.events.owned',
];

async function authGoogle(): Promise<OAuth2Client> {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET
  ) {
    process.exit(0)
  }

  const oAuth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/oauth2callback"
  )

  if (existsSync(TOKEN_CACHE)) {
    const token = await fs.readFile(TOKEN_CACHE)
    oAuth2Client.setCredentials(JSON.parse(token.toString()))
    return oAuth2Client
  }

  const codes = await oAuth2Client.generateCodeVerifierAsync();
  console.log(codes);

  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    // When using `generateCodeVerifier`, make sure to use code_challenge_method 'S256'.
    code_challenge_method: CodeChallengeMethod.S256,
    // Pass along the generated code challenge.
    code_challenge: codes.codeChallenge,
  });

  return new Promise((resolve, reject) => {
    const server = http
      .createServer(async (req, res) => {
        console.log(`Got request at ${req.url}`)
        try {
          if (!req.url) return;
          if (req.url.indexOf('/oauth2callback') > -1) {
            // acquire the code from the querystring, and close the web server.
            const qs = new url.URL(req.url, 'http://localhost:3000')
              .searchParams;
            const code = qs.get('code');
            if (!code) return;
            console.log(`Code is ${code}`);
            res.end('Authentication successful! Please return to the console.');
            server.close();

            // Now that we have the code, use that to acquire tokens.
            // Pass along the generated code verifier that matches our code challenge.
            const r = await oAuth2Client.getToken({
              code,
              codeVerifier: codes.codeVerifier,
            });

            // Make sure to set the credentials on the OAuth2 client.
            oAuth2Client.setCredentials(r.tokens);
            console.info('Tokens acquired.');
            await fs.writeFile(TOKEN_CACHE, JSON.stringify(r.tokens))
            resolve(oAuth2Client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        // open the browser to the authorize url to start the workflow
        console.log(authorizeUrl)
      });
  });
}

async function main() {
  const auth = await authGoogle()
  const cal = google.calendar({
    version: 'v3',
    auth
  })

  const events: calendar_v3.Schema$Event[] = []
  let pageToken: string | null | undefined = undefined

  do {
    const res: GaxiosResponse<calendar_v3.Schema$Events> = await cal.events.list({
      calendarId: 'primary',
      timeMax: (new Date()).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      pageToken: pageToken || undefined,
    })

    events.push(...(res.data.items || []))

    pageToken = res.data.nextPageToken
  } while (pageToken)

  console.log(events.length)

  const instantEvents = []

  for (const e of events || []) {
    if (!e.start?.dateTime?.includes("T") || !e.end?.dateTime?.includes("T")) {
      console.log(`Skipping all-day event ${e.summary}`)
      continue
    }

    const start = DateTime.fromISO(e.start?.dateTime || "")
    const end = DateTime.fromISO(e.end?.dateTime || "")

    const duration = end.diff(start).normalize()

    if (duration.toMillis() > 0) {
      continue
    }

    console.log(`Found instant event ${e.summary} ${start.toISO()} ${end.toISO()} ${duration.toHuman()}`)

    instantEvents.push(e)
  }

  console.log(instantEvents.length)

  for (const e of instantEvents) {
    if (!e.id) continue

    await cal.events.delete({
      calendarId: 'primary',
      eventId: e.id
    })
  }
}

main().then()
