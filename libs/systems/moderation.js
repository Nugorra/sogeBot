'use strict'

// 3rdparty libraries
const _ = require('lodash')
const debug = require('debug')
const XRegExp = require('xregexp')
// bot libraries
var constants = require('../constants')
const Message = require('../message')
var log = global.log

const DEBUG_MODERATION_CONTAINS_LINK = debug('moderation:containsLink')
const DEBUG_MODERATION_CAPS = debug('moderation:caps')

class Moderation {
  constructor () {
    if (global.commons.isSystemEnabled(this)) {
      this.configuration()
      if (require('cluster').isMaster) this.webPanel()
    }
  }

  configuration () {
    if (global.commons.isSystemEnabled('moderation')) {
      global.configuration.register('moderationLinks', 'core.settings.moderation.moderationLinks', 'bool', true)
      global.configuration.register('moderationLinksWithSpaces', 'core.settings.moderation.moderationLinksWithSpaces', 'bool', false)
      global.configuration.register('moderationLinksSubs', 'core.settings.moderation.moderationLinksSubs', 'bool', true)
      global.configuration.register('moderationLinksClips', 'core.settings.moderation.moderationLinksClips', 'bool', true)
      global.configuration.register('moderationLinksTimeout', 'core.settings.moderation.moderationLinksTimeout', 'number', 120)

      global.configuration.register('moderationSymbols', 'core.settings.moderation.moderationSymbols', 'bool', true)
      global.configuration.register('moderationSymbolsSubs', 'core.settings.moderation.moderationSymbolsSubs', 'bool', true)
      global.configuration.register('moderationSymbolsTimeout', 'core.settings.moderation.moderationSymbolsTimeout', 'number', 120)
      global.configuration.register('moderationSymbolsTriggerLength', 'core.settings.moderation.moderationSymbolsTriggerLength', 'number', 15)
      global.configuration.register('moderationSymbolsMaxConsecutively', 'core.settings.moderation.moderationSymbolsMaxConsecutively', 'number', 10)
      global.configuration.register('moderationSymbolsMaxPercent', 'core.settings.moderation.moderationSymbolsMaxPercent', 'number', 50)

      global.configuration.register('moderationLongMessage', 'core.settings.moderation.moderationLongMessage', 'bool', true)
      global.configuration.register('moderationLongMessageSubs', 'core.settings.moderation.moderationLongMessageSubs', 'bool', true)
      global.configuration.register('moderationLongMessageTimeout', 'core.settings.moderation.moderationLongMessageTimeout', 'number', 120)
      global.configuration.register('moderationLongMessageTriggerLength', 'core.settings.moderation.moderationLongMessageTriggerLength', 'number', 300)

      global.configuration.register('moderationCaps', 'core.settings.moderation.moderationCaps', 'bool', true)
      global.configuration.register('moderationCapsSubs', 'core.settings.moderation.moderationCapsSubs', 'bool', true)
      global.configuration.register('moderationCapsTimeout', 'core.settings.moderation.moderationCapsTimeout', 'number', 120)
      global.configuration.register('moderationCapsTriggerLength', 'core.settings.moderation.moderationCapsTriggerLength', 'number', 15)
      global.configuration.register('moderationCapsMaxPercent', 'core.settings.moderation.moderationCapsMaxPercent', 'number', 50)

      global.configuration.register('moderationSpam', 'core.settings.moderation.moderationSpam', 'bool', true)
      global.configuration.register('moderationSpamSubs', 'core.settings.moderation.moderationSpamSubs', 'bool', true)
      global.configuration.register('moderationSpamTimeout', 'core.settings.moderation.moderationSpamTimeout', 'number', 300)
      global.configuration.register('moderationSpamTriggerLength', 'core.settings.moderation.moderationSpamTriggerLength', 'number', 15)
      global.configuration.register('moderationSpamMaxLength', 'core.settings.moderation.moderationSpamMaxLength', 'number', 15)

      global.configuration.register('moderationColor', 'core.settings.moderation.moderationColor', 'bool', true)
      global.configuration.register('moderationColorSubs', 'core.settings.moderation.moderationColorSubs', 'bool', true)
      global.configuration.register('moderationColorTimeout', 'core.settings.moderation.moderationColorTimeout', 'number', 120)

      global.configuration.register('moderationEmotes', 'core.settings.moderation.moderationEmotes', 'bool', true)
      global.configuration.register('moderationEmotesSubs', 'core.settings.moderation.moderationEmotesSubs', 'bool', true)
      global.configuration.register('moderationEmotesTimeout', 'core.settings.moderation.moderationEmotesTimeout', 'number', 120)
      global.configuration.register('moderationEmotesMaxCount', 'core.settings.moderation.moderationEmotesMaxCount', 'number', 15)

      global.configuration.register('moderationBlacklistTimeout', 'core.settings.moderation.moderationBlacklistTimeout', 'number', 120)
      global.configuration.register('moderationBlacklistSubs', 'core.settings.moderation.moderationBlacklistSubs', 'bool', true)

      global.configuration.register('moderationWarnings', 'core.settings.moderation.moderationWarnings', 'number', 3)
      global.configuration.register('moderationAnnounceTimeouts', 'core.settings.moderation.moderationAnnounceTimeouts', 'bool', true)
      global.configuration.register('moderationWarningsTimeouts', 'core.settings.moderation.moderationWarningsTimeouts', 'bool', true)
    }
  }

