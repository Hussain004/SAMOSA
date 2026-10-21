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
  var x = new this.constructor(this);
  if (x.s < 0) x.s = 1;
  return finalise(x);
};
P.ceil = function() {
  return finalise(new this.constructor(this), this.e + 1, 2);
};
P.clampedTo = P.clamp = function(min2, max2) {
  var k, x = this, Ctor = x.constructor;
  min2 = new Ctor(min2);
  max2 = new Ctor(max2);
  if (!min2.s || !max2.s) return new Ctor(NaN);
  if (min2.gt(max2)) throw Error(invalidArgument + max2);
  k = x.cmp(min2);
  return k < 0 ? min2 : x.cmp(max2) > 0 ? max2 : new Ctor(x);
};
P.comparedTo = P.cmp = function(y) {
  var i, j, xdL, ydL, x = this, xd = x.d, yd = (y = new x.constructor(y)).d, xs = x.s, ys = y.s;
  if (!xd || !yd) {
    return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
  }
  if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
  if (xs !== ys) return xs;
  if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;
  xdL = xd.length;
  ydL = yd.length;
  for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
    if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
  }
  return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
};
P.cosine = P.cos = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.d) return new Ctor(NaN);
  if (!x.d[0]) return new Ctor(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = cosine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
};
P.cubeRoot = P.cbrt = function() {
  var e, m, n, r, rep, s, sd, t, t3, t3plusx, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  external = false;
  s = x.s * mathpow(x.s * x, 1 / 3);
  if (!s || Math.abs(s) == 1 / 0) {
    n = digitsToString(x.d);
    e = x.e;
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
    r.s = x.s;
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    t3 = t.times(t).times(t);
    t3plusx = t3.plus(x);
    r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).times(r).eq(x);
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
  var x = this, Ctor = x.constructor;
  return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
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
  var k, n, pr, rm, len, x = this, Ctor = x.constructor, one = new Ctor(1);
  if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
  if (x.isZero()) return one;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    n = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    n = "2.3283064365386962890625e-10";
  }
  x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);
  var cosh2_x, i = k, d8 = new Ctor(8);
  for (; i--; ) {
    cosh2_x = x.times(x);
    x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
  }
  return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.hyperbolicSine = P.sinh = function() {
  var k, pr, rm, len, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 3) {
    x = taylorSeries(Ctor, 2, x, x, true);
  } else {
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x = x.times(1 / tinyPow(5, k));
    x = taylorSeries(Ctor, 2, x, x, true);
    var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sinh2_x = x.times(x);
      x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
    }
  }
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(x, pr, rm, true);
};
P.hyperbolicTangent = P.tanh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(x.s);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 7;
  Ctor.rounding = 1;
  return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
};
P.inverseCosine = P.acos = function() {
  var x = this, Ctor = x.constructor, k = x.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
  if (k !== -1) {
    return k === 0 ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
  }
  if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = new Ctor(1).minus(x).div(x.plus(1)).sqrt().atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseHyperbolicCosine = P.acosh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
  if (!x.isFinite()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).minus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicSine = P.asinh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).plus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicTangent = P.atanh = function() {
  var pr, rm, wpr, xsd, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  xsd = x.sd();
  if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);
  Ctor.precision = wpr = xsd - x.e;
  x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);
  Ctor.precision = pr + 4;
  Ctor.rounding = 1;
  x = x.ln();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(0.5);
};
P.inverseSine = P.asin = function() {
  var halfPi, k, pr, rm, x = this, Ctor = x.constructor;
  if (x.isZero()) return new Ctor(x);
  k = x.abs().cmp(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (k !== -1) {
    if (k === 0) {
      halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
      halfPi.s = x.s;
      return halfPi;
    }
    return new Ctor(NaN);
  }
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseTangent = P.atan = function() {
  var i, j, k, n, px, t, r, wpr, x2, x = this, Ctor = x.constructor, pr = Ctor.precision, rm = Ctor.rounding;
  if (!x.isFinite()) {
    if (!x.s) return new Ctor(NaN);
    if (pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.5);
      r.s = x.s;
      return r;
    }
  } else if (x.isZero()) {
    return new Ctor(x);
  } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
    r = getPi(Ctor, pr + 4, rm).times(0.25);
    r.s = x.s;
    return r;
  }
  Ctor.precision = wpr = pr + 10;
  Ctor.rounding = 1;
  k = Math.min(28, wpr / LOG_BASE + 2 | 0);
  for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));
  external = false;
  j = Math.ceil(wpr / LOG_BASE);
  n = 1;
  x2 = x.times(x);
  r = new Ctor(x);
  px = x;
  for (; i !== -1; ) {
    px = px.times(x2);
    t = r.minus(px.div(n += 2));
    px = px.times(x2);
    r = t.plus(px.div(n += 2));
    if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--; ) ;
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
P.logarithm = P.log = function(base) {
  var isBase10, d, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
  if (base == null) {
    base = new Ctor(10);
    isBase10 = true;
  } else {
    base = new Ctor(base);
    d = base.d;
    if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);
    isBase10 = base.eq(10);
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
  denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
  r = divide(num, denominator, sd, 1);
  if (checkRoundingDigits(r.d, k = pr, rm)) {
    do {
      sd += 10;
      num = naturalLogarithm(arg, sd);
      denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
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
  var d, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (x.d) y.s = -y.s;
    else y = new Ctor(y.d || x.s !== y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.plus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (yd[0]) y.s = -y.s;
    else if (xd[0]) y = new Ctor(x);
    else return new Ctor(rm === 3 ? -0 : 0);
    return external ? finalise(y, pr, rm) : y;
  }
  e = mathfloor(y.e / LOG_BASE);
  xe = mathfloor(x.e / LOG_BASE);
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
    i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
    if (k > i) {
      k = i;
      d.length = 1;
    }
    d.reverse();
    for (i = k; i--; ) d.push(0);
    d.reverse();
  } else {
    i = xd.length;
    len = yd.length;
    xLTy = i < len;
    if (xLTy) len = i;
    for (i = 0; i < len; i++) {
      if (xd[i] != yd[i]) {
        xLTy = xd[i] < yd[i];
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
  for (i = yd.length - len; i > 0; --i) xd[len++] = 0;
  for (i = yd.length; i > k; ) {
    if (xd[--i] < yd[i]) {
      for (j = i; j && xd[--j] === 0; ) xd[j] = BASE - 1;
      --xd[j];
      xd[i] += BASE;
    }
    xd[i] -= yd[i];
  }
  for (; xd[--len] === 0; ) xd.pop();
  for (; xd[0] === 0; xd.shift()) --e;
  if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.modulo = P.mod = function(y) {
  var q, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
  if (!y.d || x.d && !x.d[0]) {
    return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
  }
  external = false;
  if (Ctor.modulo == 9) {
    q = divide(x, y.abs(), 0, 3, 1);
    q.s *= y.s;
  } else {
    q = divide(x, y, 0, Ctor.modulo, 1);
  }
  q = q.times(y);
  external = true;
  return x.minus(q);
};
P.naturalExponential = P.exp = function() {
  return naturalExponential(this);
};
P.naturalLogarithm = P.ln = function() {
  return naturalLogarithm(this);
};
P.negated = P.neg = function() {
  var x = new this.constructor(this);
  x.s = -x.s;
  return finalise(x);
};
P.plus = P.add = function(y) {
  var carry, d, e, i, k, len, pr, rm, xd, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.minus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (!yd[0]) y = new Ctor(x);
    return external ? finalise(y, pr, rm) : y;
  }
  k = mathfloor(x.e / LOG_BASE);
  e = mathfloor(y.e / LOG_BASE);
  xd = xd.slice();
  i = k - e;
  if (i) {
    if (i < 0) {
      d = xd;
      i = -i;
      len = yd.length;
    } else {
      d = yd;
      e = k;
      len = xd.length;
    }
    k = Math.ceil(pr / LOG_BASE);
    len = k > len ? k + 1 : len + 1;
    if (i > len) {
      i = len;
      d.length = 1;
    }
    d.reverse();
    for (; i--; ) d.push(0);
    d.reverse();
  }
  len = xd.length;
  i = yd.length;
  if (len - i < 0) {
    i = len;
    d = yd;
    yd = xd;
    xd = d;
  }
  for (carry = 0; i; ) {
    carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
    xd[i] %= BASE;
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
  var k, x = this;
  if (z2 !== void 0 && z2 !== !!z2 && z2 !== 1 && z2 !== 0) throw Error(invalidArgument + z2);
  if (x.d) {
    k = getPrecision(x.d);
    if (z2 && x.e + 1 > k) k = x.e + 1;
  } else {
    k = NaN;
  }
  return k;
};
P.round = function() {
  var x = this, Ctor = x.constructor;
  return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
};
P.sine = P.sin = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = sine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
};
P.squareRoot = P.sqrt = function() {
  var m, n, sd, r, rep, t, x = this, d = x.d, e = x.e, s = x.s, Ctor = x.constructor;
  if (s !== 1 || !d || !d[0]) {
    return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x : 1 / 0);
  }
  external = false;
  s = Math.sqrt(+x);
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
    r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).eq(x);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.tangent = P.tan = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 10;
  Ctor.rounding = 1;
  x = x.sin();
  x.s = 1;
  x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
};
P.times = P.mul = function(y) {
  var carry, e, i, k, r, rL, t, xdL, ydL, x = this, Ctor = x.constructor, xd = x.d, yd = (y = new Ctor(y)).d;
  y.s *= x.s;
  if (!xd || !xd[0] || !yd || !yd[0]) {
    return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
  }
  e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
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
  for (i = rL; i--; ) r.push(0);
  for (i = ydL; --i >= 0; ) {
    carry = 0;
    for (k = xdL + i; k > i; ) {
      t = r[k] + yd[i] * xd[k - i - 1] + carry;
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
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (dp === void 0) return x;
  checkInt32(dp, 0, MAX_DIGITS);
  if (rm === void 0) rm = Ctor.rounding;
  else checkInt32(rm, 0, 8);
  return finalise(x, dp + x.e + 1, rm);
};
P.toExponential = function(dp, rm) {
  var str, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x, true);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), dp + 1, rm);
    str = finiteToString(x, true, dp + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFixed = function(dp, rm) {
  var str, y, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    y = finalise(new Ctor(x), dp + x.e + 1, rm);
    str = finiteToString(y, false, dp + y.e + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFraction = function(maxD) {
  var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r, x = this, xd = x.d, Ctor = x.constructor;
  if (!xd) return new Ctor(x);
  n1 = d0 = new Ctor(1);
  d1 = n0 = new Ctor(0);
  d = new Ctor(d1);
  e = d.e = getPrecision(xd) - x.e - 1;
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
  n0.s = n1.s = x.s;
  r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1 ? [n1, d1] : [n0, d0];
  Ctor.precision = pr;
  external = true;
  return r;
};
P.toHexadecimal = P.toHex = function(sd, rm) {
  return toStringBinary(this, 16, sd, rm);
};
P.toNearest = function(y, rm) {
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (y == null) {
    if (!x.d) return x;
    y = new Ctor(1);
    rm = Ctor.rounding;
  } else {
    y = new Ctor(y);
    if (rm === void 0) {
      rm = Ctor.rounding;
    } else {
      checkInt32(rm, 0, 8);
    }
    if (!x.d) return y.s ? x : y;
    if (!y.d) {
      if (y.s) y.s = x.s;
      return y;
    }
  }
  if (y.d[0]) {
    external = false;
    x = divide(x, y, 0, rm, 1).times(y);
    external = true;
    finalise(x);
  } else {
    y.s = x.s;
    x = y;
  }
  return x;
};
P.toNumber = function() {
  return +this;
};
P.toOctal = function(sd, rm) {
  return toStringBinary(this, 8, sd, rm);
};
P.toPower = P.pow = function(y) {
  var e, k, pr, r, rm, s, x = this, Ctor = x.constructor, yn = +(y = new Ctor(y));
  if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));
  x = new Ctor(x);
  if (x.eq(1)) return x;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (y.eq(1)) return finalise(x, pr, rm);
  e = mathfloor(y.e / LOG_BASE);
  if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
    r = intPow(Ctor, x, k, pr);
    return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
  }
  s = x.s;
  if (s < 0) {
    if (e < y.d.length - 1) return new Ctor(NaN);
    if ((y.d[e] & 1) == 0) s = 1;
    if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
      x.s = s;
      return x;
    }
  }
  k = mathpow(+x, yn);
  e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x.d)) / Math.LN10 + x.e + 1)) : new Ctor(k + "").e;
  if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
  external = false;
  Ctor.rounding = x.s = 1;
  k = Math.min(12, (e + "").length);
  r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);
  if (r.d) {
    r = finalise(r, pr + 5, 1);
    if (checkRoundingDigits(r.d, pr, rm)) {
      e = pr + 10;
      r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);
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
  var str, x = this, Ctor = x.constructor;
  if (sd === void 0) {
    str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), sd, rm);
    str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toSignificantDigits = P.toSD = function(sd, rm) {
  var x = this, Ctor = x.constructor;
  if (sd === void 0) {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  }
  return finalise(new Ctor(x), sd, rm);
};
P.toString = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.truncated = P.trunc = function() {
  return finalise(new this.constructor(this), this.e + 1, 1);
};
P.valueOf = P.toJSON = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() ? "-" + str : str;
};
function digitsToString(d) {
  var i, k, ws, indexOfLastWord = d.length - 1, str = "", w = d[0];
  if (indexOfLastWord > 0) {
    str += w;
    for (i = 1; i < indexOfLastWord; i++) {
      ws = d[i] + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
      str += ws;
    }
    w = d[i];
    ws = w + "";
    k = LOG_BASE - ws.length;
    if (k) str += getZeroString(k);
  } else if (w === 0) {
    return "0";
  }
  for (; w % 10 === 0; ) w /= 10;
  return str + w;
}
function checkInt32(i, min2, max2) {
  if (i !== ~~i || i < min2 || i > max2) {
    throw Error(invalidArgument + i);
  }
}
function checkRoundingDigits(d, i, rm, repeating) {
  var di, k, r, rd;
  for (k = d[0]; k >= 10; k /= 10) --i;
  if (--i < 0) {
    i += LOG_BASE;
    di = 0;
  } else {
    di = Math.ceil((i + 1) / LOG_BASE);
    i %= LOG_BASE;
  }
  k = mathpow(10, LOG_BASE - i);
  rd = d[di] % k | 0;
  if (repeating == null) {
    if (i < 3) {
      if (i == 0) rd = rd / 100 | 0;
      else if (i == 1) rd = rd / 10 | 0;
      r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
    } else {
      r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 || (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
    }
  } else {
    if (i < 4) {
      if (i == 0) rd = rd / 1e3 | 0;
      else if (i == 1) rd = rd / 100 | 0;
      else if (i == 2) rd = rd / 10 | 0;
      r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
    } else {
      r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 1e3 | 0) == mathpow(10, i - 3) - 1;
    }
  }
  return r;
}
function convertBase(str, baseIn, baseOut) {
  var j, arr = [0], arrL, i = 0, strL = str.length;
  for (; i < strL; ) {
    for (arrL = arr.length; arrL--; ) arr[arrL] *= baseIn;
    arr[0] += NUMERALS.indexOf(str.charAt(i++));
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
function cosine(Ctor, x) {
  var k, len, y;
  if (x.isZero()) return x;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    y = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    y = "2.3283064365386962890625e-10";
  }
  Ctor.precision += k;
  x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));
  for (var i = k; i--; ) {
    var cos2x = x.times(x);
    x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
  }
  Ctor.precision -= k;
  return x;
}
var divide = /* @__PURE__ */ (function() {
  function multiplyInteger(x, k, base) {
    var temp, carry = 0, i = x.length;
    for (x = x.slice(); i--; ) {
      temp = x[i] * k + carry;
      x[i] = temp % base | 0;
      carry = temp / base | 0;
    }
    if (carry) x.unshift(carry);
    return x;
  }
  function compare(a, b, aL, bL) {
    var i, r;
    if (aL != bL) {
      r = aL > bL ? 1 : -1;
    } else {
      for (i = r = 0; i < aL; i++) {
        if (a[i] != b[i]) {
          r = a[i] > b[i] ? 1 : -1;
          break;
        }
      }
    }
    return r;
  }
  function subtract(a, b, aL, base) {
    var i = 0;
    for (; aL--; ) {
      a[aL] -= i;
      i = a[aL] < b[aL] ? 1 : 0;
      a[aL] = i * base + a[aL] - b[aL];
    }
    for (; !a[0] && a.length > 1; ) a.shift();
  }
  return function(x, y, pr, rm, dp, base) {
    var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x.constructor, sign2 = x.s == y.s ? 1 : -1, xd = x.d, yd = y.d;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(
        // Return NaN if either NaN, or both Infinity or 0.
        !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
          // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
          xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
        )
      );
    }
    if (base) {
      logBase = 1;
      e = x.e - y.e;
    } else {
      base = BASE;
      logBase = LOG_BASE;
      e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
    }
    yL = yd.length;
    xL = xd.length;
    q = new Ctor(sign2);
    qd = q.d = [];
    for (i = 0; yd[i] == (xd[i] || 0); i++) ;
    if (yd[i] > (xd[i] || 0)) e--;
    if (pr == null) {
      sd = pr = Ctor.precision;
      rm = Ctor.rounding;
    } else if (dp) {
      sd = pr + (x.e - y.e) + 1;
    } else {
      sd = pr;
    }
    if (sd < 0) {
      qd.push(1);
      more = true;
    } else {
      sd = sd / logBase + 2 | 0;
      i = 0;
      if (yL == 1) {
        k = 0;
        yd = yd[0];
        sd++;
        for (; (i < xL || k) && sd--; i++) {
          t = k * base + (xd[i] || 0);
          qd[i] = t / yd | 0;
          k = t % yd | 0;
        }
        more = k || i < xL;
      } else {
        k = base / (yd[0] + 1) | 0;
        if (k > 1) {
          yd = multiplyInteger(yd, k, base);
          xd = multiplyInteger(xd, k, base);
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
        if (yd[1] >= base / 2) ++yd0;
        do {
          k = 0;
          cmp = compare(yd, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
            k = rem0 / yd0 | 0;
            if (k > 1) {
              if (k >= base) k = base - 1;
              prod = multiplyInteger(yd, k, base);
              prodL = prod.length;
              remL = rem.length;
              cmp = compare(prod, rem, prodL, remL);
              if (cmp == 1) {
                k--;
                subtract(prod, yL < prodL ? yz : yd, prodL, base);
              }
            } else {
              if (k == 0) cmp = k = 1;
              prod = yd.slice();
            }
            prodL = prod.length;
            if (prodL < remL) prod.unshift(0);
            subtract(rem, prod, remL, base);
            if (cmp == -1) {
              remL = rem.length;
              cmp = compare(yd, rem, yL, remL);
              if (cmp < 1) {
                k++;
                subtract(rem, yL < remL ? yz : yd, remL, base);
              }
            }
            remL = rem.length;
          } else if (cmp === 0) {
            k++;
            rem = [0];
          }
          qd[i++] = k;
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
      for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
      q.e = i + e * logBase - 1;
      finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
    }
    return q;
  };
})();
function finalise(x, sd, rm, isTruncated) {
  var digits, i, j, k, rd, roundUp, w, xd, xdi, Ctor = x.constructor;
  out: if (sd != null) {
    xd = x.d;
    if (!xd) return x;
    for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
    i = sd - digits;
    if (i < 0) {
      i += LOG_BASE;
      j = sd;
      w = xd[xdi = 0];
      rd = w / mathpow(10, digits - j - 1) % 10 | 0;
    } else {
      xdi = Math.ceil((i + 1) / LOG_BASE);
      k = xd.length;
      if (xdi >= k) {
        if (isTruncated) {
          for (; k++ <= xdi; ) xd.push(0);
          w = rd = 0;
          digits = 1;
          i %= LOG_BASE;
          j = i - LOG_BASE + 1;
        } else {
          break out;
        }
      } else {
        w = k = xd[xdi];
        for (digits = 1; k >= 10; k /= 10) digits++;
        i %= LOG_BASE;
        j = i - LOG_BASE + digits;
        rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
      }
    }
    isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
    roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
    (i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
    if (sd < 1 || !xd[0]) {
      xd.length = 0;
      if (roundUp) {
        sd -= x.e + 1;
        xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
        x.e = -sd || 0;
      } else {
        xd[0] = x.e = 0;
      }
      return x;
    }
    if (i == 0) {
      xd.length = xdi;
      k = 1;
      xdi--;
    } else {
      xd.length = xdi + 1;
      k = mathpow(10, LOG_BASE - i);
      xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
    }
    if (roundUp) {
      for (; ; ) {
        if (xdi == 0) {
          for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
          j = xd[0] += k;
          for (k = 1; j >= 10; j /= 10) k++;
          if (i != k) {
            x.e++;
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
    for (i = xd.length; xd[--i] === 0; ) xd.pop();
  }
  if (external) {
    if (x.e > Ctor.maxE) {
      x.d = null;
      x.e = NaN;
    } else if (x.e < Ctor.minE) {
      x.e = 0;
      x.d = [0];
    }
  }
  return x;
}
function finiteToString(x, isExp, sd) {
  if (!x.isFinite()) return nonFiniteToString(x);
  var k, e = x.e, str = digitsToString(x.d), len = str.length;
  if (isExp) {
    if (sd && (k = sd - len) > 0) {
      str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
    } else if (len > 1) {
      str = str.charAt(0) + "." + str.slice(1);
    }
    str = str + (x.e < 0 ? "e" : "e+") + x.e;
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
function intPow(Ctor, x, n, pr) {
  var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
  external = false;
  for (; ; ) {
    if (n % 2) {
      r = r.times(x);
      if (truncate(r.d, k)) isTruncated = true;
    }
    n = mathfloor(n / 2);
    if (n === 0) {
      n = r.d.length - 1;
      if (isTruncated && r.d[n] === 0) ++r.d[n];
      break;
    }
    x = x.times(x);
    truncate(x.d, k);
  }
  external = true;
  return r;
}
function isOdd(n) {
  return n.d[n.d.length - 1] & 1;
}
function maxOrMin(Ctor, args, n) {
  var k, y, x = new Ctor(args[0]), i = 0;
  for (; ++i < args.length; ) {
    y = new Ctor(args[i]);
    if (!y.s) {
      x = y;
      break;
    }
    k = x.cmp(y);
    if (k === n || k === 0 && x.s === n) {
      x = y;
    }
  }
  return x;
}
function naturalExponential(x, sd) {
  var denominator, guard, j, pow2, sum2, t, wpr, rep = 0, i = 0, k = 0, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (!x.d || !x.d[0] || x.e > 17) {
    return new Ctor(x.d ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0 : x.s ? x.s < 0 ? 0 : x : 0 / 0);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  t = new Ctor(0.03125);
  while (x.e > -2) {
    x = x.times(t);
    k += 5;
  }
  guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
  wpr += guard;
  denominator = pow2 = sum2 = new Ctor(1);
  Ctor.precision = wpr;
  for (; ; ) {
    pow2 = finalise(pow2.times(x), wpr, 1);
    denominator = denominator.times(++i);
    t = sum2.plus(divide(pow2, denominator, wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      j = k;
      while (j--) sum2 = finalise(sum2.times(sum2), wpr, 1);
      if (sd == null) {
        if (rep < 3 && checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += 10;
          denominator = pow2 = t = new Ctor(1);
          i = 0;
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
  var c, c0, denominator, e, numerator, rep, sum2, t, wpr, x1, x2, n = 1, guard = 10, x = y, xd = x.d, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
    return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
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
  if (Math.abs(e = x.e) < 15e14) {
    while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
      x = x.times(y);
      c = digitsToString(x.d);
      c0 = c.charAt(0);
      n++;
    }
    e = x.e;
    if (c0 > 1) {
      x = new Ctor("0." + c);
      e++;
    } else {
      x = new Ctor(c0 + "." + c.slice(1));
    }
  } else {
    t = getLn10(Ctor, wpr + 2, pr).times(e + "");
    x = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
    Ctor.precision = pr;
    return sd == null ? finalise(x, pr, rm, external = true) : x;
  }
  x1 = x;
  sum2 = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
  x2 = finalise(x.times(x), wpr, 1);
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
          t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
          x2 = finalise(x.times(x), wpr, 1);
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
function nonFiniteToString(x) {
  return String(x.s * x.s / 0);
}
function parseDecimal(x, str) {
  var e, i, len;
  if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
  if ((i = str.search(/e/i)) > 0) {
    if (e < 0) e = i;
    e += +str.slice(i + 1);
    str = str.substring(0, i);
  } else if (e < 0) {
    e = str.length;
  }
  for (i = 0; str.charCodeAt(i) === 48; i++) ;
  for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
  str = str.slice(i, len);
  if (str) {
    len -= i;
    x.e = e = e - i - 1;
    x.d = [];
    i = (e + 1) % LOG_BASE;
    if (e < 0) i += LOG_BASE;
    if (i < len) {
      if (i) x.d.push(+str.slice(0, i));
      for (len -= LOG_BASE; i < len; ) x.d.push(+str.slice(i, i += LOG_BASE));
      str = str.slice(i);
      i = LOG_BASE - str.length;
    } else {
      i -= len;
    }
    for (; i--; ) str += "0";
    x.d.push(+str);
    if (external) {
      if (x.e > x.constructor.maxE) {
        x.d = null;
        x.e = NaN;
      } else if (x.e < x.constructor.minE) {
        x.e = 0;
        x.d = [0];
      }
    }
  } else {
    x.e = 0;
    x.d = [0];
  }
  return x;
}
function parseOther(x, str) {
  var base, Ctor, divisor, i, isFloat, len, p, xd, xe;
  if (str.indexOf("_") > -1) {
    str = str.replace(/(\d)_(?=\d)/g, "$1");
    if (isDecimal.test(str)) return parseDecimal(x, str);
  } else if (str === "Infinity" || str === "NaN") {
    if (!+str) x.s = NaN;
    x.e = NaN;
    x.d = null;
    return x;
  }
  if (isHex.test(str)) {
    base = 16;
    str = str.toLowerCase();
  } else if (isBinary.test(str)) {
    base = 2;
  } else if (isOctal.test(str)) {
    base = 8;
  } else {
    throw Error(invalidArgument + str);
  }
  i = str.search(/p/i);
  if (i > 0) {
    p = +str.slice(i + 1);
    str = str.substring(2, i);
  } else {
    str = str.slice(2);
  }
  i = str.indexOf(".");
  isFloat = i >= 0;
  Ctor = x.constructor;
  if (isFloat) {
    str = str.replace(".", "");
    len = str.length;
    i = len - i;
    divisor = intPow(Ctor, new Ctor(base), i, i * 2);
  }
  xd = convertBase(str, base, BASE);
  xe = xd.length - 1;
  for (i = xe; xd[i] === 0; --i) xd.pop();
  if (i < 0) return new Ctor(x.s * 0);
  x.e = getBase10Exponent(xd, xe);
  x.d = xd;
  external = false;
  if (isFloat) x = divide(x, divisor, len * 4);
  if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
  external = true;
  return x;
}
function sine(Ctor, x) {
  var k, len = x.d.length;
  if (len < 3) {
    return x.isZero() ? x : taylorSeries(Ctor, 2, x, x);
  }
  k = 1.4 * Math.sqrt(len);
  k = k > 16 ? 16 : k | 0;
  x = x.times(1 / tinyPow(5, k));
  x = taylorSeries(Ctor, 2, x, x);
  var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
  for (; k--; ) {
    sin2_x = x.times(x);
    x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
  }
  return x;
}
function taylorSeries(Ctor, n, x, y, isHyperbolic) {
  var j, t, u, x2, i = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
  external = false;
  x2 = x.times(x);
  u = new Ctor(y);
  for (; ; ) {
    t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
    u = isHyperbolic ? y.plus(t) : y.minus(t);
    y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
    t = u.plus(y);
    if (t.d[k] !== void 0) {
      for (j = k; t.d[j] === u.d[j] && j--; ) ;
      if (j == -1) break;
    }
    j = u;
    u = y;
    y = t;
    t = j;
    i++;
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
function toLessThanHalfPi(Ctor, x) {
  var t, isNeg = x.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
  x = x.abs();
  if (x.lte(halfPi)) {
    quadrant = isNeg ? 4 : 1;
    return x;
  }
  t = x.divToInt(pi);
  if (t.isZero()) {
    quadrant = isNeg ? 3 : 2;
  } else {
    x = x.minus(t.times(pi));
    if (x.lte(halfPi)) {
      quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
      return x;
    }
    quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
  }
  return x.minus(pi).abs();
}
function toStringBinary(x, baseOut, sd, rm) {
  var base, e, i, k, len, roundUp, str, xd, y, Ctor = x.constructor, isExp = sd !== void 0;
  if (isExp) {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  } else {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  }
  if (!x.isFinite()) {
    str = nonFiniteToString(x);
  } else {
    str = finiteToString(x);
    i = str.indexOf(".");
    if (isExp) {
      base = 2;
      if (baseOut == 16) {
        sd = sd * 4 - 3;
      } else if (baseOut == 8) {
        sd = sd * 3 - 2;
      }
    } else {
      base = baseOut;
    }
    if (i >= 0) {
      str = str.replace(".", "");
      y = new Ctor(1);
      y.e = str.length - i;
      y.d = convertBase(finiteToString(y), 10, base);
      y.e = y.d.length;
    }
    xd = convertBase(str, 10, base);
    e = len = xd.length;
    for (; xd[--len] == 0; ) xd.pop();
    if (!xd[0]) {
      str = isExp ? "0p+0" : "0";
    } else {
      if (i < 0) {
        e--;
      } else {
        x = new Ctor(x);
        x.d = xd;
        x.e = e;
        x = divide(x, y, sd, rm, 0, base);
        xd = x.d;
        e = x.e;
        roundUp = inexact;
      }
      i = xd[sd];
      k = base / 2;
      roundUp = roundUp || xd[sd + 1] !== void 0;
      roundUp = rm < 4 ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2)) : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x.s < 0 ? 8 : 7));
      xd.length = sd;
      if (roundUp) {
        for (; ++xd[--sd] > base - 1; ) {
          xd[sd] = 0;
          if (!sd) {
            ++e;
            xd.unshift(1);
          }
        }
      }
      for (len = xd.length; !xd[len - 1]; --len) ;
      for (i = 0, str = ""; i < len; i++) str += NUMERALS.charAt(xd[i]);
      if (isExp) {
        if (len > 1) {
          if (baseOut == 16 || baseOut == 8) {
            i = baseOut == 16 ? 4 : 3;
            for (--len; len % i; len++) str += "0";
            xd = convertBase(str, base, baseOut);
            for (len = xd.length; !xd[len - 1]; --len) ;
            for (i = 1, str = "1."; i < len; i++) str += NUMERALS.charAt(xd[i]);
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
  return x.s < 0 ? "-" + str : str;
}
function truncate(arr, len) {
  if (arr.length > len) {
    arr.length = len;
    return true;
  }
}
function abs(x) {
  return new this(x).abs();
}
function acos(x) {
  return new this(x).acos();
}
function acosh(x) {
  return new this(x).acosh();
}
function add(x, y) {
  return new this(x).plus(y);
}
function asin(x) {
  return new this(x).asin();
}
function asinh(x) {
  return new this(x).asinh();
}
function atan(x) {
  return new this(x).atan();
}
function atanh(x) {
  return new this(x).atanh();
}
function atan2(y, x) {
  y = new this(y);
  x = new this(x);
  var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
  if (!y.s || !x.s) {
    r = new this(NaN);
  } else if (!y.d && !x.d) {
    r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
    r.s = y.s;
  } else if (!x.d || y.isZero()) {
    r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
    r.s = y.s;
  } else if (!y.d || x.isZero()) {
    r = getPi(this, wpr, 1).times(0.5);
    r.s = y.s;
  } else if (x.s < 0) {
    this.precision = wpr;
    this.rounding = 1;
    r = this.atan(divide(y, x, wpr, 1));
    x = getPi(this, wpr, 1);
    this.precision = pr;
    this.rounding = rm;
    r = y.s < 0 ? r.minus(x) : r.plus(x);
  } else {
    r = this.atan(divide(y, x, wpr, 1));
  }
  return r;
}
function cbrt(x) {
  return new this(x).cbrt();
}
function ceil(x) {
  return finalise(x = new this(x), x.e + 1, 2);
}
function clamp(x, min2, max2) {
  return new this(x).clamp(min2, max2);
}
function config(obj) {
  if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
  var i, p, v, useDefaults = obj.defaults === true, ps = [
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
  for (i = 0; i < ps.length; i += 3) {
    if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
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
function cos(x) {
  return new this(x).cos();
}
function cosh(x) {
  return new this(x).cosh();
}
function clone(obj) {
  var i, p, ps;
  function Decimal2(v) {
    var e, i2, t, x = this;
    if (!(x instanceof Decimal2)) return new Decimal2(v);
    x.constructor = Decimal2;
    if (isDecimalInstance(v)) {
      x.s = v.s;
      if (external) {
        if (!v.d || v.e > Decimal2.maxE) {
          x.e = NaN;
          x.d = null;
        } else if (v.e < Decimal2.minE) {
          x.e = 0;
          x.d = [0];
        } else {
          x.e = v.e;
          x.d = v.d.slice();
        }
      } else {
        x.e = v.e;
        x.d = v.d ? v.d.slice() : v.d;
      }
      return;
    }
    t = typeof v;
    if (t === "number") {
      if (v === 0) {
        x.s = 1 / v < 0 ? -1 : 1;
        x.e = 0;
        x.d = [0];
        return;
      }
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      if (v === ~~v && v < 1e7) {
        for (e = 0, i2 = v; i2 >= 10; i2 /= 10) e++;
        if (external) {
          if (e > Decimal2.maxE) {
            x.e = NaN;
            x.d = null;
          } else if (e < Decimal2.minE) {
            x.e = 0;
            x.d = [0];
          } else {
            x.e = e;
            x.d = [v];
          }
        } else {
          x.e = e;
          x.d = [v];
        }
        return;
      }
      if (v * 0 !== 0) {
        if (!v) x.s = NaN;
        x.e = NaN;
        x.d = null;
        return;
      }
      return parseDecimal(x, v.toString());
    }
    if (t === "string") {
      if ((i2 = v.charCodeAt(0)) === 45) {
        v = v.slice(1);
        x.s = -1;
      } else {
        if (i2 === 43) v = v.slice(1);
        x.s = 1;
      }
      return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
    }
    if (t === "bigint") {
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      return parseDecimal(x, v.toString());
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
      for (i = 0; i < ps.length; ) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
    }
  }
  Decimal2.config(obj);
  return Decimal2;
}
function div(x, y) {
  return new this(x).div(y);
}
function exp(x) {
  return new this(x).exp();
}
function floor(x) {
  return finalise(x = new this(x), x.e + 1, 3);
}
function hypot() {
  var i, n, t = new this(0);
  external = false;
  for (i = 0; i < arguments.length; ) {
    n = new this(arguments[i++]);
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
function ln(x) {
  return new this(x).ln();
}
function log(x, y) {
  return new this(x).log(y);
}
function log2(x) {
  return new this(x).log(2);
}
function log10(x) {
  return new this(x).log(10);
}
function max() {
  return maxOrMin(this, arguments, -1);
}
function min() {
  return maxOrMin(this, arguments, 1);
}
function mod(x, y) {
  return new this(x).mod(y);
}
function mul(x, y) {
  return new this(x).mul(y);
}
function pow(x, y) {
  return new this(x).pow(y);
}
function random(sd) {
  var d, e, k, n, i = 0, r = new this(1), rd = [];
  if (sd === void 0) sd = this.precision;
  else checkInt32(sd, 1, MAX_DIGITS);
  k = Math.ceil(sd / LOG_BASE);
  if (!this.crypto) {
    for (; i < k; ) rd[i++] = Math.random() * 1e7 | 0;
  } else if (crypto.getRandomValues) {
    d = crypto.getRandomValues(new Uint32Array(k));
    for (; i < k; ) {
      n = d[i];
      if (n >= 429e7) {
        d[i] = crypto.getRandomValues(new Uint32Array(1))[0];
      } else {
        rd[i++] = n % 1e7;
      }
    }
  } else if (crypto.randomBytes) {
    d = crypto.randomBytes(k *= 4);
    for (; i < k; ) {
      n = d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + ((d[i + 3] & 127) << 24);
      if (n >= 214e7) {
        crypto.randomBytes(4).copy(d, i);
      } else {
        rd.push(n % 1e7);
        i += 4;
      }
    }
    i = k / 4;
  } else {
    throw Error(cryptoUnavailable);
  }
  k = rd[--i];
  sd %= LOG_BASE;
  if (k && sd) {
    n = mathpow(10, LOG_BASE - sd);
    rd[i] = (k / n | 0) * n;
  }
  for (; rd[i] === 0; i--) rd.pop();
  if (i < 0) {
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
function round(x) {
  return finalise(x = new this(x), x.e + 1, this.rounding);
}
function sign(x) {
  x = new this(x);
  return x.d ? x.d[0] ? x.s : 0 * x.s : x.s || NaN;
}
function sin(x) {
  return new this(x).sin();
}
function sinh(x) {
  return new this(x).sinh();
}
function sqrt(x) {
  return new this(x).sqrt();
}
function sub(x, y) {
  return new this(x).sub(y);
}
function sum() {
  var i = 0, args = arguments, x = new this(args[i]);
  external = false;
  for (; x.s && ++i < args.length; ) x = x.plus(args[i]);
  external = true;
  return finalise(x, this.precision, this.rounding);
}
function tan(x) {
  return new this(x).tan();
}
function tanh(x) {
  return new this(x).tanh();
}
function trunc(x) {
  return finalise(x = new this(x), x.e + 1, 1);
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
  precision;
  constructor(precision = 50) {
    this.precision = precision;
    decimal_default.set({ precision, rounding: decimal_default.ROUND_HALF_EVEN });
    this.zero = new decimal_default(0);
    this.one = new decimal_default(1);
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
  p;
  constructor(p) {
    this.p = p;
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
    let base = a;
    let e = this.p - 2;
    while (e > 0) {
      if (e & 1) result = this.mul(result, base);
      base = this.mul(base, base);
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
  abs(a) {
    return a;
  }
  transcendental(op) {
    throw new Error(`${op} is not available in GF(p); this step needs numeric mode`);
  }
  sqrt(_a) {
    return this.transcendental("sqrt");
  }
  exp(_a) {
    return this.transcendental("exp");
  }
  log(_a) {
    return this.transcendental("log");
  }
  sin(_a) {
    return this.transcendental("sin");
  }
  cos(_a) {
    return this.transcendental("cos");
  }
  tanh(_a) {
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
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) d[i * c + j] = fill(i, j);
  return { r, c, d };
}
function zeros(r, c, z2) {
  return mat(r, c, () => z2);
}
function identity(n, one, zero) {
  return mat(n, n, (i, j) => i === j ? one : zero);
}
function matAdd(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error(`shape mismatch in add: ${a.r}x${a.c} vs ${b.r}x${b.c}`);
  const d = new Array(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.add(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}
function matSub(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error(`shape mismatch in sub: ${a.r}x${a.c} vs ${b.r}x${b.c}`);
  const d = new Array(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.sub(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}
function matScale(f, s, a) {
  const d = new Array(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.mul(s, a.d[i]);
  return { r: a.r, c: a.c, d };
}
function matMul(f, a, b) {
  if (a.c !== b.r) throw new Error(`shape mismatch in mul: ${a.r}x${a.c} times ${b.r}x${b.c}`);
  const out = new Array(a.r * b.c).fill(f.zero);
  for (let i = 0; i < a.r; i++) {
    for (let k = 0; k < a.c; k++) {
      const aik = a.d[i * a.c + k];
      if (f.isZero(aik)) continue;
      for (let j = 0; j < b.c; j++) {
        out[i * b.c + j] = f.add(out[i * b.c + j], f.mul(aik, b.d[k * b.c + j]));
      }
    }
  }
  return { r: a.r, c: b.c, d: out };
}
function transpose(a) {
  const d = new Array(a.r * a.c);
  for (let i = 0; i < a.r; i++) for (let j = 0; j < a.c; j++) d[j * a.r + i] = a.d[i * a.c + j];
  return { r: a.c, c: a.r, d };
}
function trace(f, a) {
  if (a.r !== a.c) throw new Error("trace of a non square matrix");
  let s = f.zero;
  for (let i = 0; i < a.r; i++) s = f.add(s, a.d[i * a.c + i]);
  return s;
}
function matTrace(f, a) {
  return trace(f, a);
}
function matInv(f, a) {
  const n = a.r;
  if (n !== a.c) throw new DomainError("inverse of a non square matrix");
  const m = mat(n, 2 * n, (i, j) => j < n ? a.d[i * n + j] : i === j - n ? f.one : f.zero);
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
  return mat(n, n, (i, j) => m.d[i * 2 * n + n + j]);
}
function matDet(f, a) {
  const n = a.r;
  if (n !== a.c) throw new DomainError("determinant of a non square matrix");
  const m = a.d.slice();
  let det = f.one;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    let best = f.abs(m[c * n + c]);
    for (let r = c + 1; r < n; r++) {
      const v = f.abs(m[r * n + c]);
      if (f.cmp(v, best) > 0) {
        best = v;
        pivot = r;
      }
    }
    if (f.isZero(best)) return f.zero;
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
  for (let i = 0; i < a.r; i++) {
    for (let j = 0; j < a.c; j++) {
      for (let p = 0; p < b.r; p++) {
        for (let q = 0; q < b.c; q++) {
          d[(i * b.r + p) * c + (j * b.c + q)] = f.mul(a.d[i * a.c + j], b.d[p * b.c + q]);
        }
      }
    }
  }
  return { r, c, d };
}
function hadamard(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error("shape mismatch in hadamard");
  const d = new Array(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.mul(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}
function inner(f, a, b) {
  if (a.r !== b.r || a.c !== b.c) throw new Error("shape mismatch in inner");
  let s = f.zero;
  for (let i = 0; i < a.d.length; i++) s = f.add(s, f.mul(a.d[i], b.d[i]));
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
  for (let i = 0; i < n; i++) d[i * n + i] = v.d[i];
  return { r: n, c: n, d };
}
function block(rows) {
  const R = rows.length;
  const C = rows[0].length;
  const r = rows.reduce((s, row) => s + row[0].r, 0);
  const c = rows.reduce((s, row) => s + row[0].c, 0);
  const d = new Array(r * c);
  let oi = 0;
  for (let i = 0; i < R; i++) {
    let oj = 0;
    for (let j = 0; j < C; j++) {
      const blk = rows[i][j];
      for (let bi = 0; bi < blk.r; bi++) {
        for (let bj = 0; bj < blk.c; bj++) {
          d[(oi + bi) * c + (oj + bj)] = blk.d[bi * blk.c + bj];
        }
      }
      oj += blk.c;
    }
    oi += rows[i][0].r;
  }
  return { r, c, d };
}
function matPow(f, a, k) {
  if (k === 0) return identity(a.r, f.one, f.zero);
  let result = identity(a.r, f.one, f.zero);
  let base = a;
  let e = k;
  while (e > 0) {
    if (e & 1) result = matMul(f, result, base);
    e >>= 1;
    if (e > 0) base = matMul(f, base, base);
  }
  return result;
}

// src/core/fields/dual.ts
var DualField = class {
  name;
  zero;
  one;
  base;
  constructor(base) {
    this.base = base;
    this.name = `dual(${base.name})`;
    this.zero = { v: base.zero, t: base.zero };
    this.one = { v: base.one, t: base.zero };
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
  base;
  constructor(base) {
    this.base = base;
    this.name = `hyperdual(${base.name})`;
    this.zero = { v: base.zero, e1: base.zero, e2: base.zero, e12: base.zero };
    this.one = { v: base.one, e1: base.zero, e2: base.zero, e12: base.zero };
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
        const i = local2 % k;
        local2 = Math.floor(local2 / k);
        atoms.push(rule.atoms[i]);
        weight = f.mul(weight, f.fromRational(rule.weights[i].n, rule.weights[i].d));
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
      for (let i = lo; i <= hi; i++) {
        const saved = env.values.get(node.idx);
        env.values.set(node.idx, scalar(f.fromRational(i, 1)));
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
      const mats = rows.map((row) => row.map((cell) => requireMatrix(cell, "a matrix entry")));
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
      const k = nodeExponent(args[1]);
      if (isScalarVal(a)) {
        let acc = f.one;
        for (let i = 0; i < k; i++) acc = f.mul(acc, a.v);
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
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const minor = zeros(n - 1, n - 1, f.zero);
          for (let r = 0; r < n - 1; r++) {
            for (let c = 0; c < n - 1; c++) {
              const sr = r < i ? r : r + 1;
              const sc = c < j ? c : c + 1;
              minor.d[r * (n - 1) + c] = a.d[sr * n + sc];
            }
          }
          const det = n === 1 ? f.one : matDet(f, minor);
          cofactors.d[j * n + i] = (i + j) % 2 === 0 ? det : f.neg(det);
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
      const a = requireMatrix(args[0], "a matrix square root");
      return { k: "m", m: matPow(f, a, 0) };
    }
    default:
      throw new EvalError(`unknown operation ${op}`);
  }
}
function nodeExponent(val) {
  if (isScalarVal(val)) return Math.max(0, Math.round(Number(val.v)));
  return 2;
}
function evalCall(f, fn, args, _env) {
  const a0 = args[0];
  switch (fn) {
    case "exp":
    case "log":
    case "ln":
    case "sqrt":
    case "sin":
    case "cos":
    case "tan":
    case "tanh":
    case "sigmoid":
    case "relu": {
      const unary = (x) => {
        if (fn === "exp") return f.exp(x);
        if (fn === "log" || fn === "ln") return f.log(x);
        if (fn === "sqrt") return f.sqrt(x);
        if (fn === "sin") return f.sin(x);
        if (fn === "cos") return f.cos(x);
        if (fn === "tan") return f.div(f.sin(x), f.cos(x));
        if (fn === "tanh") return f.tanh(x);
        if (fn === "sigmoid") return f.div(f.one, f.add(f.one, f.exp(f.neg(x))));
        return f.cmp(x, f.zero) > 0 ? x : f.zero;
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
      const x = requireMatrix(args[0], "a density");
      const mu = requireMatrix(args[1], "a density");
      const sigma = requireMatrix(args[2], "a density");
      const diff = matSub(f, x, mu);
      const inv = matInv(f, sigma);
      const quad = inner(f, diff, matMul(f, inv, diff));
      const n = x.c;
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
  return { r: m.r, c: m.c, d: m.d.map((x) => ({ v: x, t: f.zero })) };
}
function toHyperDual(f, m) {
  return {
    r: m.r,
    c: m.c,
    d: m.d.map((x) => ({ v: x, e1: f.zero, e2: f.zero, e12: f.zero }))
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
function directionalDerivative(base, fnNode, env, wrtName, baseValue, direction) {
  const dual = new DualField(base);
  const dEnv = dualEnv(env, dual);
  if (isScalarVal(baseValue) && isScalarVal(direction)) {
    dEnv.values.set(wrtName, scalar({ v: baseValue.v, t: direction.v }));
  } else {
    const bm = isMatrixVal(baseValue) ? baseValue.m : { r: 1, c: 1, d: [baseValue.v] };
    const dm = isMatrixVal(direction) ? direction.m : { r: 1, c: 1, d: [direction.v] };
    const dMat = toDual(base, bm);
    for (let i = 0; i < dMat.d.length; i++) dMat.d[i] = { v: dMat.d[i].v, t: dm.d[i] };
    dEnv.values.set(wrtName, { k: "m", m: dMat });
  }
  const result = evalNode(dual, fnNode, dEnv);
  if (isScalarVal(result)) return scalar(result.v.t);
  return { k: "m", m: { r: result.m.r, c: result.m.c, d: result.m.d.map((x) => x.t) } };
}
function mixedSecondDerivative(base, fnNode, env, wrtName, baseValue, v, w) {
  const hyper = new HyperDualField(base);
  const hEnv = hyperEnv(env, hyper);
  if (isScalarVal(baseValue) && isScalarVal(v) && isScalarVal(w)) {
    hEnv.values.set(
      wrtName,
      scalar({ v: baseValue.v, e1: v.v, e2: w.v, e12: base.zero })
    );
  } else {
    const bm = isMatrixVal(baseValue) ? baseValue.m : { r: 1, c: 1, d: [baseValue.v] };
    const vm = isMatrixVal(v) ? v.m : { r: 1, c: 1, d: [v.v] };
    const wm = isMatrixVal(w) ? w.m : { r: 1, c: 1, d: [w.v] };
    const hMat = toHyperDual(base, bm);
    for (let i = 0; i < hMat.d.length; i++) {
      hMat.d[i] = { v: hMat.d[i].v, e1: vm.d[i], e2: wm.d[i], e12: base.zero };
    }
    hEnv.values.set(wrtName, { k: "m", m: hMat });
  }
  const result = evalNode(hyper, fnNode, hEnv);
  if (isScalarVal(result)) return scalar(result.v.e12);
  return { k: "m", m: { r: result.m.r, c: result.m.c, d: result.m.d.map((x) => x.e12) } };
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
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
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
    const has = (p) => props.some((x) => typeof x === "string" ? x === p : false);
    if (has("ident")) return { k: "m", m: identity(r, this.field.one, this.field.zero) };
    if (has("zero")) return { k: "m", m: zeros(r, c, this.field.zero) };
    if (has("ones")) return { k: "m", m: this.mat(r, c, () => this.field.one) };
    if (has("orth")) return { k: "m", m: this.sampleOrthogonal(r) };
    if (has("idem") || has("proj")) return { k: "m", m: this.sampleIdempotent(r, c) };
    if (has("unit")) return { k: "m", m: this.sampleUnit(r, c) };
    if (has("stoch")) return { k: "m", m: this.sampleStochastic(r, c) };
    if (has("diag")) return { k: "m", m: this.sampleDiagonal(r, c) };
    if (has("triu")) return { k: "m", m: this.sampleTriangular(r, c, true) };
    if (has("tril")) return { k: "m", m: this.sampleTriangular(r, c, false) };
    if (has("skew")) return { k: "m", m: this.sampleSkew(r, c) };
    if (has("sym") || has("spd") || has("psd")) return { k: "m", m: this.sampleSymmetric(r, c) };
    return { k: "m", m: this.sampleGeneral(r, c) };
  }
  mat(r, c, f) {
    const d = new Array(r * c);
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) d[i * c + j] = f(i, j);
    return { r, c, d };
  }
  /** One random element of the field. */
  element() {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p);
    return f.normal(this.rng);
  }
  /** iid entries. */
  sampleGeneral(r, c) {
    return this.mat(r, c, () => this.element());
  }
  /** The upper triangle is mirrored. */
  sampleSymmetric(r, c) {
    const upper = this.sampleGeneral(r, c);
    return this.mat(r, c, (i, j) => i <= j ? upper.d[i * c + j] : upper.d[j * c + i]);
  }
  /** A diagonal matrix. */
  sampleDiagonal(r, c) {
    return this.mat(r, c, (i, j) => i === j ? this.element() : this.field.zero);
  }
  /** Upper or lower triangular. */
  sampleTriangular(r, c, upper) {
    return this.mat(r, c, (i, j) => {
      if (i === j) return this.element();
      const inUpper = i < j;
      return inUpper === upper ? this.element() : this.field.zero;
    });
  }
  /** Skew symmetric: the transpose is the negative. */
  sampleSkew(r, c) {
    const f = this.field;
    const upper = this.sampleGeneral(r, c);
    return this.mat(r, c, (i, j) => i === j ? f.zero : i < j ? upper.d[i * c + j] : f.neg(upper.d[j * c + i]));
  }
  /**
   * An orthogonal matrix.
   *
   * Over a finite field the Cayley transform is exact: Q = (I - S)(I + S)^-1
   * with S skew gives Q^T Q = I as an identity, not as an approximation.
   */
  sampleOrthogonal(n) {
    const f = this.field;
    if (f instanceof GFpField) {
      const g = f;
      const s = this.sampleSkew(n, n);
      const eye = identity(n, g.one, g.zero);
      const plus = matAdd(g, eye, s);
      const minus = matSub(g, eye, s);
      const inv = matInv(g, plus);
      return matMul(g, minus, inv);
    }
    return this.qrHaar(this.sampleGeneral(n, n));
  }
  /** Gram-Schmidt with the sign correction, which gives a Haar measure. */
  qrHaar(a) {
    const f = this.field;
    const n = a.r;
    const cols = [];
    for (let j = 0; j < n; j++) {
      const v = { r: n, c: 1, d: new Array(n).fill(f.zero) };
      for (let i = 0; i < n; i++) v.d[i] = a.d[i * n + j];
      for (const q of cols) {
        let proj = f.zero;
        for (let i = 0; i < n; i++) proj = f.add(proj, f.mul(q.d[i], v.d[i]));
        for (let i = 0; i < n; i++) v.d[i] = f.sub(v.d[i], f.mul(proj, q.d[i]));
      }
      let norm = f.zero;
      for (let i = 0; i < n; i++) norm = f.add(norm, f.mul(v.d[i], v.d[i]));
      let normNum = Math.sqrt(f.toNumber(norm));
      if (normNum < 1e-9) normNum = 1;
      if (f.toNumber(v.d[n - 1]) < 0) normNum = -normNum;
      const scale = f.fromRational(Math.round(normNum * 1e6), 1e6);
      for (let i = 0; i < n; i++) v.d[i] = f.div(v.d[i], scale);
      cols.push(v);
    }
    return this.mat(n, n, (i, j) => cols[j].d[i]);
  }
  /** An idempotent matrix of rank k: U (V^T U)^-1 V^T. */
  sampleIdempotent(r, c) {
    const f = this.field;
    const k = Math.max(1, Math.min(r, c) - 1);
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
      const t = this.sampleGeneral(c - 1, 1);
      let sq = f.zero;
      for (const x of t.d) sq = f.add(sq, f.mul(x, x));
      const den = f.add(sq, f.one);
      const inv = f.inv(den);
      return this.mat(r, c, (i, j) => {
        if (c === 1) return f.one;
        if (j === c - 1) return f.mul(f.sub(sq, f.one), inv);
        return f.mul(f.mul(f.fromRational(2, 1), t.d[i * t.c + j]), inv);
      });
    }
    const v = this.sampleGeneral(r, c);
    let norm = f.zero;
    for (const x of v.d) norm = f.add(norm, f.mul(x, x));
    const s = Math.sqrt(f.toNumber(norm)) || 1;
    const scale = f.fromRational(Math.round(s * 1e9), 1e9);
    return this.mat(r, c, (i, j) => f.div(v.d[i * c + j], scale));
  }
  /** Row stochastic: the rows are positive and sum to one. */
  sampleStochastic(r, c) {
    const f = this.field;
    const raw = this.sampleGeneral(r, c);
    return this.mat(r, c, (i, j) => {
      let sum2 = f.zero;
      for (let k = 0; k < c; k++) sum2 = f.add(sum2, raw.d[i * c + k]);
      if (f.isZero(sum2)) return f.zero;
      return f.div(raw.d[i * c + j], sum2);
    });
  }
  /** A scalar drawn from the field. */
  sampleScalar() {
    return this.element();
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
  "mathrm",
  "mathsf",
  "mathtt",
  "mathbb",
  "text",
  "boldsymbol"
]);
var GLYPH_ACCENTS = /* @__PURE__ */ new Set([
  "hat",
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
  "bm"
]);
var GREEK = /* @__PURE__ */ new Set([
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "rho",
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
  let i = 0;
  const n = text.length;
  const push = (type, value, from, to) => {
    tokens.push({ type, value, from, to });
  };
  while (i < n) {
    const ch = text[i];
    if (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "%") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (ch === "\\") {
      const start = i;
      i++;
      if (i >= n) {
        push("csym", "\\", start, i);
        break;
      }
      const c = text[i];
      if (/[A-Za-z]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z]/.test(text[j])) j++;
        const name = text.slice(i, j);
        i = j;
        if (name === "begin" || name === "end") {
          const env = readBracedName(text, i);
          if (env) {
            i = env.next;
            push(name === "begin" ? "begin" : "end", env.name, start, i);
            continue;
          }
        }
        if (SPACE_COMMANDS.has(name)) {
          continue;
        }
        if (DROP_COMMANDS.has(name)) {
          continue;
        }
        push("cmd", name, start, i);
        continue;
      }
      const sym = text[i];
      i += 1;
      if (sym === "\\") {
        if (text[i] === "\\") i += 1;
        push("nl", "\\\\", start, i);
        continue;
      }
      if (sym === "{" || sym === "}") {
        push(sym === "{" ? "lbrace" : "rbrace", sym, start, i);
        continue;
      }
      if (sym === "," || sym === ";" || sym === ":" || sym === "!" || sym === " ") continue;
      push("csym", sym === "|" ? "\\|" : sym, start, i);
      continue;
    }
    if (ch === "{") {
      push("lbrace", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "}") {
      push("rbrace", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "(") {
      push("lparen", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === ")") {
      push("rparen", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "[") {
      push("lbrack", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "]") {
      push("rbrack", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "^") {
      push("sup", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "_") {
      push("sub", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "&") {
      push("amp", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === ",") {
      push("comma", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === ";") {
      push("semi", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "'") {
      push("csym", "'", i, i + 1);
      i++;
      continue;
    }
    if (OPERATOR_CHARS.includes(ch)) {
      push("op", ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "|") {
      push("csym", "|", i, i + 1);
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || ch === "." && /[0-9]/.test(text[i + 1] ?? "")) {
      let j = i;
      while (j < n && /[0-9]/.test(text[j])) j++;
      if (text[j] === ".") {
        j++;
        while (j < n && /[0-9]/.test(text[j])) j++;
      }
      push("num", text.slice(i, j), i, j);
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9]/.test(text[j])) j++;
      push("ident", text.slice(i, j), i, j);
      i = j;
      continue;
    }
    push("op", ch, i, i + 1);
    i++;
  }
  push("eof", "", n, n);
  return tokens;
}
function readBracedName(text, i) {
  let j = i;
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
  models: "other"
};
var NON_OPERAND_COMMANDS = /* @__PURE__ */ new Set([
  ...Object.keys(RELATION_COMMANDS),
  "text",
  "nonumber",
  "notag",
  "label",
  "tag",
  "hline",
  "cline"
]);
var EOF_TOKEN = { type: "eof", value: "", from: 0, to: 0 };
var Parser = class _Parser {
  pos = 0;
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
  isFnName(name) {
    if (this.opts.knownFns?.has(name)) return true;
    return DEFAULT_FUNCTIONS.has(name);
  }
  makeSym(accents, base, sub2, labelSup, span) {
    const prefix = accents.map((a) => `\\${a}`).join("");
    let name = prefix + base;
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
  applyScripts(base, accents, baseLatex) {
    let sub2 = null;
    let labelSup = null;
    let spanEnd = base.span.to;
    const scripts = [];
    if (this.kind() === "sub") {
      this.pos++;
      const s = this.readSubscript();
      sub2 = s.text;
      spanEnd = s.span.to;
    }
    while (this.kind() === "sup") {
      this.pos++;
      const sup = this.readSuperscript();
      const classified = classifySuperscript(sup.text);
      spanEnd = sup.span.to;
      if (classified.kind === "label") {
        labelSup = sup.text;
        continue;
      }
      scripts.push({ kind: classified.kind, text: classified.kind === "power" ? classified.powerText : void 0, to: sup.span.to });
    }
    let node = base;
    if (node.k === "sym") {
      node = this.makeSym(accents, baseLatex, sub2, labelSup, {
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
    let left = this.parseUnary();
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
        return true;
      case "cmd":
        return !NON_OPERAND_COMMANDS.has(t.value) && !["left", "right"].includes(t.value) && t.value !== "nonumber";
      case "csym":
        return t.value !== "'" && t.value !== "|";
      default:
        return false;
    }
  }
  parseUnary() {
    const t = this.cur;
    if (t.type === "op" && t.value === "-") {
      this.pos++;
      const arg = this.parseUnary();
      return { k: "op", op: "neg", args: [arg], span: { from: t.from, to: arg.span.to } };
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
          for (let i = 0; i < t.value.length; i++) {
            const ch = t.value[i];
            const sym2 = this.makeSym([], ch, null, null, { from: t.from + i, to: t.from + i + 1 });
            parts.push(i === t.value.length - 1 ? this.applyScripts(sym2, [], ch) : sym2);
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
        if (this.kind() === "lparen" && this.isFnName(t.value)) {
          const args = this.parseArgs();
          return { k: "call", fn: t.value, args, span: { from: t.from, to: args.at(-1)?.span.to ?? t.to } };
        }
        return scripted;
      }
      case "lparen": {
        this.pos++;
        const inner2 = this.parseExpression();
        const close = this.expect("rparen", ")");
        return { ...inner2, span: { from: inner2.span.from, to: close.to } };
      }
      case "lbrace": {
        return this.parseGroupAsExpression();
      }
      case "lbrack":
        return this.parseBareBracket();
      case "cmd":
        return this.parseCommand();
      case "csym":
        if (t.value === "|") return this.parseBars();
        if (t.value === "\\") {
          this.pos++;
          return { k: "raw", text: "line break", span: { from: t.from, to: t.to } };
        }
        break;
      case "begin":
        return this.parseMatrixEnv();
      default:
        break;
    }
    throw new ParseFailure(`unexpected ${describeToken(t)}`, { from: t.from, to: t.to });
  }
  parseGroupAsExpression() {
    const open = this.expect("lbrace", "{");
    const inner2 = this.parseExpression();
    const close = this.expect("rbrace", "}");
    return { ...inner2, span: { from: open.from, to: close.to } };
  }
  parseBareBracket() {
    const open = this.expect("lbrack", "[");
    const inner2 = this.parseExpression();
    const close = this.expect("rbrack", "]");
    return { ...inner2, span: { from: open.from, to: close.to } };
  }
  parseArgs() {
    this.expect("lparen", "(");
    const args = [];
    if (this.kind() !== "rparen") {
      for (; ; ) {
        args.push(this.parseExpression());
        if (this.kind() === "comma" || this.kind() === "semi") {
          this.pos++;
          continue;
        }
        break;
      }
    }
    this.expect("rparen", ")");
    return args;
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
        if (this.kind() === "lbrack") {
          this.pos++;
          this.parseExpression();
          this.expect("rbrack", "]");
        }
        const arg = this.kind() === "lbrace" ? this.parseGroupAsExpression() : this.parsePrimary();
        return { k: "call", fn: "sqrt", args: [arg], span: { from: t.from, to: arg.span.to } };
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
          this.expect("comma", ",");
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
        const g = this.rawGroupText();
        const text = g.text.trim();
        if (text === "d") {
          const arg = this.parsePrimary();
          return {
            k: "deriv",
            f: arg,
            wrt: [],
            order: 1,
            form: "diff",
            span: { from: t.from, to: arg.span.to }
          };
        }
        if (this.kind() === "lparen") {
          const args = this.parseArgs();
          return { k: "call", fn: text.toLowerCase(), args, span: { from: t.from, to: args.at(-1)?.span.to ?? t.to } };
        }
        const sym = this.makeSym([name], text, null, null, { from: t.from, to: g.span.to });
        const scripted = this.applyScripts(sym, [name], text);
        if (text.toLowerCase() === "e" || text.toLowerCase() === "var" || text.toLowerCase() === "cov") {
          if (this.kind() === "lbrack") {
            return this.finishExpectation({ from: t.from, to: g.span.to }, text.toLowerCase());
          }
          return scripted;
        }
        return scripted;
      }
      case "mathbb": {
        this.pos++;
        const g = this.rawGroupText();
        const base = g.text.trim();
        const sym = this.makeSym(["mathbb"], base, null, null, { from: t.from, to: g.span.to });
        if (base === "E" || base === "V") {
          return this.finishExpectation({ from: t.from, to: g.span.to }, base === "E" ? "E" : "Var");
        }
        return this.applyScripts(sym, ["mathbb"], base);
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
          const args = this.parseArgs();
          return {
            k: "call",
            fn: name === "sigma" ? "sigmoid" : name,
            args,
            span: { from: t.from, to: args.at(-1)?.span.to ?? t.to }
          };
        }
        if (this.kind() === "lbrace") {
          const arg = this.parseGroupAsExpression();
          return { k: "call", fn: name === "sigma" ? "sigmoid" : name, args: [arg], span: { from: t.from, to: arg.span.to } };
        }
        const nextKind = this.kind();
        if (nextKind === "ident" || nextKind === "cmd" && !NON_OPERAND_COMMANDS.has(this.cur.value)) {
          const arg = this.parsePrimary();
          return {
            k: "call",
            fn: name === "sigma" ? "sigmoid" : name,
            args: [arg],
            span: { from: t.from, to: arg.span.to }
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
      return this.applyScripts(sym, [], `\\${name}`);
    }
    if (ACCENTS.has(name)) {
      const accentSpan = { from: t.from, to: t.to };
      this.pos++;
      const base = this.parseAccentBase(name, accentSpan);
      if (base.k === "sym" && this.kind() === "lparen") {
        const density = base.name.match(/^\\mathcal([NU])$/);
        if (density) {
          const args = this.parseArgs();
          return {
            k: "call",
            fn: density[1] === "N" ? "normalDensity" : "uniformDensity",
            args,
            span: { from: base.span.from, to: args.at(-1)?.span.to ?? base.span.to }
          };
        }
      }
      return base;
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
    let i = 0;
    while (i < denTokens.length) {
      const t = denTokens[i];
      if (t.type === "cmd" && t.value === "partial") {
        i++;
        let nameEnd = i;
        let text = "";
        if (denTokens[i]?.type === "ident") {
          text = denTokens[i].value;
          nameEnd = i + 1;
        } else if (denTokens[i]?.type === "lbrace") {
          let depth = 1;
          let j = i + 1;
          while (j < denTokens.length && depth > 0) {
            if (denTokens[j].type === "lbrace") depth++;
            if (denTokens[j].type === "rbrace") {
              depth--;
              if (depth === 0) break;
            }
            j++;
          }
          text = renderTokens(denTokens.slice(i + 1, j));
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
        i = k;
        continue;
      }
      i++;
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
          args.push(this.parseExpression());
          if (this.kind() === "comma") {
            this.pos++;
            continue;
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
      const g = this.rawGroupText();
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
      const g = this.rawGroupText();
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
      row.push(this.parseExpression());
      if (this.kind() === "amp" || this.kind() === "nl") continue;
      if (this.kind() === "end" || this.kind() === "eof") break;
      break;
    }
    if (row.length) rows.push(row);
    const endTok = this.kind() === "end" ? this.cur : null;
    if (endTok) this.pos++;
    const span = { from: t.from, to: endTok ? endTok.to : t.to };
    void env;
    return { k: "block", rows, span };
  }
  parseBars() {
    const open = this.cur;
    this.pos++;
    const inner2 = this.parseExpression();
    const close = this.cur;
    if (close.type === "csym" && close.value === "|") {
      this.pos++;
      return { k: "op", op: "abs", args: [inner2], span: { from: open.from, to: close.to } };
    }
    return { k: "raw", text: "unbalanced |", span: { from: open.from, to: inner2.span.to } };
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
  if (/^\d+$/.test(s)) return { kind: "power", powerText: s };
  return { kind: "label" };
}
function findRelations(tokens) {
  const out = [];
  let depth = 0;
  let inText = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "lbrace") {
      depth++;
      continue;
    }
    if (t.type === "rbrace") {
      depth--;
      continue;
    }
    if (t.type === "cmd" && t.value === "text") {
      inText = 1;
      continue;
    }
    if (inText) {
      const kind = t.type;
      if (kind === "lbrace") inText++;
      else if (kind === "rbrace") inText--;
      continue;
    }
    if (depth > 0) continue;
    if (t.type === "op" && t.value === "=") {
      out.push({ index: i, relation: "=", text: "=", length: 1 });
      continue;
    }
    if (t.type === "op" && t.value === ":" && tokens[i + 1]?.type === "op" && tokens[i + 1]?.value === "=") {
      out.push({ index: i, relation: ":=", text: ":=", length: 2 });
      i++;
      continue;
    }
    if (t.type === "op" && t.value === "<") {
      out.push({ index: i, relation: "lt", text: "<", length: 1 });
      continue;
    }
    if (t.type === "op" && t.value === ">") {
      out.push({ index: i, relation: "gt", text: ">", length: 1 });
      continue;
    }
    if (t.type === "cmd") {
      const rel = RELATION_COMMANDS[t.value];
      if (rel) out.push({ index: i, relation: rel, text: `\\${t.value}`, length: 1 });
    }
  }
  return out;
}
function parseRow(_src, rowText, offset, index, knownFns) {
  let tokens = tokenize(rowText);
  const annotation = extractAnnotation(tokens);
  tokens = stripAnnotation(tokens);
  const rels = findRelations(tokens);
  if (rels.length === 0) {
    return {
      index,
      span: { from: offset, to: offset + rowText.length },
      parts: [],
      annotation,
      prose: true
    };
  }
  const parts = [];
  const impIndex = rels.findIndex((r) => r.relation === "=>" || r.relation === "<=>");
  if (impIndex >= 0) {
    const imp = rels[impIndex];
    const premiseTokens = tokens.slice(0, imp.index);
    const conclusionTokens = tokens.slice(imp.index + imp.length);
    const premise = splitAssertion(premiseTokens, knownFns);
    const conclusion = splitAssertion(conclusionTokens, knownFns);
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
  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i];
    const lhsSeg = i === 0 ? tokens.slice(bounds[0], bounds[1]) : [];
    const rhsSeg = tokens.slice(bounds[2 * i + 2], bounds[2 * i + 3]);
    const lhs = (lhsSeg.length ? parseNode(lhsSeg, knownFns) : null) ?? void 0;
    const rhs = (rhsSeg.length ? parseNode(rhsSeg, knownFns) : null) ?? void 0;
    parts.push({
      lhs,
      relation: rel.relation,
      relText: rel.text,
      rhs,
      span: { from: offset, to: offset + rowText.length },
      lhsSpan: lhs?.span,
      rhsSpan: rhs?.span
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
  try {
    return parser.parseExpression();
  } catch {
    return null;
  }
}
function extractAnnotation(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === "cmd" && tokens[i].value === "text") {
      const next = tokens[i + 1];
      if (next && next.type === "lbrace") {
        let depth = 1;
        let j = i + 2;
        while (j < tokens.length && depth > 0) {
          const kind = tokens[j].type;
          if (kind === "lbrace") depth++;
          if (kind === "rbrace") {
            depth--;
            if (depth === 0) break;
          }
          j++;
        }
        return renderTokens(tokens.slice(i + 2, j)).trim();
      }
    }
  }
  return void 0;
}
function stripAnnotation(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === "cmd" && tokens[i].value === "text") {
      return tokens.slice(0, i);
    }
  }
  return tokens;
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
function splitRows(src) {
  const rows = [];
  const prose = [];
  let i = 0;
  const len = src.length;
  const flushProse = (text) => {
    const t = text.trim();
    if (t) prose.push(t);
  };
  while (i < len) {
    const beginIdx = src.indexOf("\\begin{", i);
    const dollarIdx = src.indexOf("$$", i);
    const bracketIdx = src.indexOf("\\[", i);
    const candidates = [beginIdx, dollarIdx, bracketIdx].filter((v) => v >= 0);
    if (!candidates.length) {
      flushProse(src.slice(i));
      break;
    }
    const next = Math.min(...candidates);
    flushProse(src.slice(i, next));
    if (next === beginIdx) {
      const env = readEnvName(src, beginIdx + 6);
      if (!env) {
        flushProse(src.slice(next, next + 7));
        i = next + 7;
        continue;
      }
      const envName = env.name;
      const endIdx = findEnvEnd(src, beginIdx, envName);
      const contentStart2 = env.next;
      const contentEnd2 = endIdx >= 0 ? endIdx : len;
      if (MATH_ENVS.has(envName)) {
        rows.push(...splitMathContent(src, contentStart2, contentEnd2, `${envName}@${beginIdx}`));
      } else {
        flushProse(src.slice(contentStart2, contentEnd2));
      }
      i = endIdx >= 0 ? endIdx + 1 : len;
      continue;
    }
    if (next === dollarIdx) {
      const end2 = src.indexOf("$$", dollarIdx + 2);
      const contentStart2 = dollarIdx + 2;
      const contentEnd2 = end2 >= 0 ? end2 : len;
      rows.push(...splitMathContent(src, contentStart2, contentEnd2, `$$@${dollarIdx}`));
      i = end2 >= 0 ? end2 + 2 : len;
      continue;
    }
    const end = src.indexOf("\\]", bracketIdx + 2);
    const contentStart = bracketIdx + 2;
    const contentEnd = end >= 0 ? end : len;
    rows.push(...splitMathContent(src, contentStart, contentEnd, `\\[@${bracketIdx}`));
    i = end >= 0 ? end + 2 : len;
  }
  if (!rows.length) {
    let offset = 0;
    for (const line of src.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("%") && !trimmed.startsWith("\\begin{") && !trimmed.startsWith("\\end{")) {
        const from = offset + line.indexOf(trimmed);
        rows.push({ text: cleanRow(line), from, to: from + trimmed.length, where: "line" });
      }
      offset += line.length + 1;
    }
  }
  return rows;
}
function readEnvName(src, i) {
  if (src[i] !== "{") return null;
  const end = src.indexOf("}", i);
  if (end < 0) return null;
  return { name: src.slice(i + 1, end), next: end + 1 };
}
function findEnvEnd(src, start, envName) {
  let depth = 1;
  let i = start + 1;
  const open = `\\begin{${envName}}`;
  const close = `\\end{${envName}}`;
  while (i < src.length) {
    const openIdx = src.indexOf(open, i);
    const closeIdx = src.indexOf(close, i);
    if (closeIdx < 0) return -1;
    if (openIdx >= 0 && openIdx < closeIdx) {
      depth++;
      i = openIdx + open.length;
      continue;
    }
    depth--;
    if (depth === 0) return closeIdx;
    i = closeIdx + close.length;
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
  for (let i = 0; i < content.length; i++) {
    const ch = chars[i];
    if (ch === "\\") {
      const next = chars.slice(i, i + 8).join("");
      if (next.startsWith("\\begin{")) {
        envDepth++;
        i += 7;
        continue;
      }
      if (next.startsWith("\\end{")) {
        envDepth = Math.max(0, envDepth - 1);
        i += 5;
        continue;
      }
      if (next.startsWith("\\\\")) {
        if (braceDepth === 0 && envDepth === 0) {
          const seg2 = chars.slice(rowStart, i).join("");
          pushRow(rows, seg2, from + rowStart, where);
          rowStart = i + 2;
          i += 1;
          continue;
        }
        i += 1;
        continue;
      }
      if (next.startsWith("\\label{") || next.startsWith("\\tag{")) {
        const end = content.indexOf("}", i);
        if (end > 0) {
          for (let j = i; j < end; j++) chars[j] = " ";
          i = end;
          continue;
        }
      }
      i += 1;
      continue;
    }
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === "&" && braceDepth === 0 && envDepth === 0) {
      chars[i] = " ";
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
  return text.replace(/\\nonumber\b/g, "").replace(/\\notag\b/g, "").trim();
}

// src/core/decl.ts
var PROP_WORDS = {
  sym: "sym",
  symmetric: "sym",
  spd: "spd",
  psd: "psd",
  orth: "orth",
  orthogonal: "orth",
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
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0 && (ch === "\n" || ch === ";")) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    if (depth === 0 && ch === "," && looksLikeLatexList(text, i)) {
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
  const base = { name, display: toDisplay(name), source: "declared" };
  if (type === "scalar") return { ...base, kind: "scalar", props: [] };
  if (type === "pos") return { ...base, kind: "scalar", props: ["pos"] };
  if (type === "int") return { ...base, kind: "scalar", props: ["int"] };
  const fn = type.match(/^fn\s*(.+?)\s*(?:->|→)\s*(.+)$/);
  if (fn) {
    return {
      ...base,
      kind: "function",
      dom: parseDims(fn[1]),
      cod: parseDim(fn[2]) ?? void 0,
      props: []
    };
  }
  const words = type.split(/\s+/);
  const props = [];
  const dims = [];
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (w === "rank") {
      const k = parseDim(words[++i] ?? "");
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
  const rest = words.slice(i).join(" ");
  const dimText2 = rest.replace(/[x×]/g, "\xD7");
  const parts = dimText2.split("\xD7").map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const d = parseDim(p);
    if (d === null) return null;
    dims.push(d);
  }
  if (!dims.length) {
    if (!props.length) return null;
    return { ...base, kind: "matrix", props };
  }
  if (dims.length === 1) {
    const matrixish = props.some(
      (p) => typeof p === "string" && ["sym", "spd", "psd", "orth", "diag", "triu", "tril", "skew", "idem", "proj", "stoch"].includes(p)
    );
    return {
      ...base,
      kind: matrixish ? "matrix" : "vector",
      rows: dims[0],
      cols: matrixish ? dims[0] : 1,
      props
    };
  }
  return {
    ...base,
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
      const rows = node.rows.length || 1;
      const cols = node.rows[0]?.length ?? 1;
      for (const row of node.rows) for (const cell of row) inferType(ctx, cell);
      return { t: "mat", r: rows, c: cols };
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
      assumption: `${name} is the symbol that was defined earlier`
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
  const base = baseLetter(name);
  const guess = guessType(ctx, name, base);
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
function guessType(ctx, name, base) {
  if (base === "I" && !name.includes("_")) {
    return {
      ty: { t: "mat", r: freshDim(ctx), c: freshDim(ctx) },
      props: ["ident"],
      assumption: "I is the identity matrix"
    };
  }
  if (base === "0" && !name.includes("_")) {
    return {
      ty: { t: "mat", r: freshDim(ctx), c: freshDim(ctx) },
      props: ["zero"],
      assumption: "0 is the zero matrix"
    };
  }
  if (name === "\\mathbf{1}" || name === "\\mathbf1" || base === "\\mathbf1") {
    return {
      ty: { t: "mat", r: freshDim(ctx), c: freshDim(ctx) },
      props: ["ones"],
      assumption: "the ones vector"
    };
  }
  if (CONSTANTS.has(name) || CONSTANTS.has(base)) {
    if (!name.includes("_")) {
      return { ty: { t: "scalar" }, props: [], assumption: `${name} is a constant` };
    }
  }
  if (/^[nmdkNTTP]$/.test(base) && !name.includes("_")) {
    return { ty: { t: "scalar" }, props: [], assumption: `${name} is a size` };
  }
  if (/^[ijk]$/.test(base) && ctx.bound.has(base)) {
    return { ty: { t: "scalar" }, props: [], assumption: `${name} is an index` };
  }
  const isGreek = GREEK.has(base) || /\\[a-zA-Z]+$/.test(name);
  const isCapital = /^[A-Z]/.test(base);
  if (isGreek || isCapital) {
    const props = [];
    if (base === "Sigma" || base === "Lambda" || base === "\\Sigma" || base === "\\Lambda") props.push("sym");
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
        unifyDim(ctx, a.r, b.r, "in a quotient", node.span);
        unifyDim(ctx, a.c, b.c, "in a quotient", node.span);
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
      ctx.errors.push({ message: `unknown function ${fn}`, span });
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
  if (f.t === "scalar") {
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
        case "adj":
          return args[0];
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
      return ZERO_DEG;
    }
    case "deriv":
      return ZERO_DEG;
    case "expect":
      return ZERO_DEG;
    case "bigop":
      return degreeOf(ctx, node.body, sizes, defs);
    case "block":
      return ZERO_DEG;
    case "raw":
      return ZERO_DEG;
  }
}
function isConstantSymbol(name) {
  return name === "e" || name === "\\pi" || name === "pi";
}
function recipeDegree(ctx, name, props, sizes) {
  const has = (p) => props.some((x) => typeof x === "string" ? x === p : false);
  const info = ctx.symbols.get(name);
  const size = info && isMatrix(info.ty) ? dimSize(ctx, info.ty.r, sizes) : 3;
  if (has("orth")) return { n: size, d: size };
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
  const out = [];
  for (const declared of ctx.dimVars) {
    const root = ctx.dims.find(declared);
    if (roots.has(root) && !out.includes(root)) out.push(root);
  }
  for (const root of roots) {
    if (!out.includes(root) && !root.startsWith("#")) out.push(root);
  }
  return out;
}

// src/core/verdict.ts
var ENGINE_VERSION = "1.0.0";
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
function check(src, opts = {}) {
  const started = now();
  const seed = opts.seed ?? DEFAULT_SEED;
  const trials = opts.trials ?? 3;
  const rows = splitRows(src);
  const declared = parseDeclarations(opts.decls ?? "");
  const preset = presetDecls(opts.preset);
  const decls = mergeDecls(preset, declared.decls);
  const ctx = createContext(decls, opts.layout ?? "denominator");
  const chips = [];
  const diagnostics = [];
  const definedNames = /* @__PURE__ */ new Set();
  const knownFns = new Set(decls.filter((d) => d.kind === "function").map((d) => d.name));
  const steps = [];
  let previousRhs;
  let rowIndex = 0;
  for (const row of rows) {
    const parsed = parseRow(src, row.text, row.from, rowIndex, knownFns);
    rowIndex++;
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
      const isDefinition = part.relation === ":=" || bareLhs !== void 0 && !definedNames.has(bareLhs) && !isFunctionName(ctx, bareLhs);
      steps.push({
        id: `s${steps.length}`,
        row: rowIndex,
        span: part.span,
        text: row.text,
        lhs,
        rhs,
        relation: part.relation === ":=" ? "defined" : part.relation,
        annotation: parsed.annotation,
        isDefinition,
        defName: isDefinition ? bareLhs : void 0,
        symbols
      });
      previousRhs = rhs;
      if (bareLhs && isDefinition) definedNames.add(bareLhs);
    }
  }
  const defs = /* @__PURE__ */ new Map();
  const results = [];
  for (const step of steps) {
    if (step.isDefinition && step.defName && step.rhs) {
      defs.set(step.defName, step.rhs);
      ctx.defs.set(step.defName, step.rhs);
    }
    const result = checkStep(step, ctx, defs, { seed, trials, budgetMs: opts.budgetMs ?? 500 }, diagnostics);
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
  const index = new Map(out.map((d, i) => [d.name, i]));
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
  const base = {
    trialsPerSize: opts.trials,
    sizes: [],
    assumptions: [],
    seed: opts.seed
  };
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
      card: base,
      message: step.defName ? `defined: ${step.defName}` : "defined",
      isDefinition: true,
      annotation: step.annotation
    };
  }
  if (step.relation === "=>" || step.relation === "<=>") {
    return checkImplication(step, ctx, defs, opts, base);
  }
  if (step.relation !== "=") {
    const message = unsupportedRelation(step.relation);
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: step.relation,
      verdict: "unchecked",
      card: base,
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
      card: base,
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  const lhsTy = inferType(ctx, step.lhs);
  const rhsTy = inferType(ctx, step.rhs);
  if (lhsTy.t === "mat" && rhsTy.t === "mat") {
    unifyShapes(ctx, lhsTy, rhsTy, step.span);
  }
  const shapeErrors = ctx.errors.splice(0, ctx.errors.length);
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
      card: base,
      message: shapeErrors[0].message,
      reason: shapeErrors.map((e) => e.message).join("; "),
      annotation: step.annotation
    };
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
      card: base,
      message,
      reason: message,
      annotation: step.annotation
    };
  }
  if (mode === "exact") return checkExact(step, ctx, defs, opts, base);
  return checkNumeric(step, ctx, defs, opts, base);
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
    case "op":
      return node.args.every((a) => isRational(a, ctx, defs, seen));
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
  let worstBound = 0;
  let worstDegree = 0;
  const working = [];
  const sizes = [];
  const assumptions = collectAssumptions(ctx, step);
  for (const setting of settings) {
    let usable = false;
    for (let trial = 0; trial < opts.trials; trial++) {
      for (const p of primes) {
        const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, p);
        const outcome = runExactTrial(step, ctx, defs, setting, p, rng);
        if (outcome.kind === "ok") {
          usable = true;
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
            relation: step.relation,
            verdict: "unchecked",
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
    if (usable) working.push(setting);
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
  for (const setting of working) {
    sizes.push(Object.fromEntries(setting));
    const dl = degreeOf(ctx, step.lhs, setting, defs);
    const dr = degreeOf(ctx, step.rhs, setting, defs);
    const d = Math.max(dl.n + dr.d, dr.n + dl.d);
    worstDegree = Math.max(worstDegree, d);
    const bound = Math.pow(d / P1, opts.trials) * Math.pow(d / P2, opts.trials);
    worstBound = Math.max(worstBound, bound);
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
    card: { ...card, sizes, primes, degree: worstDegree, bound: worstBound, assumptions },
    message: "holds at every size tested",
    annotation: step.annotation
  };
}
function runExactTrial(step, ctx, defs, setting, p, rng) {
  const field = new GFpField(p);
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free);
  if (sampled === "unknown") {
    return { kind: "unknown", message: "SAMOSA could not sample an instance of these objects" };
  }
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);
  const sides = evaluateSides(field, step, env, sampler);
  if (sides.kind === "unknown") return { kind: "unknown", message: sides.message, domain: sides.domain };
  if (sides.kind === "equal") return { kind: "ok" };
  return {
    kind: "wrong",
    message: sides.message,
    layoutHint: sides.layoutHint,
    counterexample: buildCounterexample(ctx, step, setting, sampled.values, sides.lhs, sides.rhs, field)
  };
}
function evaluateSides(field, step, env, sampler) {
  const derivNode = step.lhs && step.lhs.k === "deriv" ? step.lhs : void 0;
  try {
    if (derivNode) {
      return compareDerivative(field, derivNode, step.rhs, env, sampler);
    }
    const lhs = evalNode(field, step.lhs, env);
    const rhs = evalNode(field, step.rhs, env);
    if (valuesEqual(field, lhs, rhs)) return { kind: "equal" };
    return { kind: "different", lhs, rhs, message: "the two sides are not equal" };
  } catch (error) {
    if (error instanceof EvalError) {
      const domain = /singular|non square|domain/i.test(error.message);
      return { kind: "unknown", message: error.message, domain };
    }
    if (error instanceof DomainError) {
      return { kind: "unknown", message: error.message, domain: true };
    }
    return { kind: "unknown", message: String(error) };
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
      if (mixedScalar !== null && field.eq(value, mixedScalar)) return { kind: "equal" };
      return {
        kind: "different",
        lhs: mixed,
        rhs: claimedVal2,
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
          lhs: tangent,
          rhs: claimedVal,
          message: "this is the numerator layout gradient; SAMOSA uses the denominator layout",
          layoutHint: "The gradient has the shape of the variable it is taken with respect to. Transpose it."
        };
      }
    }
    return {
      kind: "different",
      lhs: tangent,
      rhs: claimedVal,
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
  if (isMatrixVal(tangent) && isMatrixVal(claimedVal)) {
    const product = matMul(field, claimedVal.m, direction.m);
    if (product.r === tangent.m.r && product.c === tangent.m.c) {
      let same2 = true;
      for (let i = 0; i < product.d.length; i++) {
        if (!fieldClose(field, product.d[i], tangent.m.d[i])) {
          same2 = false;
          break;
        }
      }
      if (same2) return { kind: "equal" };
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
  for (let i = 0; i < g.r; i++) {
    for (let j = 0; j < g.c; j++) {
      sum2 = field.add(sum2, field.mul(g.d[i * g.c + j], v.d[i * v.c + j]));
    }
  }
  return sum2;
}
function quadraticForm(field, v, h, w) {
  let sum2 = field.zero;
  for (let i = 0; i < v.r; i++) {
    for (let j = 0; j < h.c; j++) {
      sum2 = field.add(
        sum2,
        field.mul(field.mul(v.d[i * v.c], h.d[i * h.c + j]), w.d[j * w.c])
      );
    }
  }
  return sum2;
}
function transposeMat(m) {
  const d = new Array(m.r * m.c);
  for (let i = 0; i < m.r; i++) for (let j = 0; j < m.c; j++) d[j * m.r + i] = m.d[i * m.c + j];
  return { r: m.c, c: m.r, d };
}
function isFunctionName(ctx, name) {
  const decl = ctx.decls.get(name);
  return decl?.kind === "function";
}
function fieldClose(field, a, b) {
  if (field instanceof GFpField) return field.eq(a, b);
  const x = field.toNumber(a);
  const y = field.toNumber(b);
  const scale = Math.max(1, Math.abs(x), Math.abs(y));
  return Math.abs(x - y) <= 1e-12 * scale;
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
  if (lhs.k === "sym") return lhs.name;
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
function sampleFor(ctx, step, defs, setting, sampler, free = /* @__PURE__ */ new Set()) {
  const values = /* @__PURE__ */ new Map();
  const quad = /* @__PURE__ */ new Map();
  const names = /* @__PURE__ */ new Set();
  for (const node of stepNodes(step)) collectSymbols(node, names);
  for (const name of [...names]) {
    const def = defs.get(name);
    if (def) collectSymbols(def, names);
  }
  for (const name of names) {
    if (defs.has(name) && !free.has(name)) continue;
    if (values.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
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
      values.set(name, scalar(sampler.sampleScalar()));
      continue;
    }
    if (info.ty.t !== "mat") continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const val = sampler.sample({ name, r, c, props: info.props });
      if (!val) continue;
      if (val.k === "m" && isSingular(sampler.field, val.m)) continue;
      values.set(name, val);
      placed = true;
      break;
    }
    if (!placed) return "unknown";
  }
  return { values, quad };
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
    for (let i = 0; i < a.m.d.length; i++) if (!field.eq(a.m.d[i], b.m.d[i])) return false;
    return true;
  }
  return false;
}
function checkNumeric(step, ctx, defs, opts, card) {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const sizes = [];
  const assumptions = collectAssumptions(ctx, step);
  let maxDelta = 0;
  const dec = new DecField(50);
  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting));
    for (let trial = 0; trial < 3; trial++) {
      const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, "f64");
      const delta = numericDelta(ctx, defs, step, setting, rng, new F64Field());
      if (delta === null) {
        const message2 = "SAMOSA could not evaluate this step over the reals";
        return {
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
        };
      }
      maxDelta = Math.max(maxDelta, delta);
      if (delta > 1e-6) {
        let confirmed = false;
        for (let k = 0; k < 3 && !confirmed; k++) {
          const rng2 = rngFor(opts.seed, step.id, settingKey(setting), trial, "dec", k);
          const d2 = numericDelta(ctx, defs, step, setting, rng2, dec);
          if (d2 !== null && d2 > 1e-20) confirmed = true;
        }
        const message2 = confirmed ? "the two sides differ" : "the two sides differ, but not enough to call it wrong";
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          lhsSpan: step.lhs?.span,
          rhsSpan: step.rhs?.span,
          relation: step.relation,
          verdict: confirmed ? "wrong" : "inconclusive",
          mode: "numeric",
          card: { ...card, sizes, maxDelta, assumptions },
          message: message2,
          reason: message2,
          annotation: step.annotation
        };
      }
    }
  }
  for (const setting of settings) {
    const rng = rngFor(opts.seed, step.id, settingKey(setting), "dec");
    const delta = numericDelta(ctx, defs, step, setting, rng, dec);
    if (delta === null) {
      const message2 = "SAMOSA could not evaluate this step at 50 digits";
      return {
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
      };
    }
    maxDelta = Math.max(maxDelta, delta);
  }
  if (maxDelta < 1e-35) {
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
      card: { ...card, sizes, maxDelta, assumptions },
      message: "the two sides agree to 50 digits",
      annotation: step.annotation
    };
  }
  const message = "the two sides agree, but not to 50 digits";
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    relation: step.relation,
    verdict: "inconclusive",
    mode: "numeric",
    card: { ...card, sizes, maxDelta, assumptions },
    message,
    reason: message,
    annotation: step.annotation
  };
}
function numericDelta(ctx, defs, step, setting, rng, field) {
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free);
  if (sampled === "unknown") return null;
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);
  const sides = evaluateSides(field, step, env, sampler);
  if (sides.kind === "unknown") return null;
  if (sides.kind === "equal") return 0;
  return relativeDelta(field, sides.lhs, sides.rhs);
}
function relativeDelta(field, a, b) {
  const flat = (v) => v.k === "s" ? [field.toNumber(v.v)] : v.m.d.map((x) => field.toNumber(x));
  const fa = flat(a);
  const fb = flat(b);
  if (fa.length !== fb.length) return Number.POSITIVE_INFINITY;
  let diff = 0;
  let scale = 0;
  for (let i = 0; i < fa.length; i++) {
    diff = Math.max(diff, Math.abs(fa[i] - fb[i]));
    scale = Math.max(scale, Math.abs(fa[i]), Math.abs(fb[i]));
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
    dimVars.forEach((v, i) => m.set(v, cycle[(i + shift) % cycle.length]));
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
    if (props.length) out.add(`${name} is ${props.join(" and ")}`);
  }
  if (!out.size) out.add("every symbol was declared");
  return [...out];
}
var PROP_WORDS2 = {
  sym: "symmetric",
  spd: "symmetric positive definite",
  psd: "symmetric positive semi definite",
  orth: "orthogonal",
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
  const values = {};
  for (const [name, val] of sampled) {
    values[name] = val.k === "s" ? val.v : val.m.d;
  }
  const lhsVal = lhs.k === "s" ? lhs.v : lhs.m.d;
  const rhsVal = rhs.k === "s" ? rhs.v : rhs.m.d;
  const diff = lhs.k === "s" && rhs.k === "s" ? field.sub(lhs.v, rhs.v) : lhs.k === "m" && rhs.k === "m" ? lhs.m.d.map((x, i) => field.sub(x, rhs.m.d[i])) : null;
  return { dims, values, lhs: lhsVal, rhs: rhsVal, diff, numpy: "" };
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
            relation: step.relation,
            verdict: "unchecked",
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
  const residual = (x) => {
    const trialEnv = { ...env, values: new Map(env.values), memo: /* @__PURE__ */ new Map() };
    trialEnv.values.set(pivot, { k: "m", m: x });
    try {
      if (premise.lhs?.k === "deriv") {
        const grad = gradientAt(field, premise.lhs, trialEnv, pivot, x, n);
        if (!grad) return null;
        const rhs = premise.rhs ? evalNode(field, premise.rhs, trialEnv) : scalar(field.zero);
        const rhsScalar = asScalar(field, rhs);
        if (rhsScalar === null) return null;
        return {
          r: grad.r,
          c: grad.c,
          d: grad.d.map((x2) => field.sub(x2, rhsScalar))
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
  if (!second.d.every((x) => field.isZero(x))) {
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
    for (let i = 0; i < rows; i++) jac.d[i * n + j] = field.sub(rj.d[i * cols], r0.d[i * cols]);
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
  for (let i = 0; i < n; i++) {
    const e = { r: n, c: 1, d: new Array(n).fill(field.zero) };
    e.d[i] = field.one;
    const tangent = directionalDerivative(field, def, env, pivotName, { k: "m", m: baseValue }, { k: "m", m: e });
    const value = asScalar(field, tangent);
    if (value === null) return null;
    g.d[i] = value;
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
  for (let i = 0; i < d.length; i++) d[i] = field.add(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}
function subMat(field, a, b) {
  const d = new Array(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = field.sub(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}
function secondDirectional(field, residual, x, dir) {
  const plus = residual(addMat(field, x, dir));
  const minus = residual(subMat(field, x, dir));
  const centre = residual(x);
  if (!plus || !minus || !centre) return null;
  const d = new Array(plus.d.length);
  const two = field.fromRational(2, 1);
  for (let i = 0; i < d.length; i++) {
    d[i] = field.sub(field.add(plus.d[i], minus.d[i]), field.mul(two, centre.d[i]));
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
  let base = name;
  let sub2 = "";
  let sup = "";
  if (subIndex >= 0 && (supIndex < 0 || subIndex < supIndex)) {
    base = name.slice(0, subIndex);
    const rest = name.slice(subIndex + 1);
    if (supIndex > subIndex) {
      sub2 = rest.slice(0, supIndex - subIndex - 1);
      sup = rest.slice(supIndex - subIndex);
    } else {
      sub2 = rest;
    }
  } else if (supIndex >= 0) {
    base = name.slice(0, supIndex);
    sup = name.slice(supIndex);
  }
  let out = base;
  if (sub2) out += sub2.length === 1 ? `_${sub2}` : `_{${sub2}}`;
  if (sup) out += sup.length === 1 ? `^${sup}` : `^{${sup}}`;
  return out;
}
function renderOp(node) {
  const a = node.args.map(renderNode);
  switch (node.op) {
    case "add":
      return `${a[0]} + ${a[1]}`;
    case "sub":
      return `${a[0]} - ${a[1]}`;
    case "neg":
      return `-${a[0]}`;
    case "mul":
      return `${a[0]} ${a[1]}`;
    case "div":
      return `\\frac{${a[0]}}{${a[1]}}`;
    case "pow":
      return `{${a[0]}}^{${a[1]}}`;
    case "inv":
      return `{${a[0]}}^{-1}`;
    case "invT":
      return `{${a[0]}}^{-\\top}`;
    case "T":
      return `{${a[0]}}^\\top`;
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

// src/core/shrink.ts
function shrinkCounterexample(ctx, lhs, rhs, defs, sizes, seed, budgetMs = 200) {
  const started = Date.now();
  const names = [...ctx.symbols.keys()].filter((name) => {
    const info = ctx.symbols.get(name);
    return info && info.ty.t === "mat";
  });
  const shrinkCtx = {
    ctx,
    lhs,
    rhs,
    defs,
    symbolNames: names,
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
  for (const name of names) {
    const info = ctx.symbols.get(name);
    if (!info || info.ty.t !== "mat") continue;
    const r = dimSizeOf(ctx, info.ty.r, sizes);
    const c = dimSizeOf(ctx, info.ty.c, sizes);
    const val = sampler.sample({ name, r, c, props: info.props });
    if (val && val.k === "m") values.set(name, val);
  }
  for (const [name, value] of values.entries()) env.values.set(name, value);
  try {
    const l = evalNode(field, lhs, env);
    const r = evalNode(field, rhs, env);
    if (!equal(field, l, r)) {
      return describe(ctx, sizes, values, l, r, field);
    }
  } catch {
  }
  return null;
}
function searchSmallIntegers(sh, range, seed) {
  const field = new GFpField(2147483647);
  const rng = rngFor(seed, "small", range);
  const { ctx, sizes } = sh;
  for (let attempt = 0; attempt < 40; attempt++) {
    const values = /* @__PURE__ */ new Map();
    for (const name of sh.symbolNames) {
      const info = ctx.symbols.get(name);
      if (!info || info.ty.t !== "mat") continue;
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
      return describe(ctx, sizes, values, l, r, field);
    } catch {
      continue;
    }
  }
  return null;
}
function smallMatrix(field, r, c, props, rng, range) {
  const has = (p) => props.some((x) => x === p);
  const entry = () => {
    const v = Math.floor(rng() * (2 * range + 1)) - range;
    return field.mod(v);
  };
  const d = new Array(r * c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (has("sym") || has("spd") || has("psd")) {
        d[i * c + j] = i <= j ? d[j * c + i] ?? entry() : d[j * c + i];
      } else if (has("skew")) {
        d[i * c + j] = i === j ? 0 : i < j ? entry() : field.neg(d[j * c + i]);
      } else if (has("diag")) {
        d[i * c + j] = i === j ? entry() : 0;
      } else if (has("ident")) {
        d[i * c + j] = i === j ? 1 : 0;
      } else if (has("zero")) {
        d[i * c + j] = 0;
      } else if (has("ones")) {
        d[i * c + j] = 1;
      } else {
        d[i * c + j] = entry();
      }
    }
  }
  const m = { r, c, d };
  if ((has("spd") || has("psd")) && r === c) {
    for (let i = 0; i < r; i++) {
      d[i * c + i] = field.add(d[i * c + i], Math.max(1, r));
      for (let j = 0; j < i; j++) d[i * c + j] = d[j * c + i];
    }
  }
  if (r === c && (has("orth") || has("idem") || has("proj"))) return null;
  return m;
}
function equal(field, a, b) {
  if (a.k === "s" && b.k === "s") return field.eq(a.v, b.v);
  if (a.k === "m" && b.k === "m") {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return false;
    for (let i = 0; i < a.m.d.length; i++) if (!field.eq(a.m.d[i], b.m.d[i])) return false;
    return true;
  }
  return false;
}
function describe(_ctx, sizes, values, lhs, rhs, field) {
  const dims = {};
  for (const [k, v] of sizes) dims[k] = v;
  const signed = (x) => {
    const p = 2147483647;
    return x > p / 2 ? x - p : x;
  };
  const plain = {};
  for (const [name, val] of values) {
    plain[name] = val.k === "s" ? signed(field.toNumber(val.v)) : val.m.d.map((x) => signed(field.toNumber(x)));
  }
  const lhsPlain = lhs.k === "s" ? signed(field.toNumber(lhs.v)) : lhs.m.d.map((x) => signed(field.toNumber(x)));
  const rhsPlain = rhs.k === "s" ? signed(field.toNumber(rhs.v)) : rhs.m.d.map((x) => signed(field.toNumber(x)));
  const diffPlain = lhs.k === "s" && rhs.k === "s" ? signed(field.toNumber(lhs.v) - field.toNumber(rhs.v)) : lhs.k === "m" && rhs.k === "m" ? lhs.m.d.map((x, i) => signed(field.toNumber(x) - field.toNumber(rhs.m.d[i]))) : 0;
  return {
    dims,
    values: plain,
    lhs: lhsPlain,
    rhs: rhsPlain,
    diff: diffPlain,
    numpy: toNumpy(plain, dims)
  };
}
function toNumpy(values, _dims) {
  const lines = ["import numpy as np"];
  const names = Object.keys(values);
  names.forEach((name, i) => {
    const v = values[name];
    const pyName = `s${i}`;
    if (typeof v === "number") {
      lines.push(`${pyName} = ${v}`);
    } else {
      const rows = [];
      const c = Math.max(1, Math.round(Math.sqrt(v.length)));
      for (let i2 = 0; i2 < v.length; i2 += c) {
        rows.push(`[${v.slice(i2, i2 + c).map((x) => Number(x.toFixed(6))).join(", ")}]`);
      }
      lines.push(`${pyName} = np.array([${rows.join(", ")}])`);
    }
  });
  lines.push("");
  lines.push("# the two sides of the step, with these values");
  lines.push("# lhs - rhs is not zero");
  return lines.join("\n");
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
  out.sort((a, b) => editSize(a) - editSize(b));
  return out.slice(0, 3);
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
  children.forEach((child, i) => out.push(...walk(child, [...path, i])));
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
    let i = 0;
    for (const row of rows) {
      out.push(flat.slice(i, i + row.length));
      i += row.length;
    }
    return { ...node, rows: out };
  }
  return node;
}
function mutationRepairs(sh) {
  const out = [];
  const candidates = walk(sh.rhs);
  let count = 0;
  for (const { node, path } of candidates) {
    if (count > CANDIDATE_LIMIT) break;
    for (const mutation of MUTATIONS) {
      if (count > CANDIDATE_LIMIT) break;
      const mutated = mutation.apply(node);
      if (!mutated) continue;
      count++;
      const candidate = replaceAt(sh.rhs, path, mutated);
      if (renderNode(candidate) === renderNode(sh.rhs)) continue;
      if (!holdsWith(sh, candidate)) continue;
      out.push({
        kind: "mutation",
        title: mutation.title,
        edit: { span: sh.rhs.span, insert: renderNode(candidate) },
        verified: true,
        detail: renderNode(candidate)
      });
    }
  }
  return out;
}
function holdsWith(sh, rhs) {
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
      const l = evalNode(field, sh.lhs, env);
      const r = evalNode(field, rhs, env);
      if (!same(field, l, r)) return false;
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
  for (const name of names) {
    if (sh.defs.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === "scalar") {
      values.set(name, { k: "s", v: sampler.sampleScalar() });
      continue;
    }
    if (info.ty.t !== "mat") continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    const val = sampler.sample({ name, r, c, props: info.props });
    if (!val) return null;
    values.set(name, val);
  }
  return values;
}
function same(field, a, b) {
  if (a.k === "s" && b.k === "s") return field.eq(a.v, b.v);
  if (a.k === "m" && b.k === "m") {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return false;
    for (let i = 0; i < a.m.d.length; i++) if (!field.eq(a.m.d[i], b.m.d[i])) return false;
    return true;
  }
  return false;
}
var ASSUMPTION_TRIES = [
  { props: ["sym"], text: "symmetric" },
  { props: ["orth"], text: "orthogonal" },
  { props: ["diag"], text: "diagonal" }
];
function assumptionRepairs(sh) {
  const out = [];
  const candidates = [...sh.ctx.symbols.values()].filter(
    (s) => s.ty.t === "mat" && s.props.length === 0 && s.source !== "preset"
  );
  for (const symbol of candidates) {
    for (const attempt of ASSUMPTION_TRIES) {
      if (holdsWithProps(sh, symbol.name, attempt.props)) {
        out.push({
          kind: "assumption",
          title: `holds if ${symbol.name} is ${attempt.text}`,
          addDecl: `${symbol.name}: ${attempt.props[0]} ${dimText(sh.ctx, symbol.name)}`,
          verified: true
        });
        return out;
      }
    }
  }
  return out;
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
  const ok = holdsWith(sh, sh.rhs);
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
  const diffs = [];
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
      const d = l.m.d.map((x, i) => field.sub(x, r.m.d[i]));
      diffs.push(d);
    } catch {
      return out;
    }
  }
  if (diffs.length < 2) return out;
  const terms = /* @__PURE__ */ new Map();
  for (const { node } of walk(sh.lhs).concat(walk(sh.rhs))) {
    if (node.k === "sym") {
      const sandwich = {
        k: "op",
        op: "mul",
        args: [
          { k: "op", op: "mul", args: [node, { k: "op", op: "T", args: [node], span: node.span }], span: node.span }
        ],
        span: node.span
      };
      terms.set(renderNode(sandwich), sandwich);
    }
  }
  for (const [text, term] of terms) {
    const scale = matchesScale(field, term, sh, diffs);
    if (scale === null) continue;
    out.push({
      kind: "residual",
      title: `this step is off by exactly ${scaleText(scale)} ${text}`,
      edit: { span: sh.rhs.span, insert: `${renderNode(sh.rhs)} + ${scaleText(scale)} ${text}` },
      verified: false,
      detail: text
    });
    if (out.length >= 3) break;
  }
  return out;
}
function matchesScale(field, term, sh, diffs) {
  const settings = sizeSettings(sh.dimVars);
  const rng = rngFor(sh.seed, "repair", "residual", "term");
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = sh.defs;
  const values = sampleSymbols(sh.ctx, sh, settings[0], sampler);
  if (!values) return null;
  for (const [name, value] of values.entries()) if (value) env.values.set(name, value);
  let termValues;
  try {
    const t = evalNode(field, term, env);
    if (t.k !== "m") return null;
    termValues = t.m.d;
  } catch {
    return null;
  }
  if (termValues.length !== diffs[0].length) return null;
  for (let a = -12; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      let ok = true;
      for (const diff of diffs) {
        for (let i = 0; i < diff.length; i++) {
          if (field.mul(field.fromRational(a, b), termValues[i]) !== diff[i]) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (ok) return a / b;
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
function explain(src, stepId, opts = {}) {
  const rows = splitRows(src);
  const declared = parseDeclarations(opts.decls ?? "");
  const preset = presetDecls(opts.preset);
  const decls = [...preset];
  const index = new Map(decls.map((d, i) => [d.name, i]));
  for (const d of declared.decls) {
    const at = index.get(d.name);
    if (at === void 0) {
      index.set(d.name, decls.length);
      decls.push(d);
    } else {
      decls[at] = d;
    }
  }
  const ctx = createContext(decls, opts.layout ?? "denominator");
  const defs = /* @__PURE__ */ new Map();
  const steps = [];
  let previousRhs;
  rows.forEach((row, rowIndex) => {
    const parsed = parseRow(src, row.text, row.from, rowIndex);
    if (parsed.prose || !parsed.parts.length) return;
    for (const part of parsed.parts) {
      if (part.relation === "=>" || part.relation === "<=>") {
        steps.push({
          id: `s${steps.length}`,
          lhs: part.conclusion?.lhs,
          rhs: part.conclusion?.rhs,
          relation: part.relation,
          defined: false
        });
        previousRhs = part.conclusion?.rhs;
        continue;
      }
      const lhs = part.lhs ?? previousRhs;
      const rhs = part.rhs;
      const bareLhs = lhs?.k === "sym" ? lhs.name : void 0;
      const isDefinition = part.relation === ":=" || bareLhs !== void 0 && !ctx.decls.has(bareLhs) && !defs.has(bareLhs);
      steps.push({
        id: `s${steps.length}`,
        lhs,
        rhs,
        relation: part.relation,
        defined: isDefinition
      });
      previousRhs = rhs;
      if (isDefinition && bareLhs && rhs) {
        defs.set(bareLhs, rhs);
        ctx.defs.set(bareLhs, rhs);
      }
    }
  });
  const step = steps.find((s) => s.id === stepId);
  if (!step || !step.lhs || !step.rhs) return { fixes: [] };
  inferType(ctx, step.lhs);
  inferType(ctx, step.rhs);
  const dimVars = collectDimVarsFor(ctx, step.lhs, step.rhs, defs);
  const sizes = /* @__PURE__ */ new Map();
  for (const v of dimVars) sizes.set(v, 3);
  const kind = step.relation === "=" ? "wrong" : "shape";
  const fixes = repairs(ctx, step.lhs, step.rhs, defs, opts.seed ?? 5910618, dimVars, kind);
  let counterexample;
  try {
    counterexample = shrinkCounterexample(ctx, step.lhs, step.rhs, defs, sizes, opts.seed ?? 5910618) ?? void 0;
  } catch {
    counterexample = void 0;
  }
  return { fixes, counterexample };
}

// mcp/server.ts
var VERSION = "1.0.0";
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
function shareUrl(source) {
  const json = JSON.stringify({ src: source });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${shareBase}/#v1.${base64}`;
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
    const structured = {
      summary: summarise(report),
      steps: report.steps.map((step) => ({
        row: step.row,
        verdict: step.verdict,
        mode: step.mode ?? null,
        message: step.message,
        relation: step.relation,
        card: step.card
      })),
      shareUrl: shareUrl(args.latex)
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
    const structured = {
      summary: `${step.verdict}: ${step.message}`,
      steps: [
        {
          row: step.row,
          verdict: step.verdict,
          mode: step.mode ?? null,
          message: step.message,
          relation: step.relation,
          card: step.card
        }
      ]
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
