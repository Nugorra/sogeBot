'use strict'

var express = require('express')
const bodyParser = require('body-parser')
var http = require('http')
var path = require('path')
var basicAuth = require('basic-auth')
const flatten = require('flat')
var _ = require('lodash')

const Parser = require('./parser')

const config = require('../config.json')

const NOT_AUTHORIZED = '0'

function Panel () {
  // setup static server
  var app = express()
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  this.server = http.createServer(app)
  this.port = process.env.PORT || config.panel.port

  // webhooks integration
  app.post('/webhooks/hub/follows', (req, res) => {
    global.webhooks.follower(req.body)
    res.sendStatus(200)
  })
  app.post('/webhooks/hub/streams', (req, res) => {
    global.webhooks.stream(req.body)
    res.sendStatus(200)
  })

  app.get('/webhooks/hub/follows', (req, res) => {
    global.webhooks.challenge(req, res)
  })
  app.get('/webhooks/hub/streams', (req, res) => {
    global.webhooks.challenge(req, res)
  })

  // static routing
  app.use('/dist', express.static(path.join(__dirname, '..', 'public', 'dist')))
  app.get('/popout/', this.authUser, function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'popout.html'))
  })
  app.get('/oauth/:page', this.authUser, function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'oauth', req.params.page + '.html'))
  })
  app.get('/auth/token.js', function (req, res) {
    const origin = req.headers.referer ? req.headers.referer.substring(0, req.headers.referer.length - 1) : undefined
    const domain = config.panel.domain.split(',').map((o) => o.trim()).join('|')
    if (_.isNil(origin)) {
      // file CANNOT be accessed directly
      res.status(401).send('401 Access Denied - This is not a file you are looking for.')
      return
    }

    if (origin.match(new RegExp('^((http|https)\\:\\/\\/|)([\\w|-]+\\.)?' + domain))) {
      res.set('Content-Type', 'application/javascript')
      res.send(`const token="${config.panel.token.trim()}"; const name="${config.settings.bot_username}"`)
    } else {
      // file CANNOT be accessed from different domain
      res.status(403).send('403 Forbidden - You are looking at wrong castle.')
    }
  })
  app.get('/playlist', function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'playlist', 'index.html'))
  })
  app.get('/overlays/:overlay', function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'overlays', req.params.overlay + '.html'))
  })
  app.get('/custom/:custom', function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'custom', req.params.custom + '.html'))
  })
  app.get('/favicon.ico', function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'favicon.ico'))
  })
  app.get('/', this.authUser, function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
  })
  app.get('/:type/registry/:subtype/:page', this.authUser, function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', req.params.type, 'registry', req.params.subtype, req.params.page))
  })
  app.get('/:type/:subtype/:page', this.authUser, function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', req.params.type, req.params.subtype, req.params.page))
  })
  app.get('/:type/:page', this.authUser, function (req, res) {
    res.sendFile(path.join(__dirname, '..', 'public', req.params.type, req.params.page))
  })

  this.io = require('socket.io')(this.server)
  this.menu = [{category: 'main', name: 'dashboard', id: 'dashboard'}]
  this.widgets = []
  this.socketListeners = []

  global.configuration.register('theme', 'core.theme', 'string', 'light')
  global.configuration.register('percentage', 'core.percentage', 'bool', true)

  this.addMenu({category: 'settings', name: 'systems', id: 'systems'})

  this.registerSockets({
    self: this,
    expose: ['sendStreamData'],
    finally: null
  })

  this.io.use(function (socket, next) {
    if (config.panel.token.trim() === socket.request._query['token']) next()
    return false
  })

  var self = this
  this.io.on('connection', function (socket) {
    // check auth
    socket.emit('authenticated')

    self.sendMenu(socket)
    self.sendWidget(socket)

    // twitch game and title change
    socket.on('getGameFromTwitch', function (game) { global.api.sendGameFromTwitch(global.api, socket, game) })
    socket.on('getUserTwitchGames', async () => { socket.emit('sendUserTwitchGamesAndTitles', await global.cache.gamesTitles()) })
    socket.on('deleteUserTwitchGame', async (game) => {
      let gamesTitles = await global.cache.gamesTitles(); delete gamesTitles[game]
      socket.emit('sendUserTwitchGamesAndTitles', await global.cache.gamesTitles(gamesTitles))
    })
    socket.on('deleteUserTwitchTitle', async (data) => {
      let gamesTitles = await global.cache.gamesTitles()
      _.remove(gamesTitles[data.game], function (aTitle) {
        return aTitle === data.title
      })
      socket.emit('sendUserTwitchGamesAndTitles', await global.cache.gamesTitles(gamesTitles))
    })
    socket.on('editUserTwitchTitle', async (data) => {
      data.new = data.new.trim()

      if (data.new.length === 0) {
        await self.deleteUserTwitchTitle(self, socket, data)
        return
      }

      let gamesTitles = await global.cache.gamesTitles()
      if (_.isEmpty(_.find(gamesTitles[data.game], (v) => v.trim() === data.title.trim()))) {
        gamesTitles[data.game].push(data.new) // also, we need to add game and title to cached property
      } else {
        gamesTitles[data.game][gamesTitles[data.game].indexOf(data.title)] = data.new
      }
      await global.cache.gamesTitles(gamesTitles)
    })
    socket.on('updateGameAndTitle', async (data) => {
      global.api.setTitleAndGame(global.api, null, data)

      data.title = data.title.trim()
      data.game = data.game.trim()

      let gamesTitles = await global.cache.gamesTitles()

      // create game if not in cache
      if (_.isNil(gamesTitles[data.game])) gamesTitles[data.game] = []

      if (_.isEmpty(_.find(gamesTitles[data.game], (v) => v.trim() === data.title))) {
        gamesTitles[data.game].push(data.title) // also, we need to add game and title to cached property
      }

      await global.cache.gamesTitles(gamesTitles)
      self.sendStreamData(self, global.panel.io) // force dashboard update
    })
    socket.on('joinBot', () => { global.client.join('#' + config.settings.broadcaster_username) })
    socket.on('leaveBot', () => {
      global.client.part('#' + config.settings.broadcaster_username)
      global.db.engine.remove('users.online', {}) // force all users offline
    })

    // custom var
    socket.on('custom.variable.value', async (variable, cb) => {
      let value = global.translate('webpanel.not-available')
      let isVariableSet = await global.customvariables.isVariableSet(variable)
      if (isVariableSet) value = await global.customvariables.getValueOf(variable)
      cb(null, value)
    })

    socket.on('responses.get', async function (at, callback) {
      const responses = flatten(!_.isNil(at) ? global.lib.translate.translations[await global.configuration.getValue('lang')][at] : global.lib.translate.translations[await global.configuration.getValue('lang')])
      _.each(responses, function (value, key) {
        let _at = !_.isNil(at) ? at + '.' + key : key
        responses[key] = {} // remap to obj
        responses[key].default = global.translate(_at, true)
        responses[key].current = global.translate(_at)
      })
      callback(responses)
    })
    socket.on('responses.set', function (data) {
      _.remove(global.lib.translate.custom, function (o) { return o.key === data.key })
      global.lib.translate.custom.push(data)
      global.lib.translate._save()

      let lang = {}
      _.merge(
        lang,
        global.translate({root: 'webpanel'}),
        global.translate({root: 'ui'}) // add ui root -> slowly refactoring to new name
      )
      socket.emit('lang', lang)
    })
    socket.on('responses.revert', async function (data, callback) {
      _.remove(global.lib.translate.custom, function (o) { return o.key === data.key })
      await global.db.engine.remove('customTranslations', { key: data.key })
      let translate = global.translate(data.key)
      callback(translate)
    })

    socket.on('getWidgetList', function () { self.sendWidgetList(self, socket) })
    socket.on('addWidget', function (widget) { self.addWidgetToDb(self, widget, socket) })
    socket.on('updateWidgets', function (widgets) { self.updateWidgetsInDb(self, widgets, socket) })
    socket.on('getConnectionStatus', function () { socket.emit('connectionStatus', global.status) })
    socket.on('saveConfiguration', function (data) {
      _.each(data, function (index, value) {
        if (value.startsWith('_')) return true
        global.configuration.setValue(global.configuration, { username: global.commons.getOwner() }, value + ' ' + index, data._quiet)
      })
    })
    socket.on('getConfiguration', async function () {
      var data = {}
      for (let key of global.configuration.sets(global.configuration)) data[key] = await global.configuration.getValue(key)
      socket.emit('configuration', data)
    })

    // send enabled systems
    socket.on('getSystems', function () { socket.emit('systems', config.systems) })
    socket.on('getVersion', function () { socket.emit('version', process.env.npm_package_version) })

    socket.on('parser.isRegistered', function (data) {
      socket.emit(data.emit, { isRegistered: new Parser().find(data.command) })
    })

    _.each(self.socketListeners, function (listener) {
      socket.on(listener.on, async function (data) {
        if (typeof listener.fnc !== 'function') {
          throw new Error('Function for this listener is undefined' +
            ' widget=' + listener.self.constructor.name + ' on=' + listener.on)
        }
        try { await listener.fnc(listener.self, self.io, data) } catch (e) { global.log.error(e, listener.fnc) }
        if (listener.finally && listener.finally !== listener.fnc) listener.finally(listener.self, self.io)
      })
    })

    // send webpanel translations
    let lang = {}
    _.merge(
      lang,
      global.translate({root: 'webpanel'}),
      global.translate({root: 'ui'}) // add ui root -> slowly refactoring to new name
    )
    socket.emit('lang', lang)
  })
}

