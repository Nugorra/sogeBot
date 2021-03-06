/* global describe it before */

require('../../general.js')

const db = require('../../general.js').db
const message = require('../../general.js').message

const assert = require('chai').assert

const owner = { username: 'soge__' }
const notOwner = { username: 'testuser' }

describe('lib/commons - isOwner()', () => {
  before(async () => {
    await db.cleanup()
    await message.prepare()
  })

  it('should be returned as owner', async () => {
    assert.isTrue(global.commons.isOwner(owner))
  })

  it('should not be returned as owner', async () => {
    assert.isFalse(global.commons.isOwner(notOwner))
  })
})
