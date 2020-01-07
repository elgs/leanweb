const operators = {
   '||': { precedence: 1 },
   '&&': { precedence: 3 },
   '==': { precedence: 5 },
   '!=': { precedence: 5 },
   '===': { precedence: 5 },
   '!==': { precedence: 5 },
   '>': { precedence: 5 },
   '<': { precedence: 5 },
   '>=': { precedence: 5 },
   '<=': { precedence: 5 },
   '+': { precedence: 7 },
   '-': { precedence: 7 },
   '*': { precedence: 9 },
   '/': { precedence: 9 },
   '%': { precedence: 9 },
};

const isPotentialOperator = token => Object.keys(operators).filter(op => op.startsWith(token)).length > 0;

module.exports.tokenize = str => {
   // single/double quote states
   const tokens = [];
   let sq = false;
   let dq = false;
   let token = '';
   let peek = '';

   for (let i = 0; i < str.length; ++i) {
      peek = '';
      const s = str[i];
      if (s.match(/\s/)) {
         if (sq || dq) {
            token += s;
         } else if (token.length > 0) {
            tokens.push(token);
            token = '';
         }
      } else if (s === '\'') {
         if (dq) {
            token += s;
         } else {
            token += s;
            sq = !sq;
            if (!sq) {
               tokens.push(token);
               token = '';
            }
         }
      } else if (s === '"') {
         if (sq) {
            token += s;
         } else {
            token += s;
            dq = !dq;
            if (!dq) {
               tokens.push(token);
               token = '';
            }
         }
      } else if (s === '(' || s === ')' || s === '[' || s === ']') {
         if (sq || dq) {
            token += s;
         } else {
            if (token.length > 0) {
               tokens.push(token);
            }
            tokens.push(s);
            token = '';
         }
      } else if (s === '+' || s === '-') {
         if (sq || dq) {
            token += s;
         } else {
            if (token.length > 0) {
               tokens.push(token);
               token = '';
            }
            let lastToken = '';
            if (tokens.length > 0) {
               lastToken = tokens[tokens.length - 1];
            }
            if ((tokens.length === 0 || lastToken === '(' || lastToken === '[') || operators[lastToken]) {
               // sign
               token = s;
            } else {
               // operator
               tokens.push(s);
            }
         }
      } else {
         if (sq || dq) {
            token += s;
         } else {
            token += s;
            if (i < str.length - 1) {
               peek = str[i + 1];
            }
            const isTokenPotentialOperator = isPotentialOperator(token);
            const isPeekPotentialOperator = isPotentialOperator(peek);
            const isTokenPeekPotentialOperator = isPotentialOperator(token + peek);

            if (!isTokenPotentialOperator && !isTokenPeekPotentialOperator) {
               tokens.push(token);
               token = '';
            }
            if (isTokenPotentialOperator && !isTokenPeekPotentialOperator) {
               tokens.push(token);
               token = '';
            }
         }
      }
   }
   if (token.length > 0) {
      tokens.push(token);
      token = '';
   }
   console.log(str, tokens);
   return tokens;
};