Panel.prototype.expose = function () {
  this.server.listen(global.panel.port, function () {
    global.log.info(`WebPanel is available at http://localhost:${global.panel.port}`)
  })
}

Panel.prototype.authUser = function (req, res, next) {
  var user = basicAuth(req)
  try {
    if (user.name === config.panel.username &&
        user.pass === config.panel.password) {
      return next()
    } else {
      throw new Error(NOT_AUTHORIZED)
    }
  } catch (e) {
    res.set('WWW-Authenticate', `Basic realm="Authorize to '${config.settings.broadcaster_username.toUpperCase()}' WebPanel`)
    return res.sendStatus(401)
  }
}

Panel.prototype.addMenu = function (menu) { this.menu.push(menu) }

Panel.prototype.sendMenu = function (socket) { socket.emit('menu', this.menu) }

Panel.prototype.addWidget = function (id, name, icon) { this.widgets.push({id: id, name: name, icon: icon}) }

Panel.prototype.sendWidget = async function (socket) {
  socket.emit('widgets', await global.db.engine.find('widgets'))
}

Panel.prototype.sendWidgetList = async function (self, socket) {
  let widgets = await global.db.engine.find('widgets')
  if (_.isEmpty(widgets)) socket.emit('widgetList', self.widgets)
  else {
    var sendWidgets = []
    _.each(self.widgets, function (widget) {
      if (!_.includes(_.map(widgets, 'id'), widget.id)) {
        sendWidgets.push(widget)
      }
    })
    socket.emit('widgetList', sendWidgets)
  }
}

