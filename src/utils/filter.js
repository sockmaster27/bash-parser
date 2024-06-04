'use strict';
const curry = require('lodash.curry');

function* filter(pred, xs) {
	for (const x of xs) {
		if (pred(x)) yield x;
	}
}

module.exports = curry(filter, 2);