  commands () {
    return !global.commons.isSystemEnabled('moderation')
      ? []
      : [
        { command: '!permit', fnc: this.permitLink, permission: constants.OWNER_ONLY, this: this }
      ]
  }

  parsers () {
    return !global.commons.isSystemEnabled('moderation')
      ? []
      : [
        { name: 'moderationLinks', fnc: this.containsLink, priority: constants.MODERATION, permission: constants.VIEWERS, this: this },
        { name: 'moderationSymbols', fnc: this.symbols, priority: constants.MODERATION, permission: constants.VIEWERS, this: this },
        { name: 'moderationLongMessage', fnc: this.longMessage, priority: constants.MODERATION, permission: constants.VIEWERS, this: this },
        { name: 'moderationCaps', fnc: this.caps, priority: constants.MODERATION, permission: constants.VIEWERS, this: this },
        { name: 'moderationSpam', fnc: this.spam, priority: constants.MODERATION, permission: constants.VIEWERS, this: this },
        { name: 'moderationColor', fnc: this.color, priority: constants.MODERATION, permission: constants.VIEWERS, this: this },
        { name: 'moderationEmotes', fnc: this.emotes, priority: constants.MODERATION, permission: constants.VIEWERS, this: this },
        { name: 'moderationBlacklist', fnc: this.blacklist, priority: constants.MODERATION, permission: constants.VIEWERS, this: this }
      ]
  }

  webPanel () {
    global.panel.addMenu({category: 'settings', name: 'moderation', id: 'moderation'})
    global.panel.socketListening(this, 'moderation.lists.get', this.emitLists)
    global.panel.socketListening(this, 'moderation.lists.set', this.setLists)
  }

  async emitLists (self, socket) {
    socket.emit('moderation.lists', {
      blacklist: _.get(await global.db.engine.findOne('settings', { key: 'blacklist' }), 'value', []),
      whitelist: _.get(await global.db.engine.findOne('settings', { key: 'whitelist' }), 'value', [])
    })
  }

  setLists (self, socket, data) {
    global.db.engine.update('settings', { key: 'blacklist' }, { value: data.blacklist.filter(entry => entry.trim() !== '') })
    global.db.engine.update('settings', { key: 'whitelist' }, { value: data.whitelist.filter(entry => entry.trim() !== '') })
  }

