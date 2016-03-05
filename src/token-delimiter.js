'use strict';
const hasOwnProperty = require('has-own-property');
const lookahead = require('iterable-lookahead');
const operators = require('./operators');

const QUOTING = {
	NO: {value: 'NO'},
	ESCAPE: {value: 'ESCAPE'},
	SINGLE: {close: '\'', value: 'SINGLE'},
	DOUBLE: {close: '"', value: 'DOUBLE'},
	PARAMETER: {close: '}', value: 'PARAMETER'},
	BACKTICK_COMMAND: {close: '`', value: 'BACKTICK_COMMAND'},
	COMMAND: {close: ')', value: 'COMMAND'},
	ARITHMETIC: {close: '))', value: 'ARITHMETIC'}
};

const QUOTING_DELIM = {
	'\\': QUOTING.ESCAPE,
	'\'': QUOTING.SINGLE,
	'"': QUOTING.DOUBLE,
	'`': QUOTING.BACKTICK_COMMAND,
	'${': QUOTING.PARAMETER,
	'$(': QUOTING.COMMAND,
	'$((': QUOTING.ARITHMETIC
};

const isOperatorStart = (ch, lastCh) => lastCh !== '$' && '()|&!;<>'.indexOf(ch) !== -1;

const isOperator = op => hasOwnProperty(operators, op);

const mkLoc = (lineNumber, columnNumber) => ({
	startLine: lineNumber,
	startColumn: columnNumber
});

const finalizeLoc = (tk, lineNumber, columnNumber) => {
	Object.assign(tk.loc, {
		endLine: lineNumber,
		endColumn: columnNumber
	});
	return tk;
};

const empty = (lineNumber, columnNumber) => ({
	EMPTY: true,
	loc: mkLoc(lineNumber, columnNumber)
});

const newLine = (lineNumber, columnNumber) => ({
	NEWLINE: '\n',
	loc: mkLoc(lineNumber, columnNumber)
});

const eof = (lineNumber, columnNumber) => ({
	EOF: true,
	loc: mkLoc(lineNumber, columnNumber)
});

const operator = (ch, lineNumber, columnNumber) => ({
	OPERATOR: ch,
	loc: mkLoc(lineNumber, columnNumber)
});

const mkToken = (tk, lineNumber, columnNumber) => ({
	TOKEN: tk,
	loc: mkLoc(lineNumber, columnNumber)
});

const quotingCharacter = (ch, lastCh, penultCh) =>
	QUOTING_DELIM[penultCh + lastCh + ch] ||
	QUOTING_DELIM[lastCh + ch] ||
	QUOTING_DELIM[ch];

const closingQuotingCharacter = (quoting, ch, lastCh, penultCh) =>
	(quoting.close === ch && lastCh !== '\\') ||
	(quoting.close === lastCh + ch && penultCh !== '\\');

const mkStartState = () => ({
	token: empty(),
	quoting: QUOTING.NO,
	prevQuoting: null,
	lineNumber: 0,
	columnNumber: 0,
	prevLineNumber: 0,
	prevColumnNumber: 0,
	isComment: false,

	advanceLoc(currentCharacter) {
		this.prevLineNumber = this.lineNumber;
		this.prevColumnNumber = this.columnNumber;

		if (currentCharacter === '\n') {
			this.lineNumber++;
			this.columnNumber = 0;
		} else {
			this.columnNumber++;
		}
	}
});

