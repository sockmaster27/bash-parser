# bash-parser

A fork of [`vorpaljs/bash-parser`](https://github.com/vorpaljs/bash-parser) - Parses bash source code to produce an AST

This fork is focussed at dependency maintenance and will not receive any updates beyond that. No new features, no bug (nor security) fixes.

All (relevant) changes of this fork are being upstreamed at <https://github.com/vorpaljs/bash-parser/pull/66>.

# Installation

```bash
npm install --save bash-parser
```

# Usage

```js
  const parse = require('bash-parser');
  const ast = parse('echo ciao');
```

`ast` result is:

```js
{
		type: "Script",
		commands: [
			{
				type: "SimpleCommand",
				name: {
					text: "echo",
					type: "Word"
				},
				suffix: [
					{
						text: "ciao",
						type: "Word"
					}
				]
			}
		]
	}
```

# Related projects

* [cash](https://github.com/dthree/cash) - This parser should become the parser used by `cash` (and also [vorpal](https://github.com/dthree/vorpal))
* [nsh](https://github.com/piranna/nsh) - This parser should become the parser used by `nsh`
* [js-shell-parse](https://github.com/grncdr/js-shell-parse) - bash-parser was born as a fork of `js-shell-parse`, but was rewritten to use a `jison` grammar
* [jison](https://github.com/zaach/jison) - Bison in JavaScript.

# Documentation

Look in [documents folder](https://github.com/vorpaljs/bash-parser/tree/master/documents)

# License

The MIT License (MIT)

Copyright (c) 2016 vorpaljs