  async timeoutUser (self, sender, text, warning, msg, time, type) {
    let [warningsAllowed, warningsTimeout, announceTimeouts, warnings, silent] = await Promise.all([
      global.configuration.getValue('moderationWarnings'),
      global.configuration.getValue('moderationWarningsTimeouts'),
      global.configuration.getValue('moderationAnnounceTimeouts'),
      global.db.engine.find('moderation.warnings', { username: sender.username }),
      self.isSilent(type)
    ])
    text = text.trim()

    // cleanup warnings
    let wasCleaned = false
    for (let warning of _.filter(warnings, (o) => _.now() - o.timestamp > 1000 * 60 * 60)) {
      await global.db.engine.remove('moderation.warnings', { _id: warning._id.toString() })
      wasCleaned = true
    }
    if (wasCleaned) warnings = await global.db.engine.find('moderation.warnings', { username: sender.username })

    if (warningsAllowed === 0) {
      msg = await new Message(msg.replace(/\$count/g, -1)).parse()
      log.timeout(`${sender.username} [${type}] ${time}s timeout | ${text}`)
      global.commons.timeout(sender.username, msg, time)
      return
    }

    const isWarningCountAboveThreshold = warnings.length >= parseInt(warningsAllowed, 10)
    if (isWarningCountAboveThreshold) {
      msg = await new Message(warning.replace(/\$count/g, parseInt(warningsAllowed, 10) - warnings.length)).parse()
      log.timeout(`${sender.username} [${type}] ${time}s timeout | ${text}`)
      global.commons.timeout(sender.username, msg, time)
      await global.db.engine.remove('moderation.warnings', { username: sender.username })
    } else {
      await global.db.engine.insert('moderation.warnings', { username: sender.username, timestamp: _.now() })
      const warningsLeft = parseInt(warningsAllowed, 10) - warnings.length
      warning = await new Message(warning.replace(/\$count/g, warningsLeft < 0 ? 0 : warningsLeft)).parse()
      if (warningsTimeout) {
        log.timeout(`${sender.username} [${type}] 1s timeout, warnings left ${warningsLeft < 0 ? 0 : warningsLeft} | ${text}`)
        global.commons.timeout(sender.username, warning, 1)
      }

      if (announceTimeouts && !silent) {
        global.commons.sendMessage('$sender, ' + warning, sender)
      }
    }
  }

