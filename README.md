# Fluree

## Conversion utility for graphql to FlureeQL

###Usage:

```js
import gql from fql-graphql;

const userQuery = gql`
	query UserQuery($username: String) {
        user (id: ["username", $username) {
            username 
            doc
            person {
            	nameGiven
            	nameFamily
            }
        }
    }
`;
```

