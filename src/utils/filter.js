'use strict';
const curry = require('lodash.curry');

function* filterIterator(pred, xs) {
	for (const x of xs) {
		if (pred(x)) yield x;
	}
}

const filter = curry(filterIterator, 2);

module.exports = filter;