  async whitelist (text) {
    let ytRegex, clipsRegex

    // check if songrequest -or- alias of songrequest contain youtube link -> change it to ID
    if (global.commons.isSystemEnabled('songs')) {
      let alias = await global.db.engine.findOne('alias', { command: 'songrequest' })
      if (!_.isEmpty(alias) && alias.enabled && global.commons.isSystemEnabled('alias')) {
        ytRegex = new RegExp('^(!songrequest|!' + alias.alias + ') \\S+(?:youtu.be\\/|v\\/|e\\/|u\\/\\w+\\/|embed\\/|v=)([^#&?]*).*', 'gi')
      } else {
        ytRegex = /^(!songrequest) \S+(?:youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#&?]*).*/gi
      }
      text = text.replace(ytRegex, '')
    }

    if (!(await global.configuration.getValue('moderationLinksClips'))) {
      clipsRegex = /.*(clips.twitch.tv\/)(\w+)/
      text = text.replace(clipsRegex, '')
    }

    text = ` ${text} `
    let whitelist = await global.db.engine.findOne('settings', { key: 'whitelist' })
    for (let value of _.get(whitelist, 'value', [])) {
      value = value.trim().replace(/\*/g, '[\\pL0-9]*').replace(/\+/g, '[\\pL0-9]+')
      const regexp = XRegExp(` [^\\s\\pL0-9\\w]?${value}[^\\s\\pL0-9\\w]? `, 'gi')
      // we need to change 'text' to ' text ' for regexp to correctly work
      text = XRegExp.replace(` ${text} `, regexp, '').trim()
    }
    return text
  }

  async permitLink (self, sender, text) {
    try {
      var parsed = text.match(/^@?([\S]+) ?(\d+)?$/)
      let count = 1
      if (!_.isNil(parsed[2])) count = parseInt(parsed[2], 10)

      for (let i = 0; i < count; i++) await global.db.engine.insert('moderation.permit', { username: parsed[1].toLowerCase() })

      let m = await global.commons.prepare('moderation.user-have-link-permit', { username: parsed[1].toLowerCase(), link: global.commons.getLocalizedName(count, 'core.links'), count: count })
      debug(m); global.commons.sendMessage(m, sender)
    } catch (e) {
      global.commons.sendMessage(global.translate('moderation.permit-parse-failed'), sender)
    }
  }

  async containsLink (self, sender, text) {
    DEBUG_MODERATION_CONTAINS_LINK('containLinks(%j, %s', sender, text)

    let [isEnabled, isEnabledForSubs, isEnabledForSpaces, timeout, isMod, whitelisted] = await Promise.all([
      global.configuration.getValue('moderationLinks'),
      global.configuration.getValue('moderationLinksSubs'),
      global.configuration.getValue('moderationLinksWithSpaces'),
      global.configuration.getValue('moderationLinksTimeout'),
      global.commons.isMod(sender),
      self.whitelist(text)
    ])

    DEBUG_MODERATION_CONTAINS_LINK('should check links - %s', isEnabled)
    DEBUG_MODERATION_CONTAINS_LINK('isOwner: %s', global.commons.isOwner(sender))
    DEBUG_MODERATION_CONTAINS_LINK('isMod: %s', isMod)
    DEBUG_MODERATION_CONTAINS_LINK('moderate with spaces: %s', isEnabledForSpaces)
    if (global.commons.isOwner(sender) || isMod || !isEnabled || (sender.subscriber && !isEnabledForSubs)) {
      DEBUG_MODERATION_CONTAINS_LINK('checking links skipped')
      return true
    }

    const urlRegex = isEnabledForSpaces
      ? /(www)? ??\.? ?[a-zA-Z0-9]+([a-zA-Z0-9-]+) ??\. ?(aero|bet|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|money|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|sk|sl|sm|sn|so|sr|st|su|sv|sy|sz|tc|td|tf|tg|th|tj|tk|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|um|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zr|zw)\b/ig
      : /[a-zA-Z0-9]+([a-zA-Z0-9-]+)?\.(aero|bet|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|money|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|sk|sl|sm|sn|so|sr|st|su|sv|sy|sz|tc|td|tf|tg|th|tj|tk|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|um|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zr|zw)\b/ig
    DEBUG_MODERATION_CONTAINS_LINK('text to check: "%s"', whitelisted)
    DEBUG_MODERATION_CONTAINS_LINK('link is found in a text: %s', whitelisted.search(urlRegex) >= 0)
    if (whitelisted.search(urlRegex) >= 0) {
      let permit = await global.db.engine.findOne('moderation.permit', { username: sender.username })
      if (!_.isEmpty(permit)) {
        await global.db.engine.remove('moderation.permit', { _id: permit._id.toString() })
        return true
      } else {
        self.timeoutUser(self, sender, whitelisted,
          global.translate('moderation.user-is-warned-about-links'),
          global.translate('moderation.user-have-timeout-for-links'),
          timeout, 'links')
        return false
      }
    } else {
      return true
    }
  }

  async symbols (self, sender, text) {
    let [isEnabled, isEnabledForSubs, whitelisted, isMod, timeout, triggerLength, maxSymbolsConsecutively, maxSymbolsPercent] = await Promise.all([
      global.configuration.getValue('moderationSymbols'),
      global.configuration.getValue('moderationSymbolsSubs'),
      self.whitelist(text),
      global.commons.isMod(sender),
      global.configuration.getValue('moderationSymbolsTimeout'),
      global.configuration.getValue('moderationSymbolsTriggerLength'),
      global.configuration.getValue('moderationSymbolsMaxConsecutively'),
      global.configuration.getValue('moderationSymbolsMaxPercent')
    ])

    var msgLength = whitelisted.trim().length
    var symbolsLength = 0

    if (global.commons.isOwner(sender) || isMod || msgLength < triggerLength || !isEnabled || (sender.subscriber && !isEnabledForSubs)) {
      return true
    }

    var out = whitelisted.match(/([^\s\u0500-\u052F\u0400-\u04FF\w]+)/g)
    for (var item in out) {
      if (out.hasOwnProperty(item)) {
        var symbols = out[item]
        if (symbols.length >= maxSymbolsConsecutively) {
          self.timeoutUser(self, sender, text,
            global.translate('moderation.user-is-warned-about-symbols'),
            global.translate('moderation.user-have-timeout-for-symbols'),
            timeout, 'symbols')
          return false
        }
        symbolsLength = symbolsLength + symbols.length
      }
    }
    if (Math.ceil(symbolsLength / (msgLength / 100)) >= maxSymbolsPercent) {
      self.timeoutUser(self, sender, text, global.translate('moderation.warnings.symbols'), global.translate('moderation.symbols'), timeout, 'symbols')
      return false
    }
    return true
  }

  async longMessage (self, sender, text) {
    let [isEnabled, isEnabledForSubs, isMod, whitelisted, timeout, triggerLength] = await Promise.all([
      global.configuration.getValue('moderationLongMessage'),
      global.configuration.getValue('moderationLongMessageSubs'),
      global.commons.isMod(sender),
      self.whitelist(text),
      global.configuration.getValue('moderationLongMessageTimeout'),
      global.configuration.getValue('moderationLongMessageTriggerLength')
    ])

    var msgLength = whitelisted.trim().length
    if (global.commons.isOwner(sender) || isMod || msgLength < triggerLength || !isEnabled || (sender.subscriber && !isEnabledForSubs)) {
      return true
    } else {
      self.timeoutUser(self, sender, text,
        global.translate('moderation.user-is-warned-about-long-message'),
        global.translate('moderation.user-have-timeout-for-long-message'),
        timeout, 'longmessage')
      return false
    }
  }

  async caps (self, sender, text) {
    let [isEnabled, isEnabledForSubs, isMod, whitelisted, timeout, triggerLength, maxCapsPercent] = await Promise.all([
      global.configuration.getValue('moderationCaps'),
      global.configuration.getValue('moderationCapsSubs'),
      global.commons.isMod(sender),
      self.whitelist(text),
      global.configuration.getValue('moderationCapsTimeout'),
      global.configuration.getValue('moderationCapsTriggerLength'),
      global.configuration.getValue('moderationCapsMaxPercent')
    ])

    var emotesCharList = [] // remove emotes from caps checking
    _.each(sender['emotes'], function (emote) {
      _.each(emote, function (list) {
        _.each(_.range(parseInt(list.split('-')[0], 10), parseInt(list.split('-')[1], 10) + 1), function (val) {
          emotesCharList.push(val)
        })
      })
    })

    var msgLength = whitelisted.trim().length
    var capsLength = 0

    DEBUG_MODERATION_CAPS('emotes - %j', sender['emotes'])
    DEBUG_MODERATION_CAPS('should check caps - %s', isEnabled)
    DEBUG_MODERATION_CAPS('isOwner: %s', global.commons.isOwner(sender))
    DEBUG_MODERATION_CAPS('isMod: %s', isMod)

    const regexp = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]/gi
    whitelisted = whitelisted.trim()
    for (let i = 0; i < whitelisted.length; i++) {
      // if is emote or symbol - continue
      if (_.includes(emotesCharList, i) || !_.isNull(whitelisted.charAt(i).match(regexp))) {
        DEBUG_MODERATION_CAPS(`Emotes char at position ${i}, ${whitelisted.charAt(i)}`)
        msgLength = parseInt(msgLength, 10) - 1
        continue
      } else if (!_.isFinite(parseInt(whitelisted.charAt(i), 10)) && whitelisted.charAt(i).toUpperCase() === whitelisted.charAt(i) && whitelisted.charAt(i) !== ' ') {
        DEBUG_MODERATION_CAPS(`Capped char at position ${i}, ${whitelisted.charAt(i)}`)
        capsLength += 1
      }
    }

    DEBUG_MODERATION_CAPS('msgLength: %s', msgLength)
    DEBUG_MODERATION_CAPS('triggerLength: %s', triggerLength)
    DEBUG_MODERATION_CAPS('capped chars: %i', capsLength)
    DEBUG_MODERATION_CAPS('triggerPercent: %i%', maxCapsPercent)
    DEBUG_MODERATION_CAPS('capped percent: %i%', Math.ceil(capsLength / (msgLength / 100)))

    if (global.commons.isOwner(sender) || isMod || msgLength < triggerLength || !isEnabled || (sender.subscriber && !isEnabledForSubs)) {
      return true
    }
    if (Math.ceil(capsLength / (msgLength / 100)) >= maxCapsPercent) {
      self.timeoutUser(self, sender, text,
        global.translate('moderation.user-is-warned-about-caps'),
        global.translate('moderation.user-have-timeout-for-caps'),
        timeout, 'caps')
      return false
    }
    return true
  }

