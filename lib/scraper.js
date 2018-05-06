const assert = require('assert')
const restify = require('restify-clients')
const nconf = require('nconf')
const jsdom = require('jsdom');
const _ = require('lodash')
const { JSDOM } = jsdom
const moment = require('moment')

function mergeList (d) {
  const merged = {}
  d.forEach(collection => {
    _.each(collection, (v, k) => {
      if (_.isArray(merged[k]) && _.isArray(v)) {
        merged[k] = _.concat(merged[k], v)
      } else {
        merged[k] = v
      }
    })
  })
  return merged
}

module.exports = function (url) {
  let module = {};
  const client = restify.createClient({url});

  /**
   *
   * @param selectors {object} Object with css selectors for plucking data
   * @param path {string or array} e.g. '/publication/{id}/JordanPeterson' or ['/publication/{id}/JordanPeterson','/publication/{id}/JordanPeterson2'], the subpath in the target API for a particular endpoint
   * @param res {object} the restify response object
   */
  module.scrape = function scrape (res, selectors, path, id) {

    if (_.isArray(path)) {
      let promises = [];
      path.forEach(p => {
        promises.push(getResultSet(p, selectors, id))
      })
      Promise.all(promises).then(d => {
        // const merged = {}
        d = mergeList(d)
        // console.log(merged.articles.length)
        return res.json(d)
      })
        .catch(e => res.send(e.message))
    } else {
      getResultSet(path, selectors, id)
        .then(d => res.json(d))
        .catch(e => res.json(e.message))
    }

  }

  function getResultSet (path, selectors, id) {
    path = path.replace('{id}', id)
    return new Promise((resolve, reject) => {
      console.log('Getting path', path)
      client.get(path, function (err, req) {
        if (err) { console.log('Error:', err) }
        req.on('result', function (err, tres) {
          if (err) {
            resolve([])
            console.log('Error result:', err)
          }
          tres.body = ''
          tres.setEncoding('utf8')
          tres.on('data', function (chunk) {
            tres.body += chunk
          })
          tres.on('end', function () {
            const body = tres.body
            const dom = new JSDOM(body)
            const data = getDataFromSelectors(dom, selectors)
            console.log('Got path', path)
            data.url = url + path
            resolve(data)
          })
        })
      })
    })
  }

  function getDomList (dom, selector) {
    const items = []
    let els = dom.querySelectorAll(selector.selector)
    const subselectors = selector.subselectors
    els.forEach(el => {
      let item = {}
      _.each(subselectors, (s) => {
        let t = ''
        let propName = Object.keys(s)[0]
        let propSelector = s[propName]
        if (el.querySelector(propSelector)) {
          t = getDomText(el, propSelector)
        }
        if (t) {
          item[propName] = t
        }
      })
      if (!_.isEmpty(item)) {
        items.push(item)
      }
    })
    return items
  }

  function getDomText (dom, selector) {
    let text = ''
    if (_.isObject(selector)) {
      return getDomList(dom, selector)
    }
    let el = dom.querySelector(selector)
    if (el) {
      text = el.textContent.replace(/\s+·\s+/,'').trim() // hack for garbage in rg text
      if (/^meta/.test(selector)) {
        console.log('meta')
        text = el.getAttribute('content').trim()
      }
      if (el.tagName === 'A') {
        text = {
          href: el.getAttribute('href'),
          text: text
        }
      }
    }
    return text
  }
  function getDataFromSelectors (dom, selectors) {
    const data = {}
    _.each(selectors, (v, k) => {
      let t = getDomText(dom.window.document, v)
      if ((k === 'date') && t) {
        try {
          t = moment(t).format('YYYY-MM')
        } catch (e) {

        }
      }
      data[k] = t
    })
    return data
  }
  return module
}