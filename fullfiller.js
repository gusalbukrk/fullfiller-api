class CustomError extends Error {
  /**
   * Create a `CustomError` (same as `Error` but with an extra property called `library`).
   * @param message Argument to be passed to base constructor (`Error()`).
   * @param library Name of the library in which error will be thrown.
   */
  constructor(message, library) {
    super(message);
    this.library = library;
  }
  toString() {
    return `Error in \`${this.library}\` library:\n\t${this.message}`;
  }
}

/*
  max must be at least `min * 2 - 1`
  otherwise, min & max couldn't be used to break down any number inside range `max to (min * 2)`

  e.g. if min is 7, max can't be anything less than 13
    - range 7 - 12 = couldn't break down 13
    - range 7 - 11 = couldn't break down 12, 13
    - range 7 - 10 = couldn't break down 11, 12, 13
    - so on...
 */
const sentencesPerParagraphDefault = {
  min: 4,
  max: 8
};
//
const wordsPerSentenceDefault = {
  min: 7,
  max: 13
};

// messages aren't inside an object because
// tree-shaking isn't possible when exporting an object
// https://medium.com/@rauschma/note-that-default-exporting-objects-is-usually-an-anti-pattern-if-you-want-to-export-the-cf674423ac38#.nibatprx3
// used at `fullfiller/src/validate`
const invalidInput = 'Expected `input` argument to be one of the valid types (query string, text, words array or frequency map).';
const emptyQueryString = 'Expected non-empty query string at `input` argument.';
const textTooShort = 'Expected given text (in `input.body` argument) to have at least 150 words.';
//
const invalidUnit = "Expected `unit` argument to be 'words' or 'paragraphs'.";
//
const quantityNotNumber = 'Expected `quantity` argument to be a number.';
const quantityTooSmall = wordsMinimum => `Expected \`quantity\` argument to be greater than 1 paragraph / ${wordsMinimum} words.`;
//
const invalidFormat = "Expected `format` argument to be 'plain' or 'html'.";
//
const invalidSentencesPerParagraph = 'Expected `sentencesPerParagraph` argument to be an object (`{ min: number, max: number }`).';
const sentencesPerParagraphMinTooSmall = 'Expected `sentencesPerParagraph.min` argument to be at least 3.';
const sentencesPerParagraphMaxTooSmall = 'Expected `sentencesPerParagraph.max` argument to be at least 3.';
const invalidSentencesPerParagraphMax = 'Expected `sentencesPerParagraph.max` to be at least `sentencesPerParagraph.min * 2 - 1`.';
//
const invalidWordsPerSentence = 'Expected `wordsPerSentence` argument to be an object (`{ min: number, max: number }`).';
const wordsPerSentenceMinTooSmall = 'Expected `wordsPerSentence.min` argument to be at least 3.';
const wordsPerSentenceMaxTooSmall = 'Expected `wordsPerSentence.max` argument to be at least 3.';
const invalidWordsPerSentenceMax = 'Expected `wordsPerSentence.max` to be at least `wordsPerSentence.min * 2 - 1`.';
const articleNotFound = 'Wikipedia does not have an article with this exact title. Try again using a different query.';
const articleIsDisambiguation = suggestions => `This query points to a Wikipedia disambiguation page. You've got to be more specific.${suggestions.length > 0 ? ` Query suggestions:\n- ${suggestions.splice(0, 10).join('\n- ')}.` : ` No query suggestions were found.`}`;
const notEnoughWordsInWordsArray = (minimum, received) => `Given \`text\` doesn't have enough keywords to construct \`wordsArray\` containing the minimum quantity of words required. Minimum number of words required: ${minimum}. Number of words received: ${received}.`;
const notEnoughWordsInFreqMap = (minimum, received) => `Given \`wordsArray\` doesn't have enough words to construct \`freqMap\` containing the minimum quantity of words required. Minimum number of words required: ${minimum}. Number of words received: ${received}.`;

/**
 * Every freqMap's word in `wordsToEmphasize` will have their weight multiplied by `emphasizeBy`.
 */
function emphasize(freqMapWordAsKey, wordsToEmphasize, emphasizeBy) {
  return wordsToEmphasize.reduce((freqMap, word) => freqMap[word] === undefined ? freqMap : {
    ...freqMap,
    [word]: Math.round(freqMap[word] * emphasizeBy)
  }, freqMapWordAsKey);
}

/** **freqMapWeightAsKey** example: `{ 1: ['foo', 'bar'], 3: ['baz'] }` */
function generateFreqMapWeightAsKey(freqMapWordAsKey) {
  return Object.keys(freqMapWordAsKey).reduce((freqMap, word) => {
    const weight = freqMapWordAsKey[word];
    return {
      ...freqMap,
      [weight]: (freqMap[weight] || []).concat(word)
    };
  }, {});
}

/** **freqMapWordAsKey** example: `{ foo: 1, bar: 3 }` */
function generateFreqMapWordAsKey(wordsArray) {
  return wordsArray.reduce((freqMap, word) => ({
    ...freqMap,
    // using hasOwnProperty instead of check if undefined, otherwise
    // if `word` is a built-in object property (e.g. `constructor`)
    // would append 1 to this property (which would results in `NaN`)
    // instead of creating a new property
    [word]: Object.prototype.hasOwnProperty.call(freqMap, word) ? freqMap[word] + 1 : 1
  }), {});
}

function getFreqMapWordsQuantity(freqMap) {
  const wordsQuantity = Object.values(freqMap).reduce((acc, cur) => acc + cur.length, 0);
  return wordsQuantity;
}

/** If required by `options`, reduce the quantity of tiers in `freqMap`. */
function shortenFreqMap(freqMap, tierWeightMin, tierWeightMax, mergePosteriorTiersAt) {
  return Object.entries(freqMap).reduce((shortened, entry) => {
    const weight = Number(entry[0]);
    const tier = entry[1];
    // if current weight is less than min or more than max, filter out current tier
    if (weight < tierWeightMin || tierWeightMax !== -1 &&
    // -1 would indicate that `tierWeightMax` functionality is disabled
    weight > tierWeightMax) {
      return shortened;
    }
    // if current weight is more than mergePosteriorTiersAt
    // merge current tier into mergePosteriorTiersAt tier
    if (mergePosteriorTiersAt !== -1 &&
    // -1 would indicate that `mergePosteriorTiersAt` functionality is disabled
    weight > mergePosteriorTiersAt) {
      return {
        ...shortened,
        [mergePosteriorTiersAt]: (shortened[mergePosteriorTiersAt] || []).concat(freqMap[weight])
      };
    }
    return {
      ...shortened,
      [weight]: tier
    };
  }, {});
}