  async spam (self, sender, text) {
    let [isEnabled, isEnabledForSubs, isMod, whitelisted, timeout, triggerLength, maxSpamLength] = await Promise.all([
      global.configuration.getValue('moderationSpam'),
      global.configuration.getValue('moderationSpamSubs'),
      global.commons.isMod(sender),
      self.whitelist(text),
      global.configuration.getValue('moderationSpamTimeout'),
      global.configuration.getValue('moderationSpamTriggerLength'),
      global.configuration.getValue('moderationSpamMaxLength')
    ])

    var msgLength = whitelisted.trim().length

    if (global.commons.isOwner(sender) || isMod || msgLength < triggerLength || !isEnabled || (sender.subscriber && !isEnabledForSubs)) {
      return true
    }
    var out = whitelisted.match(/(.+)(\1+)/g)
    for (var item in out) {
      if (out.hasOwnProperty(item) && out[item].length >= maxSpamLength) {
        self.timeoutUser(self, sender, text,
          global.translate('moderation.user-have-timeout-for-spam'),
          global.translate('moderation.user-is-warned-about-spam'),
          timeout, 'spam')
        return false
      }
    }
    return true
  }

  async color (self, sender, text) {
    let [isEnabled, isEnabledForSubs, isMod, timeout] = await Promise.all([
      global.configuration.getValue('moderationColor'),
      global.configuration.getValue('moderationColorSubs'),
      global.commons.isMod(sender),
      global.configuration.getValue('moderationColorTimeout')
    ])

    if (global.commons.isOwner(sender) || isMod || !isEnabled || (sender.subscriber && !isEnabledForSubs)) {
      return true
    }

    if (sender['message-type'] === 'action') {
      self.timeoutUser(self, sender, text,
        global.translate('moderation.user-is-warned-about-color'),
        global.translate('moderation.user-have-timeout-for-color'),
        timeout, 'color')
      return false
    } else return true
  }

