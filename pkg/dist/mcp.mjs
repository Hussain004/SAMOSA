#!/usr/bin/env node

// mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// src/core/fields/f64.ts
var F64Field = class {
  name = "f64";
  zero = 0;
  one = 1;
  pi = Math.PI;
  add(a, b) {
    return a + b;
  }
  sub(a, b) {
    return a - b;
  }
  mul(a, b) {
    return a * b;
  }
  div(a, b) {
    return a / b;
  }
  neg(a) {
    return -a;
  }
  inv(a) {
    return 1 / a;
  }
  fromRational(n, d) {
    return n / d;
  }
  isZero(a) {
    return a === 0;
  }
  eq(a, b) {
    return a === b;
  }
  cmp(a, b) {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  abs(a) {
    return Math.abs(a);
  }
  sqrt(a) {
    return Math.sqrt(a);
  }
  exp(a) {
    return Math.exp(a);
  }
  log(a) {
    return Math.log(a);
  }
  sin(a) {
    return Math.sin(a);
  }
  cos(a) {
    return Math.cos(a);
  }
  tanh(a) {
    return Math.tanh(a);
  }
  toNumber(a) {
    return a;
  }
  random(rng) {
    return rng() * 2 - 1;
  }
  normal(rng) {
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
};

// node_modules/.pnpm/decimal.js@10.6.0/node_modules/decimal.js/decimal.mjs
var EXP_LIMIT = 9e15;
var MAX_DIGITS = 1e9;
var NUMERALS = "0123456789abcdef";
var LN10 = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
var PI = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
var DEFAULTS = {
  // These values must be integers within the stated ranges (inclusive).
  // Most of these values can be changed at run-time using the `Decimal.config` method.
  // The maximum number of significant digits of the result of a calculation or base conversion.
  // E.g. `Decimal.config({ precision: 20 });`
  precision: 20,
  // 1 to MAX_DIGITS
  // The rounding mode used when rounding to `precision`.
  //
  // ROUND_UP         0 Away from zero.
  // ROUND_DOWN       1 Towards zero.
  // ROUND_CEIL       2 Towards +Infinity.
  // ROUND_FLOOR      3 Towards -Infinity.
  // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
  // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
  // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
  // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
  // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
  //
  // E.g.
  // `Decimal.rounding = 4;`
  // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
  rounding: 4,
  // 0 to 8
  // The modulo mode used when calculating the modulus: a mod n.
  // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
  // The remainder (r) is calculated as: r = a - n * q.
  //
  // UP         0 The remainder is positive if the dividend is negative, else is negative.
  // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
  // FLOOR      3 The remainder has the same sign as the divisor (Python %).
  // HALF_EVEN  6 The IEEE 754 remainder function.
  // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
  //
  // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
  // division (9) are commonly used for the modulus operation. The other rounding modes can also
  // be used, but they may not give useful results.
  modulo: 1,
  // 0 to 9
  // The exponent value at and beneath which `toString` returns exponential notation.
  // JavaScript numbers: -7
  toExpNeg: -7,
  // 0 to -EXP_LIMIT
  // The exponent value at and above which `toString` returns exponential notation.
  // JavaScript numbers: 21
  toExpPos: 21,
  // 0 to EXP_LIMIT
  // The minimum exponent value, beneath which underflow to zero occurs.
  // JavaScript numbers: -324  (5e-324)
  minE: -EXP_LIMIT,
  // -1 to -EXP_LIMIT
  // The maximum exponent value, above which overflow to Infinity occurs.
  // JavaScript numbers: 308  (1.7976931348623157e+308)
  maxE: EXP_LIMIT,
  // 1 to EXP_LIMIT
  // Whether to use cryptographically-secure random number generation, if available.
  crypto: false
  // true/false
};
var inexact;
var quadrant;
var external = true;
var decimalError = "[DecimalError] ";
var invalidArgument = decimalError + "Invalid argument: ";
var precisionLimitExceeded = decimalError + "Precision limit exceeded";
var cryptoUnavailable = decimalError + "crypto unavailable";
var tag = "[object Decimal]";
var mathfloor = Math.floor;
var mathpow = Math.pow;
var isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
var isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
var isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
var isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
var BASE = 1e7;
var LOG_BASE = 7;
var MAX_SAFE_INTEGER = 9007199254740991;
var LN10_PRECISION = LN10.length - 1;
var PI_PRECISION = PI.length - 1;
var P = { toStringTag: tag };
P.absoluteValue = P.abs = function() {
  var x2 = new this.constructor(this);
  if (x2.s < 0) x2.s = 1;
  return finalise(x2);
};
P.ceil = function() {
  return finalise(new this.constructor(this), this.e + 1, 2);
};
P.clampedTo = P.clamp = function(min2, max2) {
  var k, x2 = this, Ctor = x2.constructor;
  min2 = new Ctor(min2);
  max2 = new Ctor(max2);
  if (!min2.s || !max2.s) return new Ctor(NaN);
  if (min2.gt(max2)) throw Error(invalidArgument + max2);
  k = x2.cmp(min2);
  return k < 0 ? min2 : x2.cmp(max2) > 0 ? max2 : new Ctor(x2);
};
P.comparedTo = P.cmp = function(y) {
  var i2, j, xdL, ydL, x2 = this, xd = x2.d, yd = (y = new x2.constructor(y)).d, xs = x2.s, ys = y.s;
  if (!xd || !yd) {
    return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
  }
  if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
  if (xs !== ys) return xs;
  if (x2.e !== y.e) return x2.e > y.e ^ xs < 0 ? 1 : -1;
  xdL = xd.length;
  ydL = yd.length;
  for (i2 = 0, j = xdL < ydL ? xdL : ydL; i2 < j; ++i2) {
    if (xd[i2] !== yd[i2]) return xd[i2] > yd[i2] ^ xs < 0 ? 1 : -1;
  }
  return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
};
P.cosine = P.cos = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.d) return new Ctor(NaN);
  if (!x2.d[0]) return new Ctor(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x2 = cosine(Ctor, toLessThanHalfPi(Ctor, x2));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 3 ? x2.neg() : x2, pr, rm, true);
};
P.cubeRoot = P.cbrt = function() {
  var e, m, n, r, rep, s, sd, t, t3, t3plusx, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite() || x2.isZero()) return new Ctor(x2);
  external = false;
  s = x2.s * mathpow(x2.s * x2, 1 / 3);
  if (!s || Math.abs(s) == 1 / 0) {
    n = digitsToString(x2.d);
    e = x2.e;
    if (s = (e - n.length + 1) % 3) n += s == 1 || s == -2 ? "0" : "00";
    s = mathpow(n, 1 / 3);
    e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
    r.s = x2.s;
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    t3 = t.times(t).times(t);
    t3plusx = t3.plus(x2);
    r = divide(t3plusx.plus(x2).times(t), t3plusx.plus(t3), sd + 2, 1);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).times(t).eq(x2)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).times(r).eq(x2);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.decimalPlaces = P.dp = function() {
  var w, d = this.d, n = NaN;
  if (d) {
    w = d.length - 1;
    n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;
    w = d[w];
    if (w) for (; w % 10 == 0; w /= 10) n--;
    if (n < 0) n = 0;
  }
  return n;
};
P.dividedBy = P.div = function(y) {
  return divide(this, new this.constructor(y));
};
P.dividedToIntegerBy = P.divToInt = function(y) {
  var x2 = this, Ctor = x2.constructor;
  return finalise(divide(x2, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
};
P.equals = P.eq = function(y) {
  return this.cmp(y) === 0;
};
P.floor = function() {
  return finalise(new this.constructor(this), this.e + 1, 3);
};
P.greaterThan = P.gt = function(y) {
  return this.cmp(y) > 0;
};
P.greaterThanOrEqualTo = P.gte = function(y) {
  var k = this.cmp(y);
  return k == 1 || k === 0;
};
P.hyperbolicCosine = P.cosh = function() {
  var k, n, pr, rm, len, x2 = this, Ctor = x2.constructor, one = new Ctor(1);
  if (!x2.isFinite()) return new Ctor(x2.s ? 1 / 0 : NaN);
  if (x2.isZero()) return one;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + 4;
  Ctor.rounding = 1;
  len = x2.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    n = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    n = "2.3283064365386962890625e-10";
  }
  x2 = taylorSeries(Ctor, 1, x2.times(n), new Ctor(1), true);
  var cosh2_x, i2 = k, d8 = new Ctor(8);
  for (; i2--; ) {
    cosh2_x = x2.times(x2);
    x2 = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
  }
  return finalise(x2, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.hyperbolicSine = P.sinh = function() {
  var k, pr, rm, len, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite() || x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + 4;
  Ctor.rounding = 1;
  len = x2.d.length;
  if (len < 3) {
    x2 = taylorSeries(Ctor, 2, x2, x2, true);
  } else {
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x2 = x2.times(1 / tinyPow(5, k));
    x2 = taylorSeries(Ctor, 2, x2, x2, true);
    var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sinh2_x = x2.times(x2);
      x2 = x2.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
    }
  }
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(x2, pr, rm, true);
};
P.hyperbolicTangent = P.tanh = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(x2.s);
  if (x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 7;
  Ctor.rounding = 1;
  return divide(x2.sinh(), x2.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
};
P.inverseCosine = P.acos = function() {
  var x2 = this, Ctor = x2.constructor, k = x2.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
  if (k !== -1) {
    return k === 0 ? x2.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
  }
  if (x2.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x2 = new Ctor(1).minus(x2).div(x2.plus(1)).sqrt().atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.times(2);
};
P.inverseHyperbolicCosine = P.acosh = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (x2.lte(1)) return new Ctor(x2.eq(1) ? 0 : NaN);
  if (!x2.isFinite()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(Math.abs(x2.e), x2.sd()) + 4;
  Ctor.rounding = 1;
  external = false;
  x2 = x2.times(x2).minus(1).sqrt().plus(x2);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.ln();
};
P.inverseHyperbolicSine = P.asinh = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite() || x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 2 * Math.max(Math.abs(x2.e), x2.sd()) + 6;
  Ctor.rounding = 1;
  external = false;
  x2 = x2.times(x2).plus(1).sqrt().plus(x2);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.ln();
};
P.inverseHyperbolicTangent = P.atanh = function() {
  var pr, rm, wpr, xsd, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(NaN);
  if (x2.e >= 0) return new Ctor(x2.abs().eq(1) ? x2.s / 0 : x2.isZero() ? x2 : NaN);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  xsd = x2.sd();
  if (Math.max(xsd, pr) < 2 * -x2.e - 1) return finalise(new Ctor(x2), pr, rm, true);
  Ctor.precision = wpr = xsd - x2.e;
  x2 = divide(x2.plus(1), new Ctor(1).minus(x2), wpr + pr, 1);
  Ctor.precision = pr + 4;
  Ctor.rounding = 1;
  x2 = x2.ln();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.times(0.5);
};
P.inverseSine = P.asin = function() {
  var halfPi, k, pr, rm, x2 = this, Ctor = x2.constructor;
  if (x2.isZero()) return new Ctor(x2);
  k = x2.abs().cmp(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (k !== -1) {
    if (k === 0) {
      halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
      halfPi.s = x2.s;
      return halfPi;
    }
    return new Ctor(NaN);
  }
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x2 = x2.div(new Ctor(1).minus(x2.times(x2)).sqrt().plus(1)).atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.times(2);
};
P.inverseTangent = P.atan = function() {
  var i2, j, k, n, px, t, r, wpr, x2, x3 = this, Ctor = x3.constructor, pr = Ctor.precision, rm = Ctor.rounding;
  if (!x3.isFinite()) {
    if (!x3.s) return new Ctor(NaN);
    if (pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.5);
      r.s = x3.s;
      return r;
    }
  } else if (x3.isZero()) {
    return new Ctor(x3);
  } else if (x3.abs().eq(1) && pr + 4 <= PI_PRECISION) {
    r = getPi(Ctor, pr + 4, rm).times(0.25);
    r.s = x3.s;
    return r;
  }
  Ctor.precision = wpr = pr + 10;
  Ctor.rounding = 1;
  k = Math.min(28, wpr / LOG_BASE + 2 | 0);
  for (i2 = k; i2; --i2) x3 = x3.div(x3.times(x3).plus(1).sqrt().plus(1));
  external = false;
  j = Math.ceil(wpr / LOG_BASE);
  n = 1;
  x2 = x3.times(x3);
  r = new Ctor(x3);
  px = x3;
  for (; i2 !== -1; ) {
    px = px.times(x2);
    t = r.minus(px.div(n += 2));
    px = px.times(x2);
    r = t.plus(px.div(n += 2));
    if (r.d[j] !== void 0) for (i2 = j; r.d[i2] === t.d[i2] && i2--; ) ;
  }
  if (k) r = r.times(2 << k - 1);
  external = true;
  return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.isFinite = function() {
  return !!this.d;
};
P.isInteger = P.isInt = function() {
  return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
};
P.isNaN = function() {
  return !this.s;
};
P.isNegative = P.isNeg = function() {
  return this.s < 0;
};
P.isPositive = P.isPos = function() {
  return this.s > 0;
};
P.isZero = function() {
  return !!this.d && this.d[0] === 0;
};
P.lessThan = P.lt = function(y) {
  return this.cmp(y) < 0;
};
P.lessThanOrEqualTo = P.lte = function(y) {
  return this.cmp(y) < 1;
};
P.logarithm = P.log = function(base2) {
  var isBase10, d, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
  if (base2 == null) {
    base2 = new Ctor(10);
    isBase10 = true;
  } else {
    base2 = new Ctor(base2);
    d = base2.d;
    if (base2.s < 0 || !d || !d[0] || base2.eq(1)) return new Ctor(NaN);
    isBase10 = base2.eq(10);
  }
  d = arg.d;
  if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
    return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
  }
  if (isBase10) {
    if (d.length > 1) {
      inf = true;
    } else {
      for (k = d[0]; k % 10 === 0; ) k /= 10;
      inf = k !== 1;
    }
  }
  external = false;
  sd = pr + guard;
  num = naturalLogarithm(arg, sd);
  denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base2, sd);
  r = divide(num, denominator, sd, 1);
  if (checkRoundingDigits(r.d, k = pr, rm)) {
    do {
      sd += 10;
      num = naturalLogarithm(arg, sd);
      denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base2, sd);
      r = divide(num, denominator, sd, 1);
      if (!inf) {
        if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
          r = finalise(r, pr + 1, 0);
        }
        break;
      }
    } while (checkRoundingDigits(r.d, k += 10, rm));
  }
  external = true;
  return finalise(r, pr, rm);
};
P.minus = P.sub = function(y) {
  var d, e, i2, j, k, len, pr, rm, xd, xe, xLTy, yd, x2 = this, Ctor = x2.constructor;
  y = new Ctor(y);
  if (!x2.d || !y.d) {
    if (!x2.s || !y.s) y = new Ctor(NaN);
    else if (x2.d) y.s = -y.s;
    else y = new Ctor(y.d || x2.s !== y.s ? x2 : NaN);
    return y;
  }
  if (x2.s != y.s) {
    y.s = -y.s;
    return x2.plus(y);
  }
  xd = x2.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (yd[0]) y.s = -y.s;
    else if (xd[0]) y = new Ctor(x2);
    else return new Ctor(rm === 3 ? -0 : 0);
    return external ? finalise(y, pr, rm) : y;
  }
  e = mathfloor(y.e / LOG_BASE);
  xe = mathfloor(x2.e / LOG_BASE);
  xd = xd.slice();
  k = xe - e;
  if (k) {
    xLTy = k < 0;
    if (xLTy) {
      d = xd;
      k = -k;
      len = yd.length;
    } else {
      d = yd;
      e = xe;
      len = xd.length;
    }
    i2 = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
    if (k > i2) {
      k = i2;
      d.length = 1;
    }
    d.reverse();
    for (i2 = k; i2--; ) d.push(0);
    d.reverse();
  } else {
    i2 = xd.length;
    len = yd.length;
    xLTy = i2 < len;
    if (xLTy) len = i2;
    for (i2 = 0; i2 < len; i2++) {
      if (xd[i2] != yd[i2]) {
        xLTy = xd[i2] < yd[i2];
        break;
      }
    }
    k = 0;
  }
  if (xLTy) {
    d = xd;
    xd = yd;
    yd = d;
    y.s = -y.s;
  }
  len = xd.length;
  for (i2 = yd.length - len; i2 > 0; --i2) xd[len++] = 0;
  for (i2 = yd.length; i2 > k; ) {
    if (xd[--i2] < yd[i2]) {
      for (j = i2; j && xd[--j] === 0; ) xd[j] = BASE - 1;
      --xd[j];
      xd[i2] += BASE;
    }
    xd[i2] -= yd[i2];
  }
  for (; xd[--len] === 0; ) xd.pop();
  for (; xd[0] === 0; xd.shift()) --e;
  if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.modulo = P.mod = function(y) {
  var q, x2 = this, Ctor = x2.constructor;
  y = new Ctor(y);
  if (!x2.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
  if (!y.d || x2.d && !x2.d[0]) {
    return finalise(new Ctor(x2), Ctor.precision, Ctor.rounding);
  }
  external = false;
  if (Ctor.modulo == 9) {
    q = divide(x2, y.abs(), 0, 3, 1);
    q.s *= y.s;
  } else {
    q = divide(x2, y, 0, Ctor.modulo, 1);
  }
  q = q.times(y);
  external = true;
  return x2.minus(q);
};
P.naturalExponential = P.exp = function() {
  return naturalExponential(this);
};
P.naturalLogarithm = P.ln = function() {
  return naturalLogarithm(this);
};
P.negated = P.neg = function() {
  var x2 = new this.constructor(this);
  x2.s = -x2.s;
  return finalise(x2);
};
P.plus = P.add = function(y) {
  var carry, d, e, i2, k, len, pr, rm, xd, yd, x2 = this, Ctor = x2.constructor;
  y = new Ctor(y);
  if (!x2.d || !y.d) {
    if (!x2.s || !y.s) y = new Ctor(NaN);
    else if (!x2.d) y = new Ctor(y.d || x2.s === y.s ? x2 : NaN);
    return y;
  }
  if (x2.s != y.s) {
    y.s = -y.s;
    return x2.minus(y);
  }
  xd = x2.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (!yd[0]) y = new Ctor(x2);
    return external ? finalise(y, pr, rm) : y;
  }
  k = mathfloor(x2.e / LOG_BASE);
  e = mathfloor(y.e / LOG_BASE);
  xd = xd.slice();
  i2 = k - e;
  if (i2) {
    if (i2 < 0) {
      d = xd;
      i2 = -i2;
      len = yd.length;
    } else {
      d = yd;
      e = k;
      len = xd.length;
    }
    k = Math.ceil(pr / LOG_BASE);
    len = k > len ? k + 1 : len + 1;
    if (i2 > len) {
      i2 = len;
      d.length = 1;
    }
    d.reverse();
    for (; i2--; ) d.push(0);
    d.reverse();
  }
  len = xd.length;
  i2 = yd.length;
  if (len - i2 < 0) {
    i2 = len;
    d = yd;
    yd = xd;
    xd = d;
  }
  for (carry = 0; i2; ) {
    carry = (xd[--i2] = xd[i2] + yd[i2] + carry) / BASE | 0;
    xd[i2] %= BASE;
  }
  if (carry) {
    xd.unshift(carry);
    ++e;
  }
  for (len = xd.length; xd[--len] == 0; ) xd.pop();
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.precision = P.sd = function(z2) {
  var k, x2 = this;
  if (z2 !== void 0 && z2 !== !!z2 && z2 !== 1 && z2 !== 0) throw Error(invalidArgument + z2);
  if (x2.d) {
    k = getPrecision(x2.d);
    if (z2 && x2.e + 1 > k) k = x2.e + 1;
  } else {
    k = NaN;
  }
  return k;
};
P.round = function() {
  var x2 = this, Ctor = x2.constructor;
  return finalise(new Ctor(x2), x2.e + 1, Ctor.rounding);
};
P.sine = P.sin = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(NaN);
  if (x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x2 = sine(Ctor, toLessThanHalfPi(Ctor, x2));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant > 2 ? x2.neg() : x2, pr, rm, true);
};
P.squareRoot = P.sqrt = function() {
  var m, n, sd, r, rep, t, x2 = this, d = x2.d, e = x2.e, s = x2.s, Ctor = x2.constructor;
  if (s !== 1 || !d || !d[0]) {
    return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x2 : 1 / 0);
  }
  external = false;
  s = Math.sqrt(+x2);
  if (s == 0 || s == 1 / 0) {
    n = digitsToString(d);
    if ((n.length + e) % 2 == 0) n += "0";
    s = Math.sqrt(n);
    e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    r = t.plus(divide(x2, t, sd + 2, 1)).times(0.5);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).eq(x2)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).eq(x2);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.tangent = P.tan = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(NaN);
  if (x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 10;
  Ctor.rounding = 1;
  x2 = x2.sin();
  x2.s = 1;
  x2 = divide(x2, new Ctor(1).minus(x2.times(x2)).sqrt(), pr + 10, 0);
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 4 ? x2.neg() : x2, pr, rm, true);
};
P.times = P.mul = function(y) {
  var carry, e, i2, k, r, rL, t, xdL, ydL, x2 = this, Ctor = x2.constructor, xd = x2.d, yd = (y = new Ctor(y)).d;
  y.s *= x2.s;
  if (!xd || !xd[0] || !yd || !yd[0]) {
    return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
  }
  e = mathfloor(x2.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
  xdL = xd.length;
  ydL = yd.length;
  if (xdL < ydL) {
    r = xd;
    xd = yd;
    yd = r;
    rL = xdL;
    xdL = ydL;
    ydL = rL;
  }
  r = [];
  rL = xdL + ydL;
  for (i2 = rL; i2--; ) r.push(0);
  for (i2 = ydL; --i2 >= 0; ) {
    carry = 0;
    for (k = xdL + i2; k > i2; ) {
      t = r[k] + yd[i2] * xd[k - i2 - 1] + carry;
      r[k--] = t % BASE | 0;
      carry = t / BASE | 0;
    }
    r[k] = (r[k] + carry) % BASE | 0;
  }
  for (; !r[--rL]; ) r.pop();
  if (carry) ++e;
  else r.shift();
  y.d = r;
  y.e = getBase10Exponent(r, e);
  return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
};
P.toBinary = function(sd, rm) {
  return toStringBinary(this, 2, sd, rm);
};
P.toDecimalPlaces = P.toDP = function(dp, rm) {
  var x2 = this, Ctor = x2.constructor;
  x2 = new Ctor(x2);
  if (dp === void 0) return x2;
  checkInt32(dp, 0, MAX_DIGITS);
  if (rm === void 0) rm = Ctor.rounding;
  else checkInt32(rm, 0, 8);
  return finalise(x2, dp + x2.e + 1, rm);
};
P.toExponential = function(dp, rm) {
  var str, x2 = this, Ctor = x2.constructor;
  if (dp === void 0) {
    str = finiteToString(x2, true);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x2 = finalise(new Ctor(x2), dp + 1, rm);
    str = finiteToString(x2, true, dp + 1);
  }
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.toFixed = function(dp, rm) {
  var str, y, x2 = this, Ctor = x2.constructor;
  if (dp === void 0) {
    str = finiteToString(x2);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    y = finalise(new Ctor(x2), dp + x2.e + 1, rm);
    str = finiteToString(y, false, dp + y.e + 1);
  }
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.toFraction = function(maxD) {
  var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r, x2 = this, xd = x2.d, Ctor = x2.constructor;
  if (!xd) return new Ctor(x2);
  n1 = d0 = new Ctor(1);
  d1 = n0 = new Ctor(0);
  d = new Ctor(d1);
  e = d.e = getPrecision(xd) - x2.e - 1;
  k = e % LOG_BASE;
  d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);
  if (maxD == null) {
    maxD = e > 0 ? d : n1;
  } else {
    n = new Ctor(maxD);
    if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
    maxD = n.gt(d) ? e > 0 ? d : n1 : n;
  }
  external = false;
  n = new Ctor(digitsToString(xd));
  pr = Ctor.precision;
  Ctor.precision = e = xd.length * LOG_BASE * 2;
  for (; ; ) {
    q = divide(n, d, 0, 1, 1);
    d2 = d0.plus(q.times(d1));
    if (d2.cmp(maxD) == 1) break;
    d0 = d1;
    d1 = d2;
    d2 = n1;
    n1 = n0.plus(q.times(d2));
    n0 = d2;
    d2 = d;
    d = n.minus(q.times(d2));
    n = d2;
  }
  d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
  n0 = n0.plus(d2.times(n1));
  d0 = d0.plus(d2.times(d1));
  n0.s = n1.s = x2.s;
  r = divide(n1, d1, e, 1).minus(x2).abs().cmp(divide(n0, d0, e, 1).minus(x2).abs()) < 1 ? [n1, d1] : [n0, d0];
  Ctor.precision = pr;
  external = true;
  return r;
};
P.toHexadecimal = P.toHex = function(sd, rm) {
  return toStringBinary(this, 16, sd, rm);
};
P.toNearest = function(y, rm) {
  var x2 = this, Ctor = x2.constructor;
  x2 = new Ctor(x2);
  if (y == null) {
    if (!x2.d) return x2;
    y = new Ctor(1);
    rm = Ctor.rounding;
  } else {
    y = new Ctor(y);
    if (rm === void 0) {
      rm = Ctor.rounding;
    } else {
      checkInt32(rm, 0, 8);
    }
    if (!x2.d) return y.s ? x2 : y;
    if (!y.d) {
      if (y.s) y.s = x2.s;
      return y;
    }
  }
  if (y.d[0]) {
    external = false;
    x2 = divide(x2, y, 0, rm, 1).times(y);
    external = true;
    finalise(x2);
  } else {
    y.s = x2.s;
    x2 = y;
  }
  return x2;
};
P.toNumber = function() {
  return +this;
};
P.toOctal = function(sd, rm) {
  return toStringBinary(this, 8, sd, rm);
};
P.toPower = P.pow = function(y) {
  var e, k, pr, r, rm, s, x2 = this, Ctor = x2.constructor, yn = +(y = new Ctor(y));
  if (!x2.d || !y.d || !x2.d[0] || !y.d[0]) return new Ctor(mathpow(+x2, yn));
  x2 = new Ctor(x2);
  if (x2.eq(1)) return x2;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (y.eq(1)) return finalise(x2, pr, rm);
  e = mathfloor(y.e / LOG_BASE);
  if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
    r = intPow(Ctor, x2, k, pr);
    return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
  }
  s = x2.s;
  if (s < 0) {
    if (e < y.d.length - 1) return new Ctor(NaN);
    if ((y.d[e] & 1) == 0) s = 1;
    if (x2.e == 0 && x2.d[0] == 1 && x2.d.length == 1) {
      x2.s = s;
      return x2;
    }
  }
  k = mathpow(+x2, yn);
  e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x2.d)) / Math.LN10 + x2.e + 1)) : new Ctor(k + "").e;
  if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
  external = false;
  Ctor.rounding = x2.s = 1;
  k = Math.min(12, (e + "").length);
  r = naturalExponential(y.times(naturalLogarithm(x2, pr + k)), pr);
  if (r.d) {
    r = finalise(r, pr + 5, 1);
    if (checkRoundingDigits(r.d, pr, rm)) {
      e = pr + 10;
      r = finalise(naturalExponential(y.times(naturalLogarithm(x2, e + k)), e), e + 5, 1);
      if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
        r = finalise(r, pr + 1, 0);
      }
    }
  }
  r.s = s;
  external = true;
  Ctor.rounding = rm;
  return finalise(r, pr, rm);
};
P.toPrecision = function(sd, rm) {
  var str, x2 = this, Ctor = x2.constructor;
  if (sd === void 0) {
    str = finiteToString(x2, x2.e <= Ctor.toExpNeg || x2.e >= Ctor.toExpPos);
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x2 = finalise(new Ctor(x2), sd, rm);
    str = finiteToString(x2, sd <= x2.e || x2.e <= Ctor.toExpNeg, sd);
  }
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.toSignificantDigits = P.toSD = function(sd, rm) {
  var x2 = this, Ctor = x2.constructor;
  if (sd === void 0) {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  }
  return finalise(new Ctor(x2), sd, rm);
};
P.toString = function() {
  var x2 = this, Ctor = x2.constructor, str = finiteToString(x2, x2.e <= Ctor.toExpNeg || x2.e >= Ctor.toExpPos);
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.truncated = P.trunc = function() {
  return finalise(new this.constructor(this), this.e + 1, 1);
};
P.valueOf = P.toJSON = function() {
  var x2 = this, Ctor = x2.constructor, str = finiteToString(x2, x2.e <= Ctor.toExpNeg || x2.e >= Ctor.toExpPos);
  return x2.isNeg() ? "-" + str : str;
};
function digitsToString(d) {
  var i2, k, ws, indexOfLastWord = d.length - 1, str = "", w = d[0];
  if (indexOfLastWord > 0) {
    str += w;
    for (i2 = 1; i2 < indexOfLastWord; i2++) {
      ws = d[i2] + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
      str += ws;
    }
    w = d[i2];
    ws = w + "";
    k = LOG_BASE - ws.length;
    if (k) str += getZeroString(k);
  } else if (w === 0) {
    return "0";
  }
  for (; w % 10 === 0; ) w /= 10;
  return str + w;
}
function checkInt32(i2, min2, max2) {
  if (i2 !== ~~i2 || i2 < min2 || i2 > max2) {
    throw Error(invalidArgument + i2);
  }
}
function checkRoundingDigits(d, i2, rm, repeating) {
  var di, k, r, rd;
  for (k = d[0]; k >= 10; k /= 10) --i2;
  if (--i2 < 0) {
    i2 += LOG_BASE;
    di = 0;
  } else {
    di = Math.ceil((i2 + 1) / LOG_BASE);
    i2 %= LOG_BASE;
  }
  k = mathpow(10, LOG_BASE - i2);
  rd = d[di] % k | 0;
  if (repeating == null) {
    if (i2 < 3) {
      if (i2 == 0) rd = rd / 100 | 0;
      else if (i2 == 1) rd = rd / 10 | 0;
      r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
    } else {
      r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 100 | 0) == mathpow(10, i2 - 2) - 1 || (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
    }
  } else {
    if (i2 < 4) {
      if (i2 == 0) rd = rd / 1e3 | 0;
      else if (i2 == 1) rd = rd / 100 | 0;
      else if (i2 == 2) rd = rd / 10 | 0;
      r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
    } else {
      r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 1e3 | 0) == mathpow(10, i2 - 3) - 1;
    }
  }
  return r;
}
function convertBase(str, baseIn, baseOut) {
  var j, arr = [0], arrL, i2 = 0, strL = str.length;
  for (; i2 < strL; ) {
    for (arrL = arr.length; arrL--; ) arr[arrL] *= baseIn;
    arr[0] += NUMERALS.indexOf(str.charAt(i2++));
    for (j = 0; j < arr.length; j++) {
      if (arr[j] > baseOut - 1) {
        if (arr[j + 1] === void 0) arr[j + 1] = 0;
        arr[j + 1] += arr[j] / baseOut | 0;
        arr[j] %= baseOut;
      }
    }
  }
  return arr.reverse();
}
function cosine(Ctor, x2) {
  var k, len, y;
  if (x2.isZero()) return x2;
  len = x2.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    y = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    y = "2.3283064365386962890625e-10";
  }
  Ctor.precision += k;
  x2 = taylorSeries(Ctor, 1, x2.times(y), new Ctor(1));
  for (var i2 = k; i2--; ) {
    var cos2x = x2.times(x2);
    x2 = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
  }
  Ctor.precision -= k;
  return x2;
}
var divide = /* @__PURE__ */ (function() {
  function multiplyInteger(x2, k, base2) {
    var temp, carry = 0, i2 = x2.length;
    for (x2 = x2.slice(); i2--; ) {
      temp = x2[i2] * k + carry;
      x2[i2] = temp % base2 | 0;
      carry = temp / base2 | 0;
    }
    if (carry) x2.unshift(carry);
    return x2;
  }
  function compare(a, b, aL, bL) {
    var i2, r;
    if (aL != bL) {
      r = aL > bL ? 1 : -1;
    } else {
      for (i2 = r = 0; i2 < aL; i2++) {
        if (a[i2] != b[i2]) {
          r = a[i2] > b[i2] ? 1 : -1;
          break;
        }
      }
    }
    return r;
  }
  function subtract(a, b, aL, base2) {
    var i2 = 0;
    for (; aL--; ) {
      a[aL] -= i2;
      i2 = a[aL] < b[aL] ? 1 : 0;
      a[aL] = i2 * base2 + a[aL] - b[aL];
    }
    for (; !a[0] && a.length > 1; ) a.shift();
  }
  return function(x2, y, pr, rm, dp, base2) {
    var cmp, e, i2, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x2.constructor, sign2 = x2.s == y.s ? 1 : -1, xd = x2.d, yd = y.d;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(
        // Return NaN if either NaN, or both Infinity or 0.
        !x2.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
          // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
          xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
        )
      );
    }
    if (base2) {
      logBase = 1;
      e = x2.e - y.e;
    } else {
      base2 = BASE;
      logBase = LOG_BASE;
      e = mathfloor(x2.e / logBase) - mathfloor(y.e / logBase);
    }
    yL = yd.length;
    xL = xd.length;
    q = new Ctor(sign2);
    qd = q.d = [];
    for (i2 = 0; yd[i2] == (xd[i2] || 0); i2++) ;
    if (yd[i2] > (xd[i2] || 0)) e--;
    if (pr == null) {
      sd = pr = Ctor.precision;
      rm = Ctor.rounding;
    } else if (dp) {
      sd = pr + (x2.e - y.e) + 1;
    } else {
      sd = pr;
    }
    if (sd < 0) {
      qd.push(1);
      more = true;
    } else {
      sd = sd / logBase + 2 | 0;
      i2 = 0;
      if (yL == 1) {
        k = 0;
        yd = yd[0];
        sd++;
        for (; (i2 < xL || k) && sd--; i2++) {
          t = k * base2 + (xd[i2] || 0);
          qd[i2] = t / yd | 0;
          k = t % yd | 0;
        }
        more = k || i2 < xL;
      } else {
        k = base2 / (yd[0] + 1) | 0;
        if (k > 1) {
          yd = multiplyInteger(yd, k, base2);
          xd = multiplyInteger(xd, k, base2);
          yL = yd.length;
          xL = xd.length;
        }
        xi = yL;
        rem = xd.slice(0, yL);
        remL = rem.length;
        for (; remL < yL; ) rem[remL++] = 0;
        yz = yd.slice();
        yz.unshift(0);
        yd0 = yd[0];
        if (yd[1] >= base2 / 2) ++yd0;
        do {
          k = 0;
          cmp = compare(yd, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base2 + (rem[1] || 0);
            k = rem0 / yd0 | 0;
            if (k > 1) {
              if (k >= base2) k = base2 - 1;
              prod = multiplyInteger(yd, k, base2);
              prodL = prod.length;
              remL = rem.length;
              cmp = compare(prod, rem, prodL, remL);
              if (cmp == 1) {
                k--;
                subtract(prod, yL < prodL ? yz : yd, prodL, base2);
              }
            } else {
              if (k == 0) cmp = k = 1;
              prod = yd.slice();
            }
            prodL = prod.length;
            if (prodL < remL) prod.unshift(0);
            subtract(rem, prod, remL, base2);
            if (cmp == -1) {
              remL = rem.length;
              cmp = compare(yd, rem, yL, remL);
              if (cmp < 1) {
                k++;
                subtract(rem, yL < remL ? yz : yd, remL, base2);
              }
            }
            remL = rem.length;
          } else if (cmp === 0) {
            k++;
            rem = [0];
          }
          qd[i2++] = k;
          if (cmp && rem[0]) {
            rem[remL++] = xd[xi] || 0;
          } else {
            rem = [xd[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] !== void 0) && sd--);
        more = rem[0] !== void 0;
      }
      if (!qd[0]) qd.shift();
    }
    if (logBase == 1) {
      q.e = e;
      inexact = more;
    } else {
      for (i2 = 1, k = qd[0]; k >= 10; k /= 10) i2++;
      q.e = i2 + e * logBase - 1;
      finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
    }
    return q;
  };
})();
function finalise(x2, sd, rm, isTruncated) {
  var digits, i2, j, k, rd, roundUp, w, xd, xdi, Ctor = x2.constructor;
  out: if (sd != null) {
    xd = x2.d;
    if (!xd) return x2;
    for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
    i2 = sd - digits;
    if (i2 < 0) {
      i2 += LOG_BASE;
      j = sd;
      w = xd[xdi = 0];
      rd = w / mathpow(10, digits - j - 1) % 10 | 0;
    } else {
      xdi = Math.ceil((i2 + 1) / LOG_BASE);
      k = xd.length;
      if (xdi >= k) {
        if (isTruncated) {
          for (; k++ <= xdi; ) xd.push(0);
          w = rd = 0;
          digits = 1;
          i2 %= LOG_BASE;
          j = i2 - LOG_BASE + 1;
        } else {
          break out;
        }
      } else {
        w = k = xd[xdi];
        for (digits = 1; k >= 10; k /= 10) digits++;
        i2 %= LOG_BASE;
        j = i2 - LOG_BASE + digits;
        rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
      }
    }
    isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
    roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x2.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
    (i2 > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x2.s < 0 ? 8 : 7));
    if (sd < 1 || !xd[0]) {
      xd.length = 0;
      if (roundUp) {
        sd -= x2.e + 1;
        xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
        x2.e = -sd || 0;
      } else {
        xd[0] = x2.e = 0;
      }
      return x2;
    }
    if (i2 == 0) {
      xd.length = xdi;
      k = 1;
      xdi--;
    } else {
      xd.length = xdi + 1;
      k = mathpow(10, LOG_BASE - i2);
      xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
    }
    if (roundUp) {
      for (; ; ) {
        if (xdi == 0) {
          for (i2 = 1, j = xd[0]; j >= 10; j /= 10) i2++;
          j = xd[0] += k;
          for (k = 1; j >= 10; j /= 10) k++;
          if (i2 != k) {
            x2.e++;
            if (xd[0] == BASE) xd[0] = 1;
          }
          break;
        } else {
          xd[xdi] += k;
          if (xd[xdi] != BASE) break;
          xd[xdi--] = 0;
          k = 1;
        }
      }
    }
    for (i2 = xd.length; xd[--i2] === 0; ) xd.pop();
  }
  if (external) {
    if (x2.e > Ctor.maxE) {
      x2.d = null;
      x2.e = NaN;
    } else if (x2.e < Ctor.minE) {
      x2.e = 0;
      x2.d = [0];
    }
  }
  return x2;
}
function finiteToString(x2, isExp, sd) {
  if (!x2.isFinite()) return nonFiniteToString(x2);
  var k, e = x2.e, str = digitsToString(x2.d), len = str.length;
  if (isExp) {
    if (sd && (k = sd - len) > 0) {
      str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
    } else if (len > 1) {
      str = str.charAt(0) + "." + str.slice(1);
    }
    str = str + (x2.e < 0 ? "e" : "e+") + x2.e;
  } else if (e < 0) {
    str = "0." + getZeroString(-e - 1) + str;
    if (sd && (k = sd - len) > 0) str += getZeroString(k);
  } else if (e >= len) {
    str += getZeroString(e + 1 - len);
    if (sd && (k = sd - e - 1) > 0) str = str + "." + getZeroString(k);
  } else {
    if ((k = e + 1) < len) str = str.slice(0, k) + "." + str.slice(k);
    if (sd && (k = sd - len) > 0) {
      if (e + 1 === len) str += ".";
      str += getZeroString(k);
    }
  }
  return str;
}
function getBase10Exponent(digits, e) {
  var w = digits[0];
  for (e *= LOG_BASE; w >= 10; w /= 10) e++;
  return e;
}
function getLn10(Ctor, sd, pr) {
  if (sd > LN10_PRECISION) {
    external = true;
    if (pr) Ctor.precision = pr;
    throw Error(precisionLimitExceeded);
  }
  return finalise(new Ctor(LN10), sd, 1, true);
}
function getPi(Ctor, sd, rm) {
  if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
  return finalise(new Ctor(PI), sd, rm, true);
}
function getPrecision(digits) {
  var w = digits.length - 1, len = w * LOG_BASE + 1;
  w = digits[w];
  if (w) {
    for (; w % 10 == 0; w /= 10) len--;
    for (w = digits[0]; w >= 10; w /= 10) len++;
  }
  return len;
}
function getZeroString(k) {
  var zs = "";
  for (; k--; ) zs += "0";
  return zs;
}
function intPow(Ctor, x2, n, pr) {
  var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
  external = false;
  for (; ; ) {
    if (n % 2) {
      r = r.times(x2);
      if (truncate(r.d, k)) isTruncated = true;
    }
    n = mathfloor(n / 2);
    if (n === 0) {
      n = r.d.length - 1;
      if (isTruncated && r.d[n] === 0) ++r.d[n];
      break;
    }
    x2 = x2.times(x2);
    truncate(x2.d, k);
  }
  external = true;
  return r;
}
function isOdd(n) {
  return n.d[n.d.length - 1] & 1;
}
function maxOrMin(Ctor, args, n) {
  var k, y, x2 = new Ctor(args[0]), i2 = 0;
  for (; ++i2 < args.length; ) {
    y = new Ctor(args[i2]);
    if (!y.s) {
      x2 = y;
      break;
    }
    k = x2.cmp(y);
    if (k === n || k === 0 && x2.s === n) {
      x2 = y;
    }
  }
  return x2;
}
function naturalExponential(x2, sd) {
  var denominator, guard, j, pow2, sum2, t, wpr, rep = 0, i2 = 0, k = 0, Ctor = x2.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (!x2.d || !x2.d[0] || x2.e > 17) {
    return new Ctor(x2.d ? !x2.d[0] ? 1 : x2.s < 0 ? 0 : 1 / 0 : x2.s ? x2.s < 0 ? 0 : x2 : 0 / 0);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  t = new Ctor(0.03125);
  while (x2.e > -2) {
    x2 = x2.times(t);
    k += 5;
  }
  guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
  wpr += guard;
  denominator = pow2 = sum2 = new Ctor(1);
  Ctor.precision = wpr;
  for (; ; ) {
    pow2 = finalise(pow2.times(x2), wpr, 1);
    denominator = denominator.times(++i2);
    t = sum2.plus(divide(pow2, denominator, wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      j = k;
      while (j--) sum2 = finalise(sum2.times(sum2), wpr, 1);
      if (sd == null) {
        if (rep < 3 && checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += 10;
          denominator = pow2 = t = new Ctor(1);
          i2 = 0;
          rep++;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
  }
}
function naturalLogarithm(y, sd) {
  var c, c0, denominator, e, numerator, rep, sum2, t, wpr, x1, x2, n = 1, guard = 10, x3 = y, xd = x3.d, Ctor = x3.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (x3.s < 0 || !xd || !xd[0] || !x3.e && xd[0] == 1 && xd.length == 1) {
    return new Ctor(xd && !xd[0] ? -1 / 0 : x3.s != 1 ? NaN : xd ? 0 : x3);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  Ctor.precision = wpr += guard;
  c = digitsToString(xd);
  c0 = c.charAt(0);
  if (Math.abs(e = x3.e) < 15e14) {
    while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
      x3 = x3.times(y);
      c = digitsToString(x3.d);
      c0 = c.charAt(0);
      n++;
    }
    e = x3.e;
    if (c0 > 1) {
      x3 = new Ctor("0." + c);
      e++;
    } else {
      x3 = new Ctor(c0 + "." + c.slice(1));
    }
  } else {
    t = getLn10(Ctor, wpr + 2, pr).times(e + "");
    x3 = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
    Ctor.precision = pr;
    return sd == null ? finalise(x3, pr, rm, external = true) : x3;
  }
  x1 = x3;
  sum2 = numerator = x3 = divide(x3.minus(1), x3.plus(1), wpr, 1);
  x2 = finalise(x3.times(x3), wpr, 1);
  denominator = 3;
  for (; ; ) {
    numerator = finalise(numerator.times(x2), wpr, 1);
    t = sum2.plus(divide(numerator, new Ctor(denominator), wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      sum2 = sum2.times(2);
      if (e !== 0) sum2 = sum2.plus(getLn10(Ctor, wpr + 2, pr).times(e + ""));
      sum2 = divide(sum2, new Ctor(n), wpr, 1);
      if (sd == null) {
        if (checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += guard;
          t = numerator = x3 = divide(x1.minus(1), x1.plus(1), wpr, 1);
          x2 = finalise(x3.times(x3), wpr, 1);
          denominator = rep = 1;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
    denominator += 2;
  }
}
function nonFiniteToString(x2) {
  return String(x2.s * x2.s / 0);
}
function parseDecimal(x2, str) {
  var e, i2, len;
  if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
  if ((i2 = str.search(/e/i)) > 0) {
    if (e < 0) e = i2;
    e += +str.slice(i2 + 1);
    str = str.substring(0, i2);
  } else if (e < 0) {
    e = str.length;
  }
  for (i2 = 0; str.charCodeAt(i2) === 48; i2++) ;
  for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
  str = str.slice(i2, len);
  if (str) {
    len -= i2;
    x2.e = e = e - i2 - 1;
    x2.d = [];
    i2 = (e + 1) % LOG_BASE;
    if (e < 0) i2 += LOG_BASE;
    if (i2 < len) {
      if (i2) x2.d.push(+str.slice(0, i2));
      for (len -= LOG_BASE; i2 < len; ) x2.d.push(+str.slice(i2, i2 += LOG_BASE));
      str = str.slice(i2);
      i2 = LOG_BASE - str.length;
    } else {
      i2 -= len;
    }
    for (; i2--; ) str += "0";
    x2.d.push(+str);
    if (external) {
      if (x2.e > x2.constructor.maxE) {
        x2.d = null;
        x2.e = NaN;
      } else if (x2.e < x2.constructor.minE) {
        x2.e = 0;
        x2.d = [0];
      }
    }
  } else {
    x2.e = 0;
    x2.d = [0];
  }
  return x2;
}
function parseOther(x2, str) {
  var base2, Ctor, divisor, i2, isFloat, len, p, xd, xe;
  if (str.indexOf("_") > -1) {
    str = str.replace(/(\d)_(?=\d)/g, "$1");
    if (isDecimal.test(str)) return parseDecimal(x2, str);
  } else if (str === "Infinity" || str === "NaN") {
    if (!+str) x2.s = NaN;
    x2.e = NaN;
    x2.d = null;
    return x2;
  }
  if (isHex.test(str)) {
    base2 = 16;
    str = str.toLowerCase();
  } else if (isBinary.test(str)) {
    base2 = 2;
  } else if (isOctal.test(str)) {
    base2 = 8;
  } else {
    throw Error(invalidArgument + str);
  }
  i2 = str.search(/p/i);
  if (i2 > 0) {
    p = +str.slice(i2 + 1);
    str = str.substring(2, i2);
  } else {
    str = str.slice(2);
  }
  i2 = str.indexOf(".");
  isFloat = i2 >= 0;
  Ctor = x2.constructor;
  if (isFloat) {
    str = str.replace(".", "");
    len = str.length;
    i2 = len - i2;
    divisor = intPow(Ctor, new Ctor(base2), i2, i2 * 2);
  }
  xd = convertBase(str, base2, BASE);
  xe = xd.length - 1;
  for (i2 = xe; xd[i2] === 0; --i2) xd.pop();
  if (i2 < 0) return new Ctor(x2.s * 0);
  x2.e = getBase10Exponent(xd, xe);
  x2.d = xd;
  external = false;
  if (isFloat) x2 = divide(x2, divisor, len * 4);
  if (p) x2 = x2.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
  external = true;
  return x2;
}
function sine(Ctor, x2) {
  var k, len = x2.d.length;
  if (len < 3) {
    return x2.isZero() ? x2 : taylorSeries(Ctor, 2, x2, x2);
  }
  k = 1.4 * Math.sqrt(len);
  k = k > 16 ? 16 : k | 0;
  x2 = x2.times(1 / tinyPow(5, k));
  x2 = taylorSeries(Ctor, 2, x2, x2);
  var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
  for (; k--; ) {
    sin2_x = x2.times(x2);
    x2 = x2.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
  }
  return x2;
}
function taylorSeries(Ctor, n, x2, y, isHyperbolic) {
  var j, t, u, x22, i2 = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
  external = false;
  x22 = x2.times(x2);
  u = new Ctor(y);
  for (; ; ) {
    t = divide(u.times(x22), new Ctor(n++ * n++), pr, 1);
    u = isHyperbolic ? y.plus(t) : y.minus(t);
    y = divide(t.times(x22), new Ctor(n++ * n++), pr, 1);
    t = u.plus(y);
    if (t.d[k] !== void 0) {
      for (j = k; t.d[j] === u.d[j] && j--; ) ;
      if (j == -1) break;
    }
    j = u;
    u = y;
    y = t;
    t = j;
    i2++;
  }
  external = true;
  t.d.length = k + 1;
  return t;
}
function tinyPow(b, e) {
  var n = b;
  while (--e) n *= b;
  return n;
}
function toLessThanHalfPi(Ctor, x2) {
  var t, isNeg = x2.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
  x2 = x2.abs();
  if (x2.lte(halfPi)) {
    quadrant = isNeg ? 4 : 1;
    return x2;
  }
  t = x2.divToInt(pi);
  if (t.isZero()) {
    quadrant = isNeg ? 3 : 2;
  } else {
    x2 = x2.minus(t.times(pi));
    if (x2.lte(halfPi)) {
      quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
      return x2;
    }
    quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
  }
  return x2.minus(pi).abs();
}
function toStringBinary(x2, baseOut, sd, rm) {
  var base2, e, i2, k, len, roundUp, str, xd, y, Ctor = x2.constructor, isExp = sd !== void 0;
  if (isExp) {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  } else {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  }
  if (!x2.isFinite()) {
    str = nonFiniteToString(x2);
  } else {
    str = finiteToString(x2);
    i2 = str.indexOf(".");
    if (isExp) {
      base2 = 2;
      if (baseOut == 16) {
        sd = sd * 4 - 3;
      } else if (baseOut == 8) {
        sd = sd * 3 - 2;
      }
    } else {
      base2 = baseOut;
    }
    if (i2 >= 0) {
      str = str.replace(".", "");
      y = new Ctor(1);
      y.e = str.length - i2;
      y.d = convertBase(finiteToString(y), 10, base2);
      y.e = y.d.length;
    }
    xd = convertBase(str, 10, base2);
    e = len = xd.length;
    for (; xd[--len] == 0; ) xd.pop();
    if (!xd[0]) {
      str = isExp ? "0p+0" : "0";
    } else {
      if (i2 < 0) {
        e--;
      } else {
        x2 = new Ctor(x2);
        x2.d = xd;
        x2.e = e;
        x2 = divide(x2, y, sd, rm, 0, base2);
        xd = x2.d;
        e = x2.e;
        roundUp = inexact;
      }
      i2 = xd[sd];
      k = base2 / 2;
      roundUp = roundUp || xd[sd + 1] !== void 0;
      roundUp = rm < 4 ? (i2 !== void 0 || roundUp) && (rm === 0 || rm === (x2.s < 0 ? 3 : 2)) : i2 > k || i2 === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x2.s < 0 ? 8 : 7));
      xd.length = sd;
      if (roundUp) {
        for (; ++xd[--sd] > base2 - 1; ) {
          xd[sd] = 0;
          if (!sd) {
            ++e;
            xd.unshift(1);
          }
        }
      }
      for (len = xd.length; !xd[len - 1]; --len) ;
      for (i2 = 0, str = ""; i2 < len; i2++) str += NUMERALS.charAt(xd[i2]);
      if (isExp) {
        if (len > 1) {
          if (baseOut == 16 || baseOut == 8) {
            i2 = baseOut == 16 ? 4 : 3;
            for (--len; len % i2; len++) str += "0";
            xd = convertBase(str, base2, baseOut);
            for (len = xd.length; !xd[len - 1]; --len) ;
            for (i2 = 1, str = "1."; i2 < len; i2++) str += NUMERALS.charAt(xd[i2]);
          } else {
            str = str.charAt(0) + "." + str.slice(1);
          }
        }
        str = str + (e < 0 ? "p" : "p+") + e;
      } else if (e < 0) {
        for (; ++e; ) str = "0" + str;
        str = "0." + str;
      } else {
        if (++e > len) for (e -= len; e--; ) str += "0";
        else if (e < len) str = str.slice(0, e) + "." + str.slice(e);
      }
    }
    str = (baseOut == 16 ? "0x" : baseOut == 2 ? "0b" : baseOut == 8 ? "0o" : "") + str;
  }
  return x2.s < 0 ? "-" + str : str;
}
function truncate(arr, len) {
  if (arr.length > len) {
    arr.length = len;
    return true;
  }
}
function abs(x2) {
  return new this(x2).abs();
}
function acos(x2) {
  return new this(x2).acos();
}
function acosh(x2) {
  return new this(x2).acosh();
}
function add(x2, y) {
  return new this(x2).plus(y);
}
function asin(x2) {
  return new this(x2).asin();
}
function asinh(x2) {
  return new this(x2).asinh();
}
function atan(x2) {
  return new this(x2).atan();
}
function atanh(x2) {
  return new this(x2).atanh();
}
function atan2(y, x2) {
  y = new this(y);
  x2 = new this(x2);
  var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
  if (!y.s || !x2.s) {
    r = new this(NaN);
  } else if (!y.d && !x2.d) {
    r = getPi(this, wpr, 1).times(x2.s > 0 ? 0.25 : 0.75);
    r.s = y.s;
  } else if (!x2.d || y.isZero()) {
    r = x2.s < 0 ? getPi(this, pr, rm) : new this(0);
    r.s = y.s;
  } else if (!y.d || x2.isZero()) {
    r = getPi(this, wpr, 1).times(0.5);
    r.s = y.s;
  } else if (x2.s < 0) {
    this.precision = wpr;
    this.rounding = 1;
    r = this.atan(divide(y, x2, wpr, 1));
    x2 = getPi(this, wpr, 1);
    this.precision = pr;
    this.rounding = rm;
    r = y.s < 0 ? r.minus(x2) : r.plus(x2);
  } else {
    r = this.atan(divide(y, x2, wpr, 1));
  }
  return r;
}
function cbrt(x2) {
  return new this(x2).cbrt();
}
function ceil(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, 2);
}
function clamp(x2, min2, max2) {
  return new this(x2).clamp(min2, max2);
}
function config(obj) {
  if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
  var i2, p, v, useDefaults = obj.defaults === true, ps = [
    "precision",
    1,
    MAX_DIGITS,
    "rounding",
    0,
    8,
    "toExpNeg",
    -EXP_LIMIT,
    0,
    "toExpPos",
    0,
    EXP_LIMIT,
    "maxE",
    0,
    EXP_LIMIT,
    "minE",
    -EXP_LIMIT,
    0,
    "modulo",
    0,
    9
  ];
  for (i2 = 0; i2 < ps.length; i2 += 3) {
    if (p = ps[i2], useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (mathfloor(v) === v && v >= ps[i2 + 1] && v <= ps[i2 + 2]) this[p] = v;
      else throw Error(invalidArgument + p + ": " + v);
    }
  }
  if (p = "crypto", useDefaults) this[p] = DEFAULTS[p];
  if ((v = obj[p]) !== void 0) {
    if (v === true || v === false || v === 0 || v === 1) {
      if (v) {
        if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
          this[p] = true;
        } else {
          throw Error(cryptoUnavailable);
        }
      } else {
        this[p] = false;
      }
    } else {
      throw Error(invalidArgument + p + ": " + v);
    }
  }
  return this;
}
function cos(x2) {
  return new this(x2).cos();
}
function cosh(x2) {
  return new this(x2).cosh();
}
function clone(obj) {
  var i2, p, ps;
  function Decimal2(v) {
    var e, i3, t, x2 = this;
    if (!(x2 instanceof Decimal2)) return new Decimal2(v);
    x2.constructor = Decimal2;
    if (isDecimalInstance(v)) {
      x2.s = v.s;
      if (external) {
        if (!v.d || v.e > Decimal2.maxE) {
          x2.e = NaN;
          x2.d = null;
        } else if (v.e < Decimal2.minE) {
          x2.e = 0;
          x2.d = [0];
        } else {
          x2.e = v.e;
          x2.d = v.d.slice();
        }
      } else {
        x2.e = v.e;
        x2.d = v.d ? v.d.slice() : v.d;
      }
      return;
    }
    t = typeof v;
    if (t === "number") {
      if (v === 0) {
        x2.s = 1 / v < 0 ? -1 : 1;
        x2.e = 0;
        x2.d = [0];
        return;
      }
      if (v < 0) {
        v = -v;
        x2.s = -1;
      } else {
        x2.s = 1;
      }
      if (v === ~~v && v < 1e7) {
        for (e = 0, i3 = v; i3 >= 10; i3 /= 10) e++;
        if (external) {
          if (e > Decimal2.maxE) {
            x2.e = NaN;
            x2.d = null;
          } else if (e < Decimal2.minE) {
            x2.e = 0;
            x2.d = [0];
          } else {
            x2.e = e;
            x2.d = [v];
          }
        } else {
          x2.e = e;
          x2.d = [v];
        }
        return;
      }
      if (v * 0 !== 0) {
        if (!v) x2.s = NaN;
        x2.e = NaN;
        x2.d = null;
        return;
      }
      return parseDecimal(x2, v.toString());
    }
    if (t === "string") {
      if ((i3 = v.charCodeAt(0)) === 45) {
        v = v.slice(1);
        x2.s = -1;
      } else {
        if (i3 === 43) v = v.slice(1);
        x2.s = 1;
      }
      return isDecimal.test(v) ? parseDecimal(x2, v) : parseOther(x2, v);
    }
    if (t === "bigint") {
      if (v < 0) {
        v = -v;
        x2.s = -1;
      } else {
        x2.s = 1;
      }
      return parseDecimal(x2, v.toString());
    }
    throw Error(invalidArgument + v);
  }
  Decimal2.prototype = P;
  Decimal2.ROUND_UP = 0;
  Decimal2.ROUND_DOWN = 1;
  Decimal2.ROUND_CEIL = 2;
  Decimal2.ROUND_FLOOR = 3;
  Decimal2.ROUND_HALF_UP = 4;
  Decimal2.ROUND_HALF_DOWN = 5;
  Decimal2.ROUND_HALF_EVEN = 6;
  Decimal2.ROUND_HALF_CEIL = 7;
  Decimal2.ROUND_HALF_FLOOR = 8;
  Decimal2.EUCLID = 9;
  Decimal2.config = Decimal2.set = config;
  Decimal2.clone = clone;
  Decimal2.isDecimal = isDecimalInstance;
  Decimal2.abs = abs;
  Decimal2.acos = acos;
  Decimal2.acosh = acosh;
  Decimal2.add = add;
  Decimal2.asin = asin;
  Decimal2.asinh = asinh;
  Decimal2.atan = atan;
  Decimal2.atanh = atanh;
  Decimal2.atan2 = atan2;
  Decimal2.cbrt = cbrt;
  Decimal2.ceil = ceil;
  Decimal2.clamp = clamp;
  Decimal2.cos = cos;
  Decimal2.cosh = cosh;
  Decimal2.div = div;
  Decimal2.exp = exp;
  Decimal2.floor = floor;
  Decimal2.hypot = hypot;
  Decimal2.ln = ln;
  Decimal2.log = log;
  Decimal2.log10 = log10;
  Decimal2.log2 = log2;
  Decimal2.max = max;
  Decimal2.min = min;
  Decimal2.mod = mod;
  Decimal2.mul = mul;
  Decimal2.pow = pow;
  Decimal2.random = random;
  Decimal2.round = round;
  Decimal2.sign = sign;
  Decimal2.sin = sin;
  Decimal2.sinh = sinh;
  Decimal2.sqrt = sqrt;
  Decimal2.sub = sub;
  Decimal2.sum = sum;
  Decimal2.tan = tan;
  Decimal2.tanh = tanh;
  Decimal2.trunc = trunc;
  if (obj === void 0) obj = {};
  if (obj) {
    if (obj.defaults !== true) {
      ps = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
      for (i2 = 0; i2 < ps.length; ) if (!obj.hasOwnProperty(p = ps[i2++])) obj[p] = this[p];
    }
  }
  Decimal2.config(obj);
  return Decimal2;
}
function div(x2, y) {
  return new this(x2).div(y);
}
function exp(x2) {
  return new this(x2).exp();
}
function floor(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, 3);
}
function hypot() {
  var i2, n, t = new this(0);
  external = false;
  for (i2 = 0; i2 < arguments.length; ) {
    n = new this(arguments[i2++]);
    if (!n.d) {
      if (n.s) {
        external = true;
        return new this(1 / 0);
      }
      t = n;
    } else if (t.d) {
      t = t.plus(n.times(n));
    }
  }
  external = true;
  return t.sqrt();
}
function isDecimalInstance(obj) {
  return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
}
function ln(x2) {
  return new this(x2).ln();
}
function log(x2, y) {
  return new this(x2).log(y);
}
function log2(x2) {
  return new this(x2).log(2);
}
function log10(x2) {
  return new this(x2).log(10);
}
function max() {
  return maxOrMin(this, arguments, -1);
}
function min() {
  return maxOrMin(this, arguments, 1);
}
function mod(x2, y) {
  return new this(x2).mod(y);
}
function mul(x2, y) {
  return new this(x2).mul(y);
}
function pow(x2, y) {
  return new this(x2).pow(y);
}
function random(sd) {
  var d, e, k, n, i2 = 0, r = new this(1), rd = [];
  if (sd === void 0) sd = this.precision;
  else checkInt32(sd, 1, MAX_DIGITS);
  k = Math.ceil(sd / LOG_BASE);
  if (!this.crypto) {
    for (; i2 < k; ) rd[i2++] = Math.random() * 1e7 | 0;
  } else if (crypto.getRandomValues) {
    d = crypto.getRandomValues(new Uint32Array(k));
    for (; i2 < k; ) {
      n = d[i2];
      if (n >= 429e7) {
        d[i2] = crypto.getRandomValues(new Uint32Array(1))[0];
      } else {
        rd[i2++] = n % 1e7;
      }
    }
  } else if (crypto.randomBytes) {
    d = crypto.randomBytes(k *= 4);
    for (; i2 < k; ) {
      n = d[i2] + (d[i2 + 1] << 8) + (d[i2 + 2] << 16) + ((d[i2 + 3] & 127) << 24);
      if (n >= 214e7) {
        crypto.randomBytes(4).copy(d, i2);
      } else {
        rd.push(n % 1e7);
        i2 += 4;
      }
    }
    i2 = k / 4;
  } else {
    throw Error(cryptoUnavailable);
  }
  k = rd[--i2];
  sd %= LOG_BASE;
  if (k && sd) {
    n = mathpow(10, LOG_BASE - sd);
    rd[i2] = (k / n | 0) * n;
  }
  for (; rd[i2] === 0; i2--) rd.pop();
  if (i2 < 0) {
    e = 0;
    rd = [0];
  } else {
    e = -1;
    for (; rd[0] === 0; e -= LOG_BASE) rd.shift();
    for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;
    if (k < LOG_BASE) e -= LOG_BASE - k;
  }
  r.e = e;
  r.d = rd;
  return r;
}
function round(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, this.rounding);
}
function sign(x2) {
  x2 = new this(x2);
  return x2.d ? x2.d[0] ? x2.s : 0 * x2.s : x2.s || NaN;
}
function sin(x2) {
  return new this(x2).sin();
}
function sinh(x2) {
  return new this(x2).sinh();
}
function sqrt(x2) {
  return new this(x2).sqrt();
}
function sub(x2, y) {
  return new this(x2).sub(y);
}
function sum() {
  var i2 = 0, args = arguments, x2 = new this(args[i2]);
  external = false;
  for (; x2.s && ++i2 < args.length; ) x2 = x2.plus(args[i2]);
  external = true;
  return finalise(x2, this.precision, this.rounding);
}
function tan(x2) {
  return new this(x2).tan();
}
function tanh(x2) {
  return new this(x2).tanh();
}
function trunc(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, 1);
}
P[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = P.toString;
P[Symbol.toStringTag] = "Decimal";
var Decimal = P.constructor = clone(DEFAULTS);
LN10 = new Decimal(LN10);
PI = new Decimal(PI);
var decimal_default = Decimal;

// src/core/fields/dec.ts
var DecField = class {
  name = "decimal(50)";
  zero;
  one;
  /** pi, to fifty digits */
  pi;
  precision;
  constructor(precision = 50) {
    this.precision = precision;
    decimal_default.set({ precision, rounding: decimal_default.ROUND_HALF_EVEN });
    this.zero = new decimal_default(0);
    this.one = new decimal_default(1);
    this.pi = new decimal_default(
      "3.14159265358979323846264338327950288419716939937510582097494459231"
    );
  }
  add(a, b) {
    return a.plus(b);
  }
  sub(a, b) {
    return a.minus(b);
  }
  mul(a, b) {
    return a.times(b);
  }
  div(a, b) {
    return a.div(b);
  }
  neg(a) {
    return a.negated();
  }
  inv(a) {
    return a.isZero() ? new decimal_default(Infinity) : new decimal_default(1).div(a);
  }
  fromRational(n, d) {
    return new decimal_default(n).div(d);
  }
  isZero(a) {
    return a.isZero();
  }
  eq(a, b) {
    return a.eq(b);
  }
  cmp(a, b) {
    return a.comparedTo(b);
  }
  abs(a) {
    return a.abs();
  }
  sqrt(a) {
    return a.sqrt();
  }
  exp(a) {
    return a.exp();
  }
  log(a) {
    return a.ln();
  }
  sin(a) {
    return a.sin();
  }
  cos(a) {
    return a.cos();
  }
  tanh(a) {
    return a.tanh();
  }
  toNumber(a) {
    return a.toNumber();
  }
  random(rng) {
    return new decimal_default(rng() * 2 - 1);
  }
  normal(rng) {
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return new decimal_default(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
};

// src/core/fields/gfp.ts
var GFpField = class {
  name = "GF(p)";
  zero = 0;
  one = 1;
  /** pi is not in a finite field, so this is a rational approximation of it */
  pi;
  p;
  constructor(p) {
    this.p = p;
    this.pi = this.mul(314159265, this.inv(1e8));
  }
  /** Reduce to the canonical representative in [0, p). */
  mod(a) {
    const r = a % this.p;
    return r < 0 ? r + this.p : r;
  }
  add(a, b) {
    const r = a + b;
    return r >= this.p ? r - this.p : r;
  }
  sub(a, b) {
    const r = a - b;
    return r < 0 ? r + this.p : r;
  }
  neg(a) {
    return a === 0 ? 0 : this.p - a;
  }
  mul(a, b) {
    const p = this.p;
    const hi = b >>> 16 & 65535;
    const lo = b & 65535;
    const t = a * hi % p * 65536 + a * lo;
    return this.mod(t);
  }
  inv(a) {
    if (a === 0) throw new Error("inverse of zero in GF(p)");
    let result = 1;
    let base2 = a;
    let e = this.p - 2;
    while (e > 0) {
      if (e & 1) result = this.mul(result, base2);
      base2 = this.mul(base2, base2);
      e = Math.floor(e / 2);
    }
    return result;
  }
  div(a, b) {
    return this.mul(a, this.inv(b));
  }
  fromRational(n, d) {
    const nn = this.mod(n);
    if (d === 1) return nn;
    const dd = this.mod(d);
    if (dd === 0) throw new Error("rational with denominator 0 mod p");
    return this.mul(nn, this.inv(dd));
  }
  isZero(a) {
    return a === 0;
  }
  eq(a, b) {
    return a === b;
  }
  cmp(a, b) {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  abs(_a2) {
    return this.transcendental("abs");
  }
  transcendental(op) {
    throw new Error(`${op} is not available in GF(p); this step needs numeric mode`);
  }
  sqrt(_a2) {
    return this.transcendental("sqrt");
  }
  exp(_a2) {
    return this.transcendental("exp");
  }
  log(_a2) {
    return this.transcendental("log");
  }
  sin(_a2) {
    return this.transcendental("sin");
  }
  cos(_a2) {
    return this.transcendental("cos");
  }
  tanh(_a2) {
    return this.transcendental("tanh");
  }
  toNumber(a) {
    return a;
  }
  random(rng) {
    const hi = Math.floor(rng() * 65536) % 65536;
    const lo = Math.floor(rng() * 65536) % 65536;
    return (hi * 65536 + lo) % this.p;
  }
  normal(_rng) {
    throw new Error("GF(p) has no normal distribution");
  }
};
var P1 = 2147483647;
var P2 = 2147483629;

// src/core/linalg.ts
var DomainError = class extends Error {
};
function mat(r, c, fill) {
  const d = new Array(r * c);
  for (let i2 = 0; i2 < r; i2++) for (let j = 0; j < c; j++) d[i2 * c + j] = fill(i2, j);
  return { r, c, d };
}
function zeros(r, c, z2) {
  return mat(r, c, () => z2);
}
function identity(n, one, zero) {
  return mat(n, n, (i2, j) => i2 === j ? one : zero);
}
function matAdd(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error(`shape mismatch in add: ${a.r}x${a.c} vs ${b.r}x${b.c}`);
  const d = new Array(a.r * a.c);
  for (let i2 = 0; i2 < d.length; i2++) d[i2] = f.add(a.d[i2], b.d[i2]);
  return { r: a.r, c: a.c, d };
}
function matSub(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error(`shape mismatch in sub: ${a.r}x${a.c} vs ${b.r}x${b.c}`);
  const d = new Array(a.r * a.c);
  for (let i2 = 0; i2 < d.length; i2++) d[i2] = f.sub(a.d[i2], b.d[i2]);
  return { r: a.r, c: a.c, d };
}
function matScale(f, s, a) {
  const d = new Array(a.r * a.c);
  for (let i2 = 0; i2 < d.length; i2++) d[i2] = f.mul(s, a.d[i2]);
  return { r: a.r, c: a.c, d };
}
function matMul(f, a, b) {
  if (a.c !== b.r) throw new Error(`shape mismatch in mul: ${a.r}x${a.c} times ${b.r}x${b.c}`);
  const out = new Array(a.r * b.c).fill(f.zero);
  for (let i2 = 0; i2 < a.r; i2++) {
    for (let k = 0; k < a.c; k++) {
      const aik = a.d[i2 * a.c + k];
      if (f.isZero(aik)) continue;
      for (let j = 0; j < b.c; j++) {
        out[i2 * b.c + j] = f.add(out[i2 * b.c + j], f.mul(aik, b.d[k * b.c + j]));
      }
    }
  }
  return { r: a.r, c: b.c, d: out };
}
function transpose(a) {
  const d = new Array(a.r * a.c);
  for (let i2 = 0; i2 < a.r; i2++) for (let j = 0; j < a.c; j++) d[j * a.r + i2] = a.d[i2 * a.c + j];
  return { r: a.c, c: a.r, d };
}
function trace(f, a) {
  if (a.r !== a.c) throw new Error("trace of a non square matrix");
  let s = f.zero;
  for (let i2 = 0; i2 < a.r; i2++) s = f.add(s, a.d[i2 * a.c + i2]);
  return s;
}
function matTrace(f, a) {
  return trace(f, a);
}
function matInv(f, a) {
  const n = a.r;
  if (n !== a.c) throw new DomainError("inverse of a non square matrix");
  const m = mat(n, 2 * n, (i2, j) => j < n ? a.d[i2 * n + j] : i2 === j - n ? f.one : f.zero);
  for (let c = 0; c < n; c++) {
    let pivot = -1;
    for (let r = c; r < n; r++) {
      if (!f.isZero(m.d[r * 2 * n + c])) {
        pivot = r;
        break;
      }
    }
    if (pivot < 0) throw new DomainError("singular matrix");
    if (pivot !== c) {
      for (let j = 0; j < 2 * n; j++) {
        const tmp = m.d[c * 2 * n + j];
        m.d[c * 2 * n + j] = m.d[pivot * 2 * n + j];
        m.d[pivot * 2 * n + j] = tmp;
      }
    }
    const piv = m.d[c * 2 * n + c];
    const inv = f.inv(piv);
    for (let j = 0; j < 2 * n; j++) m.d[c * 2 * n + j] = f.mul(m.d[c * 2 * n + j], inv);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const factor = m.d[r * 2 * n + c];
      if (f.isZero(factor)) continue;
      for (let j = 0; j < 2 * n; j++) {
        m.d[r * 2 * n + j] = f.sub(m.d[r * 2 * n + j], f.mul(factor, m.d[c * 2 * n + j]));
      }
    }
  }
  return mat(n, n, (i2, j) => m.d[i2 * 2 * n + n + j]);
}
function matDet(f, a) {
  const n = a.r;
  if (n !== a.c) throw new DomainError("determinant of a non square matrix");
  const m = a.d.slice();
  let det = f.one;
  for (let c = 0; c < n; c++) {
    let pivot = -1;
    let best = null;
    for (let r = c; r < n; r++) {
      const v = m[r * n + c];
      if (f.isZero(v)) continue;
      if (pivot === -1) {
        pivot = r;
        try {
          best = f.abs(v);
        } catch {
          best = null;
        }
        continue;
      }
      if (best === null) continue;
      try {
        const mag = f.abs(v);
        if (f.cmp(mag, best) > 0) {
          best = mag;
          pivot = r;
        }
      } catch {
        break;
      }
    }
    if (pivot === -1) return f.zero;
    if (pivot !== c) {
      for (let j = 0; j < n; j++) {
        const tmp = m[c * n + j];
        m[c * n + j] = m[pivot * n + j];
        m[pivot * n + j] = tmp;
      }
      det = f.neg(det);
    }
    det = f.mul(det, m[c * n + c]);
    for (let r = c + 1; r < n; r++) {
      const factor = f.div(m[r * n + c], m[c * n + c]);
      for (let j = c; j < n; j++) {
        m[r * n + j] = f.sub(m[r * n + j], f.mul(factor, m[c * n + j]));
      }
    }
  }
  return det;
}
function kron(f, a, b) {
  const r = a.r * b.r;
  const c = a.c * b.c;
  const d = new Array(r * c);
  for (let i2 = 0; i2 < a.r; i2++) {
    for (let j = 0; j < a.c; j++) {
      for (let p = 0; p < b.r; p++) {
        for (let q = 0; q < b.c; q++) {
          d[(i2 * b.r + p) * c + (j * b.c + q)] = f.mul(a.d[i2 * a.c + j], b.d[p * b.c + q]);
        }
      }
    }
  }
  return { r, c, d };
}
function hadamard(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error("shape mismatch in hadamard");
  const d = new Array(a.r * a.c);
  for (let i2 = 0; i2 < d.length; i2++) d[i2] = f.mul(a.d[i2], b.d[i2]);
  return { r: a.r, c: a.c, d };
}
function inner(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error("shape mismatch in inner");
  let s = f.zero;
  for (let i2 = 0; i2 < a.d.length; i2++) s = f.add(s, f.mul(a.d[i2], b.d[i2]));
  return s;
}
function norm2(f, a) {
  return inner(f, a, a);
}
function vec(a) {
  return { r: a.r * a.c, c: 1, d: a.d.slice() };
}
function diag(f, v) {
  const n = v.r * v.c;
  const d = new Array(n * n).fill(f.zero);
  for (let i2 = 0; i2 < n; i2++) d[i2 * n + i2] = v.d[i2];
  return { r: n, c: n, d };
}
function block(rows) {
  const r = rows.reduce((s, row) => s + row[0].r, 0);
  const c = rows[0].reduce((s, blk) => s + blk.c, 0);
  for (const row of rows) {
    const h = row[0].r;
    for (const blk of row) {
      if (blk.r !== h) throw new DomainError("the blocks of one row do not agree in height");
    }
    const width = row.reduce((s, blk) => s + blk.c, 0);
    if (width !== c) throw new DomainError("the blocks of one row do not agree in width");
  }
  const d = new Array(r * c);
  let oi = 0;
  for (const row of rows) {
    let oj = 0;
    for (const blk of row) {
      for (let bi = 0; bi < blk.r; bi++) {
        for (let bj = 0; bj < blk.c; bj++) {
          d[(oi + bi) * c + (oj + bj)] = blk.d[bi * blk.c + bj];
        }
      }
      oj += blk.c;
    }
    oi += row[0].r;
  }
  return { r, c, d };
}
function matPow(f, a, k) {
  if (k === 0) return identity(a.r, f.one, f.zero);
  let result = identity(a.r, f.one, f.zero);
  let base2 = a;
  let e = k;
  while (e > 0) {
    if (e & 1) result = matMul(f, result, base2);
    e >>= 1;
    if (e > 0) base2 = matMul(f, base2, base2);
  }
  return result;
}
function matSqrtm(f, a) {
  if (a.r !== a.c) throw new DomainError("square root of a non square matrix");
  const n = a.r;
  if (n === 0) return a;
  let x2 = a;
  let y = identity(n, f.one, f.zero);
  const half = f.fromRational(1, 2);
  let diff = Infinity;
  let scale = 0;
  let prevRatio = Infinity;
  let stalled = 0;
  for (let i2 = 0; i2 < 120; i2++) {
    const xi = matInv(f, x2);
    const yi = matInv(f, y);
    const nx = matScale(f, half, matAdd(f, x2, yi));
    const ny = matScale(f, half, matAdd(f, y, xi));
    diff = 0;
    scale = 0;
    for (let k = 0; k < n * n; k++) {
      const step = f.toNumber(f.abs(f.sub(nx.d[k], x2.d[k])));
      diff = Math.max(diff, step);
      scale = Math.max(scale, Math.abs(f.toNumber(nx.d[k])));
    }
    x2 = nx;
    y = ny;
    const ratio = diff / Math.max(scale, 1);
    if (ratio <= 1e-42) return x2;
    if (ratio <= 1e-12 && ratio >= 0.5 * prevRatio) {
      stalled += 1;
      if (stalled >= 2) return x2;
    } else {
      stalled = 0;
    }
    prevRatio = ratio;
  }
  if (diff / Math.max(scale, 1) <= 1e-36) return x2;
  throw new DomainError("the matrix square root did not converge");
}

// src/core/fields/dual.ts
var DualField = class {
  name;
  zero;
  one;
  pi;
  base;
  constructor(base2) {
    this.base = base2;
    this.name = `dual(${base2.name})`;
    this.zero = { v: base2.zero, t: base2.zero };
    this.one = { v: base2.one, t: base2.zero };
    this.pi = { v: base2.pi, t: base2.zero };
  }
  add(a, b) {
    return { v: this.base.add(a.v, b.v), t: this.base.add(a.t, b.t) };
  }
  sub(a, b) {
    return { v: this.base.sub(a.v, b.v), t: this.base.sub(a.t, b.t) };
  }
  mul(a, b) {
    return {
      v: this.base.mul(a.v, b.v),
      t: this.base.add(this.base.mul(a.t, b.v), this.base.mul(a.v, b.t))
    };
  }
  div(a, b) {
    const inv = this.base.inv(b.v);
    return {
      v: this.base.mul(a.v, inv),
      t: this.base.mul(this.base.sub(a.t, this.base.mul(a.v, this.base.div(b.t, b.v))), inv)
    };
  }
  neg(a) {
    return { v: this.base.neg(a.v), t: this.base.neg(a.t) };
  }
  inv(a) {
    const inv = this.base.inv(a.v);
    return {
      v: inv,
      t: this.base.mul(this.base.neg(a.t), this.base.mul(inv, inv))
    };
  }
  fromRational(n, d) {
    return { v: this.base.fromRational(n, d), t: this.base.zero };
  }
  isZero(a) {
    return this.base.isZero(a.v) && this.base.isZero(a.t);
  }
  eq(a, b) {
    return this.base.eq(a.v, b.v) && this.base.eq(a.t, b.t);
  }
  cmp(a, b) {
    return this.base.cmp(a.v, b.v);
  }
  abs(a) {
    return { v: this.base.abs(a.v), t: this.base.mul(a.t, this.base.cmp(a.v, this.base.zero) < 0 ? this.base.neg(this.base.one) : this.base.one) };
  }
  sqrt(a) {
    const s = this.base.sqrt(a.v);
    return { v: s, t: this.base.div(a.t, this.base.mul(this.base.one, s).mul(2)) };
  }
  exp(a) {
    const e = this.base.exp(a.v);
    return { v: e, t: this.base.mul(a.t, e) };
  }
  log(a) {
    return { v: this.base.log(a.v), t: this.base.div(a.t, a.v) };
  }
  sin(a) {
    return { v: this.base.sin(a.v), t: this.base.mul(a.t, this.base.cos(a.v)) };
  }
  cos(a) {
    return { v: this.base.cos(a.v), t: this.base.mul(a.t, this.base.neg(this.base.sin(a.v))) };
  }
  tanh(a) {
    const t = this.base.tanh(a.v);
    const d = this.base.sub(this.base.one, this.base.mul(t, t));
    return { v: t, t: this.base.div(a.t, d) };
  }
  toNumber(a) {
    return this.base.toNumber(a.v);
  }
  random(rng) {
    return { v: this.base.random(rng), t: this.base.zero };
  }
  normal(rng) {
    return { v: this.base.normal(rng), t: this.base.zero };
  }
};

// src/core/fields/hyperdual.ts
var HyperDualField = class {
  name;
  zero;
  one;
  pi;
  base;
  constructor(base2) {
    this.base = base2;
    this.name = `hyperdual(${base2.name})`;
    this.zero = { v: base2.zero, e1: base2.zero, e2: base2.zero, e12: base2.zero };
    this.one = { v: base2.one, e1: base2.zero, e2: base2.zero, e12: base2.zero };
    this.pi = { v: base2.pi, e1: base2.zero, e2: base2.zero, e12: base2.zero };
  }
  add(a, b) {
    return {
      v: this.base.add(a.v, b.v),
      e1: this.base.add(a.e1, b.e1),
      e2: this.base.add(a.e2, b.e2),
      e12: this.base.add(a.e12, b.e12)
    };
  }
  sub(a, b) {
    return {
      v: this.base.sub(a.v, b.v),
      e1: this.base.sub(a.e1, b.e1),
      e2: this.base.sub(a.e2, b.e2),
      e12: this.base.sub(a.e12, b.e12)
    };
  }
  mul(a, b) {
    return {
      v: this.base.mul(a.v, b.v),
      e1: this.base.add(this.base.mul(a.e1, b.v), this.base.mul(a.v, b.e1)),
      e2: this.base.add(this.base.mul(a.e2, b.v), this.base.mul(a.v, b.e2)),
      e12: this.base.add(
        this.base.add(this.base.mul(a.e12, b.v), this.base.mul(a.v, b.e12)),
        this.base.add(this.base.mul(a.e1, b.e2), this.base.mul(a.e2, b.e1))
      )
    };
  }
  div(a, b) {
    const inv = this.base.inv(b.v);
    const q = this.base.mul(a.v, inv);
    return {
      v: q,
      e1: this.base.mul(this.base.sub(a.e1, this.base.mul(q, b.e1)), inv),
      e2: this.base.mul(this.base.sub(a.e2, this.base.mul(q, b.e2)), inv),
      e12: this.base.mul(
        this.base.sub(
          this.base.sub(a.e12, this.base.mul(q, b.e12)),
          this.base.add(this.base.mul(a.e1, b.e2), this.base.mul(a.e2, b.e1))
        ),
        inv
      )
    };
  }
  neg(a) {
    return {
      v: this.base.neg(a.v),
      e1: this.base.neg(a.e1),
      e2: this.base.neg(a.e2),
      e12: this.base.neg(a.e12)
    };
  }
  inv(a) {
    const inv = this.base.inv(a.v);
    const inv2 = this.base.mul(inv, inv);
    return {
      v: inv,
      e1: this.base.mul(this.base.neg(a.e1), inv2),
      e2: this.base.mul(this.base.neg(a.e2), inv2),
      e12: this.base.mul(this.base.neg(a.e12), inv2)
    };
  }
  fromRational(n, d) {
    return { v: this.base.fromRational(n, d), e1: this.base.zero, e2: this.base.zero, e12: this.base.zero };
  }
  isZero(a) {
    return this.base.isZero(a.v) && this.base.isZero(a.e1) && this.base.isZero(a.e2) && this.base.isZero(a.e12);
  }
  eq(a, b) {
    return this.base.eq(a.v, b.v) && this.base.eq(a.e1, b.e1) && this.base.eq(a.e2, b.e2) && this.base.eq(a.e12, b.e12);
  }
  cmp(a, b) {
    return this.base.cmp(a.v, b.v);
  }
  abs(a) {
    const sign2 = this.base.cmp(a.v, this.base.zero) < 0 ? this.base.neg(this.base.one) : this.base.one;
    return {
      v: this.base.abs(a.v),
      e1: this.base.mul(a.e1, sign2),
      e2: this.base.mul(a.e2, sign2),
      e12: this.base.mul(a.e12, sign2)
    };
  }
  sqrt(a) {
    const s = this.base.sqrt(a.v);
    const twoS = this.base.mul(this.base.fromRational(2, 1), s);
    return {
      v: s,
      e1: this.base.div(a.e1, twoS),
      e2: this.base.div(a.e2, twoS),
      e12: this.base.div(this.base.sub(a.e12, this.base.mul(this.base.div(a.e1, twoS), this.base.div(a.e2, twoS))), twoS)
    };
  }
  exp(a) {
    const e = this.base.exp(a.v);
    return {
      v: e,
      e1: this.base.mul(a.e1, e),
      e2: this.base.mul(a.e2, e),
      e12: this.base.add(this.base.mul(a.e12, e), this.base.mul(a.e1, this.base.mul(a.e2, e)))
    };
  }
  log(a) {
    const inv = this.base.inv(a.v);
    return {
      v: this.base.log(a.v),
      e1: this.base.mul(a.e1, inv),
      e2: this.base.mul(a.e2, inv),
      e12: this.base.mul(this.base.sub(a.e12, this.base.mul(a.e1, this.base.mul(a.e2, inv))), inv)
    };
  }
  sin(a) {
    const c = this.base.cos(a.v);
    return {
      v: this.base.sin(a.v),
      e1: this.base.mul(a.e1, c),
      e2: this.base.mul(a.e2, c),
      e12: this.base.add(this.base.mul(a.e12, c), this.base.mul(this.base.mul(a.e1, this.base.neg(this.base.sin(a.v))), a.e2))
    };
  }
  cos(a) {
    const s = this.base.sin(a.v);
    return {
      v: this.base.cos(a.v),
      e1: this.base.mul(a.e1, this.base.neg(s)),
      e2: this.base.mul(a.e2, this.base.neg(s)),
      e12: this.base.add(this.base.mul(a.e12, this.base.neg(s)), this.base.mul(this.base.mul(a.e1, this.base.neg(s)), a.e2))
    };
  }
  tanh(a) {
    const t = this.base.tanh(a.v);
    const d = this.base.sub(this.base.one, this.base.mul(t, t));
    return {
      v: t,
      e1: this.base.div(a.e1, d),
      e2: this.base.div(a.e2, d),
      e12: this.base.div(this.base.sub(a.e12, this.base.mul(this.base.div(a.e1, d), this.base.div(a.e2, d))), d)
    };
  }
  toNumber(a) {
    return this.base.toNumber(a.v);
  }
  random(rng) {
    return { v: this.base.random(rng), e1: this.base.zero, e2: this.base.zero, e12: this.base.zero };
  }
  normal(rng) {
    return { v: this.base.normal(rng), e1: this.base.zero, e2: this.base.zero, e12: this.base.zero };
  }
};

// src/core/rational.ts
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}
function rat(n, d = 1) {
  if (d === 0) throw new Error("rational with zero denominator");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function ratFromDecimal(text) {
  const s = text.trim();
  if (!/^\d*\.?\d+$/.test(s)) throw new Error(`not a decimal literal: ${text}`);
  const dot = s.indexOf(".");
  if (dot < 0) return rat(Number(s), 1);
  const whole = s.slice(0, dot) || "0";
  const frac = s.slice(dot + 1);
  const den = 10 ** frac.length;
  return rat(Number(whole) * den + Number(frac), den);
}

// src/core/value.ts
function scalar(v) {
  return { k: "s", v };
}
function isScalarVal(val) {
  return val.k === "s";
}
function isMatrixVal(val) {
  return val.k === "m";
}

// src/core/quadrature.ts
var GAUSS5 = {
  atoms: [rat(0), rat(1), rat(-1), rat(2), rat(-2)],
  weights: [rat(1, 2), rat(1, 6), rat(1, 6), rat(1, 12), rat(1, 12)],
  degree: 5
};
var GAUSS7 = {
  atoms: [rat(0), rat(1), rat(-1), rat(2), rat(-2), rat(3), rat(-3)],
  weights: [rat(7, 18), rat(1, 4), rat(1, 4), rat(1, 20), rat(1, 20), rat(1, 180), rat(1, 180)],
  degree: 7
};
var SIMPSON = {
  atoms: [rat(0), rat(1, 2), rat(1)],
  weights: [rat(1, 6), rat(2, 3), rat(1, 6)],
  degree: 3
};
var BOOLE = {
  atoms: [rat(0), rat(1, 4), rat(1, 2), rat(3, 4), rat(1)],
  weights: [rat(7, 90), rat(32, 90), rat(12, 90), rat(32, 90), rat(7, 90)],
  degree: 5
};
var BERNOULLI = {
  atoms: [rat(0), rat(1)],
  weights: [rat(1), rat(0)],
  degree: 0
};
var NODE_BUDGET = 1e5;
function degreeInVar(node, name) {
  switch (node.k) {
    case "num":
      return 0;
    case "sym":
      return node.name === name ? 1 : 0;
    case "op": {
      switch (node.op) {
        case "add":
        case "sub":
          return Math.max(degreeInVar(node.args[0], name), degreeInVar(node.args[1], name));
        case "neg":
          return degreeInVar(node.args[0], name);
        case "mul":
        case "kron":
        case "had":
          return degreeInVar(node.args[0], name) + degreeInVar(node.args[1], name);
        case "div":
          return Infinity;
        case "pow": {
          const k = node.args[1]?.k === "num" ? node.args[1].value.n : 2;
          return degreeInVar(node.args[0], name) * k;
        }
        case "T":
        case "tr":
        case "vec":
        case "diag":
        case "adj":
          return degreeInVar(node.args[0], name);
        case "det":
          return Infinity;
        case "inner":
          return degreeInVar(node.args[0], name) + degreeInVar(node.args[1], name);
        default:
          return Infinity;
      }
    }
    case "call":
      return Infinity;
    case "deriv":
      return Infinity;
    case "expect":
      return Infinity;
    case "bigop":
      return degreeInVar(node.body, name);
    case "block":
      return Infinity;
    case "raw":
      return Infinity;
  }
}
function evaluateExpectation(f, body, vars, evaluate) {
  const perVar = vars.map((v) => Math.pow(v.rule.atoms.length, Math.max(1, v.dim)));
  const total = perVar.reduce((n, k) => n * k, 1);
  if (total > NODE_BUDGET) {
    throw new Error("the quadrature would need too many nodes");
  }
  let acc = null;
  for (let index = 0; index < total; index++) {
    const values = /* @__PURE__ */ new Map();
    let weight = f.one;
    let rest = index;
    for (let v = 0; v < vars.length; v++) {
      const local = rest % perVar[v];
      rest = Math.floor(rest / perVar[v]);
      const rule = vars[v].rule;
      const k = rule.atoms.length;
      const dim = Math.max(1, vars[v].dim);
      const atoms = [];
      let local2 = local;
      for (let d = 0; d < dim; d++) {
        const i2 = local2 % k;
        local2 = Math.floor(local2 / k);
        atoms.push(rule.atoms[i2]);
        weight = f.mul(weight, f.fromRational(rule.weights[i2].n, rule.weights[i2].d));
      }
      values.set(vars[v].name, atomValue(f, vars[v], atoms));
    }
    const value = evaluate(body, values);
    const scaled = isScalarVal(value) ? scalar(f.mul(value.v, weight)) : { k: "m", m: matScale(f, weight, value.m) };
    acc = acc === null ? scaled : addValues(f, acc, scaled);
  }
  if (!acc) return scalar(f.zero);
  return acc;
}
function atomValue(f, v, atoms) {
  const z2 = { r: atoms.length, c: 1, d: atoms.map((a) => f.fromRational(a.n, a.d)) };
  if (v.root) {
    const product = matMul(f, v.root, z2);
    if (isScalarVal(v.mean)) {
      return { k: "m", m: matAdd(f, product, { r: product.r, c: 1, d: [v.mean.v] }) };
    }
    return { k: "m", m: matAdd(f, product, v.mean.m) };
  }
  if (v.bounds) {
    const [a, b] = v.bounds;
    const value = f.fromRational(atoms[0].n, atoms[0].d);
    const lo = f.fromRational(a.n, a.d);
    const hi = f.fromRational(b.n, b.d);
    const scaled = f.add(f.mul(lo, f.sub(f.one, value)), f.mul(hi, value));
    return isScalarVal(v.mean) ? scalar(scaled) : { k: "m", m: matScale(f, scaled, v.mean.m) };
  }
  return isScalarVal(v.mean) ? scalar(f.mul(v.mean.v, z2.d[0])) : v.mean;
}
function addValues(f, a, b) {
  if (isScalarVal(a) && isScalarVal(b)) return scalar(f.add(a.v, b.v));
  if (isMatrixVal(a) && isMatrixVal(b)) return { k: "m", m: matAdd(f, a.m, b.m) };
  if (isMatrixVal(a) && isScalarVal(b)) return { k: "m", m: matAdd(f, a.m, matScale(f, b.v, a.m)) };
  if (isScalarVal(a) && isMatrixVal(b)) return { k: "m", m: matAdd(f, matScale(f, a.v, b.m), b.m) };
  return a;
}

// src/core/evaluate.ts
var EvalError = class extends Error {
  where;
  constructor(message, where) {
    super(message);
    this.where = where;
  }
};
function makeEnv(field, random2) {
  return { field, values: /* @__PURE__ */ new Map(), defs: /* @__PURE__ */ new Map(), memo: /* @__PURE__ */ new Map(), quad: /* @__PURE__ */ new Map(), random: random2 };
}
function requireMatrix(val, what) {
  if (isMatrixVal(val)) return val.m;
  throw new EvalError(`${what} needs a matrix, but got a scalar`);
}
function requireScalar(val, what) {
  if (isScalarVal(val)) return val.v;
  throw new EvalError(`${what} needs a scalar, but got a ${val.m.r} by ${val.m.c} matrix`);
}
function cellMatrix(val) {
  if (isScalarVal(val)) return { r: 1, c: 1, d: [val.v] };
  return requireMatrix(val, "a matrix entry");
}
function evalNode(f, node, env) {
  switch (node.k) {
    case "num":
      return scalar(f.fromRational(node.value.n, node.value.d));
    case "sym": {
      const direct = env.values.get(node.name);
      if (direct) return direct;
      const def = env.defs.get(node.name);
      if (def) {
        const cached = env.memo.get(node.name);
        if (cached) return cached;
        const value = evalNode(f, def, env);
        env.memo.set(node.name, value);
        return value;
      }
      throw new EvalError(`no value for ${node.name}`);
    }
    case "op":
      return evalOp(f, node.op, node.args.map((a) => evalNode(f, a, env)), env);
    case "call": {
      if (node.fn === "var" || node.fn === "cov") {
        const over = node.args[0]?.k === "sym" ? [node.args[0].name] : [];
        return evalExpect(f, { k: "expect", op: node.fn === "var" ? "Var" : "Cov", args: node.args, over, span: node.span }, env);
      }
      return evalCall(f, node.fn, node.args.map((a) => evalNode(f, a, env)), env);
    }
    case "deriv":
      throw new EvalError("a derivative is checked by the verdict engine, not evaluated directly");
    case "expect":
      return evalExpect(f, node, env);
    case "bigop": {
      const lo = node.lo ? Math.round(f.toNumber(requireScalar(evalNode(f, node.lo, env), "a sum bound"))) : 1;
      const hi = node.hi ? Math.round(f.toNumber(requireScalar(evalNode(f, node.hi, env), "a sum bound"))) : lo;
      let acc = null;
      for (let i2 = lo; i2 <= hi; i2++) {
        const saved = env.values.get(node.idx);
        env.values.set(node.idx, scalar(f.fromRational(i2, 1)));
        env.memo.delete(node.idx);
        const term = evalNode(f, node.body, env);
        env.memo.delete(node.idx);
        if (saved) env.values.set(node.idx, saved);
        else env.values.delete(node.idx);
        acc = acc === null ? term : evalOp(f, "add", [acc, term], env);
      }
      if (!acc) return scalar(f.zero);
      return acc;
    }
    case "block": {
      const rows = node.rows.map((row) => row.map((cell) => evalNode(f, cell, env)));
      const mats = rows.map((row) => row.map((cell) => cellMatrix(cell)));
      return { k: "m", m: block(mats) };
    }
    case "raw":
      throw new EvalError(`unsupported construct: ${node.text}`);
  }
}
function scalarOf(val) {
  if (isScalarVal(val)) return val.v;
  if (val.m.r === 1 && val.m.c === 1) return val.m.d[0];
  return null;
}
function evalExpect(f, node, env) {
  const names = node.over.length ? node.over : [...env.quad.keys()];
  const vars = [];
  for (const name of names) {
    const v = env.quad.get(name);
    if (!v) throw new EvalError(`the distribution of ${name} is not known`);
    vars.push(v);
  }
  if (!vars.length) throw new EvalError("an expectation needs a random variable");
  const body = expectationBody(node, env);
  for (const v of vars) {
    const degree = degreeInVar(body, v.name);
    if (!Number.isFinite(degree) || degree > v.rule.degree) {
      throw new EvalError(
        `the expectation of ${v.name} is not a polynomial of degree at most ${v.rule.degree}`
      );
    }
  }
  return evaluateExpectation(f, body, vars, (n, values) => {
    const merged = new Map(env.values);
    for (const [name, value] of values) merged.set(name, value);
    return evalNode(f, n, { ...env, values: merged, memo: /* @__PURE__ */ new Map() });
  });
}
function expectationBody(node, env) {
  const arg = node.args[0];
  if (!arg) throw new EvalError("an expectation needs something to average");
  if (node.op === "E") return arg;
  if (node.op === "Var") {
    const value = arg.k === "sym" ? env.values.get(arg.name) : void 0;
    const vector = value?.k === "m";
    const centred = centredCopy(arg);
    if (!vector) {
      return { k: "op", op: "inner", args: [centred, centredCopy(arg)], span: arg.span };
    }
    return {
      k: "op",
      op: "mul",
      args: [centred, { k: "op", op: "T", args: [centredCopy(arg)], span: arg.span }],
      span: arg.span
    };
  }
  const second = node.args[1];
  if (!second) throw new EvalError("a covariance needs two variables");
  return {
    k: "op",
    op: "mul",
    args: [centredCopy(arg), { k: "op", op: "T", args: [centredCopy(second)], span: second.span }],
    span: arg.span
  };
}
function centredCopy(node) {
  if (node.k !== "sym") return node;
  return {
    k: "op",
    op: "sub",
    args: [node, { k: "sym", name: `__mean_${node.name}`, display: node.display, span: node.span }],
    span: node.span
  };
}
function evalOp(f, op, args, _env) {
  switch (op) {
    case "add":
    case "sub": {
      const a = args[0];
      const b = args[1];
      const sa = scalarOf(a);
      const sb = scalarOf(b);
      const bothTiny = isMatrixVal(a) && isMatrixVal(b) && a.m.r === 1 && b.m.r === 1;
      if (sa !== null && sb !== null && (isScalarVal(a) || isScalarVal(b) || bothTiny)) {
        return scalar(op === "add" ? f.add(sa, sb) : f.sub(sa, sb));
      }
      if (sa !== null && isMatrixVal(b)) {
        const scaled = matScale(f, sa, b.m);
        return { k: "m", m: op === "add" ? matAdd(f, scaled, b.m) : matSub(f, scaled, b.m) };
      }
      if (sb !== null && isMatrixVal(a)) {
        const scaled = matScale(f, sb, a.m);
        return { k: "m", m: op === "add" ? matAdd(f, a.m, scaled) : matSub(f, a.m, scaled) };
      }
      const ma = requireMatrix(a, "a sum");
      const mb = requireMatrix(b, "a sum");
      if (ma.r !== mb.r || ma.c !== mb.c) {
        throw new EvalError(`shape mismatch in a sum: ${ma.r} by ${ma.c} and ${mb.r} by ${mb.c}`);
      }
      return { k: "m", m: op === "add" ? matAdd(f, ma, mb) : matSub(f, ma, mb) };
    }
    case "neg": {
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.neg(a.v));
      return { k: "m", m: matScale(f, f.neg(f.one), requireMatrix(a, "a negation")) };
    }
    case "mul": {
      const a = args[0];
      const b = args[1];
      const sa = scalarOf(a);
      const sb = scalarOf(b);
      const bothTiny = isMatrixVal(a) && isMatrixVal(b) && a.m.r === 1 && b.m.r === 1;
      if (sa !== null && sb !== null && (isScalarVal(a) || isScalarVal(b) || bothTiny)) {
        return scalar(f.mul(sa, sb));
      }
      if (sa !== null && isMatrixVal(b)) return { k: "m", m: matScale(f, sa, b.m) };
      if (sb !== null && isMatrixVal(a)) return { k: "m", m: matScale(f, sb, a.m) };
      const ma = requireMatrix(a, "a product");
      const mb = requireMatrix(b, "a product");
      if (ma.c !== mb.r) {
        throw new EvalError(`shape mismatch in a product: ${ma.r} by ${ma.c} times ${mb.r} by ${mb.c}`);
      }
      return { k: "m", m: matMul(f, ma, mb) };
    }
    case "div": {
      const a = args[0];
      const b = args[1];
      const sa = scalarOf(a);
      const sb = scalarOf(b);
      const bothTiny = isMatrixVal(a) && isMatrixVal(b) && a.m.r === 1 && b.m.r === 1;
      if (sa !== null && sb !== null && (isScalarVal(a) || isScalarVal(b) || bothTiny)) {
        return scalar(f.div(sa, sb));
      }
      if (isMatrixVal(a) && sb !== null) {
        return { k: "m", m: matScale(f, f.inv(sb), a.m) };
      }
      const ma = requireMatrix(a, "a quotient");
      const mb = requireMatrix(b, "a quotient");
      const inv = matInv(f, mb);
      return { k: "m", m: matMul(f, ma, inv) };
    }
    case "pow": {
      const a = args[0];
      const k = nodeExponent(f, args[1]);
      if (isScalarVal(a)) {
        let acc = f.one;
        for (let i2 = 0; i2 < k; i2++) acc = f.mul(acc, a.v);
        return scalar(acc);
      }
      return { k: "m", m: matPow(f, requireMatrix(a, "a power"), k) };
    }
    case "inv": {
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.inv(a.v));
      return { k: "m", m: matInv(f, requireMatrix(a, "an inverse")) };
    }
    case "invT": {
      const a = requireMatrix(args[0], "an inverse transpose");
      return { k: "m", m: matInv(f, transpose(a)) };
    }
    case "T": {
      const a = args[0];
      if (isScalarVal(a)) return scalar(a.v);
      return { k: "m", m: transpose(a.m) };
    }
    case "tr":
      return scalar(matTrace(f, requireMatrix(args[0], "a trace")));
    case "det":
      return scalar(matDet(f, requireMatrix(args[0], "a determinant")));
    case "adj": {
      const a = requireMatrix(args[0], "an adjugate");
      const n = a.r;
      const cofactors = zeros(n, n, f.zero);
      for (let i2 = 0; i2 < n; i2++) {
        for (let j = 0; j < n; j++) {
          const minor = zeros(n - 1, n - 1, f.zero);
          for (let r = 0; r < n - 1; r++) {
            for (let c = 0; c < n - 1; c++) {
              const sr = r < i2 ? r : r + 1;
              const sc = c < j ? c : c + 1;
              minor.d[r * (n - 1) + c] = a.d[sr * n + sc];
            }
          }
          const det = n === 1 ? f.one : matDet(f, minor);
          cofactors.d[j * n + i2] = (i2 + j) % 2 === 0 ? det : f.neg(det);
        }
      }
      return { k: "m", m: cofactors };
    }
    case "kron":
      return { k: "m", m: kron(f, requireMatrix(args[0], "a Kronecker product"), requireMatrix(args[1], "a Kronecker product")) };
    case "had":
      return { k: "m", m: hadamard(f, requireMatrix(args[0], "an element wise product"), requireMatrix(args[1], "an element wise product")) };
    case "inner":
      return scalar(inner(f, requireMatrix(args[0], "an inner product"), requireMatrix(args[1], "an inner product")));
    case "norm2":
      return scalar(norm2(f, requireMatrix(args[0], "a squared norm")));
    case "frob":
      return scalar(norm2(f, requireMatrix(args[0], "a Frobenius norm")));
    case "vec":
      return { k: "m", m: vec(requireMatrix(args[0], "a vectorisation")) };
    case "diag":
      return { k: "m", m: diag(f, requireMatrix(args[0], "a diagonal")) };
    case "abs": {
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.abs(a.v));
      return { k: "m", m: requireMatrix(a, "an absolute value") };
    }
    case "sqrtm": {
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.sqrt(a.v));
      return { k: "m", m: matSqrtm(f, requireMatrix(a, "a matrix square root")) };
    }
    default:
      throw new EvalError(`unknown operation ${op}`);
  }
}
function nodeExponent(field, val) {
  if (isScalarVal(val)) {
    const direct = Number(val.v);
    if (Number.isFinite(direct)) return Math.max(0, Math.round(direct));
    return Math.max(0, Math.round(field.toNumber(val.v)));
  }
  return 2;
}
function evalCall(f, fn, args, _env) {
  const a0 = args[0];
  switch (fn) {
    case "sqrt": {
      if (isMatrixVal(a0)) return { k: "m", m: matSqrtm(f, a0.m) };
      return scalar(f.sqrt(requireScalar(a0, "a square root")));
    }
    case "exp":
    case "log":
    case "ln":
    case "sin":
    case "cos":
    case "tan":
    case "tanh":
    case "sigmoid":
    case "relu": {
      const unary = (x2) => {
        if (fn === "exp") return f.exp(x2);
        if (fn === "log" || fn === "ln") return f.log(x2);
        if (fn === "sin") return f.sin(x2);
        if (fn === "cos") return f.cos(x2);
        if (fn === "tan") return f.div(f.sin(x2), f.cos(x2));
        if (fn === "tanh") return f.tanh(x2);
        if (fn === "sigmoid") return f.div(f.one, f.add(f.one, f.exp(f.neg(x2))));
        return f.cmp(x2, f.zero) > 0 ? x2 : f.zero;
      };
      if (isScalarVal(a0)) return scalar(unary(a0.v));
      const m = a0.m;
      return { k: "m", m: { r: m.r, c: m.c, d: m.d.map(unary) } };
    }
    case "softmax": {
      const m = requireMatrix(a0, "a softmax");
      const max2 = m.d.reduce((acc, v) => f.cmp(v, acc) > 0 ? v : acc, f.neg(f.one));
      let sum2 = f.zero;
      const exps = m.d.map((v) => f.exp(f.sub(v, max2)));
      for (const e of exps) sum2 = f.add(sum2, e);
      return { k: "m", m: { r: m.r, c: m.c, d: exps.map((e) => f.div(e, sum2)) } };
    }
    case "det":
      return scalar(matDet(f, requireMatrix(a0, "a determinant")));
    case "tr":
    case "trace":
      return scalar(matTrace(f, requireMatrix(a0, "a trace")));
    case "logdet": {
      const m = requireMatrix(a0, "a log determinant");
      return scalar(f.log(matDet(f, m)));
    }
    case "normalDensity": {
      const x2 = requireMatrix(args[0], "a density");
      const mu = requireMatrix(args[1], "a density");
      const sigma = requireMatrix(args[2], "a density");
      const diff = matSub(f, x2, mu);
      const inv = matInv(f, sigma);
      const quad = inner(f, diff, matMul(f, inv, diff));
      const n = x2.c;
      const logNorm = f.mul(f.fromRational(-1, 2), f.log(matDet(f, sigma)));
      const logTwoPi = f.mul(f.fromRational(-1, 2), f.mul(f.fromRational(n, 1), f.log(f.mul(f.fromRational(2, 1), f.log(f.exp(f.one))))));
      return scalar(f.exp(f.add(f.add(logNorm, logTwoPi), f.mul(f.fromRational(-1, 2), quad))));
    }
    case "uniformDensity":
      return scalar(f.one);
    default:
      throw new EvalError(`unknown function ${fn}`);
  }
}
function toDual(f, m) {
  return { r: m.r, c: m.c, d: m.d.map((x2) => ({ v: x2, t: f.zero })) };
}
function toHyperDual(f, m) {
  return {
    r: m.r,
    c: m.c,
    d: m.d.map((x2) => ({ v: x2, e1: f.zero, e2: f.zero, e12: f.zero }))
  };
}
function dualEnv(env, dual) {
  const values = /* @__PURE__ */ new Map();
  for (const [name, val] of env.values) {
    if (isScalarVal(val)) values.set(name, scalar({ v: val.v, t: dual.base.zero }));
    else values.set(name, { k: "m", m: toDual(dual.base, val.m) });
  }
  return { field: dual, values, defs: env.defs, memo: /* @__PURE__ */ new Map(), quad: /* @__PURE__ */ new Map(), random: env.random };
}
function hyperEnv(env, hyper) {
  const values = /* @__PURE__ */ new Map();
  for (const [name, val] of env.values) {
    if (isScalarVal(val)) {
      values.set(name, scalar({ v: val.v, e1: hyper.base.zero, e2: hyper.base.zero, e12: hyper.base.zero }));
    } else {
      values.set(name, { k: "m", m: toHyperDual(hyper.base, val.m) });
    }
  }
  return { field: hyper, values, defs: env.defs, memo: /* @__PURE__ */ new Map(), quad: /* @__PURE__ */ new Map(), random: env.random };
}
function directionalDerivative(base2, fnNode, env, wrtName, baseValue, direction) {
  const dual = new DualField(base2);
  const dEnv = dualEnv(env, dual);
  if (isScalarVal(baseValue) && isScalarVal(direction)) {
    dEnv.values.set(wrtName, scalar({ v: baseValue.v, t: direction.v }));
  } else {
    const bm = isMatrixVal(baseValue) ? baseValue.m : { r: 1, c: 1, d: [baseValue.v] };
    const dm = isMatrixVal(direction) ? direction.m : { r: 1, c: 1, d: [direction.v] };
    const dMat = toDual(base2, bm);
    for (let i2 = 0; i2 < dMat.d.length; i2++) dMat.d[i2] = { v: dMat.d[i2].v, t: dm.d[i2] };
    dEnv.values.set(wrtName, { k: "m", m: dMat });
  }
  const result = evalNode(dual, fnNode, dEnv);
  if (isScalarVal(result)) return scalar(result.v.t);
  return { k: "m", m: { r: result.m.r, c: result.m.c, d: result.m.d.map((x2) => x2.t) } };
}
function mixedSecondDerivative(base2, fnNode, env, wrtName, baseValue, v, w) {
  const hyper = new HyperDualField(base2);
  const hEnv = hyperEnv(env, hyper);
  if (isScalarVal(baseValue) && isScalarVal(v) && isScalarVal(w)) {
    hEnv.values.set(
      wrtName,
      scalar({ v: baseValue.v, e1: v.v, e2: w.v, e12: base2.zero })
    );
  } else {
    const bm = isMatrixVal(baseValue) ? baseValue.m : { r: 1, c: 1, d: [baseValue.v] };
    const vm = isMatrixVal(v) ? v.m : { r: 1, c: 1, d: [v.v] };
    const wm = isMatrixVal(w) ? w.m : { r: 1, c: 1, d: [w.v] };
    const hMat = toHyperDual(base2, bm);
    for (let i2 = 0; i2 < hMat.d.length; i2++) {
      hMat.d[i2] = { v: hMat.d[i2].v, e1: vm.d[i2], e2: wm.d[i2], e12: base2.zero };
    }
    hEnv.values.set(wrtName, { k: "m", m: hMat });
  }
  const result = evalNode(hyper, fnNode, hEnv);
  if (isScalarVal(result)) return scalar(result.v.e12);
  return { k: "m", m: { r: result.m.r, c: result.m.c, d: result.m.d.map((x2) => x2.e12) } };
}

// src/core/prng.ts
function sfc32(a, b, c, d) {
  let s0 = a >>> 0;
  let s1 = b >>> 0;
  let s2 = c >>> 0;
  let s3 = d >>> 0;
  return function next() {
    s0 >>>= 0;
    s1 >>>= 0;
    s2 >>>= 0;
    s3 >>>= 0;
    let t = s0 + s0 | 0;
    s0 = s1 ^ s1 >>> 9;
    s1 = s2 + (s2 << 3) | 0;
    s2 = s2 << 21 | s2 >>> 11;
    s3 = s3 + 1 | 0;
    t = t + s3 | 0;
    s2 = s2 + t | 0;
    const r = (t >>> 0) / 4294967296;
    return r;
  };
}
function hashString(text) {
  let h = 2166136261;
  for (let i2 = 0; i2 < text.length; i2++) {
    h ^= text.charCodeAt(i2);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hashSeed(...parts) {
  let h = 2654435769;
  for (const part of parts) {
    const text = typeof part === "number" ? part.toString(36) : part;
    h = Math.imul(h ^ hashString(text), 2246822507) >>> 0 ^ h >>> 13;
    h = h >>> 0;
  }
  return h >>> 0;
}
function rngFor(...parts) {
  const h = hashSeed(...parts);
  return sfc32(h, h ^ 2654435769, h ^ 2246822507, h ^ 3266489909);
}
function randField(rng, p) {
  const hi = Math.floor(rng() * 65536) % 65536;
  const lo = Math.floor(rng() * 65536) % 65536;
  return (hi * 65536 + lo) % p;
}

// src/core/sample.ts
var Sampler = class {
  field;
  rng;
  constructor(field, rng) {
    this.field = field;
    this.rng = rng;
  }
  /** Samples one symbol. Returns null when the constraints cannot be met. */
  sample(spec) {
    const { r, c, props } = spec;
    const has = (p) => props.some((x2) => typeof x2 === "string" ? x2 === p : false);
    if (has("ident")) return { k: "m", m: identity(r, this.field.one, this.field.zero) };
    if (has("zero")) return { k: "m", m: zeros(r, c, this.field.zero) };
    if (has("ones")) return { k: "m", m: this.mat(r, c, () => this.field.one) };
    if (has("rot")) return { k: "m", m: this.sampleOrthogonal(r, false) };
    if (has("orth")) return { k: "m", m: this.sampleOrthogonal(r, (spec.variety & 1) === 1) };
    if (has("idem") || has("proj")) {
      const rank = (spec.variety & 1) === 0 ? Math.min(r, c) : Math.max(1, Math.min(r, c) - 1);
      return { k: "m", m: this.sampleIdempotent(r, c, rank) };
    }
    if (has("unit")) return { k: "m", m: this.sampleUnit(r, c) };
    if (has("stoch")) return { k: "m", m: this.sampleStochastic(r, c) };
    if (has("diag")) return { k: "m", m: this.sampleDiagonal(r, c) };
    if (has("triu")) return { k: "m", m: this.sampleTriangular(r, c, true) };
    if (has("tril")) return { k: "m", m: this.sampleTriangular(r, c, false) };
    if (has("skew")) return { k: "m", m: this.sampleSkew(r, c) };
    if (has("spd") && !(this.field instanceof GFpField)) {
      const f = this.field;
      const b = this.sampleGeneral(r, r);
      const bb = matMul(f, b, transpose(b));
      const eye = identity(r, f.one, f.zero);
      const scaled = matScale(f, f.fromRational(r, 1), eye);
      return { k: "m", m: matAdd(f, bb, scaled) };
    }
    if (has("sym") || has("spd") || has("psd")) return { k: "m", m: this.sampleSymmetric(r, c) };
    return { k: "m", m: this.sampleGeneral(r, c) };
  }
  mat(r, c, f) {
    const d = new Array(r * c);
    for (let i2 = 0; i2 < r; i2++) for (let j = 0; j < c; j++) d[i2 * c + j] = f(i2, j);
    return { r, c, d };
  }
  /** One random element of the field. */
  element() {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p);
    return f.normal(this.rng);
  }
  norm() {
    return this.field.normal(this.rng);
  }
  /** iid entries. */
  sampleGeneral(r, c) {
    return this.mat(r, c, () => this.element());
  }
  /** The upper triangle is mirrored. */
  sampleSymmetric(r, c) {
    const upper = this.sampleGeneral(r, c);
    return this.mat(r, c, (i2, j) => i2 <= j ? upper.d[i2 * c + j] : upper.d[j * c + i2]);
  }
  /** A diagonal matrix. */
  sampleDiagonal(r, c) {
    return this.mat(r, c, (i2, j) => i2 === j ? this.element() : this.field.zero);
  }
  /** Upper or lower triangular. */
  sampleTriangular(r, c, upper) {
    return this.mat(r, c, (i2, j) => {
      if (i2 === j) return this.element();
      const inUpper = i2 < j;
      return inUpper === upper ? this.element() : this.field.zero;
    });
  }
  /** Skew symmetric: the transpose is the negative. */
  sampleSkew(r, c) {
    const f = this.field;
    const upper = this.sampleGeneral(r, c);
    return this.mat(r, c, (i2, j) => i2 === j ? f.zero : i2 < j ? upper.d[i2 * c + j] : f.neg(upper.d[j * c + i2]));
  }
  /**
   * An orthogonal matrix.
   *
   * Over a finite field the Cayley transform is exact: Q = (I - S)(I + S)^-1
   * with S skew gives Q^T Q = I as an identity, not as an approximation.
   *
   * The component is a corner (section 3.1 of the review): with the
   * reflection flag false this is a rotation and its determinant is one,
   * with it true ONE column is negated, which flips the determinant and
   * keeps the orthogonality. Both corners of O(n) have to be drawn, or an
   * identity about det(Q) is decided by half the truth.
   */
  sampleOrthogonal(n, reflect = false) {
    const f = this.field;
    if (f instanceof GFpField) {
      const g = f;
      const s = this.sampleSkew(n, n);
      const eye = identity(n, g.one, g.zero);
      const plus = matAdd(g, eye, s);
      const minus = matSub(g, eye, s);
      const inv = matInv(g, plus);
      const q2 = matMul(g, minus, inv);
      if (!reflect) return q2;
      return this.mat(n, n, (i2, j) => j === 0 ? g.neg(q2.d[i2 * n]) : q2.d[i2 * n + j]);
    }
    const q = this.qrHaar(this.sampleGeneral(n, n));
    if (!reflect) return q;
    return this.mat(n, n, (i2, j) => j === 0 ? f.neg(q.d[i2 * n]) : q.d[i2 * n + j]);
  }
  /** Gram-Schmidt with the sign correction, which gives a Haar measure. */
  qrHaar(a) {
    const f = this.field;
    const n = a.r;
    let cols = [];
    for (let j = 0; j < n; j++) {
      const v = { r: n, c: 1, d: new Array(n) };
      for (let i2 = 0; i2 < n; i2++) v.d[i2] = a.d[i2 * n + j];
      cols.push(v);
    }
    for (let pass = 0; pass < 2; pass++) {
      const next = [];
      for (let j = 0; j < n; j++) {
        const v = { r: n, c: 1, d: [...cols[j].d] };
        for (const q of next) {
          let proj = f.zero;
          for (let i2 = 0; i2 < n; i2++) proj = f.add(proj, f.mul(q.d[i2], v.d[i2]));
          for (let i2 = 0; i2 < n; i2++) v.d[i2] = f.sub(v.d[i2], f.mul(proj, q.d[i2]));
        }
        let norm = f.zero;
        for (let i2 = 0; i2 < n; i2++) norm = f.add(norm, f.mul(v.d[i2], v.d[i2]));
        let scale = f.sqrt(norm);
        if (f.toNumber(scale) < 1e-9) scale = f.one;
        if (f.toNumber(v.d[n - 1]) < 0) scale = f.neg(scale);
        for (let i2 = 0; i2 < n; i2++) v.d[i2] = f.div(v.d[i2], scale);
        next.push(v);
      }
      cols = next;
    }
    return this.mat(n, n, (i2, j) => cols[j].d[i2]);
  }
  /** An idempotent matrix of the given rank: U (V^T U)^-1 V^T. */
  sampleIdempotent(r, c, rank) {
    const f = this.field;
    const k = rank;
    const u = this.sampleGeneral(r, k);
    const v = this.sampleGeneral(c, k);
    const vtu = matMul(f, transpose(v), u);
    const inv = matInv(f, vtu);
    return matMul(f, matMul(f, u, inv), transpose(v));
  }
  /** A unit vector: a normalized Gaussian, or a stereographic point. */
  sampleUnit(r, c) {
    const f = this.field;
    if (f instanceof GFpField) {
      const k = Math.max(r - 1, 0);
      const t = this.sampleGeneral(k, c);
      const sq = new Array(c).fill(f.zero);
      const inv = new Array(c);
      for (let j = 0; j < c; j++) {
        let s2 = f.zero;
        for (let i2 = 0; i2 < k; i2++) s2 = f.add(s2, f.mul(t.d[i2 * c + j], t.d[i2 * c + j]));
        sq[j] = s2;
        inv[j] = f.inv(f.add(s2, f.one));
      }
      return this.mat(r, c, (i2, j) => {
        if (i2 === r - 1) return f.mul(f.sub(sq[j], f.one), inv[j]);
        return f.mul(f.mul(f.fromRational(2, 1), t.d[i2 * c + j]), inv[j]);
      });
    }
    const v = this.sampleGeneral(r, c);
    let norm = f.zero;
    for (const x2 of v.d) norm = f.add(norm, f.mul(x2, x2));
    const s = Math.sqrt(f.toNumber(norm)) || 1;
    const scale = f.fromRational(Math.round(s * 1e9), 1e9);
    return this.mat(r, c, (i2, j) => f.div(v.d[i2 * c + j], scale));
  }
  /** Row stochastic: the rows are positive and sum to one. */
  sampleStochastic(r, c) {
    const f = this.field;
    const raw = this.sampleGeneral(r, c);
    return this.mat(r, c, (i2, j) => {
      let sum2 = f.zero;
      for (let k = 0; k < c; k++) sum2 = f.add(sum2, raw.d[i2 * c + k]);
      if (f.isZero(sum2)) return f.zero;
      return f.div(raw.d[i2 * c + j], sum2);
    });
  }
  /**
   * A scalar drawn from the field.
   *
   * Over a finite field every element is as good as any other. Over the
   * reals the samples have to span what the step distinguishes: the sign
   * comes from a bit of the trial index, and the magnitude cycles through a
   * tiny, a unit and a large class, so the samples cover the line without
   * being random about the coverage (section 3.4 of the review). A sign
   * that never turns negative is how |x| = x used to look true.
   */
  sampleScalar(variety = 0, index = 0) {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p);
    const z2 = this.norm();
    const sign2 = (variety >> index & 1) === 1 ? -1 : 1;
    const cls = (variety + index) % 3;
    const magnitude = cls === 0 ? f.mul(f.abs(z2), f.fromRational(1, 10)) : cls === 1 ? f.abs(z2) : f.mul(f.abs(z2), f.fromRational(5, 1));
    return sign2 < 0 ? f.neg(magnitude) : magnitude;
  }
  /** A strictly positive scalar over the reals; the pos property is a real order, so GF(p) cannot have it. */
  samplePositiveScalar() {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p);
    return f.add(f.abs(this.norm()), f.fromRational(5, 100));
  }
};

// src/core/notation.ts
var UNICODE_MAP = {
  "\u1D40": "^{\\top}",
  "\u2032": "'",
  "\u2033": "''",
  "\u207B": "^{-}",
  "\xB9": "^{1}",
  "\u2070": "^{0}",
  "\u207A": "^{+}",
  "\u207B\xB9": "^{-1}",
  "\u2211": "\\sum",
  "\u220F": "\\prod",
  "\u2207": "\\nabla",
  "\u211D": "\\mathbb{R}",
  "\u{1D53C}": "\\mathbb{E}",
  "\u2115": "\\mathbb{N}",
  "\u2124": "\\mathbb{Z}",
  "\u2264": "\\le",
  "\u2265": "\\ge",
  "\u2AAF": "\\preceq",
  "\u2AB0": "\\succeq",
  "\u2248": "\\approx",
  "\u2260": "\\neq",
  "\u2261": "\\equiv",
  "\xB7": "\\cdot",
  "\u2297": "\\otimes",
  "\u2299": "\\odot",
  "\u2298": "\\oslash",
  "\u2016": "\\|",
  "\u27E8": "\\langle",
  "\u27E9": "\\rangle",
  "\u221A": "\\sqrt",
  "\u2202": "\\partial",
  "\u2203": "\\exists",
  "\u2200": "\\forall",
  "\u2208": "\\in",
  "\u2209": "\\notin",
  "\u2282": "\\subset",
  "\u2286": "\\subseteq",
  "\u221E": "\\infty",
  "\u03C0": "\\pi",
  "\u03B1": "\\alpha",
  "\u03B2": "\\beta",
  "\u03B3": "\\gamma",
  "\u03B4": "\\delta",
  "\u03B5": "\\epsilon",
  "\u03B6": "\\zeta",
  "\u03B7": "\\eta",
  "\u03B8": "\\theta",
  "\u03B9": "\\iota",
  "\u03BA": "\\kappa",
  "\u03BB": "\\lambda",
  "\u03BC": "\\mu",
  "\u03BD": "\\nu",
  "\u03BE": "\\xi",
  "\u03C1": "\\rho",
  "\u03C3": "\\sigma",
  "\u03C4": "\\tau",
  "\u03C5": "\\upsilon",
  "\u03C6": "\\phi",
  "\u03D5": "\\varphi",
  "\u03C7": "\\chi",
  "\u03C8": "\\psi",
  "\u03C9": "\\omega",
  "\u0393": "\\Gamma",
  "\u0394": "\\Delta",
  "\u0398": "\\Theta",
  "\u039B": "\\Lambda",
  "\u039E": "\\Xi",
  "\u03A0": "\\Pi",
  "\u03A3": "\\Sigma",
  "\u03A6": "\\Phi",
  "\u03A8": "\\Psi",
  "\u03A9": "\\Omega",
  "\u2212": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2192": "\\to",
  "\u2190": "\\leftarrow",
  "\u21D2": "\\Rightarrow",
  "\u21D0": "\\Leftarrow",
  "\u21D4": "\\iff",
  "\u27FA": "\\iff",
  "\u225C": ":=",
  "\u2254": ":=",
  "\u2236": ":",
  "\u2112": "\\mathcal{L}",
  "\u22C5": "\\cdot",
  "\u2218": "\\circ"
};
var ACCENTS = /* @__PURE__ */ new Set([
  "hat",
  "widehat",
  "bar",
  "overline",
  "tilde",
  "widetilde",
  "check",
  "dot",
  "ddot",
  "vec",
  "mathbf",
  "boldsymbol",
  "bm",
  "mathcal",
  "mathscr",
  "mathfrak",
  "mathrm",
  "mathsf",
  "mathtt",
  "mathbb",
  "text"
]);
var GLYPH_ACCENTS = /* @__PURE__ */ new Set([
  "hat",
  "widehat",
  "bar",
  "overline",
  "tilde",
  "widetilde",
  "check",
  "dot",
  "ddot",
  "vec",
  "mathbf",
  "boldsymbol",
  "bm",
  "mathscr",
  "mathfrak"
]);
var GREEK = /* @__PURE__ */ new Set([
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "varepsilon",
  "zeta",
  "eta",
  "theta",
  "vartheta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "pi",
  "varpi",
  "rho",
  "varrho",
  "sigma",
  "tau",
  "upsilon",
  "phi",
  "varphi",
  "chi",
  "psi",
  "omega",
  "Gamma",
  "Delta",
  "Theta",
  "Lambda",
  "Xi",
  "Pi",
  "Sigma",
  "Phi",
  "Psi",
  "Omega"
]);
function foldUnicode(input) {
  let out = "";
  for (const ch of input) {
    const mapped = UNICODE_MAP[ch];
    if (mapped !== void 0) {
      out += mapped;
      continue;
    }
    const sup = SUPERSCRIPTS[ch];
    if (sup !== void 0) {
      out += `^{${sup}}`;
      continue;
    }
    out += ch;
  }
  return out;
}
var SUPERSCRIPTS = {
  "\u2070": "0",
  "\xB9": "1",
  "\xB2": "2",
  "\xB3": "3",
  "\u2074": "4",
  "\u2075": "5",
  "\u2076": "6",
  "\u2077": "7",
  "\u2078": "8",
  "\u2079": "9",
  "\u1D43": "a",
  "\u1D47": "b",
  "\u1D9C": "c",
  "\u1D48": "d",
  "\u1D49": "e",
  "\u1DA0": "f",
  "\u1D4D": "g",
  "\u02B0": "h",
  "\u2071": "i",
  "\u02B2": "j",
  "\u1D4F": "k",
  "\u02E1": "l",
  "\u1D50": "m",
  "\u207F": "n",
  "\u1D52": "o",
  "\u1D56": "p",
  "\u02B3": "r",
  "\u02E2": "s",
  "\u1D57": "t",
  "\u1D58": "u",
  "\u1D5B": "v",
  "\u02B7": "w",
  "\u02E3": "x",
  "\u02B8": "y",
  "\u1DBB": "z"
};
function toDisplay(name) {
  let out = name;
  const map = [
    // an accent over a command, as in \\bar\\Sigma_t, before the command itself
    [/\\bar\{?(\\[A-Za-z]+)\}?/g, "$1\u0304"],
    [/\\hat\{?(\\[A-Za-z]+)\}?/g, "$1\u0302"],
    [/\\tilde\{?(\\[A-Za-z]+)\}?/g, "$1\u0303"],
    [/\\vec\{?(\\[A-Za-z]+)\}?/g, "$1\u20D7"],
    [/\\bar\{?([A-Za-z]+)\}?/g, "$1\u0304"],
    [/\\hat\{?([A-Za-z]+)\}?/g, "$1\u0302"],
    [/\\tilde\{?([A-Za-z]+)\}?/g, "$1\u0303"],
    [/\\vec\{?([A-Za-z]+)\}?/g, "$1\u20D7"],
    [/\\mathbb\{R\}/g, "\u211D"],
    [/\\mathbb\{E\}/g, "\u{1D53C}"],
    [/\\Sigma/g, "\u03A3"],
    [/\\Lambda/g, "\u039B"],
    [/\\Delta/g, "\u0394"],
    [/\\Phi/g, "\u03A6"],
    [/\\Theta/g, "\u0398"],
    [/\\Psi/g, "\u03A8"],
    [/\\Omega/g, "\u03A9"],
    [/\\Gamma/g, "\u0393"],
    [/\\Xi/g, "\u039E"],
    [/\\Pi/g, "\u03A0"],
    [/\\mu/g, "\u03BC"],
    [/\\sigma/g, "\u03C3"],
    [/\\Sigma/g, "\u03A3"],
    [/\\theta/g, "\u03B8"],
    [/\\phi/g, "\u03C6"],
    [/\\lambda/g, "\u03BB"],
    [/\\omega/g, "\u03C9"],
    [/\\alpha/g, "\u03B1"],
    [/\\beta/g, "\u03B2"],
    [/\\gamma/g, "\u03B3"],
    [/\\delta/g, "\u03B4"],
    [/\\epsilon/g, "\u03B5"],
    [/\\rho/g, "\u03C1"],
    [/\\kappa/g, "\u03BA"],
    [/\\tau/g, "\u03C4"],
    [/\\psi/g, "\u03C8"],
    [/\\chi/g, "\u03C7"],
    [/\\eta/g, "\u03B7"],
    [/\\nu/g, "\u03BD"],
    [/\\pi/g, "\u03C0"],
    [/\\varepsilon/g, "\u03B5"],
    [/\\varphi/g, "\u03C6"],
    [/\\top/g, "\u1D40"],
    [/\\partial/g, "\u2202"],
    [/\\nabla/g, "\u2207"],
    [/\\in/g, "\u2208"]
  ];
  for (const [re, sub2] of map) out = out.replace(re, sub2);
  return out;
}
function canonicalizeSymbol(raw) {
  let s = raw.replace(/\s+/g, "");
  let previous = "";
  while (previous !== s) {
    previous = s;
    s = s.replace(/\\(hat|bar|overline|tilde|widetilde|check|dot|ddot|vec|mathbf|boldsymbol|bm|mathcal|mathrm|mathsf|mathtt)\{([^{}]*)\}/g, "\\$1$2");
  }
  s = s.replace(/_\{([^{}]*)\}/g, "_$1");
  s = s.replace(/\^\{([^{}]*)\}/g, "^$1");
  return s;
}

// src/core/lex.ts
var DROP_COMMANDS = /* @__PURE__ */ new Set([
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "limits",
  "nolimits",
  "left",
  "right",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "bigl",
  "bigr",
  "Bigl",
  "Bigr",
  "mathstrut",
  "phantom",
  "vphantom",
  "hphantom",
  "medspace",
  "thinspace",
  "negthinspace",
  "thickspace",
  "nobreak",
  "allowbreak",
  "protect",
  "ensuremath",
  "newcommand",
  "renewcommand",
  "DeclareMathOperator",
  "def",
  "let"
]);
var SPACE_COMMANDS = /* @__PURE__ */ new Set([",", ";", ":", "!", " ", "quad", "qquad", "thinspace", "negthinspace", "medspace", "thickspace", "enspace", "hfill"]);
var OPERATOR_CHARS = "+-*/=<>!:";
function tokenize(src) {
  const text = foldUnicode(src);
  const tokens = [];
  let i2 = 0;
  const n = text.length;
  const push = (type, value, from, to) => {
    tokens.push({ type, value, from, to });
  };
  while (i2 < n) {
    const ch = text[i2];
    if (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
      i2++;
      continue;
    }
    if (ch === "%") {
      while (i2 < n && text[i2] !== "\n") i2++;
      continue;
    }
    if (ch === "~") {
      i2++;
      continue;
    }
    if (ch === "\\") {
      const start = i2;
      i2++;
      if (i2 >= n) {
        push("csym", "\\", start, i2);
        break;
      }
      const c = text[i2];
      if (/[A-Za-z]/.test(c)) {
        let j = i2;
        while (j < n && /[A-Za-z]/.test(text[j])) j++;
        const name = text.slice(i2, j);
        i2 = j;
        if (name === "begin" || name === "end") {
          const env = readBracedName(text, i2);
          if (env) {
            i2 = env.next;
            push(name === "begin" ? "begin" : "end", env.name, start, i2);
            continue;
          }
        }
        if (SPACE_COMMANDS.has(name)) {
          continue;
        }
        if (name === "mid") {
          push("csym", "|", start, i2);
          continue;
        }
        if (name === "middle") {
          if (text[i2] === "|") {
            i2++;
            push("csym", "|", start, i2);
          }
          continue;
        }
        if (name === "lVert" || name === "rVert" || name === "Vert") {
          push("csym", "\\|", start, i2);
          continue;
        }
        if (name === "lvert" || name === "rvert") {
          push("csym", "|", start, i2);
          continue;
        }
        if (DROP_COMMANDS.has(name)) {
          continue;
        }
        push("cmd", name, start, i2);
        continue;
      }
      const sym = text[i2];
      i2 += 1;
      if (sym === "\\") {
        if (text[i2] === "\\") i2 += 1;
        push("nl", "\\\\", start, i2);
        continue;
      }
      if (sym === "{" || sym === "}") {
        push(sym === "{" ? "lbrace" : "rbrace", sym, start, i2);
        continue;
      }
      if (sym === "," || sym === ";" || sym === ":" || sym === "!" || sym === " ") continue;
      push("csym", sym === "|" ? "\\|" : sym, start, i2);
      continue;
    }
    if (ch === "{") {
      push("lbrace", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "}") {
      push("rbrace", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "(") {
      push("lparen", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === ")") {
      push("rparen", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "[") {
      push("lbrack", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "]") {
      push("rbrack", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "^") {
      push("sup", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "_") {
      push("sub", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "&") {
      push("amp", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === ",") {
      push("comma", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === ";") {
      push("semi", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "'") {
      push("csym", "'", i2, i2 + 1);
      i2++;
      continue;
    }
    if (OPERATOR_CHARS.includes(ch)) {
      push("op", ch, i2, i2 + 1);
      i2++;
      continue;
    }
    if (ch === "|") {
      push("csym", "|", i2, i2 + 1);
      i2++;
      continue;
    }
    if (/[0-9]/.test(ch) || ch === "." && /[0-9]/.test(text[i2 + 1] ?? "")) {
      let j = i2;
      while (j < n && /[0-9]/.test(text[j])) j++;
      if (text[j] === "." && /[0-9]/.test(text[j + 1] ?? "")) {
        j++;
        while (j < n && /[0-9]/.test(text[j])) j++;
      }
      push("num", text.slice(i2, j), i2, j);
      i2 = j;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i2;
      while (j < n && /[A-Za-z0-9]/.test(text[j])) j++;
      push("ident", text.slice(i2, j), i2, j);
      i2 = j;
      continue;
    }
    push("op", ch, i2, i2 + 1);
    i2++;
  }
  push("eof", "", n, n);
  return tokens;
}
function readBracedName(text, i2) {
  let j = i2;
  while (j < text.length && /\s/.test(text[j])) j++;
  if (text[j] !== "{") return null;
  const end = text.indexOf("}", j);
  if (end < 0) return null;
  return { name: text.slice(j + 1, end), next: end + 1 };
}
function renderTokens(tokens) {
  let out = "";
  let prev = null;
  for (const t of tokens) {
    const piece = renderToken(t);
    if (prev && needsSpace(prev, t)) out += " ";
    out += piece;
    prev = t;
  }
  return out;
}
function needsSpace(prev, next) {
  const prevWord = prev.type === "ident" || prev.type === "cmd";
  const nextWord = next.type === "ident" || next.type === "cmd";
  if (!prevWord || !nextWord) return false;
  if (prev.type === "cmd" && next.type === "cmd") return false;
  return true;
}
function renderToken(t) {
  switch (t.type) {
    case "cmd":
      return `\\${t.value}`;
    case "csym":
      return t.value;
    case "lbrace":
      return "{";
    case "rbrace":
      return "}";
    case "sup":
      return "^";
    case "sub":
      return "_";
    case "amp":
      return "&";
    case "nl":
      return "\\\\";
    case "eof":
      return "";
    default:
      return t.value;
  }
}

// src/core/ir.ts
var ParseFailure = class extends Error {
  span;
  constructor(message, span) {
    super(message);
    this.span = span;
  }
};

// src/core/parse.ts
var DEFAULT_FUNCTIONS = /* @__PURE__ */ new Set([
  "exp",
  "log",
  "ln",
  "sin",
  "cos",
  "tan",
  "tanh",
  "det",
  "tr",
  "trace",
  "sigmoid",
  "sigma",
  "relu",
  "softmax",
  "logdet",
  "norm",
  "abs",
  "sech",
  "sqrt",
  "var",
  "cov"
]);
var SYMBOL_COMMANDS = /* @__PURE__ */ new Set([
  "imath",
  "jmath",
  "ell",
  "hbar",
  "Re",
  "Im",
  "Pr",
  "varnothing",
  "aleph",
  "wp"
]);
var RELATION_COMMANDS = {
  le: "le",
  leq: "le",
  ge: "ge",
  geq: "ge",
  preceq: "le",
  succeq: "ge",
  approx: "approx",
  sim: "approx",
  simeq: "approx",
  equiv: "=",
  neq: "other",
  ne: "other",
  propto: "propto",
  coloneqq: ":=",
  Rightarrow: "=>",
  implies: "=>",
  iff: "<=>",
  Leftrightarrow: "<=>",
  to: "other",
  mapsto: "other",
  in: "other",
  notin: "other",
  subset: "other",
  subseteq: "other",
  supset: "other",
  supseteq: "other",
  models: "other",
  indep: "other",
  independent: "other"
};
var NON_OPERAND_COMMANDS = /* @__PURE__ */ new Set([
  ...Object.keys(RELATION_COMMANDS),
  "text",
  "nonumber",
  "notag",
  "label",
  "tag",
  "hline",
  "cline",
  "rangle"
]);
var EOF_TOKEN = { type: "eof", value: "", from: 0, to: 0 };
var DIVERGENCES = /* @__PURE__ */ new Set(["d", "kl", "d_kl", "dkl", "div", "chi"]);
function plainName(name) {
  return name.replace(/^(\\[A-Za-z]+)+/, "").toLowerCase();
}
var Parser = class _Parser {
  /** how far the parser has read: the tokens after it are the ones it did not use */
  pos = 0;
  /** is the next factor the first of its product? */
  firstFactor = false;
  /** is the parser inside the arguments of a divergence? */
  inDivergence = false;
  /** stop a product at a bar, so a call can read a condition */
  stopAtBar = false;
  tokens;
  opts;
  constructor(tokens, _src, opts = {}) {
    this.tokens = tokens;
    this.opts = opts;
  }
  get cur() {
    return this.tokens[this.pos] ?? EOF_TOKEN;
  }
  /** The type of the current token, without narrowing the token itself. */
  kind() {
    return (this.tokens[this.pos] ?? EOF_TOKEN).type;
  }
  expect(type, what) {
    if (this.kind() !== type) {
      throw new ParseFailure(`expected ${what}`, { from: this.cur.from, to: this.cur.to });
    }
    const t = this.cur;
    this.pos++;
    return t;
  }
  // ---------------------------------------------------------------- symbols
  /**
   * Does this name look like a function?
   *
   * The known functions always do. A name that starts with a lowercase letter
   * usually does, because a capital name is a matrix in this notation.
   */
  looksLikeCall(name) {
    if (this.isFnName(name)) return true;
    if (this.opts.knownFns?.has(name)) return true;
    if (this.firstFactor) return true;
    const first = name[0];
    return first !== void 0 && /[a-z]/.test(first);
  }
  isFnName(name) {
    if (this.opts.knownFns?.has(name)) return true;
    return DEFAULT_FUNCTIONS.has(name);
  }
  makeSym(accents, base2, sub2, labelSup, span) {
    const prefix = accents.map((a) => `\\${a}`).join("");
    let name = prefix + base2;
    if (sub2) name += `_${sub2}`;
    if (labelSup) name += `^${labelSup}`;
    return { k: "sym", name, display: toDisplay(name), span };
  }
  /** Reads the body of a braced group as raw text, for subscripts and labels. */
  rawGroupText() {
    const open = this.expect("lbrace", "{");
    const start = this.pos;
    let depth = 1;
    let end = open.to;
    while (this.pos < this.tokens.length) {
      const t = this.cur;
      if (t.type === "lbrace") depth++;
      if (t.type === "rbrace") {
        depth--;
        if (depth === 0) {
          end = t.to;
          this.pos++;
          break;
        }
      }
      this.pos++;
    }
    const text = renderTokens(this.tokens.slice(start, this.pos - 1)).trim();
    return { text, span: { from: open.from, to: end } };
  }
  /**
   * Reads the two halves of a fraction.
   *
   * \frac{1}{2} is the usual form, but \frac12 is also common, where the two
   * digits share one token.
   */
  readFractionParts() {
    if (this.kind() === "lbrace") {
      const num2 = this.rawGroupText();
      const den2 = this.readGroupOrToken();
      return { num: num2, den: den2 };
    }
    const first = this.cur;
    if (first.type === "num" && first.value.length >= 2) {
      this.pos++;
      const numText = first.value.slice(0, 1);
      const denText = first.value.slice(1);
      return {
        num: { text: numText, span: { from: first.from, to: first.from + 1 } },
        den: { text: denText, span: { from: first.from + 1, to: first.to } }
      };
    }
    const num = this.readGroupOrToken();
    const den = this.readGroupOrToken();
    return { num, den };
  }
  /** Reads a group, or a single token when the group is omitted (\frac12). */
  readGroupOrToken() {
    if (this.kind() === "lbrace") return this.rawGroupText();
    const t = this.cur;
    this.pos++;
    return { text: t.type === "cmd" ? `\\${t.value}` : t.value, span: { from: t.from, to: t.to } };
  }
  /**
   * Reads the variable of a proportionality, the subscript of \\propto.
   *
   * It returns the name of the variable and how many tokens it took, so the
   * caller can drop them from the right hand side.
   */
  readProportionalityVariable() {
    const start = this.pos;
    this.pos++;
    const sub2 = this.readSubscript();
    return { name: sub2.text, tokens: this.pos - start };
  }
  /** Reads a subscript, which may be a group or a single token. */
  readSubscript() {
    if (this.kind() === "lbrace") return this.rawGroupText();
    const t = this.cur;
    this.pos++;
    return { text: t.value, span: { from: t.from, to: t.to } };
  }
  /** Reads a superscript, which may be a group or a single token. */
  readSuperscript() {
    if (this.kind() === "lbrace") {
      const start = this.pos;
      const { text: text2, span } = this.rawGroupText();
      const tokens = this.tokens.slice(start + 1, this.pos - 1);
      return { text: text2, tokens, span };
    }
    const t = this.cur;
    this.pos++;
    const text = t.type === "cmd" ? `\\${t.value}` : t.value;
    return { text, tokens: [t], span: { from: t.from, to: t.to } };
  }
  // --------------------------------------------------------------- scripts
  /**
   * Applies the sub and superscripts of a symbol.
   *
   * A superscript can mean transpose, inverse, a power, or nothing at all
   * (a label such as the plus in P^+). Only the first three change the
   * meaning of the expression.
   */
  applyScripts(base2, accents, baseLatex) {
    let sub2 = null;
    let labelSup = null;
    let spanEnd = base2.span.to;
    const scripts = [];
    for (; ; ) {
      if (this.kind() === "sub" && sub2 === null) {
        this.pos++;
        const s = this.readSubscript();
        sub2 = s.text;
        spanEnd = s.span.to;
        continue;
      }
      if (this.kind() === "sup") {
        this.pos++;
        const sup = this.readSuperscript();
        const classified = classifySuperscript(sup.text);
        spanEnd = sup.span.to;
        if (classified.kind === "label") {
          labelSup = sup.text;
          continue;
        }
        scripts.push({
          kind: classified.kind,
          text: classified.kind === "power" ? classified.powerText : void 0,
          to: sup.span.to
        });
        continue;
      }
      break;
    }
    let node = base2;
    if (node.k === "sym") {
      const indexNotation = sub2 !== null && /^[ijk]$/.test(sub2.trim()) && /^[A-Za-z]$/.test(baseLatex);
      node = indexNotation ? {
        k: "raw",
        text: `an indexed symbol ${baseLatex}_${sub2}`,
        span: { from: node.span.from, to: spanEnd }
      } : this.makeSym(accents, baseLatex, sub2, labelSup, {
        from: node.span.from,
        to: spanEnd
      });
    }
    for (const script of scripts) {
      const span = { from: node.span.from, to: script.to };
      if (script.kind === "transpose") {
        node = { k: "op", op: "T", args: [node], span };
      } else if (script.kind === "inverse") {
        node = { k: "op", op: "inv", args: [node], span };
      } else if (script.kind === "inverseT") {
        node = { k: "op", op: "invT", args: [node], span };
      } else if (script.kind === "sqrtm") {
        node = { k: "op", op: "sqrtm", args: [node], span };
      } else if (script.kind === "invSqrtm") {
        node = { k: "op", op: "inv", args: [{ k: "op", op: "sqrtm", args: [node], span }], span };
      } else {
        const exp2 = { k: "num", value: ratFromDecimal(script.text ?? "2"), span: { from: node.span.from, to: script.to } };
        node = { k: "op", op: "pow", args: [node, exp2], span };
      }
    }
    return node;
  }
  // ------------------------------------------------------------ expressions
  /** Parses a full expression at the lowest precedence level. */
  parseExpression() {
    return this.parseAdditive();
  }
  parseAdditive() {
    let left = this.parseRatio();
    for (; ; ) {
      const t = this.cur;
      if (t.type === "op" && (t.value === "+" || t.value === "-")) {
        this.pos++;
        const right = this.parseRatio();
        left = {
          k: "op",
          op: t.value === "+" ? "add" : "sub",
          args: [left, right],
          span: { from: left.span.from, to: right.span.to }
        };
        continue;
      }
      if (t.type === "csym" && (t.value === "+" || t.value === "-")) {
        this.pos++;
        const right = this.parseRatio();
        left = {
          k: "op",
          op: t.value === "+" ? "add" : "sub",
          args: [left, right],
          span: { from: left.span.from, to: right.span.to }
        };
        continue;
      }
      return left;
    }
  }
  parseRatio() {
    let left = this.parseProduct();
    while (this.kind() === "op" && this.cur.value === "/") {
      this.pos++;
      const right = this.parseProduct();
      left = { k: "op", op: "div", args: [left, right], span: { from: left.span.from, to: right.span.to } };
    }
    return left;
  }
  parseProduct() {
    this.firstFactor = true;
    let left = this.parseUnary();
    this.firstFactor = false;
    for (; ; ) {
      const t = this.cur;
      let op = null;
      if (t.type === "op" && t.value === "*") op = "mul";
      else if (t.type === "cmd" && (t.value === "cdot" || t.value === "times" || t.value === "ast" || t.value === "circ")) op = "mul";
      else if (t.type === "cmd" && t.value === "otimes") op = "kron";
      else if (t.type === "cmd" && t.value === "odot") op = "had";
      else if (t.type === "cmd" && t.value === "oslash") op = "had";
      else if (t.type === "op" && t.value === "\\") op = "mul";
      if (op) {
        this.pos++;
        const right = this.parseUnary();
        left = { k: "op", op, args: [left, right], span: { from: left.span.from, to: right.span.to } };
        continue;
      }
      if (this.startsOperand()) {
        const right = this.parseUnary();
        left = { k: "op", op: "mul", args: [left, right], span: { from: left.span.from, to: right.span.to } };
        continue;
      }
      return left;
    }
  }
  /** Can the current token start an operand? */
  startsOperand() {
    const t = this.cur;
    switch (t.type) {
      case "num":
      case "ident":
      case "lbrace":
      case "lparen":
      case "lbrack":
      case "begin":
        return true;
      case "cmd":
        return !NON_OPERAND_COMMANDS.has(t.value) && !["left", "right"].includes(t.value) && t.value !== "nonumber";
      // A bar can start a norm or an absolute value. The parser finds the
      // matching bar before it parses what is inside, so the closing bar is
      // never mistaken for the start of another factor. In a call, the bar
      // is a condition and has to be left for parseArgs.
      case "op":
        return t.value === "." && this.tokens[this.pos + 1]?.value === "." && this.tokens[this.pos + 2]?.value === ".";
      case "csym":
        if (this.stopAtBar && (t.value === "|" || t.value === "\\|")) {
          return this.barAhead(t.value);
        }
        return t.value !== "'";
      default:
        return false;
    }
  }
  /** Is there a matching bar ahead, so this bar opens a norm or an absolute value? */
  barAhead(kind) {
    let depth = 0;
    for (let i2 = this.pos + 1; i2 < this.tokens.length; i2++) {
      const t = this.tokens[i2];
      if (t.type === "lparen" || t.type === "lbrack" || t.type === "lbrace") depth++;
      else if (t.type === "rparen" || t.type === "rbrack" || t.type === "rbrace") {
        if (depth > 0) depth--;
      } else if (depth === 0 && t.type === "csym" && t.value === kind) {
        return true;
      }
    }
    return false;
  }
  parseUnary() {
    const t = this.cur;
    if (t.type === "op" && t.value === "-") {
      this.pos++;
      const arg = this.parseUnary();
      return { k: "op", op: "neg", args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
    }
    if (t.type === "op" && t.value === "+") {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePostfix();
  }
  parsePostfix() {
    let node = this.parsePrimary();
    for (; ; ) {
      const t = this.cur;
      if (t.type === "sup") {
        this.pos++;
        const sup = this.readSuperscript();
        const classified = classifySuperscript(sup.text);
        if (classified.kind === "transpose") {
          node = { k: "op", op: "T", args: [node], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === "inverse") {
          node = { k: "op", op: "inv", args: [node], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === "inverseT") {
          node = { k: "op", op: "invT", args: [node], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === "sqrtm") {
          node = { k: "op", op: "sqrtm", args: [node], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === "invSqrtm") {
          const root = { k: "op", op: "sqrtm", args: [node], span: sup.span };
          node = { k: "op", op: "inv", args: [root], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === "power") {
          const exp2 = { k: "num", value: ratFromDecimal(classified.powerText), span: sup.span };
          node = { k: "op", op: "pow", args: [node, exp2], span: { from: node.span.from, to: sup.span.to } };
        } else {
          node = {
            k: "raw",
            text: `superscript {${sup.text}} on a non symbol`,
            span: { from: node.span.from, to: sup.span.to }
          };
        }
        continue;
      }
      if (t.type === "sub") {
        this.pos++;
        const sub2 = this.readSubscript();
        node = {
          k: "raw",
          text: `subscript {${sub2.text}} on a non symbol`,
          span: { from: node.span.from, to: sub2.span.to }
        };
        continue;
      }
      if (t.type === "csym" && t.value === "'") {
        this.pos++;
        if (node.k === "sym") {
          node = this.makeSym([], node.name + "'", null, null, { from: node.span.from, to: t.to });
        } else {
          node = { k: "op", op: "T", args: [node], span: { from: node.span.from, to: t.to } };
        }
        continue;
      }
      if (t.type === "op" && t.value === "!") {
        this.pos++;
        node = { k: "op", op: "pow", args: [node, { k: "num", value: { n: 1, d: 1 }, span: { from: t.from, to: t.to } }], span: { from: node.span.from, to: t.to } };
        continue;
      }
      return node;
    }
  }
  parsePrimary() {
    const t = this.cur;
    switch (t.type) {
      case "num": {
        this.pos++;
        return { k: "num", value: ratFromDecimal(t.value), span: { from: t.from, to: t.to } };
      }
      case "ident": {
        this.pos++;
        if (t.value.length > 1 && !this.isFnName(t.value)) {
          const parts = [];
          for (let i2 = 0; i2 < t.value.length; i2++) {
            const ch = t.value[i2];
            const sym2 = this.makeSym([], ch, null, null, { from: t.from + i2, to: t.from + i2 + 1 });
            parts.push(i2 === t.value.length - 1 ? this.applyScripts(sym2, [], ch) : sym2);
          }
          return parts.reduce((a, b) => ({
            k: "op",
            op: "mul",
            args: [a, b],
            span: { from: a.span.from, to: b.span.to }
          }));
        }
        if (t.value === "e" && this.kind() === "sup") {
          this.pos++;
          const sup = this.readSuperscript();
          const inner2 = new _Parser(sup.tokens, "", this.opts).parseExpression();
          return { k: "call", fn: "exp", args: [inner2], span: { from: t.from, to: sup.span.to } };
        }
        const sym = this.makeSym([], t.value, null, null, { from: t.from, to: t.to });
        const scripted = this.applyScripts(sym, [], t.value);
        const power = scripted.k === "op" && scripted.op === "pow" && scripted.args[0]?.k === "sym" ? scripted : null;
        if (this.kind() === "lparen" && (scripted.k === "sym" || power) && this.looksLikeCall(t.value)) {
          const wasDivergence = this.inDivergence;
          this.inDivergence = DIVERGENCES.has(plainName(t.value));
          const { args, unknown } = this.parseArgs();
          this.inDivergence = wasDivergence;
          const call = this.makeCall(t.value, t.from, args, unknown);
          const exponent = power?.args[1];
          if (!exponent) return call;
          return { k: "op", op: "pow", args: [call, exponent], span: { from: call.span.from, to: call.span.to } };
        }
        return scripted;
      }
      case "lparen":
        return this.parseParenthesized();
      case "lbrace": {
        return this.parseGroupAsExpression();
      }
      case "op":
        if (t.value === "*") {
          if (!this.startsOperand()) {
            this.pos++;
            return { k: "raw", text: "a star", span: { from: t.from, to: t.to } };
          }
          this.pos++;
          const right = this.parseUnary();
          return {
            k: "op",
            op: "mul",
            args: [
              { k: "num", value: { n: 1, d: 1 }, span: { from: t.from, to: t.to } },
              right
            ],
            span: { from: t.from, to: right.span.to }
          };
        }
        if (t.value === "." && this.tokens[this.pos + 1]?.type === "op" && this.tokens[this.pos + 1]?.value === "." && this.tokens[this.pos + 2]?.type === "op" && this.tokens[this.pos + 2]?.value === ".") {
          const last = this.tokens[this.pos + 2];
          this.pos += 3;
          return { k: "raw", text: "an ellipsis", span: { from: t.from, to: last.to } };
        }
        if (t.value === ".") {
          this.pos++;
          return { k: "raw", text: "an evaluation bar", span: { from: t.from, to: t.to } };
        }
        break;
      case "lbrack":
        return this.parseBareBracket();
      case "cmd":
        return this.parseCommand();
      case "csym":
        if (t.value === "\\|") return this.parseNorm();
        if (t.value === "|") return this.parseBars();
        if (t.value === "\\") {
          this.pos++;
          return { k: "raw", text: "line break", span: { from: t.from, to: t.to } };
        }
        this.pos++;
        return { k: "raw", text: `\\${t.value}`, span: { from: t.from, to: t.to } };
      case "begin":
        return this.parseMatrixEnv();
      default:
        break;
    }
    throw new ParseFailure(`unexpected ${describeToken(t)}`, { from: t.from, to: t.to });
  }
  /** A parenthesised expression, a tuple, or a condition. */
  parseParenthesized() {
    const open = this.expect("lparen", "(");
    return this.parseDelimited(open, "rparen", ")");
  }
  /** A bracketed expression, a tuple, or an expectation argument. */
  parseBracketed() {
    const open = this.expect("lbrack", "[");
    return this.parseDelimited(open, "rbrack", "]");
  }
  /** One expression inside a group, stopped before a conditional bar. */
  parseGroupExpression() {
    const was = this.stopAtBar;
    this.stopAtBar = true;
    try {
      return this.parseExpression();
    } finally {
      this.stopAtBar = was;
    }
  }
  /**
   * Reads a delimited group.
   *
   * A group can hold a list, `(a, b)`, or a condition, `(x \mid y)`. Neither
   * is an expression of its own, so both become one named unknown instead of
   * a parse error.
   */
  parseDelimited(open, closeType, closeText) {
    const condition = this.groupRelation();
    if (condition) {
      const close2 = this.tokens[condition.close];
      this.pos = condition.close + 1;
      return { k: "raw", text: "a relation inside a group", span: { from: open.from, to: close2.to } };
    }
    const parts = [];
    if (this.kind() !== closeType) {
      parts.push(this.parseGroupExpression());
      while (this.kind() === "comma" || this.kind() === "semi") {
        this.pos++;
        parts.push(this.parseGroupExpression());
      }
      if (this.kind() === "csym" && (this.cur.value === "|" || this.cur.value === "\\|")) {
        this.pos++;
        this.skipToClose(closeType);
        if (this.kind() === closeType) {
          const close2 = this.cur;
          this.pos++;
          return { k: "raw", text: "a relation inside a group", span: { from: open.from, to: close2.to } };
        }
        return { k: "raw", text: "an unclosed group", span: { from: open.from, to: open.to } };
      }
    }
    if (this.kind() === "eof" || this.kind() === "end") {
      const last = this.tokens[Math.max(0, this.pos - 1)] ?? open;
      return { k: "raw", text: "an unclosed group", span: { from: open.from, to: last.to } };
    }
    const close = this.expect(closeType, closeText);
    if (parts.length > 1) {
      return { k: "raw", text: "a list", span: { from: open.from, to: close.to } };
    }
    if (!parts.length) {
      return { k: "raw", text: "an empty group", span: { from: open.from, to: close.to } };
    }
    return { ...parts[0], span: { from: open.from, to: close.to } };
  }
  /**
   * Finds a relation inside the group that starts at the previous token.
   *
   * A condition such as `(M > \sqrt{n})` or a set such as `\{x : x = 1\}`
   * is not an expression SAMOSA can evaluate, but it is not a parse error
   * either. The whole group becomes one named unknown.
   */
  groupRelation() {
    const open = this.tokens[this.pos - 1];
    if (!open) return null;
    const stack = [
      open.type === "lparen" ? "rparen" : open.type === "lbrack" ? "rbrack" : "rbrace"
    ];
    for (let i2 = this.pos; i2 < this.tokens.length; i2++) {
      const t = this.tokens[i2];
      if (t.type === "lparen") stack.push("rparen");
      else if (t.type === "lbrack") stack.push("rbrack");
      else if (t.type === "lbrace") stack.push("rbrace");
      else if (t.type === "rparen" || t.type === "rbrack" || t.type === "rbrace") {
        if (stack[stack.length - 1] !== t.type) return null;
        stack.pop();
        if (!stack.length) {
          return findRelations(this.tokens.slice(this.pos, i2)).length ? { close: i2 } : null;
        }
      }
    }
    return null;
  }
  parseGroupAsExpression() {
    const open = this.expect("lbrace", "{");
    return this.parseDelimited(open, "rbrace", "}");
  }
  parseBareBracket() {
    return this.parseBracketed();
  }
  /**
   * The end of a call.
   *
   * The closing bracket is part of the call, so the span of the call has to
   * cover it: an edit over the call replaces the whole of it.
   */
  closingParen(fallback, args) {
    const last = this.tokens[this.pos - 1];
    if (last && (last.type === "rparen" || last.type === "rbrack")) return last.to;
    return args.at(-1)?.span.to ?? fallback;
  }
  parseArgs() {
    this.expect("lparen", "(");
    const args = [];
    let unknown = null;
    if (this.kind() !== "rparen") {
      for (; ; ) {
        args.push(this.parseArgExpression());
        if (this.atRelation()) {
          this.skipToCloseParen();
          this.expect("rparen", ")");
          unknown ??= "a relation inside a group";
          return { args, unknown };
        }
        if (this.kind() === "comma" || this.kind() === "semi") {
          this.pos++;
          continue;
        }
        if (this.kind() === "csym" && this.cur.value === "\\|" && this.inDivergence) {
          this.pos++;
          args.push(this.parseArgExpression());
          if (this.kind() === "comma" || this.kind() === "semi") {
            this.pos++;
            continue;
          }
          break;
        }
        if (this.kind() === "csym" && this.cur.value === "|") {
          this.pos++;
          unknown = "a conditional distribution";
          args.push(this.parseArgExpression());
          if (this.atRelation()) {
            this.skipToCloseParen();
            this.expect("rparen", ")");
            return { args, unknown };
          }
          if (this.kind() === "comma" || this.kind() === "semi") {
            this.pos++;
            continue;
          }
          break;
        }
        break;
      }
    }
    this.expect("rparen", ")");
    return { args, unknown };
  }
  /**
   * One argument of a call.
   *
   * The bar is the separator of a conditional, so the product rule must not
   * swallow it as the start of another absolute value.
   */
  parseArgExpression() {
    const was = this.stopAtBar;
    this.stopAtBar = true;
    try {
      return this.parseExpression();
    } finally {
      this.stopAtBar = was;
    }
  }
  /** Is the next token a relation that the expression parser stopped at? */
  atRelation() {
    const t = this.cur;
    if (t.type === "op" && (t.value === "=" || t.value === "<" || t.value === ">" || t.value === ":")) return true;
    return t.type === "cmd" && RELATION_COMMANDS[t.value] !== void 0;
  }
  /** Moves to the closing delimiter of the group being read. */
  skipToClose(close) {
    let depth = 0;
    for (; this.pos < this.tokens.length; this.pos++) {
      const t = this.tokens[this.pos];
      if (t.type === "lparen" || t.type === "lbrack" || t.type === "lbrace") depth++;
      else if (t.type === "rparen" || t.type === "rbrack" || t.type === "rbrace") {
        if (depth === 0 && t.type === close) return;
        if (depth > 0) depth--;
      }
    }
  }
  skipToCloseParen() {
    this.skipToClose("rparen");
  }
  /**
   * A call, unless its arguments hold a conditional bar. The engine has no
   * model of a conditional distribution, so the row is read and left
   * unchecked with that reason rather than guessed at.
   */
  makeCall(fn, from, args, unknown) {
    const span = { from, to: this.closingParen(from, args) };
    if (unknown) return { k: "raw", text: unknown, span };
    return { k: "call", fn, args, span };
  }
  parseCommand() {
    const t = this.cur;
    const name = t.value;
    switch (name) {
      case "frac":
      case "dfrac":
      case "tfrac": {
        this.pos++;
        const parts = this.readFractionParts();
        return this.parseFraction(parts.num, parts.den, { from: t.from, to: parts.den.span.to });
      }
      case "sqrt": {
        this.pos++;
        let index = null;
        if (this.kind() === "lbrack") {
          this.pos++;
          index = this.parseExpression();
          this.expect("rbrack", "]");
        }
        const arg = this.kind() === "lbrace" ? this.parseGroupAsExpression() : this.parsePrimary();
        if (index) {
          const two = index.k === "num" && index.value.n === 2 && index.value.d === 1;
          if (!two) {
            const reason = index.k === "num" ? `the root of index ${index.value.n} is not read; only the square root is` : "the root with a symbolic index is not read; only the square root is";
            return {
              k: "raw",
              text: reason,
              span: { from: t.from, to: this.closingParen(t.to, [arg]) }
            };
          }
        }
        return { k: "call", fn: "sqrt", args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
      }
      case "nabla": {
        this.pos++;
        return this.parseDerivativeAfterNabla(t);
      }
      case "partial": {
        this.pos++;
        return this.parseDerivativeAfterPartial(t);
      }
      case "sum":
      case "prod": {
        this.pos++;
        return this.parseBigOp(t);
      }
      case "langle":
      case "rangle": {
        this.pos++;
        if (name === "langle") {
          const a = this.parseExpression();
          if (this.kind() !== "comma") {
            const close2 = this.expect("cmd", "\\rangle");
            return { k: "raw", text: "an angle bracket with one argument", span: { from: t.from, to: close2.to } };
          }
          this.pos++;
          const b = this.parseExpression();
          const close = this.expect("cmd", "\\rangle");
          return { k: "op", op: "inner", args: [a, b], span: { from: t.from, to: close.to } };
        }
        break;
      }
      case "mathrm":
      case "operatorname":
      case "mathsf":
      case "mathtt": {
        this.pos++;
        if (name === "operatorname" && this.kind() === "op" && this.cur.value === "*") this.pos++;
        const g = this.kind() === "lbrace" ? this.rawGroupText() : (() => {
          const t2 = this.cur;
          this.pos++;
          return { text: t2.type === "cmd" ? `\\${t2.value}` : t2.value, span: { from: t2.from, to: t2.to } };
        })();
        const text = g.text.trim();
        if (text === "d") {
          const arg = this.parsePrimary();
          return {
            k: "deriv",
            f: arg,
            wrt: [],
            order: 1,
            form: "diff",
            span: { from: t.from, to: this.closingParen(t.to, [arg]) }
          };
        }
        if (this.kind() === "lparen") {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(text.toLowerCase(), t.from, args, unknown);
        }
        const sym = this.makeSym([name], text, null, null, { from: t.from, to: g.span.to });
        const scripted = this.applyScripts(sym, [name], text);
        if (text.toLowerCase() === "e" || text.toLowerCase() === "var" || text.toLowerCase() === "cov") {
          if (this.kind() === "lbrack") {
            return this.finishExpectation({ from: t.from, to: g.span.to }, text.toLowerCase());
          }
          return scripted;
        }
        const lower = text.toLowerCase();
        if (this.isFnName(lower)) {
          if (this.kind() === "lbrace") {
            const arg = this.parseGroupAsExpression();
            return { k: "call", fn: lower, args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
          }
          const operand2 = this.kind();
          if (operand2 === "ident" || operand2 === "begin" || operand2 === "cmd" && !NON_OPERAND_COMMANDS.has(this.cur.value)) {
            const arg = this.parsePrimary();
            return { k: "call", fn: lower, args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
          }
        }
        return scripted;
      }
      case "mathbb": {
        this.pos++;
        const g = this.kind() === "lbrace" ? this.rawGroupText() : (() => {
          const t2 = this.cur;
          this.pos++;
          return { text: t2.type === "cmd" ? `\\${t2.value}` : t2.value, span: { from: t2.from, to: t2.to } };
        })();
        const base2 = g.text.trim();
        const sym = this.makeSym(["mathbb"], base2, null, null, { from: t.from, to: g.span.to });
        if (base2 === "E" || base2 === "V") {
          return this.finishExpectation({ from: t.from, to: g.span.to }, base2 === "E" ? "E" : "Var");
        }
        if (base2 === "P" && this.kind() === "lparen") {
          const { args, unknown } = this.parseArgs();
          return this.makeCall("P", t.from, args, unknown);
        }
        return this.applyScripts(sym, ["mathbb"], base2);
      }
      case "det":
      case "exp":
      case "log":
      case "ln":
      case "sin":
      case "cos":
      case "tan":
      case "tanh":
      case "sigmoid":
      case "sigma":
      case "relu":
      case "softmax": {
        this.pos++;
        if (name === "sigma" && this.kind() !== "lparen") {
          const sym2 = this.makeSym([], "\\sigma", null, null, { from: t.from, to: t.to });
          return this.applyScripts(sym2, [], "\\sigma");
        }
        if (this.kind() === "lparen") {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(name === "sigma" ? "sigmoid" : name, t.from, args, unknown);
        }
        if (this.kind() === "lbrace") {
          const arg = this.parseGroupAsExpression();
          return { k: "call", fn: name === "sigma" ? "sigmoid" : name, args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
        }
        const nextKind = this.kind();
        if (nextKind === "ident" || nextKind === "begin" || nextKind === "cmd" && !NON_OPERAND_COMMANDS.has(this.cur.value)) {
          const arg = this.parsePrimary();
          return {
            k: "call",
            fn: name === "sigma" ? "sigmoid" : name,
            args: [arg],
            span: { from: t.from, to: this.closingParen(t.to, [arg]) }
          };
        }
        const sym = this.makeSym([], name, null, null, { from: t.from, to: t.to });
        return this.applyScripts(sym, [], name);
      }
      case "text": {
        this.pos++;
        const g = this.rawGroupText();
        return { k: "raw", text: g.text, span: { from: t.from, to: g.span.to } };
      }
      default:
        break;
    }
    if (GREEK.has(name) || SYMBOL_COMMANDS.has(name)) {
      this.pos++;
      const sym = this.makeSym([], `\\${name}`, null, null, { from: t.from, to: t.to });
      const scripted = this.applyScripts(sym, [], `\\${name}`);
      const power = scripted.k === "op" && scripted.op === "pow" && scripted.args[0]?.k === "sym" ? scripted : null;
      if (this.kind() === "lparen" && (scripted.k === "sym" || power)) {
        const { args, unknown } = this.parseArgs();
        const call = this.makeCall(`\\${name}`, t.from, args, unknown);
        const exponent = power?.args[1];
        if (!exponent) return call;
        return { k: "op", op: "pow", args: [call, exponent], span: { from: call.span.from, to: call.span.to } };
      }
      return scripted;
    }
    if (ACCENTS.has(name)) {
      const accentSpan = { from: t.from, to: t.to };
      this.pos++;
      const base2 = this.parseAccentBase(name, accentSpan);
      if (base2.k === "sym" && this.kind() === "lparen") {
        const density = base2.name.match(/^\\mathcal([NU])$/);
        if (density) {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(
            density[1] === "N" ? "normalDensity" : "uniformDensity",
            base2.span.from,
            args,
            unknown
          );
        }
        const plain = base2.name.startsWith(`\\${name}`) ? base2.name.slice(name.length + 1) : plainName(base2.name);
        if (this.looksLikeCall(plain)) {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(base2.name, base2.span.from, args, unknown);
        }
      }
      return base2;
    }
    if (name === "begin") {
      return this.parseMatrixEnv();
    }
    this.pos++;
    return { k: "raw", text: `\\${name}`, span: { from: t.from, to: t.to } };
  }
  /** Reads the base of an accent: a letter, a single symbol, or a one item group. */
  parseAccentBase(accent, accentSpan) {
    let baseLatex;
    let span = { from: accentSpan.from, to: accentSpan.to };
    let accents = [];
    if (this.kind() === "ident") {
      const t = this.cur;
      this.pos++;
      baseLatex = t.value;
      span = { from: accentSpan.from, to: t.to };
    } else if (this.kind() === "lbrace") {
      const g = this.rawGroupText();
      span = { from: accentSpan.from, to: g.span.to };
      const inner2 = new _Parser(tokenize(g.text), g.text, this.opts);
      const node = inner2.parsePrimary();
      if (node.k === "sym") {
        baseLatex = node.name;
        span = { from: g.span.from, to: g.span.to };
      } else {
        return { k: "raw", text: `\\${accent}{...}`, span };
      }
    } else if (this.kind() === "cmd") {
      if (GREEK.has(this.cur.value) || SYMBOL_COMMANDS.has(this.cur.value)) {
        const t = this.cur;
        this.pos++;
        baseLatex = `\\${t.value}`;
        span = { from: accentSpan.from, to: t.to };
      } else {
        const sub2 = this.parseCommand();
        if (sub2.k === "sym") {
          baseLatex = sub2.name;
          span = { from: sub2.span.from, to: sub2.span.to };
        } else {
          return { k: "raw", text: `\\${accent}{...}`, span };
        }
      }
    } else {
      const t = this.cur;
      this.pos++;
      baseLatex = t.value;
      span = { from: accentSpan.from, to: t.to };
    }
    if (baseLatex.startsWith("\\") && GLYPH_ACCENTS.has(baseLatex.slice(1).split("{")[0])) {
      const innerAccent = baseLatex.slice(1).split("{")[0];
      const rest = baseLatex.slice(1 + innerAccent.length).replace(/^\{|\}$/g, "");
      accents = [innerAccent];
      baseLatex = rest;
    }
    const sym = this.makeSym([accent], baseLatex, null, null, span);
    const scripted = this.applyScripts(sym, [accent, ...accents], baseLatex);
    return scripted;
  }
  /** \frac{...}{...}: either an ordinary fraction or a derivative. */
  parseFraction(num, den, span) {
    const numTokens = tokenize(num.text);
    const denTokens = tokenize(den.text);
    const numIsPartial = numTokens[0]?.type === "cmd" && numTokens[0].value === "partial";
    const denIsPartial = denTokens[0]?.type === "cmd" && denTokens[0].value === "partial";
    if (numIsPartial || denIsPartial) {
      return this.buildDerivative(numTokens, denTokens, span);
    }
    const numParser = new _Parser(numTokens, num.text, this.opts);
    const denParser = new _Parser(denTokens, den.text, this.opts);
    const numerator = numParser.parseExpression();
    const denominator = denParser.parseExpression();
    return {
      k: "op",
      op: "div",
      args: [numerator, denominator],
      span
    };
  }
  /** Builds a derivative node from a numerator and denominator token slice. */
  buildDerivative(numTokens, denTokens, span) {
    let order = 1;
    let numStart = 0;
    if (numTokens[0]?.value === "partial") {
      numStart = 1;
      if (numTokens[numStart]?.type === "sup") {
        const text = numTokens[numStart + 1]?.value ?? "";
        if (text === "2") order = 2;
        numStart += 2;
      }
    }
    const numParser = new _Parser(numTokens.slice(numStart), "", this.opts);
    const f = numParser.parseExpression();
    const wrt = [];
    let denOrder = 1;
    let i2 = 0;
    while (i2 < denTokens.length) {
      const t = denTokens[i2];
      if (t.type === "cmd" && t.value === "partial") {
        i2++;
        let nameEnd = i2;
        let text = "";
        if (denTokens[i2]?.type === "ident") {
          text = denTokens[i2].value;
          nameEnd = i2 + 1;
        } else if (denTokens[i2]?.type === "lbrace") {
          let depth = 1;
          let j = i2 + 1;
          while (j < denTokens.length && depth > 0) {
            if (denTokens[j].type === "lbrace") depth++;
            if (denTokens[j].type === "rbrace") {
              depth--;
              if (depth === 0) break;
            }
            j++;
          }
          text = renderTokens(denTokens.slice(i2 + 1, j));
          nameEnd = j;
        }
        let sub2 = null;
        let k = nameEnd;
        while (k < denTokens.length && (denTokens[k].type === "sub" || denTokens[k].type === "sup")) {
          if (denTokens[k].type === "sub") {
            k++;
            if (denTokens[k]?.type === "lbrace") {
              let depth = 1;
              let j = k + 1;
              while (j < denTokens.length && depth > 0) {
                if (denTokens[j].type === "lbrace") depth++;
                if (denTokens[j].type === "rbrace") {
                  depth--;
                  if (depth === 0) break;
                }
                j++;
              }
              sub2 = renderTokens(denTokens.slice(k + 1, j));
              k = j + 1;
            } else if (denTokens[k]) {
              sub2 = denTokens[k].value;
              k += 1;
            }
          } else {
            const sup = denTokens[k + 1];
            const supText = sup?.value ?? "";
            if (supText === "2") denOrder = 2;
            k += 2;
          }
        }
        wrt.push({
          k: "sym",
          name: sub2 ? `${text}_${sub2}` : text,
          display: toDisplay(sub2 ? `${text}_${sub2}` : text),
          span: { from: t.from, to: k > 0 ? denTokens[Math.min(k, denTokens.length) - 1].to : t.to }
        });
        i2 = k;
        continue;
      }
      i2++;
    }
    if (wrt.length >= 2) denOrder = 2;
    if (order === 1 && denOrder === 2) order = 2;
    const form = order === 2 ? "hess" : "grad";
    return { k: "deriv", f, wrt, order, form, span };
  }
  parseDerivativeAfterNabla(t) {
    const wrt = [];
    if (this.kind() === "sub") {
      this.pos++;
      const s = this.readSubscript();
      wrt.push({ k: "sym", name: s.text, display: toDisplay(s.text), span: s.span });
    }
    let order = 1;
    if (this.kind() === "sup") {
      this.pos++;
      const sup = this.readSuperscript();
      if (sup.text === "2") order = 2;
    }
    const f = this.parsePrimary();
    return {
      k: "deriv",
      f,
      wrt,
      order,
      form: order === 2 ? "hess" : "grad",
      span: { from: t.from, to: f.span.to }
    };
  }
  parseDerivativeAfterPartial(t) {
    const f = this.parsePrimary();
    return {
      k: "deriv",
      f,
      wrt: [],
      order: 1,
      form: "grad",
      span: { from: t.from, to: f.span.to }
    };
  }
  finishExpectation(span, kind) {
    let over = [];
    let idxText = null;
    if (this.kind() === "sub") {
      this.pos++;
      const s = this.readSubscript();
      idxText = s.text;
    }
    if (idxText) {
      const m = idxText.match(/([A-Za-z]+)\s*~/);
      if (m) over = [m[1]];
    }
    const op = kind === "var" ? "Var" : kind === "cov" ? "Cov" : "E";
    if (this.kind() === "lbrack") {
      this.pos++;
      const args = [];
      if (this.kind() !== "rbrack") {
        for (; ; ) {
          args.push(this.parseArgExpression());
          if (this.atRelation()) {
            this.skipToClose("rbrack");
            const close2 = this.expect("rbrack", "]");
            return { k: "raw", text: "a relation inside a group", span: { from: span.from, to: close2.to } };
          }
          if (this.kind() === "comma") {
            this.pos++;
            continue;
          }
          if (this.kind() === "csym" && this.cur.value === "|") {
            this.pos++;
            for (; ; ) {
              args.push(this.parseArgExpression());
              if (this.atRelation()) {
                this.skipToClose("rbrack");
                const close3 = this.expect("rbrack", "]");
                return { k: "raw", text: "a conditional expectation", span: { from: span.from, to: close3.to } };
              }
              if (this.kind() === "comma") {
                this.pos++;
                continue;
              }
              break;
            }
            const close2 = this.expect("rbrack", "]");
            return { k: "raw", text: "a conditional expectation", span: { from: span.from, to: close2.to } };
          }
          break;
        }
      }
      const close = this.expect("rbrack", "]");
      return { k: "expect", op, args, over, span: { from: span.from, to: close.to } };
    }
    return { k: "raw", text: "expectation without an argument list", span };
  }
  parseBigOp(t) {
    let idx = "i";
    let lo = null;
    let hi = null;
    if (this.kind() === "sub") {
      this.pos++;
      const g = this.readGroupOrToken();
      const m = g.text.match(/^\s*([A-Za-z]+)\s*=\s*(.*)$/);
      if (m) {
        idx = m[1];
        const loText = m[2];
        if (loText.trim()) {
          const p = new _Parser(tokenize(loText), loText, this.opts);
          try {
            lo = p.parseExpression();
          } catch {
            lo = null;
          }
        }
      }
    }
    if (this.kind() === "sup") {
      this.pos++;
      const g = this.readGroupOrToken();
      const p = new _Parser(tokenize(g.text), g.text, this.opts);
      try {
        hi = p.parseExpression();
      } catch {
        hi = null;
      }
    }
    const body = this.parseProduct();
    return {
      k: "bigop",
      kind: t.value === "sum" ? "sum" : "prod",
      idx,
      lo,
      hi,
      body,
      span: { from: t.from, to: body.span.to }
    };
  }
  parseMatrixEnv() {
    const t = this.cur;
    this.pos++;
    const env = t.value;
    if ((env === "array" || env === "alignedat") && this.kind() === "lbrace") {
      this.rawGroupText();
    }
    const rows = [];
    let row = [];
    while (this.kind() !== "end" && this.kind() !== "eof") {
      if (this.kind() === "amp") {
        this.pos++;
        continue;
      }
      if (this.kind() === "nl") {
        this.pos++;
        rows.push(row);
        row = [];
        continue;
      }
      if (this.startsRelation()) {
        row.push(this.skipCell());
        continue;
      }
      row.push(this.parseExpression());
      if (this.kind() === "amp" || this.kind() === "nl") continue;
      if (this.kind() === "end" || this.kind() === "eof") break;
      if (this.startsRelation()) {
        row.push(this.skipCell());
        continue;
      }
      if (this.kind() === "comma" || this.kind() === "semi") {
        this.pos++;
        continue;
      }
      break;
    }
    if (row.length) rows.push(row);
    const endTok = this.kind() === "end" ? this.cur : null;
    if (endTok) this.pos++;
    const span = { from: t.from, to: endTok ? endTok.to : t.to };
    void env;
    return { k: "block", rows, span };
  }
  /** Does the current token begin a relation or a condition? */
  startsRelation() {
    const t = this.cur;
    if (t.type === "op" && ["=", "<", ">", "!", ":"].includes(t.value)) return true;
    return t.type === "cmd" && RELATION_COMMANDS[t.value] !== void 0;
  }
  /** Consumes the rest of a cases cell, up to `&`, `\\\\` or the end. */
  skipCell() {
    const first = this.cur;
    let depth = 0;
    let last = first;
    while (this.pos < this.tokens.length) {
      const t = this.cur;
      if (depth === 0 && (t.type === "amp" || t.type === "nl" || t.type === "end" || t.type === "eof")) break;
      if (t.type === "lparen" || t.type === "lbrack" || t.type === "lbrace") depth++;
      else if (t.type === "rparen" || t.type === "rbrack" || t.type === "rbrace") {
        if (depth > 0) depth--;
      }
      last = t;
      this.pos++;
    }
    return { k: "raw", text: "a relation inside a group", span: { from: first.from, to: last.to } };
  }
  /**
   * A norm: \|x\| and \|A\|_F.
   *
   * A squared norm is a sum of squares, so it is exact. The unsquared ones
   * are not rational, so they are left unsupported rather than approximated.
   *
   * The matching bar is found before the inside is parsed. Otherwise the
   * product rule sees the closing bar and starts another norm, and a norm on
   * the right of a product, as in `2\|x\|`, is never read.
   */
  parseNorm() {
    const open = this.cur;
    this.pos++;
    const closeIndex = this.barClose("\\|");
    if (closeIndex < 0) {
      this.pos = this.tokens.length;
      return { k: "raw", text: "an unbalanced norm", span: { from: open.from, to: open.to } };
    }
    const inner2 = this.parseInside(open, closeIndex);
    const close = this.tokens[closeIndex];
    this.pos = closeIndex + 1;
    let kind = "2";
    let squared = false;
    let scriptEnd = close.to;
    if (this.kind() === "sub") {
      this.pos++;
      const sub2 = this.readSubscript();
      kind = sub2.text;
      scriptEnd = sub2.span.to;
    }
    if (this.kind() === "sup") {
      this.pos++;
      const sup = this.readSuperscript();
      squared = sup.text === "2";
      scriptEnd = sup.span.to;
    }
    const span = { from: open.from, to: scriptEnd };
    if (squared) {
      if (kind === "F" || kind === "f") return { k: "op", op: "frob", args: [inner2], span };
      return { k: "op", op: "norm2", args: [inner2], span };
    }
    return { k: "raw", text: `the unsquared norm \\|${kind}\\|`, span: { from: open.from, to: scriptEnd } };
  }
  parseBars() {
    const open = this.cur;
    this.pos++;
    const closeIndex = this.barClose("|");
    if (closeIndex < 0) {
      this.pos = this.tokens.length;
      return { k: "raw", text: "unbalanced |", span: { from: open.from, to: open.to } };
    }
    const inner2 = this.parseInside(open, closeIndex);
    const close = this.tokens[closeIndex];
    this.pos = closeIndex + 1;
    return { k: "op", op: "abs", args: [inner2], span: { from: open.from, to: close.to } };
  }
  /** The next bar of the same kind at the top level, or -1. */
  barClose(kind) {
    let depth = 0;
    for (let i2 = this.pos; i2 < this.tokens.length; i2++) {
      const t = this.tokens[i2];
      if (t.type === "lparen" || t.type === "lbrack" || t.type === "lbrace") depth++;
      else if (t.type === "rparen" || t.type === "rbrack" || t.type === "rbrace") {
        if (depth > 0) depth--;
      } else if (depth === 0 && t.type === "csym" && t.value === kind) {
        return i2;
      }
    }
    return -1;
  }
  /** Parses the tokens between an opening delimiter and its match. */
  parseInside(open, closeIndex) {
    const inner2 = this.tokens.slice(this.pos, closeIndex);
    const parser = new _Parser(inner2, "", this.opts);
    try {
      return parser.parseExpression();
    } catch {
      const last = inner2.at(-1) ?? open;
      return { k: "raw", text: "an unreadable group", span: { from: open.to, to: last.to } };
    }
  }
};
function describeToken(t) {
  switch (t.type) {
    case "eof":
      return "end of input";
    case "ident":
      return `identifier ${t.value}`;
    case "num":
      return `number ${t.value}`;
    case "cmd":
      return `command \\${t.value}`;
    case "op":
      return `operator ${t.value}`;
    default:
      return t.type;
  }
}
function classifySuperscript(text) {
  const s = text.replace(/\s+/g, "");
  if (s === "\\top" || s === "T" || s === "\\mathsf{T}" || s === "\\intercal" || s === "^\\top") {
    return { kind: "transpose" };
  }
  if (s === "-1") return { kind: "inverse" };
  if (s === "-\\top" || s === "-T" || s === "-\\mathsf{T}") return { kind: "inverseT" };
  if (s === "1/2" || s === "\\frac{1}{2}" || s === "\\frac12") return { kind: "sqrtm" };
  if (s === "-1/2" || s === "-\\frac{1}{2}" || s === "-\\frac12") return { kind: "invSqrtm" };
  if (/^\d+$/.test(s)) return { kind: "power", powerText: s };
  return { kind: "label" };
}
function hasRelationInEnv(tokens) {
  let inEnv = 0;
  for (const t of tokens) {
    if (t.type === "begin") {
      inEnv++;
      continue;
    }
    if (t.type === "end") {
      if (inEnv > 0) inEnv--;
      continue;
    }
    if (inEnv === 0) continue;
    if (t.type === "op" && ["=", "<", ">"].includes(t.value)) return true;
    if (t.type === "cmd" && RELATION_COMMANDS[t.value] !== void 0) return true;
  }
  return false;
}
function findRelations(tokens) {
  const out = [];
  let depth = 0;
  let inEnv = 0;
  for (let i2 = 0; i2 < tokens.length; i2++) {
    const t = tokens[i2];
    if (t.type === "begin") {
      inEnv++;
      continue;
    }
    if (t.type === "end") {
      if (inEnv > 0) inEnv--;
      continue;
    }
    if (inEnv > 0) continue;
    if (t.type === "cmd" && t.value === "text") {
      let braces = 0;
      let j = i2;
      for (; j < tokens.length; j++) {
        if (tokens[j].type === "lbrace") braces++;
        else if (tokens[j].type === "rbrace") {
          braces--;
          if (braces === 0) break;
        }
      }
      i2 = j;
      continue;
    }
    if (t.type === "lbrace" || t.type === "lparen" || t.type === "lbrack") {
      depth++;
      continue;
    }
    if (t.type === "rbrace" || t.type === "rparen" || t.type === "rbrack") {
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (t.type === "op" && t.value === "=") {
      out.push({ index: i2, relation: "=", text: "=", length: 1 });
      continue;
    }
    if (t.type === "op" && t.value === ":" && tokens[i2 + 1]?.type === "op" && tokens[i2 + 1]?.value === "=") {
      out.push({ index: i2, relation: ":=", text: ":=", length: 2 });
      i2++;
      continue;
    }
    if (t.type === "op" && t.value === "<") {
      out.push({ index: i2, relation: "lt", text: "<", length: 1 });
      continue;
    }
    if (t.type === "op" && t.value === ">") {
      out.push({ index: i2, relation: "gt", text: ">", length: 1 });
      continue;
    }
    if (t.type === "cmd") {
      const rel = RELATION_COMMANDS[t.value];
      if (rel) out.push({ index: i2, relation: rel, text: `\\${t.value}`, length: 1 });
    }
  }
  return out;
}
function clauseSplits(tokens) {
  const separators = [];
  let depth = 0;
  let inEnv = 0;
  for (let i2 = 0; i2 < tokens.length; i2++) {
    const t = tokens[i2];
    if (t.type === "begin") {
      inEnv++;
      continue;
    }
    if (t.type === "end") {
      if (inEnv > 0) inEnv--;
      continue;
    }
    if (inEnv > 0) continue;
    if (t.type === "lbrace" || t.type === "lparen" || t.type === "lbrack") {
      depth++;
      continue;
    }
    if (t.type === "rbrace" || t.type === "rparen" || t.type === "rbrack") {
      if (depth > 0) depth--;
      continue;
    }
    if (depth > 0) continue;
    if (t.type === "comma" || t.type === "semi" || t.type === "op" && t.value === ".") {
      separators.push(i2);
    }
  }
  if (!separators.length) return [];
  const bounds = [-1, ...separators, tokens.length];
  const claims = bounds.slice(0, -1).map((b, k) => findRelations(tokens.slice(b + 1, bounds[k + 1])).length > 0);
  const splits = [];
  for (let k = 0; k < separators.length; k++) {
    if (claims[k] && claims[k + 1]) splits.push(separators[k]);
  }
  if (!splits.length) return [];
  const clauses = [];
  let from = 0;
  for (const split of splits) {
    clauses.push({ start: from, end: split });
    from = split + 1;
  }
  clauses.push({ start: from, end: tokens.length });
  return clauses;
}
function parseRow(_src, rowText, offset, index, knownFns) {
  let tokens = tokenize(rowText);
  for (; ; ) {
    const at = tokens.length - 2;
    const last = tokens[at];
    if (!last) break;
    if (last.type === "comma" || last.type === "semi" || last.type === "op" && last.value === ".") {
      tokens = [...tokens.slice(0, at), tokens[tokens.length - 1]];
      continue;
    }
    break;
  }
  const annotation = extractAnnotation(tokens);
  tokens = stripAnnotation(tokens);
  tokens = blankAlignmentMarkers(tokens);
  const rels = findRelations(tokens);
  if (rels.length === 0) {
    if (hasRelationInEnv(tokens)) {
      return {
        index,
        span: { from: offset, to: offset + rowText.length },
        parts: [],
        annotation,
        error: new ParseFailure("a relation inside an environment", {
          from: offset,
          to: offset + rowText.length
        })
      };
    }
    return {
      index,
      span: { from: offset, to: offset + rowText.length },
      parts: [],
      annotation,
      prose: true
    };
  }
  const clauses = clauseSplits(tokens);
  if (clauses.length > 1) {
    const merged = [];
    for (const clause of clauses) {
      const first = tokens[clause.start];
      const last = tokens[clause.end - 1];
      if (!first || !last) continue;
      const parsed = parseRow(_src, rowText.slice(first.from, last.to), offset + first.from, index, knownFns);
      if (parsed.prose) continue;
      if (parsed.error) {
        return {
          index,
          span: { from: offset, to: offset + rowText.length },
          parts: [],
          annotation,
          error: parsed.error
        };
      }
      merged.push(...parsed.parts);
    }
    if (merged.length) {
      return { index, span: { from: offset, to: offset + rowText.length }, parts: merged, annotation };
    }
  }
  const parts = [];
  const impIndex = rels.findIndex((r) => r.relation === "=>" || r.relation === "<=>");
  const failure = (error) => ({
    index,
    span: { from: offset, to: offset + rowText.length },
    parts: [],
    annotation,
    error: error instanceof ParseFailure ? { message: error.message, span: { from: offset + error.span.from, to: offset + error.span.to } } : { message: String(error?.message ?? error), span: { from: offset, to: offset + rowText.length } }
  });
  if (impIndex >= 0) {
    const imp = rels[impIndex];
    const premiseTokens = tokens.slice(0, imp.index);
    const conclusionTokens = tokens.slice(imp.index + imp.length);
    let premise;
    let conclusion;
    try {
      premise = splitAssertion(premiseTokens, knownFns);
      conclusion = splitAssertion(conclusionTokens, knownFns);
    } catch (error) {
      return failure(error);
    }
    const part = {
      relation: imp.relation,
      relText: imp.text,
      span: { from: offset, to: offset + rowText.length },
      premise: premise ?? void 0,
      conclusion: conclusion ?? void 0
    };
    parts.push(part);
    return { index, span: { from: offset, to: offset + rowText.length }, parts, annotation };
  }
  const bounds = [];
  let start = 0;
  for (const r of rels) {
    bounds.push(start, r.index);
    start = r.index + r.length;
  }
  bounds.push(start, tokens.length);
  for (let i2 = 0; i2 < rels.length; i2++) {
    const rel = rels[i2];
    const lhsSeg = i2 === 0 ? tokens.slice(bounds[0], bounds[1]) : [];
    let rhsSeg = tokens.slice(bounds[2 * i2 + 2], bounds[2 * i2 + 3]);
    let proportionalTo;
    if (rel.relation === "propto" && rhsSeg[0]?.type === "sub") {
      const parser = new Parser(rhsSeg, "", knownFns ? { knownFns } : {});
      const read = parser.readProportionalityVariable();
      proportionalTo = read.name;
      rhsSeg = rhsSeg.slice(read.tokens);
    }
    let lhs;
    let rhs;
    try {
      lhs = (lhsSeg.length ? parseNode(lhsSeg, knownFns) : null) ?? void 0;
      rhs = (rhsSeg.length ? parseNode(rhsSeg, knownFns) : null) ?? void 0;
    } catch (error) {
      return failure(error);
    }
    parts.push({
      lhs,
      relation: rel.relation,
      relText: rel.text,
      rhs,
      span: { from: offset, to: offset + rowText.length },
      lhsSpan: lhs?.span,
      rhsSpan: rhs?.span,
      proportionalTo
    });
  }
  return { index, span: { from: offset, to: offset + rowText.length }, parts, annotation };
}
function splitAssertion(tokens, knownFns) {
  const rels = findRelations(tokens);
  if (!rels.length) {
    const node = parseNode(tokens, knownFns);
    if (!node) return null;
    return { lhs: node, relation: "other", relText: "", lhsSpan: node.span };
  }
  const r0 = rels[0];
  const lhsSeg = tokens.slice(0, r0.index);
  const rhsSeg = tokens.slice(r0.index + 1);
  const lhs = (lhsSeg.length ? parseNode(lhsSeg, knownFns) : null) ?? void 0;
  const rhs = (rhsSeg.length ? parseNode(rhsSeg, knownFns) : null) ?? void 0;
  return {
    lhs,
    relation: r0.relation,
    relText: r0.text,
    rhs,
    lhsSpan: lhs?.span,
    rhsSpan: rhs?.span
  };
}
function parseNode(tokens, knownFns) {
  if (!tokens.length) return null;
  const parser = new Parser(tokens, "", knownFns ? { knownFns } : {});
  const node = parser.parseExpression();
  let rest = parser.pos;
  while (rest < tokens.length && !tokens[rest].value) rest++;
  if (rest < tokens.length) {
    const leftover = tokens[rest];
    const closing = leftover.type === "rparen" || leftover.type === "rbrace" || leftover.type === "rbrack";
    const what = closing ? "unbalanced" : "unexpected";
    throw new ParseFailure(
      `${what} \`${leftover.value}\` at column ${leftover.from + 1}`,
      { from: leftover.from, to: leftover.to }
    );
  }
  return node;
}
function blankAlignmentMarkers(tokens) {
  let depth = 0;
  return tokens.map((token) => {
    if (token.type === "lbrace" || token.type === "lparen" || token.type === "lbrack") depth++;
    else if (token.type === "rbrace" || token.type === "rparen" || token.type === "rbrack") depth--;
    else if (depth === 0 && token.value === "&") return { ...token, value: "" };
    return token;
  });
}
function trailingText(tokens) {
  const eof = tokens.length - 1;
  for (let i2 = eof; i2 >= 0; i2--) {
    if (tokens[i2].type !== "cmd" || tokens[i2].value !== "text") continue;
    const next = tokens[i2 + 1];
    if (!next || next.type !== "lbrace") continue;
    let depth = 1;
    let j = i2 + 2;
    while (j < tokens.length && depth > 0) {
      const t = tokens[j];
      if (t.type === "lbrace") depth++;
      else if (t.type === "rbrace") {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (depth !== 0) continue;
    if (j !== eof - 1) continue;
    return { at: i2, close: j };
  }
  return null;
}
function extractAnnotation(tokens) {
  const range = trailingText(tokens);
  return range ? renderTokens(tokens.slice(range.at + 2, range.close)).trim() : void 0;
}
function stripAnnotation(tokens) {
  const range = trailingText(tokens);
  if (!range) return tokens;
  return [...tokens.slice(0, range.at), tokens[tokens.length - 1]];
}

// src/core/steps.ts
var MATH_ENVS = /* @__PURE__ */ new Set([
  "align",
  "align*",
  "aligned",
  "alignat",
  "alignat*",
  "gather",
  "gather*",
  "gathered",
  "split",
  "equation",
  "equation*",
  "multline",
  "multline*",
  "eqnarray",
  "eqnarray*",
  "displaymath",
  "array",
  "flalign",
  "flalign*"
]);
var MATRIX_ENVS = /* @__PURE__ */ new Set([
  "matrix",
  "bmatrix",
  "pmatrix",
  "vmatrix",
  "Bmatrix",
  "Vmatrix",
  "smallmatrix",
  "cases"
]);
function splitRows(src) {
  const rows = [];
  const prose = [];
  let i2 = 0;
  const len = src.length;
  const flushProse = (text) => {
    const t = text.trim();
    if (t) prose.push(t);
  };
  while (i2 < len) {
    const beginIdx = src.indexOf("\\begin{", i2);
    const dollarIdx = src.indexOf("$$", i2);
    const bracketIdx = src.indexOf("\\[", i2);
    const candidates = [beginIdx, dollarIdx, bracketIdx].filter((v) => v >= 0);
    if (!candidates.length) {
      flushProse(src.slice(i2));
      break;
    }
    const next = Math.min(...candidates);
    flushProse(src.slice(i2, next));
    if (next === beginIdx) {
      const env = readEnvName(src, beginIdx + 6);
      if (!env) {
        flushProse(src.slice(next, next + 7));
        i2 = next + 7;
        continue;
      }
      const envName = env.name;
      const endIdx = findEnvEnd(src, beginIdx, envName);
      const contentStart2 = env.next;
      const contentEnd2 = endIdx >= 0 ? endIdx : len;
      if (MATH_ENVS.has(envName)) {
        rows.push(...splitMathContent(src, contentStart2, contentEnd2, `${envName}@${beginIdx}`));
        i2 = endIdx >= 0 ? endIdx + 1 : len;
        continue;
      }
      if (MATRIX_ENVS.has(envName)) {
        i2 = endIdx >= 0 ? endIdx + envName.length + 6 : len;
        continue;
      }
      flushProse(src.slice(contentStart2, contentEnd2));
      i2 = endIdx >= 0 ? endIdx + 1 : len;
      continue;
    }
    if (next === dollarIdx) {
      const end2 = src.indexOf("$$", dollarIdx + 2);
      const contentStart2 = dollarIdx + 2;
      const contentEnd2 = end2 >= 0 ? end2 : len;
      rows.push(...splitMathContent(src, contentStart2, contentEnd2, `$$@${dollarIdx}`));
      i2 = end2 >= 0 ? end2 + 2 : len;
      continue;
    }
    const end = src.indexOf("\\]", bracketIdx + 2);
    const contentStart = bracketIdx + 2;
    const contentEnd = end >= 0 ? end : len;
    rows.push(...splitMathContent(src, contentStart, contentEnd, `\\[@${bracketIdx}`));
    i2 = end >= 0 ? end + 2 : len;
  }
  if (!rows.length) {
    let offset = 0;
    for (const line of src.split("\n")) {
      const trimmed = line.trim();
      const envStart = /^\\begin\{([^}]+)\}/.exec(trimmed);
      const opensMatrix = envStart !== null && MATRIX_ENVS.has(envStart[1]);
      if (trimmed && !trimmed.startsWith("%") && (!trimmed.startsWith("\\begin{") || opensMatrix) && !trimmed.startsWith("\\end{")) {
        const from = offset + line.indexOf(trimmed);
        rows.push({ text: cleanRow(line), from, to: from + trimmed.length, where: "line" });
      }
      offset += line.length + 1;
    }
  }
  return rows;
}
function readEnvName(src, i2) {
  if (src[i2] !== "{") return null;
  const end = src.indexOf("}", i2);
  if (end < 0) return null;
  return { name: src.slice(i2 + 1, end), next: end + 1 };
}
function findEnvEnd(src, start, envName) {
  let depth = 1;
  let i2 = start + 1;
  const open = `\\begin{${envName}}`;
  const close = `\\end{${envName}}`;
  while (i2 < src.length) {
    const openIdx = src.indexOf(open, i2);
    const closeIdx = src.indexOf(close, i2);
    if (closeIdx < 0) return -1;
    if (openIdx >= 0 && openIdx < closeIdx) {
      depth++;
      i2 = openIdx + open.length;
      continue;
    }
    depth--;
    if (depth === 0) return closeIdx;
    i2 = closeIdx + close.length;
  }
  return -1;
}
function splitMathContent(src, from, to, where) {
  const rows = [];
  const content = src.slice(from, to);
  let braceDepth = 0;
  let envDepth = 0;
  let rowStart = 0;
  const chars = content.split("");
  for (let i2 = 0; i2 < content.length; i2++) {
    const ch = chars[i2];
    if (ch === "\\") {
      const next = chars.slice(i2, i2 + 8).join("");
      if (next.startsWith("\\begin{")) {
        envDepth++;
        i2 += 7;
        continue;
      }
      if (next.startsWith("\\end{")) {
        envDepth = Math.max(0, envDepth - 1);
        i2 += 5;
        continue;
      }
      if (next.startsWith("\\\\")) {
        if (braceDepth === 0 && envDepth === 0) {
          const seg2 = chars.slice(rowStart, i2).join("");
          pushRow(rows, seg2, from + rowStart, where);
          rowStart = i2 + 2;
          i2 += 1;
          continue;
        }
        i2 += 1;
        continue;
      }
      if (next.startsWith("\\label{") || next.startsWith("\\tag{")) {
        const end = content.indexOf("}", i2);
        if (end > 0) {
          for (let j = i2; j < end; j++) chars[j] = " ";
          i2 = end;
          continue;
        }
      }
      i2 += 1;
      continue;
    }
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === "&" && braceDepth === 0 && envDepth === 0) {
      chars[i2] = " ";
    }
  }
  const seg = chars.slice(rowStart).join("");
  pushRow(rows, seg, from + rowStart, where);
  return rows;
}
function pushRow(rows, segment, offset, where) {
  const text = cleanRow(segment);
  if (!text.trim()) return;
  const lead = segment.length - segment.trimStart().length;
  const from = offset + lead;
  rows.push({ text, from, to: from + text.trimEnd().length, where });
}
function cleanRow(text) {
  return text.replace(/\\nonumber\b/g, "").replace(/\\notag\b/g, "").replace(/\\\\\s*$/, "").trim();
}

// src/core/decl.ts
var PROP_WORDS = {
  sym: "sym",
  symmetric: "sym",
  spd: "spd",
  psd: "psd",
  orth: "orth",
  orthogonal: "orth",
  rot: "rot",
  rotation: "rot",
  diag: "diag",
  diagonal: "diag",
  triu: "triu",
  tril: "tril",
  skew: "skew",
  idem: "idem",
  idempotent: "idem",
  proj: "proj",
  projector: "proj",
  unit: "unit",
  stoch: "stoch",
  stochastic: "stoch",
  ones: "ones",
  pos: "pos",
  positive: "pos",
  int: "int",
  integer: "int"
};
function emptyDeclResult() {
  return { decls: [], pinned: {}, errors: [] };
}
function parseDeclarations(text) {
  const result = emptyDeclResult();
  if (!text.trim()) return result;
  const latexItems = splitLatexItems(text);
  for (const item of latexItems) {
    if (!item.trim()) continue;
    if (!parseLatexItem(item, result)) {
      const compact = parseCompactItem(item, result);
      if (!compact) result.errors.push(`could not read the declaration: ${item.trim()}`);
    }
  }
  return result;
}
function splitLatexItems(text) {
  const out = [];
  let current = "";
  let depth = 0;
  for (let i2 = 0; i2 < text.length; i2++) {
    const ch = text[i2];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0 && (ch === "\n" || ch === ";")) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    if (depth === 0 && ch === "," && looksLikeLatexList(text, i2)) {
      current += ch;
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
function looksLikeLatexList(text, commaIndex) {
  const after = text.slice(commaIndex + 1).trimStart();
  return /^[A-Za-z\\][A-Za-z0-9_^{}\\]*(\s*,\s*[A-Za-z\\][A-Za-z0-9_^{}\\]*)*\s*(\\in|\\sim|\\succ|\\succeq|>:=|=|>)/.test(after);
}
function parseLatexItem(item, result) {
  const text = item.trim();
  const defMatch = text.match(/^(.+?)\s*:=\s*([\s\S]+)$/);
  if (defMatch && !text.includes("\\in")) {
    const name = canonicalizeSymbol(defMatch[1].trim());
    if (name && !name.includes("\\")) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: "matrix",
        props: [],
        def: defMatch[2].trim(),
        source: "declared"
      });
      return true;
    }
  }
  const inR = text.match(/^(.+?)\s*\\in\s*\\mathbb\{R\}\s*\^\s*\{([^}]*)\}/);
  if (inR) {
    const names = splitNames(inR[1]);
    const dims = parseDims(inR[2]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: dims.length === 1 ? "vector" : "matrix",
        rows: dims[0],
        cols: dims.length > 1 ? dims[1] : 1,
        props: [],
        source: "declared"
      });
    }
    return true;
  }
  const inS = text.match(/^(.+?)\s*\\in\s*\\mathbb\{S\}\s*\^\s*\{?(\w+)\}?\s*_\s*\{(\+\+|\+)\}/);
  if (inS) {
    const names = splitNames(inS[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: "matrix",
        rows: parseDim(inS[2]) ?? void 0,
        cols: parseDim(inS[2]) ?? void 0,
        props: [inS[3] === "++" ? "spd" : "psd", "sym"],
        source: "declared"
      });
    }
    return true;
  }
  const inRPlain = text.match(/^(.+?)\s*\\in\s*\\mathbb\{R\}\s*\^\s*(\w+)/);
  if (inRPlain) {
    const names = splitNames(inRPlain[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: "vector",
        rows: parseDim(inRPlain[2]) ?? void 0,
        cols: 1,
        props: [],
        source: "declared"
      });
    }
    return true;
  }
  const spd = text.match(/^(.+?)\s*\\succ\s*0$/);
  if (spd) {
    const names = splitNames(spd[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: "matrix",
        props: ["spd", "sym"],
        source: "declared"
      });
    }
    return true;
  }
  const psd = text.match(/^(.+?)\s*\\succeq\s*0$/);
  if (psd) {
    const names = splitNames(psd[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: "matrix",
        props: ["psd", "sym"],
        source: "declared"
      });
    }
    return true;
  }
  const orth = text.match(/^(.+?)\s*\^\s*\\top\s*(.+?)\s*=\s*I\s*$/);
  if (orth) {
    const a = canonicalizeSymbol(orth[1].trim());
    const b = canonicalizeSymbol(orth[2].trim());
    for (const name of [a, b]) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: "matrix",
        props: ["orth"],
        source: "declared"
      });
    }
    return true;
  }
  const sym = text.match(/^(.+?)\s*=\s*(.+?)\s*\^\s*\\top\s*$/);
  if (sym && canonicalizeSymbol(sym[1].trim()) === canonicalizeSymbol(sym[2].trim())) {
    const name = canonicalizeSymbol(sym[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "matrix",
      props: ["sym"],
      source: "declared"
    });
    return true;
  }
  const idem = text.match(/^(.+?)\s*\^\s*\{?2\}?\s*=\s*(.+?)$/);
  if (idem && canonicalizeSymbol(idem[1].trim()) === canonicalizeSymbol(idem[2].trim())) {
    const name = canonicalizeSymbol(idem[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "matrix",
      props: ["idem", "proj"],
      source: "declared"
    });
    return true;
  }
  const rank = text.match(/\\operatorname\{rank\}\s*\(\s*(.+?)\s*\)\s*=\s*(.+)$/);
  if (rank) {
    const name = canonicalizeSymbol(rank[1].trim());
    const k = parseDim(rank[2].trim());
    if (k !== null) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: "matrix",
        props: [{ rank: k }],
        source: "declared"
      });
      return true;
    }
  }
  const simN = text.match(/^(.+?)\s*\\sim\s*\\mathcal\{N\}\s*\(([^)]*)\)/);
  if (simN) {
    const name = canonicalizeSymbol(simN[1].trim());
    const args = splitNames(simN[2]);
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "random",
      props: [],
      dist: { kind: "normal", mu: args[0] ?? "0", sigma: args[1] ?? "I" },
      source: "declared"
    });
    return true;
  }
  const simU = text.match(/^(.+?)\s*\\sim\s*\\mathcal\{U\}\s*\(([^)]*)\)/);
  if (simU) {
    const name = canonicalizeSymbol(simU[1].trim());
    const args = splitNames(simU[2]);
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "random",
      props: [],
      dist: { kind: "uniform", a: args[0] ?? "0", b: args[1] ?? "1" },
      source: "declared"
    });
    return true;
  }
  const simB = text.match(/^(.+?)\s*\\sim\s*\\mathrm\{Bern\}\s*\(([^)]*)\)/);
  if (simB) {
    const name = canonicalizeSymbol(simB[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "random",
      props: [],
      dist: { kind: "bernoulli", p: simB[2].trim() },
      source: "declared"
    });
    return true;
  }
  const fn = text.match(/^(.+?)\s*:\s*\\mathbb\{R\}\s*\^\s*\{?([^}]*)\}?\s*\\to\s*\\mathbb\{R\}\s*\^\s*\{?([^}]*)\}?$/);
  if (fn) {
    const name = canonicalizeSymbol(fn[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "function",
      dom: parseDims(fn[2]),
      cod: parseDim(fn[3].trim()) ?? void 0,
      props: [],
      source: "declared"
    });
    return true;
  }
  const pos = text.match(/^(.+?)\s*>\s*0$/);
  if (pos) {
    const name = canonicalizeSymbol(pos[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "scalar",
      props: ["pos"],
      source: "declared"
    });
    return true;
  }
  return false;
}
function parseCompactItem(item, result) {
  const text = item.trim();
  const def = text.match(/^(.+?)\s*:=\s*([\s\S]+)$/);
  if (def) {
    const name = canonicalizeSymbol(def[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: "matrix",
      props: [],
      def: def[2].trim(),
      source: "declared"
    });
    return true;
  }
  const dist = text.match(/^(.+?)\s*~\s*(.+)$/);
  if (dist) {
    const names = splitNames(dist[1]);
    const d = parseDist(dist[2].trim());
    if (d) {
      for (const name of names) {
        result.decls.push({
          name,
          display: toDisplay(name),
          kind: "random",
          props: [],
          dist: d,
          source: "declared"
        });
      }
      return true;
    }
  }
  const typed = text.match(/^(.+?)\s*:\s*(.+)$/);
  if (typed) {
    const names = splitNames(typed[1]);
    const type = typed[2].trim();
    for (const name of names) {
      const decl = parseType(name, type);
      if (decl) {
        result.decls.push(decl);
        continue;
      }
    }
    if (names.length) return true;
  }
  const pinned = text.match(/^([A-Za-z]\w*)\s*=\s*(\d+)$/);
  if (pinned) {
    result.pinned[pinned[1]] = Number(pinned[2]);
    return true;
  }
  return false;
}
function parseType(name, type) {
  const base2 = { name, display: toDisplay(name), source: "declared" };
  if (type === "scalar") return { ...base2, kind: "scalar", props: [] };
  if (type === "pos") return { ...base2, kind: "scalar", props: ["pos"] };
  if (type === "int") return { ...base2, kind: "scalar", props: ["int"] };
  const fn = type.match(/^fn\s*(.+?)\s*(?:->|→)\s*(.+)$/);
  if (fn) {
    return {
      ...base2,
      kind: "function",
      dom: parseDims(fn[1]),
      cod: parseDim(fn[2]) ?? void 0,
      props: []
    };
  }
  const words = type.split(/\s+/);
  const props = [];
  const dims = [];
  let i2 = 0;
  for (; i2 < words.length; i2++) {
    const w = words[i2].toLowerCase();
    if (w === "rank") {
      const k = parseDim(words[++i2] ?? "");
      if (k === null) return null;
      props.push({ rank: k });
      continue;
    }
    if (PROP_WORDS[w]) {
      props.push(PROP_WORDS[w]);
      continue;
    }
    break;
  }
  const rest = words.slice(i2).join(" ");
  const dimText2 = rest.replace(/[x×]/g, "\xD7");
  const parts = dimText2.split("\xD7").map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const d = parseDim(p);
    if (d === null) return null;
    dims.push(d);
  }
  if (!dims.length) {
    if (!props.length) return null;
    return { ...base2, kind: "matrix", props };
  }
  if (dims.length === 1) {
    const matrixish = props.some(
      (p) => typeof p === "string" && ["sym", "spd", "psd", "orth", "rot", "diag", "triu", "tril", "skew", "idem", "proj", "stoch"].includes(p)
    );
    return {
      ...base2,
      kind: matrixish ? "matrix" : "vector",
      rows: dims[0],
      cols: matrixish ? dims[0] : 1,
      props
    };
  }
  return {
    ...base2,
    kind: "matrix",
    rows: dims[0],
    cols: dims[1],
    props
  };
}
function parseDist(text) {
  const m = text.match(/^N\s*\((.*)\)$/);
  if (m) {
    const args = splitNames(m[1]);
    return { kind: "normal", mu: args[0] ?? "0", sigma: args[1] ?? "I" };
  }
  const u = text.match(/^U\s*\((.*)\)$/);
  if (u) {
    const args = splitNames(u[1]);
    return { kind: "uniform", a: args[0] ?? "0", b: args[1] ?? "1" };
  }
  const b = text.match(/^Bern\s*\((.*)\)$/);
  if (b) return { kind: "bernoulli", p: b[1].trim() };
  const c = text.match(/^Cat\s*\((.*)\)$/);
  if (c) return { kind: "categorical", p: c[1].trim() };
  return null;
}
function splitNames(text) {
  return text.split(",").map((s) => canonicalizeSymbol(s.trim())).filter(Boolean);
}
function parseDim(text) {
  const t = text.trim().replace(/^\\mathbb\{[A-Za-z]+\}$/, "");
  if (/^\d+$/.test(t)) return Number(t);
  if (/^[A-Za-z]\w*$/.test(t)) return { v: t };
  return null;
}
function parseDims(text) {
  const parts = text.replace(/\\times/g, "\xD7").replace(/\s+/g, "").split("\xD7").map((p) => parseDim(p)).filter((d) => d !== null);
  return parts;
}

// src/core/presets.ts
var PRESETS = [
  {
    id: "kalman-thrun",
    label: "Kalman (Thrun)",
    hint: "Q is the measurement noise, R is the process noise",
    decls: "x_t, \\bar\\mu_t, \\mu_t: n; z_t: m; C_t: m\xD7n; Q_t: spd m; \\bar\\Sigma_t, \\Sigma_t: spd n; K_t: n\xD7m"
  },
  {
    id: "kalman-hpr",
    label: "Kalman (H, P, R)",
    hint: "H is the measurement matrix, P the covariance, R the noise",
    decls: "x, \\hat x, \\mu: n; z: m; H: m\xD7n; R: spd m; P, \\bar P: spd n; K: n\xD7m"
  },
  {
    id: "linreg",
    label: "Linear regression",
    hint: "y = Xw + b, with the normal equations",
    decls: "X: n\xD7p; w: p; b: scalar; y: n; \\beta: p; \\lambda: pos"
  },
  {
    id: "logreg",
    label: "Logistic regression",
    hint: "p = sigmoid(Xw + b)",
    decls: "X: n\xD7p; w: p; b: scalar; y: n; p: n; \\lambda: pos"
  },
  {
    id: "mlp",
    label: "MLP backprop",
    hint: "one hidden layer, W1, W2 and the deltas",
    decls: "x: d; W_1: h\xD7d; b_1: h; h_1: h; W_2: k\xD7h; b_2: k; y: k; \\delta_1: h; \\delta_2: k"
  },
  {
    id: "attention",
    label: "Attention",
    hint: "softmax(QK^T / sqrt(d) V)",
    decls: "Q, K, V: n\xD7d; d_k: scalar; A: n\xD7n; O: n\xD7d"
  },
  {
    id: "gauss-cond",
    label: "Gaussian conditioning",
    hint: "joint Gaussian, its precision matrix and the conditional mean",
    decls: "x: n; y: m; \\Sigma_{xx}: spd n; \\Sigma_{yy}: spd m; \\Sigma_{xy}: n\xD7m; \\mu_x: n; \\mu_y: m"
  },
  {
    id: "lqr",
    label: "LQR",
    hint: "the Riccati recursion",
    decls: "A: n\xD7n; B: n\xD7m; Q: spd n; R: spd m; P: spd n; K: m\xD7n"
  },
  {
    id: "pca",
    label: "PCA",
    hint: "eigen decomposition of a covariance matrix",
    decls: "\\Sigma: spd n; U: n\xD7n; \\Lambda: n\xD7n; x: n"
  }
];
function getPreset(id) {
  if (!id) return void 0;
  return PRESETS.find((p) => p.id === id);
}
function presetDecls(id) {
  const preset = getPreset(id);
  if (!preset) return [];
  return parseDeclarations(preset.decls).decls;
}

// src/core/types.ts
var ZERO_DEG = { n: 0, d: 0 };
var LEAF_DEG = { n: 1, d: 0 };
var Dims = class {
  parent = /* @__PURE__ */ new Map();
  rank = /* @__PURE__ */ new Map();
  find(v) {
    const p = this.parent.get(v);
    if (p === void 0) {
      this.parent.set(v, v);
      return v;
    }
    if (p !== v) {
      const root = this.find(p);
      this.parent.set(v, root);
      return root;
    }
    return v;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;
    if (rankA < rankB) this.parent.set(ra, rb);
    else if (rankA > rankB) this.parent.set(rb, ra);
    else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }
  /** The dimension variables in a stable order. */
  all() {
    const roots = /* @__PURE__ */ new Set();
    for (const key of this.parent.keys()) roots.add(this.find(key));
    return [...roots].sort();
  }
};
function createContext(decls, layout = "denominator") {
  const map = /* @__PURE__ */ new Map();
  for (const d of decls) map.set(d.name, d);
  for (const d of decls) {
    if (d.kind !== "random" || d.rows) continue;
    const dist = d.dist;
    if (!dist) continue;
    const meanName = dist.kind === "normal" ? dist.mu : dist.kind === "uniform" ? dist.a : null;
    if (!meanName) continue;
    const mean = map.get(canonicalizeSymbol(meanName));
    if (mean && mean.rows) {
      d.rows = mean.rows;
      d.cols = mean.cols;
    }
  }
  const dimVars = [];
  for (const d of decls) {
    for (const dim of [d.rows, d.cols, d.cod, ...d.dom ?? []]) {
      if (dim && typeof dim !== "number" && !dimVars.includes(dim.v)) dimVars.push(dim.v);
    }
  }
  return {
    decls: map,
    defs: /* @__PURE__ */ new Map(),
    inferring: /* @__PURE__ */ new Set(),
    dims: new Dims(),
    symbols: /* @__PURE__ */ new Map(),
    chips: [],
    errors: [],
    dimVars,
    freshCount: 0,
    bound: /* @__PURE__ */ new Set(),
    layout
  };
}
function freshDim(ctx) {
  ctx.freshCount += 1;
  const v = `#${ctx.freshCount}`;
  ctx.dims.union(v, v);
  return { v };
}
function dimName(d) {
  return typeof d === "number" ? String(d) : d.v;
}
function unifyDim(ctx, a, b, what, span) {
  if (typeof a === "number" && typeof b === "number") {
    if (a !== b) {
      ctx.errors.push({ message: `${what}: the sizes ${a} and ${b} do not match`, span });
      return null;
    }
    return a;
  }
  if (typeof a === "number") {
    ctx.dims.union(b.v, `#fixed${a}`);
    return a;
  }
  if (typeof b === "number") {
    ctx.dims.union(a.v, `#fixed${b}`);
    return b;
  }
  const av = a.v;
  const bv = b.v;
  if (av !== bv && !isFreshDim(av) && !isFreshDim(bv)) {
    ctx.errors.push({
      message: `${what}: the sizes ${av} and ${bv} do not match`,
      span
    });
  }
  ctx.dims.union(av, bv);
  return a;
}
function isFreshDim(v) {
  return v.startsWith("#");
}
function isMatrix(t) {
  return t.t === "mat";
}
function isScalar(t) {
  return t.t === "scalar";
}
var CONSTANTS = /* @__PURE__ */ new Set(["e", "pi", "\\pi", "i", "j"]);
function inferType(ctx, node) {
  switch (node.k) {
    case "num":
      return { t: "scalar" };
    case "sym":
      return symbolType(ctx, node.name, node.span);
    case "op":
      return opType(ctx, node);
    case "call":
      return callType(ctx, node.fn, node.args, node.span);
    case "deriv":
      return derivType(ctx, node);
    case "expect":
      return expectType(ctx, node);
    case "bigop": {
      const saved = new Set(ctx.bound);
      ctx.bound.add(node.idx);
      const t = inferType(ctx, node.body);
      ctx.bound = saved;
      return t;
    }
    case "block": {
      const types = /* @__PURE__ */ new Map();
      for (const row of node.rows) for (const cell of row) types.set(cell, inferType(ctx, cell));
      const rowsOf = (t) => t.t === "mat" ? t.r : 1;
      const colsOf = (t) => t.t === "mat" ? t.c : 1;
      const heights = [];
      for (const row of node.rows) {
        let h = null;
        for (const cell of row) {
          const t = types.get(cell);
          if (!t) continue;
          h = h === null ? rowsOf(t) : unifyDim(ctx, h, rowsOf(t), "a block row", node.span) ?? h;
        }
        heights.push(h ?? 1);
      }
      const widths = [];
      for (let j = 0; j < (node.rows[0]?.length ?? 0); j++) {
        let w = null;
        for (const row of node.rows) {
          const t = types.get(row[j]);
          if (!t) continue;
          w = w === null ? colsOf(t) : unifyDim(ctx, w, colsOf(t), "a block column", node.span) ?? w;
        }
        widths.push(w ?? 1);
      }
      let r = null;
      for (const h of heights) r = r === null ? h : addDim(r, h);
      let c = null;
      for (const w of widths) c = c === null ? w : addDim(c, w);
      return { t: "mat", r: r ?? 0, c: c ?? 0 };
    }
    case "raw":
      return { t: "poly" };
  }
}
function symbolType(ctx, name, span) {
  const existing = ctx.symbols.get(name);
  if (existing) return existing.ty;
  const def = ctx.defs.get(name);
  if (def && !ctx.inferring.has(name)) {
    ctx.inferring.add(name);
    const ty = inferType(ctx, def);
    ctx.inferring.delete(name);
    ctx.symbols.set(name, {
      name,
      display: toDisplay(name),
      ty,
      props: [],
      source: "declared",
      guessed: false,
      assumption: `${toDisplay(name)} is the symbol that was defined earlier`
    });
    return ty;
  }
  const decl = ctx.decls.get(name);
  if (decl) {
    const ty = declType(decl);
    ctx.symbols.set(name, {
      name,
      display: decl.display || toDisplay(name),
      ty,
      props: decl.props,
      source: decl.source,
      guessed: false
    });
    return ty;
  }
  const base2 = baseLetter(name);
  const guess = guessType(ctx, name, base2);
  ctx.symbols.set(name, {
    name,
    display: toDisplay(name),
    ty: guess.ty,
    props: guess.props,
    source: "inferred",
    guessed: true,
    assumption: guess.assumption
  });
  if (guess.chip) ctx.chips.push({ ...guess.chip, span, symbol: name });
  return guess.ty;
}
function declType(decl) {
  if (decl.kind === "scalar") return { t: "scalar" };
  if (decl.kind === "function") {
    return { t: "fn", dom: (decl.dom ?? []).map((d) => ({ t: "mat", r: d, c: d })), cod: { t: "scalar" } };
  }
  if (decl.kind === "random") {
    const of = decl.rows ? { t: "mat", r: decl.rows, c: decl.cols ?? decl.rows } : { t: "scalar" };
    return { t: "rv", of, dist: decl.dist ?? { kind: "normal", mu: "0", sigma: "1" } };
  }
  const r = decl.rows ?? freshDimCtx(decl);
  const c = decl.cols ?? r;
  return { t: "mat", r, c };
}
function freshDimCtx(decl) {
  return { v: `#${decl.name}` };
}
function baseLetter(name) {
  const stripped = name.replace(/^(\\[A-Za-z]+)+/, "");
  const m = stripped.match(/^([A-Za-z]+)/);
  return m ? m[1] : stripped;
}
function guessType(ctx, name, base2) {
  if (base2 === "I" && !name.includes("_")) {
    return {
      ty: { t: "mat", r: freshDim(ctx), c: freshDim(ctx) },
      props: ["ident"],
      assumption: "I is the identity matrix"
    };
  }
  if (base2 === "0" && !name.includes("_")) {
    return {
      ty: { t: "mat", r: freshDim(ctx), c: freshDim(ctx) },
      props: ["zero"],
      assumption: "0 is the zero matrix"
    };
  }
  if (name === "\\mathbf{1}" || name === "\\mathbf1" || base2 === "\\mathbf1") {
    return {
      ty: { t: "mat", r: freshDim(ctx), c: freshDim(ctx) },
      props: ["ones"],
      assumption: "the ones vector"
    };
  }
  if (CONSTANTS.has(name) || CONSTANTS.has(base2)) {
    if (!name.includes("_")) {
      return { ty: { t: "scalar" }, props: [], assumption: `${name} is a constant` };
    }
  }
  if (/^[nmdkNTTP]$/.test(base2) && !name.includes("_")) {
    return { ty: { t: "scalar" }, props: [], assumption: `${name} is a size` };
  }
  if (/^[ijk]$/.test(base2) && ctx.bound.has(base2)) {
    return { ty: { t: "scalar" }, props: [], assumption: `${name} is an index` };
  }
  const isGreek = GREEK.has(base2) || /\\[a-zA-Z]+$/.test(name);
  const isCapital = /^[A-Z]/.test(base2);
  if (isGreek || isCapital) {
    const props = [];
    if (base2 === "Sigma" || base2 === "Lambda" || base2 === "\\Sigma" || base2 === "\\Lambda") props.push("sym");
    return {
      ty: { t: "mat", r: freshDim(ctx), c: freshDim(ctx) },
      props,
      assumption: `${name} is a matrix${props.length ? " (symmetric)" : ""}`,
      chip: {
        id: "shape-guess",
        message: `${name} is treated as a matrix${props.length ? " with symmetric structure" : ""}. Declare it to be sure.`,
        options: [
          { label: "matrix", value: "matrix" },
          { label: "vector", value: "vector" },
          { label: "scalar", value: "scalar" }
        ]
      }
    };
  }
  return {
    ty: { t: "scalar" },
    props: [],
    assumption: `${name} is a scalar`,
    chip: {
      id: "shape-guess",
      message: `${name} is treated as a scalar. Declare it to be sure.`,
      options: [
        { label: "scalar", value: "scalar" },
        { label: "vector", value: "vector" },
        { label: "matrix", value: "matrix" }
      ]
    }
  };
}
function opType(ctx, node) {
  const args = node.args.map((a) => {
    const t = inferType(ctx, a);
    return t.t === "rv" ? t.of : t;
  });
  switch (node.op) {
    case "add":
    case "sub": {
      const a = args[0];
      const b = args[1];
      if (a.t === "poly" || b.t === "poly") return { t: "poly" };
      if (isScalar(a) && isScalar(b)) return { t: "scalar" };
      if (isScalar(a) && isMatrix(b)) return b;
      if (isMatrix(a) && isScalar(b)) return a;
      if (isMatrix(a) && isMatrix(b)) {
        const rows = unifyDim(ctx, a.r, b.r, "in a sum", node.span);
        const cols = unifyDim(ctx, a.c, b.c, "in a sum", node.span);
        return { t: "mat", r: rows ?? a.r, c: cols ?? a.c };
      }
      ctx.errors.push({ message: "these two terms do not have the same shape", span: node.span });
      return { t: "poly" };
    }
    case "neg": {
      const a = args[0];
      return a;
    }
    case "mul": {
      const a = args[0];
      const b = args[1];
      if (a.t === "poly" || b.t === "poly") return { t: "poly" };
      if (isScalar(a) && isScalar(b)) return { t: "scalar" };
      if (isScalar(a) && isMatrix(b)) return b;
      if (isMatrix(a) && isScalar(b)) return a;
      if (isMatrix(a) && isMatrix(b)) {
        unifyDim(ctx, a.c, b.r, "in a product", node.span);
        return { t: "mat", r: a.r, c: b.c };
      }
      ctx.errors.push({ message: "these two factors do not have compatible shapes", span: node.span });
      return { t: "poly" };
    }
    case "div": {
      const a = args[0];
      const b = args[1];
      if (isScalar(a) && isScalar(b)) return { t: "scalar" };
      if (isMatrix(a) && isScalar(b)) return a;
      if (isMatrix(a) && isMatrix(b)) {
        unifyDim(ctx, a.c, b.r, "in a quotient", node.span);
        return { t: "mat", r: a.r, c: a.c };
      }
      return { t: "poly" };
    }
    case "pow": {
      const a = args[0];
      return a;
    }
    case "inv": {
      const a = args[0];
      if (isMatrix(a)) {
        unifyDim(ctx, a.r, a.c, "in an inverse", node.span);
        return a;
      }
      return { t: "scalar" };
    }
    case "invT": {
      const a = args[0];
      if (isMatrix(a)) {
        unifyDim(ctx, a.r, a.c, "in an inverse", node.span);
        return { t: "mat", r: a.c, c: a.r };
      }
      return { t: "scalar" };
    }
    case "T": {
      const a = args[0];
      if (isMatrix(a)) return { t: "mat", r: a.c, c: a.r };
      return { t: "scalar" };
    }
    case "tr":
    case "det":
    case "norm2":
    case "frob":
    case "abs":
      return { t: "scalar" };
    case "adj": {
      const a = args[0];
      if (isMatrix(a)) {
        unifyDim(ctx, a.r, a.c, "in an adjugate", node.span);
        return a;
      }
      return { t: "scalar" };
    }
    case "kron": {
      const a = args[0];
      const b = args[1];
      if (isMatrix(a) && isMatrix(b)) {
        return { t: "mat", r: mulDim(a.r, b.r), c: mulDim(a.c, b.c) };
      }
      return { t: "poly" };
    }
    case "had": {
      const a = args[0];
      const b = args[1];
      if (isMatrix(a) && isMatrix(b)) {
        const rows = unifyDim(ctx, a.r, b.r, "in an element wise product", node.span);
        const cols = unifyDim(ctx, a.c, b.c, "in an element wise product", node.span);
        return { t: "mat", r: rows ?? a.r, c: cols ?? a.c };
      }
      return { t: "poly" };
    }
    case "inner":
      return { t: "scalar" };
    case "vec": {
      const a = args[0];
      if (isMatrix(a)) return { t: "mat", r: mulDim(a.r, a.c), c: 1 };
      return { t: "scalar" };
    }
    case "diag": {
      const a = args[0];
      if (isMatrix(a)) return { t: "mat", r: a.r, c: a.r };
      return { t: "scalar" };
    }
    case "sqrtm": {
      const a = args[0];
      return a;
    }
  }
}
function mulDim(a, b) {
  if (typeof a === "number" && typeof b === "number") return a * b;
  if (typeof a === "number") return { v: `${a}*${dimName(b)}` };
  if (typeof b === "number") return { v: `${dimName(a)}*${b}` };
  return { v: `${dimName(a)}*${dimName(b)}` };
}
function addDim(a, b) {
  if (typeof a === "number" && typeof b === "number") return a + b;
  if (typeof a === "number") return { v: `${a}+${dimName(b)}` };
  if (typeof b === "number") return { v: `${dimName(a)}+${b}` };
  return { v: `${dimName(a)}+${dimName(b)}` };
}
function callType(ctx, fn, args, span) {
  const types = args.map((a) => inferType(ctx, a));
  switch (fn) {
    case "det":
    case "tr":
    case "trace":
    case "norm":
    case "logdet":
    case "var":
      return { t: "scalar" };
    case "cov": {
      const a = types[0];
      const b = types[1];
      if (a && b && isMatrix(a) && isMatrix(b)) return { t: "mat", r: a.r, c: b.r };
      return { t: "scalar" };
    }
    case "exp":
    case "log":
    case "ln":
    case "sqrt":
    case "sin":
    case "cos":
    case "tan":
    case "tanh":
    case "sigmoid":
    case "relu":
    case "softmax":
      return types[0] ?? { t: "scalar" };
    case "normalDensity":
    case "uniformDensity":
      return { t: "scalar" };
    default: {
      const decl = ctx.decls.get(fn);
      if (decl && decl.kind === "function") {
        return {
          t: "fn",
          dom: (decl.dom ?? []).map((d) => ({ t: "mat", r: d, c: d })),
          cod: { t: "scalar" }
        };
      }
      ctx.errors.push({ message: `unknown function ${fn}`, span, kind: "unknown-function" });
      return { t: "poly" };
    }
  }
}
function derivType(ctx, node) {
  const f = inferType(ctx, node.f);
  const wrtTypes = node.wrt.map((w2) => inferType(ctx, w2));
  if (node.form === "diff") return { t: "scalar" };
  if (node.order === 2) {
    const w2 = wrtTypes[0];
    if (w2 && isMatrix(w2)) {
      unifyDim(ctx, w2.r, w2.c, "in a second derivative", node.span);
      return { t: "mat", r: w2.r, c: w2.c };
    }
    return { t: "scalar" };
  }
  const scalarish = f.t === "scalar" || f.t === "mat" && f.r === 1 && f.c === 1;
  if (scalarish) {
    const w2 = wrtTypes[0];
    if (w2 && isMatrix(w2)) {
      if (ctx.layout === "numerator") return { t: "mat", r: w2.c, c: w2.r };
      return { t: "mat", r: w2.r, c: w2.c };
    }
    return { t: "scalar" };
  }
  const out = f.t === "rv" ? f.of : f;
  const w = wrtTypes[0];
  if (isMatrix(out) && w && isMatrix(w)) {
    return { t: "mat", r: out.r, c: w.c };
  }
  return { t: "poly" };
}
function expectType(ctx, node) {
  const types = node.args.map((a) => inferType(ctx, a));
  const body = types[0] ?? { t: "scalar" };
  if (node.op === "E") return body;
  if (node.op === "Var") {
    if (isMatrix(body)) return { t: "mat", r: body.r, c: body.r };
    return { t: "scalar" };
  }
  const second = types[1];
  if (isMatrix(body) && second && isMatrix(second)) {
    return { t: "mat", r: body.r, c: second.r };
  }
  return { t: "scalar" };
}
function degreeOf(ctx, node, sizes, defs) {
  switch (node.k) {
    case "num":
      return ZERO_DEG;
    case "sym": {
      const def = defs?.get(node.name);
      if (def) return degreeOf(ctx, def, sizes, defs);
      const info = ctx.symbols.get(node.name);
      if (info && info.source !== "inferred") {
        const deg = recipeDegree(ctx, node.name, info.props, sizes);
        if (deg) return deg;
      }
      if (isConstantSymbol(node.name)) return ZERO_DEG;
      return LEAF_DEG;
    }
    case "op": {
      const args = node.args.map((a) => degreeOf(ctx, a, sizes, defs));
      switch (node.op) {
        case "add":
        case "sub": {
          const a = args[0];
          const b = args[1];
          let n;
          if (a.d === 0 && b.d === 0) n = Math.max(a.n, b.n);
          else n = Math.max(a.n + b.d, b.n + a.d);
          return { n, d: a.d + b.d };
        }
        case "neg":
          return args[0];
        case "mul":
        case "kron":
        case "had":
          return { n: args[0].n + args[1].n, d: args[0].d + args[1].d };
        case "div":
          return { n: args[0].n + args[1].d, d: args[0].d + args[1].n };
        case "pow": {
          const k = node.args[1]?.k === "num" ? node.args[1].value.n : 2;
          return { n: args[0].n * k, d: args[0].d * k };
        }
        case "inv": {
          const size = matrixSize(ctx, node.args[0], sizes);
          return { n: args[0].d + (size - 1) * args[0].n, d: size * args[0].n };
        }
        case "invT": {
          const size = matrixSize(ctx, node.args[0], sizes);
          return { n: args[0].d + (size - 1) * args[0].n, d: size * args[0].n };
        }
        case "T":
        case "tr":
        case "vec":
        case "diag":
          return args[0];
        case "adj": {
          const size = matrixSize(ctx, node.args[0], sizes);
          return { n: (size - 1) * args[0].n, d: (size - 1) * args[0].d };
        }
        case "det": {
          const size = matrixSize(ctx, node.args[0], sizes);
          return { n: size * args[0].n, d: size * args[0].d };
        }
        case "norm2":
        case "frob":
        case "abs":
        case "inner":
          return { n: 2 * args[0].n, d: 2 * args[0].d };
        case "sqrtm":
          return { n: Math.ceil(args[0].n / 2), d: Math.ceil(args[0].d / 2) };
      }
      return args[0] ?? ZERO_DEG;
    }
    case "call": {
      const arg = node.args[0] ? degreeOf(ctx, node.args[0], sizes, defs) : ZERO_DEG;
      if (node.fn === "det") {
        const size = matrixSize(ctx, node.args[0], sizes);
        return { n: size * arg.n, d: size * arg.d };
      }
      if (node.fn === "tr" || node.fn === "trace") return arg;
      if (node.fn === "var" || node.fn === "cov") {
        return { n: 2 * arg.n, d: 2 * arg.d };
      }
      return ZERO_DEG;
    }
    case "deriv": {
      const fnDef = node.f.k === "sym" ? defs?.get(node.f.name) : void 0;
      const base2 = fnDef ? degreeOf(ctx, fnDef, sizes, defs) : LEAF_DEG;
      return { n: base2.n + 1, d: base2.d + 1 };
    }
    case "expect": {
      const body = node.args[0] ? degreeOf(ctx, node.args[0], sizes, defs) : ZERO_DEG;
      if (node.op === "E") return body;
      return { n: 2 * body.n, d: 2 * body.d };
    }
    case "bigop":
      return degreeOf(ctx, node.body, sizes, defs);
    case "block": {
      let best = ZERO_DEG;
      for (const row of node.rows) {
        for (const cell of row) {
          const deg = degreeOf(ctx, cell, sizes, defs);
          if (deg.n + deg.d > best.n + best.d) best = deg;
        }
      }
      return best;
    }
    case "raw":
      return ZERO_DEG;
  }
}
function isConstantSymbol(name) {
  return name === "e" || name === "\\pi" || name === "pi";
}
function recipeDegree(ctx, name, props, sizes) {
  const has = (p) => props.some((x2) => typeof x2 === "string" ? x2 === p : false);
  const info = ctx.symbols.get(name);
  const size = info && isMatrix(info.ty) ? dimSize(ctx, info.ty.r, sizes) : 3;
  if (has("orth") || has("rot")) return { n: size, d: size };
  if (has("idem") || has("proj")) return { n: 2 * size, d: size };
  if (has("unit")) return { n: 2, d: 2 };
  return null;
}
function dimSize(ctx, d, sizes) {
  if (typeof d === "number") return d;
  return sizes.get(ctx.dims.find(d.v)) ?? 3;
}
function matrixSize(ctx, node, sizes) {
  if (node.k === "sym") {
    const info = ctx.symbols.get(node.name);
    if (info && isMatrix(info.ty)) return dimSize(ctx, info.ty.r, sizes);
  }
  if (node.k === "op" && (node.op === "T" || node.op === "inv" || node.op === "invT")) {
    return matrixSize(ctx, node.args[0], sizes);
  }
  const ty = inferType(ctx, node);
  if (ty.t === "mat") return dimSize(ctx, ty.r, sizes);
  if (ty.t === "rv" && ty.of.t === "mat") return dimSize(ctx, ty.of.r, sizes);
  if (ty.t === "scalar" || ty.t === "poly") return 1;
  return 3;
}
function dimSizeOf(ctx, d, sizes) {
  return dimSize(ctx, d, sizes);
}

// src/core/dims.ts
function collectDimVarsFor(ctx, lhs, rhs, defs) {
  const names = /* @__PURE__ */ new Set();
  const collect = (node) => {
    if (!node) return;
    switch (node.k) {
      case "sym":
        names.add(node.name);
        return;
      case "op":
      case "call":
        node.args.forEach(collect);
        return;
      case "deriv":
        collect(node.f);
        node.wrt.forEach(collect);
        return;
      case "expect":
        node.args.forEach(collect);
        return;
      case "bigop":
        collect(node.lo ?? void 0);
        collect(node.hi ?? void 0);
        collect(node.body);
        return;
      case "block":
        node.rows.flat().forEach(collect);
        return;
      case "raw":
      case "num":
        return;
    }
  };
  collect(lhs);
  collect(rhs);
  for (const name of [...names]) {
    const def = defs.get(name);
    if (def) collect(def);
  }
  const roots = /* @__PURE__ */ new Set();
  for (const name of names) {
    if (defs.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === "mat") {
      for (const d of [info.ty.r, info.ty.c]) {
        if (typeof d !== "number") roots.add(ctx.dims.find(d.v));
      }
    }
  }
  const named = /* @__PURE__ */ new Map();
  for (const declared of ctx.dimVars) {
    const root = ctx.dims.find(declared);
    if (!named.has(root)) named.set(root, declared);
  }
  const out = [];
  for (const declared of ctx.dimVars) {
    const root = ctx.dims.find(declared);
    if (roots.has(root) && !out.includes(declared)) out.push(declared);
  }
  for (const root of roots) {
    const name = named.get(root) ?? root;
    if (!out.includes(name) && !name.startsWith("#")) out.push(name);
  }
  return out;
}

// src/core/verdict.ts
var ENGINE_VERSION = "1.0.1";
var DEFAULT_SEED = 5910618;
function collectSymbols(node, into) {
  if (!node) return;
  switch (node.k) {
    case "sym":
      into.add(node.name);
      return;
    case "num":
      return;
    case "op":
    case "call":
      for (const a of node.args) collectSymbols(a, into);
      return;
    case "deriv":
      collectSymbols(node.f, into);
      for (const w of node.wrt) collectSymbols(w, into);
      return;
    case "expect":
      for (const a of node.args) collectSymbols(a, into);
      return;
    case "bigop":
      collectSymbols(node.lo ?? void 0, into);
      collectSymbols(node.hi ?? void 0, into);
      collectSymbols(node.body, into);
      return;
    case "block":
      for (const row of node.rows) for (const cell of row) collectSymbols(cell, into);
      return;
    case "raw":
      return;
  }
}
function rawReason(node) {
  if (!node) return void 0;
  if (node.k === "raw") return node.text;
  switch (node.k) {
    case "op":
    case "call":
      for (const a of node.args) {
        const r = rawReason(a);
        if (r) return r;
      }
      return void 0;
    case "deriv":
      return rawReason(node.f);
    case "expect":
      for (const a of node.args) {
        const r = rawReason(a);
        if (r) return r;
      }
      return void 0;
    case "bigop":
      return rawReason(node.lo ?? void 0) ?? rawReason(node.hi ?? void 0) ?? rawReason(node.body);
    case "block":
      for (const row of node.rows) {
        for (const cell of row) {
          const r = rawReason(cell);
          if (r) return r;
        }
      }
      return void 0;
    default:
      return void 0;
  }
}
function analyzeSource(src, opts) {
  const rows = splitRows(src);
  const declared = parseDeclarations(opts.decls ?? "");
  const preset = presetDecls(opts.preset);
  const decls = mergeDecls(preset, declared.decls);
  const ctx = createContext(decls, opts.layout ?? "denominator");
  const defs = /* @__PURE__ */ new Map();
  const definedNames = /* @__PURE__ */ new Set();
  const knownFns = new Set(decls.filter((d) => d.kind === "function").map((d) => d.name));
  const steps = [];
  let previousRhs;
  let rowIndex = 0;
  for (const row of rows) {
    const parsed = parseRow(src, row.text, row.from, rowIndex, knownFns);
    rowIndex++;
    if (parsed.error) {
      steps.push({
        id: `s${steps.length}`,
        row: rowIndex,
        span: parsed.error.span,
        text: row.text,
        relation: "other",
        annotation: parsed.annotation,
        isDefinition: false,
        unreadable: parsed.error.message,
        symbols: /* @__PURE__ */ new Set()
      });
      continue;
    }
    if (parsed.prose || !parsed.parts.length) continue;
    for (const part of parsed.parts) {
      if (part.relation === "=>" || part.relation === "<=>") {
        const symbols2 = /* @__PURE__ */ new Set();
        collectSymbols(part.premise?.lhs, symbols2);
        collectSymbols(part.premise?.rhs, symbols2);
        collectSymbols(part.conclusion?.lhs, symbols2);
        collectSymbols(part.conclusion?.rhs, symbols2);
        steps.push({
          id: `s${steps.length}`,
          row: rowIndex,
          span: part.span,
          text: row.text,
          relation: part.relation,
          premise: part.premise,
          conclusion: part.conclusion,
          annotation: parsed.annotation,
          isDefinition: false,
          symbols: symbols2
        });
        previousRhs = part.conclusion?.rhs;
        continue;
      }
      let lhs = part.lhs ?? null ?? void 0;
      const rhs = part.rhs ?? null ?? void 0;
      if (!lhs && previousRhs) lhs = previousRhs;
      const symbols = /* @__PURE__ */ new Set();
      collectSymbols(lhs, symbols);
      collectSymbols(rhs, symbols);
      const bareLhs = defNameOf(lhs, ctx);
      const rightSymbols = /* @__PURE__ */ new Set();
      collectSymbols(rhs, rightSymbols);
      const isDefinition = part.relation === ":=" || bareLhs !== void 0 && !definedNames.has(bareLhs) && !isFunctionName(ctx, bareLhs) && !ctx.decls.has(bareLhs) && !rightSymbols.has(bareLhs);
      steps.push({
        id: `s${steps.length}`,
        row: rowIndex,
        span: part.span,
        text: row.text,
        lhs,
        rhs,
        proportionalTo: part.proportionalTo,
        relation: part.relation === ":=" ? "defined" : part.relation,
        annotation: parsed.annotation,
        isDefinition,
        defName: isDefinition ? bareLhs : void 0,
        symbols
      });
      previousRhs = rhs;
      if (bareLhs && isDefinition) definedNames.add(bareLhs);
      if (isDefinition && bareLhs && rhs) {
        defs.set(bareLhs, rhs);
        ctx.defs.set(bareLhs, rhs);
      }
    }
  }
  return { ctx, defs, steps };
}
function check(src, opts = {}) {
  const started = now();
  const seed = opts.seed ?? DEFAULT_SEED;
  const trials = opts.trials ?? 3;
  const source = analyzeSource(src, opts);
  const { ctx, defs, steps } = source;
  const decls = [...ctx.decls.values()];
  const chips = [];
  const diagnostics = [];
  const results = [];
  const used = /* @__PURE__ */ new Set();
  for (const step of steps) {
    for (const name of step.symbols) used.add(name);
    if (step.lhs?.k === "sym") used.add(step.lhs.name);
    if (step.rhs?.k === "sym") used.add(step.rhs.name);
  }
  for (const decl of decls) {
    if (used.has(decl.name)) continue;
    if (decl.source === "preset") continue;
    chips.push({
      id: "unused-declaration",
      symbol: decl.name,
      message: `${decl.name} is declared but no row uses it, so the declaration does nothing`,
      span: { from: 0, to: 0 }
    });
  }
  for (const step of steps) {
    const result = checkStep(step, ctx, defs, { seed, trials, budgetMs: opts.budgetMs ?? 500 }, diagnostics);
    result.text ??= step.text;
    results.push(result);
  }
  chips.push(...ctx.chips);
  return {
    version: ENGINE_VERSION,
    seed,
    steps: results,
    symbols: [...ctx.symbols.values()],
    chips,
    diagnostics,
    ms: Math.round(now() - started)
  };
}
function mergeDecls(preset, declared) {
  const out = [...preset];
  const index = new Map(out.map((d, i2) => [d.name, i2]));
  for (const d of declared) {
    const at = index.get(d.name);
    if (at === void 0) {
      index.set(d.name, out.length);
      out.push(d);
    } else {
      out[at] = d;
    }
  }
  return out;
}
function now() {
  return Date.now();
}
function checkStep(step, ctx, defs, opts, diagnostics) {
  const base2 = {
    trialsPerSize: opts.trials,
    sizes: [],
    assumptions: [],
    seed: opts.seed
  };
  if (step.unreadable) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: "other",
      verdict: "unchecked",
      card: base2,
      message: step.unreadable,
      reason: step.unreadable,
      annotation: step.annotation
    };
  }
  if (step.isDefinition) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: "defined",
      verdict: "defined",
      card: base2,
      message: step.defName ? `defined: ${step.defName}` : "defined",
      isDefinition: true,
      annotation: step.annotation
    };
  }
  if (step.relation === "=>" || step.relation === "<=>") {
    return checkImplication(step, ctx, defs, opts, base2);
  }
  if (step.relation !== "=" && step.relation !== "propto") {
    const message = unsupportedRelation(step.relation);
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: step.relation,
      verdict: "unchecked",
      card: base2,
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  if (!step.lhs || !step.rhs) {
    const message = "this row has no relation to check";
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: step.relation,
      verdict: "unchecked",
      card: base2,
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  const lhsTy = inferType(ctx, step.lhs);
  const rhsTy = inferType(ctx, step.rhs);
  let transposed = false;
  if (step.lhs?.k === "deriv" && rhsTy.t === "mat" && lhsTy.t === "mat") {
    const key = (d) => typeof d === "number" ? String(d) : ctx.dims.find(d.v);
    transposed = key(rhsTy.r) === key(lhsTy.c) && key(rhsTy.c) === key(lhsTy.r) && key(rhsTy.r) !== key(rhsTy.c);
  }
  if (lhsTy.t === "mat" && rhsTy.t === "mat") {
    unifyShapes(ctx, lhsTy, rhsTy, step.span);
  }
  const allErrors = ctx.errors.splice(0, ctx.errors.length);
  const shapeErrors = allErrors.filter((e) => e.kind !== "unknown-function");
  const unknownFn = allErrors.find((e) => e.kind === "unknown-function");
  if (shapeErrors.length && transposed) {
    shapeErrors[0].message = "this is the numerator layout: SAMOSA uses the denominator layout, where the gradient has the shape of the variable it is taken with respect to";
  }
  if (shapeErrors.length) {
    for (const error of shapeErrors) {
      diagnostics.push({ severity: "error", message: error.message, span: error.span, stepId: step.id });
    }
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs.span,
      rhsSpan: step.rhs.span,
      relation: step.relation,
      verdict: "shape",
      card: base2,
      message: shapeErrors[0].message,
      reason: shapeErrors.map((e) => e.message).join("; "),
      annotation: step.annotation
    };
  }
  if (unknownFn) {
    diagnostics.push({ severity: "error", message: unknownFn.message, span: unknownFn.span, stepId: step.id });
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs.span,
      rhsSpan: step.rhs.span,
      relation: step.relation,
      verdict: "unchecked",
      card: base2,
      message: `${unknownFn.message}, so SAMOSA cannot read this step`,
      reason: unknownFn.message,
      annotation: step.annotation
    };
  }
  const unreadable = rawReason(step.lhs) ?? rawReason(step.rhs);
  if (unreadable) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: "unchecked",
      card: base2,
      message: unreadable,
      reason: unreadable,
      annotation: step.annotation
    };
  }
  if (step.relation === "propto") {
    return checkProportionality(step, ctx, defs, opts, base2);
  }
  const mode = planMode(step, ctx, defs);
  if (mode === "unchecked") {
    const message = "SAMOSA cannot check this step";
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs.span,
      rhsSpan: step.rhs.span,
      relation: step.relation,
      verdict: "unchecked",
      card: base2,
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  if (mode === "exact") return checkExact(step, ctx, defs, opts, base2);
  return checkNumeric(step, ctx, defs, opts, base2);
}
function unifyShapes(ctx, a, b, span) {
  const r = unifyDim(ctx, a.r, b.r, "in this equality", span);
  const c = unifyDim(ctx, a.c, b.c, "in this equality", span);
  void r;
  void c;
}
function unsupportedRelation(relation) {
  switch (relation) {
    case "le":
    case "ge":
    case "lt":
    case "gt":
      return `inequalities (${relation}) are not checked in v1`;
    case "approx":
      return "approximations are not checked in v1";
    case "propto":
      return "proportionality is checked over the reals only";
    default:
      return "this relation is not checked in v1";
  }
}
function planMode(step, ctx, defs) {
  const nodes = [];
  if (step.lhs) nodes.push(step.lhs);
  if (step.rhs) nodes.push(step.rhs);
  for (const node of nodes) {
    if (!isRational(node, ctx, defs, /* @__PURE__ */ new Set())) return "numeric";
  }
  return "exact";
}
function isRational(node, ctx, defs, seen) {
  switch (node.k) {
    case "num":
      return true;
    case "sym": {
      const def = defs.get(node.name);
      if (def) {
        if (seen.has(node.name)) return true;
        seen.add(node.name);
        return isRational(def, ctx, defs, seen);
      }
      const info = ctx.symbols.get(node.name);
      if (info && info.ty.t === "rv") return false;
      return true;
    }
    case "op": {
      if (node.op === "abs" || node.op === "sqrtm") return false;
      return node.args.every((a) => isRational(a, ctx, defs, seen));
    }
    case "call":
      return node.fn === "det" || node.fn === "tr" || node.fn === "trace" || node.fn === "var" || node.fn === "cov";
    case "deriv":
      return isRational(node.f, ctx, defs, seen);
    case "expect":
      return true;
    case "bigop":
      return (!node.lo || isRational(node.lo, ctx, defs, seen)) && (!node.hi || isRational(node.hi, ctx, defs, seen)) && isRational(node.body, ctx, defs, seen);
    case "block":
      return node.rows.every((row) => row.every((cell) => isRational(cell, ctx, defs, seen)));
    case "raw":
      return false;
  }
}
function checkExact(step, ctx, defs, opts, card) {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const primes = [P1, P2];
  const corners = cornerCount(step, ctx, defs);
  if (corners > 7) {
    const message = "this step has too many structured symbols to draw every corner of";
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: step.relation,
      verdict: "unchecked",
      card: { ...card, assumptions: collectAssumptions(ctx, step) },
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  const trialsNeeded = Math.max(opts.trials, 2 ** corners);
  const mask = corners > 0 ? (1 << corners) - 1 : 0;
  let worstBound = 0;
  let worstDegree = 0;
  const working = [];
  const sizes = [];
  const assumptions = collectAssumptions(ctx, step);
  for (const setting of settings) {
    const ran = /* @__PURE__ */ new Map([[P1, 0], [P2, 0]]);
    const seen = /* @__PURE__ */ new Map([[P1, /* @__PURE__ */ new Set()], [P2, /* @__PURE__ */ new Set()]]);
    for (let trial = 0; trial < trialsNeeded; trial++) {
      for (const p of primes) {
        const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, p);
        const outcome = runExactTrial(step, ctx, defs, setting, p, rng, trial);
        if (outcome.kind === "ok") {
          ran.set(p, (ran.get(p) ?? 0) + 1);
          seen.get(p).add(trial & mask);
          continue;
        }
        if (outcome.kind === "unknown") {
          if (outcome.domain) {
            continue;
          }
          return {
            id: step.id,
            row: step.row,
            span: step.span,
            text: step.text,
            lhsSpan: step.lhs?.span,
            rhsSpan: step.rhs?.span,
            relation: step.relation,
            verdict: outcome.shape ? "shape" : "unchecked",
            card: { ...card, sizes, primes, assumptions },
            message: outcome.message,
            reason: outcome.message,
            annotation: step.annotation
          };
        }
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          text: step.text,
          lhsSpan: step.lhs?.span,
          rhsSpan: step.rhs?.span,
          relation: step.relation,
          verdict: "wrong",
          mode: "exact",
          card: { ...card, sizes, primes, degree: worstDegree, bound: worstBound, assumptions },
          message: outcome.message,
          reason: outcome.message,
          counterexample: outcome.counterexample,
          layoutHint: outcome.layoutHint,
          annotation: step.annotation
        };
      }
    }
    const covered = primes.every(
      (p) => (ran.get(p) ?? 0) > 0 && seen.get(p).size === 1 << corners
    );
    if (covered) {
      working.push({ setting, ranP1: ran.get(P1), ranP2: ran.get(P2) });
    }
  }
  if (!working.length) {
    const message = "this step could not be evaluated at any size";
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: "unchecked",
      card: { ...card, sizes, primes, assumptions },
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  for (const { setting, ranP1, ranP2 } of working) {
    sizes.push(Object.fromEntries(setting));
    const errorsAt = ctx.errors.length;
    const dl = degreeOf(ctx, step.lhs, setting, defs);
    const dr = degreeOf(ctx, step.rhs, setting, defs);
    ctx.errors.length = errorsAt;
    const d = Math.max(dl.n + dr.d, dr.n + dl.d);
    worstDegree = Math.max(worstDegree, d);
    const bound = Math.pow(d / P1, ranP1) * Math.pow(d / P2, ranP2);
    worstBound = Math.max(worstBound, bound);
  }
  const stepSymbols = /* @__PURE__ */ new Set();
  collectSymbols(step.lhs, stepSymbols);
  collectSymbols(step.rhs, stepSymbols);
  if (worstDegree === 0 && stepSymbols.size > 0) {
    const message = "the degree bound of this step came out as 0 although symbols were sampled, which is an engine gap; SAMOSA claims nothing here";
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: "inconclusive",
      card: { ...card, sizes, primes, assumptions },
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: "ok",
    mode: hasExpectation(step) ? "quadrature" : "exact",
    card: {
      ...card,
      trialsPerSize: trialsNeeded,
      sizes,
      primes,
      degree: worstDegree,
      bound: worstBound,
      assumptions
    },
    message: "holds at every size tested",
    annotation: step.annotation
  };
}
function cornerCount(step, ctx, defs) {
  let k = 0;
  for (const name of sampledNames(step, defs)) {
    const info = ctx.symbols.get(name);
    if (!info || info.ty.t !== "mat") continue;
    const has = (target) => info.props.some((x2) => typeof x2 === "string" && x2 === target);
    if (has("orth") || has("idem") || has("proj") || has("rot")) k++;
  }
  return k;
}
function runExactTrial(step, ctx, defs, setting, p, rng, trial) {
  const field = new GFpField(p);
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free, trial);
  if (sampled === "unknown") {
    return { kind: "unknown", message: "SAMOSA could not sample an instance of these objects" };
  }
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);
  const sides = evaluateSides(field, step.lhs, step.rhs, env, sampler);
  if (sides.kind === "unknown") {
    return { kind: "unknown", message: sides.message, domain: sides.domain, shape: sides.shape };
  }
  if (sides.kind === "equal") return { kind: "ok" };
  return {
    kind: "wrong",
    message: sides.message,
    layoutHint: sides.layoutHint,
    counterexample: buildCounterexample(ctx, step, setting, sampled.values, sides.lhs, sides.rhs, field)
  };
}
function compareSides(field, lhs, rhs, env, sampler) {
  return evaluateSides(field, lhs, rhs, env, sampler);
}
function evaluateSides(field, lhsNode, rhsNode, env, sampler) {
  const derivNode = lhsNode.k === "deriv" ? lhsNode : void 0;
  try {
    if (derivNode) {
      return compareDerivative(field, derivNode, rhsNode, env, sampler);
    }
    const lhs = evalNode(field, lhsNode, env);
    const rhs = evalNode(field, rhsNode, env);
    const realMatrix = (v) => v.k === "m" && !(v.m.r === 1 && v.m.c === 1);
    if (realMatrix(lhs) && rhs.k === "s" || lhs.k === "s" && realMatrix(rhs)) {
      const message = lhs.k === "m" ? "a matrix on the left, a scalar on the right" : "a scalar on the left, a matrix on the right";
      return { kind: "unknown", message, shape: true };
    }
    if (valuesEqual(field, lhs, rhs)) return { kind: "equal" };
    return { kind: "different", lhs, rhs, message: "the two sides are not equal" };
  } catch (error) {
    if (error instanceof EvalError) {
      const domain = /singular|non square|domain/i.test(error.message);
      const shape = /shape mismatch|not square|non square/i.test(error.message);
      return { kind: "unknown", message: error.message, domain, shape };
    }
    if (error instanceof DomainError) {
      return { kind: "unknown", message: error.message, domain: true };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: "unknown", message: `SAMOSA could not evaluate this step: ${detail}` };
  }
}
function compareDerivative(field, deriv, claimed, env, sampler) {
  const wrt = deriv.wrt[0];
  if (!wrt || wrt.k !== "sym") return { kind: "unknown", message: "SAMOSA does not know what to differentiate with respect to" };
  const pivotName = wrt.name;
  const pivot = env.values.get(pivotName);
  if (!pivot) {
    return { kind: "unknown", message: `no value for ${pivotName}` };
  }
  const fnNode = deriv.f;
  if (fnNode.k !== "sym") {
    return { kind: "unknown", message: "SAMOSA can only differentiate a named function" };
  }
  const def = env.defs.get(fnNode.name);
  if (!def) {
    return { kind: "unknown", message: `${fnNode.name} is not defined, so its derivative cannot be computed` };
  }
  const isScalarPivot = isScalarVal(pivot);
  const n = isScalarPivot ? 1 : pivot.m.r;
  const c = isScalarPivot ? 1 : pivot.m.c;
  const direction = isScalarPivot ? scalar(sampler.sampleScalar()) : { k: "m", m: sampler.sampleGeneral(n, c) };
  if (deriv.order === 2) {
    const w = isScalarPivot ? scalar(sampler.sampleScalar()) : { k: "m", m: sampler.sampleGeneral(n, c) };
    const mixed = mixedSecondDerivative(field, def, env, pivotName, pivot, direction, w);
    const claimedVal2 = evalNode(field, claimed, env);
    if (isMatrixVal(claimedVal2)) {
      const value = isScalarPivot ? field.mul(
        field.mul(
          direction.v,
          claimedVal2.m.d[0]
        ),
        w.v
      ) : quadraticForm(field, direction.m, claimedVal2.m, w.m);
      const mixedScalar = asScalar(field, mixed);
      if (mixedScalar === null) {
        return {
          kind: "different",
          lhs: mixed,
          rhs: claimedVal2,
          message: "the claimed Hessian is not the Hessian of that function"
        };
      }
      if (field.eq(value, mixedScalar)) return { kind: "equal" };
      return {
        kind: "different",
        lhs: scalar(mixedScalar),
        rhs: scalar(value),
        message: "the claimed Hessian is not the Hessian of that function"
      };
    }
    return { kind: "unknown", message: "the right hand side of a Hessian claim has to be a matrix" };
  }
  const tangent = directionalDerivative(field, def, env, pivotName, pivot, direction);
  const claimedVal = evalNode(field, claimed, env);
  const tangentScalar = asScalar(field, tangent);
  if (tangentScalar !== null && isMatrixVal(claimedVal) && !isScalarPivot) {
    const inner2 = innerProduct(field, claimedVal.m, direction.m);
    if (fieldClose(field, inner2, tangentScalar)) return { kind: "equal" };
    const dirMat = direction.m;
    if (claimedVal.m.r === dirMat.c && claimedVal.m.c === dirMat.r) {
      const flipped = innerProduct(field, transposeMat(claimedVal.m), dirMat);
      if (field.eq(flipped, tangentScalar)) {
        return {
          kind: "different",
          lhs: scalar(tangentScalar),
          rhs: scalar(flipped),
          message: "this is the numerator layout gradient; SAMOSA uses the denominator layout",
          layoutHint: "The gradient has the shape of the variable it is taken with respect to. Transpose it."
        };
      }
    }
    return {
      kind: "different",
      lhs: scalar(tangentScalar),
      rhs: scalar(inner2),
      message: "the claimed gradient is not the gradient of that function"
    };
  }
  if (tangentScalar !== null && isScalarVal(claimedVal) && isScalarPivot) {
    const expected = field.mul(claimedVal.v, direction.v);
    if (fieldClose(field, tangentScalar, expected)) return { kind: "equal" };
    return {
      kind: "different",
      lhs: tangent,
      rhs: claimedVal,
      message: "the claimed derivative is not the derivative of that function"
    };
  }
  if (isMatrixVal(tangent) && isMatrixVal(claimedVal) && isMatrixVal(direction)) {
    const product = matMul(field, claimedVal.m, direction.m);
    if (product.r === tangent.m.r && product.c === tangent.m.c) {
      let same = true;
      for (let i2 = 0; i2 < product.d.length; i2++) {
        if (!fieldClose(field, product.d[i2], tangent.m.d[i2])) {
          same = false;
          break;
        }
      }
      if (same) return { kind: "equal" };
    }
    return {
      kind: "different",
      lhs: tangent,
      rhs: claimedVal,
      message: "the claimed Jacobian is not the Jacobian of that function"
    };
  }
  return { kind: "unknown", message: "the two sides of this derivative claim do not have comparable shapes" };
}
function asScalar(_field, val) {
  if (isScalarVal(val)) return val.v;
  if (val.m.r === 1 && val.m.c === 1) return val.m.d[0];
  return null;
}
function innerProduct(field, g, v) {
  let sum2 = field.zero;
  for (let i2 = 0; i2 < g.r; i2++) {
    for (let j = 0; j < g.c; j++) {
      sum2 = field.add(sum2, field.mul(g.d[i2 * g.c + j], v.d[i2 * v.c + j]));
    }
  }
  return sum2;
}
function quadraticForm(field, v, h, w) {
  let sum2 = field.zero;
  for (let i2 = 0; i2 < v.r; i2++) {
    for (let j = 0; j < h.c; j++) {
      sum2 = field.add(
        sum2,
        field.mul(field.mul(v.d[i2 * v.c], h.d[i2 * h.c + j]), w.d[j * w.c])
      );
    }
  }
  return sum2;
}
function transposeMat(m) {
  const d = new Array(m.r * m.c);
  for (let i2 = 0; i2 < m.r; i2++) for (let j = 0; j < m.c; j++) d[j * m.r + i2] = m.d[i2 * m.c + j];
  return { r: m.c, c: m.r, d };
}
function isFunctionName(ctx, name) {
  const decl = ctx.decls.get(name);
  return decl?.kind === "function";
}
function fieldClose(field, a, b) {
  if (field instanceof GFpField) return field.eq(a, b);
  const x2 = field.toNumber(a);
  const y = field.toNumber(b);
  const scale = Math.max(1, Math.abs(x2), Math.abs(y));
  return Math.abs(x2 - y) <= 1e-12 * scale;
}
function hasExpectation(step) {
  const check2 = (node) => {
    if (!node) return false;
    if (node.k === "expect") return true;
    if (node.k === "op" || node.k === "call") return node.args.some(check2);
    if (node.k === "deriv") return check2(node.f);
    if (node.k === "bigop") return check2(node.body);
    if (node.k === "block") return node.rows.flat().some(check2);
    return false;
  };
  return stepNodes(step).some(check2);
}
function freeVariables(step) {
  const out = /* @__PURE__ */ new Set();
  const add2 = (node) => {
    if (node && node.k === "deriv") {
      for (const w of node.wrt) if (w.k === "sym") out.add(w.name);
    }
  };
  add2(step.lhs);
  add2(step.rhs);
  if (step.premise) {
    add2(step.premise.lhs);
    add2(step.premise.rhs);
  }
  if (step.conclusion) {
    add2(step.conclusion.lhs);
    add2(step.conclusion.rhs);
  }
  return out;
}
function defNameOf(lhs, ctx) {
  if (!lhs) return void 0;
  if (lhs.k === "sym") {
    const caret = lhs.name.lastIndexOf("^");
    if (caret >= 0 && /^[+-]?[\d.]/.test(lhs.name.slice(caret + 1))) return void 0;
    return lhs.name;
  }
  if (lhs.k === "call") {
    const decl = ctx.decls.get(lhs.fn);
    if (decl && decl.kind === "function") return lhs.fn;
    if (DEFAULT_FUNCTIONS.has(lhs.fn)) return void 0;
    return lhs.fn;
  }
  return void 0;
}
function stepNodes(step) {
  const out = [];
  if (step.lhs) out.push(step.lhs);
  if (step.rhs) out.push(step.rhs);
  if (step.premise?.lhs) out.push(step.premise.lhs);
  if (step.premise?.rhs) out.push(step.premise.rhs);
  if (step.conclusion?.lhs) out.push(step.conclusion.lhs);
  if (step.conclusion?.rhs) out.push(step.conclusion.rhs);
  return out;
}
function sampleFor(ctx, step, defs, setting, sampler, free = /* @__PURE__ */ new Set(), variety = 0) {
  const values = /* @__PURE__ */ new Map();
  const quad = /* @__PURE__ */ new Map();
  const names = sampledNames(step, defs, free);
  const pegs = new Map(names.map((n, i2) => [n, i2]));
  for (const name of names) {
    if (values.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    const peg = pegs.get(name) ?? 0;
    if (info.ty.t === "rv") {
      const dist = info.ty.dist;
      const size = info.ty.of.t === "mat" ? dimSizeOf(ctx, info.ty.of.r, setting) : 1;
      let mean;
      if (dist.kind === "normal" && dist.mu !== "0") {
        const existing = values.get(dist.mu);
        if (existing) {
          mean = existing;
        } else {
          mean = { k: "m", m: sampler.sampleGeneral(size, 1) };
          values.set(dist.mu, mean);
        }
      } else {
        mean = { k: "m", m: sampler.sampleGeneral(size, 1) };
      }
      const root = sampler.sampleGeneral(size, size);
      const f = sampler.field;
      if (dist.kind === "normal" && dist.sigma !== "I") {
        values.set(dist.sigma, { k: "m", m: matMul(f, root, transpose(root)) });
      }
      const z2 = sampler.sampleGeneral(size, 1);
      const meanMat = isMatrixVal(mean) ? mean.m : { r: size, c: 1, d: new Array(size).fill(f.zero) };
      values.set(name, { k: "m", m: matAdd(f, meanMat, matMul(f, root, z2)) });
      values.set(`__mean_${name}`, mean);
      quad.set(name, { name, mean, root, dim: size, rule: GAUSS7 });
      continue;
    }
    if (info.ty.t === "scalar") {
      const value = info.props.some((p) => p === "pos") ? sampler.samplePositiveScalar() : sampler.sampleScalar(variety, peg);
      values.set(name, scalar(value));
      continue;
    }
    if (info.ty.t !== "mat") continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    const forced = singularByDesign(info.props, r, c, variety >> peg & 1);
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const val = sampler.sample({ name, r, c, props: info.props, variety: variety >> peg & 1 });
      if (!val) continue;
      if (val.k === "m" && !forced && isSingular(sampler.field, val.m)) continue;
      values.set(name, val);
      placed = true;
      break;
    }
    if (!placed) return "unknown";
  }
  return { values, quad };
}
function sampledNames(step, defs, free = /* @__PURE__ */ new Set()) {
  const names = /* @__PURE__ */ new Set();
  for (const node of stepNodes(step)) collectSymbols(node, names);
  for (const name of [...names]) {
    const def = defs.get(name);
    if (def) collectSymbols(def, names);
  }
  return [...names].filter((name) => !(defs.has(name) && !free.has(name)));
}
function singularByDesign(props, r, c, corner) {
  const has = (target) => props.some((x2) => typeof x2 === "string" && x2 === target);
  if (has("zero")) return true;
  if (has("idem") || has("proj")) {
    const rank = corner === 0 ? Math.min(r, c) : Math.max(1, Math.min(r, c) - 1);
    return rank < Math.min(r, c);
  }
  if (has("skew")) return r === c && r % 2 === 1;
  return false;
}
function isSingular(field, m) {
  if (m.r !== m.c) return false;
  try {
    matInv(field, m);
    return false;
  } catch {
    return true;
  }
}
function valuesEqual(field, a, b) {
  if (a.k === "s" && b.k === "s") return field.eq(a.v, b.v);
  if (a.k === "m" && b.k === "s" && a.m.r === 1 && a.m.c === 1) return field.eq(a.m.d[0], b.v);
  if (a.k === "s" && b.k === "m" && b.m.r === 1 && b.m.c === 1) return field.eq(a.v, b.m.d[0]);
  if (a.k === "m" && b.k === "m") {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return false;
    for (let i2 = 0; i2 < a.m.d.length; i2++) if (!field.eq(a.m.d[i2], b.m.d[i2])) return false;
    return true;
  }
  return false;
}
function checkProportionality(step, ctx, defs, opts, card) {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const assumptions = collectAssumptions(ctx, step);
  const sizes = [];
  const variable = step.proportionalTo;
  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting));
    const rng = rngFor(opts.seed, step.id, settingKey(setting), "propto");
    const field = new F64Field();
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = defs;
    const sampled = sampleFor(ctx, step, defs, setting, sampler);
    if (sampled === "unknown") {
      const message = "could not sample an instance";
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: "unchecked",
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation
      };
    }
    for (const [name2, value] of sampled.values.entries()) env.values.set(name2, value);
    const name = variable ?? guessProportionalityVariable(step, ctx);
    if (!name) {
      const message = "SAMOSA does not know which variable this proportionality is taken in. Write \\propto_x.";
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: "unchecked",
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation
      };
    }
    const info = ctx.symbols.get(name);
    if (!info) {
      const message = `SAMOSA does not know the shape of ${name}`;
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: "unchecked",
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation
      };
    }
    const differences = [];
    for (let point = 0; point < 3; point++) {
      const trialEnv = { ...env, values: new Map(env.values), memo: /* @__PURE__ */ new Map() };
      if (info.ty.t === "mat") {
        const r = dimSizeOf(ctx, info.ty.r, setting);
        const c = dimSizeOf(ctx, info.ty.c, setting);
        trialEnv.values.set(name, { k: "m", m: sampler.sampleGeneral(r, c) });
      } else {
        trialEnv.values.set(name, scalar(sampler.sampleScalar()));
      }
      let left;
      let right;
      try {
        const l = evalNode(field, step.lhs, trialEnv);
        const r = evalNode(field, step.rhs, trialEnv);
        left = asNumber(l);
        right = asNumber(r);
      } catch {
        const message = "SAMOSA could not evaluate this proportionality over the reals";
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          relation: step.relation,
          verdict: "unchecked",
          card: { ...card, sizes, assumptions },
          message,
          reason: message,
          annotation: step.annotation
        };
      }
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        const message = "this proportionality was not defined at one of the points";
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          relation: step.relation,
          verdict: "unchecked",
          card: { ...card, sizes, assumptions },
          message,
          reason: message,
          annotation: step.annotation
        };
      }
      differences.push(Math.log(Math.abs(left)) - Math.log(Math.abs(right)));
    }
    const spread = Math.max(...differences) - Math.min(...differences);
    const scale = Math.max(1, ...differences.map((d) => Math.abs(d)));
    if (spread > 1e-8 * scale) {
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: "wrong",
        mode: "numeric",
        card: { ...card, sizes, assumptions },
        message: `the ratio of the two sides depends on ${name}, so they are not proportional`,
        reason: `the ratio of the two sides depends on ${name}, so they are not proportional`,
        annotation: step.annotation
      };
    }
  }
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    relation: step.relation,
    verdict: "ok",
    mode: "numeric",
    card: { ...card, sizes, assumptions },
    message: "the ratio of the two sides does not depend on the variable",
    annotation: step.annotation
  };
}
function asNumber(val) {
  if (isScalarVal(val)) return Number(val.v);
  return Number(val.m.d[0]);
}
function guessProportionalityVariable(step, ctx) {
  const names = /* @__PURE__ */ new Set();
  collectSymbols(step.lhs, names);
  for (const name of names) {
    const info = ctx.symbols.get(name);
    if (info && info.ty.t === "mat") return name;
  }
  return void 0;
}
var NUMERIC_TRIALS = 8;
function checkNumeric(step, ctx, defs, opts, card) {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const sizes = [];
  const assumptions = collectAssumptions(ctx, step);
  let f64Max = 0;
  let decMax = 0;
  const dec = new DecField(50);
  const domainResult = (message2) => {
    const text = `this step was not defined at a sampled point (${message2}), for instance the log or the square root of a negative number; declaring the symbols it depends on positive may be what it needs`;
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: "inconclusive",
      mode: "numeric",
      card: { ...card, sizes, assumptions },
      message: text,
      reason: text,
      annotation: step.annotation
    };
  };
  const unevaluable = (message2) => ({
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    relation: step.relation,
    verdict: "unchecked",
    card: { ...card, sizes, assumptions },
    message: message2,
    reason: message2,
    annotation: step.annotation
  });
  const shapeResult = (message2) => ({
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: "shape",
    card: { ...card, sizes, assumptions },
    message: message2,
    reason: message2,
    annotation: step.annotation
  });
  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting));
    for (let trial = 0; trial < NUMERIC_TRIALS; trial++) {
      const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, "f64");
      const run = numericDelta(ctx, defs, step, setting, rng, trial, new F64Field());
      if (run === null) {
        return unevaluable("SAMOSA could not evaluate this step over the reals");
      }
      if (run === "domain") {
        return domainResult("a sampled instance was outside the domain");
      }
      if (run.shapeMessage) {
        return shapeResult(run.shapeMessage);
      }
      f64Max = Math.max(f64Max, run.delta);
      if (run.delta > 1e-6) {
        let confirmed = false;
        for (let k = 0; k < NUMERIC_TRIALS && !confirmed; k++) {
          const rng2 = rngFor(opts.seed, step.id, settingKey(setting), k, "dec", 1);
          const run2 = numericDelta(ctx, defs, step, setting, rng2, k, dec);
          if (run2 === null) continue;
          if (run2 === "domain") {
            return domainResult("a 50 digit instance was outside the domain");
          }
          if (run2.delta > 1e-20) confirmed = true;
        }
        const message2 = confirmed ? "the two sides differ" : "the two sides differ, but not enough to call it wrong";
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          text: step.text,
          lhsSpan: step.lhs?.span,
          rhsSpan: step.rhs?.span,
          relation: step.relation,
          verdict: confirmed ? "wrong" : "inconclusive",
          mode: "numeric",
          card: { ...card, sizes, maxDelta: Math.max(f64Max, decMax), assumptions },
          message: message2,
          reason: message2,
          annotation: step.annotation
        };
      }
    }
  }
  for (const setting of settings) {
    for (let trial = 0; trial < NUMERIC_TRIALS; trial++) {
      const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, "dec");
      const run = numericDelta(ctx, defs, step, setting, rng, trial, dec);
      if (run === null) {
        return unevaluable("SAMOSA could not evaluate this step at 50 digits");
      }
      if (run === "domain") {
        return domainResult("a 50 digit instance was outside the domain");
      }
      if (run.shapeMessage) {
        return shapeResult(run.shapeMessage);
      }
      decMax = Math.max(decMax, run.delta);
    }
  }
  if (decMax < 1e-35) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: "ok",
      mode: "numeric",
      card: {
        ...card,
        trialsPerSize: NUMERIC_TRIALS,
        sizes,
        maxDelta: decMax,
        assumptions
      },
      message: "the two sides agree to 50 digits",
      annotation: step.annotation
    };
  }
  const message = "the two sides agree, but not to 50 digits";
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: "inconclusive",
    mode: "numeric",
    card: { ...card, sizes, maxDelta: decMax, assumptions },
    message,
    reason: message,
    annotation: step.annotation
  };
}
function numericDelta(ctx, defs, step, setting, rng, trial, field) {
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free, trial);
  if (sampled === "unknown") return null;
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);
  const sides = evaluateSides(field, step.lhs, step.rhs, env, sampler);
  if (sides.kind === "unknown") {
    if (sides.shape) return { delta: Number.NaN, shapeMessage: sides.message };
    return "domain";
  }
  if (sides.kind === "equal") return { delta: 0 };
  const delta = relativeDelta(field, sides.lhs, sides.rhs);
  return Number.isFinite(delta) ? { delta } : "domain";
}
function relativeDelta(field, a, b) {
  const flat = (v) => v.k === "s" ? [field.toNumber(v.v)] : v.m.d.map((x2) => field.toNumber(x2));
  const fa = flat(a);
  const fb = flat(b);
  if (fa.length !== fb.length) return Number.POSITIVE_INFINITY;
  let diff = 0;
  let scale = 0;
  for (let i2 = 0; i2 < fa.length; i2++) {
    diff = Math.max(diff, Math.abs(fa[i2] - fb[i2]));
    scale = Math.max(scale, Math.abs(fa[i2]), Math.abs(fb[i2]));
  }
  if (scale === 0) return diff === 0 ? 0 : Number.POSITIVE_INFINITY;
  return diff / scale;
}
function collectDimVars(ctx, step, defs) {
  const lhs = step.lhs;
  const rhs = step.rhs;
  if (step.premise?.lhs || step.conclusion?.lhs) {
    return collectDimVarsFor(ctx, step.conclusion?.lhs ?? lhs, step.conclusion?.rhs ?? rhs, defs);
  }
  return collectDimVarsFor(ctx, lhs, rhs, defs);
}
function sizeSettings(dimVars) {
  if (dimVars.length === 0) return [/* @__PURE__ */ new Map()];
  if (dimVars.length === 1) {
    return [2, 3, 4].map((n) => /* @__PURE__ */ new Map([[dimVars[0], n]]));
  }
  if (dimVars.length === 2) {
    const [a, b] = dimVars;
    return [
      /* @__PURE__ */ new Map([[a, 3], [b, 2]]),
      /* @__PURE__ */ new Map([[a, 2], [b, 3]]),
      /* @__PURE__ */ new Map([[a, 4], [b, 3]])
    ];
  }
  const cycle = [2, 3, 4, 5];
  const out = [];
  for (let shift = 0; shift < 3; shift++) {
    const m = /* @__PURE__ */ new Map();
    dimVars.forEach((v, i2) => m.set(v, cycle[(i2 + shift) % cycle.length]));
    out.push(m);
  }
  return out;
}
function settingKey(setting) {
  return [...setting.entries()].map(([k, v]) => `${k}=${v}`).join(",");
}
function collectAssumptions(ctx, step) {
  const out = /* @__PURE__ */ new Set();
  for (const name of step.symbols) {
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.assumption) out.add(info.assumption);
    const props = info.props.map((p) => typeof p === "string" ? PROP_WORDS2[p] : p && "rank" in p ? `of rank ${p.rank}` : null).filter((p) => Boolean(p));
    const alreadySaid = info.props.every(
      (p) => typeof p === "string" && (p === "ident" || p === "zero" || p === "ones")
    );
    if (props.length && !(info.assumption && alreadySaid)) {
      out.add(`${info.display || name} is ${props.join(" and ")}`);
    }
  }
  if (!out.size) out.add("every symbol was declared");
  return [...out];
}
var PROP_WORDS2 = {
  sym: "symmetric",
  spd: "symmetric positive definite",
  psd: "symmetric positive semi definite",
  orth: "orthogonal",
  rot: "a rotation",
  diag: "diagonal",
  triu: "upper triangular",
  tril: "lower triangular",
  skew: "skew symmetric",
  idem: "idempotent",
  proj: "a projector",
  unit: "unit length",
  stoch: "stochastic",
  pos: "positive",
  int: "an integer",
  ident: "the identity",
  zero: "zero",
  ones: "ones"
};
function buildCounterexample(_ctx, _step, setting, sampled, lhs, rhs, field) {
  const dims = {};
  for (const [k, v] of setting) dims[k] = v;
  const residues = {};
  for (const [name, val] of sampled) {
    residues[name] = val.k === "s" ? val.v : val.m.d;
  }
  const lhsVal = lhs.k === "s" ? lhs.v : lhs.m.d;
  const rhsVal = rhs.k === "s" ? rhs.v : rhs.m.d;
  const diff = lhs.k === "s" && rhs.k === "s" ? field.sub(lhs.v, rhs.v) : lhs.k === "m" && rhs.k === "m" ? lhs.m.d.map((x2, i2) => field.sub(x2, rhs.m.d[i2])) : null;
  return {
    dims,
    values: {},
    lhs: null,
    rhs: null,
    diff: null,
    numpy: "",
    debug: { residues, lhs: lhsVal, rhs: rhsVal, diff }
  };
}
function checkImplication(step, ctx, defs, opts, card) {
  const premise = step.premise;
  const conclusion = step.conclusion;
  if (!premise || !conclusion || !conclusion.lhs || !conclusion.rhs) {
    const message = "this implication has no conclusion to check";
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: "unchecked",
      card,
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  const conclusionLhs = conclusion.lhs;
  const pivot = conclusionLhs && conclusionLhs.k === "sym" ? conclusionLhs.name : void 0;
  if (!pivot) {
    const message = "the conclusion of this implication is not a single variable";
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: "unchecked",
      card,
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const primes = [P1, P2];
  const sizes = [];
  const assumptions = collectAssumptions(ctx, step);
  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting));
    for (let trial = 0; trial < opts.trials; trial++) {
      for (const p of primes) {
        const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, p);
        const outcome = runImplicationTrial(step, ctx, defs, setting, p, rng);
        if (outcome.kind === "ok") continue;
        if (outcome.kind === "unknown") {
          if (outcome.domain) {
            continue;
          }
          return {
            id: step.id,
            row: step.row,
            span: step.span,
            text: step.text,
            lhsSpan: step.lhs?.span,
            rhsSpan: step.rhs?.span,
            relation: step.relation,
            verdict: outcome.shape ? "shape" : "unchecked",
            card: { ...card, sizes, primes, assumptions },
            message: outcome.message,
            reason: outcome.message,
            annotation: step.annotation
          };
        }
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          lhsSpan: conclusion.lhs.span,
          rhsSpan: conclusion.rhs.span,
          relation: step.relation,
          verdict: "wrong",
          mode: "exact",
          card: { ...card, sizes, primes, assumptions },
          message: outcome.message,
          reason: outcome.message,
          counterexample: outcome.counterexample,
          annotation: step.annotation
        };
      }
    }
  }
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    lhsSpan: conclusion.lhs.span,
    rhsSpan: conclusion.rhs.span,
    relation: step.relation,
    verdict: "ok",
    mode: "exact",
    card: { ...card, sizes, primes, assumptions },
    message: "the implication holds at every size tested",
    annotation: step.annotation
  };
}
function runImplicationTrial(step, ctx, defs, setting, p, rng) {
  const premise = step.premise;
  const conclusion = step.conclusion;
  const field = new GFpField(p);
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  const sampled = sampleFor(ctx, step, defs, setting, sampler);
  if (sampled === "unknown") return { kind: "unknown", message: "could not sample an instance" };
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);
  const conclusionLhs = conclusion.lhs;
  const pivot = conclusionLhs && conclusionLhs.k === "sym" ? conclusionLhs.name : void 0;
  if (!pivot) return { kind: "unknown", message: "the conclusion is not about a single variable" };
  const pivotValue = env.values.get(pivot);
  if (!pivotValue || pivotValue.k !== "m") return { kind: "unknown", message: `no value for ${pivot}` };
  const n = pivotValue.m.r;
  const dim = pivotValue.m.c;
  const residual = (x2) => {
    const trialEnv = { ...env, values: new Map(env.values), memo: /* @__PURE__ */ new Map() };
    trialEnv.values.set(pivot, { k: "m", m: x2 });
    try {
      if (premise.lhs?.k === "deriv") {
        const grad = gradientAt(field, premise.lhs, trialEnv, pivot, x2, n);
        if (!grad) return null;
        const rhs = premise.rhs ? evalNode(field, premise.rhs, trialEnv) : scalar(field.zero);
        const rhsScalar = asScalar(field, rhs);
        if (rhsScalar === null) return null;
        return {
          r: grad.r,
          c: grad.c,
          d: grad.d.map((x3) => field.sub(x3, rhsScalar))
        };
      }
      const l = evalResidual(field, premise, trialEnv);
      if (!l) return null;
      return l;
    } catch {
      return null;
    }
  };
  const dir = sampler.sampleGeneral(n, dim);
  const second = secondDirectional(field, residual, pivotValue.m, dir);
  if (second === null) return { kind: "unknown", message: "could not evaluate the premise" };
  if (!second.d.every((x2) => field.isZero(x2))) {
    return {
      kind: "unknown",
      message: "the premise is not affine in the variable, so the implication is not checked in v1"
    };
  }
  const r0 = residual(pivotValue.m);
  if (!r0) return { kind: "unknown", message: "could not evaluate the premise" };
  const rows = r0.r;
  const cols = r0.c;
  const jac = { r: rows, c: n, d: new Array(rows * n).fill(field.zero) };
  for (let j = 0; j < n; j++) {
    const e = { r: n, c: dim, d: new Array(n * dim).fill(field.zero) };
    e.d[j * dim + (dim - 1)] = field.one;
    const rj = residual(addMat(field, pivotValue.m, e));
    if (!rj) return { kind: "unknown", message: "could not evaluate the premise" };
    for (let i2 = 0; i2 < rows; i2++) jac.d[i2 * n + j] = field.sub(rj.d[i2 * cols], r0.d[i2 * cols]);
  }
  let stepVec;
  try {
    const inv = matInv(field, jac);
    stepVec = matMul(field, inv, r0);
  } catch {
    return { kind: "unknown", message: "the premise could not be solved for that variable" };
  }
  const solved = subMat(field, pivotValue.m, stepVec);
  const solvedEnv = { ...env, values: new Map(env.values), memo: /* @__PURE__ */ new Map() };
  solvedEnv.values.set(pivot, { k: "m", m: solved });
  let cl;
  let cr;
  try {
    cl = evalNode(field, conclusion.lhs, solvedEnv);
    cr = evalNode(field, conclusion.rhs, solvedEnv);
  } catch {
    return { kind: "unknown", message: "could not evaluate the conclusion" };
  }
  if (valuesEqual(field, cl, cr)) return { kind: "ok" };
  const realMatrix = (v) => v.k === "m" && !(v.m.r === 1 && v.m.c === 1);
  if (realMatrix(cl) && cr.k === "s" || cl.k === "s" && realMatrix(cr)) {
    return {
      kind: "unknown",
      message: cl.k === "m" ? "a matrix on the left, a scalar on the right" : "a scalar on the left, a matrix on the right"
    };
  }
  return {
    kind: "wrong",
    message: "the implication does not follow",
    counterexample: buildCounterexample(ctx, step, setting, sampled.values, cl, cr, field)
  };
}
function gradientAt(field, deriv, env, pivotName, baseValue, n) {
  const fnNode = deriv.f;
  if (fnNode.k !== "sym") return null;
  const def = env.defs.get(fnNode.name);
  if (!def) return null;
  const g = { r: n, c: 1, d: new Array(n).fill(field.zero) };
  for (let i2 = 0; i2 < n; i2++) {
    const e = { r: n, c: 1, d: new Array(n).fill(field.zero) };
    e.d[i2] = field.one;
    const tangent = directionalDerivative(field, def, env, pivotName, { k: "m", m: baseValue }, { k: "m", m: e });
    const value = asScalar(field, tangent);
    if (value === null) return null;
    g.d[i2] = value;
  }
  return g;
}
function evalResidual(field, premise, env) {
  const l = evalNode(field, premise.lhs, env);
  const r = premise.rhs ? evalNode(field, premise.rhs, env) : scalar(field.zero);
  if (l.k === "m" && r.k === "m") return matSub(field, l.m, r.m);
  if (l.k === "s" && r.k === "s") return { r: 1, c: 1, d: [field.sub(l.v, r.v)] };
  return null;
}
function addMat(field, a, b) {
  const d = new Array(a.r * a.c);
  for (let i2 = 0; i2 < d.length; i2++) d[i2] = field.add(a.d[i2], b.d[i2]);
  return { r: a.r, c: a.c, d };
}
function subMat(field, a, b) {
  const d = new Array(a.r * a.c);
  for (let i2 = 0; i2 < d.length; i2++) d[i2] = field.sub(a.d[i2], b.d[i2]);
  return { r: a.r, c: a.c, d };
}
function secondDirectional(field, residual, x2, dir) {
  const plus = residual(addMat(field, x2, dir));
  const minus = residual(subMat(field, x2, dir));
  const centre = residual(x2);
  if (!plus || !minus || !centre) return null;
  const d = new Array(plus.d.length);
  const two = field.fromRational(2, 1);
  for (let i2 = 0; i2 < d.length; i2++) {
    d[i2] = field.sub(field.add(plus.d[i2], minus.d[i2]), field.mul(two, centre.d[i2]));
  }
  return { r: plus.r, c: plus.c, d };
}

// src/core/render.ts
function renderNode(node) {
  switch (node.k) {
    case "num": {
      const v = node.value;
      if (v.d === 1) return String(v.n);
      if (v.d < 0) return `-${-v.n}/${-v.d}`;
      return `\\frac{${v.n}}{${v.d}}`;
    }
    case "sym":
      return renderSymbol(node.name);
    case "op":
      return renderOp(node);
    case "call":
      return `${node.fn}\\left(${node.args.map(renderNode).join(", ")}\\right)`;
    case "deriv": {
      const wrt = node.wrt.map((w) => `\\partial ${renderNode(w)}`).join(" ");
      return `\\frac{\\partial${node.order === 2 ? "^2" : ""} ${renderNode(node.f)}}{${wrt}}`;
    }
    case "expect": {
      const op = node.op === "E" ? "\\mathbb{E}" : node.op === "Var" ? "\\operatorname{Var}" : "\\operatorname{Cov}";
      return `${op}\\left[${node.args.map(renderNode).join(", ")}\\right]`;
    }
    case "bigop": {
      const op = node.kind === "sum" ? "\\sum" : "\\prod";
      const lo = node.lo ? renderNode(node.lo) : "";
      const hi = node.hi ? renderNode(node.hi) : "";
      return `${op}_{${node.idx}=${lo}}^{${hi}} ${renderNode(node.body)}`;
    }
    case "block": {
      const rows = node.rows.map((row) => row.map(renderNode).join(" & ")).join(" \\\\ ");
      return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
    }
    case "raw":
      return node.text;
  }
}
function renderSymbol(name) {
  const supIndex = name.indexOf("^");
  const subIndex = name.indexOf("_");
  let base2 = name;
  let sub2 = "";
  let sup = "";
  if (subIndex >= 0 && (supIndex < 0 || subIndex < supIndex)) {
    base2 = name.slice(0, subIndex);
    const rest = name.slice(subIndex + 1);
    if (supIndex > subIndex) {
      sub2 = rest.slice(0, supIndex - subIndex - 1);
      sup = rest.slice(supIndex - subIndex);
    } else {
      sub2 = rest;
    }
  } else if (supIndex >= 0) {
    base2 = name.slice(0, supIndex);
    sup = name.slice(supIndex);
  }
  let out = base2;
  if (sub2) out += sub2.length === 1 ? `_${sub2}` : `_{${sub2}}`;
  if (sup) out += sup.length === 1 ? `^${sup}` : `^{${sup}}`;
  return out;
}
function renderOp(node) {
  const a = node.args.map(renderNode);
  switch (node.op) {
    case "add":
      return `${operand(node.args[0])} + ${operand(node.args[1])}`;
    case "sub":
      return `${operand(node.args[0])} - ${operand(node.args[1])}`;
    case "neg":
      return `-${operand(node.args[0])}`;
    case "mul":
      return `${operand(node.args[0])} ${operand(node.args[1])}`;
    case "div":
      return `\\frac{${a[0]}}{${a[1]}}`;
    case "pow":
      return `${base(node.args[0])}^{${a[1]}}`;
    case "inv":
      return `${base(node.args[0])}^{-1}`;
    case "invT":
      return `${base(node.args[0])}^{-\\top}`;
    case "T":
      return `${base(node.args[0])}^\\top`;
    case "tr":
      return `\\operatorname{tr}\\left(${a[0]}\\right)`;
    case "det":
      return `\\det\\left(${a[0]}\\right)`;
    case "adj":
      return `\\operatorname{adj}\\left(${a[0]}\\right)`;
    case "kron":
      return `${a[0]} \\otimes ${a[1]}`;
    case "had":
      return `${a[0]} \\odot ${a[1]}`;
    case "inner":
      return `\\left\\langle ${a[0]}, ${a[1]} \\right\\rangle`;
    case "norm2":
      return `\\left\\|${a[0]}\\right\\|^{2}`;
    case "frob":
      return `\\left\\|${a[0]}\\right\\|_{F}^{2}`;
    case "vec":
      return `\\operatorname{vec}\\left(${a[0]}\\right)`;
    case "diag":
      return `\\operatorname{diag}\\left(${a[0]}\\right)`;
    case "abs":
      return `\\left|${a[0]}\\right|`;
    case "sqrtm":
      return `\\sqrt{${a[0]}}`;
  }
}
function operand(node) {
  if (!node) return "";
  const text = renderNode(node);
  if (node.k === "op" && (node.op === "add" || node.op === "sub" || node.op === "neg")) {
    return `\\left(${text}\\right)`;
  }
  if (node.k === "op" && node.op === "mul") return `{${text}}`;
  return text;
}
function base(node) {
  if (!node) return "";
  const text = renderNode(node);
  if (node.k === "op" && ["add", "sub", "neg", "mul", "kron", "had"].includes(node.op)) {
    return `\\left(${text}\\right)`;
  }
  return `{${text}}`;
}

// src/core/numpy.ts
var ACCENTS2 = /* @__PURE__ */ new Set([
  "bar",
  "hat",
  "overline",
  "tilde",
  "widetilde",
  "check",
  "dot",
  "ddot",
  "vec",
  "mathbf",
  "boldsymbol",
  "bm",
  "mathcal",
  "mathrm",
  "mathsf",
  "mathtt"
]);
function sanitizeName(name) {
  const accents = [];
  let rest = name;
  while (rest.startsWith("\\")) {
    const command = rest.slice(1).match(/^[A-Za-z]+/)?.[0] ?? "";
    if (!command || !ACCENTS2.has(command)) break;
    accents.push(command);
    rest = rest.slice(1 + command.length);
  }
  const cut = rest.search(/[_^]/);
  const base2 = (cut < 0 ? rest : rest.slice(0, cut)).replace(/[^A-Za-z0-9]/g, "") || "x";
  const suffix = cut < 0 ? "" : rest.slice(cut);
  return accents.length ? `${base2}_${accents.join("_")}${suffix}` : `${base2}${suffix}`;
}
function numpyNames(symbols) {
  const map = /* @__PURE__ */ new Map();
  const order = [];
  const used = /* @__PURE__ */ new Set();
  for (const symbol of symbols) {
    let name = sanitizeName(symbol);
    let n = 2;
    while (used.has(name)) name = `${sanitizeName(symbol)}_${n++}`;
    used.add(name);
    map.set(symbol, name);
    order.push(symbol);
  }
  return { map, order };
}
function isMatrixType(ctx, node) {
  if (node.k === "sym") {
    const info = ctx.symbols.get(node.name);
    return info?.ty.t === "mat";
  }
  if (node.k === "num") return false;
  if (node.k === "op") {
    switch (node.op) {
      case "add":
      case "sub":
      case "mul":
      case "T":
      case "inv":
      case "invT":
        return isMatrixType(ctx, node.args[0]);
      default:
        return false;
    }
  }
  if (node.k === "call") {
    if (node.fn === "det" || node.fn === "tr") return false;
    return isMatrixType(ctx, node.args[0]);
  }
  return false;
}
function numpyExpression(node, ctx, names) {
  switch (node.k) {
    case "num": {
      const v = node.value;
      if (v.d === 1) return `Fraction(${v.n})`;
      return `Fraction(${v.n}, ${v.d})`;
    }
    case "sym": {
      const name = names.map.get(node.name);
      return name ?? `Fraction(0)`;
    }
    case "op": {
      const args = node.args.map((a) => numpyExpression(a, ctx, names));
      switch (node.op) {
        case "add":
          return `(${args[0]} + ${args[1]})`;
        case "sub":
          return `(${args[0]} - ${args[1]})`;
        case "neg":
          return `(-${args[0]})`;
        case "mul": {
          const bothMatrices = node.args.every((a) => isMatrixType(ctx, a));
          return bothMatrices ? `(${args[0]} @ ${args[1]})` : `(${args[0]} * ${args[1]})`;
        }
        case "div":
          return `(${args[0]} / ${args[1]})`;
        case "inv":
          return `_inv(${args[0]})`;
        case "invT":
          return `_inv(${args[0]}).T`;
        case "T":
          return `(${args[0]}).T`;
        case "pow":
          return `(${args[0]}) ** ${args[1]}`;
        case "tr":
          return `_tr(${args[0]})`;
        case "det":
          return `_det(${args[0]})`;
        case "frob":
          return `_frob(${args[0]})`;
        case "norm2":
          return `(${args[0]}) * (${args[0]})`;
        case "inner":
          return `_inner(${args[0]}, ${args[1]})`;
        case "diag":
          return `_diag(${args[0]})`;
        case "abs":
          return `_abs(${args[0]})`;
        case "sqrtm":
          return `_sqrtm(${args[0]})`;
        default:
          return `Fraction(0)`;
      }
    }
    case "call": {
      const args = node.args.map((a) => numpyExpression(a, ctx, names));
      if (node.fn === "tr") return `_tr(${args[0]})`;
      if (node.fn === "det") return `_det(${args[0]})`;
      if (node.fn === "frob") return `_frob(${args[0]})`;
      if (node.fn === "norm2") return `(${args[0]}) * (${args[0]})`;
      if (node.fn === "sqrtm") return `_sqrtm(${args[0]})`;
      if (node.fn === "exp") return `(_exp(${args[0]}))`;
      return `Fraction(0)`;
    }
    default:
      return `Fraction(0)`;
  }
}
function symbolsOf(node, into = /* @__PURE__ */ new Set()) {
  if (!node) return into;
  switch (node.k) {
    case "sym":
      into.add(node.name);
      return into;
    case "op":
    case "call":
      for (const arg of node.args) symbolsOf(arg, into);
      return into;
    case "deriv":
      symbolsOf(node.f, into);
      for (const w of node.wrt) symbolsOf(w, into);
      return into;
    case "expect":
      for (const arg of node.args) symbolsOf(arg, into);
      return into;
    case "bigop":
      symbolsOf(node.body, into);
      return into;
    case "block":
      for (const row of node.rows) for (const cell of row) symbolsOf(cell, into);
      return into;
    default:
      return into;
  }
}
var NUMPY_PRELUDE = `from fractions import Fraction
import numpy as np


def _inv(a):
    n = len(a)
    m = [list(a[i]) + [Fraction(int(i == j)) for j in range(n)] for i in range(n)]
    for c in range(n):
        p = next((r for r in range(c, n) if m[r][c] != 0), None)
        if p is None:
            raise ZeroDivisionError("the matrix is singular")
        m[c], m[p] = m[p], m[c]
        d = m[c][c]
        m[c] = [x / d for x in m[c]]
        for r in range(n):
            if r != c and m[r][c] != 0:
                f = m[r][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return np.array([row[n:] for row in m], dtype=object)


def _tr(a):
    return sum((a[i][i] for i in range(len(a))), Fraction(0))


def _det(a):
    n = len(a)
    if n == 1:
        return a[0][0]
    if n == 2:
        return a[0][0] * a[1][1] - a[0][1] * a[1][0]
    total = Fraction(0)
    for j in range(n):
        minor = np.array([[a[i][k] for k in range(n) if k != j] for i in range(1, n)], dtype=object)
        sign = 1 if j % 2 == 0 else -1
        total += sign * a[0][j] * _det(minor)
    return total


def _frob(a):
    return sum((x * x for row in a for x in row), Fraction(0))


def _inner(a, b):
    return sum((x * y for ra, rb in zip(a, b) for x, y in zip(ra, rb)), Fraction(0))


def _diag(a):
    n = len(a)
    return np.array([[a[i][i] if i == j else Fraction(0) for j in range(n)] for i in range(n)], dtype=object)


def _abs(a):
    return abs(a)


def _sqrtm(a):
    return _inv(a) if len(a) == 1 else a


def _exp(a):
    return Fraction(0)
`;

// src/core/shrink.ts
function shrinkCounterexample(ctx, lhs, rhs, defs, sizes, seed, budgetMs = 200) {
  const started = Date.now();
  const names = [...ctx.symbols.keys()].filter((name) => {
    const info = ctx.symbols.get(name);
    return info && !defs.has(name) && (info.ty.t === "mat" || info.ty.t === "scalar");
  });
  const shrinkCtx = {
    ctx,
    lhs,
    rhs,
    defs,
    symbolNames: names,
    derivedNames: [...defs.keys()],
    sizes,
    propOf: (name) => ctx.symbols.get(name)?.props ?? []
  };
  for (const range of [2, 5]) {
    const candidate = searchSmallIntegers(shrinkCtx, range, seed);
    if (candidate) return candidate;
    if (Date.now() - started > budgetMs) break;
  }
  const field = new GFpField(2147483647);
  const sampler = new Sampler(field, rngFor(seed, "shrink"));
  const env = makeEnv(field, rngFor(seed, "shrink"));
  env.defs = defs;
  const values = /* @__PURE__ */ new Map();
  const scalarRng = rngFor(seed, "scalar");
  for (const name of names) {
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === "scalar") {
      const n = Math.floor(scalarRng() * 5) - 2;
      values.set(name, { k: "s", v: field.fromRational(n, 1) });
      continue;
    }
    if (info.ty.t !== "mat") continue;
    const r = dimSizeOf(ctx, info.ty.r, sizes);
    const c = dimSizeOf(ctx, info.ty.c, sizes);
    const val = sampler.sample({ name, r, c, props: info.props, variety: 0 });
    if (val && val.k === "m") values.set(name, val);
  }
  for (const [name, value] of values.entries()) env.values.set(name, value);
  try {
    const l = evalNode(field, lhs, env);
    const r = evalNode(field, rhs, env);
    if (!equal(field, l, r)) {
      return describe(ctx, sizes, values, derivedValues(field, env, defs), (name) => ctx.symbols.get(name)?.props ?? [], lhs, rhs, defs, l, r, field, true);
    }
  } catch {
  }
  return null;
}
function derivedValues(field, env, defs) {
  const out = /* @__PURE__ */ new Map();
  for (const [name, node] of defs) {
    try {
      out.set(name, evalNode(field, node, env));
    } catch {
    }
  }
  return out;
}
function searchSmallIntegers(sh, range, seed) {
  const field = new DecField(50);
  const rng = rngFor(seed, "small", range);
  const { ctx, sizes } = sh;
  for (let attempt = 0; attempt < 40; attempt++) {
    const values = /* @__PURE__ */ new Map();
    for (const name of sh.symbolNames) {
      const info = ctx.symbols.get(name);
      if (!info) continue;
      if (info.ty.t === "scalar") {
        const n = Math.floor(rng() * (2 * range + 1)) - range;
        values.set(name, { k: "s", v: field.fromRational(n, 1) });
        continue;
      }
      if (info.ty.t !== "mat") continue;
      const r = dimSizeOf(ctx, info.ty.r, sizes);
      const c = dimSizeOf(ctx, info.ty.c, sizes);
      const props = sh.propOf(name);
      const m = smallMatrix(field, r, c, props, rng, range);
      if (!m) continue;
      values.set(name, { k: "m", m });
    }
    if (!values.size) continue;
    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    for (const [name, value] of values.entries()) env.values.set(name, value);
    try {
      const l = evalNode(field, sh.lhs, env);
      const r = evalNode(field, sh.rhs, env);
      if (equal(field, l, r)) continue;
      return describe(ctx, sizes, values, derivedValues(field, env, sh.defs), sh.propOf, sh.lhs, sh.rhs, sh.defs, l, r, field, false);
    } catch {
      continue;
    }
  }
  return null;
}
function smallMatrix(field, r, c, props, rng, range) {
  const has = (p) => props.some((x2) => x2 === p);
  const entry = () => Math.floor(rng() * (2 * range + 1)) - range;
  if ((has("spd") || has("psd")) && r === c) {
    const l = new Array(r * r).fill(0);
    for (let i2 = 0; i2 < r; i2++) {
      for (let j = 0; j <= i2; j++) l[i2 * r + j] = entry();
    }
    const d2 = new Array(r * c).fill(0);
    for (let i2 = 0; i2 < r; i2++) {
      for (let j = 0; j < r; j++) {
        let sum2 = 0;
        for (let k = 0; k < r; k++) sum2 += l[i2 * r + k] * l[j * r + k];
        d2[i2 * c + j] = sum2 + (i2 === j ? 1 : 0);
      }
    }
    return { r, c, d: d2.map((x2) => field.fromRational(x2, 1)) };
  }
  const d = new Array(r * c).fill(0);
  for (let i2 = 0; i2 < r; i2++) {
    for (let j = 0; j < c; j++) {
      if (has("sym") || has("psd")) {
        d[i2 * c + j] = i2 <= j ? d[j * c + i2] || entry() : d[j * c + i2];
        if (i2 > j) d[i2 * c + j] = d[j * c + i2];
      } else if (has("skew")) {
        d[i2 * c + j] = i2 === j ? 0 : i2 < j ? entry() : -d[j * c + i2];
      } else if (has("diag")) {
        d[i2 * c + j] = i2 === j ? entry() : 0;
      } else if (has("ident")) {
        d[i2 * c + j] = i2 === j ? 1 : 0;
      } else if (has("zero")) {
        d[i2 * c + j] = 0;
      } else if (has("ones")) {
        d[i2 * c + j] = 1;
      } else {
        d[i2 * c + j] = entry();
      }
    }
  }
  const m = { r, c, d: d.map((x2) => field.fromRational(x2, 1)) };
  if (r === c && (has("orth") || has("idem") || has("proj"))) return null;
  return m;
}
function equal(field, a, b) {
  if (a.k === "s" && b.k === "s") return field.eq(a.v, b.v);
  if (a.k === "m" && b.k === "m") {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return false;
    for (let i2 = 0; i2 < a.m.d.length; i2++) if (!field.eq(a.m.d[i2], b.m.d[i2])) return false;
    return true;
  }
  return false;
}
function describe(ctx, sizes, values, derived, propOf, lhsNode, rhsNode, defs, lhs, rhs, field, residue) {
  const dims = {};
  for (const [root, size] of sizes) {
    const declared = ctx.dimVars.find((d) => ctx.dims.find(d) === root);
    if (declared) dims[declared] = size;
    else if (!root.startsWith("#")) dims[root] = size;
  }
  const signed = (x2) => {
    if (!residue) return x2;
    const p = 2147483647;
    return x2 > p / 2 ? x2 - p : x2;
  };
  const plain = {};
  for (const [name, val] of values) {
    if (propOf(name).includes("ident")) continue;
    plain[name] = val.k === "s" ? signed(field.toNumber(val.v)) : val.m.d.map((x2) => signed(field.toNumber(x2)));
  }
  const derivedPlain = {};
  for (const [name, val] of derived) {
    derivedPlain[name] = val.k === "s" ? signed(field.toNumber(val.v)) : val.m.d.map((x2) => signed(field.toNumber(x2)));
  }
  const lhsPlain = lhs.k === "s" ? signed(field.toNumber(lhs.v)) : lhs.m.d.map((x2) => signed(field.toNumber(x2)));
  const rhsPlain = rhs.k === "s" ? signed(field.toNumber(rhs.v)) : rhs.m.d.map((x2) => signed(field.toNumber(x2)));
  const diffPlain = lhs.k === "s" && rhs.k === "s" ? signed(field.toNumber(lhs.v) - field.toNumber(rhs.v)) : lhs.k === "m" && rhs.k === "m" ? lhs.m.d.map((x2, i2) => signed(field.toNumber(x2) - field.toNumber(rhs.m.d[i2]))) : 0;
  const shapes = {};
  for (const name of Object.keys(plain)) shapes[name] = shapeOf(ctx, name, sizes);
  for (const name of Object.keys(derivedPlain)) shapes[name] = shapeOf(ctx, name, sizes);
  const valueShape = (val) => val.k === "s" ? [1, 1] : [val.m.r, val.m.c];
  return {
    dims,
    values: plain,
    derived: derivedPlain,
    lhs: lhsPlain,
    rhs: rhsPlain,
    diff: diffPlain,
    shapes,
    lhsShape: valueShape(lhs),
    rhsShape: valueShape(rhs),
    diffShape: lhs.k === "m" && rhs.k === "m" ? [lhs.m.r, lhs.m.c] : [1, 1],
    numpy: toNumpy(ctx, sizes, lhsNode, rhsNode, defs, plain)
  };
}
function toNumpy(ctx, sizes, lhsNode, rhsNode, defs, values) {
  const symbols = /* @__PURE__ */ new Set();
  for (const name of symbolsOf(lhsNode)) symbols.add(name);
  for (const name of symbolsOf(rhsNode)) symbols.add(name);
  for (const name of defs.keys()) symbols.add(name);
  for (const node of defs.values()) {
    for (const name of symbolsOf(node)) symbols.add(name);
  }
  const names = numpyNames([...symbols]);
  const lines = [NUMPY_PRELUDE, ""];
  lines.push("# the values that break the step");
  for (const symbol of names.order) {
    if (defs.has(symbol)) continue;
    const value = values[symbol];
    if (value === void 0) {
      const info = ctx.symbols.get(symbol);
      if (info && info.props.includes("ident")) {
        const size = info.ty.t === "mat" ? dimSizeOf(ctx, info.ty.r, sizes) : 1;
        lines.push(`${names.map.get(symbol)} = np.eye(${size}, dtype=object)`);
      }
      continue;
    }
    const shape = shapeOf(ctx, symbol, sizes);
    lines.push(`${names.map.get(symbol)} = ${literal(value, shape)}`);
  }
  const defined = [...defs.keys()].filter((name) => names.map.has(name));
  if (defined.length) {
    lines.push("");
    lines.push("# the symbols the derivation defines, computed from the values above");
    for (const name of defined) {
      const node = defs.get(name);
      if (!node) continue;
      lines.push(`${names.map.get(name)} = ${numpyExpression(node, ctx, names)}`);
    }
  }
  lines.push("");
  lines.push("# the two sides of the step, with these values");
  lines.push(`lhs = ${numpyExpression(lhsNode, ctx, names)}`);
  lines.push(`rhs = ${numpyExpression(rhsNode, ctx, names)}`);
  lines.push("print(lhs - rhs)");
  lines.push("");
  lines.push("# the values above are the ones SAMOSA found; the two sides differ with them");
  return lines.join("\n");
}
function shapeOf(ctx, symbol, sizes) {
  const info = ctx.symbols.get(symbol);
  if (!info || info.ty.t !== "mat") return [1, 1];
  const r = dimSizeOf(ctx, info.ty.r, sizes);
  const c = dimSizeOf(ctx, info.ty.c, sizes);
  return [r, c];
}
function literal(value, shape) {
  if (typeof value === "number") return `Fraction('${value}')`;
  const [rows, cols] = shape;
  const out = [];
  for (let i2 = 0; i2 < rows; i2++) {
    const row = value.slice(i2 * cols, (i2 + 1) * cols).map((x2) => `Fraction('${x2}')`);
    out.push(`[${row.join(", ")}]`);
  }
  return `np.array([${out.join(", ")}], dtype=object)`;
}

// src/core/repair.ts
var CANDIDATE_LIMIT = 300;
var BUDGET_MS = 150;
function repairs(ctx, lhs, rhs, defs, seed, dimVars, kind) {
  const started = Date.now();
  const sh = { ctx, lhs, rhs, defs, seed, dimVars };
  const out = [];
  const shape = kind === "shape" ? shapeRepairs(sh) : [];
  out.push(...shape);
  if (Date.now() - started > BUDGET_MS) return out;
  out.push(...mutationRepairs(sh));
  if (Date.now() - started > BUDGET_MS) return out;
  out.push(...assumptionRepairs(sh));
  if (Date.now() - started > BUDGET_MS) return out;
  out.push(...residualRepairs(sh));
  const deduped = [];
  const seen = /* @__PURE__ */ new Set();
  for (const fix of out) {
    const key = `${fix.edit?.insert ?? ""}|${fix.addDecl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(fix);
  }
  deduped.sort(
    (a, b) => priority(a) - priority(b) || // a fix of the right hand side is a fix of the derivation, so it comes
    // before a fix of the claim
    (a.side ?? "rhs").localeCompare(b.side ?? "rhs") || editSize(a) - editSize(b)
  );
  return deduped.slice(0, 3);
}
function priority(fix) {
  switch (fix.kind) {
    case "mutation":
      return 0;
    case "residual":
      return 1;
    case "shape":
      return 2;
    case "assumption":
      return 3;
    default:
      return 4;
  }
}
var MUTATIONS = [
  {
    id: "T1",
    title: "the transpose of a product keeps the order",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "T") return null;
      const arg = node.args[0];
      if (arg.k !== "op" || arg.op !== "mul") return null;
      return { ...node, args: [{ ...arg, args: [arg.args[1], arg.args[0]] }] };
    }
  },
  {
    id: "T2",
    title: "the inverse of a product keeps the order",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "inv") return null;
      const arg = node.args[0];
      if (arg.k !== "op" || arg.op !== "mul") return null;
      return {
        ...node,
        args: [
          {
            ...arg,
            args: [
              { k: "op", op: "inv", args: [arg.args[1]], span: arg.args[1].span },
              { k: "op", op: "inv", args: [arg.args[0]], span: arg.args[0].span }
            ]
          }
        ]
      };
    }
  },
  {
    id: "T3",
    title: "a transpose is missing",
    apply: (node) => {
      if (node.k !== "sym") return null;
      return { k: "op", op: "T", args: [node], span: node.span };
    }
  },
  {
    id: "T3r",
    title: "a transpose is not needed",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "T") return null;
      return node.args[0];
    }
  },
  {
    id: "A4",
    title: "an inverse where there should be none, or the other way round",
    apply: (node) => {
      if (node.k === "op" && node.op === "inv") return node.args[0];
      if (node.k === "op" && (node.op === "mul" || node.op === "add" || node.op === "sub")) {
        for (const arg of node.args) {
          if (arg.k === "op" && arg.op === "inv" && !isInvertedTwice(arg)) {
            return { ...node, args: node.args.map((a) => a === arg ? a.args[0] : a) };
          }
        }
      }
      return null;
    }
  },
  {
    id: "A1",
    title: "a sign is flipped",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "add") return null;
      const second = node.args[1];
      if (second.k !== "op" || second.op !== "neg") return null;
      return { ...node, op: "sub", args: [node.args[0], second.args[0]] };
    }
  },
  {
    id: "A2",
    title: "a factor of two",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "mul") return null;
      const a = node.args[0];
      const b = node.args[1];
      if (a.k === "num" && a.value.n === 2) return { ...node, args: [a, b] };
      if (b.k === "num" && b.value.n === 2) return { ...node, args: [a, b] };
      if (a.k === "num" && a.value.n === 1) {
        return {
          ...node,
          args: [
            { k: "num", value: { n: 2, d: 1 }, span: a.span },
            b
          ]
        };
      }
      return null;
    }
  },
  {
    id: "C1",
    title: "two factors are swapped",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "mul") return null;
      return { ...node, args: [node.args[1], node.args[0]] };
    }
  },
  {
    id: "S1",
    title: "the inverse of a sum is split",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "inv") return null;
      const arg = node.args[0];
      if (arg.k !== "op" || arg.op !== "add") return null;
      return {
        ...node,
        args: [
          {
            k: "op",
            op: "add",
            args: [
              { k: "op", op: "inv", args: [arg.args[0]], span: arg.args[0].span },
              { k: "op", op: "inv", args: [arg.args[1]], span: arg.args[1].span }
            ],
            span: arg.span
          }
        ]
      };
    }
  },
  {
    id: "N2",
    title: "the Frobenius norm uses the wrong trace",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "frob") return null;
      const arg = node.args[0];
      if (arg.k !== "op" || arg.op !== "T") return null;
      return { ...node, op: "norm2", args: [arg.args[0]] };
    }
  },
  {
    id: "G1",
    title: "the gradient of a quadratic form assumes symmetry",
    apply: (node) => {
      if (node.k !== "op" || node.op !== "mul") return null;
      return null;
    }
  }
];
function pretty(latex) {
  return latex.replace(/[{}]/g, "");
}
function editSize(fix) {
  if (!fix.edit) return 0;
  return fix.edit.insert.length;
}
function isInvertedTwice(node) {
  return node.args[0]?.k === "op" && node.args[0].op === "inv";
}
function walk(node, path = []) {
  const out = [{ node, path }];
  const children = node.k === "op" || node.k === "call" ? node.args : node.k === "deriv" ? [node.f, ...node.wrt] : node.k === "expect" ? node.args : node.k === "bigop" ? [node.body] : node.k === "block" ? node.rows.flat() : [];
  children.forEach((child, i2) => out.push(...walk(child, [...path, i2])));
  return out;
}
function replaceAt(node, path, replacement) {
  if (path.length === 0) return replacement;
  const [head, ...rest] = path;
  if (node.k === "op" || node.k === "call") {
    const args = node.args.slice();
    args[head] = replaceAt(args[head], rest, replacement);
    return { ...node, args };
  }
  if (node.k === "block") {
    const rows = node.rows.map((r) => r.slice());
    const flat = rows.flat();
    flat[head] = replaceAt(flat[head], rest, replacement);
    const out = [];
    let i2 = 0;
    for (const row of rows) {
      out.push(flat.slice(i2, i2 + row.length));
      i2 += row.length;
    }
    return { ...node, rows: out };
  }
  return node;
}
function mutationRepairs(sh) {
  const out = [];
  let count = 0;
  for (const side of ["rhs", "lhs"]) {
    const original = side === "rhs" ? sh.rhs : sh.lhs;
    for (const { node, path } of walk(original)) {
      if (count > CANDIDATE_LIMIT) break;
      for (const mutation of MUTATIONS) {
        if (count > CANDIDATE_LIMIT) break;
        const mutated = mutation.apply(node);
        if (!mutated) continue;
        count++;
        const candidate = replaceAt(original, path, mutated);
        if (renderNode(candidate) === renderNode(original)) continue;
        if (!holdsWith(sh, side, candidate)) continue;
        out.push({
          kind: "mutation",
          title: mutation.title,
          edit: { span: original.span, insert: renderNode(candidate) },
          verified: true,
          detail: renderNode(candidate),
          side: side === "rhs" ? "rhs" : "lhs"
        });
      }
    }
  }
  return out;
}
function holdsWith(sh, side, candidate) {
  const settings = sizeSettings(sh.dimVars);
  const field = new GFpField(2147483647);
  for (const setting of settings.slice(0, 2)) {
    const rng = rngFor(sh.seed, "repair", "mutation");
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) return false;
    for (const [name, value] of values.entries()) if (value) env.values.set(name, value);
    try {
      const sides = compareSides(
        field,
        side === "lhs" ? candidate : sh.lhs,
        side === "rhs" ? candidate : sh.rhs,
        env,
        sampler
      );
      if (sides.kind !== "equal") return false;
    } catch {
      return false;
    }
  }
  return true;
}
function sampleSymbols(ctx, sh, setting, sampler) {
  const values = /* @__PURE__ */ new Map();
  const names = /* @__PURE__ */ new Set();
  const collect = (node) => {
    if (node.k === "sym") names.add(node.name);
    else if (node.k === "op" || node.k === "call") node.args.forEach(collect);
    else if (node.k === "deriv") {
      collect(node.f);
      node.wrt.forEach(collect);
    } else if (node.k === "expect") node.args.forEach(collect);
    else if (node.k === "bigop") collect(node.body);
    else if (node.k === "block") node.rows.flat().forEach(collect);
  };
  collect(sh.lhs);
  collect(sh.rhs);
  for (const name of [...names]) {
    const def = sh.defs.get(name);
    if (def) collect(def);
  }
  for (const name of names) {
    if (sh.defs.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === "scalar") {
      const value = info.props.some((p) => p === "pos") ? sampler.samplePositiveScalar() : sampler.sampleScalar();
      values.set(name, { k: "s", v: value });
      continue;
    }
    if (info.ty.t !== "mat") continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    const val = sampler.sample({ name, r, c, props: info.props, variety: 0 });
    if (!val) return null;
    values.set(name, val);
  }
  return values;
}
var ASSUMPTION_TRIES = [
  { props: ["sym"], text: "symmetric" },
  { props: ["orth"], text: "orthogonal" },
  { props: ["diag"], text: "diagonal" },
  { props: ["pos"], text: "positive", scalar: true }
];
function assumptionRepairs(sh) {
  const out = [];
  const candidates = [...sh.ctx.symbols.values()].filter(
    (s) => s.props.length === 0 && s.source !== "preset" && (s.ty.t === "mat" || s.ty.t === "scalar")
  );
  for (const symbol of candidates) {
    for (const attempt of ASSUMPTION_TRIES) {
      if (!canHave(sh.ctx, symbol.name, attempt.props)) continue;
      if (holdsWithProps(sh, symbol.name, attempt.props)) {
        const decl = attempt.scalar ? `${symbol.name}: pos` : `${symbol.name}: ${attempt.props[0]} ${dimText(sh.ctx, symbol.name)}`;
        out.push({
          kind: "assumption",
          title: `holds if ${symbol.name} is ${attempt.text}`,
          addDecl: decl,
          verified: true
        });
        return out;
      }
    }
  }
  return out;
}
function canHave(ctx, name, props) {
  const info = ctx.symbols.get(name);
  if (!info) return false;
  if (props.includes("pos")) return info.ty.t === "scalar";
  if (info.ty.t !== "mat") return false;
  const r = info.ty.r;
  const c = info.ty.c;
  const square = typeof r === "number" && typeof c === "number" ? r === c : typeof r !== "number" && typeof c !== "number" && r.v === c.v;
  if (props.includes("sym") || props.includes("orth") || props.includes("rot") || props.includes("diag")) {
    return square;
  }
  return true;
}
function dimText(ctx, name) {
  const info = ctx.symbols.get(name);
  if (!info || info.ty.t !== "mat") return "";
  const r = info.ty.r;
  const c = info.ty.c;
  if (typeof r === "number") return String(r);
  if (typeof c === "number" || c.v !== r.v) {
    return `${r.v}\xD7${typeof c === "number" ? c : c.v}`;
  }
  return r.v;
}
function holdsWithProps(sh, name, props) {
  const saved = sh.ctx.symbols.get(name);
  if (!saved) return false;
  sh.ctx.symbols.set(name, { ...saved, props });
  const ok = holdsWith(sh, "rhs", sh.rhs);
  sh.ctx.symbols.set(name, saved);
  return ok;
}
function shapeRepairs(sh) {
  const out = [];
  const candidates = walk(sh.rhs);
  for (const { node, path } of candidates.slice(0, 40)) {
    if (node.k === "sym") {
      const flipped = { k: "op", op: "T", args: [node], span: node.span };
      const candidate = replaceAt(sh.rhs, path, flipped);
      if (typeChecks(sh, candidate)) {
        out.push({
          kind: "shape",
          title: `did you mean ${renderNode(flipped)}?`,
          edit: { span: sh.rhs.span, insert: renderNode(candidate) },
          verified: false
        });
        if (out.length >= 3) return out;
      }
    }
  }
  return out;
}
function typeChecks(sh, rhs) {
  const settings = sizeSettings(sh.dimVars);
  const field = new GFpField(2147483647);
  for (const setting of settings.slice(0, 1)) {
    const rng = rngFor(sh.seed, "repair", "shape");
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) continue;
    for (const [n, value] of values.entries()) if (value) env.values.set(n, value);
    try {
      evalNode(field, rhs, env);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
function residualRepairs(sh) {
  const out = [];
  const settings = sizeSettings(sh.dimVars);
  const field = new GFpField(2147483647);
  const samples = [];
  for (const setting of settings.slice(0, 2)) {
    const rng = rngFor(sh.seed, "repair", "residual");
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) return out;
    for (const [name, value] of values.entries()) if (value) env.values.set(name, value);
    try {
      const l = evalNode(field, sh.lhs, env);
      const r = evalNode(field, sh.rhs, env);
      if (l.k !== "m" || r.k !== "m") return out;
      const d = l.m.d.map((x2, i2) => field.sub(x2, r.m.d[i2]));
      samples.push({ env, diff: d });
    } catch {
      return out;
    }
  }
  if (samples.length < 2) return out;
  const terms = candidateTerms(sh);
  for (const [text, term] of terms) {
    const scale = matchesScale(field, term, samples);
    if (scale === null || scale === 0) continue;
    const patched = {
      k: "op",
      op: "add",
      args: [sh.rhs, term],
      span: sh.rhs.span
    };
    if (renderNode(patched) === renderNode(sh.rhs)) continue;
    const verified = holdsWith(sh, "rhs", patched);
    out.push({
      kind: "residual",
      title: `this step is off by exactly ${scaleText(scale)} ${pretty(text)}`,
      edit: { span: sh.rhs.span, insert: `${renderNode(sh.rhs)} ${scaleText(scale)} ${text}` },
      verified,
      detail: text,
      side: "rhs"
    });
    if (out.length >= 3) break;
  }
  return out;
}
function candidateTerms(sh) {
  const terms = /* @__PURE__ */ new Map();
  const symbols = [];
  const seen = /* @__PURE__ */ new Set();
  const collect = (node) => {
    if (node.k !== "sym") return;
    if (seen.has(node.name)) return;
    seen.add(node.name);
    symbols.push(node);
  };
  for (const { node } of walk(sh.lhs).concat(walk(sh.rhs))) collect(node);
  for (const name of [...seen]) {
    const def = sh.defs.get(name);
    if (!def) continue;
    for (const { node } of walk(def)) collect(node);
  }
  const add2 = (node) => {
    const text = renderNode(node);
    if (!terms.has(text)) terms.set(text, node);
  };
  for (const x2 of symbols) {
    const xt = { k: "op", op: "T", args: [x2], span: x2.span };
    add2({
      k: "op",
      op: "mul",
      args: [x2, xt],
      span: x2.span
    });
  }
  for (const x2 of symbols) {
    for (const y of symbols) {
      if (x2 === y) continue;
      const xt = { k: "op", op: "T", args: [x2], span: x2.span };
      add2({
        k: "op",
        op: "mul",
        args: [
          { k: "op", op: "mul", args: [x2, y], span: x2.span },
          xt
        ],
        span: x2.span
      });
    }
  }
  return terms;
}
function matchesScale(field, term, samples) {
  const termValues = [];
  for (const { env, diff } of samples) {
    let value;
    try {
      const t = evalNode(field, term, env);
      if (t.k !== "m") return null;
      value = t.m.d;
    } catch {
      return null;
    }
    if (value.length !== diff.length) return null;
    termValues.push(value);
  }
  const scale = niceScale(field, field.div(samples[0].diff[0], termValues[0][0]));
  if (scale === null) return null;
  for (let s = 0; s < samples.length; s++) {
    for (let i2 = 0; i2 < samples[s].diff.length; i2++) {
      if (field.mul(field.fromRational(scale.n, scale.d), termValues[s][i2]) !== samples[s].diff[i2]) {
        return null;
      }
    }
  }
  return scale.n / scale.d;
}
function niceScale(field, value) {
  for (let a = -12; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      if (field.fromRational(a, b) === value) return { n: a, d: b };
    }
  }
  return null;
}
function scaleText(scale) {
  if (scale === 1) return "+";
  if (scale === -1) return "-";
  if (Number.isInteger(scale)) return scale > 0 ? `+ ${scale}` : `- ${-scale}`;
  return scale > 0 ? `+ ${scale}` : `- ${-scale}`;
}

// src/core/index.ts
function checkStep2(lhs, rhs, opts = {}) {
  const src = `${lhs} = ${rhs}`;
  const report = check(src, { ...opts, trials: opts.trials ?? 3 });
  const step = report.steps[0];
  if (!step) {
    return {
      id: "s0",
      row: 1,
      span: { from: 0, to: src.length },
      relation: "=",
      verdict: "unchecked",
      card: { trialsPerSize: 0, sizes: [], assumptions: [], seed: opts.seed ?? 0 },
      message: "SAMOSA could not read that step",
      reason: "SAMOSA could not read that step"
    };
  }
  return step;
}
function explain(src, stepId, opts = {}, report) {
  const parsed = analyzeSource(src, opts);
  const step = parsed.steps.find((s) => s.id === stepId);
  if (!step || !step.lhs || !step.rhs) return { fixes: [] };
  const verdict = report?.steps.find((s) => s.id === stepId)?.verdict;
  if (verdict && verdict !== "wrong" && verdict !== "shape") return { fixes: [] };
  return explainStep(parsed, step, opts);
}
function explainAll(src, opts = {}, limit = 8, report) {
  const out = /* @__PURE__ */ new Map();
  const parsed = analyzeSource(src, opts);
  const deadline = Date.now() + (opts.budgetMs ?? 4e3);
  let count = 0;
  for (const step of parsed.steps) {
    if (count >= limit) break;
    if (Date.now() > deadline) break;
    if (!step.lhs || !step.rhs) continue;
    if (step.relation !== "=") continue;
    const verdict = report?.steps.find((s) => s.id === step.id)?.verdict;
    if (verdict && verdict !== "wrong" && verdict !== "shape") continue;
    out.set(step.id, explainStep(parsed, step, opts));
    count++;
  }
  return out;
}
function explainStep(source, step, opts) {
  const { ctx, defs } = source;
  if (!step.lhs || !step.rhs) return { fixes: [] };
  inferType(ctx, step.lhs);
  inferType(ctx, step.rhs);
  const dimVars = collectDimVarsFor(ctx, step.lhs, step.rhs, defs);
  const kind = step.relation === "=" ? "wrong" : "shape";
  const fixes = repairs(ctx, step.lhs, step.rhs, defs, opts.seed ?? 5910618, dimVars, kind);
  let counterexample;
  const deadline = Date.now() + 600;
  for (const size of [1, 2, 3]) {
    const sizes = /* @__PURE__ */ new Map();
    for (const v of dimVars) sizes.set(ctx.dims.find(v), size);
    const left = Math.max(50, deadline - Date.now());
    try {
      counterexample = shrinkCounterexample(ctx, step.lhs, step.rhs, defs, sizes, opts.seed ?? 5910618, left) ?? void 0;
    } catch {
      counterexample = void 0;
    }
    if (counterexample) break;
    if (Date.now() > deadline) break;
  }
  return { fixes, counterexample };
}

// node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i2 = 0; i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1; i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln2(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (; i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln2 = function(n, l, d) {
  return n.s == -1 ? Math.max(ln2(n.l, l, d + 1), ln2(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i2 = 1; i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i2 = 0; i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0; i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0; i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0; i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0; i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0; i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0; i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0; i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i2 = 0; i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}

// src/core/share.ts
var SHARE_VERSION = "v1";
function encodeShare(payload) {
  const json = JSON.stringify(payload);
  const compressed = deflateSync(strToU8(json), { level: 9 });
  return bytesToBase64Url(compressed);
}
function shareLink(base2, payload) {
  const root = base2.replace(/\/+$/, "");
  return `${root}/app/#${SHARE_VERSION}.${encodeShare(payload)}`;
}
var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function bytesToBase64Url(bytes) {
  let out = "";
  for (let i2 = 0; i2 < bytes.length; i2 += 3) {
    const a = bytes[i2];
    const b = bytes[i2 + 1];
    const c = bytes[i2 + 2];
    out += ALPHABET[a >> 2];
    out += ALPHABET[(a & 3) << 4 | (b === void 0 ? 0 : b >> 4)];
    out += b === void 0 ? "" : ALPHABET[(b & 15) << 2 | (c === void 0 ? 0 : c >> 6)];
    out += c === void 0 ? "" : ALPHABET[c & 63];
  }
  return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// mcp/server.ts
var VERSION = "1.0.1";
var server = new McpServer({ name: "samosa", version: VERSION });
var stepSchema = z.object({
  row: z.number(),
  verdict: z.string(),
  mode: z.string().nullable(),
  message: z.string(),
  relation: z.string(),
  card: z.object({
    trialsPerSize: z.number(),
    sizes: z.array(z.record(z.string(), z.number())),
    primes: z.array(z.number()).optional(),
    degree: z.number().optional(),
    bound: z.number().optional(),
    assumptions: z.array(z.string()),
    seed: z.number()
  })
}).passthrough();
var reportSchema = z.object({
  summary: z.string(),
  steps: z.array(stepSchema),
  shareUrl: z.string().optional()
}).passthrough();
function summarise(report) {
  const counts = { ok: 0, wrong: 0, shape: 0, unchecked: 0, defined: 0, inconclusive: 0 };
  for (const step of report.steps) counts[step.verdict] += 1;
  const parts = [];
  if (counts.ok) parts.push(`${counts.ok} hold`);
  if (counts.wrong) parts.push(`${counts.wrong} wrong`);
  if (counts.shape) parts.push(`${counts.shape} shape error`);
  if (counts.inconclusive) parts.push(`${counts.inconclusive} inconclusive`);
  if (counts.unchecked) parts.push(`${counts.unchecked} not checked`);
  if (counts.defined) parts.push(`${counts.defined} defined`);
  return `${report.steps.length} rows: ${parts.join(", ")}`;
}
var shareBase = process.env.SAMOSA_SHARE_BASE ?? "https://samosa-math.vercel.app";
function shareUrl(source, declarations) {
  return shareLink(shareBase, { src: source, decls: declarations });
}
server.registerTool(
  "check_derivation",
  {
    title: "Check a derivation step by step",
    description: "Checks every step of a LaTeX derivation (matrix algebra, gradients, Gaussian expectations) by exact finite field or 50 digit evaluation. Returns the verdict of every row, the counterexamples, the fixes and a share link. No AI is involved in the verdict.",
    inputSchema: {
      latex: z.string().describe("the derivation, as a LaTeX align block or as plain rows"),
      declarations: z.string().optional().describe("the declarations, in the compact syntax"),
      preset: z.string().optional().describe("one of the presets"),
      seed: z.number().int().optional()
    },
    outputSchema: reportSchema
  },
  async (args) => {
    const report = check(args.latex, {
      decls: args.declarations,
      preset: args.preset,
      seed: args.seed
    });
    const explanations = explainAll(
      args.latex,
      { decls: args.declarations, preset: args.preset, seed: args.seed },
      8,
      report
    );
    const structured = {
      summary: summarise(report),
      steps: report.steps.map((step) => {
        const explanation = explanations.get(step.id);
        return {
          row: step.row,
          verdict: step.verdict,
          mode: step.mode ?? null,
          message: step.message,
          relation: step.relation,
          card: step.card,
          fixes: explanation?.fixes ?? [],
          counterexample: explanation?.counterexample ?? null
        };
      }),
      shareUrl: shareUrl(args.latex, args.declarations)
    };
    return {
      content: [{ type: "text", text: summarise(report) }],
      structuredContent: structured
    };
  }
);
server.registerTool(
  "check_step",
  {
    title: "Check one step",
    description: 'Checks a single equation, for instance "A^T A x = A^T b". Returns the verdict, the guarantee and the fixes.',
    inputSchema: {
      lhs: z.string(),
      rhs: z.string(),
      relation: z.string().optional().describe("the relation, = by default"),
      declarations: z.string().optional()
    },
    outputSchema: reportSchema
  },
  async (args) => {
    const step = checkStep2(args.lhs, args.rhs, { decls: args.declarations });
    const source = `${args.lhs} = ${args.rhs}`;
    const explanation = explain(source, "s0", { decls: args.declarations });
    const structured = {
      summary: `${step.verdict}: ${step.message}`,
      steps: [
        {
          row: step.row,
          verdict: step.verdict,
          mode: step.mode ?? null,
          message: step.message,
          relation: step.relation,
          card: step.card,
          fixes: explanation.fixes,
          counterexample: explanation.counterexample ?? null
        }
      ],
      shareUrl: shareUrl(source, args.declarations)
    };
    return {
      content: [{ type: "text", text: `${step.verdict}: ${step.message}` }],
      structuredContent: structured
    };
  }
);
server.registerTool(
  "find_counterexample",
  {
    title: "Find a counterexample",
    description: "Searches for small values that break an equation, and returns them with a NumPy snippet that reproduces them.",
    inputSchema: {
      lhs: z.string(),
      rhs: z.string(),
      declarations: z.string().optional()
    },
    outputSchema: reportSchema
  },
  async (args) => {
    const source = `${args.lhs} = ${args.rhs}`;
    const explanation = explain(source, "s0", { decls: args.declarations });
    const text = explanation.counterexample ? explanation.counterexample.numpy : "no counterexample was found";
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        summary: text,
        steps: [],
        fixes: explanation.fixes
      }
    };
  }
);
var serverTransport = new StdioServerTransport();
await server.connect(serverTransport);
