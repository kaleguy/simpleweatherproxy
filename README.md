[![Build Status](https://travis-ci.org/kaleguy/simpleweatherproxy.svg?branch=master)](https://travis-ci.org/kaleguy/simpleweatherproxy)
[![Dependency Status](https://david-dm.org/kaleguy/simpleweatherproxy.svg)](https://david-dm.org/kaleguy/simpleweatherproxy)
[![Coverage Status](https://coveralls.io/repos/github/kaleguy/simpleweatherproxy/badge.svg?branch=master)](https://coveralls.io/github/kaleguy/simpleweatherproxy?branch=master)

## Synopsis

A proxy to provide a basic API to scrape JSON data from ResearchGate pages.  

Endpoints implemented:

* Article info by title
* Author info
* List of articles by author
* List of citations by article

Example url:
```
http://localhost:8888/rg/article?title=282790843_Differences_in_Media_Preference_Mediate_the_Link_Between_Personality_and_Political_Orientation
```

The existing endpoints can be easily adapted to scrape a different site.

Implemented with Restify (version 7).

## Update for Version 1.1

ResearchGate has made changes to their site that make scraping more of a challenge, so version 1.1 has a few changes:

1. Author lists on the article page may be incomplete and require another cick to retrieve the full list. 
  No fix for this currently. If you scrape a page like this, you'll need to add the additional authors manually.
1. Some articles have different formatting than others. To deal with this, you can now add selectors (see below) in an 
  array, the selector that returns a value will be used.
1. Some items, for example number of reads no longer have any enclosing element and can't be selected by CSS alone. 
  For this case, the feature has been added of being able to append a regular expression to the end of the selector.
  See below for example.
1. In some cases ResearchGate may not return a result unless you send a cookie. If this happens, access the site via 
  browser and then retrieve the cookie from the Developer Console of your browser, and paste that value into the 
  .set("Cookie", '') line in scraper.js      


## Configuring Endpoints

To scrape the page referenced above, the following selectors are configured in the endpoint:

```
    const selectors = {
      pubdate: 'meta[property="citation_publication_date"]',
      title: 'h1.nova-e-text--size-xxxl',
      citations:
        [
          'DIV.nova-e-text.nova-e-text--size-m.nova-e-text--family-sans-serif.nova-e-text--spacing-none.nova-e-text--color-inherit.publication-resources-summary__see-all-count strong',
          '.ga-resources-citations span.publication-resource-link-amount'
        ],
      references: [
        'DIV.nova-o-pack__item:nth-child(2) DIV.nova-e-text.nova-e-text--size-m.nova-e-text--family-sans-serif.nova-e-text--spacing-none.nova-e-text--color-inherit.publication-resources-summary__see-all-count strong',
        '.ga-resources-references span.publication-resource-link-amount'
        ],
      reads: [
        'DIV.nova-e-text.nova-e-text--size-m.nova-e-text--family-sans-serif.nova-e-text--spacing-xxs.nova-e-text--color-grey-700:not(span) /with\\s(.*?)$/',
        '.publication-meta-stats',
      ],
      journal:
        [
        'A.nova-e-link.nova-e-link--color-blue.nova-e-link--theme-bare',
        '.publication-meta-journal A',
        ],
      abstract: [
         '.publication-abstract .nova-e-text--spacing-auto',
         'DIV.nova-e-text.nova-e-text--size-m.nova-e-text--family-sans-serif.nova-e-text--spacing-auto.nova-e-text--color-inherit'
        ],
      authors: {
        selector: '.publication-author-list__item',
        subselectors: [
          { name: '.nova-v-person-list-item__title A' },
          { institution: 'LI.nova-v-person-list-item__meta-item:last-child SPAN' }
        ]
      }
    }

```

Note that some selectors (e.g. 'abstract') are arrays. This is to deal with multiple page formats.

Also note the regular expression at the end of the first "reads" selector. The value of this applied to the value of the 
first selector will be returned.


Sample output for the above url:

```
{
   "pubdate":"2015/10/01",
   "title":"Differences in Media Preference Mediate the Link Between Personality and Political Orientation",
   "cits":"6",
   "refs":"62",
   "date":"2015-10",
   "reads":"2,632 Reads",
   "journal":{
      "href":"journal/1467-9221_Political_Psychology",
      "text":"Political Psychology"
   },
   "abstract":"Research has consistently demonstrated that political liberalism is predicted by the personality trait Openness to Experience and conservatism by trait Conscientiousness. Less well studied, however, is how trait personality influences political orientation. The present study investigated whether differences in media preference might mediate the links between personality and political orientation. Participants completed measures of Big Five personality, media preferences, and political orientation. Results revealed that increased preferences for Dark/Alternative and Aesthetic/Musical media genres, as well as decreased preferences for Communal/Popular media genres, mediated the association between Openness to Experience and liberalism. In contrast, greater preferences for Communal/Popular and Thrilling/Action genres, as well as lower preferences for Dark/Alternative and Aesthetic/Musical genres mediated the link between Conscientiousness and conservatism.",
   "authors":[
      {
         "name":{
            "href":"https://www.researchgate.net/profile/Xiaowen_Xu4",
            "text":"Xiaowen Xu"
         },
         "institution":"University of Toronto"
      },
      {
         "name":{
            "href":"https://www.researchgate.net/profile/Jordan_Peterson2",
            "text":"Jordan B Peterson"
         },
         "institution":"University of Toronto"
      }
   ],
   "url":"https://www.researchgate.net/publication/282790843_Differences_in_Media_Preference_Mediate_the_Link_Between_Personality_and_Political_Orientation"
}
```
 
## More About Selectors

The following examples show how the selectors work with the above target url.

The selector object takes keys with CSS selector values. For example:

```
pubdate: 'meta[property="citation_publication_date"]'
```

This will result in JSON with the same key, with the value being the text found at the target document at the specified location.

If the CSS selector returns an 'A' element, the value returned will be an object, e.g. :

```
journal: '.publication-meta-journal A',
```

returns:

```
  "journal":{
      "href":"journal/1467-9221_Political_Psychology",
      "text":"Political Psychology"
   },
```

If the selector value is an object, then a list of objects will be returned. For example the
following will return an array of article objects (the publicaton-author-list__item selector selects for an article). 
The subselectors determine the keys of the list object. 

```
  authors: {
    selector: '.publication-author-list__item',
    subselectors: [
      { name: '.nova-v-person-list-item__title A' },
      { rating: '.nova-v-person-list-item__meta SPAN:first-child' },
      { institution: '.nova-v-person-list-item__meta LI:nth-child(2) SPAN' }
    ]
  }  
```

returns:

```
   "authors":[
      {
         "name":{
            "href":"https://www.researchgate.net/profile/Xiaowen_Xu4",
            "text":"Xiaowen Xu"
         },
         "rating":"14.72",
         "institution":"University of Toronto"
      },
      {
         "name":{
            "href":"https://www.researchgate.net/profile/Jordan_Peterson2",
            "text":"Jordan B Peterson"
         },
         "rating":"39.79",
         "institution":"University of Toronto"
      }
   ],
```    

## XPath Selectors

If a selector begins with '//' it will be assumed to be an XPath selector and not a CSS selector. Element names need to be namespaced with "x", for example:

```
'//x:th[contains(text(),\'Document type\')]/parent::*/x:td'
```

## Multipage Targets

Endpoints can be configured to scrape multiple pages at a given target site.

Endpoints use the 'scaper' function with a path for the target. If the path is an array, the scraper will visit each path and return the merged results.

See the rg.js file for examples.


## Installation

Note: if you want the weather demo endpoint to be functional,
rename .config.example.json to .config.json, edit with your openWeather API key.

To install and run, install and start mongodb. Then:

```
npm install
npm start
```

## Caching

If mongodb is running locally, the results of searches will get cached to Mongo.

## Swagger-JSDoc and Swagger-Test

This project uses the swagger-jsdoc module, which allows for documenting endpoints inline with Swagger YAML:
(The example below below is for the example Open Weather API endpoint.

```
  /**
   * @swagger
   * /weather/{city}:
   *   get:
   *     description: "Returns current weather in the specified city to the caller"
   *     summary: "Get Weather by City"
   *     tags: [Weather]
   *     parameters:
   *       - name: city
   *         in: path
   *         description: "The city you want weather for in the form city,state,country"
   *         required: true
   *         type: string
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: |-
   *           weather response
   *         schema:
   *           $ref: "#/definitions/report"
   *     x-amples:
   *     - description: Get Weather
   *       request:
   *         params:
   *          city: NYC
   *       responses:
   *          200:
   *            headers:
   *               content-type: "application/json; charset=utf-8"
   *            body:
   *               name: 'New York'
   *
   */
```
The swagger-jsdoc module converts this into swagger json, which you can then view with the Swagger UI webapp, see next
section.

The x-amples section in the comments above will be turned into a test by swagger-test, see the testing section below.

## API Reference

Swagger Docs generated from inline Swagger comments, processed by Swagger-JSDocs. 

When running locally the Swagger UI will be reachable at http://localhost:8888/public/swagger/index.html


## Tests

Tests generated from Swagger Docs (also runs linter):
```
npm run test-api
```

There are also a couple more test suites for reference.
Jasmine tests:

```
npm test
```

Tape/Supertest tests:
```
npm run test-agent
```

## Run with Docker

```
docker build -t rg .
docker run -p 8888:8888 rg  
```

## Coverage

Create coverage report with Istanbul, send to Coveralls to keep a record.
```
npm run coverage
```

## License

MIT