  async emotes (self, sender, text) {
    let [isEnabled, isEnabledForSubs, isMod, timeout, maxCount] = await Promise.all([
      global.configuration.getValue('moderationEmotes'),
      global.configuration.getValue('moderationEmotesSubs'),
      global.commons.isMod(sender),
      global.configuration.getValue('moderationEmotesTimeout'),
      global.configuration.getValue('moderationEmotesMaxCount')
    ])

    var count = 0
    if (global.commons.isOwner(sender) || isMod || !isEnabled || (sender.subscriber && !isEnabledForSubs)) {
      return true
    }

    _.each(sender['emotes'], function (value, index) {
      count = count + value.length
    })

    if (count > maxCount) {
      self.timeoutUser(self, sender, text,
        global.translate('moderation.user-is-warned-about-emotes'),
        global.translate('moderation.user-have-timeout-for-emotes'),
        timeout, 'emotes')
      return false
    } else return true
  }

  async blacklist (self, sender, text) {
    let [isEnabledForSubs, isMod, timeout, blacklist] = await Promise.all([
      global.configuration.getValue('moderationBlacklistSubs'),
      global.commons.isMod(sender),
      global.configuration.getValue('moderationBlacklistTimeout'),
      global.db.engine.findOne('settings', { key: 'blacklist' })
    ])
    if (global.commons.isOwner(sender) || isMod || (sender.subscriber && !isEnabledForSubs)) {
      return true
    }

    let isOK = true
    for (let value of _.get(blacklist, 'value', [])) {
      value = value.trim().replace(/\*/g, '[\\pL0-9]*').replace(/\+/g, '[\\pL0-9]+')
      const regexp = XRegExp(` [^\\s\\pL0-9\\w]?${value}[^\\s\\pL0-9\\w]? `, 'gi')
      // we need to change 'text' to ' text ' for regexp to correctly work
      if (XRegExp.exec(` ${text} `, regexp) && value.length > 0) {
        isOK = false
        self.timeoutUser(self, sender, text,
          global.translate('moderation.user-is-warned-about-blacklist'),
          global.translate('moderation.user-have-timeout-for-blacklist'),
          timeout, 'blacklist')
      }
      return isOK
    }
    return isOK
  }

  async isSilent (name) {
    let item = await global.db.engine.findOne('moderation.message.cooldown', { key: name })
    if (_.isEmpty(item) || (_.now() - item.value) >= 60000) {
      await global.db.engine.update('moderation.message.cooldown', { key: name }, { value: _.now() })
      return false
    }
    return true
  }
}

module.exports = new Moderation()