const optionsDefault$1 = {
  emphasizeBy: 2,
  wordsQuantityMin: 0,
  tierWeightMin: 1,
  tierWeightMax: -1,
  mergePosteriorTiersAt: -1 // disable option
};
/**
 * Generate `freqMap` from `wordsArray`.
 * @param wordsArray
 * @param wordsToEmphasize Subset of `wordsArray` to emphasize.
 * @param optionsArg Miscellaneous options. See more at {@link optionsType}.
 * @throws Error if `freqMap` has less words than expected.
 * @returns freqMap.
 */
function generateFreqMap(wordsArray, wordsToEmphasize, optionsArg) {
  const options = {
    ...optionsDefault$1,
    ...optionsArg
  };
  const freqMapWordAsKey = emphasize(generateFreqMapWordAsKey(wordsArray), wordsToEmphasize || [], options.emphasizeBy);
  const freqMap = shortenFreqMap(generateFreqMapWeightAsKey(freqMapWordAsKey), options.tierWeightMin, options.tierWeightMax, options.mergePosteriorTiersAt);
  const freqMapWordsQuantity = getFreqMapWordsQuantity(freqMap);
  if (freqMapWordsQuantity < options.wordsQuantityMin) {
    throw new CustomError(notEnoughWordsInFreqMap(options.wordsQuantityMin, freqMapWordsQuantity), 'generate-words-freqmap');
  }
  return freqMap;
}

/**
 * Summary is the initial chunk of text, everything before the first subtitle.
 * It's possible to get it with API `&action=query&prop=extracts&exintro`.
 * But the entire article was fetched already, so there's no need to make another API call.
 *
 * @summary Extract summary from article body.
 * @param body Wikipedia article body.
 * @param format Article format.
 * @returns Wikipedia article summary.
 */
function extractSummaryFromBody(body, format) {
  const plaintextRE = /^[\s\S]*?(?=\n\n\n==)/;
  const htmlRE = /^[\s\S]*?(?=\n\n<h2>)/;
  const RE = format === 'plain' ? plaintextRE : htmlRE;
  const summary = RE.exec(body)?.[0];
  return summary;
}

/**
 * Join Wikipedia API base URL and `queries`.
 * @param queries Object to be converted to query string.
 * @returns URL to make API call.
 */
function generateRequestURL(queries) {
  const baseAPI = `https://en.wikipedia.org/w/api.php?&format=json&origin=*&`;
  const queryString = Object.entries(queries).map(([key, value]) => value === undefined ? key : `${key}=${value.toString()}`).join('&');
  const requestURL = baseAPI + queryString;
  return requestURL;
}
/**
 * @summary Fetch response from Wikipedia API.
 * @param queries Object containing query string parameters.
 * @returns Object containing json.query.pages[pageID] and json.continue (if it exists) contents.
 */
async function fetchResource(queries) {
  const url = generateRequestURL(queries);
  const json = await (await fetch(url)).json();
  // API's response isn't returned in its entirety by this function.
  // That's because the main part of the response is nested 3 layers deep.
  // As shown in the `response` interface.
  const {
    pages
  } = json.query;
  const pagesID = Object.keys(pages)[0];
  const resp = {
    ...pages[pagesID],
    // some resources responses (e.g. links) include `continue` when there's more to fetch
    ...(json.continue && json.continue)
  };
  return resp;
}

/**
 * Fetch Wikipedia article body.
 * @param title Wikipedia article title.
 * @param format Which one of the 2 formats available in the Wikipedia API.
 * @param related Wikipedia related articles titles (to recommend in case of error).
 * @returns Wikipedia article body.
 */
async function getArticleBody(title, format) {
  const queries = {
    action: 'query',
    prop: 'extracts',
    ...(format === 'plain' && {
      explaintext: undefined
    }),
    redirects: undefined,
    titles: encodeURIComponent(title)
  };
  const resp = await fetchResource(queries);
  const body = resp.extract;
  return body;
}

/**
 * Fetch all Wikipedia categories the given article belongs to.
 * @param title Wikipedia article title.
 * @returns Array of Wikipedia categories names.
 */
async function getArticleCategories(title) {
  const queries = {
    action: 'query',
    prop: 'categories',
    redirects: undefined,
    cllimit: 'max',
    clshow: '!hidden',
    titles: encodeURIComponent(title)
  };
  // There's no reason to use a recursive function like in getArticleLinks,
  // even the articles containing the most categories don't have more than 500 categories
  // (https://en.wikipedia.org/wiki/Special:MostCategories);
  // request below will fetch at most 500 normal (not hidden) categories
  const resp = await fetchResource(queries);
  const categories = resp.categories.map(obj => obj.title.replace(/^Category:/, ''));
  return categories;
}

async function getLinksRecursively(queries) {
  const resp = await fetchResource(queries);
  const links = resp.links.map(obj => obj.title);
  return !('plcontinue' in resp) ? links : links.concat(await getLinksRecursively({
    ...queries,
    plcontinue: encodeURIComponent(resp.plcontinue)
  }));
}
/**
 * Fetch all Wikipedia articles that are linked in the given article.
 * @param title Wikipedia article title.
 * @returns Array of Wikipedia articles titles.
 */
async function getArticleLinks(title) {
  const queries = {
    action: 'query',
    prop: 'links',
    redirects: undefined,
    pllimit: 'max',
    plnamespace: '0',
    titles: encodeURIComponent(title)
  };
  const links = await getLinksRecursively(queries);
  return links;
}

