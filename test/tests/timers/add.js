/* global describe it beforeEach */
if (require('cluster').isWorker) process.exit()

const assert = require('chai').assert
require('../../general.js')

const db = require('../../general.js').db
const message = require('../../general.js').message

// users
const owner = { username: 'soge__' }

describe('Timers - add()', () => {
  beforeEach(async () => {
    await db.cleanup()
    await message.prepare()
    await global.db.engine.insert('timers', {name: 'test', messages: 0, seconds: 60, enabled: true, trigger: { messages: global.linesParsed, timestamp: new Date().getTime() }})
  })

  it('', async () => {
    global.systems.timers.add(global.systems.timers, owner, '')
    await message.isSent('timers.name-must-be-defined', owner, { sender: owner.username })
  })

  it('-name test', async () => {
    global.systems.timers.add(global.systems.timers, owner, '-name test')
    await message.isSent('timers.response-must-be-defined', owner, { sender: owner.username })
  })

  it('-name unknown -response "Lorem Ipsum"', async () => {
    global.systems.timers.add(global.systems.timers, owner, '-name unknown -response "Lorem Ipsum"')
    await message.isSent('timers.timer-not-found', owner, { name: 'unknown', sender: owner.username })
  })

  it('-name test -response "Lorem Ipsum"', async () => {
    await global.systems.timers.add(global.systems.timers, owner, '-name test -response "Lorem Ipsum"')

    let item = await global.db.engine.findOne('timers.responses', { response: 'Lorem Ipsum' })
    assert.notEmpty(item)

    await message.isSent('timers.response-was-added', owner, { id: item._id, name: 'test', response: 'Lorem Ipsum', sender: owner.username })
  })
})
