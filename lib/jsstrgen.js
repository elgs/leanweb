const randGenConsts = {};
randGenConsts.None = 0;
randGenConsts.Lower = 1 << 0;
randGenConsts.Upper = 1 << 1;
randGenConsts.Digit = 1 << 2;
randGenConsts.Punct = 1 << 3;

randGenConsts.LowerUpper = randGenConsts.Lower | randGenConsts.Upper;
randGenConsts.LowerDigit = randGenConsts.Lower | randGenConsts.Digit;
randGenConsts.UpperDigit = randGenConsts.Upper | randGenConsts.Digit;
randGenConsts.LowerUpperDigit = randGenConsts.LowerUpper | randGenConsts.Digit;
randGenConsts.All = randGenConsts.LowerUpperDigit | randGenConsts.Punct;

const lower = 'abcdefghijklmnopqrstuvwxyz';
const upper = lower.toUpperCase();
const digit = '0123456789';
const punct = '~!@#$%^&*()_+-=';

const randGen = function (size, set = randGenConsts.All, include = '', exclude = '') {
   let all = include;
   if ((set & randGenConsts.Lower) > 0) {
      all += lower;
   }

   if ((set & randGenConsts.Upper) > 0) {
      all += upper;
   }

   if ((set & randGenConsts.Digit) > 0) {
      all += digit;
   }
   if ((set & randGenConsts.Punct) > 0) {
      all += punct;
   }

   const lenAll = all.length;
   if (exclude.length >= lenAll) {
      throw 'Too much to exclude.';
   }
   let buf = '';
   for (let i = 0; i < size; ++i) {
      let b = all[Math.floor(Math.random() * lenAll)];
      if (exclude.includes(b)) {
         --i;
         continue;
      }
      buf += b;
   }
   return buf;
};

module.exports = { randGen, randGenConsts };