/**
 * Fetch Wikipedia article summary.
 * @param title Wikipedia article title.
 * @param format Which one of the 2 formats available in the Wikipedia API.
 * @param related Wikipedia related articles titles (to recommend in case of error).
 * @returns Wikipedia article body.
 */
async function getArticleSummary(title, format) {
  const queries = {
    action: 'query',
    prop: 'extracts',
    exintro: undefined,
    redirects: undefined,
    ...(format === 'plain' && {
      explaintext: undefined
    }),
    titles: encodeURIComponent(title)
  };
  const resp = await fetchResource(queries);
  const summary = resp.extract;
  return summary;
}

/**
 * Fetch Wikipedia article terms.
 * @param title Wikipedia article title.
 * @param include Which terms to fetch (alias, description and/or label).
 * @returns Array of Wikipedia article terms.
 */
async function getArticleTerms(title, include) {
  const queries = {
    action: 'query',
    prop: 'pageterms',
    redirects: undefined,
    wbptlanguage: 'en',
    wbptterms: include.join('|'),
    titles: encodeURIComponent(title)
  };
  const resp = await fetchResource(queries);
  const {
    terms
  } = resp;
  // if (include.length !== Object.keys(terms).length) {
  //   const print = (array: string[]) => array.sort().join(', ');
  //   console.warn(
  //     `Article lacks some of the terms requested. Requested: ${print(
  //       include
  //     )}. Fetched: ${print(Object.keys(terms))}.`
  //   );
  // }
  return terms;
}

/**
 * Fetch Wikipedia article(s) title(s) that match query.
 * @param query Search string.
 * @param single Fetch only a single result.
 * @throws Error if no results were found.
 * @returns Array of title(s).
 */
async function getMatchingArticlesTitles(query, single = false) {
  const requestURL = generateRequestURL({
    action: 'opensearch',
    limit: single ? 1 : 'max',
    // `redirects=resolve` is required otherwise response may contain the name of a redirect
    // instead of the target page; page and redirect have slight different titles
    // e.g. query `lord of the rings` would return `Lord of the rings`
    // which is the redirect for `The Lord of the Rings`
    redirects: 'resolve',
    search: encodeURIComponent(query)
  });
  const resp = await fetch(requestURL);
  const json = await resp.json();
  const titles = json[1];
  if (titles.length === 0) throw new CustomError(articleNotFound, 'get-wikipedia-article');
  return titles;
}

async function queryPointsToADisambiguationPage(title) {
  const queries = {
    action: 'query',
    prop: 'pageprops',
    ppprop: 'disambiguation',
    redirects: undefined,
    titles: encodeURIComponent(title)
  };
  const resp = await fetchResource(queries);
  const pointsToDisambiguation = resp.pageprops?.disambiguation !== undefined;
  return pointsToDisambiguation;
}

const includeDefault = ['title', 'body'];
/**
 * Fetch Wikipedia article's resources (e.g. title, body, links...).
 * @param query Search string.
 * @param include Which resources to include in the return object.
 * @param options
 * @throws Error if `query` doesn't return any results.
 * @throws Error if `article.title` points to a disambiguation page.
 * @returns Object containing requested resources.
 */
async function getWikipediaArticle(query, include = includeDefault, {
  format = 'plain'
} = {}) {
  if (include.length === 0) include.push(...includeDefault);
  const article = {};
  // fetch title, related
  if (include.includes('title') && include.includes('related')) {
    // first result will be selected as the article to be fetched
    const [title, ...related] = await getMatchingArticlesTitles(query);
    article.title = title;
    article.related = related;
  } else if (include.includes('title')) {
    const [title] = await getMatchingArticlesTitles(query);
    article.title = title;
  } else if (include.includes('related')) {
    const [, ...related] = await getMatchingArticlesTitles(query);
    article.related = related;
  }
  // API calls to `action=query` using `query` instead of `article.title`
  // are allowed because `redirects` parameter is being used
  const titleQuery = article.title || query;
  // the only option other than to make a separate request at main function checking if page is
  // disambiguation, would be to check if page is disambiguation at every resource request
  if (await queryPointsToADisambiguationPage(titleQuery)) {
    throw new CustomError(articleIsDisambiguation(article.related || [] /* suggestions */), 'get-wikipedia-article');
  }
  // fetch body
  if (include.includes('body')) {
    article.body = await getArticleBody(titleQuery, format);
  }
  // fetch summary
  if (include.includes('summary')) {
    article.summary = article.body ? extractSummaryFromBody(article.body, format) : await getArticleSummary(titleQuery, format);
  }
  // fetch categories
  if (include.includes('categories')) {
    article.categories = await getArticleCategories(titleQuery);
  }
  // fetch links
  if (include.includes('links')) {
    article.links = await getArticleLinks(titleQuery);
  }
  // fetch terms
  const termsToInclude = ['alias', 'label', 'description'].filter(term => include.includes(term));
  if (termsToInclude.length > 0) {
    const terms = await getArticleTerms(titleQuery, termsToInclude);
    Object.keys(terms).forEach(term => {
      article[term] = terms[term];
    });
  }
  return article;
}

