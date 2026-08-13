#!/usr/bin/env bun
import path from "path"
import { vendorPptMaster } from "../src/ppt-master"

const dest = path.join(import.meta.dir, "../skills/ppt-master")
await vendorPptMaster(dest, { force: process.argv.includes("--force") })
