import gql from '../dist/index.module.js';

test('basic query with query keyword', () => {
  const parsedGql = gql`
    query {
      _user {
        _id
        username
      }
    }`;
  expect(parsedGql).toEqual({
    _user: {
      select: ["_id", "username"],
      from: "_user"
    }
  });
});

test('basic query without query keyword', () => {
  const parsedGql = gql`
    {
      _user {
        _id
        username
      }
    }`;
  expect(parsedGql).toEqual({
    _user: {
      select: ["_id", "username"],
      from: "_user"
    }
  });
});

test('basic query with alias', () => {
  const parsedGql = gql`
    {
      allUsers: _user {
        _id
        username
      }
    }`;
  expect(parsedGql).toEqual({
    allUsers: {
      select: ["_id", "username"],
      from: "_user"
    }
  });
});

test('multiple queries with alias', () => {
  const parsedGql = gql`
    {
      allUsers: _user {
        _id
        username
      }

      allChats: chat {
        message
      }
    }`;
  expect(parsedGql).toEqual({
    allUsers: {
      select: ["_id", "username"],
      from: "_user"
    },
    allChats: {
      select: ["message"],
      from: "chat"
    }
  });
});

test('nested basic query', () => {
  const parsedGql = gql`
    query {
      _user {
        _id
        username
        auth {
          id
        }
      }
    }`;
  expect(parsedGql).toEqual({
    _user: {
      select: ["_id", "username", { auth: ["id"] }],
      from: "_user"
    }
  });
});

test('query for specific _id 32-bit integer', () => {
  const parsedGql = gql`
    query {
      _user(_id: 12345) {
        username
      }
    }`;
  expect(parsedGql).toEqual({
    _user: {
      select: ["username"],
      from: 12345
    }
  });
});

test('query for specific _id long integer', () => {
  // 5 billion
  const parsedGql = gql`
    query {
      _user(_id: 5000000000) {
        username
      }
    }`;
  expect(parsedGql).toEqual({
    _user: {
      select: ["username"],
      from: 5000000000
    }
  });
});

test('query for specific _id using a var', () => {
  const parsedGql = gql`
    query ($userID: Long!) {
      _user(_id: $userID) {
        username
      }
    }`;
  expect(parsedGql).toEqual({
    _user: {
      select: ["username"],
      from: "?userID"
    },
    vars: { "?userID": null }
  });
});

test('query for specific block integer', () => {
  const parsedGql = gql`
  { 
    chat (block: 2) {
      _id
      instant
      message
    }
  }`;
  expect(parsedGql).toEqual({
    chat: {
      select: ["_id", "instant", "message"],
      from: "chat",
      block: 2
    }
  });
});

test('query for specific block string', () => {
  const parsedGql = gql`
  { 
    chat (block: "2018-03-08T09:57:13.861Z") {
      _id
      instant
      message
    }
  }`;
  expect(parsedGql).toEqual({
    chat: {
      select: ["_id", "instant", "message"],
      from: "chat",
      block: "2018-03-08T09:57:13.861Z"
    }
  });
});

test('query with where clause as var', () => {
  const parsedGql = gql`
  query ($whereClause: String!) { 
    chat (where: $whereClause, limit: 10) {
      _id
      comments
    }
  }`;
  expect(parsedGql).toEqual({
    chat: {
      select: ["_id", "comments"],
      from: "chat",
      where: "?whereClause",
      limit: 10
    },
    vars: { "?whereClause": null }
  });
});

test('query with limit and offset', () => {
  const parsedGql = gql`
  { 
    chat(offset: 100, limit: 10) {
      _id
      comments
    }
  }`;
  expect(parsedGql).toEqual({
    chat: {
      select: ["_id", "comments"],
      from: "chat",
      limit: 10,
      offset: 100
    }
  });
});

test('query with limit and offset using vars', () => {
  const parsedGql = gql`
  query ($limit: Int!, $offset: Int!) { 
    chat(offset: $offset, limit: $limit) {
      _id
      comments
    }
  }`;
  expect(parsedGql).toEqual({
    chat: {
      select: ["_id", "comments"],
      from: "chat",
      limit: "?limit",
      offset: "?offset"
    },
    vars: { "?limit": null, "?offset": null }
  });
});

// block queries
test('block query with range', () => {
  const parsedGql = gql`
  {
    _block(from: 3, to: 5)
  }`;
  expect(parsedGql).toEqual({
    _block: {
      block: [3, 5]
    }
  });
});

test('block query with alias and range', () => {
  const parsedGql = gql`
  {
    blockThreeToFive: _block(from: 3, to: 5)
  }`;
  expect(parsedGql).toEqual({
    blockThreeToFive: {
      block: [3, 5]
    }
  });
});

test('block query with from only', () => {
  const parsedGql = gql`
  {
    _block(from: 3)
  }`;
  expect(parsedGql).toEqual({
    _block: {
      block: [3]
    }
  });
});

test('block query with from var', () => {
  const parsedGql = gql`
  query ($fromBlock: Int!) {
    _block(from: $fromBlock)
  }`;
  const flureeQl = {
    _block: {
      block: ["?fromBlock"]
    },
    vars: { "?fromBlock": null }
  }
  expect(parsedGql).toEqual(flureeQl);
});

test('block query with from and to vars', () => {
  const parsedGql = gql`
  query ($fromBlock: Int!, $toBlock: Int!) {
    _block(from: $fromBlock, to: $toBlock)
  }`;
  expect(parsedGql).toEqual({
    _block: {
      block: ["?fromBlock", "?toBlock"]
    },
    vars: { "?fromBlock": null, "?toBlock": null }
  });
});


// History queries
test('history query with block', () => {
  const parsedGql = gql`
  {
    _history(subject: "369435906932737", block: 4)
  }`;
  expect(parsedGql).toEqual({
    _history: {
      history: 369435906932737,
      block: 4
    }
  });
});

test('history query with vars.', () => {
  const parsedGql = gql`
  query ($sub: String!, $block: Int!) {
    _history(subject: $sub, block: $block)
  }`;
  expect(parsedGql).toEqual({
    _history: {
      history: "?sub",
      block: "?block",
    },
    vars: {
      "?sub": null,
      "?block": null
    }
  });
});
