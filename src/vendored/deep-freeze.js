function deepFreeze(o) {
	Object.freeze(o);
	Object.getOwnPropertyNames(o).forEach(function (prop) {
		if (o.hasOwnProperty(prop)
			&& o[prop] !== null
			&& (typeof o[prop] === "object" || typeof o[prop] === "function")
			&& !Object.isFrozen(o[prop])) {
			deepFreeze(o[prop]);
		}
	});

	return o;
};

// This code was taken from:
// - https://www.npmjs.com/package/deep-freeze
// which is released to the public domain.
// It was vendored because the account of the original package's releaser no
// longer exists (meaning it could be claimed by someone else), which is a major
// supply chain security risk.