function last(arr) {
  return arr[arr.length - 1];
}
function capitalize(word) {
  return word[0].toUpperCase() + word.substring(1);
}
function isLowercase(str) {
  return str === str.toLowerCase();
}
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
function getRandomArrayElement(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}
function isNumeric(word) {
  return /^[\d.,:%$]+$/.test(word) && /\d/.test(word);
}
function escapeRegExp(regexpString) {
  return regexpString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Apply `functions` to `input` left to right.
 * @param input
 * @param functions Array of functions.
 *  Function only argument and return value must be of the same type as `input`.
 * @returns Value of the same type as `input`.
 */
function reduce(input, functions) {
  return functions.reduce((acc, fn) => fn(acc), input);
}
/** Check if argument is an object. */
function isObject(input) {
  return Object.prototype.toString.call(input) === '[object Object]';
}

const escapeAndMakeDotOptional = str => escapeRegExp(str).replace('\\.', '\\.?');
/* eslint-disable import/prefer-default-export */
/**
 * Convert to lowercase if both are true:
 * - text contain word in lowercase
 * - all capitalized occurrences are preceded by dot or string beginning
 */
function getCorrectWordCase(wordCapitalized, text) {
  // check if the first argument really starts with uppercase letter; anything else
  // (e.g.: lowercase letter, number, dot...) won't need to go through this function
  if (!/[A-Z]/.test(wordCapitalized[0])) return wordCapitalized;
  const capitalizedRE = new RegExp(`[^.\\s]\\s+${escapeAndMakeDotOptional(wordCapitalized)}(\\s|\\.|$)`);
  const textHasCapitalizedWordNotPrecededByDotOrStringBeginning = capitalizedRE.test(text);
  const wordLowercase = wordCapitalized.toLowerCase();
  const lowercaseRE = new RegExp(`(^|\\s|\\.)${escapeAndMakeDotOptional(wordLowercase)}(\\s|\\.|$)`);
  const textContainLowercaseWord = lowercaseRE.test(text);
  const correctCase = textContainLowercaseWord && !textHasCapitalizedWordNotPrecededByDotOrStringBeginning ? wordLowercase : wordCapitalized;
  return correctCase;
}
/* eslint-enable import/prefer-default-export */

/**
 * Preserve capitalization in words preceded by dot or convert to lowercase.
 */
function handleCapitalizedLetterPrecededByDotOrStringBeginning(text) {
  return text.replace(/(?:^|\.\s+)([A-Z]\S*)/g,
  // capitalizedLetterPrecededByDotOrStringBeginning
  (match, wordAfterDot, _, whole) => /^[A-Z]+$/.test(wordAfterDot) ? match // if word is acronym (all uppercase), leave as it is
  : match.replace(wordAfterDot, getCorrectWordCase(wordAfterDot, whole)));
}

function getRangeRespectiveFreqMapWeight(range, weights, ranges) {
  const index = ranges.findIndex(r => r >= range);
  const weight = weights[index];
  return weight;
}
/** Using weighted randomness, select one of the freqMap's tier. */
function getFreqMapRandomTier(freqMap, weights, ranges) {
  const range = getRandomNumber(1, last(ranges));
  const weight = getRangeRespectiveFreqMapWeight(range, weights, ranges);
  const tier = freqMap[weight];
  return tier;
}

/** e.g.: `{ 1: [...], 2: [...], 3: [...] }` => `[ [1, 2, 3], [1, 3, 6] ]` */
function getWeightsAndRangesFromFreqMap(freqMap) {
  // ES2015 own property order
  // while traversing objects, integer keys are returned first and in ascending order
  // https://2ality.com/2015/10/property-traversal-order-es6.html
  const weights = Object.keys(freqMap).map(weight => Number(weight));
  const ranges = weights.reduce((acc, weight) => acc.concat((last(acc) || 0) + weight), []);
  return [weights, ranges];
}

/** Generate a weighted random function from `freqMap`. */
function weightedRandomness(freqMap) {
  const [weights, ranges] = getWeightsAndRangesFromFreqMap(freqMap);
  const getRandomFreqMapValue = () => getRandomArrayElement(getFreqMapRandomTier(freqMap, weights, ranges));
  return getRandomFreqMapValue;
}

var mostCommonStopwordsFreqMap = {"1":["with","that","for","are","this","be","by","from","or","how","about","was","what","when","where","who","will"],"2":["a","an","in","at","is","it","but","on","to","as"],"4":["the","of","and"]};

var stopwords = ["a","able","about","above","according","accordingly","across","actually","after","afterwards","again","against","ain't","all","allow","allows","almost","alone","along","already","also","although","always","am","among","amongst","an","and","another","any","anybody","anyhow","anyone","anything","anyway","anyways","anywhere","apart","appear","appreciate","appropriate","are","aren't","around","as","aside","ask","asking","associated","at","available","away","awfully","be","became","because","become","becomes","becoming","been","before","beforehand","behind","being","believe","below","beside","besides","best","better","between","beyond","both","brief","but","by","came","can","can't","cannot","cant","cause","causes","certain","certainly","changes","clearly","come","comes","concerning","consequently","consider","considering","contain","containing","contains","corresponding","could","couldn't","course","currently","definitely","described","despite","did","didn't","different","do","does","doesn't","doing","don't","done","down","downwards","during","each","e.g.","eg","eight","either","else","elsewhere","enough","entirely","especially","etc","even","ever","every","everybody","everyone","everything","everywhere","ex","exactly","example","except","far","few","fifth","first","five","followed","following","follows","for","former","formerly","forth","four","from","further","furthermore","get","gets","getting","given","gives","go","goes","going","gone","got","gotten","greetings","had","hadn't","happens","hardly","has","hasn't","have","haven't","having","he","he's","hello","help","hence","her","here","here's","hereafter","hereby","herein","hereupon","hers","herself","hi","him","himself","his","hither","hopefully","how","however","i","i'd","i'll","i'm","i've","i.e.","ie","if","ignored","immediate","in","indeed","indicate","indicated","indicates","inner","insofar","instead","into","inward","is","isn't","it","it'd","it'll","it's","its","itself","just","keep","keeps","kept","know","known","knows","last","lately","later","latter","latterly","least","less","lest","let","let's","like","liked","likely","little","look","looking","looks","ltd","mainly","many","may","maybe","me","mean","meanwhile","merely","might","more","moreover","most","mostly","much","must","my","myself","name","namely","near","nearly","necessary","need","needs","neither","never","nevertheless","new","next","nine","no","nobody","non","none","nor","normally","not","nothing","novel","now","nowhere","obviously","of","off","often","oh","ok","okay","old","on","once","one","ones","only","onto","or","other","others","otherwise","ought","our","ours","ourselves","out","outside","over","overall","own","particular","particularly","per","perhaps","placed","please","plus","possible","presumably","probably","provides","quite","rather","rd","really","reasonably","regarding","regardless","regards","relatively","respectively","right","said","same","saw","say","saying","says","second","secondly","see","seeing","seem","seemed","seeming","seems","seen","self","selves","sensible","sent","serious","seriously","seven","several","shall","she","should","shouldn't","since","six","so","some","somebody","somehow","someone","something","sometime","sometimes","somewhat","somewhere","soon","sorry","specified","specify","specifying","still","sub","such","sure","take","taken","tell","tends","th","than","thank","thanks","that","that's","thats","the","their","theirs","them","themselves","then","thence","there","there's","thereafter","thereby","therefore","therein","theres","thereupon","these","they","they'd","they'll","they're","they've","think","third","this","thorough","thoroughly","those","though","three","through","throughout","thru","thus","to","together","too","took","toward","towards","tried","tries","truly","try","trying","twice","two","under","unfortunately","unless","unlikely","until","unto","up","upon","us","use","used","useful","uses","using","usually","value","various","very","via","vs","want","wants","was","wasn't","way","we","we'd","we'll","we're","we've","welcome","well","went","were","weren't","what","what's","whatever","when","whence","whenever","where","where's","whereafter","whereas","whereby","wherein","whereupon","wherever","whether","which","while","whither","who","who's","whoever","whole","whom","whose","why","will","willing","wish","with","within","without","won't","wonder","would","wouldn't","yes","yet","you","you'd","you'll","you're","you've","your","yours","yourself","yourselves","zero"];

function isStopword(word) {
  return stopwords.includes(word.toLowerCase());
}
const getRandomStopword = weightedRandomness(mostCommonStopwordsFreqMap);

/**
 * Preserve dot if word containing leading dot occurs more than once.
 */
function handleLeadingDot(wordContainingLeadingDot, text) {
  const wordWithoutDot = wordContainingLeadingDot.substring(1);
  if (isStopword(wordWithoutDot)) return '';
  const doesTextContainsMultipleOccurrences = (text.match(new RegExp(`(^|\\W)${escapeRegExp(wordContainingLeadingDot)}(?=(\\W|$))`, 'g')) || []).length > 1;
  const correctWordForm = doesTextContainsMultipleOccurrences ? wordContainingLeadingDot : getCorrectWordCase(wordWithoutDot, text);
  return correctWordForm;
}

function shouldPreserveTrailingDot(wordContainingTrailingDot, text) {
  const wordWithoutDot = wordContainingTrailingDot.replace(/\.$/, '');
  const wordWithDotNumberOfOccurrences = (text.match(new RegExp(`(^|\\s)${escapeRegExp(wordContainingTrailingDot)}(?=\\s|$)`, 'g')) || []).length;
  if (wordWithDotNumberOfOccurrences === 1) return false;
  const wordWithoutDotNumberOfOccurrences = (text.match(new RegExp(`(^|\\s)${escapeRegExp(wordWithoutDot)}(?=\\s|$)`, 'g')) || []).length;
  return wordWithDotNumberOfOccurrences > wordWithoutDotNumberOfOccurrences;
}
/**
 * Preserve dot if word containing trailing dot happens more
 * than once and more often than word without trailing dot.
 */
function handleTrailingDot(wordContainingTrailingDot, text) {
  const wordWithoutDot = wordContainingTrailingDot.slice(0, -1);
  if (isStopword(wordWithoutDot)) return '';
  const preserveTrailingDot = shouldPreserveTrailingDot(wordContainingTrailingDot, text);
  const handled = preserveTrailingDot ? wordContainingTrailingDot : wordWithoutDot;
  return handled;
}

/**
 * Handles something like 'word.Word', which is very common in Wikipedia API's response.
 * This occurs when a paragraph ends with a citation (i.e. superscript number in brackets).
 *
 * @summary Replace dot with space and fix the case of the word after dot.
 */
function replaceMiddleDotWithSpace(match, text) {
  const [, wordBeforeDot, wordAfterDot] = /^(.+)\.(.+)$/.exec(match);
  const isWordBeforeDotStopword = isStopword(wordBeforeDot);
  const isWordAfterDotStopword = isStopword(wordAfterDot);
  if (isWordBeforeDotStopword && isWordAfterDotStopword) return '';
  if (isWordBeforeDotStopword) return getCorrectWordCase(wordAfterDot, text);
  if (isWordAfterDotStopword) return wordBeforeDot;
  // if neither is stopword
  return `${wordBeforeDot} ${getCorrectWordCase(wordAfterDot, text)}`;
}

function replacer(wordContainingDot, offset, whole) {
  if (/^[.]+$/.test(wordContainingDot)) return '';
  // string containing only numeric values
  if (isNumeric(wordContainingDot)) {
    return wordContainingDot.replace(/\.$/, ''); // preserve dot(s), except trailing
  }
  // preserve or remove leading/trailing dot
  if (/^\.|\.$/.test(wordContainingDot) && wordContainingDot.match(/\./g)?.length === 1) {
    return wordContainingDot.startsWith('.') ? handleLeadingDot(wordContainingDot, whole) : handleTrailingDot(wordContainingDot, whole);
  }
  // fix something like `word.Word`
  if (/[a-z0-9]\.[A-Z0-9]/.test(wordContainingDot) && wordContainingDot.match(/\./g)?.length === 1) {
    return replaceMiddleDotWithSpace(wordContainingDot, whole);
  }
  // else, preserve dot in:
  // - words with multiple dots
  //   - including abbreviations like X.X.X and x.x.
  // - words with dot in the middle that aren't matched previously
  //   - letter before dot is uppercase &/or letter after dot is lowercase
  return wordContainingDot;
}
function preserveRemoveOrReplaceDot(text) {
  return text.replace(/\S*\.\S*/g,
  // word containing dot(s) at any position
  replacer);
}

function preserveCommaOrColonIfSurroundedByNumbers(_, before, commaOrColon, after) {
  const isCommaOrColonSurroundedByNumbers = [before, after].every(char => /^\d$/.test(char));
  const preserved = before + commaOrColon;
  const removed = `${before} `;
  return isCommaOrColonSurroundedByNumbers ? preserved : removed;
}
function removeUselessStuff(string) {
  const removed = string
  // remove useless punctuation
  // `.?!,:;-–—<>[]{}()'"…` = 15 punctuations signs in english
  // em dash/en dash and opening/closing are counted as the same
  // only hyphen & apostrophe will be always preserved
  // single dot will be handled at `preserveRemoveOrReplaceDot` function
  .replace(/["()[\]{}<>–—;?!]+/g, ' ').replace(/(^|.)(,|:)(?=(.|$))/g, preserveCommaOrColonIfSurroundedByNumbers).replace(/\.{2,}|…/g, ' ')
  // remove line breaks
  .replace(/\n+/g, ' ')
  // remove stopwords
  .replace(/\S+/g, match => isStopword(match) ? '' : match)
  // remove space between initials
  .replace(/(^|\s)([A-Z]\.(\s|$)){2,}/g, initials => ` ${initials.replace(/\s/g, '')} `);
  return removed;
}

/** Remove words that doesn't contain at least one alphanumeric character. */
function removeWordsNotContainingAlphanumericChar(text) {
  return text.replace(/(^|\s)[^\s\w]+(?=(\s|$))/g, '');
}

function normalizeText(text) {
  const normalized = reduce(text, [removeUselessStuff, handleCapitalizedLetterPrecededByDotOrStringBeginning, preserveRemoveOrReplaceDot, removeWordsNotContainingAlphanumericChar]);
  return normalized;
}

const optionsDefault = {
  lengthMin: 0 // don't error even if return array is empty
};
/**
 * Break down text string into array of words.
 * @param text
 * @param optionsArg Miscellaneous options. See more at {@link optionsType}.
 * @throws Error if `wordsArray` length is less than `options.lengthMin`.
 * @returns Array of words.
 */
function tokenizeWords(text, optionsArg) {
  const options = {
    ...optionsDefault,
    ...optionsArg
  };
  const wordsArray = normalizeText(text).match(/\S+/g) || [];
  const wordsArrayLength = wordsArray.length;
  if (wordsArrayLength < options.lengthMin) {
    throw new CustomError(notEnoughWordsInWordsArray(options.lengthMin, wordsArrayLength), 'tokenize-words');
  }
  return wordsArray;
}

function breakNumberIntoChunks(number, chunkValueMin, chunkValueMax,
// at first glace it may seem as if this function doesn't need its last 2 parameters
// fourth parameter could be calculated with `Math.ceil(firstArgument / thirdArgument)`
// fifth parameter could be calculated with `Math.floor(firstArgument / secondArgument)`
// while this would work when computing how many paragraphs the distribution will have
// it wouldn't work when computing how many sentences a paragraph will have, that's because
// quant of sentences must adhere to main function's `sentencesPerParagraph.{min|max}`
distributionLengthMin, distributionLengthMax) {
  const distributionLength = getRandomNumber(distributionLengthMin, distributionLengthMax);
  return Array.from({
    length: distributionLength
  }).reduce(distribution => {
    const sum = distribution.reduce((acc, cur) => acc + cur, 0);
    const rest = number - sum;
    const howManyChunksRemaining = distributionLength - distribution.length;
    if (rest === 0) return distribution;
    if (rest <= chunkValueMax && howManyChunksRemaining === 1) {
      return [...distribution, rest];
    }
    const nextMax = Math.min((howManyChunksRemaining - 1) * chunkValueMax, rest);
    const min = Math.max(rest - nextMax,
    // it's always going to be between 0 and chunkValueMax
    chunkValueMin);
    const max = Math.min(rest - (howManyChunksRemaining - 1) * chunkValueMin, chunkValueMax);
    return [...distribution, getRandomNumber(min, max)];
  }, []);
}

/**
 *
 * @param quantity Number of specified unit. See more at {@link unitType}.
 * @param unit
 * @param sentencesPerParagraph Contains 2 properties: min & max
 * @param wordsPerSentence Contains 2 properties: min & max
 * @returns Each nested number array is a paragraph, each number is a sentence.
 */
function distribute(quantity, unit, sentencesPerParagraph, wordsPerSentence) {
  const wordsPerParagraphMin = sentencesPerParagraph.min * wordsPerSentence.min;
  const wordsPerParagraphMax = sentencesPerParagraph.max * wordsPerSentence.max;
  // array of numbers
  // each number represents a paragraph (paragraph's quantity of words = number)
  const paragraphsDistribution = unit === 'paragraphs' ? Array.from({
    length: quantity
  }).map(() => getRandomNumber(wordsPerParagraphMin, wordsPerParagraphMax)) : breakNumberIntoChunks(quantity, wordsPerParagraphMin, wordsPerParagraphMax, Math.ceil(quantity / wordsPerParagraphMax),
  // paragraphsQuantityMin
  Math.floor(quantity / wordsPerParagraphMin) // paragraphsQuantityMax
  );
  // array containing arrays of numbers
  // each number represents a sentence (sentence's quantity of words = number)
  const sentencesDistribution = paragraphsDistribution.map(wordsPerParagraph => breakNumberIntoChunks(wordsPerParagraph, wordsPerSentence.min, wordsPerSentence.max, Math.max(Math.ceil(wordsPerParagraph / wordsPerSentence.max), sentencesPerParagraph.min),
  // sentencesQuantityMin
  Math.min(Math.floor(wordsPerParagraph / wordsPerSentence.min), sentencesPerParagraph.max) // sentencesQuantityMax
  ));

  return sentencesDistribution;
}

function capitalizeSentence(sentenceArray) {
  return [capitalize(sentenceArray[0]), ...sentenceArray.slice(1)];
}
function getRandomPunctuation(location) {
  const freqMap = location === 'end' ? {
    1: ['...'],
    3: ['!', '?'],
    16: ['.']
  } : {
    1: ['[]'],
    2: [';', ':'],
    4: ['""', '()', '—  —'],
    8: [',']
  }; // mid punctuation will be enclosing (quotes, parentheses, brackets, em dash) 1/3 of the time
  const punctuation = weightedRandomness(freqMap)();
  return punctuation;
}
function addEndSentencePunctuation(arr) {
  const sentenceArray = [...arr];
  if (!last(sentenceArray).endsWith('.')) {
    sentenceArray[sentenceArray.length - 1] += getRandomPunctuation('end');
  }
  return sentenceArray;
}
function addMidSentencePunctuation(arr) {
  const sentenceArray = [...arr];
  if (sentenceArray.length > 8 && Math.random() < 0.8) {
    // punctuation will be placed at a minimum the fourth word
    // and at a maximum at the fourth to last word
    const subarray = sentenceArray.slice(3, sentenceArray.length - 3);
    const randomPunctuation = getRandomPunctuation('mid');
    if (/,|:|;/.test(randomPunctuation)) {
      //  simple punctuation won't be placed between stopwords or numbers
      const filtered = subarray.filter(word => {
        const nextWord = sentenceArray[sentenceArray.indexOf(word) + 1];
        return [word, nextWord].every(w => !isStopword(w) && !isNumeric(w));
      });
      if (filtered.length > 0) {
        const randomWord = getRandomArrayElement(filtered);
        sentenceArray[sentenceArray.indexOf(randomWord)] += randomPunctuation;
      }
    } else {
      // enclosing punctuation won't be placed between stopwords
      const punctuationStartIndex = sentenceArray.indexOf(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      subarray.find(word => {
        const previousWord = sentenceArray[sentenceArray.indexOf(word) - 1];
        return !isStopword(previousWord) && !isStopword(word);
      }));
      const punctuationEndIndex = punctuationStartIndex === -1 ? -1 : sentenceArray.indexOf(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      [...subarray].slice(subarray.indexOf(sentenceArray[punctuationStartIndex])).reverse().find(word => {
        const nextWord = sentenceArray[sentenceArray.indexOf(word) + 1];
        return !isStopword(word) && !isStopword(nextWord);
      }));
      if (punctuationStartIndex !== -1 && punctuationEndIndex !== -1) {
        const [, openingPunctuation, closingPunctuation] = /(\(|\[|"|—\s)(\)|]|"|\s—)/.exec(randomPunctuation) || [];
        sentenceArray[punctuationStartIndex] = `${openingPunctuation}${sentenceArray[punctuationStartIndex]}`;
        sentenceArray[punctuationEndIndex] += closingPunctuation;
      }
    }
  }
  return sentenceArray;
}
function capitalizeAndPunctuateSentence(arr) {
  const sentenceArray = [...arr];
  return capitalizeSentence(addEndSentencePunctuation(addMidSentencePunctuation(sentenceArray)));
}

function isWordPlacementInvalid(randomWord, sentence, sentenceIntendedLength) {
  return sentence.includes(randomWord) || (
  // don't include multiple instances of the same word with different casing
  isLowercase(randomWord[0]) ? sentence.includes(capitalize(randomWord)) : sentence.includes(randomWord.toLowerCase())) ||
  // don't start or end sentence with number, nor have more than one number per sentence
  isNumeric(randomWord) && (sentence.length === 0 || sentence.length === sentenceIntendedLength - 1 || sentence.some(word => isNumeric(word)));
}
function getRandomWord(sentence, sentenceIntendedLength, getRandomArticleWord) {
  let randomWord;
  do {
    if (
    // last word in sentence must not be stopword
    sentence.length === sentenceIntendedLength - 1 ||
    // doesn't allow more than 2 subsequent stopwords
    sentence.length >= 2 && sentence.slice(-2).every(word => isStopword(word))) {
      randomWord = getRandomArticleWord();
    } else if (
    // doesn't allow more than 3 subsequent non-stopwords
    sentence.length >= 3 && sentence.slice(-3).every(word => !isStopword(word)) ||
    // the 3 words before last word in sentence mustn't be all non-stopwords
    // because last word must be a stopword
    sentenceIntendedLength - sentence.length === 2 && sentence.slice(-2).every(word => !isStopword(word))) {
      randomWord = getRandomStopword();
    } else {
      randomWord = Math.random() < 0.666 ? getRandomArticleWord() : getRandomStopword();
    }
  } while (isWordPlacementInvalid(randomWord, sentence, sentenceIntendedLength));
  return randomWord;
}

function generateTextArray(
// TODO: rename function
freqMap, distribution) {
  const getRandomArticleWord = weightedRandomness(freqMap);
  const textArray = distribution.map(paragraphBreakdown => paragraphBreakdown.map(sentenceIntendedLength => capitalizeAndPunctuateSentence(Array.from({
    length: sentenceIntendedLength
  }).reduce(sentence => sentence.concat(getRandomWord(sentence, sentenceIntendedLength, getRandomArticleWord)), []))));
  return textArray;
}

const stringifyParagraph = paragraph => paragraph.map(sentence => sentence.join(' ')).join(' ');
function stringifyTextArray(textArray, format) {
  const text = textArray.map(paragraph => format === 'plain' ? stringifyParagraph(paragraph) : `<p>${stringifyParagraph(paragraph)}</p>`).join(format === 'plain' ? '\n' : '');
  return text;
}

function validateFormat(format) {
  const errors = [];
  if (!(format === 'plain' || format === 'html')) {
    errors.push(invalidFormat);
  }
  return errors;
}

function isInputQueryString(input) {
  return typeof input === 'string';
}
function isInputText(input) {
  return isObject(input) && Object.keys(input).length === 2 && typeof input.title === 'string' && typeof input.body === 'string';
}
function isInputWordsArray(input) {
  return isObject(input) && Object.keys(input).length === 2 && typeof input.title === 'string' && Array.isArray(input.words) && input.words.every(word => typeof word === 'string');
}
function isInputFreqMap(input) {
  return isObject(input) && Object.keys(input).length === 2 && typeof input.title === 'string' && isObject(input.map) && Object.keys(input.map).every(key => /^\d+$/.test(key)) && Object.values(input.map).every(value => Array.isArray(value) && value.every(el => typeof el === 'string'));
}
function validateInput(input) {
  const errors = [];
  const isQueryString = isInputQueryString(input);
  const isText = isInputText(input);
  const isWordsArray = isInputWordsArray(input);
  const isFreqMap = isInputFreqMap(input);
  if (!(isQueryString || isText || isWordsArray || isFreqMap) // invalid input
  ) {
    errors.push(invalidInput);
  } else {
    // additional errors for specific input types
    if (isQueryString && input === '') {
      errors.push(emptyQueryString);
    }
    if (isText) {
      const wordsQuantityMinRequired = 150;
      const wordsQuantity = input.body.split(' ').length;
      if (wordsQuantity < wordsQuantityMinRequired) {
        errors.push(textTooShort);
      }
    }
  }
  return errors;
}

function getType(value) {
  return Array.isArray(value) ? 'array' : typeof value;
}
function validateQuantity(quantity, unit, sentencesPerParagraph, wordsPerSentence) {
  const errors = [];
  const type = getType(quantity);
  if (type !== 'number' || Number.isNaN(quantity)) {
    errors.push(quantityNotNumber);
  }
  // if (type === 'number' && (unit === 'words' || unit === 'paragraphs')) {
  //   const wordsPerParagraphMin =
  //     sentencesPerParagraphDefault.min * wordsPerSentenceDefault.min;
  //   const minimumQuantityAllowed = unit === 'words' ? wordsPerParagraphMin : 1;
  //   if (quantity < minimumQuantityAllowed) {
  //     errors.push(quantityTooSmall(minimumQuantityAllowed));
  if (type === 'number' && (unit === 'words' || unit === 'paragraphs')) {
    const minimumQuantityAllowed = unit === 'words' ? sentencesPerParagraph.min * wordsPerSentence.min : 1;
    if (quantity < minimumQuantityAllowed) {
      errors.push(quantityTooSmall(minimumQuantityAllowed));
    }
  }
  return errors;
}

function validateSentencesPerParagraph(sentencesPerParagraph) {
  const errors = [];
  const isSentencesPerParagraphValid = isObject(sentencesPerParagraph) && Object.keys(sentencesPerParagraph).length === 2 && typeof sentencesPerParagraph.min === 'number' && typeof sentencesPerParagraph.max === 'number';
  if (!isSentencesPerParagraphValid) errors.push(invalidSentencesPerParagraph);
  if (sentencesPerParagraph.min < 3) errors.push(sentencesPerParagraphMinTooSmall);
  if (sentencesPerParagraph.max < 3) errors.push(sentencesPerParagraphMaxTooSmall);
  if (sentencesPerParagraph.max < sentencesPerParagraph.min * 2 - 1) errors.push(invalidSentencesPerParagraphMax);
  return errors;
}

function validateUnit(unit) {
  const errors = [];
  if (unit !== 'words' && unit !== 'paragraphs') {
    errors.push(invalidUnit);
  }
  return errors;
}

function validateWordsPerSentence(wordsPerSentence) {
  const errors = [];
  const isWordsPerSentenceValid = isObject(wordsPerSentence) && Object.keys(wordsPerSentence).length === 2 && typeof wordsPerSentence.min === 'number' && typeof wordsPerSentence.max === 'number';
  if (!isWordsPerSentenceValid) errors.push(invalidWordsPerSentence);
  if (wordsPerSentence.min < 3) errors.push(wordsPerSentenceMinTooSmall);
  if (wordsPerSentence.max < 3) errors.push(wordsPerSentenceMaxTooSmall);
  if (wordsPerSentence.max < wordsPerSentence.min * 2 - 1) errors.push(invalidWordsPerSentenceMax);
  return errors;
}

function validate(input, {
  unit,
  quantity,
  format,
  sentencesPerParagraph,
  wordsPerSentence
}) {
  const errors = [].concat(validateInput(input), validateUnit(unit), validateQuantity(quantity, unit, sentencesPerParagraph, wordsPerSentence), validateFormat(format), validateSentencesPerParagraph(sentencesPerParagraph), validateWordsPerSentence(wordsPerSentence));
  if (errors.length > 0) throw new CustomError(`[ ${errors.join(', ')} ]`, 'fullfiller');
}

/** @returns one of the possible input types. See more at {@link inputType}. */
function getInputType(input) {
  if (typeof input === 'string') return 'query';
  if ('body' in input) return 'text';
  if ('words' in input) return 'wordsArray';
  if ('map' in input) return 'freqMap';
  return undefined;
}
// merge default options with options passed as argument
function mergeOptions(optionsArg) {
  return {
    unit: optionsArg.unit ?? 'paragraphs',
    quantity: optionsArg.quantity ?? (optionsArg.unit === 'words' ? 200 : 5),
    format: optionsArg.format ?? 'plain',
    sentencesPerParagraph: {
      ...sentencesPerParagraphDefault,
      ...optionsArg.sentencesPerParagraph
    },
    wordsPerSentence: {
      ...wordsPerSentenceDefault,
      ...optionsArg.wordsPerSentence
    }
  };
}
/**
 * Feature-rich filler text generator.
 * @param input Filler text will be generated from this parameter.
 * @param options Miscellaneous options.
 * @param include What should be included on the output besides the body.
 * @returns Filler object containing body and maybe (depending on include) title and freqMap.
 */
async function fullfiller(input, optionsArg = {}, include = ['title'], stringify = true) {
  const options = mergeOptions(optionsArg);
  validate(input, options);
  /*
    eslint-disable
      @typescript-eslint/no-unnecessary-type-assertion,
      @typescript-eslint/no-non-null-assertion,
      no-case-declarations,
      no-fallthrough
  */
  switch (getInputType(input)) {
    case 'query':
      const article = await getWikipediaArticle(input);
    case 'text':
      const wordsArray = tokenizeWords(input.body ?? article.body);
    case 'wordsArray':
      const freqMap = generateFreqMap(input.words ?? wordsArray);
    case 'freqMap':
      const fm = input.map ?? freqMap;
      const distribution = distribute(options.quantity, options.unit, options.sentencesPerParagraph, options.wordsPerSentence);
      const bodyArray = generateTextArray(fm, distribution);
      const body = stringify ? stringifyTextArray(bodyArray, options.format) : bodyArray;
      return {
        body,
        ...(include.includes('title') ? {
          title: input.title ?? article.title
        } : {}),
        ...(include.includes('freqMap') ? {
          freqMap: fm
        } : {})
      };
    default:
      throw new CustomError(invalidInput, 'fullfiller');
  }
  /*
    eslint-enable
      @typescript-eslint/no-unnecessary-type-assertion,
      @typescript-eslint/no-non-null-assertion,
      no-case-declarations,
      no-fallthrough
  */
}

export { fullfiller as default };
