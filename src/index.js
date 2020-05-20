import { parse } from 'graphql';

// return map of vars with keys containing var name and values null.
// if no vars exist, returns null
function graphqlASTgetVars(graphqlAST) {
  const varsRaw = graphqlAST.definitions[0].variableDefinitions;
  let vars = null;
  if (Array.isArray(varsRaw) && varsRaw.length) {
    vars = {};
    for (let v of varsRaw) {
      let varName = v.variable.name.value;
      vars["?" + varName] = null;
    }
  }
  return vars;
}


// map of different value types and parsing rules
// note we do not yet use ObjectValue, or EnumValue, so not here
// https://github.com/graphql/graphql-js/blob/master/src/language/parser.js#L512
const argScalars = {
  Variable: x => "?" + x,
  IntValue: x => parseInt(x),
  FloatValue: x => parseFloat(x),
  StringValue: x => x,
  BooleanValue: x => x,
  NullValue: x => null
}

function parseArgValue(argValue) {
  const kind = argValue.kind;
  if (kind === "ListValue") {
    return argValue.values.map(v => parseArgValue(v));
  } else if (kind === "Variable") {
    // Variable has variable's name in a different location
    return argScalars[kind](argValue.name.value);
  } else {
    return argScalars[kind](argValue.value);
  }
}

function argsToOpts(args) {
  let opts = {};

  args.forEach(a => {
    const key = a.name.value;
    const val = a.value;
    opts[key] = parseArgValue(val);
  })

  return opts;
}

function selectionsToPattern(selections) {
  if (selections) {
    return selections.map((s) => {
      const opts = argsToOpts(s.arguments);
      const subSelection = s.name.value;
      if (s.selectionSet && s.selectionSet.selections) {
        // we have a sub-selection
        let subPattern = {};
        subPattern[subSelection] = selectionsToPattern(s.selectionSet.selections);
        return subPattern;
      } else {
        return subSelection;
      }
    });
  } else {
    return ["*"];
  }
}


function blockQuery(opts) {
  const { from, to } = opts;
  var flureeQL = null;
  if (from && to) {
    flureeQL = { block: [from, to] }
  } else if (from) {
    flureeQL = { block: [from] }
  } else {
    throw new Error("Block queries must have a 'from' argument and optionally at 'to' argument.");
  }
  return flureeQL;
}


function historyQuery(opts) {
  var { subject, prettyPrint, showAuth, block } = opts;
  prettyPrint = prettyPrint || opts["pretty-print"]; // support deprecated format for now
  showAuth = showAuth || opts["show-auth"]; // support deprecated format for now
  // deprecation warnings... enable once we officially change Fluree server-side behavior
  // if (opts["pretty-print"]) console.warn("pretty-print key in queries is deprecated, please use prettyPrint instead.");
  // if (opts["show-auth"]) console.warn("show-auth key in queries is deprecated, please use showAuth instead.");
  if (!subject) {
    throw new Error("History query must always have a subject key.");
  }
  if (typeof subject !== 'string') {
    throw new Error("History query subject must always be a JSON string.");
  }
  var parsedSubject;
  try {
    // check if using a variable.
    if (subject.startsWith("?")) {
      parsedSubject = subject;
    } else {
      // NOTE: graphql parser does not like escaped quotes which makes including JSON directly
      // basically useless, unless the JSON is a number, i.e. "1234" - so a subject will work
      // we should work to fix this behavior by possibly pre-parsing before the parser
      parsedSubject = JSON.parse(subject);
    }
  } catch (e) {
    console.error("Error parsing subject in history query, subject must be a valid JSON string." +
      " graphql parser doesn't like escaped strings (\\\"), as an alternative use a variable for subject.", opts)
    throw e;
  }

  var flureeQL = { history: parsedSubject };
  if (block) {
    flureeQL.block = block;
  }
  if (showAuth) {
    // TODO - when deprecating show-auth for showAuth, update below
    flureeQL["show-auth"] = showAuth;
  }
  if (prettyPrint) {
    // TODO - when deprecating pretty-print for prettyPrint, update below
    flureeQL["pretty-print"] = prettyPrint;
  }
  return flureeQL;
}

function graphQuery(collection, selections, opts) {
  const pattern = selectionsToPattern(selections);
  var query = {
    select: pattern,
    from: collection
  }

  if (opts.block) query.block = opts.block;
  // utilized an ident, overwrite collection in 'from'
  if (opts.ident) query.from = opts.ident;
  // query for a specific ID, overwrite collection in 'from'
  if (opts._id) query.from = opts._id;
  // query with a where clause
  if (opts.where) query.where = opts.where;
  // limit and offset
  if (opts.limit) query.limit = opts.limit;
  if (opts.offset) query.offset = opts.offset;

  return query;
}

function graphqlToFlurql(graphqlAST) {
  var flureeQL = {}; // return value
  const vars = graphqlASTgetVars(graphqlAST);
  // graph selections will represent our top level query types - graph, history or block
  const graphSelections = graphqlAST.definitions[0].selectionSet.selections;

  graphSelections.forEach(selection => {
    const topLevelOpts = argsToOpts(selection.arguments); // top level opts can include 'block'

    const collection = selection.name.value;
    const alias = selection.alias ? selection.alias.value : collection;

    if (collection === "_block") {
      flureeQL[alias] = blockQuery(topLevelOpts);
    } else if (collection === "_history") {
      flureeQL[alias] = historyQuery(topLevelOpts);
    } else {
      const patternSelections = selection.selectionSet.selections;
      flureeQL[alias] = graphQuery(collection, patternSelections, topLevelOpts);
    }
  });

  if (vars)
    flureeQL.vars = vars;

  return flureeQL;
}

// Puts template/tag literal array arguments into a single string for parsing.
// Literals that include expressions come in as an array
// of each chunk, i.e. `string text ${expression} string text` comes in as
// ["string text ", ${expression}, " string text"]
function buildGqlStrFromArgs(args) {
  var literals = args[0];

  var result = (typeof (literals) === "string") ? literals : literals[0];

  for (var i = 1; i < args.length; i++) {
    if (args[i] && args[i].kind && args[i].kind === 'Document') {
      result += args[i].loc.source.body;
    } else {
      result += args[i];
    }

    result += literals[i];
  }

  return result;
}

// cache already parsed docs
var cache = {};

// strip whitespace, etc for use with cache.
function normalize(string) {
  return string.replace(/[\s,]+/g, ' ').trim();
}

export function gql(/* arguments */) {
  const args = Array.prototype.slice.call(arguments);
  const gqlStr = buildGqlStrFromArgs(args);
  const cacheKey = normalize(gqlStr);

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const gqlAST = parse(gqlStr);
  if (!gqlAST || gqlAST.kind !== 'Document') {
    throw new Error('Not a valid GraphQL document.');
  }

  const flureeQL = graphqlToFlurql(gqlAST);
  return flureeQL;
}

export const toAST = parse;

export default gql;
