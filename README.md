# Fluree

## Conversion utility for graphql to FlureeQL

###Usage:

```js
import gql from fql-graphql;

const userQuery = gql`
	query ($username: String!) {
        _user (ident: ["username", $username]) {
            username 
            person {
            	nameGiven
            	nameFamily
            }
        }
    }
`;
```

