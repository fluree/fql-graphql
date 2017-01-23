import gqlToAST from 'graphql-tag';

function graphqlASTgetVars(graphqlAST) {
    const varsRaw = graphqlAST.definitions[0].variableDefinitions;
    if (varsRaw) {
        return varsRaw.map((v) => {
            return v.variable.name.value;
        });
    } else {
        return [];
    }

}

function argsToOpts(args) {

    let opts = {};

    args.map( (a) => {
        const key = a.name.value;
        const kind = a.value.kind;
        
        if (kind === "ListValue") {
            opts[key] = a.value.values.map( (v) => {
                if (v.kind === "Variable") {
                    return "?" + v.name.value;
                } else {
                    return v.value;
                }
            });
        } else if (kind === "Variable") {
            opts[key] = "?" + a.value.name.value;
        } else {
            opts[key] = a.value.value;
        }
    })

    return opts;
}

function selectionsToPattern(selections) {
    if (selections) {
        return selections.map ( (s) => {
            const event = s.name.value;
            if (s.selectionSet && s.selectionSet.selections) {
                // we have a join
                let join = {};
                join[event] = selectionsToPattern(s.selectionSet.selections);
                return join;
            } else {
                return event;
            }
        });
    } else {
        return ["*"];
    }
}


export function graphqlToFlurql (graphqlAST) {
    const vars = graphqlASTgetVars(graphqlAST);
    const graphSelections = graphqlAST.definitions[0].selectionSet.selections;
    const graph = graphSelections.map( (s) => {
        
        const stream = s.name.value;
        
        let opts = argsToOpts(s.arguments);
        if (s.alias && s.alias.value) {
            opts.as = s.alias.value;
        }

        const pattern = s.selectionSet && s.selectionSet.selections ? selectionsToPattern(s.selectionSet.selections) : ["*"];

        return [stream, opts, pattern];
    })

    return {
        vars: vars,
        graph: graph
    }

}

export default function gql (gqlStr) {
    const gqlAST = gqlToAST(gqlStr);
    return graphqlToFlurql(gqlAST);
}
