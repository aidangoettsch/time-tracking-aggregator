import nano, {MangoResponse} from "nano";
import dotenv from "dotenv";
import {DateTime} from "luxon";
import {createEvents, DateArray} from "ics";
import fs from "fs/promises"

dotenv.config()

interface TimeTrackingEntry {
  startTime: DateTime,
  endTime: DateTime,
}

type CalendarEntry = {
  title: string,
  tags: [],
} & TimeTrackingEntry

function dateTimeToIcs(d: DateTime): DateArray {
  return d.toFormat('yyyy-M-d-H-m').split("-").map(d => parseInt(d)) as unknown as DateArray
}

function parseTimes(times: number[]): TimeTrackingEntry[] {
  const res: TimeTrackingEntry[] = []

  for (let i = 0; i < times.length; i += 2) {
    res.push({
      startTime: DateTime.fromMillis(times[i], {
        zone: "UTC"
      }),
      endTime: DateTime.fromMillis(times[i + 1], {
        zone: "UTC"
      }),
    })
  }
  return res
}

async function main() {
  if (
    !process.env.SYNC_SERVER ||
    !process.env.SYNC_DATABASE ||
    !process.env.SYNC_USER ||
    !process.env.SYNC_PASSWORD
  ) {
    console.error("Environment not set correctly")
    process.exit(1)
  }

  const conn = nano({
    url: process.env.SYNC_SERVER,
    requestDefaults: {
      auth: {
        username: process.env.SYNC_USER,
        password: process.env.SYNC_PASSWORD,
      },
    },
  })

  const db = conn.db.use(process.env.SYNC_DATABASE)
  const tasks: MangoResponse<any> = await db.find({
    selector: {
      db: {"$eq": "Tasks"},
      // fields: ["title", "parentId", "times"]
    }
  })

  const parsedTasks: CalendarEntry[] = tasks.docs.flatMap(t => t.times ? parseTimes(t.times).map(e =>
    ({
      title: t.title,
      tags: [],
      ...e
    })) : []
  )

  const {error, value: ics} = createEvents(parsedTasks.map(t => ({
    title: t.title,
    description: t.tags.map(tag => `#${tag}`).join(" "),
    start: dateTimeToIcs(t.startTime),
    startInputType: "utc",
    end: dateTimeToIcs(t.endTime),
    endInputType: "utc",
  })))

  if (error || !ics) {
    console.error(error)
    process.exit(1)
  }

  await fs.writeFile("./out.ics", ics)
}

main().then()
