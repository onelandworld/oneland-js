const createKeccakHash = require('keccak')
const ethJsUtil = require('ethjs-util');

/**
 * Attempts to turn a value into a `Buffer`. As input it supports `Buffer`, `String`, `Number`, null/undefined, `BN` and other objects with a `toArray()` method.
 * @param {*} v the value
 */
 const toBuffer = function (v) {
  if (!Buffer.isBuffer(v)) {
    if (Array.isArray(v)) {
      v = Buffer.from(v)
    } else if (typeof v === 'string') {
      if (ethJsUtil.isHexString(v)) {
        v = Buffer.from(ethJsUtil.padToEven(ethJsUtil.stripHexPrefix(v)), 'hex')
      } else {
        v = Buffer.from(v)
      }
    } else if (typeof v === 'number') {
      v = ethJsUtil.intToBuffer(v)
    } else if (v === null || v === undefined) {
      v = Buffer.allocUnsafe(0)
    } else if (v.toArray) {
      // converts a BN to a Buffer
      v = Buffer.from(v.toArray())
    } else {
      throw new Error('invalid type')
    }
  }
  return v
}

/**
 * Creates SHA-3 hash of the input
 * @param {Buffer|Array|String|Number} a the input data
 * @param {Number} [bits=256] the SHA width
 * @return {Buffer}
 */
const sha3 = function (a: Buffer | String, bits = 256) {
  a = toBuffer(a)

  return createKeccakHash('keccak' + bits).update(a).digest()
}

export const ethUtil = {
  sha3
};

