#!/usr/bin/env node

import { execute } from '@oclif/core'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

execute({ development: false, dir: __dirname })
