import express from 'express';
import fullfiller from '../fullfiller.js';

function parseIntR10(n) {
  return parseInt(n, 10);
}

function objectFilter(obj, predicate) {
  return Object.fromEntries(Object.entries(obj).filter(predicate));
}

function unflattenBreakdownOptions(options) {
  return {
    // filter out flat breakdown options (e.g. wordsPerSentenceMin)
    ...objectFilter(options, ([k]) => !['sentencesPerParagraphMin', 'sentencesPerParagraphMax', 'wordsPerSentenceMin', 'wordsPerSentenceMax'].includes(k)),
    // convert flat breakdown options to objects
    // e.g. wordsPerSentenceMin => wordsPerSentence.min
    //
    sentencesPerParagraph: {
      ...(options.sentencesPerParagraphMin !== undefined ? {
        min: parseIntR10(options.sentencesPerParagraphMin)
      } : {}),
      ...(options.sentencesPerParagraphMax !== undefined ? {
        max: parseIntR10(options.sentencesPerParagraphMax)
      } : {})
    },
    //
    wordsPerSentence: {
      ...(options.wordsPerSentenceMin !== undefined ? {
        min: parseIntR10(options.wordsPerSentenceMin)
      } : {}),
      ...(options.wordsPerSentenceMax !== undefined ? {
        max: parseIntR10(options.wordsPerSentenceMax)
      } : {})
    }
  };
}

// used for requests containing query parameters or x-www-form-urlencoded body
// parameters to be converted: quantity, sentencesPerParagraph and wordsPerSentence
function convertNumericParametersToNumbers(inputs) {
  return Object.fromEntries(Object.entries(inputs).map(([k, v]) => {
    if (k === 'quantity') return [k, parseIntR10(v)];
    if (k === 'sentencesPerParagraph' || k === 'wordsPerSentence') {
      return [k, {
        ...(v.min !== undefined ? {
          min: parseIntR10(v.min)
        } : {}),
        ...(v.max !== undefined ? {
          max: parseIntR10(v.max)
        } : {})
      }];
    }
    return [k, v];
  }));
}

const app = express();

app.use(express.json()); // parse application/json
app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded

app.use(express.static('./site/'));
//
app.get('/', (req, res) => {
  res.sendFile('index.html');
});

// endpoint handles requests of 2 types:
// - requests with query parameters, e.g. `?query=harry potter&format=html`
// - requests with a body containing json or urlencoded data
app.get('/api/', async (
// express.Request<P, ResBody, ReqBody, ReqQuery, Locals extends Record<string, any>>
req, res) => {
  const inputs = Object.keys(req.query).length !== 0 ? req.query : req.body;
  const {
    query,
    ...options
  } =
  // unlike json, query parameters and x-www-form-urlencoded bodies only support strings
  req.is('application/json') === 'json' ? inputs : convertNumericParametersToNumbers(inputs);
  const filler = await fullfiller(query, options);
  res.status(200).json(filler);
});
// endpoint handles requests with route parameters (also known as path)
app.get(
// {0,} = you can leave parameter empty while still being able to declare subsequent parameters
'/api/:query/:unit(\\w{0,})?/:quantity(\\d{0,})?/:format(\\w{0,})?/:sentencesPerParagraphMin(\\d{0,})?/:sentencesPerParagraphMax(\\d{0,})?/:wordsPerSentenceMin(\\d{0,})?/:wordsPerSentenceMax(\\d{0,})?', async (req, res) => {
  const inputs = objectFilter(req.params, ([, v]) => v !== ''); // filter out empty inputs
  const {
    query,
    ...options
  } = {
    ...unflattenBreakdownOptions(inputs),
    ...(inputs.quantity !== undefined ? {
      quantity: parseIntR10(inputs.quantity)
    } : {})
  };
  const filler = await fullfiller(query, options);
  res.status(200).json(filler);
});

// app.get('/api', (req, res) => {
//   console.log('home endpoint');
//   res.status(200).send('home');
// });

// app.get('/api/post/:id', (req, res) => {
//   const { id } = req.params;

//   console.log('post endpoint');
//   res.status(200).send(`post: ${id}`);
// });

const PORT = process.env.PORT || 8080;

app.listen(
  PORT,
  () => console.log(`listening on port ${PORT}`)
);