Panel.prototype.updateWidgetsInDb = async function (self, widgets, socket) {
  await global.db.engine.remove('widgets', {}) // remove widgets
  let toAwait = []
  for (let widget of widgets) {
    toAwait.push(global.db.engine.update('widgets', { id: widget.id }, { id: widget.id, position: {x: widget.position.x, y: widget.position.y}, size: { width: widget.size.width, height: widget.size.height } }))
  }
  await Promise.all(toAwait)
}

Panel.prototype.addWidgetToDb = async function (self, widget, socket) {
  await global.db.engine.update('widgets', { id: widget }, { id: widget, position: {x: 0, y: 0}, size: { width: 4, height: 3 } })
  self.sendWidget(socket)
}

Panel.prototype.socketListening = function (self, on, fnc) {
  this.socketListeners.push({self: self, on: on, fnc: fnc})
}

Panel.prototype.registerSockets = function (options) {
  const name = options.self.constructor.name.toLowerCase()
  for (let fnc of options.expose) {
    if (!_.isFunction(options.self[fnc])) global.log.error(`Function ${fnc} of ${options.self.constructor.name} is undefined`)
    else this.socketListeners.push({self: options.self, on: `${name}.${fnc}`, fnc: options.self[fnc], finally: options.finally})
  }
}

Panel.prototype.sendStreamData = async function (self, socket) {
  const whenOnline = (await global.cache.when()).online
  var data = {
    uptime: global.commons.getTime(whenOnline, false),
    currentViewers: _.get(await global.db.engine.findOne('api.current', { key: 'viewers' }), 'value', 0),
    currentSubscribers: _.get(await global.db.engine.findOne('api.current', { key: 'subscribers' }), 'value', 0),
    currentBits: _.get(await global.db.engine.findOne('api.current', { key: 'bits' }), 'value', 0),
    currentTips: _.get(await global.db.engine.findOne('api.current', { key: 'tips' }), 'value', 0),
    currency: global.currency.symbol(await global.configuration.getValue('currency')),
    chatMessages: await global.cache.isOnline() ? global.linesParsed - global.api.chatMessagesAtStart : 0,
    currentFollowers: _.get(await global.db.engine.findOne('api.current', { key: 'followers' }), 'value', 0),
    currentViews: _.get(await global.db.engine.findOne('api.current', { key: 'views' }), 'value', 0),
    maxViewers: _.get(await global.db.engine.findOne('api.max', { key: 'viewers' }), 'value', 0),
    newChatters: _.get(await global.db.engine.findOne('api.new', { key: 'chatters' }), 'value', 0),
    game: _.get(await global.db.engine.findOne('api.current', { key: 'game' }), 'value', null),
    status: _.get(await global.db.engine.findOne('api.current', { key: 'status' }), 'value', null),
    rawStatus: await global.cache.rawStatus(),
    currentHosts: _.get(await global.db.engine.findOne('api.current', { key: 'hosts' }), 'value', 0)
  }
  socket.emit('stats', data)
}

module.exports = Panel
