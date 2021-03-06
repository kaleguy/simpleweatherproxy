/*jslint node: true, indent: 2 */
'use strict'

const corsMiddleware = require('restify-cors-middleware')
const swaggerJSDoc = require('swagger-jsdoc')
var exports = module.exports = {}

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const url = process.env.MONGO_URL || 'mongodb://localhost:27017';
let db = null;
let cache = null;

const options = {
  swaggerDefinition: {
    info: {
      title: 'Scraper API for ResearchGate', // Title (required)
      description: 'Endpoints for extracting JSON data from ResearchGate endpoints',
      version: '1.0.0' // Version (required)
    },
    tags: [
      {
        "name": "Weather",
        "description": "Simple pass-through demo endpoint."
      },
      {
        "name": "ResearchGate",
        "description": "Endpoints to extract JSON from ResearchGate pages."
      }
    ],
    basePath: '',
    schemes: ['http', 'https']
  },
  apis: [
    __dirname + '/routes/weather.js',
    __dirname + '/routes/rg.js',
    __dirname + '/index.js'
  ] // Path to the API docs
}
const swaggerSpec = swaggerJSDoc(options)

/**
 *
 * @swagger
 * definitions:
 *   report:
 *     type: object
 *     required:
 *       - coord
 *       - weather
 *       - base
 *       - main
 *       - visibility
 *       - wind
 *       - clouds
 *       - dt
 *       - sys
 *       - id
 *       - name
 *       - cod
 *     properties:
 *       coord:
 *         type: object
 *       weather:
 *         type: array
 *         items:
 *           type: string
 *       base:
 *         type: string
 *       main:
 *         type: object
 *       visibility:
 *         type: integer
 *       wind:
 *         type: object
 *       clouds:
 *         type: object
 *       dt: integer
 *       sys:
 *         type: object
 *       id: integer
 *       name: string
 *       cod: integer
 *
 */


let restify, bunyan, routes, log, server

restify = require('restify')
bunyan  = require('bunyan')
routes  = require('./routes/')

log = bunyan.createLogger({
  name        : 'restify',
  level       : process.env.LOG_LEVEL || 'info',
  stream      : process.stdout,
  serializers : bunyan.stdSerializers
})

server = restify.createServer({
  name : 'restify',
  log  : log,
})

MongoClient.connect(url, function(err, client) {

  // assert.equal(null, err);
  if (err) {
    console.log('No database available, results will not be cached.')
    db = {}
    cache = {}
    cache.findOne = cache.insertOne = (o, cb) => { return cb() }
  } else {
    console.log('Connected successfully to server')
    db = client.db('rg-cache')
    cache = db.collection('documents');
  }

  server.use(corsMiddleware({
    origins: [
      'https://kaleguy.github.io',
      'http://localhost:8080'
    ]// defaults to ['*']
    //  credentials: true,                 // defaults to false
    // headers: ['x-foo']                 // sets expose-headers
  }).actual)
  server.use(restify.plugins.bodyParser({ mapParams: false }))
  server.use(restify.plugins.queryParser())
  server.use(restify.plugins.gzipResponse())
  server.pre(restify.plugins.pre.sanitizePath())

  // This version of restify can't handle hyphens in url params... gross hack here to fix
  function encodeHyphens(req, res, next) {
    req.url = req.url.replace(/-/g, '__');
    return next();
  }
  // server.pre(encodeHyphens)

  /*jslint unparam:true*/
  // Default error handler. Personalize according to your needs.
  /* istanbul ignore next */
  server.on('uncaughtException', function (req, res, route, err) {
    console.log('******* Begin Error *******')
    console.log(route)
    console.log('*******')
    console.log(err.stack)
    console.log('******* End Error *******')
    if (!res.headersSent) {
      return res.send(500, { ok : false })
    }
    res.write("\n")
    res.end()
  })
  /*jslint unparam:false*/

  // server.on('after', restify.plugins.auditLogger({ log: log }))
  routes(server)

  // serve swagger docs
  server.get('/public/swagger/*', restify.plugins.serveStatic({
    directory: __dirname,
    default: 'index.html'
  }))

  // serve swagger spec
  server.get('/api-docs.json', function(req, res) {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })

  console.log('Server started.')
  server.listen(process.env.PORT || 8888, function () {
    log.info('%s listening at %s', server.name, server.url)
  })
  const app = server

  function checkCache(req, res, next) {
    const cb = (err, result) => {
      if (result) {
        delete result._id;
        console.log(`Retrieving ${result.key} from cache.`)
        res.json(result);
      } else {
        console.log(`Retrieving ${req.url}.`)
        next();
      }
    }
    cache.findOne( { key : req.url }, cb );
    //next()
  }
  app.use(checkCache);

  module.exports = app
  exports.cache = cache
  exports.close = server.close

});



