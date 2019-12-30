const util = require('util')
const request = util.promisify(require('request')) //npm module for easy http requests, promise version
const _ = require('lodash')
const ResponseError = require('./Error').ResponseError
const express = require('express')
const app = express()
const path = require('path')
const exphbs = require('express-handlebars')

const PORT = process.env.PORT || 3000
const ROOT_DIR = '/public' //root directory for our static pages
const REGEX = /^\/(recipes|index)?(?:\.html)?$/ //route all valid path
const BASE_URL = 'https://www.food2fork.com/api'
const API_KEY = [
  'c043a325cbd65a83c55a08416ec28e87',
  '5e8648501d84d62c45e87fc486e8f655',
  '5b60b4de639dd928b9b2e2611712ccf2'
] //free keys, please don't abuse them
let api_counter = 0

const logError = e => {
  if (!e.stack) {
    console.error(`${e.name}: ${e.message}`)
  } else {
    console.error(e.stack)
  }
  if (!_.isEmpty(e.body)) {
    console.error(e.body)
  }
}

// View Engine setup
const hbs = exphbs.create({
  extname: '.hbs',
  defaultLayout: 'main'
})
app.engine('.hbs', hbs.engine)
app.set('view engine', '.hbs')

// Middleware
app.use(express.json()) //get body payload for post method in express
app.use(express.static(path.join(__dirname, ROOT_DIR))) //provide static server

const getRecipes = (ingredient, req, res) => {
  return request(
    `${BASE_URL}/search?q=${ingredient}&key=${API_KEY[api_counter]}`,
    {
      json: true
    }
  )
    .then((response, body) => {
      if (response.statusCode === 200) {
        if (!_.isObject(body)) {
          throw new ResponseError('Invalid Response body', body)
        }
        // (Food2fork) if a key usage runs out, try another key
        else if (body.error === 'limit') {
          if (api_counter !== API_KEY.length - 1) {
            api_counter += 1
            console.log('trying a new key', API_KEY[api_counter], api_counter)
            getRecipes(ingredient, req, res)
          }
        }
        // handle GET query by browser
        else if (req.method === 'GET') {
          res.render('query', body)
        }
        // handle POST query from 'Go' button
        else if (req.method === 'POST') {
          res.json(body)
        } else {
          throw new ResponseError('Unexpected Response Error', body)
        }
      } else {
        throw new ResponseError(
          `Unexpected response statusCode ${response.statusCode}`
        )
      }
    })
    .catch(error => {
      throw error
    })
}

// Routes
app.get(REGEX, async (req, res) => {
  console.log('req query:', req.query)
  if (req.query.ingredients) {
    try {
      await getRecipes(req.query.ingredients, req, res)
    } catch (e) {
      logError(e)
      res.status(502).end()
    }
  } else {
    res.render('index')
  }
})

// handle user submit from Go button
app.post('/ingredients', async (req, res) => {
  console.log('reqBody', req.body)
  try {
    await getRecipes(req.body.ingredient, req, res)
  } catch (e) {
    logError(e)
    res.status(502).end()
  }
})

/**
 * Error handler
 */
app.use(function(req, res) {
  console.error('Unexpected Internal Error')
  res.status(500).render('500')
})

// Start server
app.listen(PORT, err => {
  if (err) console.log(err)
  console.log(`Server is listening on PORT ${PORT} CTRL-C to quit`)
  console.log(`To Test:`)
  console.log(`http://localhost:3000/recipes.html`)
  console.log(`http://localhost:3000/recipes`)
  console.log(`http://localhost:3000/index.html`)
  console.log(`http://localhost:3000/`)
  console.log(`http://localhost:3000`)
  console.log(`http://localhost:3000/index.html?ingredients=basil`)
  console.log(`http://localhost:3000/?ingredients=basil`)
})
