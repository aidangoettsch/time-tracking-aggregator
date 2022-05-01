"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nano_1 = __importDefault(require("nano"));
const dotenv_1 = __importDefault(require("dotenv"));
const luxon_1 = require("luxon");
const ics_1 = require("ics");
const promises_1 = __importDefault(require("fs/promises"));
dotenv_1.default.config();
function dateTimeToIcs(d) {
    return d.toFormat('yyyy-M-d-H-m').split("-").map(d => parseInt(d));
}
function parseTimes(times) {
    const res = [];
    for (let i = 0; i < times.length; i += 2) {
        res.push({
            startTime: luxon_1.DateTime.fromMillis(times[i], {
                zone: "UTC"
            }),
            endTime: luxon_1.DateTime.fromMillis(times[i + 1], {
                zone: "UTC"
            }),
        });
    }
    return res;
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.SYNC_SERVER ||
            !process.env.SYNC_DATABASE ||
            !process.env.SYNC_USER ||
            !process.env.SYNC_PASSWORD) {
            console.error("Environment not set correctly");
            process.exit(1);
        }
        const conn = (0, nano_1.default)({
            url: process.env.SYNC_SERVER,
            requestDefaults: {
                auth: {
                    username: process.env.SYNC_USER,
                    password: process.env.SYNC_PASSWORD,
                },
            },
        });
        const db = conn.db.use(process.env.SYNC_DATABASE);
        const tasks = yield db.find({
            selector: {
                db: { "$eq": "Tasks" },
                // fields: ["title", "parentId", "times"]
            }
        });
        const parsedTasks = tasks.docs.flatMap(t => t.times ? parseTimes(t.times).map(e => (Object.assign({ title: t.title, tags: [] }, e))) : []);
        const { error, value: ics } = (0, ics_1.createEvents)(parsedTasks.map(t => ({
            title: t.title,
            description: t.tags.map(tag => `#${tag}`).join(" "),
            start: dateTimeToIcs(t.startTime),
            startInputType: "utc",
            end: dateTimeToIcs(t.endTime),
            endInputType: "utc",
        })));
        if (error || !ics) {
            console.error(error);
            process.exit(1);
        }
        yield promises_1.default.writeFile("./out.ics", ics);
    });
}
main().then();
