/* global describe it beforeEach */

const assert = require('chai').assert
const until = require('test-until')
const crypto = require('crypto')
const sinon = require('sinon')
require('./general.js')

// users
const owner = { username: 'soge__' }

// load up a bot
require('../main.js')

describe('System - Custom Commands', () => {
  beforeEach(async () => {
    global.commons.sendMessage.reset()

    let items = await global.db.engine.find('commands')
    for (let item of items) {
      await global.db.engine.remove('commands', { alias: item.alias })
    }
    items = await global.db.engine.find('settings')
    for (let item of items) {
      await global.db.engine.remove('settings', { key: item.key })
    }
    global.parser.unregister('!meee')
  })
  describe('#fnc', () => {
    describe('add()', () => {
      it('text: /empty/', async () => {
        global.systems.customCommands.add(global.systems.customCommands, owner, '')
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.failed.parse'), sinon.match(owner)), 5000)

        let item = await global.db.engine.findOne('commands', { text: '' })
        assert.empty(item)
      })
      it('text: !me Lorem Ipsum', async () => {
        global.systems.customCommands.add(global.systems.customCommands, owner, '!me Lorem Ipsum')
        await until(() => global.commons.sendMessage.calledWith(global.translate('core.isRegistered').replace(/\$keyword/g, '!me'), sinon.match(owner)), 5000)

        let item = await global.db.engine.findOne('commands', { command: 'me' })
        assert.empty(item)
      })
      it('text: !randomid Lorem Ipsum', async () => {
        let id = crypto.randomBytes(4).toString('hex')
        global.systems.customCommands.add(global.systems.customCommands, owner, `!${id} Lorem Ipsum`)
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.success.add'), sinon.match(owner)), 5000)

        let item = await global.db.engine.findOne('commands', { command: id })
        assert.notEmpty(item)
        assert.equal(item.response, 'Lorem Ipsum')
        assert.equal(item.command, id)

        global.parser.parse(owner, `!${id}`)
        await until(() => global.commons.sendMessage.withArgs('Lorem Ipsum'), 5000)
      })
    })
    describe('list()', () => {
      it('list: /empty/', async () => {
        global.systems.customCommands.list(global.systems.customCommands, owner)
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.failed.list'), sinon.match(owner)), 5000)
      })
      it('list: /not empty/', async () => {
        let id1 = crypto.randomBytes(4).toString('hex')
        global.systems.customCommands.add(global.systems.customCommands, owner, '!' + id1 + ' Lorem Ipsun')
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.success.add'), sinon.match(owner)), 5000)
        global.commons.sendMessage.reset()

        let id2 = crypto.randomBytes(4).toString('hex')
        global.systems.customCommands.add(global.systems.customCommands, owner, '!' + id2 + ' Lorem Ipsum')
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.success.add'), sinon.match(owner)), 5000)

        global.systems.customCommands.list(global.systems.customCommands, owner)
        await until(() =>
          global.commons.sendMessage.calledWith(
            global.translate('customcmds.success.list') + `: !${id1}, !${id2}`, sinon.match(owner)) ||
          global.commons.sendMessage.calledWith(
            global.translate('customcmds.success.list') + `: !${id2}, !${id1}`, sinon.match(owner)), 5000)
      })
    })
    describe('toggle()', () => {
      it('text: /empty/', async () => {
        global.systems.customCommands.toggle(global.systems.customCommands, owner, '')
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.failed.parse'), sinon.match(owner)), 5000)
      })
      it('commands: /incorrect commands/', async () => {
        global.systems.customCommands.toggle(global.systems.customCommands, owner, '!asdasd')
        await until(() => global.commons.sendMessage.calledWith(
          global.translate('customcmds.failed.toggle')
            .replace(/\$command/g, 'asdasd'), sinon.match(owner)), 5000)
      })
      it('text: /correct commands/', async () => {
        let id = crypto.randomBytes(4).toString('hex')
        global.systems.customCommands.add(global.systems.customCommands, owner, `!${id} Lorem Ipsum`)
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.success.add'), sinon.match(owner)), 5000)

        await global.systems.customCommands.toggle(global.systems.customCommands, owner, `!${id}`)
        await until(() => global.commons.sendMessage.calledWith(
          global.translate('customcmds.success.disabled')
          .replace(/\$command/g, id), sinon.match(owner)), 5000)

        await global.systems.customCommands.toggle(global.systems.customCommands, owner, `!${id}`)
        await until(() => global.commons.sendMessage.calledWith(
          global.translate('customcmds.success.enabled')
            .replace(/\$command/g, id), sinon.match(owner)), 5000)
      })
    })
    describe('visible()', () => {
      it('text: /empty/', async () => {
        global.systems.customCommands.visible(global.systems.customCommands, owner, '')
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.failed.parse'), sinon.match(owner)), 5000)
      })
      it('commands: /incorrect commands/', async () => {
        global.systems.customCommands.visible(global.systems.customCommands, owner, '!asdasd')
        await until(() => global.commons.sendMessage.calledWith(
          global.translate('customcmds.failed.visible')
            .replace(/\$command/g, 'asdasd'), sinon.match(owner)), 5000)
      })
      it('text: /correct commands/', async () => {
        let id = crypto.randomBytes(4).toString('hex')
        global.systems.customCommands.add(global.systems.customCommands, owner, `!${id} Lorem Ipsum`)
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.success.add'), sinon.match(owner)), 5000)

        await global.systems.customCommands.visible(global.systems.customCommands, owner, `!${id}`)
        await until(() => global.commons.sendMessage.calledWith(
          global.translate('customcmds.success.invisible')
            .replace(/\$command/g, id), sinon.match(owner)), 5000)

        await global.systems.customCommands.visible(global.systems.customCommands, owner, `!${id}`)
        await until(() => global.commons.sendMessage.calledWith(
          global.translate('customcmds.success.visible')
            .replace(/\$command/g, id), sinon.match(owner)), 5000)
      })
    })
    describe('remove()', () => {
      it('text: /empty/', async () => {
        global.systems.customCommands.remove(global.systems.customCommands, owner, '')
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.failed.parse'), sinon.match(owner)), 5000)
      })
      it('text: /incorrect id/', async () => {
        global.systems.customCommands.remove(global.systems.customCommands, owner, '!asdasd')
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.failed.remove'), sinon.match(owner)), 5000)
      })
      it('text: /correct id/', async () => {
        let id = crypto.randomBytes(4).toString('hex')
        global.systems.customCommands.add(global.systems.customCommands, owner, `!${id} Lorem Ipsum`)
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.success.add'), sinon.match(owner)), 5000)

        let item = await global.db.engine.findOne('commands', { command: id })
        assert.isNotEmpty(item)

        await global.systems.customCommands.remove(global.systems.customCommands, owner, `!${id}`)
        await until(() => global.commons.sendMessage.calledWith(global.translate('customcmds.success.remove'), sinon.match(owner)), 5000)
        assert.isFalse(global.parser.isRegistered(id))
      })
    })
  })
})