/*
	delimit tokens on source according to rules defined
	in http://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_03
*/
/* TODO: simplify */
/* eslint-disable complexity */
/* eslint-disable max-depth */
module.exports = function * tokenDelimiter(source) {
	const state = mkStartState();

	const charIterator = lookahead(source, 2);
	for (const currentCharacter of charIterator) {
		if (state.isComment) {
			if (currentCharacter === '\n') {
				state.isComment = false;
			} else {
				state.advanceLoc(currentCharacter);
				continue;
			}
		}

		if (state.token.OPERATOR) {
			// RULE 2 -If the previous character was used as part of an operator and the
			// current character is not quoted and can be used with the current characters
			// to form an operator, it shall be used as part of that (operator) token.
			if (state.quoting === QUOTING.NO &&
				isOperator(state.token.OPERATOR + currentCharacter)) {
				state.token.OPERATOR += currentCharacter;

				// skip to next character

				state.advanceLoc(currentCharacter);
				continue;
			}
			// RULE 3 - If the previous character was used as part of an operator and the
			// current character cannot be used with the current characters to form an operator,
			// the operator containing the previous character shall be delimited.
			if (isOperator(state.token.OPERATOR)) {
				yield finalizeLoc(state.token, state.prevLineNumber, state.prevColumnNumber);
			} else {
				// The current token cannot form an OPERATOR by itself,
				// even if it could start one,
				// so it is emitted as a normal token.
				const alteredTk = mkToken(
					state.token.OPERATOR,
					state.token.loc.startLine,
					state.token.loc.startColumn
				);
				yield finalizeLoc(alteredTk, state.prevLineNumber, state.prevColumnNumber);
			}

			state.token = empty(state.lineNumber, state.columnNumber);
		}

		// RULE 4 - If the current character is <backslash>, single-quote, or
		// double-quote and it is not quoted, it shall affect quoting for subsequent
		// characters up to the end of the quoted text.
		const currentCharacterQuoting = quotingCharacter(currentCharacter, charIterator.behind(1), charIterator.behind(2));

		// console.log(currentCharacter, quoting, penultCharacter + lastCharacter + currentCharacter + '-> ' + JSON.stringify(currentCharacterQuoting))

		if (currentCharacterQuoting && state.quoting === QUOTING.NO) {
			state.quoting = currentCharacterQuoting;

			if (currentCharacter !== '\\') {
				if (state.token.TOKEN === undefined) {
					state.token = mkToken(currentCharacter, state.lineNumber, state.columnNumber);
				} else {
					state.token.TOKEN += currentCharacter;
				}
			}

			// skip to next character

			state.advanceLoc(currentCharacter);
			continue;
		}

		if (state.quoting === QUOTING.COMMAND && currentCharacterQuoting === QUOTING.ARITHMETIC) {
			state.quoting = currentCharacterQuoting;
		}

		// <backslash> quoting should work within double quotes
		if (currentCharacter === '\\' &&
			state.quoting === QUOTING.DOUBLE) {
			state.quoting = QUOTING.ESCAPE;

			state.prevQuoting = QUOTING.DOUBLE;
			// skip to next character

			state.advanceLoc(currentCharacter);
			continue;
		}

		// RULE 6 - If the current character is not quoted and can be used as the
		// first character of a new operator, the current token (if any) shall be
		// delimited. The current character shall be used as the beginning of the
		// next (operator) token.
		if (isOperatorStart(currentCharacter, charIterator.behind(1)) &&
			state.quoting === QUOTING.NO) {
			// emit current token if not empty

			if (!state.token.EMPTY) {
				yield finalizeLoc(state.token, state.prevLineNumber, state.prevColumnNumber);
			}
			state.token = operator(currentCharacter, state.lineNumber, state.columnNumber);

			// skip to next character

			state.advanceLoc(currentCharacter);
			continue;
		}

		// RULE 7 - If the current character is an unquoted <newline>, the current
		// token shall be delimited.
		if (state.quoting !== QUOTING.ESCAPE &&
				currentCharacter === '\n') {
			// emit current token if not empty
			if (!state.token.EMPTY) {
				yield finalizeLoc(state.token, state.prevLineNumber, state.prevColumnNumber);
			}

			state.token = empty(state.lineNumber, state.columnNumber);
			state.quoting = QUOTING.NO;
			yield finalizeLoc(newLine(state.lineNumber, state.columnNumber), state.lineNumber, state.columnNumber);

			// skip to next character

			state.advanceLoc(currentCharacter);
			continue;
		}

		// RULE 8 - If the current character is an unquoted <blank>, any token
		// containing the previous character is delimited and the current
		// character shall be discarded.
		// console.log(currentCharacter.match(/\s/), quoting)
		if (
			state.quoting === QUOTING.NO &&
			currentCharacter.match(/\s/)) {
			// emit current token if not empty
			if (!state.token.EMPTY) {
				yield finalizeLoc(state.token, state.prevLineNumber, state.prevColumnNumber);
			}

			state.token = empty(state.lineNumber, state.columnNumber);

			// skip to next character

			state.advanceLoc(currentCharacter);
			continue;
		}

		// reset character escaping if setted.
		if (state.quoting === QUOTING.ESCAPE) {
			state.quoting = state.prevQuoting || QUOTING.NO;
			state.prevQuoting = null;
		}

		// Reset single or double quoting on close
		if (closingQuotingCharacter(state.quoting, currentCharacter, charIterator.behind(1), charIterator.behind(2))) {
			state.quoting = QUOTING.NO;

			// skip to next character
			// continue;
		}

		// RULE 9 - If the previous character was part of a word, the current
		// character shall be appended to that word.
		if (state.token.TOKEN !== undefined) {
			state.token.TOKEN += currentCharacter;

			// skip to next character

			state.advanceLoc(currentCharacter);
			continue;
		}

		// RULE 10 - If the current character is a '#', it and all subsequent
		// characters up to, but excluding, the next <newline> shall be discarded
		// as a comment. The <newline> that ends the line is not considered part
		// of the comment.
		if (currentCharacter === '#') {
			state.isComment = true;
		} else if (currentCharacter === '\n') {
			state.token = empty(state.lineNumber, state.columnNumber);
		} else {
			// RULE 11 - The current character is used as the start of a new word.
			state.token = mkToken(currentCharacter, state.lineNumber, state.columnNumber);
		}

		state.advanceLoc(currentCharacter);
	}

	// RULE 1 - If the end of input is recognized, the current token shall
	// be delimited. If there is no current token, the end-of-input indicator
	// shall be returned as the token.
	if (!state.token.EMPTY) {
		yield finalizeLoc(state.token, state.prevLineNumber, state.prevColumnNumber);
	}

	state.advanceLoc('');
	yield finalizeLoc(eof(state.prevLineNumber, state.prevColumnNumber), state.prevLineNumber, state.prevColumnNumber);
};
